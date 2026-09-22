/**
 * Feature 002, Bloques B, D y H: aceptación versionada, canje atómico de
 * secretos y retención.
 *
 * Las dos condiciones que el dictamen §9 marca como "lo único verdaderamente
 * urgente, en el sentido de que no se puede reparar después" son C-002-01 y
 * C-002-02, y viven en el Bloque B. Las tres primeras secciones de este archivo
 * son eso.
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
  crearCuentaActiva,
  crearEnvio,
  crearUsuario,
  id,
  registrarAceptaciones,
  registrarEvento,
  VERSION_CATALOGO,
} from './ayuda/datos-acceso.js';

const CERRAR = 'SET CONSTRAINTS ALL IMMEDIATE';

describe.skipIf(!HAY_BASE)('002 · Aceptación, secretos y retención', () => {
  let base: BaseDePrueba;
  let cliente: Client;

  beforeAll(async () => {
    base = await crearBaseConMigraciones('a002ret');
    cliente = base.cliente;
  });

  afterAll(async () => {
    await base?.destruir();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // R-002-06 — CA-27, C-002-02
  // ───────────────────────────────────────────────────────────────────────────

  it('R-002-06 · no existe NINGUNA columna booleana de aceptación en todo el esquema', async () => {
    // Es la verificación que el dictamen pide literalmente para C-002-02: la
    // aceptación sin versión, hash, fecha e IP no es representable, y la forma
    // de que siga siéndolo es que nadie agregue `aceptoTerminos: boolean`.
    const { rows } = await cliente.query<{ f: string }>(
      `SELECT table_schema || '.' || table_name || '.' || column_name AS f
         FROM information_schema.columns
        WHERE table_schema IN ('acceso', 'auditoria')
          AND data_type = 'boolean'
          AND (column_name ILIKE 'acepto%' OR column_name ILIKE 'acepta%'
            OR column_name ILIKE 'consentimiento%' OR column_name ILIKE '%terminos%'
            OR column_name ILIKE '%consiente%')
        ORDER BY 1`,
    );
    expect(rows.map((r) => r.f)).toEqual([]);
  });

  it('R-002-06 · una cuenta no llega a ACTIVA sin aceptación de CADA clase de documento', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const usuarioId = await crearUsuario(cliente);
      await cliente.query(
        `UPDATE acceso."Usuario" SET "estadoCuenta" = 'ACTIVA', "confirmadoEn" = now() WHERE "id" = $1`,
        [usuarioId],
      );
      const rechazo = await debeRechazar(cliente, CERRAR);
      expect(rechazo.mensaje).toContain('R-002-06 (CA-27)');
      expect(rechazo.mensaje).toContain('POLITICA_DE_PRIVACIDAD');
      expect(rechazo.mensaje).toContain('TERMINOS_Y_CONDICIONES');
    });
  });

  it('R-002-06 · con una sola de las dos clases, tampoco', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const usuarioId = await crearUsuario(cliente);
      await cliente.query(
        `INSERT INTO acceso."AceptacionRegistrada"
           ("id", "usuarioId", "documentoClase", "documentoVersion", "hashDelTextoMostrado",
            "momento", "ipCifrada", "ipNonce", "ipTag", "ipIdClave", "canal", "casillaMarcada",
            "versionInformacionArt6")
         VALUES ($1, $2, 'TERMINOS_Y_CONDICIONES', $3, 'sha256:x', now(), $4, $5, $6,
                 'k_acceso:1', 'WEB', 'casilla', $3)`,
        [id('acp'), usuarioId, VERSION_CATALOGO, bytes(16), bytes(12), bytes(16)],
      );
      await cliente.query(
        `UPDATE acceso."Usuario" SET "estadoCuenta" = 'ACTIVA' WHERE "id" = $1`,
        [usuarioId],
      );
      const rechazo = await debeRechazar(cliente, CERRAR);
      expect(rechazo.mensaje).toContain('POLITICA_DE_PRIVACIDAD');
    });
  });

  it('R-002-06 · una aceptación revocada no alcanza para mantener la cuenta ACTIVA', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const usuarioId = await crearUsuario(cliente);
      await registrarAceptaciones(cliente, usuarioId);
      await cliente.query(
        `UPDATE acceso."AceptacionRegistrada" SET "revocadaEn" = now()
          WHERE "usuarioId" = $1 AND "documentoClase" = 'POLITICA_DE_PRIVACIDAD'`,
        [usuarioId],
      );
      await cliente.query(
        `UPDATE acceso."Usuario" SET "estadoCuenta" = 'ACTIVA' WHERE "id" = $1`,
        [usuarioId],
      );
      const rechazo = await debeRechazar(cliente, CERRAR);
      expect(rechazo.mensaje).toContain('POLITICA_DE_PRIVACIDAD');
    });
  });

  it('R-002-06 · con las dos aceptaciones vigentes, la cuenta cierra en ACTIVA', async () => {
    await enTransaccionRevertida(cliente, async () => {
      await crearCuentaActiva(cliente);
      await debeAceptar(cliente, CERRAR);
    });
  });

  it('B.4 · no se puede aceptar una versión de documento que no existe', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const usuarioId = await crearUsuario(cliente);
      const rechazo = await debeRechazar(
        cliente,
        `INSERT INTO acceso."AceptacionRegistrada"
           ("id", "usuarioId", "documentoClase", "documentoVersion", "hashDelTextoMostrado",
            "momento", "ipCifrada", "ipNonce", "ipTag", "ipIdClave", "canal", "casillaMarcada",
            "versionInformacionArt6")
         VALUES ($1, $2, 'TERMINOS_Y_CONDICIONES', 'version-inventada', 'sha256:x', now(),
                 $3, $4, $5, 'k_acceso:1', 'WEB', 'casilla', $6)`,
        [id('acp'), usuarioId, bytes(16), bytes(12), bytes(16), VERSION_CATALOGO],
      );
      expect(rechazo.codigo).toBe(ERROR.CLAVE_FORANEA);
      expect(rechazo.restriccion).toBe('fk_aceptacion_documento');
    });
  });

  it('B.4 · la IP de la aceptación va cifrada y es obligatoria: es prueba de firma electrónica', async () => {
    const { rows } = await cliente.query<{ columna: string; tipo: string; nulo: string }>(
      `SELECT column_name AS columna, data_type AS tipo, is_nullable AS nulo
         FROM information_schema.columns
        WHERE table_schema = 'acceso' AND table_name = 'AceptacionRegistrada'
          AND column_name IN ('ipCifrada', 'ipNonce', 'ipTag')
        ORDER BY 1`,
    );
    expect(rows).toEqual([
      { columna: 'ipCifrada', tipo: 'bytea', nulo: 'NO' },
      { columna: 'ipNonce', tipo: 'bytea', nulo: 'NO' },
      { columna: 'ipTag', tipo: 'bytea', nulo: 'NO' },
    ]);
    // Y no existe una columna `ipHash` acá: en la bitácora la IP se hashea
    // porque sirve para correlacionar; acá se cifra porque hay que poder
    // exhibirla (Ley 25.506, la carga de acreditarla es nuestra).
    const { rows: hash } = await cliente.query(
      `SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'acceso' AND table_name = 'AceptacionRegistrada' AND column_name = 'ipHash'`,
    );
    expect(hash).toEqual([]);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // R-002-07 — C-002-02
  // ───────────────────────────────────────────────────────────────────────────

  it('R-002-07 · una versión de términos con finalidades de la 003 no se puede insertar', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const rechazo = await debeRechazar(
        cliente,
        `INSERT INTO acceso."VersionDocumentoAceptable"
           ("clase", "version", "hashDelTexto", "referenciaDelTexto", "vigenteDesde", "incluyeFinalidadesDeLa003")
         VALUES ('TERMINOS_Y_CONDICIONES', 'v-con-bureaus', 'sha256:x', 'ref', now(), true)`,
      );
      expect(rechazo.restriccion).toBe('ck_documento_sin_finalidades_003');
    });
  });

  it('R-002-07 · la columna existe para no poder ser verdadera, y está sembrada en false', async () => {
    const { rows } = await cliente.query<{ clase: string; incluye: boolean }>(
      `SELECT "clase"::text AS clase, "incluyeFinalidadesDeLa003" AS incluye
         FROM acceso."VersionDocumentoAceptable" ORDER BY 1`,
    );
    expect(rows).toEqual([
      { clase: 'POLITICA_DE_PRIVACIDAD', incluye: false },
      { clase: 'TERMINOS_Y_CONDICIONES', incluye: false },
    ]);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // C-002-01 — art. 6 inc. c)
  // ───────────────────────────────────────────────────────────────────────────

  it('C-002-01 · una versión del art. 6 no queda vigente sin declarar cada campo del alta', async () => {
    await enTransaccionRevertida(cliente, async () => {
      // Publicar una versión nueva exige cerrar la anterior: `uq_art6_vigente`
      // deja a lo sumo una vigente, y cerrar la vieja es el único `UPDATE` que
      // B.2 admite (ver la nota de divergencia de la migración 0021).
      await cliente.query(
        `UPDATE acceso."VersionInformacionArt6" SET "vigenteHasta" = now() WHERE "version" = $1`,
        [VERSION_CATALOGO],
      );
      await cliente.query(
        `INSERT INTO acceso."VersionInformacionArt6"
           ("version", "hashDelTexto", "responsableRazonSocial", "responsableDomicilio",
            "destinatarios", "canalDeEjercicioDeDerechos", "vigenteDesde")
         VALUES ('v-incompleta', 'sha256:x', 'Razon', 'Domicilio', ARRAY['ninguno'], 'canal', now())`,
      );
      const rechazo = await debeRechazar(cliente, CERRAR);
      expect(rechazo.mensaje).toContain('art. 6 inc. c');
      expect(rechazo.mensaje).toContain('CORREO');
    });
  });

  it('B.2 · el contenido del art. 6 es inmutable; lo único que se puede cerrar es su vigencia', async () => {
    await enTransaccionRevertida(cliente, async () => {
      // Cerrar la ventana: permitido, es cómo se publica la versión siguiente.
      await debeAceptar(
        cliente,
        `UPDATE acceso."VersionInformacionArt6" SET "vigenteHasta" = now() WHERE "version" = $1`,
        [VERSION_CATALOGO],
      );
      // Reescribir lo que se le mostró a la gente: nunca.
      const rechazo = await debeRechazar(
        cliente,
        `UPDATE acceso."VersionInformacionArt6" SET "responsableRazonSocial" = 'Otra SA' WHERE "version" = $1`,
        [VERSION_CATALOGO],
      );
      expect(rechazo.codigo).toBe(ERROR.RESTRICT);
      const borrado = await debeRechazar(
        cliente,
        `DELETE FROM acceso."VersionInformacionArt6" WHERE "version" = $1`,
        [VERSION_CATALOGO],
      );
      expect(borrado.codigo).toBe(ERROR.RESTRICT);
    });
  });

  it('B.1 · a lo sumo una versión vigente por clase de documento', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const rechazo = await debeRechazar(
        cliente,
        `INSERT INTO acceso."VersionDocumentoAceptable"
           ("clase", "version", "hashDelTexto", "referenciaDelTexto", "vigenteDesde")
         VALUES ('TERMINOS_Y_CONDICIONES', 'v2', 'sha256:y', 'ref', now())`,
      );
      expect(rechazo.restriccion).toBe('uq_documento_vigente');

      // Cerrando la anterior, sí.
      await cliente.query(
        `UPDATE acceso."VersionDocumentoAceptable" SET "vigenteHasta" = now()
          WHERE "clase" = 'TERMINOS_Y_CONDICIONES' AND "version" = $1`,
        [VERSION_CATALOGO],
      );
      await debeAceptar(
        cliente,
        `INSERT INTO acceso."VersionDocumentoAceptable"
           ("clase", "version", "hashDelTexto", "referenciaDelTexto", "vigenteDesde")
         VALUES ('TERMINOS_Y_CONDICIONES', 'v2', 'sha256:y', 'ref', now())`,
      );
    });
  });

  it('C-002-01 · `CUIT_CUIL` NO se exige hoy, y ése es el enganche formal de E-002-1', async () => {
    // La tabla A.2 no existe: su migración está en `migraciones-en-espera`. El
    // día que alguien la ejecute sin declarar la finalidad del dato, la próxima
    // versión del art. 6 deja de poder quedar vigente. El enganche es
    // estructural, no un recordatorio.
    const { rows } = await cliente.query<{ campo: string }>(
      `SELECT "campo"::text AS campo FROM acceso."CampoDeclaradoEnElAlta"
        WHERE "version" = $1 ORDER BY 1`,
      [VERSION_CATALOGO],
    );
    expect(rows.map((r) => r.campo)).toEqual([
      'CONTRASENA', 'CORREO', 'JURISDICCION', 'MATRICULA', 'NOMBRE_PARA_MOSTRAR',
    ]);
    expect(rows.map((r) => r.campo)).not.toContain('CUIT_CUIL');
  });

  it('C-002-01 · cada campo declarado dice su carácter, su finalidad y la consecuencia de no darlo', async () => {
    const { rows } = await cliente.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM acceso."CampoDeclaradoEnElAlta"
        WHERE "caracter" IS NULL OR length(btrim("claveDeFinalidad")) = 0
           OR length(btrim("consecuenciaDeNoDarlo")) = 0`,
    );
    expect(rows[0]!.n).toBe('0');
  });

  it('C-002-11 · la versión sembrada se declara BORRADOR: no hay responsable determinado todavía', async () => {
    // El art. 6 inc. b) exige identidad y domicilio del responsable. No están
    // determinados (condición C-002-11, inscripción ante la AAIP pendiente).
    // Inventar una razón social sería peor que dejar el hueco visible: este
    // texto es prueba de haber informado.
    const { rows } = await cliente.query<{ razon: string; version: string }>(
      `SELECT "responsableRazonSocial" AS razon, "version" FROM acceso."VersionInformacionArt6"`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.version).toBe('0-desarrollo');
    expect(rows[0]!.razon).toContain('SIN DETERMINAR');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // R-002-13 y R-002-14 — el canje atómico
  // ───────────────────────────────────────────────────────────────────────────

  it('R-002-13 · dos canjes concurrentes del mismo refresco: sólo uno devuelve fila', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const usuarioId = await crearCuentaActiva(cliente);
      const sesionId = await abrirSesion(cliente, usuarioId, 'CLIENTE', 'CONTRASENA');
      const familiaId = id('fam');
      await cliente.query(
        `INSERT INTO acceso."FamiliaDeRefresco" ("id", "sesionId", "usuarioId") VALUES ($1, $2, $3)`,
        [familiaId, sesionId, usuarioId],
      );
      const secreto = bytes();
      await cliente.query(
        `INSERT INTO acceso."TokenDeRefresco" ("id", "familiaId", "generacion", "hashDelSecreto", "venceEn")
         VALUES ($1, $2, 0, $3, now() + interval '30 days')`,
        [id('tok'), familiaId, secreto],
      );

      const canjear = () =>
        cliente.query(
          `UPDATE acceso."TokenDeRefresco" SET "usadoEn" = now()
            WHERE "familiaId" = $1 AND "hashDelSecreto" = $2
              AND "usadoEn" IS NULL AND "revocadoEn" IS NULL
            RETURNING "id"`,
          [familiaId, secreto],
        );

      const primero = await canjear();
      expect(primero.rowCount).toBe(1);
      // Cero filas y la fila existe: ES REUTILIZACIÓN. Que sea una
      // comparación-e-intercambio del motor y no un SELECT seguido de un
      // UPDATE es la diferencia entre CA-11 cumplido y una carrera explotable.
      const segundo = await canjear();
      expect(segundo.rowCount).toBe(0);
    });
  });

  it('R-002-13 · no hay dos tokens en la misma generación de una familia', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const usuarioId = await crearCuentaActiva(cliente);
      const sesionId = await abrirSesion(cliente, usuarioId, 'CLIENTE', 'CONTRASENA');
      const familiaId = id('fam');
      await cliente.query(
        `INSERT INTO acceso."FamiliaDeRefresco" ("id", "sesionId", "usuarioId") VALUES ($1, $2, $3)`,
        [familiaId, sesionId, usuarioId],
      );
      await cliente.query(
        `INSERT INTO acceso."TokenDeRefresco" ("id", "familiaId", "generacion", "hashDelSecreto", "venceEn")
         VALUES ($1, $2, 0, $3, now() + interval '30 days')`,
        [id('tok'), familiaId, bytes()],
      );
      const rechazo = await debeRechazar(
        cliente,
        `INSERT INTO acceso."TokenDeRefresco" ("id", "familiaId", "generacion", "hashDelSecreto", "venceEn")
         VALUES ($1, $2, 0, $3, now() + interval '30 days')`,
        [id('tok'), familiaId, bytes()],
      );
      expect(rechazo.restriccion).toBe('uq_refresco_familia_generacion');
    });
  });

  it('R-002-13 · no hay sucesor sin uso', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const usuarioId = await crearCuentaActiva(cliente);
      const sesionId = await abrirSesion(cliente, usuarioId, 'CLIENTE', 'CONTRASENA');
      const familiaId = id('fam');
      await cliente.query(
        `INSERT INTO acceso."FamiliaDeRefresco" ("id", "sesionId", "usuarioId") VALUES ($1, $2, $3)`,
        [familiaId, sesionId, usuarioId],
      );
      const viejo = id('tok');
      const nuevo = id('tok');
      await cliente.query(
        `INSERT INTO acceso."TokenDeRefresco" ("id", "familiaId", "generacion", "hashDelSecreto", "venceEn")
         VALUES ($1, $3, 0, $4, now() + interval '30 days'),
                ($2, $3, 1, $5, now() + interval '30 days')`,
        [viejo, nuevo, familiaId, bytes(), bytes()],
      );
      const rechazo = await debeRechazar(
        cliente,
        `UPDATE acceso."TokenDeRefresco" SET "sucesorId" = $2 WHERE "id" = $1`,
        [viejo, nuevo],
      );
      expect(rechazo.restriccion).toBe('ck_refresco_sucesor_exige_uso');
    });
  });

  it('D.2 · invalidar la familia revoca todos sus tokens vivos (CA-11)', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const usuarioId = await crearCuentaActiva(cliente);
      const sesionId = await abrirSesion(cliente, usuarioId, 'CLIENTE', 'CONTRASENA');
      const familiaId = id('fam');
      await cliente.query(
        `INSERT INTO acceso."FamiliaDeRefresco" ("id", "sesionId", "usuarioId") VALUES ($1, $2, $3)`,
        [familiaId, sesionId, usuarioId],
      );
      await cliente.query(
        `INSERT INTO acceso."TokenDeRefresco" ("id", "familiaId", "generacion", "hashDelSecreto", "venceEn")
         VALUES ($1, $3, 0, $4, now() + interval '30 days'),
                ($2, $3, 1, $5, now() + interval '30 days')`,
        [id('tok'), id('tok'), familiaId, bytes(), bytes()],
      );
      await cliente.query(
        `UPDATE acceso."FamiliaDeRefresco"
            SET "invalidadaEn" = now(), "motivoInvalidacion" = 'REUTILIZACION_DETECTADA'
          WHERE "id" = $1`,
        [familiaId],
      );
      const { rows } = await cliente.query<{ vivos: string }>(
        `SELECT count(*)::text AS vivos FROM acceso."TokenDeRefresco"
          WHERE "familiaId" = $1 AND "revocadoEn" IS NULL`,
        [familiaId],
      );
      expect(rows[0]!.vivos).toBe('0');
    });
  });

  it('R-002-14 · un enlace de un solo uso no se canjea dos veces', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const usuarioId = await crearCuentaActiva(cliente);
      const envioId = await crearEnvio(cliente, 'RECUPERACION_DE_CONTRASENA', usuarioId);
      const secreto = bytes();
      await cliente.query(
        `INSERT INTO acceso."EnlaceDeUnSoloUso"
           ("id", "usuarioId", "proposito", "hashDelSecreto", "venceEn", "envioId", "claveIdempotencia")
         VALUES ($1, $2, 'RECUPERACION_DE_CONTRASENA', $3, now() + interval '1 hour', $4, $5)`,
        [id('enl'), usuarioId, secreto, envioId, id('idem')],
      );

      const canjear = () =>
        cliente.query(
          `UPDATE acceso."EnlaceDeUnSoloUso" SET "usadoEn" = now()
            WHERE "hashDelSecreto" = $1 AND "usadoEn" IS NULL AND "invalidadoEn" IS NULL
            RETURNING "id"`,
          [secreto],
        );
      expect((await canjear()).rowCount).toBe(1);
      expect((await canjear()).rowCount).toBe(0);
    });
  });

  it('D.9 · la PK del envío ES la clave de idempotencia: el mismo aviso no sale dos veces', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const usuarioId = await crearCuentaActiva(cliente);
      const clave = `env_${id('x')}`;
      await debeAceptar(
        cliente,
        `INSERT INTO acceso."EnvioTransaccional" ("claveDeIdempotencia", "plantilla", "usuarioId", "modo")
         VALUES ($1, 'CUENTA_BLOQUEADA_TEMPORALMENTE', $2, 'MOCK')`,
        [clave, usuarioId],
      );
      const rechazo = await debeRechazar(
        cliente,
        `INSERT INTO acceso."EnvioTransaccional" ("claveDeIdempotencia", "plantilla", "usuarioId", "modo")
         VALUES ($1, 'CUENTA_BLOQUEADA_TEMPORALMENTE', $2, 'MOCK')`,
        [clave, usuarioId],
      );
      expect(rechazo.codigo).toBe(ERROR.UNICIDAD);
    });
  });

  it('D.9 · un envío en modo MOCK no puede traer identificador de proveedor', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const rechazo = await debeRechazar(
        cliente,
        `INSERT INTO acceso."EnvioTransaccional"
           ("claveDeIdempotencia", "plantilla", "modo", "idDelProveedor")
         VALUES ($1, 'CONFIRMACION_DE_CORREO', 'MOCK', 'sg-123')`,
        [id('env')],
      );
      expect(rechazo.restriccion).toBe('ck_envio_proveedor_coherente');
    });
  });

  it('D.9 · no guarda la dirección de destino: no hay columna de correo en el registro de envíos', async () => {
    const { rows } = await cliente.query<{ columna: string }>(
      `SELECT column_name AS columna FROM information_schema.columns
        WHERE table_schema = 'acceso' AND table_name = 'EnvioTransaccional'
          AND (column_name ILIKE '%correo%' OR column_name ILIKE '%destinatario%'
            OR column_name ILIKE '%email%' OR column_name ILIKE '%direccion%')`,
    );
    expect(rows.map((r) => r.columna)).toEqual([]);
  });

  it('D.5 · un intento contra una cuenta inexistente no puede apuntar a una cuenta', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const usuarioId = await crearCuentaActiva(cliente);
      const rechazo = await debeRechazar(
        cliente,
        `INSERT INTO acceso."IntentoDeAutenticacion" ("claveDeTrafico", "resultado", "usuarioId")
         VALUES ($1, 'CUENTA_INEXISTENTE', $2)`,
        [bytes(), usuarioId],
      );
      expect(rechazo.restriccion).toBe('ck_intento_inexistente_sin_usuario');
    });
  });

  it('D.5 · un intento contra una clave de tráfico que no existe SÍ se registra (no hay oráculo)', async () => {
    await enTransaccionRevertida(cliente, async () => {
      await debeAceptar(
        cliente,
        `INSERT INTO acceso."IntentoDeAutenticacion" ("claveDeTrafico", "resultado", "ipHash")
         VALUES ($1, 'CUENTA_INEXISTENTE', $2)`,
        [bytes(), bytes()],
      );
    });
  });

  it('D.4 · el desafío señuelo, sin cuenta detrás, es representable a propósito', async () => {
    await enTransaccionRevertida(cliente, async () => {
      await debeAceptar(
        cliente,
        `INSERT INTO acceso."DesafioDeIngreso"
           ("id", "usuarioId", "claveDeTrafico", "siguientePaso", "metodosAdmitidos", "venceEn")
         VALUES ($1, NULL, $2, 'SEGUNDO_FACTOR', ARRAY['TOTP'], now() + interval '15 minutes')`,
        [id('des'), bytes()],
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // R-002-15 — C-002-03
  // ───────────────────────────────────────────────────────────────────────────

  it('§5.1 · las trece claves de retención están sembradas, y cuatro siguen en A_DETERMINAR', async () => {
    const { rows } = await cliente.query<{ clave: string; accion: string }>(
      `SELECT "clave"::text AS clave, "accion"::text AS accion
         FROM acceso."ReglaDeRetencion" WHERE "accion" = 'A_DETERMINAR' ORDER BY 1`,
    );
    expect(rows.map((r) => r.clave)).toEqual([
      'aceptacion', 'bitacoraAuditoria', 'cuentaDadaDeBaja',
      'documentacionRestitucionMfa', 'verificacionProfesional',
    ]);
    const { rows: total } = await cliente.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM acceso."ReglaDeRetencion"`,
    );
    expect(total[0]!.n).toBe('13');
  });

  it('§5.1 · ninguna regla con fundamento normativo sale ya validada', async () => {
    const { rows } = await cliente.query<{ clave: string }>(
      `SELECT "clave"::text AS clave FROM acceso."ReglaDeRetencion" WHERE "validadoPor" IS NOT NULL`,
    );
    expect(rows.map((r) => r.clave)).toEqual([]);
  });

  it('R-002-15 · no se puede registrar una purga bajo una regla A_DETERMINAR', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const rechazo = await debeRechazar(
        cliente,
        `INSERT INTO acceso."EjecucionDePurga"
           ("id", "clave", "accionDeLaRegla", "registrosAlcanzados", "eventoId", "claveIdempotencia")
         VALUES ($1, 'bitacoraAuditoria', 'A_DETERMINAR', 10, 'evt-1', $2)`,
        [id('pur'), id('idem')],
      );
      expect(rechazo.restriccion).toBe('ck_purga_accion_determinada');
    });
  });

  it('R-002-15 · ni mintiendo la acción: la clave foránea compuesta la verifica contra la regla', async () => {
    await enTransaccionRevertida(cliente, async () => {
      // `bitacoraAuditoria` está en A_DETERMINAR; declarar PURGA_FISICA pasa el
      // `CHECK` pero no encuentra la fila `(clave, accion)` en H.1.
      const rechazo = await debeRechazar(
        cliente,
        `INSERT INTO acceso."EjecucionDePurga"
           ("id", "clave", "accionDeLaRegla", "registrosAlcanzados", "eventoId", "claveIdempotencia")
         VALUES ($1, 'bitacoraAuditoria', 'PURGA_FISICA', 10, 'evt-1', $2)`,
        [id('pur'), id('idem')],
      );
      expect(rechazo.codigo).toBe(ERROR.CLAVE_FORANEA);
      expect(rechazo.restriccion).toBe('fk_purga_regla');
    });
  });

  it('R-002-15 · una purga bajo una regla determinada sí deja constancia (CA-28)', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const eventoId = await registrarEvento(cliente, { accion: 'CUENTA_PURGADA' });
      await debeAceptar(
        cliente,
        `INSERT INTO acceso."EjecucionDePurga"
           ("id", "clave", "accionDeLaRegla", "registrosAlcanzados", "eventoId", "claveIdempotencia")
         VALUES ($1, 'cuentaNoVerificada', 'PURGA_FISICA', 7, $2, $3)`,
        [id('pur'), eventoId, id('idem')],
      );
    });
  });

  it('H.1 · "no sé cuánto" no se disfraza de cero ni de un plazo con la acción sin determinar', async () => {
    await enTransaccionRevertida(cliente, async () => {
      // Ni cero…
      const cero = await debeRechazar(
        cliente,
        `UPDATE acceso."ReglaDeRetencion" SET "plazoSegundos" = 0 WHERE "clave" = 'bitacoraAuditoria'`,
      );
      expect(cero.restriccion).toBe('ck_retencion_plazo_positivo');
      // …ni un plazo puesto a mano dejando la acción en A_DETERMINAR.
      const plazo = await debeRechazar(
        cliente,
        `UPDATE acceso."ReglaDeRetencion" SET "plazoSegundos" = 86400 WHERE "clave" = 'bitacoraAuditoria'`,
      );
      expect(plazo.restriccion).toBe('ck_retencion_plazo_si_determinada');
      // Determinar la regla es cambiar las dos columnas a la vez, que es
      // justamente el acto que el estudio tiene que firmar.
      await debeAceptar(
        cliente,
        `UPDATE acceso."ReglaDeRetencion"
            SET "plazoSegundos" = 157680000, "accion" = 'PURGA_FISICA',
                "validadoPor" = 'Estudio X', "validadoEn" = now()::date
          WHERE "clave" = 'bitacoraAuditoria'`,
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // H.3 — constitución #11
  // ───────────────────────────────────────────────────────────────────────────

  it('H.3 · los umbrales de CA-37 están en la base, no en el código', async () => {
    const { rows } = await cliente.query<{ clave: string; valor: string; unidad: string }>(
      `SELECT "clave", "valor"::text AS valor, "unidad"
         FROM acceso."ParametroDeAcceso"
        WHERE "clave" LIKE 'ingreso.%' ORDER BY 1`,
    );
    expect(rows).toEqual([
      { clave: 'ingreso.duracionDelBloqueoSegundos', valor: '900', unidad: 'segundos' },
      { clave: 'ingreso.intentosMaximos', valor: '5', unidad: 'intentos' },
      { clave: 'ingreso.ventanaDeConteoSegundos', valor: '900', unidad: 'segundos' },
    ]);
  });

  it('H.3 · ningún parámetro de la 002 es normativo, y eso es deliberado', async () => {
    // Acoplar el inicio de sesión al catálogo normativo del motor significaría
    // que un problema en el catálogo legal impide entrar al sistema.
    const { rows } = await cliente.query<{ clave: string }>(
      `SELECT "clave" FROM acceso."ParametroDeAcceso" WHERE "esNormativo"`,
    );
    expect(rows.map((r) => r.clave)).toEqual([]);
  });

  it('H.3 · el valor de un parámetro es escalar: no es configuración estructurada disfrazada', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const rechazo = await debeRechazar(
        cliente,
        `INSERT INTO acceso."ParametroDeAcceso" ("clave", "valor") VALUES ('x.y', '{"a":1}')`,
      );
      expect(rechazo.restriccion).toBe('ck_parametro_valor_escalar');
    });
  });

  it('CA-31 · el plazo de escalamiento sigue la spec v4 (7 días corridos) y declara la divergencia', async () => {
    const { rows } = await cliente.query<{ valor: string; unidad: string; nota: string }>(
      `SELECT "valor"::text AS valor, "unidad", "notaDeAlcance" AS nota
         FROM acceso."ParametroDeAcceso" WHERE "clave" = 'matricula.plazoMaximoRevisionDiasCorridos'`,
    );
    expect(rows[0]!.valor).toBe('7');
    expect(rows[0]!.unidad).toBe('dias corridos');
    // La divergencia con `modelo-datos.md` (5 días hábiles, escrito contra la
    // spec v3) queda escrita EN EL DATO, no sólo en un documento.
    expect(rows[0]!.nota).toContain('DIVERGENCIA DECLARADA');
  });

  it('§7.5 · no hay un solo importe en toda la feature: ninguna columna numérica de dinero', async () => {
    // Se verifica la ausencia a propósito, para que sea una decisión
    // comprobada y no un olvido. Cuando aparezca el primer peso, será
    // `Decimal(18,2)` con su moneda, y este test hay que cambiarlo a mano.
    const { rows } = await cliente.query<{ f: string }>(
      `SELECT table_name || '.' || column_name AS f FROM information_schema.columns
        WHERE table_schema IN ('acceso', 'auditoria')
          AND (data_type IN ('numeric', 'money', 'double precision', 'real')
            OR column_name ILIKE '%monto%' OR column_name ILIKE '%importe%'
            OR column_name ILIKE '%saldo%' OR column_name ILIKE '%moneda%')
        ORDER BY 1`,
    );
    expect(rows.map((r) => r.f)).toEqual([]);
  });
});

describe.skipIf(HAY_BASE)('002 · Aceptación, secretos y retención', () => {
  it.skip(`omitido — ${MOTIVO_OMISION}`, () => {});
});
