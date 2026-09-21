/**
 * Aritmética racional exacta — ADR-011 §2.
 *
 * Todo cálculo intermedio del motor (tasas, prorrateos, proporciones, tramos)
 * se hace con fracciones exactas de `bigint`. Nunca punto flotante: el error
 * de IEEE-754 se acumula en cadenas largas y un hallazgo de exceso que aparece
 * o desaparece por un centavo es un hallazgo impugnable.
 *
 * Invariante de representación: todo `Racional` que sale de este módulo está
 * **normalizado** — denominador estrictamente positivo y fracción simplificada
 * por máximo común divisor. Sin esa normalización los denominadores explotan en
 * cadenas largas (consecuencia negativa anotada en ADR-011) y dos racionales
 * iguales dejarían de ser iguales estructuralmente, lo que rompería el
 * determinismo comparable de CA-31.
 *
 * El redondeo **no** ocurre acá: ocurre una sola vez, al construir el `Monto`
 * final (ver `redondeo.ts`).
 */

import type { ErrorMotor, Racional, Resultado } from '../contrato/v1';
import { errorDeEntrada, falla, ok } from '../errores';

function valorAbsoluto(a: bigint): bigint {
  return a < 0n ? -a : a;
}

function maximoComunDivisor(a: bigint, b: bigint): bigint {
  let x = valorAbsoluto(a);
  let y = valorAbsoluto(b);
  while (y !== 0n) {
    const resto = x % y;
    x = y;
    y = resto;
  }
  return x;
}

/**
 * Normaliza signo y simplifica. Función interna: el denominador ya fue
 * validado distinto de cero por quien construye.
 */
function normalizar(n: bigint, d: bigint): Racional {
  const signo = d < 0n ? -1n : 1n;
  const numerador = n * signo;
  const denominador = d * signo;
  if (numerador === 0n) return { n: 0n, d: 1n };
  const divisor = maximoComunDivisor(numerador, denominador);
  return { n: numerador / divisor, d: denominador / divisor };
}

/** Racional exacto. Denominador cero es entrada inválida, no una excepción. */
export function racional(n: bigint, d: bigint): Resultado<Racional, ErrorMotor> {
  if (d === 0n) return falla(errorDeEntrada('DINERO_DENOMINADOR_CERO'));
  return ok(normalizar(n, d));
}

/** Entero como racional. No puede fallar: el denominador es 1. */
export function racionalDesdeEntero(n: bigint): Racional {
  return { n, d: 1n };
}

export const CERO: Racional = { n: 0n, d: 1n };
export const UNO: Racional = { n: 1n, d: 1n };

export function sumar(a: Racional, b: Racional): Racional {
  return normalizar(a.n * b.d + b.n * a.d, a.d * b.d);
}

export function restar(a: Racional, b: Racional): Racional {
  return normalizar(a.n * b.d - b.n * a.d, a.d * b.d);
}

export function multiplicar(a: Racional, b: Racional): Racional {
  return normalizar(a.n * b.n, a.d * b.d);
}

/** División exacta. Dividir por cero es entrada inválida, no una excepción. */
export function dividir(a: Racional, b: Racional): Resultado<Racional, ErrorMotor> {
  if (b.n === 0n) return falla(errorDeEntrada('DINERO_DIVISION_POR_CERO'));
  return ok(normalizar(a.n * b.d, a.d * b.n));
}

export function negar(a: Racional): Racional {
  return normalizar(-a.n, a.d);
}

/** `-1` si a < b, `0` si son iguales, `1` si a > b. Exacto, sin redondeo. */
export function comparar(a: Racional, b: Racional): -1 | 0 | 1 {
  const izquierda = a.n * b.d;
  const derecha = b.n * a.d;
  if (izquierda < derecha) return -1;
  if (izquierda > derecha) return 1;
  return 0;
}

export function sonIguales(a: Racional, b: Racional): boolean {
  return comparar(a, b) === 0;
}

export function esCero(a: Racional): boolean {
  return a.n === 0n;
}

export function esNegativo(a: Racional): boolean {
  return a.n < 0n;
}

/**
 * Proporción en tanto por ciento expresada como racional exacto: `25` →
 * `{ n: 1n, d: 4n }`. Existe para que ningún parámetro normativo tenga que
 * escribirse como `0.25` en el catálogo (constitución #11 + ADR-011 §2).
 */
export function porcentaje(valor: bigint): Racional {
  return normalizar(valor, 100n);
}
