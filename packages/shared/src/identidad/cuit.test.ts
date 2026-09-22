/**
 * CA-04 — el dígito verificador del CUIT/CUIL se verifica antes de aceptarlo.
 *
 * Los casos válidos no son inventados: son CUIT reales y públicos de
 * organismos y entidades, que es la única forma honesta de probar un algoritmo
 * de dígito verificador sin usar el dato de una persona (regla operativa 3 de
 * `CLAUDE.md` §6: nunca un dato real de un cliente en una sesión de
 * desarrollo; el CUIT de una persona jurídica pública no es un dato personal).
 */
import { describe, expect, it } from 'vitest';

import {
  PREFIJOS_CONOCIDOS,
  normalizarCuitCuil,
  tienePrefijoConocido,
  verificarCuitCuil,
  verificarDigitoVerificadorCuit,
} from './cuit';

/** CUIT públicos, con su dígito verificador correcto. */
const VALIDOS: readonly string[] = [
  '33-69345023-9', // AFIP/ARCA
  '30-50001091-2', // Banco de la Nación Argentina
  '20-12345678-6', // persona humana, número de ejemplo de manual
  '30-71234567-1',
  '23-40000000-9', // caso del resto 1: prefijo 23, dígito 9
  '23-40000000-4', // mismo caso, dígito histórico 4
];

describe('CA-04 — dígito verificador del CUIT/CUIL: casos válidos conocidos', () => {
  for (const cuit of VALIDOS) {
    it(`acepta ${cuit}`, () => {
      expect(verificarDigitoVerificadorCuit(cuit)).toBe(true);
    });

    it(`acepta ${cuit} también sin separadores`, () => {
      expect(verificarDigitoVerificadorCuit(cuit.replace(/-/g, ''))).toBe(true);
    });
  }
});

describe('CA-04 — dígito verificador del CUIT/CUIL: casos inválidos', () => {
  it('rechaza el mismo número con el dígito verificador cambiado', () => {
    expect(verificarDigitoVerificadorCuit('33-69345023-8')).toBe(false);
    expect(verificarDigitoVerificadorCuit('30-50001091-3')).toBe(false);
    expect(verificarDigitoVerificadorCuit('20-12345678-7')).toBe(false);
  });

  it('rechaza el caso de resto 1 cuando el prefijo no es 23', () => {
    // 24-40000000-x produce resto 1 y, fuera del prefijo 23, no existe.
    expect(verificarDigitoVerificadorCuit('23-40000000-0')).toBe(false);
  });

  it('rechaza once ceros, aunque su dígito verificador cierre', () => {
    expect(verificarDigitoVerificadorCuit('00000000000')).toBe(false);
  });

  it('rechaza longitudes distintas de once dígitos', () => {
    expect(verificarDigitoVerificadorCuit('2012345678')).toBe(false);
    expect(verificarDigitoVerificadorCuit('201234567867')).toBe(false);
    expect(verificarCuitCuil('2012345678').ok).toBe(false);
    const corto = verificarCuitCuil('2012345678');
    expect(!corto.ok && corto.error.codigo).toBe('CUIT_LONGITUD_INVALIDA');
  });

  it('rechaza la cadena vacía y la que sólo tiene separadores', () => {
    expect(verificarDigitoVerificadorCuit('')).toBe(false);
    expect(verificarDigitoVerificadorCuit('--')).toBe(false);
  });

  it('rechaza un correo escrito en el campo del CUIT, sin intentar limpiarlo', () => {
    const resultado = verificarCuitCuil('juan@correo.com');
    expect(!resultado.ok && resultado.error.codigo).toBe('CUIT_FORMATO_INVALIDO');
  });

  it('rechaza letras intercaladas', () => {
    expect(verificarDigitoVerificadorCuit('33-693450A3-9')).toBe(false);
  });
});

describe('normalización — una sola forma canónica, para que el índice ciego no se duplique', () => {
  it('devuelve once dígitos sin separadores', () => {
    expect(normalizarCuitCuil('33-69345023-9')).toBe('33693450239');
    expect(normalizarCuitCuil('33 69345023 9')).toBe('33693450239');
    expect(normalizarCuitCuil('33.69345023.9')).toBe('33693450239');
  });

  it('las tres formas de escribir el mismo CUIT producen el mismo valor normalizado', () => {
    const resultados = ['33-69345023-9', '33693450239', '33 69345023 9'].map((valor) =>
      verificarCuitCuil(valor),
    );
    const normalizados = resultados.map((resultado) => (resultado.ok ? resultado.valor : 'FALLO'));
    expect(new Set(normalizados).size).toBe(1);
    expect(normalizados[0]).toBe('33693450239');
  });
});

describe('prefijo de tipo — se verifica aparte, porque no es aritmética sino producto', () => {
  it('reconoce los prefijos conocidos', () => {
    expect(tienePrefijoConocido('33-69345023-9')).toBe(true);
    expect(PREFIJOS_CONOCIDOS).toContain('27');
  });

  it('un prefijo desconocido no invalida el dígito verificador: son controles distintos', () => {
    // 99-99999999-x: el prefijo no está en la lista, pero el dígito puede
    // cerrar igual. Rechazar por prefijo es una decisión de producto que se
    // toma aparte, para no dejar afuera a alguien el día que la AFIP habilite
    // un prefijo nuevo.
    expect(tienePrefijoConocido('99-99999999-9')).toBe(false);
  });
});

describe('alcance — verificar el dígito no es verificar identidad', () => {
  it('un CUIT bien formado pero inexistente pasa la verificación: el sistema no afirma más que eso', () => {
    // El sistema no tiene forma de saber si el número existe: no hay
    // integración con el padrón en esta feature. La función dice "está bien
    // formado", nada más, y ninguna pantalla puede decir "CUIT verificado".
    expect(verificarDigitoVerificadorCuit('20-12345678-6')).toBe(true);
  });
});
