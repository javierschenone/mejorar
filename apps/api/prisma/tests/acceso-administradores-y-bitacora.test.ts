/**
 * Feature 002, Bloques F y G: cuentas administradoras nominadas y bitácora.
 *
 * Los cuatro disparadores DIFERIDOS se prueban forzando la evaluación con
 * `SET CONSTRAINTS ALL IMMEDIATE`, que es lo que hace PostgreSQL al cerrar la
 * transacción. Sin eso el test pasaría en verde sin haber ejercitado nada: los
 * casos corren dentro de una transacción que siempre se revierte.
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
  bytes,
  crearAdministrador,
  crearCuentaActiva,
  crearUsuario,
  id,
  registrarAceptaciones,
  registrarEvento,
} from './ayuda/datos-acceso.js';

/** Fuerza la evaluación de los disparadores diferidos, como haría el `COMMIT`. */
const CERRAR = 'SET CONSTRAINTS ALL IMMEDIATE';

describe.skipIf(!HAY_BASE)('002 · Administradores nominados y bitácora', () => {
  let base: BaseDePrueba;
  let cliente: Client;

  beforeAll(async () => {
    base = await crearBaseConMigraciones('a002adm');
    cliente = base.cliente;
  });

  afterAll(async () => {
    await base?.destruir();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // R-002-03 — CA-33 y CA-34
  // ───────────────────────────────────────────────────────────────────────────

  it('R-002-03 · una cuenta ADMINISTRADOR sin designación no cierra la transacción (CA-33)', async () => {
    await enTransaccionRevertida(cliente, async () => {
      await crearUsuario(cliente, { rol: 'ADMINISTRADOR' });
      const rechazo = await debeRechazar(cliente, CERRAR);
      expect(rechazo.mensaje).toContain('R-002-03 (CA-33)');
    });
  });

  it('R-002-03 · con designación pero SIN evento de auditoría, tampoco (CA-34)', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const usuarioId = await crearUsuario(cliente, { rol: 'ADMINISTRADOR' });
      await cliente.query(
        `INSERT INTO acceso."DesignacionDeAdministrador"
           ("usuarioId", "esAdministrador", "nombreCompletoCifrado", "nombreCompletoNonce",
            "nombreCompletoTag", "nombreCompletoIdClave", "documentoDeDesignacionReferencia",
            "huellaDocumentoDesignacion", "creadoPor", "esSiembra", "claveIdempotencia")
         VALUES ($1, true, $2, $3, $4, 'k_acceso:1', 'acta/1.pdf', 'sha256:1', NULL, true, $5)`,
        [usuarioId, bytes(), bytes(12), bytes(16), id('idem')],
      );
      const rechazo = await debeRechazar(cliente, CERRAR);
      // Crear un administrador sin dejar rastro no es una regla que se pueda
      // olvidar: es una transacción que no cierra.
      expect(rechazo.mensaje).toContain('R-002-03 (CA-34)');
    });
  });

  it('R-002-03 · con las tres cosas en la misma transacción, cierra', async () => {
    await enTransaccionRevertida(cliente, async () => {
      await crearAdministrador(cliente);
      await debeAceptar(cliente, CERRAR);
    });
  });

  it('§7.2 · no hay escalada de privilegio por UPDATE: `rol` no está en el inventario de mutabilidad', async () => {
    // El inventario de §7.2 para A.1 NO incluye `rol`, y la consecuencia es
    // más fuerte que el disparador diferido de R-002-03: promover una cuenta a
    // ADMINISTRADOR no es algo que haya que auditar, es algo que la base no
    // deja hacer. Una cuenta administradora se crea administradora, con su
    // designación y su evento, o no existe.
    await enTransaccionRevertida(cliente, async () => {
      const usuarioId = await crearCuentaActiva(cliente, { rol: 'CLIENTE' });
      const rechazo = await debeRechazar(
        cliente,
        `UPDATE acceso."Usuario" SET "rol" = 'ADMINISTRADOR', "estadoMfa" = 'ACTIVO' WHERE "id" = $1`,
        [usuarioId],
      );
      expect(rechazo.codigo).toBe(ERROR.RESTRICT);
      expect(rechazo.mensaje).toContain('{rol}');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // F.1 — la clave foránea compuesta contra la columna generada
  // ───────────────────────────────────────────────────────────────────────────

  it('F.1 · una designación no puede apuntar a alguien que no es administrador', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const usuarioId = await crearCuentaActiva(cliente, { rol: 'CLIENTE' });
      const rechazo = await debeRechazar(
        cliente,
        `INSERT INTO acceso."DesignacionDeAdministrador"
           ("usuarioId", "esAdministrador", "nombreCompletoCifrado", "nombreCompletoNonce",
            "nombreCompletoTag", "nombreCompletoIdClave", "documentoDeDesignacionReferencia",
            "huellaDocumentoDesignacion", "creadoPor", "esSiembra", "claveIdempotencia")
         VALUES ($1, true, $2, $3, $4, 'k_acceso:1', 'acta/1.pdf', 'sha256:1', NULL, true, $5)`,
        [usuarioId, bytes(), bytes(12), bytes(16), id('idem')],
      );
      expect(rechazo.codigo).toBe(ERROR.CLAVE_FORANEA);
      expect(rechazo.restriccion).toBe('fk_designacion_usuario_admin');
    });
  });

  it('F.1 · y un administrador CON designación no puede dejar de serlo', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const usuarioId = await crearAdministrador(cliente);
      // `esAdministrador` es GENERADA desde `rol`: degradar el rol la mueve, y
      // el `ON UPDATE RESTRICT` de la clave foránea compuesta lo rechaza.
      const rechazo = await debeRechazar(
        cliente,
        `UPDATE acceso."Usuario" SET "rol" = 'CLIENTE' WHERE "id" = $1`,
        [usuarioId],
      );
      expect(rechazo.codigo).toBe(ERROR.RESTRICT);
    });
  });

  it('F.1 · nadie se designa administrador a sí mismo', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const primero = await crearAdministrador(cliente);
      await cliente.query(
        `UPDATE acceso."DesignacionDeAdministrador" SET "nominalizadaEn" = now() WHERE "usuarioId" = $1`,
        [primero],
      );
      const segundo = await crearUsuario(cliente, { rol: 'ADMINISTRADOR' });
      const rechazo = await debeRechazar(
        cliente,
        `INSERT INTO acceso."DesignacionDeAdministrador"
           ("usuarioId", "esAdministrador", "nombreCompletoCifrado", "nombreCompletoNonce",
            "nombreCompletoTag", "nombreCompletoIdClave", "documentoDeDesignacionReferencia",
            "huellaDocumentoDesignacion", "creadoPor", "esSiembra", "claveIdempotencia")
         VALUES ($1, true, $2, $3, $4, 'k_acceso:1', 'acta/2.pdf', 'sha256:2', $1, false, $5)`,
        [segundo, bytes(), bytes(12), bytes(16), id('idem')],
      );
      expect(rechazo.restriccion).toBe('ck_designacion_no_autodesignacion');
    });
  });

  it('F.1 · una designación nominal sin creador no es representable, y la siembra sin creador sí', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const usuarioId = await crearUsuario(cliente, { rol: 'ADMINISTRADOR' });
      const rechazo = await debeRechazar(
        cliente,
        `INSERT INTO acceso."DesignacionDeAdministrador"
           ("usuarioId", "esAdministrador", "nombreCompletoCifrado", "nombreCompletoNonce",
            "nombreCompletoTag", "nombreCompletoIdClave", "documentoDeDesignacionReferencia",
            "huellaDocumentoDesignacion", "creadoPor", "esSiembra", "claveIdempotencia")
         VALUES ($1, true, $2, $3, $4, 'k_acceso:1', 'acta/1.pdf', 'sha256:1', NULL, false, $5)`,
        [usuarioId, bytes(), bytes(12), bytes(16), id('idem')],
      );
      expect(rechazo.restriccion).toBe('ck_designacion_creador_si_no_siembra');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // R-002-05 — recaudo C-2
  // ───────────────────────────────────────────────────────────────────────────

  it('R-002-05 · una sola cuenta de siembra en toda la vida de la base', async () => {
    await enTransaccionRevertida(cliente, async () => {
      await crearAdministrador(cliente, { esSiembra: true });
      const otro = await crearUsuario(cliente, { rol: 'ADMINISTRADOR' });
      const rechazo = await debeRechazar(
        cliente,
        `INSERT INTO acceso."DesignacionDeAdministrador"
           ("usuarioId", "esAdministrador", "nombreCompletoCifrado", "nombreCompletoNonce",
            "nombreCompletoTag", "nombreCompletoIdClave", "documentoDeDesignacionReferencia",
            "huellaDocumentoDesignacion", "creadoPor", "esSiembra", "claveIdempotencia")
         VALUES ($1, true, $2, $3, $4, 'k_acceso:1', 'acta/2.pdf', 'sha256:2', NULL, true, $5)`,
        [otro, bytes(), bytes(12), bytes(16), id('idem')],
      );
      expect(rechazo.codigo).toBe(ERROR.UNICIDAD);
      expect(rechazo.restriccion).toBe('uq_designacion_siembra');
    });
  });

  it('R-002-05 · la siembra no queda viva "por las dudas" después de la primera cuenta nominal', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const siembra = await crearAdministrador(cliente, { esSiembra: true });
      const nominal = await crearUsuario(cliente, { rol: 'ADMINISTRADOR' });
      await cliente.query(
        `INSERT INTO acceso."DesignacionDeAdministrador"
           ("usuarioId", "esAdministrador", "nombreCompletoCifrado", "nombreCompletoNonce",
            "nombreCompletoTag", "nombreCompletoIdClave", "documentoDeDesignacionReferencia",
            "huellaDocumentoDesignacion", "creadoPor", "esSiembra", "claveIdempotencia")
         VALUES ($1, true, $2, $3, $4, 'k_acceso:1', 'acta/2.pdf', 'sha256:2', $5, false, $6)`,
        [nominal, bytes(), bytes(12), bytes(16), siembra, id('idem')],
      );
      await registrarEvento(cliente, { accion: 'ADMINISTRADOR_CREADO', titularAfectado: nominal });

      const rechazo = await debeRechazar(cliente, CERRAR);
      expect(rechazo.mensaje).toContain('R-002-05 (recaudo C-2)');
    });
  });

  it('R-002-05 · con la siembra nominalizada, la segunda designación cierra', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const siembra = await crearAdministrador(cliente, { esSiembra: true });
      await cliente.query(
        `UPDATE acceso."DesignacionDeAdministrador" SET "nominalizadaEn" = now() WHERE "usuarioId" = $1`,
        [siembra],
      );
      const nominal = await crearUsuario(cliente, { rol: 'ADMINISTRADOR' });
      await registrarAceptaciones(cliente, nominal);
      await cliente.query(
        `INSERT INTO acceso."DesignacionDeAdministrador"
           ("usuarioId", "esAdministrador", "nombreCompletoCifrado", "nombreCompletoNonce",
            "nombreCompletoTag", "nombreCompletoIdClave", "documentoDeDesignacionReferencia",
            "huellaDocumentoDesignacion", "creadoPor", "esSiembra", "claveIdempotencia")
         VALUES ($1, true, $2, $3, $4, 'k_acceso:1', 'acta/2.pdf', 'sha256:2', $5, false, $6)`,
        [nominal, bytes(), bytes(12), bytes(16), siembra, id('idem')],
      );
      await registrarEvento(cliente, { accion: 'ADMINISTRADOR_CREADO', titularAfectado: nominal });
      await debeAceptar(cliente, CERRAR);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // R-002-04 — buzones de rol, con el correo cifrado
  // ───────────────────────────────────────────────────────────────────────────

  it('R-002-04 · no hay cuenta administradora en un buzón de rol, aunque el correo esté cifrado', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const indice = bytes();
      await cliente.query(
        `INSERT INTO acceso."CorreoDeRolProhibido" ("indiceCiego", "etiqueta") VALUES ($1, 'admin@')`,
        [indice],
      );
      const rechazo = await debeRechazar(
        cliente,
        `INSERT INTO acceso."Usuario" ("id", "indiceCiegoCorreo", "correoCifrado", "rol", "estadoCuenta")
         VALUES ($1, $2, $3, 'ADMINISTRADOR', 'NO_VERIFICADA')`,
        [id('usr'), indice, bytes()],
      );
      expect(rechazo.mensaje).toContain('R-002-04 (CA-33)');
      expect(rechazo.mensaje).toContain('admin@');
    });
  });

  it('R-002-04 · el mismo buzón como cuenta CLIENTE no se bloquea: la regla es de administradores', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const indice = bytes();
      await cliente.query(
        `INSERT INTO acceso."CorreoDeRolProhibido" ("indiceCiego", "etiqueta") VALUES ($1, 'info@')`,
        [indice],
      );
      await debeAceptar(
        cliente,
        `INSERT INTO acceso."Usuario" ("id", "indiceCiegoCorreo", "correoCifrado", "rol", "estadoCuenta")
         VALUES ($1, $2, $3, 'CLIENTE', 'NO_VERIFICADA')`,
        [id('usr'), indice, bytes()],
      );
    });
  });

  it('R-002-04 · §7.3 declara el límite: hoy el catálogo D.8 está vacío y el mecanismo es inerte', async () => {
    // El `k_indice` con el que se calculan estos índices ciegos vive FUERA de
    // la base (§4.3) y una migración no lo tiene. Los siembra `prisma/seed.ts`.
    // El test existe para que la brecha esté declarada y no escondida: el día
    // que el seed corra en un entorno, este número deja de ser cero.
    const { rows } = await cliente.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM acceso."CorreoDeRolProhibido"`,
    );
    expect(rows[0]!.n).toBe('0');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // R-002-11 — la bitácora no puede quedar huérfana (§5.4)
  // ───────────────────────────────────────────────────────────────────────────

  it('R-002-11 · no se puede borrar una cuenta que tiene eventos: el DELETE falla en el motor', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const usuarioId = await crearCuentaActiva(cliente);
      await registrarEvento(cliente, {
        accion: 'INGRESO_EXITOSO',
        sujeto: usuarioId,
        titularAfectado: usuarioId,
        clasificacion: 'PERSONAL',
      });

      const rechazo = await debeRechazar(
        cliente,
        `DELETE FROM acceso."Usuario" WHERE "id" = $1`,
        [usuarioId],
      );
      // La única salida es la lápida de §5.4. No es una convención: es
      // imposible dejar la bitácora apuntando a la nada.
      expect([ERROR.CLAVE_FORANEA, ERROR.RESTRICT]).toContain(rechazo.codigo);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // R-002-12 — la bitácora es inmutable
  // ───────────────────────────────────────────────────────────────────────────

  it('R-002-12 · un evento de auditoría no se puede modificar', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const usuarioId = await crearCuentaActiva(cliente);
      await registrarEvento(cliente, { accion: 'RECURSO_LEIDO', sujeto: usuarioId });
      const rechazo = await debeRechazar(
        cliente,
        `UPDATE auditoria."EventoAuditoria" SET "resultado" = 'FALLIDO' WHERE "sujeto" = $1`,
        [usuarioId],
      );
      expect(rechazo.codigo).toBe(ERROR.RESTRICT);
      expect(rechazo.mensaje).toContain('SOLO INSERCION');
    });
  });

  it('R-002-12 · ni borrar', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const usuarioId = await crearCuentaActiva(cliente);
      await registrarEvento(cliente, { accion: 'RECURSO_LEIDO', sujeto: usuarioId });
      const rechazo = await debeRechazar(
        cliente,
        `DELETE FROM auditoria."EventoAuditoria" WHERE "sujeto" = $1`,
        [usuarioId],
      );
      expect(rechazo.codigo).toBe(ERROR.RESTRICT);
    });
  });

  it('R-002-12 · el sello de Merkle tampoco se reescribe', async () => {
    await enTransaccionRevertida(cliente, async () => {
      await cliente.query(
        `INSERT INTO auditoria."SelloDeBitacora"
           ("particion", "desdeSecuencia", "hastaSecuencia", "raiz", "firma", "kid")
         VALUES (date_trunc('month', now())::date, 1, 100, 'raiz', 'firma', 'kid-1')`,
      );
      const rechazo = await debeRechazar(
        cliente,
        `UPDATE auditoria."SelloDeBitacora" SET "raiz" = 'otra' WHERE "kid" = 'kid-1'`,
      );
      expect(rechazo.codigo).toBe(ERROR.RESTRICT);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // R-002-22 — D-002-10
  // ───────────────────────────────────────────────────────────────────────────

  it('R-002-22 · un evento sin clasificación del dato alcanzado no es representable', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const rechazo = await debeRechazar(
        cliente,
        `INSERT INTO auditoria."EventoAuditoria"
           ("id", "accion", "resultado", "origenCanal", "idCorrelacion")
         VALUES ($1, 'RECURSO_LEIDO', 'PERMITIDO', 'API', 'corr-1')`,
        [id('evt')],
      );
      expect(rechazo.codigo).toBe(ERROR.NO_NULO);
    });
  });

  it('G.1 · `datos` admite pares clave/valor escalares y rechaza el texto libre anidado', async () => {
    await enTransaccionRevertida(cliente, async () => {
      await debeAceptar(
        cliente,
        `INSERT INTO auditoria."EventoAuditoria"
           ("id", "accion", "clasificacion", "resultado", "origenCanal", "idCorrelacion", "datos")
         VALUES ($1, 'RECURSO_LEIDO', 'INTERNO', 'PERMITIDO', 'API', 'corr-1',
                 '[{"clave":"tipo","valor":"perfil"},{"clave":"cantidad","valor":3},{"clave":"nulo","valor":null}]')`,
        [id('evt')],
      );
      // Un objeto anidado es la vía por la que un dato patrimonial se filtra a
      // una tabla que nadie cifra.
      const rechazo = await debeRechazar(
        cliente,
        `INSERT INTO auditoria."EventoAuditoria"
           ("id", "accion", "clasificacion", "resultado", "origenCanal", "idCorrelacion", "datos")
         VALUES ($1, 'RECURSO_LEIDO', 'INTERNO', 'PERMITIDO', 'API', 'corr-1',
                 '[{"clave":"deuda","valor":{"saldo":100000,"moneda":"ARS"}}]')`,
        [id('evt')],
      );
      expect(rechazo.restriccion).toBe('ck_evento_datos_cerrados');

      // Y una clave suelta sin la forma del par, tampoco.
      const suelto = await debeRechazar(
        cliente,
        `INSERT INTO auditoria."EventoAuditoria"
           ("id", "accion", "clasificacion", "resultado", "origenCanal", "idCorrelacion", "datos")
         VALUES ($1, 'RECURSO_LEIDO', 'INTERNO', 'PERMITIDO', 'API', 'corr-1',
                 '{"observacion":"texto libre del operador"}')`,
        [id('evt')],
      );
      expect(suelto.restriccion).toBe('ck_evento_datos_cerrados');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // G.1 — particionado
  // ───────────────────────────────────────────────────────────────────────────

  it('G.1 · la bitácora está PARTICIONADA por rango mensual sobre `momento`', async () => {
    const { rows } = await cliente.query<{ estrategia: string; clave: string }>(
      `SELECT p.partstrat AS estrategia,
              pg_get_partkeydef('auditoria."EventoAuditoria"'::regclass) AS clave
         FROM pg_partitioned_table p
        WHERE p.partrelid = 'auditoria."EventoAuditoria"'::regclass`,
    );
    expect(rows[0]!.estrategia).toBe('r');
    expect(rows[0]!.clave).toContain('momento');
  });

  it('G.1 · la migración deja 12 particiones adelantadas más la del mes en curso', async () => {
    const { rows } = await cliente.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM pg_inherits i
         JOIN pg_class c ON c.oid = i.inhrelid
        WHERE i.inhparent = 'auditoria."EventoAuditoria"'::regclass
          AND c.relname LIKE 'EventoAuditoria\\_2%'`,
    );
    expect(rows[0]!.n).toBe('13');
  });

  it('G.1 · hay partición por defecto, y en operación normal está vacía', async () => {
    // Existe para que un evento fuera de rango NO haga fallar la acción
    // auditada: perder el registro de lo que pasó es peor que tener una
    // partición incómoda de soltar. Si tiene filas, la rutina dejó de correr.
    const { rows } = await cliente.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM auditoria."EventoAuditoria_fuera_de_rango"`,
    );
    expect(rows[0]!.n).toBe('0');
  });

  it('G.1 · la rutina de particiones es idempotente: correrla de nuevo no crea ninguna', async () => {
    const { rows } = await cliente.query<{ creadas: number }>(
      `SELECT auditoria.asegurar_particiones_de_bitacora(12) AS creadas`,
    );
    expect(rows[0]!.creadas).toBe(0);
  });

  it('§5 · la retención de la bitácora se ejecuta SOLTANDO PARTICIONES, no borrando filas', async () => {
    // Es la razón por la que el disparador de inmutabilidad puede bloquear el
    // `DELETE` sin volver imposible la purga.
    const nombre = `EventoAuditoria_${new Date().getUTCFullYear() + 1}m01`;
    const existe = await cliente.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'auditoria' AND c.relname = $1`,
      [nombre],
    );
    expect(existe.rows[0]!.n).toBe('1');
    await debeAceptar(cliente, `DROP TABLE "auditoria".${JSON.stringify(nombre).replace(/"/g, '"')}`);
    // Se vuelve a crear para no dejar la base de prueba coja para los demás casos.
    await cliente.query(`SELECT auditoria.asegurar_particiones_de_bitacora(12)`);
  });
});

describe.skipIf(HAY_BASE)('002 · Administradores nominados y bitácora', () => {
  it.skip(`omitido — ${MOTIVO_OMISION}`, () => {});
});
