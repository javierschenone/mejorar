/**
 * CA-32 — el redondeo favorece al cliente cuando la norma no dispone otra cosa,
 * y para `RECLAMO_ESTIMADO` eso significa **hacia abajo** (aclaración v4,
 * escalamiento E-1). ADR-011 §3 y §4.
 */
import { describe, expect, it } from 'vitest';

import type { CitaNormativa, Racional, ReglaRedondeoNormativa, RolDelMonto } from '../contrato/v1';
import { redondear, redondeoEsConsistente, sentidoDeRedondeo } from './redondeo';

/** 1000,004 pesos expresados en centavos: 100000,4 centavos. */
const CON_RESTO_CHICO: Racional = { n: 1_000_004n, d: 10n };
/** 100 centavos exactos: el borde donde no hay nada que redondear. */
const EXACTO: Racional = { n: 100n, d: 1n };
/** 100,5 centavos: el empate exacto. */
const EMPATE: Racional = { n: 201n, d: 2n };

const CITA_DE_PRUEBA: CitaNormativa = {
  tipo: 'LEY',
  identificacion: '00.000 (cita de prueba)',
  articulo: '1',
  inciso: null,
  textoVigenteDesde: null,
  textoVigenteHasta: null,
  urlFuenteOficial: null,
  verificadaEnFuenteOficial: false,
};

const REGLA_AL_PESO: ReglaRedondeoNormativa = {
  sentido: 'AL_MAS_CERCANO',
  unidadEnCentavos: 100n,
  fundamento: CITA_DE_PRUEBA,
};

describe('CA-32 — el sentido del redondeo lo decide el rol del monto', () => {
  it('CA-32: `PISO_DE_PROTECCION` redondea hacia arriba — un piso más alto protege más al cliente', () => {
    const { monto, redondeo } = redondear(CON_RESTO_CHICO, 'ARS', 'PISO_DE_PROTECCION', null);
    expect(monto.centavos).toBe(100_001n);
    expect(redondeo.sentido).toBe('HACIA_ARRIBA');
  });

  it('CA-32: `TECHO_DE_AFECTACION` redondea hacia abajo — es el máximo que un tercero puede retenerle', () => {
    const { monto, redondeo } = redondear(CON_RESTO_CHICO, 'ARS', 'TECHO_DE_AFECTACION', null);
    expect(monto.centavos).toBe(100_000n);
    expect(redondeo.sentido).toBe('HACIA_ABAJO');
  });

  it('CA-32: `TECHO_DE_COBRO_AL_CLIENTE` redondea hacia abajo — es el máximo que se le puede cobrar', () => {
    const { monto, redondeo } = redondear(CON_RESTO_CHICO, 'ARS', 'TECHO_DE_COBRO_AL_CLIENTE', null);
    expect(monto.centavos).toBe(100_000n);
    expect(redondeo.sentido).toBe('HACIA_ABAJO');
  });

  it('CA-32 [v4]: `RECLAMO_ESTIMADO` redondea **hacia abajo** — sobreestimar el reclamo perjudica al cliente', () => {
    const casiUnCentavoMas: Racional = { n: 1_000_009n, d: 10n }; // 100.000,9 centavos
    const { monto, redondeo } = redondear(casiUnCentavoMas, 'ARS', 'RECLAMO_ESTIMADO', null);
    expect(monto.centavos).toBe(100_000n);
    expect(redondeo.sentido).toBe('HACIA_ABAJO');
    expect(redondeo.rol).toBe('RECLAMO_ESTIMADO');
  });

  it('CA-32 [v4]: `RECLAMO_ESTIMADO` no redondea hacia arriba ni siquiera en el empate exacto de medio centavo', () => {
    const { monto } = redondear(EMPATE, 'ARS', 'RECLAMO_ESTIMADO', null);
    expect(monto.centavos).toBe(100n);
  });

  it('CA-32: en el empate exacto, `PISO_DE_PROTECCION` sube — el empate también favorece al cliente', () => {
    const { monto } = redondear(EMPATE, 'ARS', 'PISO_DE_PROTECCION', null);
    expect(monto.centavos).toBe(101n);
  });

  it('CA-32: el valor exacto no se mueve en ningún rol (borde del tope exacto)', () => {
    const roles: readonly RolDelMonto[] = [
      'PISO_DE_PROTECCION',
      'TECHO_DE_AFECTACION',
      'TECHO_DE_COBRO_AL_CLIENTE',
      'RECLAMO_ESTIMADO',
      'SEGUN_NORMA',
    ];
    for (const rol of roles) {
      expect(redondear(EXACTO, 'ARS', rol, null).monto.centavos, `rol ${rol}`).toBe(100n);
    }
  });

  it('CA-32: un centésimo por encima del tope exacto ya mueve el importe según el rol', () => {
    const topeMasUnPoco: Racional = { n: 10_001n, d: 100n }; // 100,01 centavos
    expect(redondear(topeMasUnPoco, 'ARS', 'TECHO_DE_AFECTACION', null).monto.centavos).toBe(100n);
    expect(redondear(topeMasUnPoco, 'ARS', 'PISO_DE_PROTECCION', null).monto.centavos).toBe(101n);
  });

  it('CA-32: el cero se redondea a cero en todos los roles', () => {
    const cero: Racional = { n: 0n, d: 1n };
    expect(redondear(cero, 'ARS', 'PISO_DE_PROTECCION', null).monto.centavos).toBe(0n);
    expect(redondear(cero, 'ARS', 'RECLAMO_ESTIMADO', null).monto.centavos).toBe(0n);
  });

  it('CA-32: conserva la moneda que recibe y no convierte (§7 de la spec)', () => {
    expect(redondear(CON_RESTO_CHICO, 'USD', 'RECLAMO_ESTIMADO', null).monto.moneda).toBe('USD');
    expect(redondear(CON_RESTO_CHICO, 'EUR', 'RECLAMO_ESTIMADO', null).monto.moneda).toBe('EUR');
  });
});

describe('CA-32 — la regla normativa prevalece sobre el rol y viaja en el resultado', () => {
  it('CA-32: con regla normativa se aplica su sentido y su unidad, aunque el rol diga otra cosa', () => {
    const { monto, redondeo } = redondear(
      { n: 15_060n, d: 1n }, // 150,60 pesos
      'ARS',
      'RECLAMO_ESTIMADO',
      { sentido: 'HACIA_ARRIBA', unidadEnCentavos: 100n, fundamento: CITA_DE_PRUEBA },
    );
    expect(monto.centavos).toBe(15_100n);
    expect(redondeo.sentido).toBe('HACIA_ARRIBA');
    expect(redondeo.unidadEnCentavos).toBe(100n);
  });

  it('CA-32: el redondeo aplicado viaja con rol, sentido, unidad y fundamento (auditable)', () => {
    const { redondeo } = redondear(EMPATE, 'ARS', 'SEGUN_NORMA', REGLA_AL_PESO);
    expect(redondeo).toEqual({
      rol: 'SEGUN_NORMA',
      sentido: 'AL_MAS_CERCANO',
      unidadEnCentavos: 100n,
      fundamento: CITA_DE_PRUEBA,
    });
    expect(redondeo.fundamento?.articulo).toBe('1');
  });

  it('CA-32: sin regla normativa el fundamento es nulo y la unidad es el centavo', () => {
    const { redondeo } = redondear(CON_RESTO_CHICO, 'ARS', 'TECHO_DE_AFECTACION', null);
    expect(redondeo.fundamento).toBeNull();
    expect(redondeo.unidadEnCentavos).toBe(1n);
  });

  it('CA-32: redondear al peso entero cuando la norma lo manda', () => {
    expect(redondear({ n: 15_049n, d: 1n }, 'ARS', 'SEGUN_NORMA', REGLA_AL_PESO).monto.centavos).toBe(15_000n);
    expect(redondear({ n: 15_051n, d: 1n }, 'ARS', 'SEGUN_NORMA', REGLA_AL_PESO).monto.centavos).toBe(15_100n);
  });

  it('`SEGUN_NORMA` sin regla queda marcado como inconsistente y no se disfraza de resultado normal', () => {
    const { redondeo } = redondear(CON_RESTO_CHICO, 'ARS', 'SEGUN_NORMA', null);
    expect(redondeo.fundamento).toBeNull();
    expect(redondeoEsConsistente(redondeo)).toBe(false);
    const conRegla = redondear(CON_RESTO_CHICO, 'ARS', 'SEGUN_NORMA', REGLA_AL_PESO).redondeo;
    expect(redondeoEsConsistente(conRegla)).toBe(true);
  });

  it('una unidad de redondeo no positiva no rompe el cálculo: cae al centavo y lo declara', () => {
    const { monto, redondeo } = redondear(CON_RESTO_CHICO, 'ARS', 'TECHO_DE_AFECTACION', {
      sentido: 'HACIA_ABAJO',
      unidadEnCentavos: 0n,
      fundamento: CITA_DE_PRUEBA,
    });
    expect(redondeo.unidadEnCentavos).toBe(1n);
    expect(monto.centavos).toBe(100_000n);
  });
});

describe('redondeo — signo, tabla de sentidos y determinismo', () => {
  it('conserva el signo con semántica matemática: hacia arriba es hacia +∞ y hacia abajo es hacia −∞', () => {
    const negativoConResto: Racional = { n: -1_005n, d: 10n }; // −100,5 centavos
    expect(redondear(negativoConResto, 'ARS', 'PISO_DE_PROTECCION', null).monto.centavos).toBe(-100n);
    expect(redondear(negativoConResto, 'ARS', 'TECHO_DE_AFECTACION', null).monto.centavos).toBe(-101n);
  });

  it('la tabla de sentidos por rol es la de CA-32 y no depende del sitio de llamada', () => {
    expect(sentidoDeRedondeo('PISO_DE_PROTECCION', null)).toBe('HACIA_ARRIBA');
    expect(sentidoDeRedondeo('TECHO_DE_AFECTACION', null)).toBe('HACIA_ABAJO');
    expect(sentidoDeRedondeo('TECHO_DE_COBRO_AL_CLIENTE', null)).toBe('HACIA_ABAJO');
    expect(sentidoDeRedondeo('RECLAMO_ESTIMADO', null)).toBe('HACIA_ABAJO');
    expect(sentidoDeRedondeo('RECLAMO_ESTIMADO', REGLA_AL_PESO)).toBe('AL_MAS_CERCANO');
  });

  it('CA-31: redondear dos veces la misma entrada da exactamente el mismo resultado', () => {
    const primera = redondear(CON_RESTO_CHICO, 'ARS', 'RECLAMO_ESTIMADO', REGLA_AL_PESO);
    const segunda = redondear(CON_RESTO_CHICO, 'ARS', 'RECLAMO_ESTIMADO', REGLA_AL_PESO);
    expect(segunda).toEqual(primera);
  });
});
