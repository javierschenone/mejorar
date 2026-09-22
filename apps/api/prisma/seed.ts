/**
 * Datos de demostración de la feature 002 — `modelo-datos.md` §6.5.
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║  TODO LO DE ACÁ ES GENERADO. NADA ES REAL.                                ║
 * ║  R-05 de la feature 001: en este producto un dato de prueba tomado de un  ║
 * ║  caso real es una fuga con otro nombre.                                   ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 *
 * Por qué esto es un seed y no una migración: una migración se aplica en TODOS
 * los entornos, incluido producción. Cuentas de demostración con contraseña
 * conocida creadas por una migración son una puerta abierta esperando el
 * despliegue distraído. Los catálogos —reglas de retención, parámetros,
 * versiones de documento— sí van en la migración 0023, porque el sistema no
 * funciona sin ellos.
 *
 * ── Cómo se corre ────────────────────────────────────────────────────────────
 *
 *   DATABASE_URL=postgresql://mejorar:mejorar@localhost:5432/mejorar \
 *     pnpm --filter @mejorar/api prisma:seed
 *
 * Es IDEMPOTENTE: correrlo dos veces no duplica nada. Se apoya en
 * identificadores fijos y en `ON CONFLICT DO NOTHING`.
 *
 * ── Las claves ───────────────────────────────────────────────────────────────
 *
 * El seed cifra de verdad, con las tres claves de §4.3, porque si sembrara
 * bytes cualquiera la aplicación no podría descifrar y el entorno de
 * demostración no serviría. Las lee del entorno y **se niega a inventarlas
 * fuera de desarrollo**: una clave por defecto en producción es peor que no
 * tener cifrado, porque parece que lo hay.
 */

import { createCipheriv, createHmac, randomBytes } from 'node:crypto';
import pg from 'pg';

const { Client } = pg;

// ─────────────────────────────────────────────────────────────────────────────
// Claves (§4.3). `k_indice` NO está en la base por diseño: si estuviera, el
// índice ciego sería reversible por diccionario, porque el espacio de correos
// es chico y enumerable.
// ─────────────────────────────────────────────────────────────────────────────

const ES_DESARROLLO = (process.env.NODE_ENV ?? 'development') !== 'production';

function clave(nombre: string): Buffer {
  const valor = process.env[nombre];
  if (valor && valor.length > 0) return Buffer.from(valor, 'base64');
  if (!ES_DESARROLLO) {
    throw new Error(
      `Falta ${nombre}. El seed NO inventa claves de cifrado fuera de desarrollo: ` +
        'una clave por defecto en producción es peor que no tener cifrado, porque parece que lo hay.',
    );
  }
  // Derivada de una constante, para que dos corridas produzcan el mismo índice
  // ciego y el seed sea idempotente. Sólo en desarrollo.
  return createHmac('sha256', 'mejorar-desarrollo-no-usar-jamas').update(nombre).digest();
}

const K_ACCESO = clave('MEJORAR_K_ACCESO');
const K_MFA = clave('MEJORAR_K_MFA');
const K_INDICE = clave('MEJORAR_K_INDICE');

const ID_CLAVE_ACCESO = ES_DESARROLLO ? 'k_acceso:desarrollo' : 'k_acceso:1';
const ID_CLAVE_MFA = ES_DESARROLLO ? 'k_mfa:desarrollo' : 'k_mfa:1';

interface Cifrado {
  cifrado: Buffer;
  nonce: Buffer;
  tag: Buffer;
  idClave: string;
}

/** AES-256-GCM con el identificador de la fila como datos autenticados. */
function cifrar(texto: string, aad: string, k: Buffer, idClave: string): Cifrado {
  const nonce = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', k, nonce);
  c.setAAD(Buffer.from(aad, 'utf8'));
  const cifrado = Buffer.concat([c.update(texto, 'utf8'), c.final()]);
  return { cifrado, nonce, tag: c.getAuthTag(), idClave };
}

const conAcceso = (texto: string, aad: string) => cifrar(texto, aad, K_ACCESO, ID_CLAVE_ACCESO);

/** HMAC-SHA-256 con dominio de separación, igual que el `ServicioDeIndiceCiego`. */
function indiceCiego(dominio: string, valor: string): Buffer {
  return createHmac('sha256', K_INDICE).update(`${dominio}\u0000${valor}`).digest();
}

/** Normalización del correo antes del índice ciego: NFKC + minúsculas. */
const normalizarCorreo = (correo: string) => correo.normalize('NFKC').toLowerCase().trim();
const indiceDeCorreo = (correo: string) => indiceCiego('CORREO', normalizarCorreo(correo));

/**
 * Marcador de contraseña. El seed NO calcula argon2id: `apps/api` todavía no
 * tiene esa dependencia y agregarla acá sería que el `database-engineer`
 * decida una parte de la política de credenciales, que es del `arquitecto` y
 * de `dev-backend`. Se deja un hash con forma PHC válida y valor imposible de
 * acertar: las cuentas de demostración se usan desde el back-office o
 * reseteando la contraseña, no adivinándola.
 */
const HASH_MARCADOR =
  '$argon2id$v=19$m=65536,t=3,p=4$c2VtaWxsYWRlZGVzYXJyb2xsbw$c2luLWNvbnRyYXNlbmEtdXNhYmxl';

// ─────────────────────────────────────────────────────────────────────────────
// Identificadores fijos: son lo que hace idempotente al seed.
// Opacos, sin estructura derivable del dato (R-03, D-002-11): el prefijo dice
// que son de siembra, no quién es la persona.
// ─────────────────────────────────────────────────────────────────────────────

const ID = {
  cliente: '01SEED0000000000000CLIENTE1',
  abogadoVerificado: '01SEED000000000000ABOGADO1',
  abogadoPendiente: '01SEED000000000000ABOGADO2',
  administrador: '01SEED00000000000000ADMIN1',
  sinConfirmar: '01SEED0000000000SINCONFIRM',
} as const;

const DOMINIO = process.env.MEJORAR_DOMINIO_CORREO ?? 'mejorar.example';

const BUZONES_DE_ROL = [
  'admin', 'administrador', 'soporte', 'info', 'contacto', 'noreply',
  'no-reply', 'hola', 'ventas', 'ayuda', 'root', 'postmaster', 'abuse',
];

// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Falta DATABASE_URL.');

  const cliente = new Client({ connectionString: url });
  await cliente.connect();

  try {
    await cliente.query('BEGIN');

    await sembrarBuzonesDeRol(cliente);

    const yaEstaba = await cliente.query(`SELECT 1 FROM acceso."Usuario" WHERE "id" = $1`, [
      ID.cliente,
    ]);
    if (yaEstaba.rowCount === 0) {
      const admin = await sembrarAdministrador(cliente);
      await sembrarCliente(cliente);
      await sembrarAbogadoVerificado(cliente, admin);
      await sembrarAbogadoPendiente(cliente);
      await sembrarCuentaSinConfirmar(cliente);
      console.log('[seed 002] cuentas de demostración creadas.');
    } else {
      console.log('[seed 002] las cuentas de demostración ya estaban: no se duplica nada.');
    }

    await cliente.query('COMMIT');
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw error;
  } finally {
    await cliente.end();
  }
}

/**
 * D.8 — R-002-04. Es lo único de la feature que la migración 0023 NO puede
 * sembrar: la clave primaria es un HMAC con `k_indice`, que vive fuera de la
 * base. Hasta que esto corra, el mecanismo de buzones de rol está inerte.
 */
async function sembrarBuzonesDeRol(c: pg.Client): Promise<void> {
  for (const buzon of BUZONES_DE_ROL) {
    await c.query(
      `INSERT INTO acceso."CorreoDeRolProhibido" ("indiceCiego", "etiqueta")
       VALUES ($1, $2) ON CONFLICT ("indiceCiego") DO NOTHING`,
      [indiceDeCorreo(`${buzon}@${DOMINIO}`), `${buzon}@`],
    );
  }
}

interface DatosDeCuenta {
  id: string;
  correo: string;
  nombre: string;
  rol: 'CLIENTE' | 'ABOGADO' | 'ADMINISTRADOR';
  creadoEn?: string;
}

async function insertarUsuario(c: pg.Client, d: DatosDeCuenta): Promise<void> {
  const correo = conAcceso(d.correo, d.id);
  const nombre = conAcceso(d.nombre, d.id);
  await c.query(
    `INSERT INTO acceso."Usuario"
       ("id", "indiceCiegoCorreo", "correoCifrado", "correoNonce", "correoTag", "correoIdClave",
        "nombreParaMostrarCifrado", "nombreParaMostrarNonce", "nombreParaMostrarTag",
        "nombreParaMostrarIdClave", "hashContrasena", "rol", "estadoCuenta", "creadoEn")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::acceso."Rol",
             'NO_VERIFICADA', COALESCE($13::timestamptz, now()))`,
    [
      d.id,
      indiceDeCorreo(d.correo),
      correo.cifrado, correo.nonce, correo.tag, correo.idClave,
      nombre.cifrado, nombre.nonce, nombre.tag, nombre.idClave,
      HASH_MARCADOR,
      d.rol,
      d.creadoEn ?? null,
    ],
  );
}

/** Las dos aceptaciones que R-002-06 exige para llegar a ACTIVA. */
async function aceptar(c: pg.Client, usuarioId: string, canal: 'WEB' | 'MOVIL'): Promise<void> {
  const version = await versionVigente(c);
  for (const clase of ['TERMINOS_Y_CONDICIONES', 'POLITICA_DE_PRIVACIDAD'] as const) {
    const ip = conAcceso('203.0.113.7', usuarioId); // rango TEST-NET-3, RFC 5737
    await c.query(
      `INSERT INTO acceso."AceptacionRegistrada"
         ("id", "usuarioId", "documentoClase", "documentoVersion", "hashDelTextoMostrado",
          "momento", "ipCifrada", "ipNonce", "ipTag", "ipIdClave", "canal", "casillaMarcada",
          "versionInformacionArt6")
       VALUES ($1, $2, $3::acceso."ClaseDocumentoAceptable", $4, $5, now(), $6, $7, $8, $9,
               $10::acceso."CanalDeAceptacion", 'alta.aceptacion', $11)`,
      [
        `${usuarioId}-acp-${clase}`,
        usuarioId,
        clase,
        version.documento,
        version.hashDocumento[clase],
        ip.cifrado, ip.nonce, ip.tag, ip.idClave,
        canal,
        version.art6,
      ],
    );
  }
}

interface VersionesVigentes {
  documento: string;
  art6: string;
  hashDocumento: Record<string, string>;
}

async function versionVigente(c: pg.Client): Promise<VersionesVigentes> {
  const docs = await c.query<{ clase: string; version: string; hash: string }>(
    `SELECT "clase"::text AS clase, "version", "hashDelTexto" AS hash
       FROM acceso."VersionDocumentoAceptable" WHERE "vigenteHasta" IS NULL`,
  );
  const art6 = await c.query<{ version: string }>(
    `SELECT "version" FROM acceso."VersionInformacionArt6" WHERE "vigenteHasta" IS NULL`,
  );
  if (docs.rowCount !== 2 || art6.rowCount !== 1) {
    throw new Error(
      'No hay una versión vigente de cada documento y del texto del art. 6. ' +
        'Correr la migración 0023 antes del seed: sin eso ninguna cuenta puede quedar ACTIVA (R-002-06).',
    );
  }
  const hashDocumento: Record<string, string> = {};
  for (const d of docs.rows) hashDocumento[d.clase] = d.hash;
  return { documento: docs.rows[0]!.version, art6: art6.rows[0]!.version, hashDocumento };
}

async function activar(c: pg.Client, usuarioId: string, estadoMfa: string): Promise<void> {
  await c.query(
    `UPDATE acceso."Usuario"
        SET "estadoCuenta" = 'ACTIVA', "confirmadoEn" = now(),
            "estadoMfa" = $2::acceso."EstadoMfa", "actualizadoEn" = now()
      WHERE "id" = $1`,
    [usuarioId, estadoMfa],
  );
}

async function evento(
  c: pg.Client,
  accion: string,
  opciones: { sujeto?: string; titular?: string; clasificacion?: string } = {},
): Promise<string> {
  const id = `${opciones.titular ?? opciones.sujeto ?? 'sistema'}-ev-${accion}`;
  await c.query(
    `INSERT INTO auditoria."EventoAuditoria"
       ("id", "accion", "sujeto", "titularAfectado", "clasificacion", "resultado",
        "origenCanal", "idCorrelacion")
     VALUES ($1, $2::auditoria."AccionAuditada", $3, $4, $5::auditoria."ClasificacionDato",
             'EJECUTADO', 'SIEMBRA', $6)`,
    [id, accion, opciones.sujeto ?? null, opciones.titular ?? null,
     opciones.clasificacion ?? 'PERSONAL', `seed-${accion}`],
  );
  return id;
}

async function inscribirTotp(c: pg.Client, usuarioId: string, rol: string): Promise<void> {
  const secreto = cifrar(randomBytes(20).toString('base64'), usuarioId, K_MFA, ID_CLAVE_MFA);
  await c.query(
    `INSERT INTO acceso."SecretoTotp"
       ("usuarioId", "rolDelTitular", "secretoCifrado", "secretoNonce", "secretoTag",
        "secretoIdClave", "estado", "confirmadoEn")
     VALUES ($1, $2::acceso."Rol", $3, $4, $5, $6, 'ACTIVO', now())`,
    [usuarioId, rol, secreto.cifrado, secreto.nonce, secreto.tag, secreto.idClave],
  );
  for (let i = 0; i < 10; i += 1) {
    await c.query(
      `INSERT INTO acceso."CodigoDeRespaldo" ("id", "usuarioId", "loteId", "hashDelCodigo")
       VALUES ($1, $2, $3, $4)`,
      [`${usuarioId}-cod-${i}`, usuarioId, `${usuarioId}-lote-1`,
       createHmac('sha256', K_INDICE).update(`${usuarioId}:respaldo:${i}`).digest()],
    );
  }
}

/**
 * El ADMINISTRADOR. La cuenta de siembra queda `nominalizadaEn` en el propio
 * seed: el estado "siembra viva" no se distribuye (recaudo C-2).
 */
async function sembrarAdministrador(c: pg.Client): Promise<string> {
  const id = ID.administrador;
  await insertarUsuario(c, {
    id, correo: `ana.responsable@${DOMINIO}`, nombre: 'Ana (administración)', rol: 'ADMINISTRADOR',
  });
  await aceptar(c, id, 'WEB');

  const nombreReal = conAcceso('Ana Beatriz Rodríguez (persona de demostración)', id);
  await c.query(
    `INSERT INTO acceso."DesignacionDeAdministrador"
       ("usuarioId", "esAdministrador", "nombreCompletoCifrado", "nombreCompletoNonce",
        "nombreCompletoTag", "nombreCompletoIdClave", "documentoDeDesignacionReferencia",
        "huellaDocumentoDesignacion", "creadoPor", "esSiembra", "nominalizadaEn", "claveIdempotencia")
     VALUES ($1, true, $2, $3, $4, $5,
             'siembra/acta-de-designacion-demostracion.pdf',
             'sha256:0000000000000000000000000000000000000000000000000000000000000000',
             NULL, true, now(), $6)`,
    [id, nombreReal.cifrado, nombreReal.nonce, nombreReal.tag, nombreReal.idClave, `seed-desig-${id}`],
  );
  // CA-34: sin este evento, la transacción del seed NO CIERRA.
  await evento(c, 'ADMINISTRADOR_SEMBRADO', { titular: id });
  await inscribirTotp(c, id, 'ADMINISTRADOR');
  await activar(c, id, 'ACTIVO');
  await evento(c, 'CUENTA_CONFIRMADA', { sujeto: id, titular: id });
  return id;
}

/** El CLIENTE: confirmado, sin MFA (CA-39), con dos sesiones. */
async function sembrarCliente(c: pg.Client): Promise<void> {
  const id = ID.cliente;
  await insertarUsuario(c, { id, correo: `carla.cliente@${DOMINIO}`, nombre: 'Carla', rol: 'CLIENTE' });
  await aceptar(c, id, 'MOVIL');
  await activar(c, id, 'NO_CONFIGURADO');

  // Una sesión abierta y una cerrada, para que CA-13 tenga qué mostrar.
  await c.query(
    `INSERT INTO acceso."Sesion"
       ("id", "usuarioId", "rolDelTitular", "autenticadaEn", "nivelAutenticacion", "ipHash",
        "ubicacionPais", "ubicacionProvincia", "versionBaseGeoIp", "dispositivoClase",
        "dispositivoSistema", "dispositivoNavegador")
     VALUES ($1, $2, 'CLIENTE', now(), 'CONTRASENA', $3, 'AR', 'Santa Fe',
             'geoip-local-2026-09', 'APLICACION_MOVIL', 'Android', NULL)`,
    [`${id}-ses-abierta`, id, indiceCiego('IP', '203.0.113.7')],
  );
  await c.query(
    `INSERT INTO acceso."Sesion"
       ("id", "usuarioId", "rolDelTitular", "creadaEn", "ultimoUso", "autenticadaEn",
        "nivelAutenticacion", "ipHash", "ubicacionPais", "ubicacionProvincia",
        "versionBaseGeoIp", "dispositivoClase", "dispositivoSistema", "dispositivoNavegador",
        "cerradaEn", "motivoCierre")
     VALUES ($1, $2, 'CLIENTE', now() - interval '20 days', now() - interval '19 days',
             now() - interval '20 days', 'CONTRASENA', $3, 'AR', 'Buenos Aires',
             'geoip-local-2026-08', 'ESCRITORIO', 'Windows', 'Firefox',
             now() - interval '19 days', 'CIERRE_DEL_TITULAR')`,
    [`${id}-ses-cerrada`, id, indiceCiego('IP', '198.51.100.22')],
  );

  await evento(c, 'CUENTA_CONFIRMADA', { sujeto: id, titular: id });
  await evento(c, 'INGRESO_EXITOSO', { sujeto: id, titular: id });
}

/** El ABOGADO verificado: evidencia completa, vigencia a 10 meses, MFA activo. */
async function sembrarAbogadoVerificado(c: pg.Client, admin: string): Promise<void> {
  const id = ID.abogadoVerificado;
  await insertarUsuario(c, {
    id, correo: `lucia.abogada@${DOMINIO}`, nombre: 'Lucía', rol: 'ABOGADO',
  });
  await aceptar(c, id, 'WEB');
  await c.query(
    `INSERT INTO acceso."PerfilProfesional"
       ("usuarioId", "rolDelTitular", "matricula", "jurisdiccion", "colegioDeclarado", "solicitadaEn")
     VALUES ($1, 'ABOGADO', 'T 101 F 234', 'CABA', 'Colegio Público de la Capital Federal (demostración)',
             now() - interval '2 months')`,
    [id],
  );
  await c.query(
    `INSERT INTO acceso."EspecialidadDeclarada" ("usuarioId", "especialidad")
     VALUES ($1, 'DEFENSA_DEL_CONSUMIDOR'), ($1, 'EJECUCIONES')`,
    [id],
  );
  await c.query(
    `INSERT INTO acceso."DecisionDeVerificacion"
       ("id", "perfilUsuarioId", "momento", "resultado", "vigenciaHasta", "decididaPor",
        "evidenciaColegio", "evidenciaJurisdiccion", "evidenciaNumeroDeMatricula",
        "evidenciaTomoYFolio", "evidenciaClaseDeConstancia", "evidenciaFechaDeLaConstancia",
        "evidenciaReferenciaDelDocumento", "evidenciaHuellaDocumento", "claveIdempotencia")
     VALUES ($1, $2, now() - interval '2 months', 'APROBADA',
             (now() + interval '10 months')::date, $3,
             'Colegio Público de la Capital Federal (demostración)', 'CABA', '101',
             'T 101 F 234', 'CONSULTA_AL_PADRON_PUBLICO', (now() - interval '2 months')::date,
             'objetos/demo/constancia-matricula.pdf',
             'sha256:1111111111111111111111111111111111111111111111111111111111111111', $4)`,
    [`${id}-dec-1`, id, admin, `seed-dec-${id}`],
  );
  await inscribirTotp(c, id, 'ABOGADO');
  await activar(c, id, 'ACTIVO');
  await evento(c, 'MATRICULA_VERIFICADA', { sujeto: admin, titular: id });
}

/**
 * El segundo ABOGADO: pendiente y con el plazo VENCIDO, para que la cola de
 * CA-31 tenga contenido el primer día. Un tablero vacío no se puede revisar.
 */
async function sembrarAbogadoPendiente(c: pg.Client): Promise<void> {
  const id = ID.abogadoPendiente;
  await insertarUsuario(c, {
    id, correo: `martin.abogado@${DOMINIO}`, nombre: 'Martín', rol: 'ABOGADO',
  });
  await aceptar(c, id, 'WEB');
  await c.query(
    `INSERT INTO acceso."PerfilProfesional"
       ("usuarioId", "rolDelTitular", "matricula", "jurisdiccion", "colegioDeclarado", "solicitadaEn")
     VALUES ($1, 'ABOGADO', 'T 55 F 12', 'CORDOBA', 'Colegio de Abogados de Córdoba (demostración)',
             now() - interval '21 days')`,
    [id],
  );
  await inscribirTotp(c, id, 'ABOGADO');
  // Queda PENDIENTE_DE_INSCRIPCION_MFA hasta que verifiquen la matrícula: el
  // estado de la verificación NO se guarda, se deriva de la ausencia de
  // decisiones (D-2).
  await c.query(
    `UPDATE acceso."Usuario"
        SET "estadoCuenta" = 'PENDIENTE_DE_INSCRIPCION_MFA', "confirmadoEn" = now() - interval '20 days',
            "estadoMfa" = 'ACTIVO'
      WHERE "id" = $1`,
    [id],
  );
  await c.query(
    `INSERT INTO acceso."EscalamientoDeVerificacion"
       ("id", "perfilUsuarioId", "generadoEn", "diasHabilesTranscurridos", "claveIdempotencia")
     VALUES ($1, $2, now() - interval '13 days', 7, $3)`,
    [`${id}-esc-1`, id, `seed-esc-${id}`],
  );
  await evento(c, 'CUENTA_CREADA', { titular: id });
}

/**
 * Una cuenta NO_VERIFICADA con fecha vieja, para que la purga de CA-28 tenga
 * qué purgar en la primera corrida y el mecanismo sea observable.
 */
async function sembrarCuentaSinConfirmar(c: pg.Client): Promise<void> {
  const id = ID.sinConfirmar;
  await insertarUsuario(c, {
    id, correo: `nunca.confirmo@${DOMINIO}`, nombre: 'Alta sin confirmar',
    rol: 'CLIENTE', creadoEn: new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString(),
  });
  await evento(c, 'CUENTA_CREADA', { titular: id });
}

main().catch((error: unknown) => {
  console.error('[seed 002] falló:', error);
  process.exitCode = 1;
});
