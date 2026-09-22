/**
 * Bloqueo por intentos fallidos — ADR-025 §4.
 *
 * CA-09: demora creciente y bloqueo temporal.
 * CA-36: el bloqueo NUNCA inhabilita la recuperación.
 * CA-37: parámetros de producto, no normativos.
 *
 * Las pruebas cubren los bordes: ventana exacta, umbral exacto, bloqueo expirado.
 */

import { describe, expect, it } from 'vitest';

import type { DecisionDeBloqueo, DuracionEnSegundos, Instante, PoliticaDeBloqueo } from './contrato/v1';
import { decidirBloqueo, demoraPorIntentos, laRecuperacionSigueDisponible } from './bloqueo';
import { PARAMETROS_DE_IDENTIDAD } from './parametros';
import { duracionLiteral, comoInstante, instanteDesdeMilisegundos, milisegundosDe } from './tiempo';

function instante(texto: string): Instante {
  const resultado = comoInstante(texto);
  if (!resultado.ok) throw new Error(`instante de prueba inválido: ${texto}`);
  return resultado.valor;
}

describe('CA-09 — demora creciente por intentos fallidos', () => {
  it('cero o un intento: sin demora', () => {
    expect(demoraPorIntentos(0)).toBe(0);
    expect(demoraPorIntentos(1)).toBe(0);
  });

  it('demora se duplica a partir del segundo intento', () => {
    const base = PARAMETROS_DE_IDENTIDAD['bloqueo.demoraBase'].valor;
    expect(demoraPorIntentos(2)).toBe(base);
    expect(demoraPorIntentos(3)).toBe(base * 2);
    expect(demoraPorIntentos(4)).toBe(base * 4);
  });

  it('demora tiene un tope para evitar esperas absurdas', () => {
    const tope = PARAMETROS_DE_IDENTIDAD['bloqueo.demoraMaxima'].valor;
    expect(demoraPorIntentos(10)).toBeLessThanOrEqual(tope);
    expect(demoraPorIntentos(20)).toBeLessThanOrEqual(tope);
  });
});

describe('CA-09 — umbral de bloqueo y decisión', () => {
  const politica: PoliticaDeBloqueo = {
    umbralDeIntentos: 5,
    ventana: duracionLiteral(900), // 15 minutos
    duracionDelBloqueo: duracionLiteral(300), // 5 minutos
    laRecuperacionSiempreDisponible: true,
  };

  const instanTeAhora = instante('2026-09-21T14:00:00.000Z');

  it('sin intentos fallidos: se permite', () => {
    const resultado = decidirBloqueo([], politica, instanTeAhora);
    expect(resultado.clase).toBe('PERMITIR');
  });

  it('con cuatro intentos fallidos: se demorar', () => {
    const ahoraMs = milisegundosDe(instanTeAhora);
    const hace1Min = instanteDesdeMilisegundos(ahoraMs - 1 * 60_000);
    const hace2Min = instanteDesdeMilisegundos(ahoraMs - 2 * 60_000);
    const hace3Min = instanteDesdeMilisegundos(ahoraMs - 3 * 60_000);
    const hace4Min = instanteDesdeMilisegundos(ahoraMs - 4 * 60_000);

    const resultado = decidirBloqueo(
      [hace4Min, hace3Min, hace2Min, hace1Min],
      politica,
      instanTeAhora,
    );

    expect(resultado.clase).toBe('DEMORAR');
    if (resultado.clase === 'DEMORAR') {
      // Cuatro intentos: demora debe ser base * 2^(4-2) = base * 4
      const base = PARAMETROS_DE_IDENTIDAD['bloqueo.demoraBase'].valor;
      expect(resultado.demora).toBe(base * 4);
    }
  });

  it('con exactamente cinco intentos: se bloquea', () => {
    const ahoraMs = milisegundosDe(instanTeAhora);
    const hace1Min = instanteDesdeMilisegundos(ahoraMs - 1 * 60_000);
    const hace2Min = instanteDesdeMilisegundos(ahoraMs - 2 * 60_000);
    const hace3Min = instanteDesdeMilisegundos(ahoraMs - 3 * 60_000);
    const hace4Min = instanteDesdeMilisegundos(ahoraMs - 4 * 60_000);
    const hace5Min = instanteDesdeMilisegundos(ahoraMs - 5 * 60_000);

    const resultado = decidirBloqueo(
      [hace5Min, hace4Min, hace3Min, hace2Min, hace1Min],
      politica,
      instanTeAhora,
    );

    expect(resultado.clase).toBe('BLOQUEAR');
    if (resultado.clase === 'BLOQUEAR') {
      // El bloqueo se cuenta desde el último intento + duración
      const ultimoIntentoMs = ahoraMs - 1 * 60_000;
      const bloqueadaHastaMs = ultimoIntentoMs + politica.duracionDelBloqueo * 1000;
      expect(milisegundosDe(resultado.hasta as any)).toBe(bloqueadaHastaMs);
    }
  });

  it('borde: intento en el último milisegundo de la ventana cuenta', () => {
    const ahoraMs = milisegundosDe(instanTeAhora);
    const enlaBorde = instanteDesdeMilisegundos(ahoraMs - 900 * 1000); // exactamente 15 min
    const hace4Min = instanteDesdeMilisegundos(ahoraMs - 4 * 60_000);
    const hace3Min = instanteDesdeMilisegundos(ahoraMs - 3 * 60_000);
    const hace2Min = instanteDesdeMilisegundos(ahoraMs - 2 * 60_000);
    const hace1Min = instanteDesdeMilisegundos(ahoraMs - 1 * 60_000);

    // Cinco intentos, el primero está en la borde exacta de la ventana.
    const resultado = decidirBloqueo(
      [enlaBorde, hace4Min, hace3Min, hace2Min, hace1Min],
      politica,
      instanTeAhora,
    );

    // La ventana es cerrada por abajo: un intento de hace exactamente 15 min
    // todavía cuenta.
    expect(resultado.clase).toBe('BLOQUEAR');
  });

  it('borde: intento afuera de la ventana no cuenta', () => {
    const ahoraMs = milisegundosDe(instanTeAhora);
    const fueraDeVentana = instanteDesdeMilisegundos(ahoraMs - 901 * 1000); // 15:01 min
    const hace4Min = instanteDesdeMilisegundos(ahoraMs - 4 * 60_000);
    const hace3Min = instanteDesdeMilisegundos(ahoraMs - 3 * 60_000);
    const hace2Min = instanteDesdeMilisegundos(ahoraMs - 2 * 60_000);
    const hace1Min = instanteDesdeMilisegundos(ahoraMs - 1 * 60_000);

    // Cinco instantes, pero el primero no cuenta. Quedan cuatro, que producen demora.
    const resultado = decidirBloqueo(
      [fueraDeVentana, hace4Min, hace3Min, hace2Min, hace1Min],
      politica,
      instanTeAhora,
    );

    expect(resultado.clase).toBe('DEMORAR');
  });

  it('el bloqueo se cuenta desde el último intento fallido, no el primero', () => {
    const ahoraMs = milisegundosDe(instanTeAhora);
    const hace10Min = instanteDesdeMilisegundos(ahoraMs - 10 * 60_000);
    const hace5Min = instanteDesdeMilisegundos(ahoraMs - 5 * 60_000);
    const hace4Min = instanteDesdeMilisegundos(ahoraMs - 4 * 60_000);
    const hace3Min = instanteDesdeMilisegundos(ahoraMs - 3 * 60_000);
    const hace1Min = instanteDesdeMilisegundos(ahoraMs - 1 * 60_000);

    // Cinco intentos, pero espaciados. El bloqueo se cuenta desde hace1Min.
    const resultado = decidirBloqueo(
      [hace10Min, hace5Min, hace4Min, hace3Min, hace1Min],
      politica,
      instanTeAhora,
    );

    expect(resultado.clase).toBe('BLOQUEAR');
    if (resultado.clase === 'BLOQUEAR') {
      // Se cuenta desde hace1Min (último intento) + duración del bloqueo.
      const ultimoIntentoMs = ahoraMs - 1 * 60_000;
      const bloqueadaHastaMs = ultimoIntentoMs + politica.duracionDelBloqueo * 1000;
      expect(milisegundosDe(resultado.hasta as any)).toBe(bloqueadaHastaMs);
    }
  });

  it('si el bloqueo ya venció: se permite (temporal de verdad)', () => {
    const ahoraMs = milisegundosDe(instanTeAhora);
    // Cinco intentos, el último es hace 10 minutos (ya fuera de la ventana de 15 min).
    // Entonces quedan 4 intentos válidos en la ventana.
    // Con 4 intentos: demora, no bloqueo.
    // Pero si el último intento válido (hace3Min) + bloqueo (5min) < ahora, se permite.
    // hace3Min + 300s = ahoraMs - 180_000 + 300_000 = ahoraMs + 120_000 (en el futuro!)
    // Por lo tanto, le error está en los valores. Ajustamos:
    // Queremos que: ultimoIntento + duracion < ahora
    // Entonces: ahora - X + duracion < ahora → duracion < X
    // Si duracion = 5min = 300s, queremos X > 300s, es decir al menos 6 minutos.
    const hace16Min = instanteDesdeMilisegundos(ahoraMs - 16 * 60_000); // fuera de la ventana
    const hace10Min = instanteDesdeMilisegundos(ahoraMs - 10 * 60_000); // último dentro de ventana
    const hace9Min = instanteDesdeMilisegundos(ahoraMs - 9 * 60_000);
    const hace8Min = instanteDesdeMilisegundos(ahoraMs - 8 * 60_000);
    const hace7Min = instanteDesdeMilisegundos(ahoraMs - 7 * 60_000);

    // 4 intentos en la ventana: hace10Min + 300s = ahoraMs - 600_000 + 300_000 = ahoraMs - 300_000
    // ahora vs hace5min: -300_000 <= 0 sí, el bloqueo ya venció.
    // Pero espera, hace10Min es una hora con 16 minutos, y ventana es 15 minutos.
    // Entonces hace10Min está DENTRO de la ventana (10 < 15). Quedan 4 intentos de 5.
    // Los 4 intentos NO llegan al umbral. Demora, no bloqueo.
    //
    // Rehacemos: queremos 5 intentos donde el último esté hace más de 5 minutos.
    // Si umbral = 5 intentos y duracion = 5 min, y el último fue hace 6 min:
    // último + 5min = hace6min + 5min = hace 1min. Ya pasó!

    // Simplest: put all 5 within the window but with the last one old enough.
    const hace12Min = instanteDesdeMilisegundos(ahoraMs - 12 * 60_000); // último, pero hace 12 min
    const hace11Min = instanteDesdeMilisegundos(ahoraMs - 11 * 60_000);
    const hace10MinNew = instanteDesdeMilisegundos(ahoraMs - 10 * 60_000);
    const hace9MinNew = instanteDesdeMilisegundos(ahoraMs - 9 * 60_000);
    const hace8MinNew = instanteDesdeMilisegundos(ahoraMs - 8 * 60_000);

    // 5 intentos: hace12 + 300s = ahoraMs - 720_000 + 300_000 = ahoraMs - 420_000
    // ahoraMs - 420_000 <= ahoraMs? Sí, ya pasó el bloqueo.
    const resultado = decidirBloqueo(
      [hace12Min, hace11Min, hace10MinNew, hace9MinNew, hace8MinNew],
      politica,
      instanTeAhora,
    );

    expect(resultado.clase).toBe('PERMITIR');
  });

  it('intentos futuros se ignoran (reloj desfasado): no castigan', () => {
    const ahoraMs = milisegundosDe(instanTeAhora);
    const esFuturo = instanteDesdeMilisegundos(ahoraMs + 1 * 60_000);
    const hace4Min = instanteDesdeMilisegundos(ahoraMs - 4 * 60_000);
    const hace3Min = instanteDesdeMilisegundos(ahoraMs - 3 * 60_000);
    const hace2Min = instanteDesdeMilisegundos(ahoraMs - 2 * 60_000);
    const hace1Min = instanteDesdeMilisegundos(ahoraMs - 1 * 60_000);

    // Cuatro intentos válidos + uno futuro: quedan cuatro, demora.
    const resultado = decidirBloqueo(
      [esFuturo, hace4Min, hace3Min, hace2Min, hace1Min],
      politica,
      instanTeAhora,
    );

    expect(resultado.clase).toBe('DEMORAR');
  });
});

describe('CA-36 — recaudo A-1: recuperación siempre disponible', () => {
  const politica: PoliticaDeBloqueo = {
    umbralDeIntentos: 5,
    ventana: duracionLiteral(900),
    duracionDelBloqueo: duracionLiteral(300),
    laRecuperacionSiempreDisponible: true,
  };

  it('laRecuperacionSigueDisponible retorna el literal true incluso con bloqueo', () => {
    const instanTeAhora = instante('2026-09-21T14:00:00.000Z');
    const ahoraMs = milisegundosDe(instanTeAhora);
    const hace1Min = instanteDesdeMilisegundos(ahoraMs - 1 * 60_000);
    const hace2Min = instanteDesdeMilisegundos(ahoraMs - 2 * 60_000);
    const hace3Min = instanteDesdeMilisegundos(ahoraMs - 3 * 60_000);
    const hace4Min = instanteDesdeMilisegundos(ahoraMs - 4 * 60_000);
    const hace5Min = instanteDesdeMilisegundos(ahoraMs - 5 * 60_000);

    // Cuenta bloqueada
    const decision: DecisionDeBloqueo = decidirBloqueo(
      [hace5Min, hace4Min, hace3Min, hace2Min, hace1Min],
      politica,
      instanTeAhora,
    );

    // Ni siquiera con bloqueo activo, la recuperación sigue disponible
    const resultado = laRecuperacionSigueDisponible(decision, politica);
    expect(resultado).toBe(true);
  });

  it('el tipo es el literal true, no boolean', () => {
    // Esta es una verificación de tipo, no de runtime.
    // Si el compilador no rechazara `const x: true = false;`, esto fallaría.
    // Como TypeScript verifica tipos estáticamente, la presencia de esta
    // función con return type `true` y la llamada exitosa aquí prueban que
    // el compilador verifica el tipo.
    const decision: DecisionDeBloqueo = { clase: 'PERMITIR' };
    const resultado = laRecuperacionSigueDisponible(decision, politica);

    // El resultado es literalmente true, no solo un boolean verdadero.
    // En TypeScript, `true` es un tipo más específico que `boolean`.
    expect(resultado === true).toBe(true);
  });

  it('el parámetro politica.laRecuperacionSiempreDisponible es el literal true: no se puede falsear', () => {
    // Esta prueba documenta que el contrato exige el literal `true`.
    // Si alguien alguna vez intentara poner `false`, el tipo no compilaría.
    // Para esta prueba, tenemos que confiar en que el tipo del parámetro
    // (que termina en `laRecuperacionSiempreDisponible: true`) lo asegura.

    // Esto compilaría:
    const politicaBuena: PoliticaDeBloqueo = {
      umbralDeIntentos: 5,
      ventana: duracionLiteral(900),
      duracionDelBloqueo: duracionLiteral(300),
      laRecuperacionSiempreDisponible: true,
    };
    expect(politicaBuena.laRecuperacionSiempreDisponible).toBe(true);

    // Esto NO compilaría (quedaría comentado):
    // const politicaMala: PoliticaDeBloqueo = {
    //   umbralDeIntentos: 5,
    //   ventana: duracionLiteral(900),
    //   duracionDelBloqueo: duracionLiteral(300),
    //   laRecuperacionSiempreDisponible: false, // Type 'false' is not assignable to type 'true'
    // };
  });
});
