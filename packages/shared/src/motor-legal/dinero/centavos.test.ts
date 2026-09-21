/**
 * CA-32 — el dinero del motor son centavos enteros con su moneda.
 * ADR-011 §1. §7 de la spec: el motor opera sobre la moneda de origen y no
 * convierte por su cuenta.
 */
import { describe, expect, it } from 'vitest';

import type { Centavos, Monto } from '../contrato/v1';
import {
  centavosATexto,
  compararMontos,
  crearCentavos,
  crearCentavosDesdeTexto,
  crearMonto,
  esCeroElMonto,
  montoARacional,
  montoCero,
  restarMontos,
  sumarMontos,
} from './centavos';

function exigirCentavos(valor: bigint): Centavos {
  const resultado = crearCentavos(valor);
  if (!resultado.ok) throw new Error(`se esperaban centavos válidos: ${resultado.error.codigo}`);
  return resultado.valor;
}

function pesos(valor: bigint): Monto {
  return crearMonto(exigirCentavos(valor), 'ARS');
}

describe('CA-32 — importes en centavos enteros, con moneda, sin punto flotante', () => {
  it('CA-32: un importe se expresa en centavos enteros y con su moneda', () => {
    const monto = pesos(123_456n);
    expect(monto.centavos).toBe(123_456n);
    expect(typeof monto.centavos).toBe('bigint');
    expect(monto.moneda).toBe('ARS');
  });

  it('CA-32: el cero es un importe válido', () => {
    expect(esCeroElMonto(montoCero('ARS'))).toBe(true);
    expect(exigirCentavos(0n)).toBe(0n);
  });

  it('CA-32: un importe negativo se rechaza como entrada inválida y no se construye', () => {
    const resultado = crearCentavos(-1n);
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error.clase).toBe('ENTRADA_INVALIDA');
      expect(resultado.error.codigo).toBe('DINERO_MONTO_NEGATIVO');
      expect(resultado.error.detalle.datos).toEqual([]);
    }
  });

  it('CA-32: el borde del rechazo es exacto — 0 se acepta, −1 se rechaza', () => {
    expect(crearCentavos(0n).ok).toBe(true);
    expect(crearCentavos(-1n).ok).toBe(false);
  });

  it('CA-32: desde texto decimal (como lo serializa el borde HTTP) sólo se aceptan dígitos', () => {
    expect(crearCentavosDesdeTexto('100').ok).toBe(true);
    expect(crearCentavosDesdeTexto('100,50').ok).toBe(false);
    expect(crearCentavosDesdeTexto('100.50').ok).toBe(false);
    expect(crearCentavosDesdeTexto('-100').ok).toBe(false);
    expect(crearCentavosDesdeTexto('').ok).toBe(false);
    expect(crearCentavosDesdeTexto('1e3').ok).toBe(false);
  });

  it('CA-32: los centavos se serializan como cadena, nunca como número JSON', () => {
    // 9.007.199.254.740.993 centavos (unos 90 billones de pesos) es el primer
    // entero por encima de `Number.MAX_SAFE_INTEGER`: `number` no lo puede
    // representar. Por eso la obligación de frontera F-06 manda que el importe
    // viaje como **cadena** y nunca como número JSON — un `JSON.parse` que lo
    // reciba como número le cambia el valor al importe sin avisar.
    const grande = exigirCentavos(9_007_199_254_740_993n);
    expect(centavosATexto(grande)).toBe('9007199254740993');

    // La pérdida de precisión se demuestra volviendo a `bigint`, no comparando
    // contra un literal `number`: escrito como literal, `9_007_199_254_740_993`
    // ya vale 9007199254740992 y la comparación no probaría nada.
    const rotoPorNumber = BigInt(Number(centavosATexto(grande)));
    expect(rotoPorNumber).not.toBe(grande);
    expect(rotoPorNumber).toBe(9_007_199_254_740_992n);
    expect(grande - rotoPorNumber).toBe(1n); // un centavo que desaparece solo

    // El ida y vuelta por cadena, en cambio, es exacto: es el contrato.
    const reconstruido = crearCentavosDesdeTexto(centavosATexto(grande));
    expect(reconstruido.ok && reconstruido.valor).toBe(grande);
  });

  it('suma y resta son exactas sobre enteros grandes', () => {
    const suma = sumarMontos(pesos(9_007_199_254_740_993n), pesos(1n));
    expect(suma.ok && suma.valor.centavos).toBe(9_007_199_254_740_994n);
  });

  it('§7 de la spec: no se suman ni se comparan importes de monedas distintas', () => {
    const enPesos = pesos(1000n);
    const enDolares = crearMonto(exigirCentavos(1000n), 'USD');
    const suma = sumarMontos(enPesos, enDolares);
    const comparacion = compararMontos(enPesos, enDolares);
    expect(suma.ok).toBe(false);
    expect(comparacion.ok).toBe(false);
    if (!suma.ok) expect(suma.error.codigo).toBe('DINERO_MONEDAS_DISTINTAS');
  });

  it('una resta que daría negativo es dato inconsistente, no un saldo en rojo', () => {
    const resultado = restarMontos(pesos(100n), pesos(101n));
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error.codigo).toBe('DINERO_RESTA_DA_NEGATIVO');
  });

  it('restar hasta el borde exacto da cero y se acepta', () => {
    const resultado = restarMontos(pesos(100n), pesos(100n));
    expect(resultado.ok && resultado.valor.centavos).toBe(0n);
  });

  it('comparar importes de la misma moneda ordena correctamente', () => {
    expect(compararMontos(pesos(1n), pesos(2n))).toEqual({ ok: true, valor: -1 });
    expect(compararMontos(pesos(2n), pesos(1n))).toEqual({ ok: true, valor: 1 });
    expect(compararMontos(pesos(2n), pesos(2n))).toEqual({ ok: true, valor: 0 });
  });

  it('un importe entra a la cadena de cálculo como racional exacto', () => {
    expect(montoARacional(pesos(12_345n))).toEqual({ n: 12_345n, d: 1n });
  });

  it('no muta los montos que recibe', () => {
    const a = pesos(500n);
    const b = pesos(300n);
    sumarMontos(a, b);
    restarMontos(a, b);
    expect(a).toEqual({ centavos: 500n, moneda: 'ARS' });
    expect(b).toEqual({ centavos: 300n, moneda: 'ARS' });
  });
});
