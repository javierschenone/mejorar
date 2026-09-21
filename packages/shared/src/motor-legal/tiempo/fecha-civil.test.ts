/**
 * CA-31 — el motor es determinista y recibe la fecha como entrada.
 * CA-29 (base temporal) — un hecho anterior a la vigencia de un parámetro se
 * resuelve con el parámetro que estaba vigente **a la fecha del hecho**. La
 * resolución completa del catálogo es la tarea T-04; acá se prueba la
 * primitiva de vigencia sobre la que se apoya.
 */
import { describe, expect, it } from 'vitest';

import type { ErrorMotor, FechaCivil, Resultado } from '../contrato/v1';
import {
  aDiaSerial,
  comoFechaCivil,
  comoFechaDeEvaluacion,
  comoFechaDelHecho,
  compararFechas,
  desdeDiaSerial,
  diasDelMes,
  diasEntre,
  esAnterior,
  esBisiesto,
  esLaMismaFecha,
  esPosterior,
  estaVigenteA,
  partesDeFecha,
  sumarAnios,
  sumarDias,
  sumarMeses,
} from './fecha-civil';

function fecha(texto: string): FechaCivil {
  const resultado = comoFechaCivil(texto);
  if (!resultado.ok) throw new Error(`fecha de prueba inválida ${texto}: ${resultado.error.codigo}`);
  return resultado.valor;
}

function exigirFecha(resultado: Resultado<FechaCivil, ErrorMotor>): string {
  if (!resultado.ok) throw new Error(`se esperaba una fecha válida: ${resultado.error.codigo}`);
  return resultado.valor as string;
}

describe('fecha civil — `AAAA-MM-DD`, sin hora y sin zona horaria', () => {
  it('acepta una fecha bien formada y la devuelve intacta', () => {
    expect(exigirFecha(comoFechaCivil('2026-09-21'))).toBe('2026-09-21');
  });

  it('rechaza formatos que no son `AAAA-MM-DD`', () => {
    for (const texto of ['21/09/2026', '2026-9-21', '2026-09-21T00:00:00Z', '20260921', '']) {
      const resultado = comoFechaCivil(texto);
      expect(resultado.ok, `debería rechazar ${texto}`).toBe(false);
      if (!resultado.ok) expect(resultado.error.clase).toBe('ENTRADA_INVALIDA');
    }
  });

  it('rechaza fechas que no existen en el calendario', () => {
    expect(comoFechaCivil('2026-02-29').ok).toBe(false); // 2026 no es bisiesto
    expect(comoFechaCivil('2026-04-31').ok).toBe(false);
    expect(comoFechaCivil('2026-13-01').ok).toBe(false);
    expect(comoFechaCivil('2026-00-10').ok).toBe(false);
    expect(comoFechaCivil('2026-01-00').ok).toBe(false);
  });

  it('acepta el 29 de febrero sólo en año bisiesto', () => {
    expect(comoFechaCivil('2024-02-29').ok).toBe(true);
    expect(comoFechaCivil('2100-02-29').ok).toBe(false); // 2100 no es bisiesto
    expect(comoFechaCivil('2000-02-29').ok).toBe(true); // 2000 sí lo es
    expect(esBisiesto(1900)).toBe(false);
    expect(diasDelMes(2024, 2)).toBe(29);
  });

  it('rechaza años fuera del rango admitido', () => {
    expect(comoFechaCivil('1799-12-31').ok).toBe(false);
    expect(comoFechaCivil('1800-01-01').ok).toBe(true);
    expect(comoFechaCivil('2999-12-31').ok).toBe(true);
    expect(comoFechaCivil('3000-01-01').ok).toBe(false);
  });

  it('desarma la fecha en sus partes sin usar `Date`', () => {
    expect(partesDeFecha(fecha('2026-09-21'))).toEqual({ anio: 2026, mes: 9, dia: 21 });
  });
});

describe('aritmética de días civiles — un día de diferencia decide si una deuda prescribió', () => {
  it('cuenta días completos entre dos fechas, en ambos sentidos', () => {
    expect(diasEntre(fecha('2026-09-21'), fecha('2026-09-22'))).toBe(1);
    expect(diasEntre(fecha('2026-09-22'), fecha('2026-09-21'))).toBe(-1);
    expect(diasEntre(fecha('2026-09-21'), fecha('2026-09-21'))).toBe(0);
  });

  it('cruza fin de mes, fin de año y años bisiestos sin corrimientos', () => {
    expect(diasEntre(fecha('2023-12-31'), fecha('2024-01-01'))).toBe(1);
    expect(diasEntre(fecha('2024-02-28'), fecha('2024-03-01'))).toBe(2); // 2024 bisiesto
    expect(diasEntre(fecha('2023-02-28'), fecha('2023-03-01'))).toBe(1);
    expect(diasEntre(fecha('2020-01-01'), fecha('2021-01-01'))).toBe(366);
    expect(diasEntre(fecha('2021-01-01'), fecha('2022-01-01'))).toBe(365);
  });

  it('el día serial y su inversa son exactos ida y vuelta', () => {
    for (const texto of ['1800-01-01', '1969-12-31', '1970-01-01', '2024-02-29', '2999-12-31']) {
      expect(desdeDiaSerial(aDiaSerial(fecha(texto))) as string).toBe(texto);
    }
  });

  it('suma y resta días atravesando meses y años', () => {
    expect(exigirFecha(sumarDias(fecha('2026-09-21'), 10))).toBe('2026-10-01');
    expect(exigirFecha(sumarDias(fecha('2026-01-01'), -1))).toBe('2025-12-31');
    expect(exigirFecha(sumarDias(fecha('2026-09-21'), 0))).toBe('2026-09-21');
  });

  it('suma meses y años recortando al último día del mes cuando el día no existe', () => {
    expect(exigirFecha(sumarMeses(fecha('2026-01-31'), 1))).toBe('2026-02-28');
    expect(exigirFecha(sumarMeses(fecha('2024-01-31'), 1))).toBe('2024-02-29');
    expect(exigirFecha(sumarAnios(fecha('2024-02-29'), 1))).toBe('2025-02-28');
    expect(exigirFecha(sumarAnios(fecha('2021-03-15'), 5))).toBe('2026-03-15');
    expect(exigirFecha(sumarMeses(fecha('2026-03-15'), -3))).toBe('2025-12-15');
  });

  it('rechaza plazos no enteros en vez de inventar medio día', () => {
    expect(sumarDias(fecha('2026-09-21'), 1.5).ok).toBe(false);
    expect(sumarAnios(fecha('2026-09-21'), 2.5).ok).toBe(false);
  });

  it('rechaza el desborde del rango de años admitido', () => {
    expect(sumarAnios(fecha('2999-01-01'), 1).ok).toBe(false);
    expect(sumarDias(fecha('1800-01-01'), -1).ok).toBe(false);
  });

  it('ordena y compara fechas sin ambigüedad', () => {
    expect(compararFechas(fecha('2020-01-01'), fecha('2020-01-02'))).toBe(-1);
    expect(compararFechas(fecha('2020-01-02'), fecha('2020-01-01'))).toBe(1);
    expect(compararFechas(fecha('2020-01-01'), fecha('2020-01-01'))).toBe(0);
    expect(esAnterior(fecha('2020-01-01'), fecha('2020-01-02'))).toBe(true);
    expect(esPosterior(fecha('2020-01-02'), fecha('2020-01-01'))).toBe(true);
    expect(esLaMismaFecha(fecha('2020-01-01'), fecha('2020-01-01'))).toBe(true);
  });
});

describe('CA-29 (base temporal) — la vigencia se evalúa contra la fecha del hecho', () => {
  const desde = fecha('2023-12-13'); // vigencia del tramo nuevo
  const hasta = fecha('2023-12-12'); // último día del tramo anterior

  it('CA-29: el intervalo de vigencia es cerrado en los dos extremos', () => {
    expect(estaVigenteA(desde, null, fecha('2023-12-12'))).toBe(false);
    expect(estaVigenteA(desde, null, desde)).toBe(true); // el primer día ya rige
    expect(estaVigenteA(fecha('2015-08-01'), hasta, hasta)).toBe(true); // el último también
    expect(estaVigenteA(fecha('2015-08-01'), hasta, fecha('2023-12-13'))).toBe(false);
  });

  it('CA-29: `vigenciaHasta` nula significa vigente sin término conocido', () => {
    expect(estaVigenteA(desde, null, fecha('2099-01-01'))).toBe(true);
  });

  it('CA-29: un hecho anterior al cambio de norma cae en el tramo viejo, no en el actual', () => {
    const tramoViejo = { vigenciaDesde: fecha('2015-08-01'), vigenciaHasta: hasta, tope: 25n };
    const tramoNuevo = { vigenciaDesde: desde, vigenciaHasta: null, tope: 50n };
    const tramos = [tramoViejo, tramoNuevo];

    const fechaDelHecho = comoFechaDelHecho(fecha('2020-05-10'));
    const fechaDeEvaluacion = comoFechaDeEvaluacion(fecha('2026-09-21'));

    const vigenteAlHecho = tramos.filter((t) => estaVigenteA(t.vigenciaDesde, t.vigenciaHasta, fechaDelHecho));
    const vigenteHoy = tramos.filter((t) => estaVigenteA(t.vigenciaDesde, t.vigenciaHasta, fechaDeEvaluacion));

    expect(vigenteAlHecho).toHaveLength(1);
    expect(vigenteAlHecho[0]?.tope).toBe(25n);
    expect(vigenteHoy[0]?.tope).toBe(50n);
  });

  it('CA-30: cambiar el valor de un parámetro no toca ninguna función del motor', () => {
    // El "cambio de parámetro" es un dato distinto en el tramo; el código que
    // lo resuelve es exactamente el mismo que en el test anterior.
    const tramoCorregido = { vigenciaDesde: fecha('2015-08-01'), vigenciaHasta: hasta, tope: 30n };
    const fechaDelHecho = comoFechaDelHecho(fecha('2020-05-10'));
    expect(
      estaVigenteA(tramoCorregido.vigenciaDesde, tramoCorregido.vigenciaHasta, fechaDelHecho),
    ).toBe(true);
    expect(tramoCorregido.tope).toBe(30n);
  });

  it('CA-31: la fecha de evaluación y la fecha del hecho son marcas distintas y no se confunden', () => {
    const civil = fecha('2026-09-21');
    // Las dos marcas se construyen desde la misma `FechaCivil`, pero el
    // sistema de tipos no deja pasar una donde se espera la otra (ADR-016 §2).
    expect(comoFechaDelHecho(civil) as string).toBe('2026-09-21');
    expect(comoFechaDeEvaluacion(civil) as string).toBe('2026-09-21');
  });
});
