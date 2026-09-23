/**
 * Módulo de autorización.
 *
 * Exporta la API pública del sistema de autorización basado en ADR-022.
 */

export { validarRegistroDeRecursosAlArrancar, registroDeRecursos } from './registro';
export type { ExigenciaDelRecursoRegistrada, ResolvedorDeAlcance, AlcanceResuelto, CriterioDeAlcance } from './tipos';

export { autorizar } from './autorizar';
export type { ResultadoDeAutorizacion } from './autorizar';

export { autorizarColeccion } from './autorizar-coleccion';
export type { ResultadoDeAutorizacionColeccion } from './autorizar-coleccion';

export { CacheEnMemoria, GestorCacheDePerfiles } from './cache-perfil';
export type { CacheDePerfiles } from './cache-perfil';
