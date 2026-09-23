/**
 * Caché de perfil de autorización con invalidación por versión.
 *
 * Implementa ADR-022 capa 2: "derivarPermisos corre en cada petición y lee de una
 * caché con versión por usuario". Toda escritura que cambie rol, estado de cuenta,
 * estado de MFA, historia de matrícula o ajustes de permiso **incrementa la versión**.
 *
 * Efecto inmediato de CA-30 sin caché venenosa (CA-30: suspender una matrícula
 * corta el acceso al instante).
 */

import type { PerfilDeAutorizacion } from '@mejorar/shared/identidad/contrato/v1';

/**
 * Clave de caché: `perfil:{usuarioId}`.
 * Se invalida cuando la versión cambia.
 */
function claveDeCache(usuarioId: string): string {
  return `perfil:${usuarioId}`;
}

/**
 * Clave de versión: `perfil:version:{usuarioId}`.
 * Se incrementa cada vez que cambia el perfil.
 */
function claveDeVersion(usuarioId: string): string {
  return `perfil:version:${usuarioId}`;
}

/**
 * Estructura almacenada en caché.
 */
interface PerfilEnCache {
  readonly perfil: PerfilDeAutorizacion;
  readonly version: number;
}

/**
 * Interfaz de caché (abstracción para Redis).
 */
export interface CacheDePerfiles {
  get(clave: string): Promise<PerfilEnCache | null>;
  set(clave: string, valor: PerfilEnCache, ttlSegundos?: number): Promise<void>;
  getVersion(usuarioId: string): Promise<number>;
  incrementarVersion(usuarioId: string): Promise<number>;
}

/**
 * Implementación en memoria (para pruebas y desarrollo sin Redis).
 */
export class CacheEnMemoria implements CacheDePerfiles {
  private datos: Map<string, PerfilEnCache> = new Map();
  private versiones: Map<string, number> = new Map();

  async get(clave: string): Promise<PerfilEnCache | null> {
    return this.datos.get(clave) || null;
  }

  async set(clave: string, valor: PerfilEnCache, ttlSegundos?: number): Promise<void> {
    this.datos.set(clave, valor);
    if (ttlSegundos && typeof ttlSegundos === 'number') {
      setTimeout(() => this.datos.delete(clave), ttlSegundos * 1000);
    }
  }

  async getVersion(usuarioId: string): Promise<number> {
    return this.versiones.get(usuarioId) || 0;
  }

  async incrementarVersion(usuarioId: string): Promise<number> {
    const ver = (this.versiones.get(usuarioId) || 0) + 1;
    this.versiones.set(usuarioId, ver);
    return ver;
  }
}

/**
 * Gestor de caché de perfiles.
 */
export class GestorCacheDePerfiles {
  private cache: CacheDePerfiles;
  private ttl: number; // segundos

  constructor(cache: CacheDePerfiles, ttlSegundos: number = 3600) {
    this.cache = cache;
    this.ttl = ttlSegundos;
  }

  /**
   * Obtiene el perfil de un usuario, validando versión.
   * Si la versión en caché no coincide con la actual, retorna null (miss).
   */
  async obtener(usuarioId: string): Promise<PerfilDeAutorizacion | null> {
    const clave = claveDeCache(usuarioId);
    const enCache = await this.cache.get(clave);

    if (!enCache) return null;

    const versionActual = await this.cache.getVersion(usuarioId);
    if (enCache.version !== versionActual) {
      // Versión cambió; caché inválido
      return null;
    }

    return enCache.perfil;
  }

  /**
   * Guarda el perfil en caché con su versión actual.
   */
  async guardar(usuarioId: string, perfil: PerfilDeAutorizacion): Promise<void> {
    const clave = claveDeCache(usuarioId);
    const version = await this.cache.getVersion(usuarioId);

    await this.cache.set(clave, { perfil, version }, this.ttl);
  }

  /**
   * Invalida el caché de un usuario incrementando su versión.
   * Se llama al cambiar rol, estado de cuenta, MFA, o matrícula.
   */
  async invalidar(usuarioId: string): Promise<void> {
    await this.cache.incrementarVersion(usuarioId);
  }
}
