#!/usr/bin/env node
//
// Benchmark de `argon2id` — T-13 de la feature 002 (ADR-024, plan §6).
//
// A DIFERENCIA DEL BENCHMARK DEL MOTOR (T-14 de la 004), ACÁ EL UMBRAL ROMPE
// LA CONSTRUCCIÓN. No es una métrica de rendimiento: es una política de
// seguridad medible, y por eso tiene dos bordes y los dos importan.
//
//   Rango exigido: mediana del hasheo dentro de [80 ms, 350 ms]
//                  (`specs/002-identidad-y-acceso/plan.md` §6, fila "Costo de
//                  hasheo"; ADR-024 §1, "presupuesto medido, no adivinado").
//
//   Por debajo de 80 ms  → el hash es barato de atacar. Un volcado de la base
//                          se rompe por fuerza bruta fuera de línea a una tasa
//                          que hace inútil el trabajo de haber elegido
//                          `argon2id`. Es una debilidad de seguridad, no una
//                          "optimización": por eso falla igual que lo otro.
//   Por encima de 350 ms → el ingreso se vuelve un amplificador de denegación
//                          de servicio (riesgo R-02: hay que gastar el hasheo
//                          también para cuentas inexistentes, ADR-025) y el
//                          presupuesto de ingreso p95 <= 600 ms del plan §6 ya
//                          no cierra junto con el piso de latencia de 400 ms.
//
// HARDWARE DE REFERENCIA: ejecutor `ubuntu-24.04` alojado por GitHub (4 vCPU,
// 16 GB). El rango está definido para ese hardware. El día que el ejecutor
// cambie, el número cambia **con evidencia**: se corre este benchmark, se
// registra la medición y se actualiza ADR-024 en compuerta. No se toca el
// rango para "que pase el build".
//
// QUÉ SE MIDE: la implementación real del proyecto, no una reimplementación
// del pipeline (regla 1 del mandato: lo que corre en CI es lo que corre en
// producción). Convención acordada con `dev-integraciones` / `dev-backend`:
// el artefacto compilado exporta una de estas dos cosas
//
//     crearServicioDeContrasenas({ pimienta, parametros? })  -> ServicioDeContrasenas
//     servicioDeContrasenasParaBenchmark()                   -> ServicioDeContrasenas
//
// donde `ServicioDeContrasenas` es el del contrato §6 (`hashear`, `verificar`,
// `requiereRehash`, `hashSenuelo`). Mientras no exista ninguna de las dos, el
// benchmark informa qué falta y termina bien: no bloquea a nadie por código
// que todavía no se escribió.
//
// LA PIMIENTA: la genera este proceso con `crypto.randomBytes`, vive en
// memoria y se descarta al terminar. **No hay ningún secreto en el
// repositorio ni en el entorno de CI**: la pimienta real se custodia por
// entorno según `scripts/ci/claves-y-custodia.md`, y una pimienta aleatoria
// mide exactamente lo mismo (el HMAC previo cuesta microsegundos; el costo es
// `argon2id`).

import { existsSync, writeFileSync, appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { cpus, totalmem } from 'node:os';

// Bordes del rango. Se pueden bajar por entorno **sólo** para depurar en una
// máquina distinta; en el pipeline valen los del plan §6 y no se pasan.
const UMBRAL_MIN_MS = Number(process.env.UMBRAL_ARGON2_MIN_MS ?? 80);
const UMBRAL_MAX_MS = Number(process.env.UMBRAL_ARGON2_MAX_MS ?? 350);

// `bloqueante` (predeterminado) rompe la construcción fuera de rango.
// `informativo` existe para una corrida exploratoria en hardware nuevo, con
// `workflow_dispatch`: sirve para *medir* antes de proponer un rango nuevo en
// compuerta, no para saltearse el control en un PR.
const MODO = process.env.MODO_BENCHMARK_ARGON2 ?? 'bloqueante';

// 15 muestras: suficiente para una mediana estable a ~200 ms por muestra
// (≈ 3 s de reloj) y poco sensible al ruido del ejecutor compartido. Se decide
// por **mediana**, no por promedio ni por máximo: en un ejecutor compartido un
// máximo aislado no dice nada de la política de seguridad.
const MUESTRAS = Number(process.env.MUESTRAS_ARGON2 ?? 15);
const CALENTAMIENTO = Number(process.env.CALENTAMIENTO_ARGON2 ?? 3);

const ARCHIVO_SALIDA = process.env.ARCHIVO_SALIDA_ARGON2 ?? 'benchmark-argon2id.json';

// Parámetros que ADR-024 §1 fija y que viajan dentro del hash en formato PHC.
// Se verifican sobre el hash producido: si alguien los baja en el código, el
// tiempo baja y este benchmark lo vería igual, pero el mensaje sería confuso.
// Mejor decirlo con precisión.
const PARAMETROS_ADR_024 = { m: 19456, t: 2, p: 1 };

// Candidatos de artefacto compilado, en orden de preferencia.
const CANDIDATOS = [
  'packages/integrations/dist/identidad/index.js',
  'packages/integrations/dist/index.js',
  'apps/api/dist/identidad/contrasenas/index.js',
];

function resumen(texto) {
  console.log(texto);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${texto}\n`);
  }
}

function pendiente(motivo) {
  console.log(`::notice::Benchmark de argon2id no ejecutado: ${motivo}`);
  resumen('## Benchmark de `argon2id` (ADR-024)');
  resumen('');
  resumen(`Pendiente: ${motivo}`);
  resumen('');
  resumen(
    'En cuanto exista el servicio de contraseñas, este paso pasa a ser **bloqueante** ' +
      `sin tocar el pipeline: el rango exigido es [${UMBRAL_MIN_MS} ms, ${UMBRAL_MAX_MS} ms].`,
  );
  process.exit(0);
}

function percentil(ordenadas, p) {
  const indice = Math.min(ordenadas.length - 1, Math.max(0, Math.ceil(p * ordenadas.length) - 1));
  return ordenadas[indice];
}

function mediana(ordenadas) {
  const mitad = Math.floor(ordenadas.length / 2);
  return ordenadas.length % 2 === 0 ? (ordenadas[mitad - 1] + ordenadas[mitad]) / 2 : ordenadas[mitad];
}

/** Lee los parámetros del hash en formato PHC: `$argon2id$v=19$m=...,t=...,p=...$sal$hash`. */
function parametrosDelHash(hash) {
  if (typeof hash !== 'string' || !hash.startsWith('$argon2id$')) return null;
  const campos = hash.split('$');
  const cuerpo = campos.find((c) => c.startsWith('m='));
  if (!cuerpo) return null;
  const leidos = {};
  for (const par of cuerpo.split(',')) {
    const [clave, valor] = par.split('=');
    leidos[clave] = Number(valor);
  }
  return leidos;
}

async function cargarServicio() {
  const ruta = CANDIDATOS.find((c) => existsSync(resolve(process.cwd(), c)));
  if (!ruta) {
    pendiente(
      `no se encontró el artefacto compilado del servicio de contraseñas (se buscó en ${CANDIDATOS.join(', ')}). ` +
        'Se construye con `pnpm -r run build`.',
    );
  }
  const modulo = await import(pathToFileURL(resolve(process.cwd(), ruta)).href);
  const api = modulo.default && typeof modulo.default === 'object' ? { ...modulo.default, ...modulo } : modulo;

  const fabrica = api.crearServicioDeContrasenas ?? api.servicioDeContrasenasParaBenchmark;
  if (typeof fabrica !== 'function') {
    pendiente(
      `${ruta} no exporta \`crearServicioDeContrasenas({ pimienta })\` ni \`servicioDeContrasenasParaBenchmark()\` ` +
        '(T-02 / T-05 en curso). Es la convención que este benchmark necesita para medir la implementación real ' +
        'en vez de reimplementar `argon2id` en el pipeline.',
    );
  }

  // Pimienta efímera, generada acá y descartada al terminar el proceso.
  const pimienta = randomBytes(32).toString('base64');
  const servicio = await fabrica({ pimienta });

  if (!servicio || typeof servicio.hashear !== 'function') {
    pendiente(`la fábrica exportada por ${ruta} no devolvió un \`ServicioDeContrasenas\` con \`hashear\`.`);
  }
  return { ruta, servicio };
}

const { ruta, servicio } = await cargarServicio();

// Contraseña de prueba: una cadena aleatoria de este proceso. Nunca una
// contraseña real de nadie, nunca un valor fijo que después alguien copie.
const contrasena = `benchmark-${randomBytes(18).toString('base64url')}`;

for (let i = 0; i < CALENTAMIENTO; i += 1) {
  await servicio.hashear(contrasena);
}

const muestras = [];
let ultimoHash = '';
for (let i = 0; i < MUESTRAS; i += 1) {
  const inicio = process.hrtime.bigint();
  ultimoHash = await servicio.hashear(contrasena);
  muestras.push(Number(process.hrtime.bigint() - inicio) / 1e6);
}
muestras.sort((a, b) => a - b);

const medida = {
  medianaMs: mediana(muestras),
  p95Ms: percentil(muestras, 0.95),
  minMs: muestras[0],
  maxMs: muestras[muestras.length - 1],
};

// Verificación extra: el tiempo puede estar en rango con parámetros distintos
// de los de ADR-024 (por ejemplo memoria baja compensada con iteraciones). El
// hash PHC lleva los parámetros adentro, así que se comprueban.
const leidos = parametrosDelHash(ultimoHash);
const parametrosDesviados =
  leidos === null
    ? null
    : Object.entries(PARAMETROS_ADR_024).filter(([clave, valor]) => leidos[clave] !== valor);

const reporte = {
  fechaMedicion: new Date().toISOString(),
  node: process.version,
  artefacto: ruta,
  modo: MODO,
  hardware: { cpus: cpus().length, modelo: cpus()[0]?.model ?? 'desconocido', memoriaGb: +(totalmem() / 2 ** 30).toFixed(1) },
  umbrales: { minMs: UMBRAL_MIN_MS, maxMs: UMBRAL_MAX_MS },
  muestras: MUESTRAS,
  medida,
  parametrosPhc: leidos,
  parametrosEsperados: PARAMETROS_ADR_024,
};
writeFileSync(ARCHIVO_SALIDA, `${JSON.stringify(reporte, null, 2)}\n`);

resumen('## Benchmark de `argon2id` (ADR-024)');
resumen('');
resumen(
  `Artefacto \`${ruta}\` · Node ${process.version} · ${cpus().length} vCPU · ${MUESTRAS} muestras · modo **${MODO}**`,
);
resumen('');
resumen('| Métrica | Valor |');
resumen('| --- | ---: |');
resumen(`| Mediana | ${medida.medianaMs.toFixed(1)} ms |`);
resumen(`| p95 | ${medida.p95Ms.toFixed(1)} ms |`);
resumen(`| Mínimo | ${medida.minMs.toFixed(1)} ms |`);
resumen(`| Máximo | ${medida.maxMs.toFixed(1)} ms |`);
resumen(`| Rango exigido (plan §6) | ${UMBRAL_MIN_MS} – ${UMBRAL_MAX_MS} ms |`);
resumen(`| Parámetros PHC | ${leidos ? `m=${leidos.m}, t=${leidos.t}, p=${leidos.p}` : 'no legibles'} |`);

const problemas = [];

if (medida.medianaMs < UMBRAL_MIN_MS) {
  problemas.push(
    `la mediana de hasheo es ${medida.medianaMs.toFixed(1)} ms, POR DEBAJO del piso de ${UMBRAL_MIN_MS} ms. ` +
      'Un hasheo barato es una política de contraseñas débil: facilita la fuerza bruta fuera de línea contra un ' +
      'volcado de la base. Subir memoria o iteraciones (ADR-024 §1) y volver a medir.',
  );
}
if (medida.medianaMs > UMBRAL_MAX_MS) {
  problemas.push(
    `la mediana de hasheo es ${medida.medianaMs.toFixed(1)} ms, POR ENCIMA del techo de ${UMBRAL_MAX_MS} ms. ` +
      'El ingreso se vuelve un amplificador de denegación de servicio (R-02: el hasheo se paga también para ' +
      'cuentas inexistentes, ADR-025) y no cierra el presupuesto de ingreso p95 <= 600 ms del plan §6.',
  );
}
if (leidos === null) {
  problemas.push(
    'el hash devuelto no tiene formato PHC `$argon2id$v=19$m=...,t=...,p=...$`. ADR-024 §1 exige que los ' +
      'parámetros viajen dentro del hash: sin eso, `requiereRehash` no puede detectar un hash viejo y subir ' +
      'los parámetros más adelante rompe las cuentas existentes.',
  );
} else if (parametrosDesviados.length > 0) {
  problemas.push(
    `los parámetros del hash no son los de ADR-024 §1: ${parametrosDesviados
      .map(([clave, valor]) => `${clave} esperado ${valor}, encontrado ${leidos[clave]}`)
      .join('; ')}. Cambiarlos es una decisión de seguridad y va a ADR, no al código.`,
  );
}

if (problemas.length === 0) {
  resumen('');
  resumen('Dentro del rango y con los parámetros de ADR-024.');
  process.exit(0);
}

resumen('');
for (const problema of problemas) {
  resumen(`- ${problema}`);
}

if (MODO === 'bloqueante') {
  for (const problema of problemas) {
    console.log(`::error::Benchmark de argon2id: ${problema}`);
  }
  resumen('');
  resumen('**Construcción detenida.** El rango de ADR-024 no es una recomendación.');
  process.exit(1);
}

for (const problema of problemas) {
  console.log(`::warning::Benchmark de argon2id (modo informativo): ${problema}`);
}
resumen('');
resumen('Modo informativo: no rompe la construcción. Sirve para medir hardware nuevo antes de proponer un rango en compuerta.');
