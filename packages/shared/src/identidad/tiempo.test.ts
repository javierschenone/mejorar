/**
 * Tiempo del dominio de identidad: instantes, fechas civiles argentinas y el
 * borde exacto de una vigencia.
 *
 * El borde importa de verdad: decide si una matrícula está vigente o vencida
 * (CA-29) y si una cuenta está bloqueada o no (CA-09).
 */
import { describe, expect, it } from 'vitest';

import type { FechaCivil, Instante } from './contrato/v1';
import {
  comoDuracionEnSegundos,
  comoFechaCivil,
  comoInstante,
  estaDentroDeLaVigencia,
  fechaCivilArgentinaDe,
  instanteDesdeMilisegundos,
  milisegundosDe,
  segundosEntre,
  sumarSegundos,
} from './tiempo';

function instante(texto: string): Instante {
  const resultado = comoInstante(texto);
  if (!resultado.ok) throw new Error(`instante de prueba inválido: ${texto}`);
  return resultado.valor;
}

function fecha(texto: string): FechaCivil {
  const resultado = comoFechaCivil(texto);
  if (!resultado.ok) throw new Error(`fecha de prueba inválida: ${texto}`);
  return resultado.valor;
}

describe('comoInstante — sólo acepta instantes absolutos en UTC', () => {
  it('acepta la forma del contrato, con milisegundos', () => {
    const resultado = comoInstante('2026-09-21T14:03:11.412Z');
    expect(resultado.ok).toBe(true);
  });

  it('completa los milisegundos cuando no vienen, para que la forma sea única', () => {
    const resultado = comoInstante('2026-09-21T14:03:11Z');
    expect(resultado.ok && resultado.valor).toBe('2026-09-21T14:03:11.000Z');
  });

  it('rechaza un instante con desplazamiento horario: el contrato dice UTC', () => {
    const resultado = comoInstante('2026-09-21T14:03:11.412-03:00');
    expect(resultado.ok).toBe(false);
    expect(!resultado.ok && resultado.error.codigo).toBe('INSTANTE_FORMATO_INVALIDO');
  });

  it('rechaza el 29 de febrero de un año común y acepta el de uno bisiesto', () => {
    expect(comoInstante('2027-02-29T00:00:00.000Z').ok).toBe(false);
    expect(comoInstante('2028-02-29T00:00:00.000Z').ok).toBe(true);
  });

  it('rechaza la hora 24 y el segundo 60', () => {
    expect(comoInstante('2026-09-21T24:00:00.000Z').ok).toBe(false);
    expect(comoInstante('2026-09-21T23:59:60.000Z').ok).toBe(false);
  });
});

describe('aritmética de instantes — entera, sin reloj y reversible', () => {
  it('ida y vuelta: instante → milisegundos → instante devuelve el mismo texto', () => {
    const original = instante('2026-09-21T14:03:11.412Z');
    expect(instanteDesdeMilisegundos(milisegundosDe(original))).toBe(original);
  });

  it('la época es el cero', () => {
    expect(milisegundosDe(instante('1970-01-01T00:00:00.000Z'))).toBe(0);
  });

  it('sumar segundos cruza el cambio de año correctamente', () => {
    expect(sumarSegundos(instante('2026-12-31T23:59:59.000Z'), 1)).toBe('2027-01-01T00:00:00.000Z');
  });

  it('sumar segundos acepta valores negativos', () => {
    expect(sumarSegundos(instante('2027-01-01T00:00:00.000Z'), -1)).toBe('2026-12-31T23:59:59.000Z');
  });

  it('segundosEntre es negativo cuando el segundo instante es anterior', () => {
    expect(segundosEntre(instante('2026-09-21T00:00:10.000Z'), instante('2026-09-21T00:00:00.000Z'))).toBe(-10);
  });
});

describe('fecha civil argentina — un instante UTC no es un día argentino', () => {
  it('a las 02:00 UTC todavía es el día anterior en la Argentina', () => {
    expect(fechaCivilArgentinaDe(instante('2027-03-19T02:00:00.000Z'))).toBe('2027-03-18');
  });

  it('a las 03:00 UTC ya es el día siguiente en la Argentina', () => {
    expect(fechaCivilArgentinaDe(instante('2027-03-19T03:00:00.000Z'))).toBe('2027-03-19');
  });
});

describe('estaDentroDeLaVigencia — el último día cuenta entero, en hora argentina', () => {
  const vigenciaHasta = fecha('2027-03-18');

  it('el día anterior está dentro', () => {
    expect(estaDentroDeLaVigencia(instante('2027-03-17T12:00:00.000Z'), vigenciaHasta)).toBe(true);
  });

  it('el último milisegundo del día de vigencia, en hora argentina, todavía está dentro', () => {
    expect(estaDentroDeLaVigencia(instante('2027-03-19T02:59:59.999Z'), vigenciaHasta)).toBe(true);
  });

  it('un milisegundo después ya está fuera', () => {
    expect(estaDentroDeLaVigencia(instante('2027-03-19T03:00:00.000Z'), vigenciaHasta)).toBe(false);
  });

  it('tomar el día en UTC en vez de en hora argentina cortaría tres horas antes: no se hace', () => {
    // Las 23:00 UTC del último día son las 20:00 en la Argentina: todavía es
    // el día de vigencia y el acceso no puede cortarse ahí.
    expect(estaDentroDeLaVigencia(instante('2027-03-18T23:00:00.000Z'), vigenciaHasta)).toBe(true);
  });
});

describe('comoDuracionEnSegundos — cero sí, negativo no, fraccionario no', () => {
  it('acepta cero', () => {
    expect(comoDuracionEnSegundos(0).ok).toBe(true);
  });

  it('rechaza una duración negativa', () => {
    const resultado = comoDuracionEnSegundos(-1);
    expect(!resultado.ok && resultado.error.codigo).toBe('DURACION_INVALIDA');
  });

  it('rechaza una duración con fracción de segundo', () => {
    expect(comoDuracionEnSegundos(1.5).ok).toBe(false);
  });
});
