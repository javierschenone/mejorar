/**
 * Tipos de base para el módulo de autorización.
 *
 * Implementa ADR-022: la autorización es una capacidad tipada por permiso y recurso.
 * El contexto no tiene rol, y la prueba es el único argumento que la capa de datos
 * acepta.
 *
 * Nota sobre inconstruibilidad:
 * El tipo `Autorizacion<P, T>` se garantiza inconstruible fuera de `autorizar.ts` mediante
 * una marca privada (Symbol). Sin embargo, usar `as Autorizacion<P, T>` en otros módulos
 * puede bypassear esta garantía. Una futura mejora sería enforcar esto con:
 * - Un símbolo único por constructor (`marcaAutorizacionPrivada` en `autorizar.ts`)
 * - Una regla de lint que prohíba `as Autorizacion` fuera del módulo
 * - O una clase privada con constructor sellado
 * Por ahora es una garantía de convención, no de compilador.
 */

import type {
  Autorizacion,
  ClasificacionDato,
  ContextoDeAcceso,
  DuracionEnSegundos,
  ExigenciaDelRecurso,
  FiltroDeAlcance,
  IdEventoAuditoria,
  IdRecurso,
  IdSesion,
  IdUsuario,
  Instante,
  Permiso,
  TipoRecurso,
} from '@mejorar/shared/identidad/contrato/v1';

/**
 * Registro de tipos de recurso con sus exigencias de autorización.
 * Se valida al arrancar: si falta la clasificación, el proceso no levanta.
 */
export interface ExigenciaDelRecursoRegistrada extends ExigenciaDelRecurso {
  readonly tipo: TipoRecurso;
}

/**
 * Resolvedor de alcance para un tipo de recurso.
 * Determina si un sujeto tiene acceso a un recurso específico.
 */
export interface ResolvedorDeAlcance {
  readonly tipo: TipoRecurso;
  resolver(
    sujeto: IdUsuario,
    idRecurso: IdRecurso<any>,
    momento: Instante,
  ): Promise<AlcanceResuelto>;
}

/**
 * Resultado de resolver el alcance. Traducido del contrato §3.
 *
 * Extensión local: incluimos `titularRecurso` en `ES_TITULAR` y `ESTA_ASIGNADO` para poder
 * emitir eventos de auditoría con `titularAfectado` correcto (CA-21, ADR-028).
 * En `ES_TITULAR`, es siempre el mismo sujeto. En `ESTA_ASIGNADO`, es el dueño real del recurso.
 */
export type AlcanceResuelto =
  | { readonly clase: 'ES_TITULAR'; readonly titularRecurso: IdUsuario }
  | { readonly clase: 'ESTA_ASIGNADO'; readonly desde: Instante; readonly titularRecurso: IdUsuario }
  | { readonly clase: 'ALCANCE_GLOBAL' }
  | { readonly clase: 'SIN_RELACION' }
  | { readonly clase: 'COLECCION'; readonly criterio: CriterioDeAlcance };

export type CriterioDeAlcance =
  | { readonly clase: 'TODOS' }
  | { readonly clase: 'PROPIOS'; readonly titular: IdUsuario }
  | { readonly clase: 'ASIGNADOS'; readonly profesional: IdUsuario; readonly vigentesAl: Instante }
  | { readonly clase: 'NINGUNO' };

/**
 * Solicitud de autorización sobre un recurso individual.
 */
export interface SolicitudDeAutorizacion<P extends Permiso, T extends TipoRecurso> {
  readonly permiso: P;
  readonly tipo: T;
  readonly id: IdRecurso<T>;
}

/**
 * Solicitud de autorización sobre una colección.
 */
export interface SolicitudDeAutorizacionColeccion<P extends Permiso, T extends TipoRecurso> {
  readonly permiso: P;
  readonly tipo: T;
}

/**
 * Error de autorización.
 */
export interface ErrorDeAutorizacion {
  readonly clase: 'CLASIFICACION_AUSENTE' | 'AUTORIZACION_DENEGADA' | 'ERROR_INTERNO';
  readonly motivo?: string;
}
