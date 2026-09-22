/**
 * Feature 002, Bloque A y Bloque E: la cuenta, el segundo factor y la lápida.
 *
 * Cada caso prueba que un estado que `modelo-datos.md` §7.1 declara imposible
 * **no se puede representar**. La diferencia con un test de servicio es esa: no
 * se verifica que el código no lo haga, se verifica que la base no lo deje.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import {
  BaseDePrueba,
  crearBaseConMigraciones,
  debeAceptar,
  debeRechazar,
  enTransaccionRevertida,
  ERROR,
  HAY_BASE,
  MOTIVO_OMISION,
} from './ayuda/base-de-prueba.js';
import {
  abrirSesion,
  bytes,
  crearAbogadoConPerfil,
  crearAdministrador,
  crearCuentaActiva,
  crearUsuario,
  id,
  registrarAceptaciones,
} from './ayuda/datos-acceso.js';

describe.skipIf(!HAY_BASE)('002 · Cuenta, segundo factor y lápida', () => {
  let base: BaseDePrueba;
  let cliente: Client;

  beforeAll(async () => {
    base = await crearBaseConMigraciones('a002cta');
    cliente = base.cliente;
  });

  afterAll(async () => {
    await base?.destruir();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // R-002-01 — CA-32, CA-38
  // ───────────────────────────────────────────────────────────────────────────

  it('R-002-01 · una cuenta ADMINISTRADOR ACTIVA sin segundo factor no es representable', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const usuarioId = await crearUsuario(cliente, { rol: 'ADMINISTRADOR' });
      const rechazo = await debeRechazar(
        cliente,
        `UPDATE acceso."Usuario" SET "estadoCuenta" = 'ACTIVA', "estadoMfa" = 'NO_CONFIGURADO' WHERE "id" = $1`,
        [usuarioId],
      );
      expect(rechazo.codigo).toBe(ERROR.RESTRICCION_CHECK);
      expect(rechazo.restriccion).toBe('ck_usuario_mfa_obligatorio');
    });
  });

  it('R-002-01 · tampoco un ABOGADO ACTIVO sin segundo factor (CA-38)', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const usuarioId = await crearUsuario(cliente, { rol: 'ABOGADO' });
      const rechazo = await debeRechazar(
        cliente,
        `UPDATE acceso."Usuario" SET "estadoCuenta" = 'ACTIVA', "estadoMfa" = 'INSCRIPCION_PENDIENTE_DE_CONFIRMACION' WHERE "id" = $1`,
        [usuarioId],
      );
      expect(rechazo.restriccion).toBe('ck_usuario_mfa_obligatorio');
    });
  });

  it('CA-39 · y un CLIENTE sí puede estar ACTIVO sin segundo factor: es opcional para él', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const usuarioId = await crearCuentaActiva(cliente, { rol: 'CLIENTE' });
      await cliente.query('SET CONSTRAINTS ALL IMMEDIATE');
      const { rows } = await cliente.query(
        `SELECT "estadoCuenta", "estadoMfa" FROM acceso."Usuario" WHERE "id" = $1`,
        [usuarioId],
      );
      expect(rows[0]).toEqual({ estadoCuenta: 'ACTIVA', estadoMfa: 'NO_CONFIGURADO' });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // R-002-02 — las tres vías de apagar el MFA de un administrador, cerradas
  // ───────────────────────────────────────────────────────────────────────────

  it('R-002-02 · el secreto TOTP de un ADMINISTRADOR no se puede desactivar', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const usuarioId = await crearAdministrador(cliente);
      await debeAceptar(
        cliente,
        `INSERT INTO acceso."SecretoTotp"
           ("usuarioId", "rolDelTitular", "secretoCifrado", "secretoNonce", "secretoTag",
            "secretoIdClave", "estado", "confirmadoEn")
         VALUES ($1, 'ADMINISTRADOR', $2, $3, $4, 'k_mfa:1', 'ACTIVO', now())`,
        [usuarioId, bytes(), bytes(12), bytes(16)],
      );

      const rechazo = await debeRechazar(
        cliente,
        `UPDATE acceso."SecretoTotp" SET "estado" = 'NO_CONFIGURADO', "desactivadoEn" = now() WHERE "usuarioId" = $1`,
        [usuarioId],
      );
      expect(rechazo.codigo).toBe(ERROR.RESTRICCION_CHECK);
      expect(rechazo.restriccion).toBe('ck_totp_no_desactivable_por_rol');
    });
  });

  it('R-002-02 · ni degradando el rol para esquivarlo: la clave foránea compuesta lo rechaza', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const usuarioId = await crearAdministrador(cliente);
      await debeAceptar(
        cliente,
        `INSERT INTO acceso."SecretoTotp"
           ("usuarioId", "rolDelTitular", "secretoCifrado", "secretoNonce", "secretoTag",
            "secretoIdClave", "estado", "confirmadoEn")
         VALUES ($1, 'ADMINISTRADOR', $2, $3, $4, 'k_mfa:1', 'ACTIVO', now())`,
        [usuarioId, bytes(), bytes(12), bytes(16)],
      );

      // Cambiar `Usuario.rol` mueve la columna generada `esAdministrador` y el
      // par replicado en E.1: las dos claves foráneas con ON UPDATE RESTRICT
      // hacen fallar el UPDATE.
      const rechazo = await debeRechazar(
        cliente,
        `UPDATE acceso."Usuario" SET "rol" = 'CLIENTE' WHERE "id" = $1`,
        [usuarioId],
      );
      // `23001` y no `23503`: es una violación de RESTRICT, que es
      // exactamente el mecanismo — la fila referenciada no se puede mover.
      expect(rechazo.codigo).toBe(ERROR.RESTRICT);
    });
  });

  it('R-002-02 · ni concediéndole el permiso por un ajuste individual (la grieta del mecanismo)', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const admin = await crearAdministrador(cliente);
      const rechazo = await debeRechazar(
        cliente,
        `INSERT INTO acceso."AjustePermiso"
           ("id", "usuarioId", "permiso", "efecto", "otorgadoPor", "momento", "motivo", "claveIdempotencia")
         VALUES ($1, $2, 'mfa.desactivar.propio', 'CONCEDE', $2, now(), 'DECISION_DE_LA_PLATAFORMA', $3)`,
        [id('aj'), admin, id('idem')],
      );
      expect(rechazo.restriccion).toBe('ck_ajuste_no_concede_apagar_mfa');
    });
  });

  it('R-002-02 · retirar ese permiso sí se puede: lo que está prohibido es concederlo', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const admin = await crearAdministrador(cliente);
      await debeAceptar(
        cliente,
        `INSERT INTO acceso."AjustePermiso"
           ("id", "usuarioId", "permiso", "efecto", "otorgadoPor", "momento", "motivo", "claveIdempotencia")
         VALUES ($1, $2, 'mfa.desactivar.propio', 'RETIRA', $2, now(), 'INCIDENTE_DE_SEGURIDAD', $3)`,
        [id('aj'), admin, id('idem')],
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // R-002-16 — la sesión como segunda barrera
  // ───────────────────────────────────────────────────────────────────────────

  it('R-002-16 · una sesión de ABOGADO con un solo factor no se puede insertar', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const { usuarioId } = await crearAbogadoConPerfil(cliente);
      const rechazo = await debeRechazar(
        cliente,
        `INSERT INTO acceso."Sesion" ("id", "usuarioId", "rolDelTitular", "autenticadaEn", "nivelAutenticacion")
         VALUES ($1, $2, 'ABOGADO', now(), 'CONTRASENA')`,
        [id('ses'), usuarioId],
      );
      expect(rechazo.restriccion).toBe('ck_sesion_segundo_factor_por_rol');
    });
  });

  it('R-002-16 · y no se puede mentir el rol en la sesión: la clave foránea compuesta lo verifica', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const { usuarioId } = await crearAbogadoConPerfil(cliente);
      // Declarar CLIENTE para poder pasar el `CHECK` con un solo factor: la
      // clave foránea `(usuarioId, rolDelTitular) → Usuario(id, rol)` lo frena.
      const rechazo = await debeRechazar(
        cliente,
        `INSERT INTO acceso."Sesion" ("id", "usuarioId", "rolDelTitular", "autenticadaEn", "nivelAutenticacion")
         VALUES ($1, $2, 'CLIENTE', now(), 'CONTRASENA')`,
        [id('ses'), usuarioId],
      );
      expect(rechazo.codigo).toBe(ERROR.CLAVE_FORANEA);
      expect(rechazo.restriccion).toBe('fk_sesion_usuario_rol');
    });
  });

  it('una sesión de CLIENTE con un solo factor sí es legítima', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const usuarioId = await crearCuentaActiva(cliente, { rol: 'CLIENTE' });
      await expect(abrirSesion(cliente, usuarioId, 'CLIENTE', 'CONTRASENA')).resolves.toBeTruthy();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // R-002-10 — la lápida (CA-28, §5.4)
  // ───────────────────────────────────────────────────────────────────────────

  it('R-002-10 · una lápida con el correo adentro no es representable', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const usuarioId = await crearUsuario(cliente);
      const rechazo = await debeRechazar(
        cliente,
        `UPDATE acceso."Usuario"
            SET "estadoCuenta" = 'PURGADA', "purgadaEn" = now(), "motivoPurga" = 'NUNCA_CONFIRMADA'
          WHERE "id" = $1`,
        [usuarioId],
      );
      expect(rechazo.restriccion).toBe('ck_usuario_lapida_vacia');
    });
  });

  it('R-002-10 · una cuenta viva sin correo tampoco', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const usuarioId = await crearUsuario(cliente);
      const rechazo = await debeRechazar(
        cliente,
        `UPDATE acceso."Usuario" SET "correoCifrado" = NULL, "indiceCiegoCorreo" = NULL WHERE "id" = $1`,
        [usuarioId],
      );
      expect(rechazo.restriccion).toBe('ck_usuario_viva_con_correo');
    });
  });

  it('R-002-10 · una cuenta PURGADA sin fecha de purga tampoco', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const usuarioId = await crearUsuario(cliente);
      const rechazo = await debeRechazar(
        cliente,
        `UPDATE acceso."Usuario" SET "estadoCuenta" = 'PURGADA' WHERE "id" = $1`,
        [usuarioId],
      );
      expect(rechazo.restriccion).toBe('ck_usuario_purga_coherente');
    });
  });

  it('§5.4 · la purga completa sí pasa, y deja la fila con el identificador opaco y nada más', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const usuarioId = await crearUsuario(cliente);
      await debeAceptar(
        cliente,
        `UPDATE acceso."Usuario"
            SET "estadoCuenta" = 'PURGADA', "purgadaEn" = now(), "motivoPurga" = 'NUNCA_CONFIRMADA',
                "correoCifrado" = NULL, "correoNonce" = NULL, "correoTag" = NULL,
                "nombreParaMostrarCifrado" = NULL, "hashContrasena" = NULL, "indiceCiegoCorreo" = NULL
          WHERE "id" = $1`,
        [usuarioId],
      );
      const { rows } = await cliente.query(
        `SELECT "id", "correoCifrado", "hashContrasena", "indiceCiegoCorreo", "motivoPurga"
           FROM acceso."Usuario" WHERE "id" = $1`,
        [usuarioId],
      );
      expect(rows[0]).toEqual({
        id: usuarioId,
        correoCifrado: null,
        hashContrasena: null,
        indiceCiegoCorreo: null,
        motivoPurga: 'NUNCA_CONFIRMADA',
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Q-01 — un correo, una cuenta VIVA, y el índice es parcial a propósito
  // ───────────────────────────────────────────────────────────────────────────

  it('Q-01 · dos cuentas vivas no pueden compartir el índice ciego del correo', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const indice = bytes();
      await crearUsuario(cliente, { indiceCiegoCorreo: indice });
      const rechazo = await debeRechazar(
        cliente,
        `INSERT INTO acceso."Usuario"
           ("id", "indiceCiegoCorreo", "correoCifrado", "rol", "estadoCuenta")
         VALUES ($1, $2, $3, 'CLIENTE', 'NO_VERIFICADA')`,
        [id('usr'), indice, bytes()],
      );
      expect(rechazo.codigo).toBe(ERROR.UNICIDAD);
      expect(rechazo.restriccion).toBe('uq_usuario_correo');
    });
  });

  it('Q-01 · pero la lápida no bloquea un alta futura con el mismo correo: el índice es PARCIAL', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const indice = bytes();
      const viejo = await crearUsuario(cliente, { indiceCiegoCorreo: indice });
      await cliente.query(
        `UPDATE acceso."Usuario"
            SET "estadoCuenta" = 'PURGADA', "purgadaEn" = now(), "motivoPurga" = 'PEDIDO_DEL_TITULAR',
                "correoCifrado" = NULL, "nombreParaMostrarCifrado" = NULL,
                "hashContrasena" = NULL, "indiceCiegoCorreo" = NULL
          WHERE "id" = $1`,
        [viejo],
      );
      // Volver a darse de alta con el mismo correo es un derecho del titular
      // después de una baja.
      await debeAceptar(
        cliente,
        `INSERT INTO acceso."Usuario"
           ("id", "indiceCiegoCorreo", "correoCifrado", "rol", "estadoCuenta")
         VALUES ($1, $2, $3, 'CLIENTE', 'NO_VERIFICADA')`,
        [id('usr'), indice, bytes()],
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // E-002-7 — `BLOQUEADA_TEMPORALMENTE` no es almacenable
  // ───────────────────────────────────────────────────────────────────────────

  it('E-002-7 · `BLOQUEADA_TEMPORALMENTE` no existe como valor de EstadoCuenta', async () => {
    const { rows } = await cliente.query<{ valores: string[] }>(
      `SELECT array_agg(e.enumlabel ORDER BY e.enumsortorder) AS valores
         FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
         JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'acceso' AND t.typname = 'EstadoCuenta'`,
    );
    expect(rows[0]!.valores).not.toContain('BLOQUEADA_TEMPORALMENTE');
    // El bloqueo vive en D.6, indexado por clave de tráfico, porque se aplica
    // también a cuentas que no existen. Guardarlo en `Usuario` sería un oráculo
    // de enumeración.
    const { rows: pk } = await cliente.query<{ columna: string }>(
      `SELECT a.attname AS columna
         FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY (i.indkey)
        WHERE i.indrelid = 'acceso."BloqueoDeTrafico"'::regclass AND i.indisprimary`,
    );
    expect(pk.map((r) => r.columna)).toEqual(['claveDeTrafico']);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // R-002-20 — cuatro ojos en la restitución de segundo factor (CA-35)
  // ───────────────────────────────────────────────────────────────────────────

  it('R-002-20 · una sola persona no puede instruir y aprobar la misma restitución', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const titular = await crearCuentaActiva(cliente);
      const operador = await crearCuentaActiva(cliente);
      const rechazo = await debeRechazar(
        cliente,
        `INSERT INTO acceso."SolicitudDeRestitucionMfa"
           ("id", "titularId", "estado", "instruidaPor", "aprobadaPor", "verificacionResultado", "claveIdempotencia")
         VALUES ($1, $2, 'APROBADA', $3, $3, 'COINCIDE', $4)`,
        [id('res'), titular, operador, id('idem')],
      );
      expect(rechazo.restriccion).toBe('ck_restitucion_cuatro_ojos_distintos');
    });
  });

  it('R-002-20 · no se aprueba sin los dos pares de ojos', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const titular = await crearCuentaActiva(cliente);
      const uno = await crearCuentaActiva(cliente);
      const rechazo = await debeRechazar(
        cliente,
        `INSERT INTO acceso."SolicitudDeRestitucionMfa"
           ("id", "titularId", "estado", "instruidaPor", "verificacionResultado", "claveIdempotencia")
         VALUES ($1, $2, 'APROBADA', $3, 'COINCIDE', $4)`,
        [id('res'), titular, uno, id('idem')],
      );
      expect(rechazo.restriccion).toBe('ck_restitucion_aprobada_exige_dos');
    });
  });

  it('R-002-20 · ni con la comprobación de identidad en NO_COINCIDE', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const titular = await crearCuentaActiva(cliente);
      const uno = await crearCuentaActiva(cliente);
      const dos = await crearCuentaActiva(cliente);
      const rechazo = await debeRechazar(
        cliente,
        `INSERT INTO acceso."SolicitudDeRestitucionMfa"
           ("id", "titularId", "estado", "instruidaPor", "aprobadaPor", "verificacionResultado", "claveIdempotencia")
         VALUES ($1, $2, 'APROBADA', $3, $4, 'NO_COINCIDE', $5)`,
        [id('res'), titular, uno, dos, id('idem')],
      );
      expect(rechazo.restriccion).toBe('ck_restitucion_aprobada_exige_coincidencia');
    });
  });

  it('R-002-20 · el titular no puede intervenir en su propia restitución', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const titular = await crearCuentaActiva(cliente);
      const otro = await crearCuentaActiva(cliente);
      const rechazo = await debeRechazar(
        cliente,
        `INSERT INTO acceso."SolicitudDeRestitucionMfa"
           ("id", "titularId", "estado", "instruidaPor", "aprobadaPor", "verificacionResultado", "claveIdempotencia")
         VALUES ($1, $2, 'APROBADA', $2, $3, 'COINCIDE', $4)`,
        [id('res'), titular, otro, id('idem')],
      );
      expect(rechazo.restriccion).toBe('ck_restitucion_titular_no_interviene');
    });
  });

  it('R-002-20 · con dos personas distintas y comprobación COINCIDE, la aprobación pasa', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const titular = await crearCuentaActiva(cliente);
      const uno = await crearCuentaActiva(cliente);
      const dos = await crearCuentaActiva(cliente);
      await debeAceptar(
        cliente,
        `INSERT INTO acceso."SolicitudDeRestitucionMfa"
           ("id", "titularId", "estado", "instruidaPor", "aprobadaPor", "verificacionClase",
            "verificacionPor", "verificacionMomento", "verificacionResultado",
            "documentacionDestruidaEn", "resueltaEn", "claveIdempotencia")
         VALUES ($1, $2, 'APROBADA', $3, $4, 'CANAL_ALTERNATIVO_YA_REGISTRADO', $3, now(),
                 'COINCIDE', now(), now(), $5)`,
        [id('res'), titular, uno, dos, id('idem')],
      );
    });
  });

  it('E-002-2 · la tabla de documentación de restitución NO existe: el dato no se modela', async () => {
    // El escalamiento E-002-2 no es una nota en un documento: es la ausencia
    // verificable de la tabla. Si alguien la crea sin pasar por compuerta, este
    // test se pone rojo.
    const { rows } = await cliente.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM information_schema.tables
        WHERE table_schema = 'acceso' AND table_name = 'DocumentacionDeRestitucion'`,
    );
    expect(rows[0]!.n).toBe('0');
  });

  it('E-002-1 · la tabla del CUIT/CUIL tampoco: su migración está escrita y sin ejecutar', async () => {
    const { rows } = await cliente.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM information_schema.tables
        WHERE table_schema = 'acceso' AND table_name = 'IdentificadorFiscal'`,
    );
    expect(rows[0]!.n).toBe('0');
  });
});

describe.skipIf(HAY_BASE)('002 · Cuenta, segundo factor y lápida', () => {
  it.skip(`omitido — ${MOTIVO_OMISION}`, () => {});
});
