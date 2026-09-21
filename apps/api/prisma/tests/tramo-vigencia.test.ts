/**
 * R-13 / CA-29 — vigencias sin solapamiento.
 *
 * `modelo-datos.md` §7.1 R-13 declara imposible que existan "dos parámetros
 * vigentes solapados: la pregunta «cuál regía a la fecha del hecho» tiene
 * siempre a lo sumo una respuesta". El mecanismo es una restricción de
 * exclusión GiST, no una validación de servicio. Estos tests son la prueba de
 * que el mecanismo está y de que no se puede esquivar.
 *
 * Qué NO prueban: qué dice la ley. Eso es del catálogo (migración 0010) y del
 * `dev-dominio`.
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
  CLAVE_PRESCRIPCION,
  insertarTramo,
  sentenciaTramo,
  sembrarParametro,
} from './ayuda/datos.js';

describe.skipIf(!HAY_BASE)(`Bloque A — TramoParametro: vigencias (R-13, CA-29)`, () => {
  let base: BaseDePrueba;
  let cliente: Client;

  beforeAll(async () => {
    base = await crearBaseConMigraciones('vigencia');
    cliente = base.cliente;
    await sembrarParametro(cliente, CLAVE_PRESCRIPCION);
    await sembrarParametro(cliente, 'embargo.tramo1.porcentaje', {
      analisis: 'D_EMBARGABILIDAD',
      tipoValor: 'PORCENTAJE',
      unidad: '% del excedente',
      admiteJurisdiccion: true,
    });
  });

  afterAll(async () => {
    await base?.destruir();
  });

  // ── La restricción existe y es la que dice el modelo ───────────────────────

  it('la restricción de exclusión existe, es GiST y es parcial sobre los tramos no retirados', async () => {
    const { rows } = await cliente.query<{ definicion: string; tipo: string }>(
      `SELECT pg_get_constraintdef(c.oid) AS definicion, c.contype AS tipo
         FROM pg_constraint c
         JOIN pg_class t ON t.oid = c.conrelid
         JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'motor' AND t.relname = 'TramoParametro'
          AND c.conname = 'ix_tramo_vigencia'`,
    );

    expect(rows, 'falta la restricción ix_tramo_vigencia (R-13)').toHaveLength(1);
    const definicion = rows[0]!.definicion;
    expect(rows[0]!.tipo, 'ix_tramo_vigencia tiene que ser EXCLUDE, no UNIQUE').toBe('x');
    expect(definicion).toContain('USING gist');
    expect(definicion).toContain('"claveParametro" WITH =');
    expect(definicion).toContain('jurisdiccion WITH =');
    expect(definicion).toContain('vigencia WITH &&');
    // La cláusula parcial no es un detalle: sin ella, retirar un tramo mal
    // cargado impediría cargar su reemplazo sobre el mismo período.
    // (PostgreSQL agrega paréntesis propios al reimprimir el predicado.)
    expect(definicion.replace(/[()]/g, '')).toContain('WHERE "retiradoEn" IS NULL');
  });

  // ── Lo que la base tiene que rechazar ──────────────────────────────────────

  it('rechaza dos tramos solapados de la misma clave y jurisdicción', async () => {
    await enTransaccionRevertida(cliente, async () => {
      await insertarTramo(cliente, {
        clave: CLAVE_PRESCRIPCION,
        desde: '2015-08-01',
        hasta: '2024-01-01',
      });

      const { sql, parametros } = sentenciaTramo({
        clave: CLAVE_PRESCRIPCION,
        desde: '2023-06-01', // cae adentro del rango anterior
        hasta: '2025-01-01',
      });
      const rechazo = await debeRechazar(cliente, sql, parametros);

      expect(rechazo.codigo).toBe(ERROR.EXCLUSION);
      expect(rechazo.restriccion).toBe('ix_tramo_vigencia');
    });
  });

  it('rechaza el solapamiento aunque sea de un solo día', async () => {
    await enTransaccionRevertida(cliente, async () => {
      await insertarTramo(cliente, {
        clave: CLAVE_PRESCRIPCION,
        desde: '2015-08-01',
        hasta: '2023-12-22',
      });
      const { sql, parametros } = sentenciaTramo({
        clave: CLAVE_PRESCRIPCION,
        desde: '2023-12-21', // se pisa el 21/12 con el anterior
        hasta: null,
      });
      const rechazo = await debeRechazar(cliente, sql, parametros);
      expect(rechazo.codigo).toBe(ERROR.EXCLUSION);
    });
  });

  it('rechaza el solapamiento contra un tramo sin término (`hasta` no acotado)', async () => {
    await enTransaccionRevertida(cliente, async () => {
      await insertarTramo(cliente, {
        clave: CLAVE_PRESCRIPCION,
        desde: '2024-01-01',
        hasta: null, // vigente sin término conocido
      });
      const { sql, parametros } = sentenciaTramo({
        clave: CLAVE_PRESCRIPCION,
        desde: '2026-01-01',
        hasta: '2027-01-01',
      });
      const rechazo = await debeRechazar(cliente, sql, parametros);
      expect(rechazo.codigo).toBe(ERROR.EXCLUSION);
    });
  });

  it('rechaza dos tramos sin término para la misma clave y jurisdicción', async () => {
    await enTransaccionRevertida(cliente, async () => {
      await insertarTramo(cliente, { clave: CLAVE_PRESCRIPCION, desde: '2015-01-01', hasta: null });
      const { sql, parametros } = sentenciaTramo({
        clave: CLAVE_PRESCRIPCION,
        desde: '2030-01-01',
        hasta: null,
      });
      const rechazo = await debeRechazar(cliente, sql, parametros);
      expect(rechazo.codigo).toBe(ERROR.EXCLUSION);
    });
  });

  it('rechaza que un tramo retirado "reviva" al limpiarle la baja lógica si ya hay otro en su período', async () => {
    // La exclusión es parcial: hay que verificar que el UPDATE que la vuelve a
    // poner dentro del alcance también se evalúa. Si no, la baja lógica sería
    // una puerta trasera al solapamiento.
    await enTransaccionRevertida(cliente, async () => {
      const retirado = await insertarTramo(cliente, {
        clave: CLAVE_PRESCRIPCION,
        desde: '2015-01-01',
        hasta: '2024-01-01',
        retiradoEn: '2024-02-01T00:00:00Z',
      });
      await insertarTramo(cliente, {
        clave: CLAVE_PRESCRIPCION,
        desde: '2015-01-01',
        hasta: '2024-01-01',
      });

      const rechazo = await debeRechazar(
        cliente,
        `UPDATE motor."TramoParametro" SET "retiradoEn" = NULL WHERE id = $1::uuid`,
        [retirado],
      );
      expect(rechazo.codigo).toBe(ERROR.EXCLUSION);
    });
  });

  // ── Formas de rango no canónicas (ck_tramo_vigencia_canonica) ──────────────

  it('rechaza un rango vacío', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const { sql, parametros } = sentenciaTramo({
        clave: CLAVE_PRESCRIPCION,
        desde: '2020-01-01',
        hasta: '2020-01-01', // [x, x) es vacío
      });
      const rechazo = await debeRechazar(cliente, sql, parametros);
      expect(rechazo.codigo).toBe(ERROR.RESTRICCION_CHECK);
      expect(rechazo.restriccion).toBe('ck_tramo_vigencia_canonica');
    });
  });

  it('rechaza un rango sin inicio conocido', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const { sql, parametros } = sentenciaTramo({
        clave: CLAVE_PRESCRIPCION,
        desde: null,
        hasta: '2024-01-01',
      });
      const rechazo = await debeRechazar(cliente, sql, parametros);
      expect(rechazo.codigo).toBe(ERROR.RESTRICCION_CHECK);
      expect(rechazo.restriccion).toBe('ck_tramo_vigencia_canonica');
    });
  });

  it('normaliza cualquier forma de rango a `[desde, hasta)`', async () => {
    // `[a, b]` y `[a, b+1)` describen el mismo período; si la base guardara los
    // dos literales, dos catálogos idénticos tendrían huellas distintas y CA-31
    // dejaría de cerrar. No hace falta prohibirlo: `daterange` es un rango sobre
    // un tipo discreto y PostgreSQL lo canoniza a `[)` al construirlo. Por eso
    // las cláusulas `lower_inc` / `NOT upper_inc` de `ck_tramo_vigencia_canonica`
    // nunca llegan a dispararse: son documentación ejecutable, no defensa. Se
    // deja probado el hecho del que dependemos, que es lo que puede cambiar.
    await enTransaccionRevertida(cliente, async () => {
      const id = await insertarTramo(cliente, {
        clave: CLAVE_PRESCRIPCION,
        desde: '2020-01-01',
        hasta: '2024-01-01',
        forma: '[]',
      });
      const { rows } = await cliente.query<{ v: string }>(
        `SELECT vigencia::text AS v FROM motor."TramoParametro" WHERE id = $1::uuid`,
        [id],
      );
      expect(rows[0]!.v).toBe('[2020-01-01,2024-01-02)');
    });
  });

  // ── Lo que la base tiene que aceptar ───────────────────────────────────────

  it('acepta dos tramos contiguos de la misma clave: el caso del DNU 70/2023 (CA-35)', async () => {
    await enTransaccionRevertida(cliente, async () => {
      await insertarTramo(cliente, {
        clave: CLAVE_PRESCRIPCION,
        desde: '2015-08-01',
        hasta: '2023-12-21',
      });
      const { sql, parametros } = sentenciaTramo({
        clave: CLAVE_PRESCRIPCION,
        desde: '2023-12-21', // arranca justo donde el anterior termina
        hasta: null,
      });
      await debeAceptar(cliente, sql, parametros);

      // Y la pregunta que motiva todo esto tiene exactamente una respuesta.
      const { rows } = await cliente.query<{ n: string }>(
        `SELECT count(*)::text AS n
           FROM motor."TramoParametro"
          WHERE "claveParametro" = $1 AND jurisdiccion = 'NACIONAL'
            AND vigencia @> DATE '2023-12-21' AND "retiradoEn" IS NULL`,
        [CLAVE_PRESCRIPCION],
      );
      expect(rows[0]!.n).toBe('1');
    });
  });

  it('acepta el mismo período en jurisdicciones distintas (CA-43)', async () => {
    await enTransaccionRevertida(cliente, async () => {
      await insertarTramo(cliente, {
        clave: 'embargo.tramo1.porcentaje',
        jurisdiccion: 'CABA',
        desde: '2020-01-01',
        hasta: null,
      });
      const { sql, parametros } = sentenciaTramo({
        clave: 'embargo.tramo1.porcentaje',
        jurisdiccion: 'CORDOBA',
        desde: '2020-01-01',
        hasta: null,
      });
      await debeAceptar(cliente, sql, parametros);
    });
  });

  it('`TODAS` no colisiona con una jurisdicción concreta: no es un comodín en la base (R-14, S-09)', async () => {
    // Consecuencia deliberada del modelo: `TODAS` es un valor más del enum, no
    // una fila comodín. La resolución por jurisdicción exacta o `TODAS` es de
    // la consulta (R-14), y el `dev-dominio` es quien no debe caer de vuelta.
    // Se deja probado para que la frontera quede escrita y no se asuma que la
    // base impide la ambigüedad — no la impide, y hay que saberlo.
    await enTransaccionRevertida(cliente, async () => {
      await insertarTramo(cliente, {
        clave: 'embargo.tramo1.porcentaje',
        jurisdiccion: 'TODAS',
        desde: '2020-01-01',
        hasta: null,
      });
      const { sql, parametros } = sentenciaTramo({
        clave: 'embargo.tramo1.porcentaje',
        jurisdiccion: 'CABA',
        desde: '2020-01-01',
        hasta: null,
      });
      await debeAceptar(cliente, sql, parametros);
    });
  });

  it('acepta el reemplazo sobre el mismo período si el anterior está retirado', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const original = await insertarTramo(cliente, {
        clave: CLAVE_PRESCRIPCION,
        desde: '2015-01-01',
        hasta: null,
        retiradoEn: '2026-03-01T00:00:00Z',
      });
      const { sql, parametros } = sentenciaTramo({
        clave: CLAVE_PRESCRIPCION,
        desde: '2015-01-01',
        hasta: null,
      });
      await debeAceptar(cliente, sql, parametros);

      // El linaje se puede declarar: un tramo mal cargado no se edita.
      await debeAceptar(
        cliente,
        `UPDATE motor."TramoParametro" SET "reemplazaTramoId" = $1::uuid WHERE id = $2::uuid`,
        [original, parametros[0]],
      );
    });
  });

  it('rechaza un linaje reflexivo', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const id = await insertarTramo(cliente, { clave: CLAVE_PRESCRIPCION, hasta: null });
      const rechazo = await debeRechazar(
        cliente,
        `UPDATE motor."TramoParametro" SET "reemplazaTramoId" = id WHERE id = $1::uuid`,
        [id],
      );
      expect(rechazo.codigo).toBe(ERROR.RESTRICCION_CHECK);
      expect(rechazo.restriccion).toBe('ck_tramo_linaje_no_reflexivo');
    });
  });

  it('rechaza una clave de parámetro que no está en el catálogo cerrado (A.1)', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const { sql, parametros } = sentenciaTramo({ clave: 'clave.inventada.por.alguien' });
      const rechazo = await debeRechazar(cliente, sql, parametros);
      expect(rechazo.codigo).toBe(ERROR.CLAVE_FORANEA);
    });
  });

  // ── El índice que sirve Q-04 ───────────────────────────────────────────────

  it('no hay un btree redundante sobre (claveParametro, jurisdiccion, vigencia): Q-04 la sirve el GiST', async () => {
    // Regla 8 del mandato: un índice sin consulta es costo. El modelo declara
    // explícitamente que Q-04 la sirve el índice de la exclusión. Si alguien
    // agrega un btree "por las dudas", este test lo obliga a justificarlo en
    // `modelo-datos.md` §3 antes de que entre.
    const { rows } = await cliente.query<{ indexdef: string }>(
      `SELECT indexdef FROM pg_indexes
        WHERE schemaname = 'motor' AND tablename = 'TramoParametro'`,
    );
    const definiciones = rows.map((r) => r.indexdef);
    expect(definiciones.some((d) => d.includes('USING gist'))).toBe(true);
    expect(
      definiciones.filter((d) => d.includes('USING btree') && d.includes('vigencia')),
      'apareció un btree sobre vigencia que el modelo de datos no documenta',
    ).toHaveLength(0);
  });

  it('el índice de la cola de pendientes (Q-09) es parcial, no total', async () => {
    const { rows } = await cliente.query<{ indexdef: string }>(
      `SELECT indexdef FROM pg_indexes
        WHERE schemaname = 'motor' AND indexname = 'idx_tramo_sin_ratificar'`,
    );
    expect(rows, 'falta idx_tramo_sin_ratificar').toHaveLength(1);
    // Prisma lo crea total y la migración lo reemplaza por el parcial. Si
    // alguien regenera la migración desde el DSL y pierde el reemplazo, el
    // índice sigue existiendo y nadie se entera: por eso se verifica el WHERE.
    expect(rows[0]!.indexdef).toContain('WHERE');
    expect(rows[0]!.indexdef).toContain("'SIN_RATIFICAR'");
    expect(rows[0]!.indexdef).toContain('"retiradoEn" IS NULL');
  });
});

describe.skipIf(HAY_BASE)('Bloque A — TramoParametro: vigencias', () => {
  it.skip(`omitido — ${MOTIVO_OMISION}`, () => {});
});
