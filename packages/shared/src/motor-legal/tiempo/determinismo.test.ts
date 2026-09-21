/**
 * CA-31 / ADR-016 — el motor es determinista: no lee el reloj, ni el entorno,
 * ni el azar, ni la red, ni el disco.
 *
 * Dos controles distintos, porque CA-31 tiene dos mitades:
 *
 * 1. **Estructural**: este test recorre el código fuente de `packages/shared`
 *    —todo lo que no es test— y falla si aparece cualquier fuente de
 *    indeterminismo. Es el test que el encabezado de `fecha-civil.ts` promete.
 *    El pipeline agrega una regla de lint equivalente (T-14); tener el control
 *    también acá hace que la suite local lo detecte sin depender del pipeline.
 * 2. **De comportamiento**: la misma entrada, evaluada dos veces con la misma
 *    fecha de evaluación, produce un resultado idéntico; y cambiar la fecha de
 *    evaluación es la **única** forma de que el resultado cambie con el tiempo.
 *
 * Por qué importa: si el motor leyera el reloj, el mismo caso evaluado hoy y
 * mañana daría distinto sin que nadie haya cambiado un dato, y no se podría
 * reproducir qué dijo el sistema en una fecha pasada — que es exactamente lo
 * que hay que poder probar en un expediente.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import type { Racional } from '../contrato/v1';
import { redondear } from '../dinero/redondeo';
import {
  comoFechaCivil,
  comoFechaDeEvaluacion,
  comoFechaDelHecho,
  diasEntre,
  estaVigenteA,
  sumarAnios,
} from './fecha-civil';

const aquí = dirname(fileURLToPath(import.meta.url));
const RAIZ_FUENTE = resolve(aquí, '../..'); // packages/shared/src

/**
 * Fuentes de indeterminismo prohibidas en el dominio, con el motivo que se
 * imprime cuando alguna aparece. La lista es de coincidencia literal sobre el
 * código ya despojado de comentarios.
 */
const FUENTES_PROHIBIDAS: ReadonlyArray<{ patron: RegExp; motivo: string }> = [
  { patron: /new\s+Date\b/, motivo: 'lee el reloj del proceso (ADR-016)' },
  { patron: /\bDate\s*\.\s*(now|parse|UTC)\b/, motivo: 'lee o interpreta el reloj (ADR-016)' },
  { patron: /\bperformance\s*\.\s*now\b/, motivo: 'lee el reloj de alta resolución' },
  { patron: /\bMath\s*\.\s*random\b/, motivo: 'introduce azar: el resultado deja de ser reproducible' },
  { patron: /\bcrypto\s*\.\s*(randomUUID|randomBytes|getRandomValues)\b/, motivo: 'introduce azar' },
  { patron: /\bprocess\s*\.\s*(env|hrtime|argv|cwd)\b/, motivo: 'lee el entorno del proceso' },
  { patron: /\bsetTimeout\b|\bsetInterval\b/, motivo: 'introduce tiempo real en un cálculo puro' },
  { patron: /\bfetch\s*\(/, motivo: 'red: el dominio no hace E/S' },
  { patron: /\brequire\s*\(/, motivo: 'carga dinámica: el dominio no hace E/S' },
  { patron: /from\s+['"]node:/, motivo: 'módulo de plataforma: el dominio no hace E/S' },
  { patron: /\bIntl\s*\./, motivo: 'depende de la configuración regional y de la zona horaria' },
  { patron: /\btoLocale(Date|Time)?String\b/, motivo: 'depende de la configuración regional' },
];

/**
 * Quita comentarios de bloque y líneas de comentario completas. Es necesario
 * porque varios encabezados de este paquete **nombran** las llamadas prohibidas
 * para explicar por qué no se usan.
 *
 * Deliberadamente conservador: sólo borra `/* … *\/` y las líneas cuyo primer
 * carácter no blanco es `//`. No intenta entender literales de cadena ni
 * expresiones regulares, así que ante la duda deja el texto — que es el lado
 * seguro: como mucho produce un falso positivo, nunca un falso negativo.
 */
function sinComentarios(codigo: string): string {
  return codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
}

function archivosDeFuente(directorio: string): string[] {
  const encontrados: string[] = [];
  for (const entrada of readdirSync(directorio, { withFileTypes: true })) {
    const ruta = join(directorio, entrada.name);
    if (entrada.isDirectory()) {
      encontrados.push(...archivosDeFuente(ruta));
      continue;
    }
    if (entrada.name.endsWith('.ts') && !entrada.name.endsWith('.test.ts')) {
      encontrados.push(ruta);
    }
  }
  return encontrados.sort();
}

describe('CA-31 (estructural) — en `packages/shared` no hay ninguna lectura del reloj', () => {
  const archivos = archivosDeFuente(RAIZ_FUENTE);

  it('encuentra código fuente para revisar (si no, el control no existe)', () => {
    expect(archivos.length).toBeGreaterThan(5);
  });

  it('ningún archivo de dominio usa el reloj, el azar, el entorno ni E/S', () => {
    const infracciones: string[] = [];
    for (const ruta of archivos) {
      const codigo = sinComentarios(readFileSync(ruta, 'utf8'));
      for (const { patron, motivo } of FUENTES_PROHIBIDAS) {
        if (patron.test(codigo)) {
          infracciones.push(`${relative(RAIZ_FUENTE, ruta)}: ${String(patron)} — ${motivo}`);
        }
      }
    }
    expect(
      infracciones,
      [
        'El dominio dejó de ser determinista (CA-31, ADR-016).',
        'La fecha de evaluación entra por parámetro; el reloj se lee en el borde',
        'de la aplicación, una sola vez, y viaja como dato.',
        ...infracciones.map((linea) => `  - ${linea}`),
      ].join('\n'),
    ).toEqual([]);
  });

  it('el propio control funciona: detecta una lectura del reloj inyectada a propósito', () => {
    const codigoConReloj = sinComentarios('const hoy = new Date();\n');
    const detectada = FUENTES_PROHIBIDAS.some(({ patron }) => patron.test(codigoConReloj));
    expect(detectada).toBe(true);
  });

  it('el control no se confunde con un comentario que nombra la llamada prohibida', () => {
    const soloComentario = sinComentarios('/** No se usa `new Date()` acá. */\n// ni Date.now()\nexport const x = 1;\n');
    const detectada = FUENTES_PROHIBIDAS.some(({ patron }) => patron.test(soloComentario));
    expect(detectada).toBe(false);
  });
});

describe('CA-31 (comportamiento) — misma entrada y misma fecha de evaluación, resultado idéntico', () => {
  function fecha(texto: string) {
    const resultado = comoFechaCivil(texto);
    if (!resultado.ok) throw new Error(`fecha de prueba inválida ${texto}`);
    return resultado.valor;
  }

  /**
   * Cálculo compuesto de juguete, con la forma de los que vienen: parte de un
   * hecho, le suma un plazo, mira una vigencia y redondea un importe. Todo lo
   * que necesita entra por parámetro.
   */
  function evaluar(fechaDelHechoTexto: string, fechaDeEvaluacionTexto: string) {
    const hecho = comoFechaDelHecho(fecha(fechaDelHechoTexto));
    const evaluacion = comoFechaDeEvaluacion(fecha(fechaDeEvaluacionTexto));
    const vencimiento = sumarAnios(hecho, 5);
    if (!vencimiento.ok) throw new Error('el plazo de prueba debería ser válido');
    const importe: Racional = { n: 1_234_567n, d: 7n };
    return {
      diasTranscurridos: diasEntre(hecho, evaluacion),
      vencimiento: vencimiento.valor as string,
      yaVencidoALaFechaDeEvaluacion: !estaVigenteA(hecho, vencimiento.valor, evaluacion),
      importe: redondear(importe, 'ARS', 'RECLAMO_ESTIMADO', null),
    };
  }

  it('CA-31: evaluar dos veces la misma entrada con la misma fecha da exactamente lo mismo', () => {
    const primera = evaluar('2020-05-10', '2026-09-21');
    const segunda = evaluar('2020-05-10', '2026-09-21');
    expect(segunda).toEqual(primera);
  });

  it('CA-31: el resultado cambia sólo si cambia una entrada — la fecha de evaluación es una de ellas', () => {
    const alDiaDeHoy = evaluar('2020-05-10', '2025-05-09');
    const unDiaDespues = evaluar('2020-05-10', '2025-05-10');
    expect(alDiaDeHoy.yaVencidoALaFechaDeEvaluacion).toBe(false);
    expect(unDiaDespues.yaVencidoALaFechaDeEvaluacion).toBe(false); // el último día todavía está dentro
    expect(evaluar('2020-05-10', '2025-05-11').yaVencidoALaFechaDeEvaluacion).toBe(true);
    expect(unDiaDespues.diasTranscurridos - alDiaDeHoy.diasTranscurridos).toBe(1);
  });

  it('CA-31: el mismo caso evaluado a una fecha pasada se reproduce igual hoy', () => {
    // Reproducibilidad hacia atrás: lo que el sistema dijo el 2021-01-01 se
    // vuelve a obtener pasándole esa misma fecha de evaluación, sin importar
    // cuándo se corra el test.
    expect(evaluar('2020-05-10', '2021-01-01')).toEqual(evaluar('2020-05-10', '2021-01-01'));
    expect(evaluar('2020-05-10', '2021-01-01').diasTranscurridos).toBe(236);
  });
});
