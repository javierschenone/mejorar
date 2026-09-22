/**
 * Feature 002, Bloque C: verificación de matrícula y su vigencia.
 *
 * El bloque entero existe para que "verificado" nunca sea una afirmación
 * permanente y sin respaldo (condición C-002-07, salvaguardas M-1 y M-6). Dos
 * propiedades se prueban acá y son las que el dictamen §4.4 reclama:
 *
 *   1. No hay ninguna columna con el estado de la verificación. Se deriva.
 *   2. Aprobar sin evidencia y sin vencimiento no es representable.
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
  aprobarMatricula,
  crearAbogadoConPerfil,
  crearAdministrador,
  crearCuentaActiva,
  crearEnvio,
  crearUsuario,
  id,
} from './ayuda/datos-acceso.js';

describe.skipIf(!HAY_BASE)('002 · Verificación profesional y vigencia', () => {
  let base: BaseDePrueba;
  let cliente: Client;

  beforeAll(async () => {
    base = await crearBaseConMigraciones('a002ver');
    cliente = base.cliente;
  });

  afterAll(async () => {
    await base?.destruir();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // D-2 — el estado derivable no se almacena
  // ───────────────────────────────────────────────────────────────────────────

  it('D-2 · no existe ninguna columna con el estado de la verificación', async () => {
    // El defecto que el dictamen §4.4 señala: "un estado VERIFICADO sin fecha y
    // sin vencimiento es verdadero el día que se otorga y puede ser falso al
    // mes siguiente". Una columna exige un proceso que la mantenga, y un
    // proceso que no corre deja al sistema afirmando algo falso.
    const { rows } = await cliente.query<{ f: string }>(
      `SELECT table_name || '.' || column_name AS f
         FROM information_schema.columns
        WHERE table_schema = 'acceso'
          AND (column_name ILIKE '%estadoVerificacion%'
            OR column_name ILIKE '%estadoMatricula%'
            OR column_name ILIKE '%matriculaVigente%'
            OR column_name ILIKE '%verificacionCacheada%')
        ORDER BY 1`,
    );
    expect(rows.map((r) => r.f)).toEqual([]);
  });

  it('D-2 · lo que sí se guarda es el puntero al último hecho, que no depende del tiempo', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const admin = await crearAdministrador(cliente);
      const { usuarioId, matricula, jurisdiccion } = await crearAbogadoConPerfil(cliente);

      const antes = await cliente.query(
        `SELECT "ultimaDecisionId", "tieneVerificacionAprobada" FROM acceso."PerfilProfesional" WHERE "usuarioId" = $1`,
        [usuarioId],
      );
      expect(antes.rows[0]).toEqual({ ultimaDecisionId: null, tieneVerificacionAprobada: false });

      const decisionId = await aprobarMatricula(cliente, usuarioId, admin, { jurisdiccion, matricula });

      const despues = await cliente.query(
        `SELECT "ultimaDecisionId", "tieneVerificacionAprobada" FROM acceso."PerfilProfesional" WHERE "usuarioId" = $1`,
        [usuarioId],
      );
      expect(despues.rows[0]).toEqual({ ultimaDecisionId: decisionId, tieneVerificacionAprobada: true });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // R-002-09 y R-002-08 — CA-05, salvaguardas M-6 y M-1
  // ───────────────────────────────────────────────────────────────────────────

  it('R-002-09 · un "verificado" sin fecha de vencimiento no es representable', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const admin = await crearAdministrador(cliente);
      const { usuarioId } = await crearAbogadoConPerfil(cliente);
      const rechazo = await debeRechazar(
        cliente,
        `INSERT INTO acceso."DecisionDeVerificacion"
           ("id", "perfilUsuarioId", "momento", "resultado", "decididaPor", "claveIdempotencia",
            "evidenciaColegio", "evidenciaJurisdiccion", "evidenciaNumeroDeMatricula",
            "evidenciaClaseDeConstancia", "evidenciaFechaDeLaConstancia",
            "evidenciaReferenciaDelDocumento", "evidenciaHuellaDocumento")
         VALUES ($1, $2, now(), 'APROBADA', $3, $4, 'Colegio', 'CABA', 'T1',
                 'CONSTANCIA_EMITIDA_POR_EL_COLEGIO', now()::date, 'obj/1', 'sha256:1')`,
        [id('dec'), usuarioId, admin, id('idem')],
      );
      expect(rechazo.restriccion).toBe('ck_decision_vigencia_si_aprobada');
    });
  });

  it('R-002-09 · y un rechazo CON fecha de vencimiento tampoco: la equivalencia va en los dos sentidos', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const admin = await crearAdministrador(cliente);
      const { usuarioId } = await crearAbogadoConPerfil(cliente);
      const rechazo = await debeRechazar(
        cliente,
        `INSERT INTO acceso."DecisionDeVerificacion"
           ("id", "perfilUsuarioId", "momento", "resultado", "vigenciaHasta", "decididaPor",
            "motivoRechazo", "claveIdempotencia")
         VALUES ($1, $2, now(), 'RECHAZADA', now()::date, $3, 'CONSTANCIA_ILEGIBLE', $4)`,
        [id('dec'), usuarioId, admin, id('idem')],
      );
      expect(rechazo.restriccion).toBe('ck_decision_vigencia_si_aprobada');
    });
  });

  it('R-002-08 · aprobar sin registrar la evidencia no es representable (M-1)', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const admin = await crearAdministrador(cliente);
      const { usuarioId } = await crearAbogadoConPerfil(cliente);
      const rechazo = await debeRechazar(
        cliente,
        `INSERT INTO acceso."DecisionDeVerificacion"
           ("id", "perfilUsuarioId", "momento", "resultado", "vigenciaHasta", "decididaPor", "claveIdempotencia")
         VALUES ($1, $2, now(), 'APROBADA', (now() + interval '1 year')::date, $3, $4)`,
        [id('dec'), usuarioId, admin, id('idem')],
      );
      expect(rechazo.restriccion).toBe('ck_decision_evidencia_obligatoria');
    });
  });

  it('un rechazo sin motivo tipificado tampoco: no sería revisable ni reclamable', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const admin = await crearAdministrador(cliente);
      const { usuarioId } = await crearAbogadoConPerfil(cliente);
      const rechazo = await debeRechazar(
        cliente,
        `INSERT INTO acceso."DecisionDeVerificacion"
           ("id", "perfilUsuarioId", "momento", "resultado", "decididaPor", "claveIdempotencia")
         VALUES ($1, $2, now(), 'RECHAZADA', $3, $4)`,
        [id('dec'), usuarioId, admin, id('idem')],
      );
      expect(rechazo.restriccion).toBe('ck_decision_motivo_si_rechazada');
    });
  });

  it('C.1 invariante 4 · la jurisdicción de la evidencia tiene que coincidir con la declarada (M-7)', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const admin = await crearAdministrador(cliente);
      const { usuarioId } = await crearAbogadoConPerfil(cliente, { jurisdiccion: 'CORDOBA' });
      // Verificar una matrícula de Córdoba contra una constancia de Salta es el
      // error que M-7 viene a prevenir en la asignación de casos.
      const rechazo = await debeRechazar(
        cliente,
        `INSERT INTO acceso."DecisionDeVerificacion"
           ("id", "perfilUsuarioId", "momento", "resultado", "vigenciaHasta", "decididaPor",
            "evidenciaColegio", "evidenciaJurisdiccion", "evidenciaNumeroDeMatricula",
            "evidenciaClaseDeConstancia", "evidenciaFechaDeLaConstancia",
            "evidenciaReferenciaDelDocumento", "evidenciaHuellaDocumento", "claveIdempotencia")
         VALUES ($1, $2, now(), 'APROBADA', (now() + interval '1 year')::date, $3,
                 'Colegio de Salta', 'SALTA', 'T1', 'CONSTANCIA_EMITIDA_POR_EL_COLEGIO',
                 now()::date, 'obj/1', 'sha256:1', $4)`,
        [id('dec'), usuarioId, admin, id('idem')],
      );
      expect(rechazo.mensaje).toContain('no coincide con la declarada');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // R-002-18 — el caso límite del §7 de la spec
  // ───────────────────────────────────────────────────────────────────────────

  it('R-002-18 · dos cuentas pueden DECLARAR la misma matrícula: el alta no falla en el acto', async () => {
    await enTransaccionRevertida(cliente, async () => {
      await crearAbogadoConPerfil(cliente, { matricula: 'T12345', jurisdiccion: 'CABA' });
      await expect(
        crearAbogadoConPerfil(cliente, { matricula: 'T12345', jurisdiccion: 'CABA' }),
      ).resolves.toBeTruthy();
    });
  });

  it('R-002-18 · pero sólo una puede quedar VERIFICADA con esa matrícula', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const admin = await crearAdministrador(cliente);
      const uno = await crearAbogadoConPerfil(cliente, { matricula: 'T77777', jurisdiccion: 'CABA' });
      const dos = await crearAbogadoConPerfil(cliente, { matricula: 'T77777', jurisdiccion: 'CABA' });

      await aprobarMatricula(cliente, uno.usuarioId, admin, { jurisdiccion: 'CABA', matricula: 'T77777' });

      // La segunda aprobación falla al proyectar `tieneVerificacionAprobada`:
      // el índice único parcial no admite dos verificadas con la misma
      // matrícula en la misma jurisdicción.
      const rechazo = await debeRechazar(
        cliente,
        `INSERT INTO acceso."DecisionDeVerificacion"
           ("id", "perfilUsuarioId", "momento", "resultado", "vigenciaHasta", "decididaPor",
            "evidenciaColegio", "evidenciaJurisdiccion", "evidenciaNumeroDeMatricula",
            "evidenciaClaseDeConstancia", "evidenciaFechaDeLaConstancia",
            "evidenciaReferenciaDelDocumento", "evidenciaHuellaDocumento", "claveIdempotencia")
         VALUES ($1, $2, now(), 'APROBADA', (now() + interval '1 year')::date, $3,
                 'Colegio', 'CABA', 'T77777', 'CONSTANCIA_EMITIDA_POR_EL_COLEGIO',
                 now()::date, 'obj/2', 'sha256:2', $4)`,
        [id('dec'), dos.usuarioId, admin, id('idem')],
      );
      expect(rechazo.codigo).toBe(ERROR.UNICIDAD);
      expect(rechazo.restriccion).toBe('uq_perfil_matricula_verificada');
    });
  });

  it('R-002-18 · la misma matrícula en OTRA jurisdicción sí puede estar verificada', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const admin = await crearAdministrador(cliente);
      const uno = await crearAbogadoConPerfil(cliente, { matricula: 'T88888', jurisdiccion: 'CABA' });
      const dos = await crearAbogadoConPerfil(cliente, { matricula: 'T88888', jurisdiccion: 'CORDOBA' });
      await aprobarMatricula(cliente, uno.usuarioId, admin, { jurisdiccion: 'CABA', matricula: 'T88888' });
      await expect(
        aprobarMatricula(cliente, dos.usuarioId, admin, { jurisdiccion: 'CORDOBA', matricula: 'T88888' }),
      ).resolves.toBeTruthy();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // R-002-19 — CA-24
  // ───────────────────────────────────────────────────────────────────────────

  it('R-002-19 · antes de la aprobación, corregir una errata en la matrícula es legítimo', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const { usuarioId } = await crearAbogadoConPerfil(cliente, { matricula: 'T0001' });
      await debeAceptar(
        cliente,
        `UPDATE acceso."PerfilProfesional" SET "matricula" = 'T0002' WHERE "usuarioId" = $1`,
        [usuarioId],
      );
    });
  });

  it('R-002-19 · después de la aprobación, el abogado no autoedita su matrícula verificada', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const admin = await crearAdministrador(cliente);
      const { usuarioId, matricula, jurisdiccion } = await crearAbogadoConPerfil(cliente);
      await aprobarMatricula(cliente, usuarioId, admin, { jurisdiccion, matricula });

      const rechazo = await debeRechazar(
        cliente,
        `UPDATE acceso."PerfilProfesional" SET "matricula" = 'T99999' WHERE "usuarioId" = $1`,
        [usuarioId],
      );
      expect(rechazo.codigo).toBe(ERROR.RESTRICT);
      expect(rechazo.mensaje).toContain('R-002-19');
    });
  });

  it('§7.2 · un perfil profesional no puede cambiar de dueño ni de rol', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const { usuarioId } = await crearAbogadoConPerfil(cliente);
      const rechazo = await debeRechazar(
        cliente,
        `UPDATE acceso."PerfilProfesional" SET "solicitadaEn" = now() - interval '1 year' WHERE "usuarioId" = $1`,
        [usuarioId],
      );
      expect(rechazo.codigo).toBe(ERROR.RESTRICT);
    });
  });

  it('un perfil profesional colgando de un CLIENTE no es representable', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const usuarioId = await crearCuentaActiva(cliente, { rol: 'CLIENTE' });
      const rechazo = await debeRechazar(
        cliente,
        `INSERT INTO acceso."PerfilProfesional"
           ("usuarioId", "rolDelTitular", "matricula", "jurisdiccion", "solicitadaEn")
         VALUES ($1, 'CLIENTE', 'T1', 'CABA', now())`,
        [usuarioId],
      );
      expect(rechazo.restriccion).toBe('ck_perfil_rol_abogado');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // C.1 y C.3 — sólo inserción, e idempotencia del aviso
  // ───────────────────────────────────────────────────────────────────────────

  it('C.1 · una decisión no se corrige: se emite otra', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const admin = await crearAdministrador(cliente);
      const { usuarioId, matricula, jurisdiccion } = await crearAbogadoConPerfil(cliente);
      const decisionId = await aprobarMatricula(cliente, usuarioId, admin, { jurisdiccion, matricula });

      const rechazo = await debeRechazar(
        cliente,
        `UPDATE acceso."DecisionDeVerificacion" SET "resultado" = 'RECHAZADA' WHERE "id" = $1`,
        [decisionId],
      );
      expect(rechazo.codigo).toBe(ERROR.RESTRICT);
      expect(rechazo.mensaje).toContain('SOLO INSERCION');

      const borrado = await debeRechazar(
        cliente,
        `DELETE FROM acceso."DecisionDeVerificacion" WHERE "id" = $1`,
        [decisionId],
      );
      expect(borrado.codigo).toBe(ERROR.RESTRICT);
    });
  });

  it('C.3 · el mismo aviso de vigencia no se manda dos veces: la PK es la clave de idempotencia', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const admin = await crearAdministrador(cliente);
      const { usuarioId, matricula, jurisdiccion } = await crearAbogadoConPerfil(cliente);
      const decisionId = await aprobarMatricula(cliente, usuarioId, admin, { jurisdiccion, matricula });
      const envio1 = await crearEnvio(cliente, 'MATRICULA_POR_VENCER', usuarioId);
      const envio2 = await crearEnvio(cliente, 'MATRICULA_POR_VENCER', usuarioId);

      await debeAceptar(
        cliente,
        `INSERT INTO acceso."HitoDeVigenciaNotificado"
           ("perfilUsuarioId", "decisionId", "hito", "notificadoEn", "envioId")
         VALUES ($1, $2, 'POR_VENCER_30D', now(), $3)`,
        [usuarioId, decisionId, envio1],
      );
      const rechazo = await debeRechazar(
        cliente,
        `INSERT INTO acceso."HitoDeVigenciaNotificado"
           ("perfilUsuarioId", "decisionId", "hito", "notificadoEn", "envioId")
         VALUES ($1, $2, 'POR_VENCER_30D', now(), $3)`,
        [usuarioId, decisionId, envio2],
      );
      expect(rechazo.codigo).toBe(ERROR.UNICIDAD);

      // Otro hito sobre la misma decisión sí se puede: son avisos distintos.
      await debeAceptar(
        cliente,
        `INSERT INTO acceso."HitoDeVigenciaNotificado"
           ("perfilUsuarioId", "decisionId", "hito", "notificadoEn", "envioId")
         VALUES ($1, $2, 'POR_VENCER_7D', now(), $3)`,
        [usuarioId, decisionId, envio2],
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // C.2 — CA-30
  // ───────────────────────────────────────────────────────────────────────────

  it('C.2 · a lo sumo una suspensión abierta por perfil', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const admin = await crearAdministrador(cliente);
      const { usuarioId } = await crearAbogadoConPerfil(cliente);

      await debeAceptar(
        cliente,
        `INSERT INTO acceso."SuspensionDeMatricula"
           ("id", "perfilUsuarioId", "desde", "dispuestaPor", "motivo", "claveIdempotencia")
         VALUES ($1, $2, now(), $3, 'NOTIFICACION_DEL_COLEGIO', $4)`,
        [id('sus'), usuarioId, admin, id('idem')],
      );
      const rechazo = await debeRechazar(
        cliente,
        `INSERT INTO acceso."SuspensionDeMatricula"
           ("id", "perfilUsuarioId", "desde", "dispuestaPor", "motivo", "claveIdempotencia")
         VALUES ($1, $2, now(), $3, 'DENUNCIA_RECIBIDA', $4)`,
        [id('sus'), usuarioId, admin, id('idem')],
      );
      expect(rechazo.restriccion).toBe('uq_suspension_abierta');
    });
  });

  it('C.2 · una suspensión levantada sin quién ni por qué no es representable', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const admin = await crearAdministrador(cliente);
      const { usuarioId } = await crearAbogadoConPerfil(cliente);
      const suspensionId = id('sus');
      await cliente.query(
        `INSERT INTO acceso."SuspensionDeMatricula"
           ("id", "perfilUsuarioId", "desde", "dispuestaPor", "motivo", "claveIdempotencia")
         VALUES ($1, $2, now(), $3, 'NOTIFICACION_DEL_COLEGIO', $4)`,
        [suspensionId, usuarioId, admin, id('idem')],
      );
      const rechazo = await debeRechazar(
        cliente,
        `UPDATE acceso."SuspensionDeMatricula" SET "levantadaEn" = now() WHERE "id" = $1`,
        [suspensionId],
      );
      expect(rechazo.restriccion).toBe('ck_suspension_levantamiento_completo');
    });
  });

  it('C.2 · levantada la suspensión, se puede abrir otra: el índice es PARCIAL', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const admin = await crearAdministrador(cliente);
      const { usuarioId } = await crearAbogadoConPerfil(cliente);
      const primera = id('sus');
      await cliente.query(
        `INSERT INTO acceso."SuspensionDeMatricula"
           ("id", "perfilUsuarioId", "desde", "dispuestaPor", "motivo", "claveIdempotencia")
         VALUES ($1, $2, now(), $3, 'NOTIFICACION_DEL_COLEGIO', $4)`,
        [primera, usuarioId, admin, id('idem')],
      );
      await cliente.query(
        `UPDATE acceso."SuspensionDeMatricula"
            SET "levantadaEn" = now(), "levantadaPor" = $2, "motivoLevantamiento" = 'RESUELTA_POR_EL_COLEGIO'
          WHERE "id" = $1`,
        [primera, admin],
      );
      await debeAceptar(
        cliente,
        `INSERT INTO acceso."SuspensionDeMatricula"
           ("id", "perfilUsuarioId", "desde", "dispuestaPor", "motivo", "claveIdempotencia")
         VALUES ($1, $2, now(), $3, 'DENUNCIA_RECIBIDA', $4)`,
        [id('sus'), usuarioId, admin, id('idem')],
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // R-002-21 — idempotencia (constitución #12)
  // ───────────────────────────────────────────────────────────────────────────

  it('R-002-21 · una doble aprobación por doble clic no crea dos decisiones', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const admin = await crearAdministrador(cliente);
      const { usuarioId, matricula, jurisdiccion } = await crearAbogadoConPerfil(cliente);
      const clave = id('idem');

      const insertar = (decisionId: string) =>
        cliente.query(
          `INSERT INTO acceso."DecisionDeVerificacion"
             ("id", "perfilUsuarioId", "momento", "resultado", "vigenciaHasta", "decididaPor",
              "evidenciaColegio", "evidenciaJurisdiccion", "evidenciaNumeroDeMatricula",
              "evidenciaClaseDeConstancia", "evidenciaFechaDeLaConstancia",
              "evidenciaReferenciaDelDocumento", "evidenciaHuellaDocumento", "claveIdempotencia")
           VALUES ($1, $2, now(), 'APROBADA', (now() + interval '1 year')::date, $3,
                   'Colegio', $4::acceso."Jurisdiccion", $5, 'CONSTANCIA_EMITIDA_POR_EL_COLEGIO',
                   now()::date, 'obj/1', 'sha256:1', $6)`,
          [decisionId, usuarioId, admin, jurisdiccion, matricula, clave],
        );

      await insertar(id('dec'));
      await cliente.query('SAVEPOINT doble');
      await expect(insertar(id('dec'))).rejects.toMatchObject({ code: ERROR.UNICIDAD });
      await cliente.query('ROLLBACK TO SAVEPOINT doble');
    });
  });

  it('todas las tablas del Bloque C llevan clave de idempotencia única (R-002-21)', async () => {
    const { rows } = await cliente.query<{ tabla: string }>(
      `SELECT c.relname AS tabla
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'acceso'
          AND c.relname IN ('DecisionDeVerificacion', 'SuspensionDeMatricula', 'EscalamientoDeVerificacion')
          AND EXISTS (
            SELECT 1 FROM pg_index i
              JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY (i.indkey)
             WHERE i.indrelid = c.oid AND i.indisunique AND a.attname = 'claveIdempotencia'
          )
        ORDER BY 1`,
    );
    expect(rows.map((r) => r.tabla)).toEqual([
      'DecisionDeVerificacion',
      'EscalamientoDeVerificacion',
      'SuspensionDeMatricula',
    ]);
  });
});

describe.skipIf(HAY_BASE)('002 · Verificación profesional y vigencia', () => {
  it.skip(`omitido — ${MOTIVO_OMISION}`, () => {});
});
