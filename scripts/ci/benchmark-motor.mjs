#!/usr/bin/env node
//
// Benchmark del motor de reglas legales — T-14 de la feature 004.
//
// Mide las dos filas de presupuesto que declara `specs/004-motor-reglas-legales/plan.md` §6:
//
//   Rendimiento : los cinco análisis sobre una deuda, p95 <= 50 ms en Node 22,
//                 con catálogo de hasta 500 tramos y tabla de valores de hasta 2000.
//   Memoria     : `ContextoEvaluacion` serializado <= 3 MB.
//
// No es un test: no valida ningún resultado del motor. Sólo toma la línea de
// base antes de que el código crezca. Arranca en modo `informativo` (reporta y
// no rompe la construcción); se pasa a `bloqueante` con la variable de entorno
// MODO_BENCHMARK cuando el product owner acuerde que el umbral ya se puede
// exigir.
//
// Qué espera encontrar (convención acordada con `dev-dominio`):
//   el artefacto compilado de @mejorar/shared exporta
//     - `evaluar(entrada, contexto)`  — la función pura del contrato
//     - `escenariosDeBenchmark()`     — devuelve [{ nombre, entrada, contexto }]
//   Mientras alguna de las dos no exista, el benchmark informa qué falta y
//   termina bien: no bloquea a nadie por código que todavía no se escribió.

import { existsSync, writeFileSync, appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const MODO = process.env.MODO_BENCHMARK ?? 'informativo';
const ITERACIONES = Number(process.env.ITERACIONES ?? 200);
const CALENTAMIENTO = Number(process.env.CALENTAMIENTO ?? 20);
const UMBRAL_P95_MS = Number(process.env.UMBRAL_P95_MS ?? 50);
const UMBRAL_CONTEXTO_MB = Number(process.env.UMBRAL_CONTEXTO_MB ?? 3);
const ARCHIVO_SALIDA = process.env.ARCHIVO_SALIDA ?? 'benchmark-motor.json';

// Candidatos de artefacto compilado, en orden de preferencia.
const CANDIDATOS = [
  'packages/shared/dist/motor-legal/index.js',
  'packages/shared/dist/motor-legal.js',
  'packages/shared/dist/index.js',
];

function resumen(texto) {
  console.log(texto);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${texto}\n`);
  }
}

function pendiente(motivo) {
  console.log(`::notice::Benchmark del motor no ejecutado: ${motivo}`);
  resumen('## Benchmark del motor');
  resumen('');
  resumen(`Pendiente: ${motivo}`);
  process.exit(0);
}

async function cargarMotor() {
  const ruta = CANDIDATOS.find((c) => existsSync(resolve(process.cwd(), c)));
  if (!ruta) {
    pendiente(
      `no se encontró el artefacto compilado del motor (se buscó en ${CANDIDATOS.join(', ')}). ` +
        'Se construye con `pnpm --filter @mejorar/shared build`.',
    );
  }
  const modulo = await import(pathToFileURL(resolve(process.cwd(), ruta)).href);
  const api = modulo.default && typeof modulo.default === 'object' ? { ...modulo.default, ...modulo } : modulo;

  const evaluar = api.evaluar;
  const escenarios = api.escenariosDeBenchmark ?? api.escenariosDePrueba;

  if (typeof evaluar !== 'function') {
    pendiente(`${ruta} no exporta \`evaluar\` (T-01 a T-13 en curso).`);
  }
  if (typeof escenarios !== 'function') {
    pendiente(
      `${ruta} no exporta \`escenariosDeBenchmark()\`. Debe devolver ` +
        '[{ nombre, entrada, contexto }] con un catálogo representativo ' +
        '(hasta 500 tramos) y una tabla de valores de referencia (hasta 2000 tramos).',
    );
  }
  return { ruta, evaluar, escenarios: escenarios() };
}

function percentil(muestrasOrdenadas, p) {
  const indice = Math.min(muestrasOrdenadas.length - 1, Math.max(0, Math.ceil(p * muestrasOrdenadas.length) - 1));
  return muestrasOrdenadas[indice];
}

// `bigint` no es serializable por JSON y el dinero del motor es `bigint`
// (ADR-012 / CA-32): se mide su representación en texto.
function serializar(valor) {
  return JSON.stringify(valor, (_clave, v) => (typeof v === 'bigint' ? `${v}n` : v));
}

function medirEscenario(evaluar, escenario) {
  const { entrada, contexto } = escenario;

  for (let i = 0; i < CALENTAMIENTO; i += 1) {
    evaluar(entrada, contexto);
  }

  const muestrasNs = new Array(ITERACIONES);
  for (let i = 0; i < ITERACIONES; i += 1) {
    const inicio = process.hrtime.bigint();
    evaluar(entrada, contexto);
    muestrasNs[i] = Number(process.hrtime.bigint() - inicio) / 1e6; // ms
  }
  muestrasNs.sort((a, b) => a - b);

  const contextoBytes = Buffer.byteLength(serializar(contexto) ?? '', 'utf8');

  return {
    nombre: escenario.nombre ?? 'sin nombre',
    iteraciones: ITERACIONES,
    p50Ms: percentil(muestrasNs, 0.5),
    p95Ms: percentil(muestrasNs, 0.95),
    p99Ms: percentil(muestrasNs, 0.99),
    maxMs: muestrasNs[muestrasNs.length - 1],
    contextoMb: contextoBytes / (1024 * 1024),
  };
}

const { ruta, evaluar, escenarios } = await cargarMotor();

if (!Array.isArray(escenarios) || escenarios.length === 0) {
  pendiente('`escenariosDeBenchmark()` no devolvió ningún escenario.');
}

const mediciones = escenarios.map((escenario) => medirEscenario(evaluar, escenario));

const excedidos = mediciones.filter((m) => m.p95Ms > UMBRAL_P95_MS || m.contextoMb > UMBRAL_CONTEXTO_MB);

const reporte = {
  fechaMedicion: new Date().toISOString(), // el benchmark no es el motor: acá el reloj sí se puede leer
  node: process.version,
  artefacto: ruta,
  modo: MODO,
  umbrales: { p95Ms: UMBRAL_P95_MS, contextoMb: UMBRAL_CONTEXTO_MB },
  mediciones,
};
writeFileSync(ARCHIVO_SALIDA, `${JSON.stringify(reporte, null, 2)}\n`);

resumen('## Benchmark del motor');
resumen('');
resumen(`Artefacto \`${ruta}\` · Node ${process.version} · ${ITERACIONES} iteraciones · modo **${MODO}**`);
resumen(`Presupuesto (plan §6): p95 <= ${UMBRAL_P95_MS} ms · contexto serializado <= ${UMBRAL_CONTEXTO_MB} MB`);
resumen('');
resumen('| Escenario | p50 (ms) | p95 (ms) | p99 (ms) | máx (ms) | Contexto (MB) |');
resumen('| --- | ---: | ---: | ---: | ---: | ---: |');
for (const m of mediciones) {
  resumen(
    `| ${m.nombre} | ${m.p50Ms.toFixed(2)} | ${m.p95Ms.toFixed(2)} | ${m.p99Ms.toFixed(2)} | ` +
      `${m.maxMs.toFixed(2)} | ${m.contextoMb.toFixed(2)} |`,
  );
}

if (excedidos.length === 0) {
  resumen('');
  resumen('Todos los escenarios dentro del presupuesto.');
  process.exit(0);
}

const detalle = excedidos.map((m) => `${m.nombre} (p95 ${m.p95Ms.toFixed(2)} ms, contexto ${m.contextoMb.toFixed(2)} MB)`).join('; ');

if (MODO === 'bloqueante') {
  console.log(`::error::Presupuesto de rendimiento excedido: ${detalle}`);
  resumen('');
  resumen(`**Presupuesto excedido** (modo bloqueante): ${detalle}`);
  process.exit(1);
}

console.log(`::warning::Presupuesto de rendimiento excedido: ${detalle}`);
resumen('');
resumen(`Presupuesto excedido: ${detalle} — el modo es informativo, no rompe la construcción.`);
