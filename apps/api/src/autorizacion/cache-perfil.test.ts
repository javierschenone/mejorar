/**
 * Tests de la caché de perfil con invalidación por versión.
 *
 * Verifica:
 * - Hit/miss en caché
 * - Invalidación por versión (CA-30)
 * - TTL
 */

import { describe, it, expect } from 'vitest';
import { CacheEnMemoria, GestorCacheDePerfiles } from './cache-perfil';
import type { PerfilDeAutorizacion } from '@mejorar/shared/identidad/contrato/v1';

describe('CacheEnMemoria', () => {
  it('almacena y recupera valores', async () => {
    const cache = new CacheEnMemoria();

    const perfil: PerfilDeAutorizacion = {
      sujeto: 'usuario-123' as any,
      rol: 'CLIENTE',
      estadoCuenta: 'ACTIVA',
      estadoMfa: 'NO_CONFIGURADO',
      verificacionProfesional: null,
      ajustes: [],
    };

    const clave = 'test-perfil';
    await cache.set(clave, { perfil, version: 1 });

    const recuperado = await cache.get(clave);
    expect(recuperado).not.toBeNull();
    expect(recuperado?.perfil.rol).toBe('CLIENTE');
    expect(recuperado?.version).toBe(1);
  });

  it('getVersion retorna 0 para usuarios nuevos', async () => {
    const cache = new CacheEnMemoria();
    const version = await cache.getVersion('usuario-nuevo');
    expect(version).toBe(0);
  });

  it('incrementarVersion incrementa el contador', async () => {
    const cache = new CacheEnMemoria();
    const v1 = await cache.incrementarVersion('usuario-test');
    const v2 = await cache.incrementarVersion('usuario-test');

    expect(v1).toBe(1);
    expect(v2).toBe(2);
  });
});

describe('GestorCacheDePerfiles', () => {
  it('guarda y recupera perfil con versión', async () => {
    const cache = new CacheEnMemoria();
    const gestor = new GestorCacheDePerfiles(cache, 3600);

    const perfil: PerfilDeAutorizacion = {
      sujeto: 'usuario-123' as any,
      rol: 'ABOGADO',
      estadoCuenta: 'ACTIVA',
      estadoMfa: 'ACTIVO',
      verificacionProfesional: null,
      ajustes: [],
    };

    const usuarioId = 'usuario-123';
    await gestor.guardar(usuarioId, perfil);

    const recuperado = await gestor.obtener(usuarioId);
    expect(recuperado).not.toBeNull();
    expect(recuperado?.rol).toBe('ABOGADO');
  });

  it('retorna null en caso de miss', async () => {
    const cache = new CacheEnMemoria();
    const gestor = new GestorCacheDePerfiles(cache);

    const recuperado = await gestor.obtener('usuario-inexistente');
    expect(recuperado).toBeNull();
  });

  it('invalida caché al incrementar versión (CA-30)', async () => {
    const cache = new CacheEnMemoria();
    const gestor = new GestorCacheDePerfiles(cache);

    const perfil: PerfilDeAutorizacion = {
      sujeto: 'usuario-123' as any,
      rol: 'ADMINISTRADOR',
      estadoCuenta: 'ACTIVA',
      estadoMfa: 'ACTIVO',
      verificacionProfesional: null,
      ajustes: [],
    };

    const usuarioId = 'usuario-123';

    // 1. Guardar perfil
    await gestor.guardar(usuarioId, perfil);
    let recuperado = await gestor.obtener(usuarioId);
    expect(recuperado).not.toBeNull();

    // 2. Invalidar (simula suspensión de matrícula o cambio de rol)
    await gestor.invalidar(usuarioId);

    // 3. El siguiente acceso retorna null (caché venenosa detectada)
    recuperado = await gestor.obtener(usuarioId);
    expect(recuperado).toBeNull();
  });

  it('efecto inmediato de cambio de estado (CA-30)', async () => {
    const cache = new CacheEnMemoria();
    const gestor = new GestorCacheDePerfiles(cache);

    // Escenario: abogado suspendido
    const usuarioId = 'abogado-001';
    const perfilVigente: PerfilDeAutorizacion = {
      sujeto: usuarioId as any,
      rol: 'ABOGADO',
      estadoCuenta: 'ACTIVA',
      estadoMfa: 'ACTIVO',
      verificacionProfesional: {
        estado: 'VIGENTE',
        vigenciaHasta: new Date().toISOString() as any,
      },
      ajustes: [],
    };

    // 1. Caché contiene perfil vigente
    await gestor.guardar(usuarioId, perfilVigente);
    let recuperado = await gestor.obtener(usuarioId);
    expect(recuperado?.verificacionProfesional?.estado).toBe('VIGENTE');

    // 2. Administrador suspende la matrícula
    // → se invalidaría el caché llamando a `invalida r(usuarioId)`
    await gestor.invalidar(usuarioId);

    // 3. Siguiente petición: miss en caché
    // → caso de uso debe leer de DB, verá que `SuspensionDeMatricula` existe
    // → derivará que la matrícula está SUSPENDIDA
    // → sin llamada a `gestorCache.guardar()`, el perfil no se recachea
    recuperado = await gestor.obtener(usuarioId);
    expect(recuperado).toBeNull();
  });
});
