/**
 * Emisor de eventos de auditoría.
 *
 * Implementa ADR-028: "La auditoría es un efecto de autorizar, no una línea que acordarse
 * de escribir en cada caso de uso".
 *
 * - Para `PERSONAL` y `PATRIMONIAL_SENSIBLE`, el evento se escribe **antes** de entregar
 *   el dato, en la misma conexión.
 * - Si la escritura falla, la petición falla con 503: un acceso no auditado a datos
 *   patrimoniales es peor que un acceso denegado.
 * - Para `INTERNO` y `PUBLICO` no se emite evento.
 * - Taxonomía cerrada de acciones; datos cerrados (sin texto libre ni contenido del recurso).
 * - `titularAfectado` indexado: permite responder "quién miró mi información".
 */

import type {
  AccionAuditada,
  ClasificacionDato,
  DispositivoClase,
  IdEventoAuditoria,
  IdSesion,
  IdUsuario,
  Instante,
  Permiso,
  ResultadoEvento,
  TipoRecurso,
} from '@mejorar/shared/identidad/contrato/v1';
import type { CanalDeOrigen, MotivoDenegacion } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';

/**
 * Estructura de un evento de auditoría a emitir.
 */
export interface SolicitudDeEvento {
  readonly accion: AccionAuditada;
  readonly sujeto: IdUsuario | null; // null en acciones del sistema
  readonly titularAfectado: IdUsuario | null;
  readonly tipoRecurso?: TipoRecurso;
  readonly idRecurso?: string;
  readonly clasificacion: ClasificacionDato;
  readonly permisoEvaluado?: Permiso;
  readonly resultado: ResultadoEvento;
  readonly motivo?: MotivoDenegacion;
  readonly origenSesionId?: IdSesion;
  readonly origenIpHash?: Buffer;
  readonly origenDispositivoClase?: DispositivoClase;
  readonly origenCanal: CanalDeOrigen;
  readonly idCorrelacion: string;
  readonly datos?: Record<string, string | number | boolean | null>;
}

/**
 * Resultado de emisión.
 */
export interface ResultadoEmision {
  readonly eventoId: string;
}

/**
 * Emisor de eventos de auditoría.
 */
export class EmisorDeAuditoria {
  constructor(private prisma: PrismaClient) {}

  /**
   * Emite un evento de auditoría.
   *
   * Para recursos `PERSONAL` y `PATRIMONIAL_SENSIBLE`, la escritura es **síncrona y
   * fallo cerrado**: si falla, se lanza excepción y la petición falla con 503.
   *
   * Para `INTERNO` y `PUBLICO`, retorna sin hacer nada.
   */
  async emitir(solicitud: SolicitudDeEvento): Promise<ResultadoEmision | null> {
    // No emitir para datos públicos e internos
    if (solicitud.clasificacion === 'PUBLICO' || solicitud.clasificacion === 'INTERNO') {
      return null;
    }

    // Para datos sensibles, fallo cerrado
    try {
      const evento = await this.prisma.eventoAuditoria.create({
        data: {
          id: crypto.randomUUID(),
          momento: new Date(),
          accion: solicitud.accion,
          sujeto: solicitud.sujeto as string | null,
          titularAfectado: solicitud.titularAfectado as string | null,
          tipoRecurso: solicitud.tipoRecurso,
          idRecurso: solicitud.idRecurso,
          clasificacion: solicitud.clasificacion,
          permisoEvaluado: solicitud.permisoEvaluado,
          resultado: solicitud.resultado,
          motivo: solicitud.motivo,
          origenSesionId: solicitud.origenSesionId as string | undefined,
          origenCanal: solicitud.origenCanal,
          idCorrelacion: solicitud.idCorrelacion,
          datos: solicitud.datos ? JSON.stringify(solicitud.datos) : undefined,
        },
      });

      return { eventoId: evento.id };
    } catch (e) {
      // Fallo cerrado: un acceso no auditado a datos sensibles es peor que un acceso denegado
      throw new Error(
        `[AUDITORIA] No se pudo registrar evento crítico: ${e instanceof Error ? e.message : 'desconocido'}`,
      );
    }
  }

  /**
   * Emite múltiples eventos en la misma transacción (si existe).
   */
  async emitirLote(solicitudes: readonly SolicitudDeEvento[]): Promise<readonly ResultadoEmision[]> {
    const resultados: ResultadoEmision[] = [];

    for (const solicitud of solicitudes) {
      const resultado = await this.emitir(solicitud);
      if (resultado) resultados.push(resultado);
    }

    return resultados;
  }
}
