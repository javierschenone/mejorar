/**
 * Aritmética racional exacta (ADR-011 §2). Es la base de CA-32: si la
 * aritmética intermedia no es exacta, el redondeo final no puede favorecer a
 * nadie de forma verificable.
 */
import { describe, expect, it } from 'vitest';

import {
  CERO,
  UNO,
  comparar,
  dividir,
  esCero,
  esNegativo,
  multiplicar,
  negar,
  porcentaje,
  racional,
  racionalDesdeEntero,
  restar,
  sonIguales,
  sumar,
} from './racional';

function exigir<T>(resultado: { ok: true; valor: T } | { ok: false; error: unknown }): T {
  if (!resultado.ok) throw new Error(`se esperaba un resultado exitoso: ${JSON.stringify(resultado.error)}`);
  return resultado.valor;
}

describe('racional — la aritmética del motor es exacta, nunca punto flotante', () => {
  it('un tercio más un tercio más un tercio es exactamente uno (lo que 0,3333 nunca da)', () => {
    const unTercio = exigir(racional(1n, 3n));
    expect(sonIguales(sumar(sumar(unTercio, unTercio), unTercio), UNO)).toBe(true);
  });

  it('0,1 + 0,2 es exactamente 0,3 (el caso que rompe el punto flotante)', () => {
    const unDecimo = exigir(racional(1n, 10n));
    const dosDecimos = exigir(racional(2n, 10n));
    expect(sumar(unDecimo, dosDecimos)).toEqual({ n: 3n, d: 10n });
    expect(0.1 + 0.2).not.toBe(0.3);
  });

  it('normaliza siempre: la misma fracción tiene una sola representación', () => {
    expect(exigir(racional(50n, 100n))).toEqual({ n: 1n, d: 2n });
    expect(exigir(racional(-2n, -4n))).toEqual({ n: 1n, d: 2n });
    expect(exigir(racional(2n, -4n))).toEqual({ n: -1n, d: 2n });
  });

  it('el cero tiene una sola representación, venga de donde venga', () => {
    expect(exigir(racional(0n, 7n))).toEqual({ n: 0n, d: 1n });
    expect(esCero(restar(UNO, UNO))).toBe(true);
    expect(esCero(CERO)).toBe(true);
  });

  it('rechaza el denominador cero como entrada inválida, no lanza excepción', () => {
    const resultado = racional(1n, 0n);
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error.clase).toBe('ENTRADA_INVALIDA');
      expect(resultado.error.codigo).toBe('DINERO_DENOMINADOR_CERO');
    }
  });

  it('rechaza la división por cero como entrada inválida, no lanza excepción', () => {
    const resultado = dividir(UNO, CERO);
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error.codigo).toBe('DINERO_DIVISION_POR_CERO');
  });

  it('opera con números grandes sin perder un solo dígito', () => {
    const enorme = racionalDesdeEntero(9_007_199_254_740_993n); // entero inseguro en IEEE-754
    expect(multiplicar(enorme, racionalDesdeEntero(3n)).n).toBe(27_021_597_764_222_979n);
  });

  it('compara sin redondear: 1/3 es mayor que 333/1000', () => {
    const unTercio = exigir(racional(1n, 3n));
    const casiUnTercio = exigir(racional(333n, 1000n));
    expect(comparar(unTercio, casiUnTercio)).toBe(1);
    expect(comparar(casiUnTercio, unTercio)).toBe(-1);
    expect(comparar(unTercio, unTercio)).toBe(0);
  });

  it('un porcentaje normativo se escribe como fracción exacta, no como decimal', () => {
    expect(porcentaje(25n)).toEqual({ n: 1n, d: 4n });
    expect(porcentaje(10n)).toEqual({ n: 1n, d: 10n });
    expect(porcentaje(0n)).toEqual({ n: 0n, d: 1n });
  });

  it('negar cambia el signo y `esNegativo` lo detecta', () => {
    expect(esNegativo(negar(UNO))).toBe(true);
    expect(esNegativo(UNO)).toBe(false);
    expect(esNegativo(CERO)).toBe(false);
  });

  it('no muta los operandos', () => {
    const a = exigir(racional(1n, 3n));
    const b = exigir(racional(1n, 6n));
    sumar(a, b);
    multiplicar(a, b);
    expect(a).toEqual({ n: 1n, d: 3n });
    expect(b).toEqual({ n: 1n, d: 6n });
  });
});
