/**
 * Constructores de filas del Bloque A para los tests de esquema.
 *
 * Todos los valores son inventados y no normativos: acá no se prueba qué dice
 * la ley —eso es del catálogo de la migración 0010 y del `dev-dominio`—, se
 * prueba que el esquema impida los estados que `modelo-datos.md` §7.1 declara
 * imposibles. Se usan claves de parámetro reales sólo para que el test se lea.
 */

import { randomUUID } from 'node:crypto';
import type { Client } from 'pg';

export const CLAVE_PRESCRIPCION = 'prescripcion.plazoGenerico';
export const CLAVE_HONORARIOS = 'honorarios.topeCuotaLitis';

/** Inserta un `ParametroNormativo`. Tabla de carga controlada (A.1). */
export async function sembrarParametro(
  cliente: Client,
  clave: string,
  opciones: {
    analisis?: string;
    tipoValor?: string;
    unidad?: string | null;
    admiteJurisdiccion?: boolean;
    bloqueanteDeAnalisis?: boolean;
    esNormativo?: boolean;
  } = {},
): Promise<string> {
  await cliente.query(
    `INSERT INTO motor."ParametroNormativo"
       (clave, analisis, descripcion, "tipoValor", unidad,
        "esNormativo", "admiteJurisdiccion", "bloqueanteDeAnalisis")
     VALUES ($1, $2::motor."AnalisisMotor", $3, $4::motor."TipoValorParametro", $5, $6, $7, $8)`,
    [
      clave,
      opciones.analisis ?? 'A_PRESCRIPCION',
      `Parámetro de prueba ${clave}`,
      opciones.tipoValor ?? 'PLAZO_ANIOS',
      opciones.unidad === undefined ? 'años' : opciones.unidad,
      opciones.esNormativo ?? true,
      opciones.admiteJurisdiccion ?? false,
      opciones.bloqueanteDeAnalisis ?? false,
    ],
  );
  return clave;
}

export interface TramoDeseado {
  id?: string;
  clave: string;
  jurisdiccion?: string;
  /** Extremo inferior del `daterange`, inclusivo. `null` = no acotado. */
  desde?: string | null;
  /** Extremo superior, exclusivo. `null` = vigente sin término conocido. */
  hasta?: string | null;
  /** Forma del rango. Se parametriza para poder probar las formas no canónicas. */
  forma?: '[)' | '[]' | '()' | '(]';
  /** Valor de negocio. `null` = SQL NULL. */
  valor?: unknown;
  /**
   * Texto JSON crudo para `valor`, sin pasar por `JSON.stringify`. Existe para
   * poder distinguir SQL NULL de `'null'::jsonb`, que no son lo mismo.
   */
  valorJsonCrudo?: string;
  disponibilidad?: string;
  confiabilidadFuente?: string;
  estadoRatificacion?: string;
  ratificacionId?: string | null;
  retiradoEn?: string | null;
}

const SQL_INSERTAR_TRAMO = `
  INSERT INTO motor."TramoParametro"
    (id, "claveParametro", jurisdiccion, valor, vigencia,
     disponibilidad, "confiabilidadFuente", "estadoRatificacion",
     "ratificacionId", "retiradoEn", "cargadoPor")
  VALUES
    ($1::uuid, $2, $3::motor."Jurisdiccion", $4::jsonb,
     daterange($5::date, $6::date, $7),
     $8::motor."DisponibilidadParametro", $9::motor."Confiabilidad",
     $10::motor."EstadoRatificacion", $11::uuid, $12::timestamptz, 'TEST')`;

/** Devuelve la sentencia y los parámetros, sin ejecutarla: la ejecuta el test
 * con `debeAceptar` o con `debeRechazar`, según lo que esté probando. */
export function sentenciaTramo(t: TramoDeseado): { sql: string; parametros: unknown[] } {
  const disponibilidad = t.disponibilidad ?? 'CARGADO';
  const valor =
    t.valorJsonCrudo !== undefined
      ? t.valorJsonCrudo
      : t.valor === null
        ? null // SQL NULL
        : t.valor !== undefined
          ? JSON.stringify(t.valor)
          : disponibilidad === 'CARGADO'
            ? JSON.stringify(5)
            : null;
  return {
    sql: SQL_INSERTAR_TRAMO,
    parametros: [
      t.id ?? randomUUID(),
      t.clave,
      t.jurisdiccion ?? 'NACIONAL',
      valor,
      t.desde === undefined ? '2015-01-01' : t.desde,
      t.hasta === undefined ? null : t.hasta,
      t.forma ?? '[)',
      disponibilidad,
      t.confiabilidadFuente ?? 'V',
      t.estadoRatificacion ?? 'SIN_RATIFICAR',
      t.ratificacionId ?? null,
      t.retiradoEn ?? null,
    ],
  };
}

/** Inserta el tramo y devuelve su id. Falla el test si la base lo rechaza. */
export async function insertarTramo(cliente: Client, t: TramoDeseado): Promise<string> {
  const { sql, parametros } = sentenciaTramo({ id: t.id ?? randomUUID(), ...t });
  await cliente.query(sql, parametros);
  return parametros[0] as string;
}

/** Matrícula vigente + acto de ratificación firmado. Devuelve el id de la ratificación. */
export async function sembrarRatificacion(
  cliente: Client,
  opciones: { idProfesional?: string; matricula?: string; estadoMatricula?: string } = {},
): Promise<{ ratificacionId: string; idProfesional: string }> {
  const idProfesional = opciones.idProfesional ?? `prof_${randomUUID().slice(0, 8)}`;
  const matricula = opciones.matricula ?? `T${Math.floor(Math.random() * 1e6)} F123`;

  await cliente.query(
    `INSERT INTO motor."MatriculaProfesional"
       ("idProfesional", matricula, colegio, jurisdiccion, estado,
        "vigenciaDesde", "verificadaEn", "fuenteVerificacion")
     VALUES ($1, $2, 'Colegio de prueba', 'CABA', $3::motor."EstadoMatricula",
             DATE '2020-01-01', now(), 'padrón de prueba')`,
    [idProfesional, matricula, opciones.estadoMatricula ?? 'VIGENTE'],
  );

  const ratificacionId = randomUUID();
  await cliente.query(
    `INSERT INTO motor."Ratificacion"
       (id, "idProfesional", matricula, "jurisdiccionMatricula", "nombreProfesional",
        fecha, "fechaProximaRevision", "referenciaDocumentoFirmado",
        "huellaDocumento", "alcanceDeclarado")
     VALUES ($1::uuid, $2, $3, 'CABA', 'Profesional de Prueba',
             DATE '2026-01-15', DATE '2027-01-15', 'almacen://dictamen-de-prueba.pdf',
             repeat('a', 64), 'Ratifico los parámetros del análisis A.')`,
    [ratificacionId, idProfesional, matricula],
  );

  return { ratificacionId, idProfesional };
}

/** Catálogo normativo. Nace en BORRADOR y `aptoProduccion = false` (A.6). */
export async function sembrarCatalogo(
  cliente: Client,
  opciones: { version?: string; aptoProduccion?: boolean; estado?: string } = {},
): Promise<string> {
  const version = opciones.version ?? `2026.09.21-${Math.floor(Math.random() * 1e6)}`;
  await cliente.query(
    `INSERT INTO motor."CatalogoNormativo"
       (version, "huellaContenido", "generadoEl", estado, "aptoProduccion")
     VALUES ($1, repeat('b', 64), now(), $2::motor."EstadoCatalogo", $3)`,
    [version, opciones.estado ?? 'BORRADOR', opciones.aptoProduccion ?? false],
  );
  return version;
}

export const SQL_INSERTAR_CATALOGO_TRAMO = `
  INSERT INTO motor."CatalogoTramo"
    ("catalogoVersion", "catalogoAptoProduccion", "tramoId", "tramoEstadoRatificacion")
  VALUES ($1, $2, $3::uuid, $4::motor."EstadoRatificacion")`;
