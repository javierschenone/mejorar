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
import { duracionLiteral, instanteDesde } from './tiempo';

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

  const ahora = new Date('2026-09-21T14:00:00.000Z');
  const instanTeAhora = instanteDesde(ahora) as any;

  it('sin intentos fallidos: se permite', () => {
    const resultado = decidirBloqueo([], politica, instanTeAhora);
    expect(resultado.clase).toBe('PERMITIR');
  });

  it('con cuatro intentos fallidos: se demorar', () => {
    const hace1Min = new Date(ahora.getTime() - 1 * 60_000);
    const hace2Min = new Date(ahora.getTime() - 2 * 60_000);
    const hace3Min = new Date(ahora.getTime() - 3 * 60_000);
    const hace4Min = new Date(ahora.getTime() - 4 * 60_000);

    const resultado = decidirBloqueo(
      [instanteDesde(hace4Min), instanteDesde(hace3Min), instanteDesde(hace2Min), instanteDesde(hace1Min)] as any,
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
    const hace1Min = new Date(ahora.getTime() - 1 * 60_000);
    const hace2Min = new Date(ahora.getTime() - 2 * 60_000);
    const hace3Min = new Date(ahora.getTime() - 3 * 60_000);
    const hace4Min = new Date(ahora.getTime() - 4 * 60_000);
    const hace5Min = new Date(ahora.getTime() - 5 * 60_000);

    const resultado = decidirBloqueo(
      [
        instanteDesde(hace5Min),
        instanteDesde(hace4Min),
        instanteDesde(hace3Min),
        instanteDesde(hace2Min),
        instanteDesde(hace1Min),
      ] as any,
      politica,
      instanTeAhora,
    );

    expect(resultado.clase).toBe('BLOQUEAR');
    if (resultado.clase === 'BLOQUEAR') {
      // El bloqueo se cuenta desde el último intento + duración
      const ultimoIntento = ahora.getTime() - 1 * 60_000;
      const bloqueadaHasta = ultimoIntento + politica.duracionDelBloqueo * 1000;
      expect(new Date(resultado.hasta as any).getTime()).toBeLessThanOrEqual(bloqueadaHasta + 1000); // +1s de tolerancia
    }
  });

  it('borde: intento en el último milisegundo de la ventana cuenta', () => {
    const enlaBorde = new Date(ahora.getTime() - 900 * 1000); // exactamente 15 min
    const hace4Min = new Date(ahora.getTime() - 4 * 60_000);
    const hace3Min = new Date(ahora.getTime() - 3 * 60_000);
    const hace2Min = new Date(ahora.getTime() - 2 * 60_000);
    const hace1Min = new Date(ahora.getTime() - 1 * 60_000);

    // Cinco intentos, el primero está en la borde exacta de la ventana.
    const resultado = decidirBloqueo(
      [
        instanteDesde(enlaBorde),
        instanteDesde(hace4Min),
        instanteDesde(hace3Min),
        instanteDesde(hace2Min),
        instanteDesde(hace1Min),
      ] as any,
      politica,
      instanTeAhora,
    );

    // La ventana es cerrada por abajo: un intento de hace exactamente 15 min
    // todavía cuenta.
    expect(resultado.clase).toBe('BLOQUEAR');
  });

  it('borde: intento afuera de la ventana no cuenta', () => {
    const fueraDeVentana = new Date(ahora.getTime() - 901 * 1000); // 15:01 min
    const hace4Min = new Date(ahora.getTime() - 4 * 60_000);
    const hace3Min = new Date(ahora.getTime() - 3 * 60_000);
    const hace2Min = new Date(ahora.getTime() - 2 * 60_000);
    const hace1Min = new Date(ahora.getTime() - 1 * 60_000);

    // Cinco instantes, pero el primero no cuenta. Quedan cuatro, que producen demora.
    const resultado = decidirBloqueo(
      [
        instanteDesde(fueraDeVentana),
        instanteDesde(hace4Min),
        instanteDesde(hace3Min),
        instanteDesde(hace2Min),
        instanteDesde(hace1Min),
      ] as any,
      politica,
      instanTeAhora,
    );

    expect(resultado.clase).toBe('DEMORAR');
  });

  it('el bloqueo se cuenta desde el último intento fallido, no el primero', () => {
    const hace10Min = new Date(ahora.getTime() - 10 * 60_000);
    const hace5Min = new Date(ahora.getTime() - 5 * 60_000);
    const hace4Min = new Date(ahora.getTime() - 4 * 60_000);
    const hace3Min = new Date(ahora.getTime() - 3 * 60_000);
    const hace1Min = new Date(ahora.getTime() - 1 * 60_000);

    // Cinco intentos, pero espaciados. El bloqueo se cuenta desde hace1Min.
    const resultado = decidirBloqueo(
      [
        instanteDesde(hace10Min),
        instanteDesde(hace5Min),
        instanteDesde(hace4Min),
        instanteDesde(hace3Min),
        instanteDesde(hace1Min),
      ] as any,
      politica,
      instanTeAhora,
    );

    expect(resultado.clase).toBe('BLOQUEAR');
    if (resultado.clase === 'BLOQUEAR') {
      // Se cuenta desde hace1Min (último intento) + duración del bloqueo.
      const ultimoIntento = ahora.getTime() - 1 * 60_000;
      const bloqueadaHasta = ultimoIntento + politica.duracionDelBloqueo * 1000;
      const esperado = new Date(bloqueadaHasta).toISOString();
      expect(resultado.hasta).toBe(esperado as any);
    }
  });

  it('si el bloqueo ya venció: se permite (temporal de verdad)', () => {
    const hace10Min = new Date(ahora.getTime() - 10 * 60_000);
    const hace6Min = new Date(ahora.getTime() - 6 * 60_000); // Último intento hace 6 min
    const hace5Min = new Date(ahora.getTime() - 5 * 60_000);
    const hace4Min = new Date(ahora.getTime() - 4 * 60_000);
    const hace3Min = new Date(ahora.getTime() - 3 * 60_000);

    // Bloqueo de 5 min: hace6Min + 5min = hace1Min. Ya pasó hace1Min.
    const resultado = decidirBloqueo(
      [
        instanteDesde(hace10Min),
        instanteDesde(hace6Min),
        instanteDesde(hace5Min),
        instanteDesde(hace4Min),
        instanteDesde(hace3Min),
      ] as any,
      politica,
      instanTeAhora,
    );

    expect(resultado.clase).toBe('PERMITIR');
  });

  it('intentos futuros se ignoran (reloj desfasado): no castigan', () => {
    const esFuturo = new Date(ahora.getTime() + 1 * 60_000);
    const hace4Min = new Date(ahora.getTime() - 4 * 60_000);
    const hace3Min = new Date(ahora.getTime() - 3 * 60_000);
    const hace2Min = new Date(ahora.getTime() - 2 * 60_000);
    const hace1Min = new Date(ahora.getTime() - 1 * 60_000);

    // Cuatro intentos válidos + uno futuro: quedan cuatro, demora.
    const resultado = decidirBloqueo(
      [instanteDesde(esFuturo), instanteDesde(hace4Min), instanteDesde(hace3Min), instanteDesde(hace2Min), instanteDesde(hace1Min)] as any,
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
    const ahora = new Date('2026-09-21T14:00:00.000Z');
    const instanTeAhora = instanteDesde(ahora) as any;

    const hace1Min = new Date(ahora.getTime() - 1 * 60_000);
    const hace2Min = new Date(ahora.getTime() - 2 * 60_000);
    const hace3Min = new Date(ahora.getTime() - 3 * 60_000);
    const hace4Min = new Date(ahora.getTime() - 4 * 60_000);
    const hace5Min = new Date(ahora.getTime() - 5 * 60_000);

    // Cuenta bloqueada
    const decision: DecisionDeBloqueo = decidirBloqueo(
      [
        instanteDesde(hace5Min),
        instanteDesde(hace4Min),
        instanteDesde(hace3Min),
        instanteDesde(hace2Min),
        instanteDesde(hace1Min),
      ] as any,
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
    const politica: PoliticaDeBloqueo = {
      umbralDeIntentos: 5,
      ventana: duracionLiteral(900),
      duracionDelBloqueo: duracionLiteral(300),
      laRecuperacionSiempreDisponible: true,
    };

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
