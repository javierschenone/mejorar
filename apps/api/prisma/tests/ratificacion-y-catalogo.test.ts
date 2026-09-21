/**
 * R-1 y R-2 — CA-47, CA-58, condiciones C-02 y C-03.
 *
 * Lo que se prueba acá es la afirmación más fuerte de `modelo-datos.md` §7.1:
 * que **no existe ninguna secuencia de sentencias SQL** que ponga un parámetro
 * sin ratificar dentro de un catálogo apto para producción. No "el servicio lo
 * valida": la base lo hace imposible, y no hay bandera de configuración que lo
 * anule (C-02).
 *
 * El mecanismo es un trípode y hay que probar las tres patas, porque cada una
 * tapa un agujero de las otras dos:
 *
 *   1. `CHECK (NOT catalogoAptoProduccion OR tramoEstadoRatificacion='RATIFICADO')`
 *      — impide declararlo de frente.
 *   2. Las dos claves foráneas compuestas —contra `(id, estadoRatificacion)` y
 *      contra `(version, aptoProduccion)`— impiden **mentir** en las réplicas.
 *   3. El `ON UPDATE RESTRICT` de esas claves impide el camino tardío: entrar
 *      con todo en orden y después degradar el tramo o levantar la bandera del
 *      catálogo.
 *
 * Nota sobre el encargo: el modelo no tiene una columna
 * `requiereValidacionProfesional`. La decisión de G2 fue más estricta —**todo**
 * `TramoParametro` nace `SIN_RATIFICAR` (R-1) y ninguno llega a producción sin
 * firma—, así que el equivalente de "parámetro que requiere validación sin
 * ratificación asociada" es, sencillamente, cualquier tramo sin ratificar.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
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
  sembrarCatalogo,
  sembrarParametro,
  sembrarRatificacion,
  sentenciaTramo,
  SQL_INSERTAR_CATALOGO_TRAMO,
} from './ayuda/datos.js';

describe.skipIf(!HAY_BASE)('Bloque A — ratificación y catálogo (R-1, R-2, CA-47, CA-58)', () => {
  let base: BaseDePrueba;
  let cliente: Client;

  beforeAll(async () => {
    base = await crearBaseConMigraciones('ratif');
    cliente = base.cliente;
    await sembrarParametro(cliente, CLAVE_PRESCRIPCION);
  });

  afterAll(async () => {
    await base?.destruir();
  });

  // ══ R-1: no hay "ratificado" sin quién ratificó ════════════════════════════

  it('un tramo nace SIN_RATIFICAR aunque nadie lo pida (C-03)', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const id = await insertarTramo(cliente, { clave: CLAVE_PRESCRIPCION, hasta: null });
      const { rows } = await cliente.query<{ estado: string; ratificacionId: string | null }>(
        `SELECT "estadoRatificacion" AS estado, "ratificacionId"
           FROM motor."TramoParametro" WHERE id = $1::uuid`,
        [id],
      );
      expect(rows[0]!.estado).toBe('SIN_RATIFICAR');
      expect(rows[0]!.ratificacionId).toBeNull();
    });
  });

  it('rechaza marcar RATIFICADO sin apuntar a una ratificación', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const { sql, parametros } = sentenciaTramo({
        clave: CLAVE_PRESCRIPCION,
        hasta: null,
        estadoRatificacion: 'RATIFICADO',
        ratificacionId: null,
      });
      const rechazo = await debeRechazar(cliente, sql, parametros);
      expect(rechazo.codigo).toBe(ERROR.RESTRICCION_CHECK);
      expect(rechazo.restriccion).toBe('ck_tramo_ratificado_exige_ratificacion');
    });
  });

  it('rechaza también el camino tardío: UPDATE a RATIFICADO sin ratificación', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const id = await insertarTramo(cliente, { clave: CLAVE_PRESCRIPCION, hasta: null });
      const rechazo = await debeRechazar(
        cliente,
        `UPDATE motor."TramoParametro" SET "estadoRatificacion" = 'RATIFICADO' WHERE id = $1::uuid`,
        [id],
      );
      expect(rechazo.codigo).toBe(ERROR.RESTRICCION_CHECK);
      expect(rechazo.restriccion).toBe('ck_tramo_ratificado_exige_ratificacion');
    });
  });

  it('rechaza el reverso: apuntar a una ratificación y quedar SIN_RATIFICAR', async () => {
    // La restricción es una equivalencia, no una implicación. Si fuera sólo
    // implicación, un tramo podría exhibir la firma de un profesional sin
    // estar ratificado, que es exactamente la ambigüedad que C-03 evita.
    await enTransaccionRevertida(cliente, async () => {
      const { ratificacionId } = await sembrarRatificacion(cliente);
      const { sql, parametros } = sentenciaTramo({
        clave: CLAVE_PRESCRIPCION,
        hasta: null,
        estadoRatificacion: 'SIN_RATIFICAR',
        ratificacionId,
      });
      const rechazo = await debeRechazar(cliente, sql, parametros);
      expect(rechazo.codigo).toBe(ERROR.RESTRICCION_CHECK);
      expect(rechazo.restriccion).toBe('ck_tramo_ratificado_exige_ratificacion');
    });
  });

  it('rechaza una ratificación con matrícula vacía o en blanco (CA-47)', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const { idProfesional } = await sembrarRatificacion(cliente);
      for (const matricula of ['', '   ']) {
        const rechazo = await debeRechazar(
          cliente,
          `INSERT INTO motor."Ratificacion"
             (id, "idProfesional", matricula, "jurisdiccionMatricula", "nombreProfesional",
              fecha, "referenciaDocumentoFirmado", "huellaDocumento", "alcanceDeclarado")
           VALUES ($1::uuid, $2, $3, 'CABA', 'Profesional de Prueba',
                   DATE '2026-01-15', 'almacen://x.pdf', repeat('a', 64), 'alcance')`,
          [randomUUID(), idProfesional, matricula],
        );
        expect(rechazo.codigo).toBe(ERROR.RESTRICCION_CHECK);
        expect(rechazo.restriccion).toBe('ck_ratificacion_matricula_no_vacia');
      }
    });
  });

  it('rechaza una ratificación de alguien sin matrícula registrada (CA-47)', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const rechazo = await debeRechazar(
        cliente,
        `INSERT INTO motor."Ratificacion"
           (id, "idProfesional", matricula, "jurisdiccionMatricula", "nombreProfesional",
            fecha, "referenciaDocumentoFirmado", "huellaDocumento", "alcanceDeclarado")
         VALUES ($1::uuid, 'prof_que_no_existe', 'T999 F1', 'CABA', 'Nadie',
                 DATE '2026-01-15', 'almacen://x.pdf', repeat('a', 64), 'alcance')`,
        [randomUUID()],
      );
      expect(rechazo.codigo).toBe(ERROR.CLAVE_FORANEA);
    });
  });

  it('rechaza ratificar un parámetro que todavía no está determinado', async () => {
    // Invariante 4 de A.2: los marcadores [D] y [!] del dictamen son estados de
    // primera clase, y lo que no está determinado no puede figurar firmado.
    await enTransaccionRevertida(cliente, async () => {
      const { ratificacionId } = await sembrarRatificacion(cliente);
      for (const disponibilidad of ['A_DETERMINAR_POR_EL_ESTUDIO', 'CONTRADICCION_ABIERTA']) {
        const { sql, parametros } = sentenciaTramo({
          clave: CLAVE_PRESCRIPCION,
          hasta: null,
          disponibilidad,
          valor: undefined,
          estadoRatificacion: 'RATIFICADO',
          ratificacionId,
        });
        const rechazo = await debeRechazar(cliente, sql, parametros);
        expect(rechazo.codigo).toBe(ERROR.RESTRICCION_CHECK);
        expect(rechazo.restriccion).toBe('ck_tramo_sin_dato_no_ratificable');
      }
    });
  });

  it('rechaza un tramo CARGADO sin valor y uno no CARGADO con valor', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const sinValor = sentenciaTramo({
        clave: CLAVE_PRESCRIPCION,
        hasta: null,
        disponibilidad: 'CARGADO',
        valor: null,
      });
      expect((await debeRechazar(cliente, sinValor.sql, sinValor.parametros)).restriccion).toBe(
        'ck_tramo_valor_presente_si_cargado',
      );

      const conValor = sentenciaTramo({
        clave: CLAVE_PRESCRIPCION,
        hasta: null,
        disponibilidad: 'CONTRADICCION_ABIERTA',
        valor: 5,
      });
      expect((await debeRechazar(cliente, conValor.sql, conValor.parametros)).restriccion).toBe(
        'ck_tramo_valor_nulo_si_no_cargado',
      );
    });
  });

  /**
   * HALLAZGO ABIERTO — escalado al orquestador, no resuelto acá.
   *
   * `ck_tramo_valor_presente_si_cargado` verifica `valor IS NOT NULL`, y en
   * JSONB el valor `null` de JSON **no es** SQL NULL: `'null'::jsonb IS NOT
   * NULL` da verdadero. O sea que hoy se puede insertar un tramo `CARGADO`
   * cuyo valor es el JSON `null`, que es un parámetro sin valor disfrazado de
   * parámetro con valor. No es hipotético: `Prisma.JsonNull` produce
   * exactamente eso.
   *
   * No lo arreglo por cuenta propia: `modelo-datos.md` A.2 invariante 3 está
   * aprobado en G2 y la migración 0002 está commiteada. El arreglo es una línea
   * (`AND jsonb_typeof("valor") <> 'null'`) y corresponde decidirlo en la
   * compuerta que corresponda, con su migración 0011.
   *
   * `it.fails` deja el hueco anotado y armado: **el día que se corrija el
   * CHECK, este test empieza a fallar** —porque va a pasar— y obliga a
   * convertirlo en un `it` normal. Un `skip` se olvidaría.
   */
  it.fails(
    'PENDIENTE — debería rechazar un tramo CARGADO cuyo valor es el JSON `null`',
    async () => {
      await enTransaccionRevertida(cliente, async () => {
        const { sql, parametros } = sentenciaTramo({
          clave: CLAVE_PRESCRIPCION,
          hasta: null,
          disponibilidad: 'CARGADO',
          valorJsonCrudo: 'null',
        });
        const rechazo = await debeRechazar(cliente, sql, parametros);
        expect(rechazo.restriccion).toBe('ck_tramo_valor_presente_si_cargado');
      });
    },
  );

  // ══ R-2 / CA-58: el bloqueo no anulable ════════════════════════════════════

  it('CA-58 — rechaza declarar de frente un tramo SIN_RATIFICAR en un catálogo apto para producción', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const tramoId = await insertarTramo(cliente, { clave: CLAVE_PRESCRIPCION, hasta: null });
      const version = await sembrarCatalogo(cliente, { aptoProduccion: true, estado: 'PUBLICADO' });

      const rechazo = await debeRechazar(cliente, SQL_INSERTAR_CATALOGO_TRAMO, [
        version,
        true,
        tramoId,
        'SIN_RATIFICAR',
      ]);
      expect(rechazo.codigo).toBe(ERROR.RESTRICCION_CHECK);
      expect(rechazo.restriccion).toBe('ck_catalogotramo_apto_exige_ratificado');
    });
  });

  it('CA-58 — rechaza mentir sobre el estado del tramo para esquivar el CHECK', async () => {
    // El agujero obvio del CHECK anterior: declarar 'RATIFICADO' en la réplica
    // aunque el tramo esté sin ratificar. Lo cierra la clave foránea compuesta
    // contra (id, estadoRatificacion) — y ésta es la razón de ser del UNIQUE
    // "que no aporta unicidad" de A.2 invariante 5.
    await enTransaccionRevertida(cliente, async () => {
      const tramoId = await insertarTramo(cliente, { clave: CLAVE_PRESCRIPCION, hasta: null });
      const version = await sembrarCatalogo(cliente, { aptoProduccion: true, estado: 'PUBLICADO' });

      const rechazo = await debeRechazar(cliente, SQL_INSERTAR_CATALOGO_TRAMO, [
        version,
        true,
        tramoId,
        'RATIFICADO', // mentira: el tramo está SIN_RATIFICAR
      ]);
      expect(rechazo.codigo).toBe(ERROR.CLAVE_FORANEA);
      expect(rechazo.restriccion).toBe('fk_catalogotramo_tramo');
    });
  });

  it('CA-58 — rechaza mentir sobre la aptitud del catálogo', async () => {
    // El agujero simétrico: declarar `catalogoAptoProduccion = false` en la
    // fila de pertenencia mientras el catálogo es apto. Lo cierra la otra clave
    // foránea compuesta, contra (version, aptoProduccion).
    await enTransaccionRevertida(cliente, async () => {
      const tramoId = await insertarTramo(cliente, { clave: CLAVE_PRESCRIPCION, hasta: null });
      const version = await sembrarCatalogo(cliente, { aptoProduccion: true, estado: 'PUBLICADO' });

      const rechazo = await debeRechazar(cliente, SQL_INSERTAR_CATALOGO_TRAMO, [
        version,
        false, // mentira: el catálogo es apto
        tramoId,
        'SIN_RATIFICAR',
      ]);
      expect(rechazo.codigo).toBe(ERROR.CLAVE_FORANEA);
      expect(rechazo.restriccion).toBe('fk_catalogotramo_catalogo');
    });
  });

  it('CA-58 — rechaza el camino tardío: levantar aptoProduccion en un catálogo que ya tiene tramos sin ratificar', async () => {
    // Éste es el que más importa en la práctica. Armar el catálogo en borrador
    // con lo que haya y después "activarlo" es exactamente lo que haría un
    // operador apurado un viernes a la tarde.
    await enTransaccionRevertida(cliente, async () => {
      const tramoId = await insertarTramo(cliente, { clave: CLAVE_PRESCRIPCION, hasta: null });
      const version = await sembrarCatalogo(cliente, { aptoProduccion: false });
      await debeAceptar(cliente, SQL_INSERTAR_CATALOGO_TRAMO, [
        version,
        false,
        tramoId,
        'SIN_RATIFICAR',
      ]);

      const rechazo = await debeRechazar(
        cliente,
        `UPDATE motor."CatalogoNormativo" SET "aptoProduccion" = true WHERE version = $1`,
        [version],
      );
      // `ON UPDATE RESTRICT` no hace cascada ni deja la réplica desincronizada:
      // rechaza el UPDATE de raíz.
      expect([ERROR.RESTRICT, ERROR.CLAVE_FORANEA]).toContain(rechazo.codigo);
      expect(rechazo.restriccion).toBe('fk_catalogotramo_catalogo');
    });
  });

  it('CA-58 — rechaza degradar la ratificación de un tramo ya incluido en un catálogo apto (R-12)', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const { ratificacionId } = await sembrarRatificacion(cliente);
      const tramoId = await insertarTramo(cliente, {
        clave: CLAVE_PRESCRIPCION,
        hasta: null,
        estadoRatificacion: 'RATIFICADO',
        ratificacionId,
      });
      const version = await sembrarCatalogo(cliente, { aptoProduccion: true, estado: 'PUBLICADO' });
      await debeAceptar(cliente, SQL_INSERTAR_CATALOGO_TRAMO, [
        version,
        true,
        tramoId,
        'RATIFICADO',
      ]);

      const rechazo = await debeRechazar(
        cliente,
        `UPDATE motor."TramoParametro"
            SET "estadoRatificacion" = 'SIN_RATIFICAR', "ratificacionId" = NULL
          WHERE id = $1::uuid`,
        [tramoId],
      );
      expect([ERROR.RESTRICT, ERROR.CLAVE_FORANEA]).toContain(rechazo.codigo);
      expect(rechazo.restriccion).toBe('fk_catalogotramo_tramo');
    });
  });

  it('CA-58 — rechaza borrar el tramo o la ratificación de los que cuelga un catálogo', async () => {
    // Nada se borra (regla 3 del mandato). Que además sea imposible es lo que
    // sostiene CA-31: un resultado de junio se reproduce con el catálogo de junio.
    await enTransaccionRevertida(cliente, async () => {
      const { ratificacionId } = await sembrarRatificacion(cliente);
      const tramoId = await insertarTramo(cliente, {
        clave: CLAVE_PRESCRIPCION,
        hasta: null,
        estadoRatificacion: 'RATIFICADO',
        ratificacionId,
      });
      const version = await sembrarCatalogo(cliente, { aptoProduccion: true, estado: 'PUBLICADO' });
      await debeAceptar(cliente, SQL_INSERTAR_CATALOGO_TRAMO, [
        version,
        true,
        tramoId,
        'RATIFICADO',
      ]);

      expect(
        (
          await debeRechazar(cliente, `DELETE FROM motor."TramoParametro" WHERE id = $1::uuid`, [
            tramoId,
          ])
        ).codigo,
      ).toBe(ERROR.CLAVE_FORANEA);

      expect(
        (
          await debeRechazar(cliente, `DELETE FROM motor."Ratificacion" WHERE id = $1::uuid`, [
            ratificacionId,
          ])
        ).codigo,
      ).toBe(ERROR.CLAVE_FORANEA);
    });
  });

  it('el camino legítimo completo funciona: matrícula → ratificación → tramo → catálogo apto', async () => {
    // Un test que sólo prohíbe cosas puede estar prohibiéndolas todas. Éste
    // demuestra que el modelo deja pasar el flujo real de C-03.
    await enTransaccionRevertida(cliente, async () => {
      const { ratificacionId } = await sembrarRatificacion(cliente);
      const tramoId = await insertarTramo(cliente, {
        clave: CLAVE_PRESCRIPCION,
        hasta: null,
        estadoRatificacion: 'RATIFICADO',
        ratificacionId,
      });
      const version = await sembrarCatalogo(cliente, { aptoProduccion: true, estado: 'PUBLICADO' });
      await debeAceptar(cliente, SQL_INSERTAR_CATALOGO_TRAMO, [
        version,
        true,
        tramoId,
        'RATIFICADO',
      ]);

      const { rows } = await cliente.query<{ n: string }>(
        `SELECT count(*)::text AS n
           FROM motor."CatalogoTramo" ct
           JOIN motor."CatalogoNormativo" c ON c.version = ct."catalogoVersion"
          WHERE c."aptoProduccion" AND ct."catalogoVersion" = $1`,
        [version],
      );
      expect(rows[0]!.n).toBe('1');
    });
  });

  it('revocar una ratificación no cambia el pasado: el catálogo publicado sigue en pie (A.4 invariante 2)', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const { ratificacionId } = await sembrarRatificacion(cliente);
      const tramoId = await insertarTramo(cliente, {
        clave: CLAVE_PRESCRIPCION,
        hasta: null,
        estadoRatificacion: 'RATIFICADO',
        ratificacionId,
      });
      const version = await sembrarCatalogo(cliente, { aptoProduccion: true, estado: 'PUBLICADO' });
      await debeAceptar(cliente, SQL_INSERTAR_CATALOGO_TRAMO, [
        version,
        true,
        tramoId,
        'RATIFICADO',
      ]);

      // Revocación: fecha y motivo juntos, y baja lógica del tramo.
      await debeAceptar(
        cliente,
        `UPDATE motor."Ratificacion"
            SET "revocadaEn" = now(), "motivoRevocacion" = 'CAMBIO_NORMATIVO'
          WHERE id = $1::uuid`,
        [ratificacionId],
      );
      await debeAceptar(
        cliente,
        `UPDATE motor."TramoParametro" SET "retiradoEn" = now() WHERE id = $1::uuid`,
        [tramoId],
      );

      const { rows } = await cliente.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM motor."CatalogoTramo" WHERE "catalogoVersion" = $1`,
        [version],
      );
      expect(rows[0]!.n, 'la revocación no debe vaciar un catálogo ya publicado').toBe('1');
    });
  });

  it('rechaza una revocación a medias (fecha sin motivo, o motivo sin fecha)', async () => {
    await enTransaccionRevertida(cliente, async () => {
      const { ratificacionId } = await sembrarRatificacion(cliente);
      for (const set of [
        `"revocadaEn" = now()`,
        `"motivoRevocacion" = 'ERROR_DETECTADO'`,
      ]) {
        const rechazo = await debeRechazar(
          cliente,
          `UPDATE motor."Ratificacion" SET ${set} WHERE id = $1::uuid`,
          [ratificacionId],
        );
        expect(rechazo.restriccion).toBe('ck_ratificacion_revocacion_coherente');
      }
    });
  });

  it('rechaza dos matrículas iguales en la misma jurisdicción', async () => {
    await enTransaccionRevertida(cliente, async () => {
      await sembrarRatificacion(cliente, { idProfesional: 'prof_a', matricula: 'T100 F55' });
      const rechazo = await debeRechazar(
        cliente,
        `INSERT INTO motor."MatriculaProfesional"
           ("idProfesional", matricula, colegio, jurisdiccion, estado, "vigenciaDesde")
         VALUES ('prof_b', 'T100 F55', 'Otro colegio', 'CABA', 'VIGENTE', DATE '2021-01-01')`,
      );
      expect(rechazo.codigo).toBe(ERROR.UNICIDAD);
      expect(rechazo.restriccion).toBe('uq_matricula_jurisdiccion');
    });
  });

  it('el CHECK de CA-58 y las dos claves foráneas compuestas están declarados en la base', async () => {
    // Verificación estructural, no de comportamiento: si alguien regenera la
    // migración desde el DSL de Prisma, el SQL crudo se pierde en silencio y
    // los tests de arriba pasarían a probar un esquema que ya no es el aprobado.
    const { rows } = await cliente.query<{ conname: string; definicion: string }>(
      `SELECT c.conname, pg_get_constraintdef(c.oid) AS definicion
         FROM pg_constraint c
         JOIN pg_class t ON t.oid = c.conrelid
         JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'motor' AND t.relname = 'CatalogoTramo'`,
    );
    const porNombre = new Map(rows.map((r) => [r.conname, r.definicion]));

    expect(porNombre.has('ck_catalogotramo_apto_exige_ratificado')).toBe(true);

    const fkTramo = porNombre.get('fk_catalogotramo_tramo');
    expect(fkTramo, 'falta fk_catalogotramo_tramo (R-2)').toBeDefined();
    expect(fkTramo).toContain('"tramoId", "tramoEstadoRatificacion"');
    expect(fkTramo).toContain('ON UPDATE RESTRICT');

    const fkCatalogo = porNombre.get('fk_catalogotramo_catalogo');
    expect(fkCatalogo, 'falta fk_catalogotramo_catalogo (R-2)').toBeDefined();
    expect(fkCatalogo).toContain('"catalogoVersion", "catalogoAptoProduccion"');
    expect(fkCatalogo).toContain('ON UPDATE RESTRICT');
  });

  it('no existe ninguna bandera de configuración de la base que apague el bloqueo (C-02)', async () => {
    // C-02 dice "sin bandera de configuración que lo anule". En PostgreSQL la
    // vía sería declarar las restricciones NOT VALID o DEFERRABLE y diferirlas.
    // Ninguna del Bloque A lo es, y este test lo fija.
    const { rows } = await cliente.query<{ conname: string }>(
      `SELECT c.conname
         FROM pg_constraint c
         JOIN pg_namespace n ON n.oid = c.connamespace
        WHERE n.nspname = 'motor'
          AND (NOT c.convalidated OR c.condeferrable)`,
    );
    expect(
      rows.map((r) => r.conname),
      'hay restricciones NOT VALID o DEFERRABLE en el esquema motor: se pueden esquivar',
    ).toEqual([]);
  });
});

describe.skipIf(HAY_BASE)('Bloque A — ratificación y catálogo', () => {
  it.skip(`omitido — ${MOTIVO_OMISION}`, () => {});
});
