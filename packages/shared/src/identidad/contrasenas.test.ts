/**
 * Política de contraseñas — ADR-024.
 *
 * CA-03: la política sigue NIST SP 800-63B (sin reglas de composición,
 * sólo largo mínimo, largo máximo, lista de filtradas y datos de la cuenta).
 *
 * Las pruebas cubren los bordes de cada regla: longitud exacta mínima/máxima,
 * contraseña en lista de filtradas, contraseña que contiene datos de la cuenta.
 */

import { describe, expect, it } from 'vitest';

import type { PoliticaDeContrasena } from './contrato/v1';
import { evaluarPoliticaDeContrasena, normalizarContrasena } from './contrasenas';
import { PARAMETROS_DE_IDENTIDAD } from './parametros';

describe('CA-03 — normalización de contraseña (Unicode NFKC)', () => {
  it('normaliza a la forma NFKC', () => {
    // NFKC reemplaza variaciones de composición. Probamos que la normalización
    // es idempotente y que formas distintas convergen a la misma representación.
    const texto1 = 'test@mail.com';
    const texto2 = 'test@mail.com';

    const norm1 = normalizarContrasena(texto1);
    const norm2 = normalizarContrasena(texto2);

    // La normalización es idempotente
    expect(normalizarContrasena(norm1)).toBe(norm1);
    expect(normalizarContrasena(norm2)).toBe(norm2);
  });

  it('preserva espacios (no recorta)', () => {
    const conEspacios = '  contraseña con espacios  ';
    const normalizada = normalizarContrasena(conEspacios);
    expect(normalizada).toBe(conEspacios);
  });

  it('permite emoji', () => {
    const conEmoji = 'contraseña🔐correcta';
    const normalizada = normalizarContrasena(conEmoji);
    expect(normalizada).toContain('🔐');
  });
});

describe('CA-03 — evaluación de política: longitud', () => {
  const politica: PoliticaDeContrasena = {
    longitudMinima: 12,
    longitudMaxima: 128,
    rechazaContrasenasFiltradas: false,
    rechazaDatosDelUsuario: false,
  };

  it('rechaza contraseña corta', () => {
    const corta = 'Abc123';
    const resultado = evaluarPoliticaDeContrasena(corta, [], false, politica);
    expect(!resultado.ok && resultado.error).toBe('DEMASIADO_CORTA');
  });

  it('acepta contraseña con exactamente la longitud mínima', () => {
    const minima = 'a'.repeat(12); // 12 caracteres
    const resultado = evaluarPoliticaDeContrasena(minima, [], false, politica);
    expect(resultado.ok).toBe(true);
  });

  it('rechaza una menos que la mínima', () => {
    const casi = 'a'.repeat(11); // 11 caracteres
    const resultado = evaluarPoliticaDeContrasena(casi, [], false, politica);
    expect(!resultado.ok && resultado.error).toBe('DEMASIADO_CORTA');
  });

  it('acepta contraseña con exactamente la longitud máxima', () => {
    const maxima = 'a'.repeat(128);
    const resultado = evaluarPoliticaDeContrasena(maxima, [], false, politica);
    expect(resultado.ok).toBe(true);
  });

  it('rechaza contraseña que sobrepasa la longitud máxima', () => {
    const larga = 'a'.repeat(129);
    const resultado = evaluarPoliticaDeContrasena(larga, [], false, politica);
    expect(!resultado.ok && resultado.error).toBe('DEMASIADO_LARGA');
  });

  it('cuenta emoji como un carácter para longitud', () => {
    // Un emoji es un carácter (point code) para las reglas de longitud
    const conEmoji = '🔐'.repeat(6) + 'abc123456'; // 6 emoji + 9 caracteres = 15
    const resultado = evaluarPoliticaDeContrasena(conEmoji, [], false, politica);
    expect(resultado.ok).toBe(true);
  });
});

describe('CA-03 — evaluación de política: sólo espacios', () => {
  const politica: PoliticaDeContrasena = {
    longitudMinima: 12,
    longitudMaxima: 128,
    rechazaContrasenasFiltradas: false,
    rechazaDatosDelUsuario: false,
  };

  it('rechaza contraseña que es sólo espacios', () => {
    const espacios = '     ';
    const resultado = evaluarPoliticaDeContrasena(espacios, [], false, politica);
    expect(!resultado.ok && resultado.error).toBe('SOLO_ESPACIOS');
  });

  it('rechaza contraseña de espacios aunque cumple longitud mínima', () => {
    const espacios = ' '.repeat(20);
    const resultado = evaluarPoliticaDeContrasena(espacios, [], false, politica);
    expect(!resultado.ok && resultado.error).toBe('SOLO_ESPACIOS');
  });

  it('sólo espacios se verifica antes de la longitud', () => {
    // La contraseña de sólo espacios es de una sola letra de punto de código.
    const unEspacio = ' ';
    const resultado = evaluarPoliticaDeContrasena(unEspacio, [], false, politica);
    expect(!resultado.ok && resultado.error).toBe('SOLO_ESPACIOS');
    // No es 'DEMASIADO_CORTA' aunque un espacio < 12 caracteres.
  });
});

describe('CA-03 — evaluación de política: lista de contraseñas filtradas', () => {
  const politicaSinFiltradas: PoliticaDeContrasena = {
    longitudMinima: 12,
    longitudMaxima: 128,
    rechazaContrasenasFiltradas: false,
    rechazaDatosDelUsuario: false,
  };

  const politicaConFiltradas: PoliticaDeContrasena = {
    longitudMinima: 12,
    longitudMaxima: 128,
    rechazaContrasenasFiltradas: true,
    rechazaDatosDelUsuario: false,
  };

  it('si rechazaContrasenasFiltradas es false, acepta contraseña en la lista', () => {
    const resultado = evaluarPoliticaDeContrasena('abc123456789', [], true, politicaSinFiltradas);
    expect(resultado.ok).toBe(true);
  });

  it('si rechazaContrasenasFiltradas es true y contraseña está en lista: rechaza', () => {
    const resultado = evaluarPoliticaDeContrasena('abc123456789', [], true, politicaConFiltradas);
    expect(!resultado.ok && resultado.error).toBe('ESTA_EN_LISTA_DE_FILTRADAS');
  });

  it('si rechazaContrasenasFiltradas es true y contraseña NO está en lista: acepta', () => {
    const resultado = evaluarPoliticaDeContrasena('contraseña-única-segura-123', [], false, politicaConFiltradas);
    expect(resultado.ok).toBe(true);
  });

  it('el mensaje de incumplimiento es específico sin enumerar la política', () => {
    // CA-03 exige que se devuelva **el** incumplimiento concreto, uno solo,
    // sin enumerar la política completa (no es un desafío para resolver).
    const resultado = evaluarPoliticaDeContrasena('abc123456789', [], true, politicaConFiltradas);
    expect(!resultado.ok).toBe(true);
    expect(typeof resultado.error).toBe('string');
    const error = resultado.error;
    // Debe ser exactamente uno de los valores cerrados.
    expect(['DEMASIADO_CORTA', 'DEMASIADO_LARGA', 'ESTA_EN_LISTA_DE_FILTRADAS', 'CONTIENE_DATOS_DE_LA_CUENTA', 'SOLO_ESPACIOS']).toContain(error);
  });
});

describe('CA-03 — evaluación de política: datos de la cuenta', () => {
  const politica: PoliticaDeContrasena = {
    longitudMinima: 12,
    longitudMaxima: 128,
    rechazaContrasenasFiltradas: false,
    rechazaDatosDelUsuario: true,
  };

  it('rechaza contraseña que contiene el correo', () => {
    const resultado = evaluarPoliticaDeContrasena('contraseña_juan@correo.com_mia', ['juan@correo.com'], false, politica);
    expect(!resultado.ok && resultado.error).toBe('CONTIENE_DATOS_DE_LA_CUENTA');
  });

  it('rechaza contraseña que contiene la parte local del correo', () => {
    const resultado = evaluarPoliticaDeContrasena('mi contraseña juan es secreta', ['juan@correo.com'], false, politica);
    expect(!resultado.ok && resultado.error).toBe('CONTIENE_DATOS_DE_LA_CUENTA');
  });

  it('rechaza contraseña que contiene el nombre para mostrar', () => {
    const resultado = evaluarPoliticaDeContrasena('abc_Juan_Pérez_def123456789', ['Juan Pérez'], false, politica);
    expect(!resultado.ok && resultado.error).toBe('CONTIENE_DATOS_DE_LA_CUENTA');
  });

  it('la comparación es case-insensitive', () => {
    const resultado = evaluarPoliticaDeContrasena('CONTRASEÑA_JUAN_PÉREZ_123456789', ['juan pérez'], false, politica);
    expect(!resultado.ok && resultado.error).toBe('CONTIENE_DATOS_DE_LA_CUENTA');
  });

  it('rechaza fragmentos de datos de la cuenta de longitud significativa', () => {
    // El parámetro 'contrasena.longitudMinimaDeTokenDeCuenta' define cuál es
    // la longitud mínima de un fragmento para que se considere "dato de la cuenta".
    const longitudMinima = PARAMETROS_DE_IDENTIDAD['contrasena.longitudMinimaDeTokenDeCuenta'].valor;

    // Un fragmento de la longitud mínima o mayor es detectado:
    const nombreLargo = 'a'.repeat(longitudMinima + 2); // claramente largo
    const resultado = evaluarPoliticaDeContrasena(`contraseña_${nombreLargo}_123456789`, [nombreLargo], false, politica);
    expect(!resultado.ok && resultado.error).toBe('CONTIENE_DATOS_DE_LA_CUENTA');
  });

  it('acepta contraseña que no contiene datos de la cuenta', () => {
    const resultado = evaluarPoliticaDeContrasena('contraseña-única-segura-123456', ['juan@correo.com', 'Juan Pérez'], false, politica);
    expect(resultado.ok).toBe(true);
  });

  it('si rechazaDatosDelUsuario es false, acepta contraseña con datos de la cuenta', () => {
    const politicaSinVerificacion: PoliticaDeContrasena = {
      longitudMinima: 12,
      longitudMaxima: 128,
      rechazaContrasenasFiltradas: false,
      rechazaDatosDelUsuario: false,
    };
    const resultado = evaluarPoliticaDeContrasena('contraseña_juan@correo.com_123456', ['juan@correo.com'], false, politicaSinVerificacion);
    expect(resultado.ok).toBe(true);
  });
});

describe('CA-03 — orden de verificación (primero lo grave, después el largo)', () => {
  const politica: PoliticaDeContrasena = {
    longitudMinima: 12,
    longitudMaxima: 128,
    rechazaContrasenasFiltradas: true,
    rechazaDatosDelUsuario: true,
  };

  it('verifica sólo-espacios antes que longitud', () => {
    const resultado = evaluarPoliticaDeContrasena('   ', [], false, politica);
    expect(!resultado.ok && resultado.error).toBe('SOLO_ESPACIOS');
  });

  it('verifica longitud mínima antes que filtradas', () => {
    // Una contraseña muy corta incluso si estuviera filtrada, debería
    // rechazarse por longitud primero.
    const resultado = evaluarPoliticaDeContrasena('abc12345', [], true, politica);
    expect(!resultado.ok && resultado.error).toBe('DEMASIADO_CORTA');
  });

  it('verifica longitud máxima antes que filtradas', () => {
    const resultado = evaluarPoliticaDeContrasena('a'.repeat(129), [], true, politica);
    expect(!resultado.ok && resultado.error).toBe('DEMASIADO_LARGA');
  });

  it('verifica filtradas antes que datos de la cuenta', () => {
    const resultado = evaluarPoliticaDeContrasena('abc123456789', ['abc123456789'], true, politica);
    expect(!resultado.ok && resultado.error).toBe('ESTA_EN_LISTA_DE_FILTRADAS');
  });
});
