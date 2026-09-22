/**
 * Constructores de filas de la feature 002 para los tests de esquema.
 *
 * Todos los valores son **generados, nunca reales** (R-05 de la 001). Los
 * "cifrados" son bytes aleatorios: acá no se prueba la criptografía —eso es de
 * `dev-backend` con `k_acceso` y `k_mfa`— sino que el esquema impida los
 * estados que `modelo-datos.md` §7.1 declara imposibles.
 *
 * Los constructores que crean una cuenta **operativa** hacen todo lo que el
 * modelo exige para que la transacción cierre: aceptaciones de las dos clases
 * de documento para llegar a `ACTIVA` (R-002-06), y designación más evento de
 * auditoría para un `ADMINISTRADOR` (R-002-03). Que ese trabajo sea inevitable
 * es el punto, no una molestia del andamiaje.
 */

import { randomBytes, randomUUID } from 'node:crypto';
import type { Client } from 'pg';

/** La versión de catálogo que siembra la migración 0023. */
export const VERSION_CATALOGO = '0-desarrollo';

export type Rol = 'CLIENTE' | 'ABOGADO' | 'ADMINISTRADOR';

export function bytes(n = 32): Buffer {
  return randomBytes(n);
}

export function id(prefijo: string): string {
  return `${prefijo}_${randomUUID()}`;
}

export interface OpcionesDeUsuario {
  id?: string;
  rol?: Rol;
  estadoCuenta?: string;
  estadoMfa?: string;
  indiceCiegoCorreo?: Buffer | null;
  confirmadoEn?: string | null;
  creadoEn?: string;
}

/**
 * Inserta una fila de `acceso.Usuario` cruda, sin nada alrededor. Sirve para
 * probar los `CHECK` de A.1 en aislamiento; para una cuenta que de verdad
 * funcione, usar `crearCuentaActiva`.
 */
export async function crearUsuario(
  cliente: Client,
  opciones: OpcionesDeUsuario = {},
): Promise<string> {
  const usuarioId = opciones.id ?? id('usr');
  await cliente.query(
    `INSERT INTO acceso."Usuario"
       ("id", "indiceCiegoCorreo", "correoCifrado", "correoNonce", "correoTag", "correoIdClave",
        "nombreParaMostrarCifrado", "nombreParaMostrarNonce", "nombreParaMostrarTag", "nombreParaMostrarIdClave",
        "hashContrasena", "rol", "estadoCuenta", "estadoMfa", "confirmadoEn", "creadoEn")
     VALUES ($1, $2, $3, $4, $5, 'k_acceso:1', $6, $7, $8, 'k_acceso:1',
             '$argon2id$v=19$m=65536,t=3,p=4$c2Fs$aGFzaA', $9, $10, $11, $12, COALESCE($13::timestamptz, now()))`,
    [
      usuarioId,
      opciones.indiceCiegoCorreo === null ? null : (opciones.indiceCiegoCorreo ?? bytes()),
      bytes(),
      bytes(12),
      bytes(16),
      bytes(),
      bytes(12),
      bytes(16),
      opciones.rol ?? 'CLIENTE',
      opciones.estadoCuenta ?? 'NO_VERIFICADA',
      opciones.estadoMfa ?? 'NO_CONFIGURADO',
      opciones.confirmadoEn ?? null,
      opciones.creadoEn ?? null,
    ],
  );
  return usuarioId;
}

/** R-002-06: las dos clases de documento, o la cuenta no puede quedar ACTIVA. */
export async function registrarAceptaciones(cliente: Client, usuarioId: string): Promise<void> {
  for (const clase of ['TERMINOS_Y_CONDICIONES', 'POLITICA_DE_PRIVACIDAD']) {
    await cliente.query(
      `INSERT INTO acceso."AceptacionRegistrada"
         ("id", "usuarioId", "documentoClase", "documentoVersion", "hashDelTextoMostrado",
          "momento", "ipCifrada", "ipNonce", "ipTag", "ipIdClave", "canal", "casillaMarcada",
          "versionInformacionArt6")
       VALUES ($1, $2, $3::acceso."ClaseDocumentoAceptable", $4, 'sha256:sembrado',
               now(), $5, $6, $7, 'k_acceso:1', 'WEB', 'casilla-alta', $4)`,
      [id('acp'), usuarioId, clase, VERSION_CATALOGO, bytes(16), bytes(12), bytes(16)],
    );
  }
}

/** Un `EventoAuditoria` mínimo y válido. */
export async function registrarEvento(
  cliente: Client,
  opciones: {
    accion: string;
    sujeto?: string | null;
    titularAfectado?: string | null;
    clasificacion?: string;
    resultado?: string;
    momento?: string;
    datos?: unknown;
  },
): Promise<string> {
  const eventoId = id('evt');
  await cliente.query(
    `INSERT INTO auditoria."EventoAuditoria"
       ("id", "momento", "accion", "sujeto", "titularAfectado", "clasificacion",
        "resultado", "origenCanal", "idCorrelacion", "datos")
     VALUES ($1, COALESCE($2::timestamptz, now()), $3::auditoria."AccionAuditada", $4, $5,
             $6::auditoria."ClasificacionDato", $7::auditoria."ResultadoEvento",
             'PROCESO_INTERNO', $8, COALESCE($9::jsonb, '[]'::jsonb))`,
    [
      eventoId,
      opciones.momento ?? null,
      opciones.accion,
      opciones.sujeto ?? null,
      opciones.titularAfectado ?? null,
      opciones.clasificacion ?? 'INTERNO',
      opciones.resultado ?? 'EJECUTADO',
      id('corr'),
      opciones.datos === undefined ? null : JSON.stringify(opciones.datos),
    ],
  );
  return eventoId;
}

/**
 * Una cuenta `CLIENTE` `ACTIVA` con sus dos aceptaciones. Es el caso base de
 * casi todos los tests.
 */
export async function crearCuentaActiva(
  cliente: Client,
  opciones: OpcionesDeUsuario = {},
): Promise<string> {
  const usuarioId = await crearUsuario(cliente, {
    ...opciones,
    rol: opciones.rol ?? 'CLIENTE',
    estadoCuenta: 'NO_VERIFICADA',
  });
  await registrarAceptaciones(cliente, usuarioId);
  await cliente.query(
    `UPDATE acceso."Usuario"
        SET "estadoCuenta" = 'ACTIVA', "confirmadoEn" = now(), "estadoMfa" = $2::acceso."EstadoMfa"
      WHERE "id" = $1`,
    [usuarioId, opciones.estadoMfa ?? (opciones.rol === 'CLIENTE' || !opciones.rol ? 'NO_CONFIGURADO' : 'ACTIVO')],
  );
  return usuarioId;
}

/**
 * Una cuenta `ADMINISTRADOR` completa: designación, evento de auditoría y MFA
 * activo. Tiene que hacer las tres cosas porque el modelo no admite menos
 * (R-002-01, R-002-03).
 */
export async function crearAdministrador(
  cliente: Client,
  opciones: { id?: string; esSiembra?: boolean; creadoPor?: string | null } = {},
): Promise<string> {
  const usuarioId = opciones.id ?? id('adm');
  const esSiembra = opciones.esSiembra ?? true;

  await crearUsuario(cliente, { id: usuarioId, rol: 'ADMINISTRADOR', estadoCuenta: 'NO_VERIFICADA' });
  await registrarAceptaciones(cliente, usuarioId);
  await cliente.query(
    `INSERT INTO acceso."DesignacionDeAdministrador"
       ("usuarioId", "esAdministrador", "nombreCompletoCifrado", "nombreCompletoNonce",
        "nombreCompletoTag", "nombreCompletoIdClave", "documentoDeDesignacionReferencia",
        "huellaDocumentoDesignacion", "creadoPor", "esSiembra", "claveIdempotencia")
     VALUES ($1, true, $2, $3, $4, 'k_acceso:1', 'acta/designacion-001.pdf',
             'sha256:designacion', $5, $6, $7)`,
    [usuarioId, bytes(), bytes(12), bytes(16), esSiembra ? null : (opciones.creadoPor ?? null), esSiembra, id('idem')],
  );
  await registrarEvento(cliente, {
    accion: esSiembra ? 'ADMINISTRADOR_SEMBRADO' : 'ADMINISTRADOR_CREADO',
    titularAfectado: usuarioId,
    clasificacion: 'PERSONAL',
  });
  await cliente.query(
    `UPDATE acceso."Usuario"
        SET "estadoCuenta" = 'ACTIVA', "confirmadoEn" = now(), "estadoMfa" = 'ACTIVO'
      WHERE "id" = $1`,
    [usuarioId],
  );
  return usuarioId;
}

/** Una cuenta `ABOGADO` con su perfil profesional. */
export async function crearAbogadoConPerfil(
  cliente: Client,
  opciones: { matricula?: string; jurisdiccion?: string; estadoMfa?: string } = {},
): Promise<{ usuarioId: string; matricula: string; jurisdiccion: string }> {
  const usuarioId = id('abg');
  const matricula = opciones.matricula ?? `T${Math.floor(Math.random() * 100000)}`;
  const jurisdiccion = opciones.jurisdiccion ?? 'CABA';

  await crearUsuario(cliente, { id: usuarioId, rol: 'ABOGADO', estadoCuenta: 'NO_VERIFICADA' });
  await registrarAceptaciones(cliente, usuarioId);
  await cliente.query(
    `INSERT INTO acceso."PerfilProfesional"
       ("usuarioId", "rolDelTitular", "matricula", "jurisdiccion", "colegioDeclarado", "solicitadaEn")
     VALUES ($1, 'ABOGADO', $2, $3::acceso."Jurisdiccion", 'Colegio declarado de prueba', now())`,
    [usuarioId, matricula, jurisdiccion],
  );
  await cliente.query(
    `UPDATE acceso."Usuario"
        SET "estadoCuenta" = 'ACTIVA', "confirmadoEn" = now(), "estadoMfa" = $2::acceso."EstadoMfa"
      WHERE "id" = $1`,
    [usuarioId, opciones.estadoMfa ?? 'ACTIVO'],
  );
  return { usuarioId, matricula, jurisdiccion };
}

/** Una decisión de verificación APROBADA con toda la evidencia que R-002-08 exige. */
export async function aprobarMatricula(
  cliente: Client,
  perfilUsuarioId: string,
  decididaPor: string,
  opciones: { jurisdiccion?: string; matricula?: string; vigenciaHasta?: string; momento?: string } = {},
): Promise<string> {
  const decisionId = id('dec');
  await cliente.query(
    `INSERT INTO acceso."DecisionDeVerificacion"
       ("id", "perfilUsuarioId", "momento", "resultado", "vigenciaHasta", "decididaPor",
        "evidenciaColegio", "evidenciaJurisdiccion", "evidenciaNumeroDeMatricula",
        "evidenciaClaseDeConstancia", "evidenciaFechaDeLaConstancia",
        "evidenciaReferenciaDelDocumento", "evidenciaHuellaDocumento", "claveIdempotencia")
     VALUES ($1, $2, COALESCE($3::timestamptz, now()), 'APROBADA', COALESCE($4::date, (now() + interval '12 months')::date), $5,
             'Colegio Publico de prueba', $6::acceso."Jurisdiccion", $7,
             'CONSTANCIA_EMITIDA_POR_EL_COLEGIO', (now() - interval '1 day')::date,
             'objeto/constancia-001.pdf', 'sha256:constancia', $8)`,
    [
      decisionId,
      perfilUsuarioId,
      opciones.momento ?? null,
      opciones.vigenciaHasta ?? null,
      decididaPor,
      opciones.jurisdiccion ?? 'CABA',
      opciones.matricula ?? 'T00000',
      id('idem'),
    ],
  );
  return decisionId;
}

/** Un envío transaccional, que D.6, D.7 y C.3 necesitan referenciar. */
export async function crearEnvio(
  cliente: Client,
  plantilla = 'CONFIRMACION_DE_CORREO',
  usuarioId: string | null = null,
): Promise<string> {
  const clave = id('env');
  await cliente.query(
    `INSERT INTO acceso."EnvioTransaccional"
       ("claveDeIdempotencia", "plantilla", "usuarioId", "modo")
     VALUES ($1, $2::acceso."ClavePlantillaCorreo", $3, 'MOCK')`,
    [clave, plantilla, usuarioId],
  );
  return clave;
}

/** Una sesión abierta del titular, con el nivel de autenticación que se pida. */
export async function abrirSesion(
  cliente: Client,
  usuarioId: string,
  rol: Rol,
  nivel: 'CONTRASENA' | 'CONTRASENA_Y_SEGUNDO_FACTOR' = 'CONTRASENA_Y_SEGUNDO_FACTOR',
): Promise<string> {
  const sesionId = id('ses');
  await cliente.query(
    `INSERT INTO acceso."Sesion"
       ("id", "usuarioId", "rolDelTitular", "autenticadaEn", "nivelAutenticacion",
        "ipHash", "ubicacionPais", "ubicacionProvincia", "versionBaseGeoIp", "dispositivoClase")
     VALUES ($1, $2, $3::acceso."Rol", now(), $4::acceso."NivelAutenticacion",
             $5, 'AR', 'Santa Fe', 'geoip-2026-09', 'ESCRITORIO')`,
    [sesionId, usuarioId, rol, nivel, bytes()],
  );
  return sesionId;
}
