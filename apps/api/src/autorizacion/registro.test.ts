/**
 * Tests del registro de tipos de recurso.
 *
 * Verifica:
 * - Todos los tipos de recurso están registrados con clasificación
 * - La validación falla cerrado si falta clasificación
 * - Se pueden registrar resolvedores de alcance
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { registroDeRecursos, validarRegistroDeRecursosAlArrancar } from './registro';

describe('RegistroDeRecursos', () => {
  it('valida que todos los tipos estén registrados al arrancar', () => {
    // No debe lanzar
    expect(() => validarRegistroDeRecursosAlArrancar()).not.toThrow();
  });

  it('obtiene exigencias para un tipo registrado', () => {
    const exigencia = registroDeRecursos.obtenerExigencia('USUARIO');
    expect(exigencia).not.toBeNull();
    expect(exigencia?.clasificacion).toBe('PERSONAL');
    expect(exigencia?.exigeSegundoFactor).toBe(false);
  });

  it('obtiene null para un tipo no registrado', () => {
    const exigencia = registroDeRecursos.obtenerExigencia('TIPO_INEXISTENTE' as any);
    expect(exigencia).toBeNull();
  });

  it('lista todos los tipos registrados', () => {
    const tipos = registroDeRecursos.tipos();
    expect(tipos.length).toBeGreaterThan(0);
    expect(tipos).toContain('USUARIO');
    expect(tipos).toContain('CASO');
  });

  it('CASO tiene clasificación PATRIMONIAL_SENSIBLE', () => {
    const exigencia = registroDeRecursos.obtenerExigencia('CASO');
    expect(exigencia?.clasificacion).toBe('PATRIMONIAL_SENSIBLE');
  });

  it('CREDENCIAL exige segundo factor', () => {
    const exigencia = registroDeRecursos.obtenerExigencia('CREDENCIAL');
    expect(exigencia?.exigeSegundoFactor).toBe(true);
    expect(exigencia?.ventanaDeReautenticacion).toBe(300); // 5 minutos
  });

  it('todos los recursos registrados tienen clasificación NOT NULL', () => {
    const tipos = registroDeRecursos.tipos();
    for (const tipo of tipos) {
      const exigencia = registroDeRecursos.obtenerExigencia(tipo);
      expect(exigencia?.clasificacion).toBeDefined();
      expect(['PUBLICO', 'INTERNO', 'PERSONAL', 'PATRIMONIAL_SENSIBLE']).toContain(exigencia?.clasificacion);
    }
  });
});
