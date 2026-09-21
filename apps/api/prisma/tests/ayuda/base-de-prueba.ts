/**
 * Andamiaje de los tests de esquema (feature 004, tarea T-03).
 *
 * No es lógica de aplicación: es el mínimo necesario para levantar una base
 * descartable, aplicarle las migraciones versionadas y hacerle preguntas. La
 * frontera del `database-engineer` termina en el esquema, las migraciones y el
 * seed (mandato, "Límites duros"); esto es infraestructura de prueba del
 * esquema y vive dentro de `apps/api/prisma/**`.
 */

import { randomBytes } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';

const AQUI = dirname(fileURLToPath(import.meta.url));

/** `apps/api/prisma/migrations` */
export const DIRECTORIO_MIGRACIONES = join(AQUI, '..', '..', 'migrations');

/**
 * Códigos de error de PostgreSQL que usan las aserciones. Se nombran para que
 * un test diga "esto lo rechaza la restricción de exclusión" y no "esto
 * devuelve 23P01".
 * Referencia: PostgreSQL, apéndice A, clase 23 — Integrity Constraint Violation.
 */
export const ERROR = {
  UNICIDAD: '23505',
  CLAVE_FORANEA: '23503',
  RESTRICCION_CHECK: '23514',
  EXCLUSION: '23P01',
  RESTRICT: '23001',
  NO_NULO: '23502',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Descubrimiento de migraciones
// ─────────────────────────────────────────────────────────────────────────────

export interface MigracionEnDisco {
  /** Nombre del directorio, ej. `20260921120100_catalogo_normativo`. */
  nombre: string;
  rutaMigracion: string;
  rutaReversion: string;
  sqlMigracion: string;
  /** `null` si la migración todavía no tiene su `reversion.sql` escrito. */
  sqlReversion: string | null;
}

/**
 * Las migraciones en el orden en que Prisma las aplica: alfabético por nombre
 * de directorio, que por el prefijo de marca temporal es el orden cronológico.
 */
export function listarMigraciones(): MigracionEnDisco[] {
  return readdirSync(DIRECTORIO_MIGRACIONES, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()
    .map((nombre) => {
      const rutaMigracion = join(DIRECTORIO_MIGRACIONES, nombre, 'migration.sql');
      const rutaReversion = join(DIRECTORIO_MIGRACIONES, nombre, 'reversion.sql');
      return {
        nombre,
        rutaMigracion,
        rutaReversion,
        sqlMigracion: readFileSync(rutaMigracion, 'utf8'),
        sqlReversion: existsSync(rutaReversion) ? readFileSync(rutaReversion, 'utf8') : null,
      };
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Base descartable
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Variable propia y deliberadamente distinta de `DATABASE_URL`: acá se **crean
 * y se borran bases de datos enteras**. Apunta a cualquier base del clúster de
 * pruebas (típicamente `postgres`); las bases de trabajo se crean desde ahí.
 */
export function urlDelClusterDePrueba(): string | undefined {
  const url = process.env.DATABASE_URL_TEST;
  return url && url.trim().length > 0 ? url : undefined;
}

/** `true` si hay clúster configurado. Gobierna el `describe.skipIf` de la suite. */
export const HAY_BASE = urlDelClusterDePrueba() !== undefined;

export const MOTIVO_OMISION =
  'DATABASE_URL_TEST no está definida: los tests de esquema necesitan un PostgreSQL 16 real con btree_gist. Ver apps/api/prisma/LEEME.md.';

export interface BaseDePrueba {
  cliente: Client;
  nombreBase: string;
  /** Cierra la conexión y borra la base. Idempotente. */
  destruir(): Promise<void>;
}

async function conCliente<T>(url: string, fn: (c: Client) => Promise<T>): Promise<T> {
  const cliente = new Client({ connectionString: url });
  await cliente.connect();
  try {
    return await fn(cliente);
  } finally {
    await cliente.end();
  }
}

/**
 * Crea una base vacía con nombre único. No aplica migraciones: la usa el test
 * de migración, que justamente necesita observar el arranque desde cero.
 */
export async function crearBaseVacia(prefijo: string): Promise<BaseDePrueba> {
  const url = urlDelClusterDePrueba();
  if (!url) throw new Error(MOTIVO_OMISION);

  // 63 bytes es el límite de un identificador en PostgreSQL; el prefijo es corto.
  const nombreBase = `mejorar_t_${prefijo}_${randomBytes(5).toString('hex')}`;
  await conCliente(url, (c) => c.query(`CREATE DATABASE "${nombreBase}"`));

  const destino = new URL(url);
  destino.pathname = `/${nombreBase}`;
  const cliente = new Client({ connectionString: destino.toString() });
  await cliente.connect();

  let destruida = false;
  return {
    cliente,
    nombreBase,
    async destruir() {
      if (destruida) return;
      destruida = true;
      await cliente.end();
      await conCliente(url, (c) =>
        // `WITH (FORCE)` desaloja conexiones colgadas: si un test se cae a la
        // mitad, la base descartable no queda ocupando el clúster para siempre.
        c.query(`DROP DATABASE IF EXISTS "${nombreBase}" WITH (FORCE)`),
      );
    },
  };
}

/** Lo mismo, con todas las migraciones versionadas ya aplicadas. */
export async function crearBaseConMigraciones(prefijo: string): Promise<BaseDePrueba> {
  const base = await crearBaseVacia(prefijo);
  try {
    await aplicarMigraciones(base.cliente);
  } catch (error) {
    await base.destruir();
    throw error;
  }
  return base;
}

/**
 * Aplica cada `migration.sql` dentro de su propia transacción, que es como las
 * aplica `prisma migrate deploy`. Importa: los archivos usan `SET LOCAL
 * search_path`, que fuera de una transacción no tiene efecto y dejaría la
 * restricción de exclusión sin las clases de operadores de `btree_gist`.
 */
export async function aplicarMigraciones(cliente: Client, hasta?: string): Promise<string[]> {
  const aplicadas: string[] = [];
  for (const m of listarMigraciones()) {
    await ejecutarEnTransaccion(cliente, m.sqlMigracion, `migración ${m.nombre}`);
    aplicadas.push(m.nombre);
    if (hasta !== undefined && m.nombre === hasta) break;
  }
  return aplicadas;
}

/**
 * Aplica los `reversion.sql` en orden inverso. Prisma no los ejecuta nunca
 * (ADR-007 §3): existen para que la vuelta atrás esté escrita y revisada, y
 * para que `modelo-datos.md` §6.2 sea verificable en vez de declarativo.
 */
export async function aplicarReversiones(cliente: Client): Promise<string[]> {
  const revertidas: string[] = [];
  for (const m of [...listarMigraciones()].reverse()) {
    if (m.sqlReversion === null) {
      throw new Error(`La migración ${m.nombre} no tiene reversion.sql (modelo-datos §6.2).`);
    }
    await ejecutarEnTransaccion(cliente, m.sqlReversion, `reversión ${m.nombre}`);
    revertidas.push(m.nombre);
  }
  return revertidas;
}

async function ejecutarEnTransaccion(cliente: Client, sql: string, que: string): Promise<void> {
  await cliente.query('BEGIN');
  try {
    await cliente.query(sql);
    await cliente.query('COMMIT');
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw new Error(`Falló la ${que}: ${(error as Error).message}`, { cause: error });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Aislamiento por caso y aserciones sobre el rechazo de la base
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Corre el cuerpo dentro de una transacción que **siempre** se revierte. Es lo
 * que permite compartir una base por archivo sin que un caso contamine al
 * siguiente, y de paso ejercita las restricciones en su modo normal (inmediato).
 */
export async function enTransaccionRevertida<T>(
  cliente: Client,
  cuerpo: () => Promise<T>,
): Promise<T> {
  await cliente.query('BEGIN');
  try {
    return await cuerpo();
  } finally {
    await cliente.query('ROLLBACK');
  }
}

export interface RechazoDeLaBase {
  /** Código SQLSTATE, ej. `23P01`. */
  codigo: string;
  /** Nombre de la restricción que disparó, cuando PostgreSQL lo informa. */
  restriccion: string | undefined;
  mensaje: string;
}

/**
 * Ejecuta una sentencia que **tiene que** ser rechazada y devuelve el rechazo.
 * Usa un punto de guardado para que la transacción del caso sobreviva al error
 * y el test pueda seguir probando la siguiente variante.
 *
 * Si la sentencia es aceptada, falla con un mensaje que nombra la invariante
 * violada. Ese es el punto: el test no verifica "tira un error", verifica
 * "la base lo hace imposible".
 */
export async function debeRechazar(
  cliente: Client,
  sql: string,
  parametros: readonly unknown[] = [],
): Promise<RechazoDeLaBase> {
  await cliente.query('SAVEPOINT intento');
  try {
    await cliente.query(sql, parametros as unknown[]);
  } catch (error) {
    await cliente.query('ROLLBACK TO SAVEPOINT intento');
    const e = error as { code?: string; constraint?: string; message: string };
    return { codigo: e.code ?? 'SIN_CODIGO', restriccion: e.constraint, mensaje: e.message };
  }
  await cliente.query('RELEASE SAVEPOINT intento');
  throw new Error(
    `La base ACEPTÓ una sentencia que debía rechazar. La invariante no está garantizada por el esquema.\nSentencia: ${sql}\nParámetros: ${JSON.stringify(parametros)}`,
  );
}

/** Ejecuta una sentencia que tiene que ser aceptada. Envuelve el error para que se lea. */
export async function debeAceptar(
  cliente: Client,
  sql: string,
  parametros: readonly unknown[] = [],
): Promise<void> {
  try {
    await cliente.query(sql, parametros as unknown[]);
  } catch (error) {
    const e = error as { code?: string; constraint?: string; message: string };
    throw new Error(
      `La base RECHAZÓ una sentencia legítima (${e.code} ${e.constraint ?? ''}): ${e.message}\nSentencia: ${sql}\nParámetros: ${JSON.stringify(parametros)}`,
      { cause: error },
    );
  }
}
