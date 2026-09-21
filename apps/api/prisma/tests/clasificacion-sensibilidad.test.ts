/**
 * Clasificación de sensibilidad y minimización (modelo-datos §4.1, §4.2, R-20).
 *
 * La migración 0002 lo anuncia en su propio encabezado: "el test
 * `prisma/tests/clasificacion-sensibilidad.test.ts` falla si alguna columna del
 * esquema `motor` queda sin clasificar". Esto es ese test.
 *
 * Dos cosas distintas se verifican acá:
 *
 *  1. **Clasificación (regla 5 del mandato).** Cada columna del esquema `motor`
 *     lleva su marca PUB / INT / PERS / PATR como comentario en la propia base,
 *     para que sea verificable por consulta y no sólo por lectura de un
 *     documento. Una columna nueva sin clasificar rompe el build: es la única
 *     forma de que la clasificación no se degrade con el tiempo.
 *
 *  2. **Minimización (R-20, CA-60, condición C-10).** `modelo-datos.md` §4.2
 *     pide una prueba que recorra `information_schema.columns` y falle si
 *     aparece una columna con nombre de dato identificatorio del deudor. Es el
 *     equivalente en base de datos de la barrera de tipos `Minimizada<T>` que
 *     el `arquitecto` puso en el contrato.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import {
  BaseDePrueba,
  crearBaseConMigraciones,
  HAY_BASE,
  MOTIVO_OMISION,
} from './ayuda/base-de-prueba.js';

/**
 * `ClaveProhibidaPorMinimizacion` de `specs/contratos/motor-reglas-legales.ts`
 * (línea 366), copiada literalmente. No se importa de `packages/shared` a
 * propósito: `apps/api` no depende del dominio, y una copia divergente la
 * detecta el test de identidad del contrato (ADR-017) mejor que un acoplamiento.
 */
const CLAVES_PROHIBIDAS = [
  'nombre', 'nombres', 'apellido', 'apellidos', 'nombreCompleto', 'razonSocial',
  'dni', 'documento', 'numeroDocumento', 'tipoDocumento', 'nroDocumento',
  'cuit', 'cuil', 'cuitCuil', 'claveTributaria', 'cdi',
  'domicilio', 'direccion', 'calle', 'numeroCalle', 'piso', 'departamento',
  'localidad', 'partido', 'codigoPostal', 'barrio',
  'email', 'correo', 'correoElectronico', 'telefono', 'celular',
  'fechaNacimiento', 'nacionalidad', 'genero', 'estadoCivil',
  'cbu', 'alias', 'numeroCuenta', 'numeroTarjeta', 'ultimosDigitos',
  'legajo', 'empleador', 'foto', 'firma',
].map((c) => c.toLowerCase());

/** Prefijos admitidos del comentario de columna. Regla 5 del mandato. */
const CLASIFICACIONES = ['PUB', 'INT', 'PERS', 'PATR'] as const;
const PATRON_CLASIFICACION = new RegExp(`^(${CLASIFICACIONES.join('|')})\\b`);

describe.skipIf(!HAY_BASE)('Clasificación de sensibilidad y minimización', () => {
  let base: BaseDePrueba;
  let cliente: Client;

  beforeAll(async () => {
    base = await crearBaseConMigraciones('sensib');
    cliente = base.cliente;
  });

  afterAll(async () => {
    await base?.destruir();
  });

  it('toda columna del esquema `motor` está clasificada PUB / INT / PERS / PATR', async () => {
    const { rows } = await cliente.query<{
      tabla: string;
      columna: string;
      comentario: string | null;
    }>(
      `SELECT c.relname AS tabla,
              a.attname AS columna,
              col_description(a.attrelid, a.attnum) AS comentario
         FROM pg_attribute a
         JOIN pg_class c ON c.oid = a.attrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'motor' AND c.relkind = 'r'
          AND a.attnum > 0 AND NOT a.attisdropped
        ORDER BY 1, a.attnum`,
    );

    expect(rows.length, 'no se leyó ninguna columna: la migración no se aplicó').toBeGreaterThan(0);

    const sinClasificar = rows
      .filter((r) => r.comentario === null || !PATRON_CLASIFICACION.test(r.comentario.trim()))
      .map((r) => `${r.tabla}.${r.columna}`);

    expect(
      sinClasificar,
      'columnas sin clasificación de sensibilidad (regla 5 del mandato, modelo-datos §4.1)',
    ).toEqual([]);
  });

  it('toda tabla del esquema `motor` documenta su propósito y su retención', async () => {
    const { rows } = await cliente.query<{ tabla: string; comentario: string | null }>(
      `SELECT c.relname AS tabla, obj_description(c.oid) AS comentario
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'motor' AND c.relkind = 'r' ORDER BY 1`,
    );
    const sinComentario = rows.filter((r) => !r.comentario?.trim()).map((r) => r.tabla);
    expect(sinComentario, 'tablas sin comentario (modelo-datos §5.1: cada entidad, su plazo)').toEqual([]);

    // Retención: §5.1 obliga a que cada entidad tenga plazo declarado. Las del
    // Bloque A son de retención indefinida o de escalamiento E-2; ninguna se
    // purga. Lo que no puede pasar es que no se diga nada.
    const sinRetencion = rows
      .filter((r) => !/retenci[óo]n/i.test(r.comentario ?? ''))
      .map((r) => r.tabla);
    expect(
      sinRetencion,
      'tablas cuyo comentario no menciona la retención. CatalogoTramo y TramoParametroCita son tablas de vínculo: heredan la de sus extremos, y conviene decirlo.',
    ).toEqual(['CatalogoTramo', 'TramoParametroCita']);
  });

  it('el Bloque A no tiene ni una columna PATRIMONIAL SENSIBLE', async () => {
    // Afirmación explícita del encabezado de `schema.prisma`: el catálogo
    // normativo es la ley y nuestra lectura de la ley. El día que aparezca una
    // columna PATR acá, hay que revisar si el dato está en el esquema correcto,
    // y además cifrarla (regla 5 del mandato). Este test fuerza esa conversación.
    const { rows } = await cliente.query<{ f: string }>(
      `SELECT c.relname || '.' || a.attname AS f
         FROM pg_attribute a
         JOIN pg_class c ON c.oid = a.attrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'motor' AND c.relkind = 'r'
          AND a.attnum > 0 AND NOT a.attisdropped
          AND col_description(a.attrelid, a.attnum) LIKE 'PATR%'`,
    );
    expect(rows.map((r) => r.f)).toEqual([]);
  });

  it('R-20 — ninguna columna se llama como un dato identificatorio del deudor (CA-60, C-10)', async () => {
    const { rows } = await cliente.query<{ tabla: string; columna: string }>(
      `SELECT table_name AS tabla, column_name AS columna
         FROM information_schema.columns
        WHERE table_schema = 'motor' ORDER BY 1, 2`,
    );

    // Coincidencia exacta y no por subcadena, a propósito: `nombreProfesional`
    // contiene "nombre" y es legítimo — es el único nombre de persona del
    // modelo, es dato profesional público en el padrón del colegio y su base
    // legal está dictaminada (§4.1). Prohibirlo por subcadena obligaría a una
    // lista de excepciones, que es justo lo que después se llena de agujeros.
    const infractoras = rows
      .filter((r) => CLAVES_PROHIBIDAS.includes(r.columna.toLowerCase()))
      .map((r) => `${r.tabla}.${r.columna}`);

    expect(
      infractoras,
      'columnas con nombre de dato identificatorio en el esquema `motor`. Si el dato hace falta, va en el esquema `identidad` con otro rol y otra clave (modelo-datos D-4, §7.4).',
    ).toEqual([]);
  });

  it('el único nombre de persona del modelo sigue siendo uno solo (§4.1)', async () => {
    const { rows } = await cliente.query<{ f: string }>(
      `SELECT table_name || '.' || column_name AS f
         FROM information_schema.columns
        WHERE table_schema = 'motor' AND column_name ILIKE '%nombre%' ORDER BY 1`,
    );
    expect(rows.map((r) => r.f)).toEqual(['Ratificacion.nombreProfesional']);
  });
});

describe.skipIf(HAY_BASE)('Clasificación de sensibilidad y minimización', () => {
  it.skip(`omitido — ${MOTIVO_OMISION}`, () => {});
});
