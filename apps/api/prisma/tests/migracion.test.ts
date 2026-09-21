/**
 * Migraciones: corren limpias contra una base nueva y son reversibles.
 *
 * Es el criterio de "terminado" del mandato del `database-engineer` ("la
 * migración es reversible y está probada contra datos de ejemplo") y lo que
 * `modelo-datos.md` §6.2 promete: "cada migración lleva su `down`".
 *
 * El primer bloque no necesita base: verifica la forma de los archivos en
 * disco. Corre siempre, para que la suite nunca quede vacía en verde cuando no
 * hay Postgres configurado.
 */

import { describe, expect, it, afterEach } from 'vitest';
import {
  BaseDePrueba,
  aplicarMigraciones,
  aplicarReversiones,
  crearBaseVacia,
  HAY_BASE,
  listarMigraciones,
  MOTIVO_OMISION,
} from './ayuda/base-de-prueba.js';

// ─────────────────────────────────────────────────────────────────────────────
// Sin base: forma de los archivos
// ─────────────────────────────────────────────────────────────────────────────

describe('Migraciones en disco', () => {
  const migraciones = listarMigraciones();

  it('hay al menos una migración y todas tienen su migration.sql con contenido', () => {
    expect(migraciones.length).toBeGreaterThan(0);
    for (const m of migraciones) {
      expect(m.sqlMigracion.trim().length, `${m.nombre} está vacía`).toBeGreaterThan(0);
    }
  });

  it('cada migración tiene su reversion.sql escrito (modelo-datos §6.2)', () => {
    const sinReversion = migraciones.filter((m) => m.sqlReversion === null).map((m) => m.nombre);
    expect(sinReversion, 'migraciones sin vuelta atrás escrita').toEqual([]);
  });

  it('el orden de aplicación es el del prefijo temporal', () => {
    const nombres = migraciones.map((m) => m.nombre);
    expect(nombres).toEqual([...nombres].sort());
  });

  it.runIf(!HAY_BASE)(`aviso: el resto de la suite de esquema queda omitida`, () => {
    // No falla: sólo deja constancia en la salida de que lo que se verificó
    // fue la forma de los archivos y no su efecto sobre una base real.
    console.warn(`[apps/api] ${MOTIVO_OMISION}`);
    expect(HAY_BASE).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Con base: aplicación y reversión reales
// ─────────────────────────────────────────────────────────────────────────────

describe.skipIf(!HAY_BASE)('Migraciones contra una base nueva', () => {
  let base: BaseDePrueba | undefined;

  afterEach(async () => {
    await base?.destruir();
    base = undefined;
  });

  it('corren limpias sobre una base vacía', async () => {
    base = await crearBaseVacia('migra');
    const aplicadas = await aplicarMigraciones(base.cliente);
    expect(aplicadas).toEqual(listarMigraciones().map((m) => m.nombre));
  });

  it('dejan los dos esquemas y las dos extensiones que el modelo exige', async () => {
    base = await crearBaseVacia('esquemas');
    await aplicarMigraciones(base.cliente);

    const esquemas = await base.cliente.query<{ nspname: string }>(
      `SELECT nspname FROM pg_namespace WHERE nspname IN ('motor', 'identidad') ORDER BY 1`,
    );
    expect(esquemas.rows.map((r) => r.nspname)).toEqual(['identidad', 'motor']);

    const extensiones = await base.cliente.query<{ extname: string }>(
      `SELECT extname FROM pg_extension WHERE extname IN ('btree_gist', 'pgcrypto') ORDER BY 1`,
    );
    // `btree_gist` no es opcional: sin ella la exclusión de R-13 no se puede
    // crear, porque mezcla `=` sobre texto y enum con `&&` sobre el rango.
    expect(extensiones.rows.map((r) => r.extname)).toEqual(['btree_gist', 'pgcrypto']);
  });

  it('el esquema `identidad` nace y queda vacío: Prisma no lo administra (§7.4)', async () => {
    base = await crearBaseVacia('identidad');
    await aplicarMigraciones(base.cliente);
    const { rows } = await base.cliente.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'identidad' AND c.relkind IN ('r', 'p', 'v', 'm')`,
    );
    expect(rows[0]!.n).toBe('0');
  });

  it('crean las ocho tablas del Bloque A y ninguna más', async () => {
    base = await crearBaseVacia('tablas');
    await aplicarMigraciones(base.cliente);
    const { rows } = await base.cliente.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'motor' ORDER BY 1`,
    );
    expect(rows.map((r) => r.tablename)).toEqual([
      'CatalogoNormativo',
      'CatalogoTramo',
      'CitaNormativa',
      'MatriculaProfesional',
      'ParametroNormativo',
      'Ratificacion',
      'TramoParametro',
      'TramoParametroCita',
    ]);
  });

  it('`TramoParametro.vigencia` es un `daterange` de verdad, no dos fechas sueltas', async () => {
    base = await crearBaseVacia('tipo');
    await aplicarMigraciones(base.cliente);
    const { rows } = await base.cliente.query<{ udt: string; nullable: string }>(
      `SELECT udt_name AS udt, is_nullable AS nullable
         FROM information_schema.columns
        WHERE table_schema = 'motor' AND table_name = 'TramoParametro'
          AND column_name = 'vigencia'`,
    );
    expect(rows[0]!.udt).toBe('daterange');
    expect(rows[0]!.nullable).toBe('NO');
  });

  it('son reversibles: aplicar, revertir y volver a aplicar deja la base igual', async () => {
    base = await crearBaseVacia('reversible');

    await aplicarMigraciones(base.cliente);
    const antes = await inventario(base);

    await aplicarReversiones(base.cliente);
    const vacia = await base.cliente.query<{ nspname: string }>(
      `SELECT nspname FROM pg_namespace WHERE nspname IN ('motor', 'identidad')`,
    );
    expect(vacia.rows, 'la reversión dejó esquemas colgados').toEqual([]);

    await aplicarMigraciones(base.cliente);
    const despues = await inventario(base);
    expect(despues).toEqual(antes);
  });

  it('la reversión no deja tipos enumerados huérfanos', async () => {
    // Un enum que sobrevive al DROP SCHEMA hace fallar la reaplicación con
    // "type already exists", que es la forma clásica de que una vuelta atrás
    // parezca exitosa y deje la base inservible.
    base = await crearBaseVacia('enums');
    await aplicarMigraciones(base.cliente);
    await aplicarReversiones(base.cliente);

    const { rows } = await base.cliente.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM pg_type t
         JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname IN ('motor', 'identidad') AND t.typtype = 'e'`,
    );
    expect(rows[0]!.n).toBe('0');
  });
});

/**
 * Huella del esquema: tablas, columnas con su tipo, y restricciones con su
 * definición. Es lo que permite comparar "antes" y "después" de un ciclo de
 * reversión sin escribir cincuenta aserciones sueltas.
 */
async function inventario(base: BaseDePrueba): Promise<{
  columnas: string[];
  restricciones: string[];
  indices: string[];
}> {
  const columnas = await base.cliente.query<{ f: string }>(
    `SELECT table_name || '.' || column_name || ':' || udt_name || ':' || is_nullable AS f
       FROM information_schema.columns
      WHERE table_schema = 'motor' ORDER BY 1`,
  );
  const restricciones = await base.cliente.query<{ f: string }>(
    `SELECT t.relname || '.' || c.conname || ' = ' || pg_get_constraintdef(c.oid) AS f
       FROM pg_constraint c
       JOIN pg_class t ON t.oid = c.conrelid
       JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'motor' ORDER BY 1`,
  );
  const indices = await base.cliente.query<{ f: string }>(
    `SELECT indexdef AS f FROM pg_indexes WHERE schemaname = 'motor' ORDER BY 1`,
  );
  return {
    columnas: columnas.rows.map((r) => r.f),
    restricciones: restricciones.rows.map((r) => r.f),
    indices: indices.rows.map((r) => r.f),
  };
}
