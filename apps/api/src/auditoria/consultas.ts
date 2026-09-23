/**
 * Consultas sobre la bitácora de auditoría.
 *
 * Dos consultas principales:
 * - Por titular afectado: "quién miró mi información"
 * - Por sujeto: "mi actividad reciente"
 *
 * Ambas respetan la partición por fecha de la tabla.
 */

import type { IdUsuario, Instante } from '@mejorar/shared/identidad/contrato/v1';
import type { EventoAuditoria } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';

export interface EventoAuditoriaProjectado {
  readonly id: string;
  readonly momento: Date;
  readonly accion: string;
  readonly sujeto: string | null;
  readonly titularAfectado: string | null;
  readonly tipoRecurso: string | null;
  readonly idRecurso: string | null;
  readonly clasificacion: string;
  readonly resultado: string;
  readonly origenCanal: string;
}

/**
 * Consultas de auditoría.
 */
export class ConsultasDeAuditoria {
  constructor(private prisma: PrismaClient) {}

  /**
   * Obtiene la bitácora del titular: qué se accedió sobre sus datos.
   * CA-21, CA-25, habeas data.
   */
  async obtenerBitacoraDeTitular(
    titularAfectado: IdUsuario,
    opciones?: {
      limite?: number;
      desdeInstante?: Instante;
      hastaInstante?: Instante;
    },
  ): Promise<EventoAuditoriaProjectado[]> {
    const limit = opciones?.limite || 100;
    const desde = opciones?.desdeInstante ? new Date(opciones.desdeInstante) : new Date(Date.now() - 90 * 24 * 3600 * 1000);
    const hasta = opciones?.hastaInstante ? new Date(opciones.hastaInstante) : new Date();

    const eventos = await this.prisma.eventoAuditoria.findMany({
      where: {
        titularAfectado: titularAfectado as string,
        momento: {
          gte: desde,
          lte: hasta,
        },
      },
      orderBy: {
        momento: 'desc',
      },
      take: limit,
      select: {
        id: true,
        momento: true,
        accion: true,
        sujeto: true,
        titularAfectado: true,
        tipoRecurso: true,
        idRecurso: true,
        clasificacion: true,
        resultado: true,
        origenCanal: true,
      },
    });

    return eventos.map((e) => ({
      id: e.id,
      momento: e.momento,
      accion: e.accion,
      sujeto: e.sujeto,
      titularAfectado: e.titularAfectado,
      tipoRecurso: e.tipoRecurso,
      idRecurso: e.idRecurso,
      clasificacion: e.clasificacion,
      resultado: e.resultado,
      origenCanal: e.origenCanal,
    }));
  }

  /**
   * Obtiene la actividad del sujeto: qué acciones realizó.
   * CA-10 de la 001, auditoría.leer.propia.
   */
  async obtenerActividadDelSujeto(
    sujeto: IdUsuario,
    opciones?: {
      limite?: number;
      desdeInstante?: Instante;
      hastaInstante?: Instante;
    },
  ): Promise<EventoAuditoriaProjectado[]> {
    const limit = opciones?.limite || 100;
    const desde = opciones?.desdeInstante ? new Date(opciones.desdeInstante) : new Date(Date.now() - 90 * 24 * 3600 * 1000);
    const hasta = opciones?.hastaInstante ? new Date(opciones.hastaInstante) : new Date();

    const eventos = await this.prisma.eventoAuditoria.findMany({
      where: {
        sujeto: sujeto as string,
        momento: {
          gte: desde,
          lte: hasta,
        },
      },
      orderBy: {
        momento: 'desc',
      },
      take: limit,
      select: {
        id: true,
        momento: true,
        accion: true,
        sujeto: true,
        titularAfectado: true,
        tipoRecurso: true,
        idRecurso: true,
        clasificacion: true,
        resultado: true,
        origenCanal: true,
      },
    });

    return eventos.map((e) => ({
      id: e.id,
      momento: e.momento,
      accion: e.accion,
      sujeto: e.sujeto,
      titularAfectado: e.titularAfectado,
      tipoRecurso: e.tipoRecurso,
      idRecurso: e.idRecurso,
      clasificacion: e.clasificacion,
      resultado: e.resultado,
      origenCanal: e.origenCanal,
    }));
  }

  /**
   * Obtiene todos los eventos de creación de administradores.
   * CA-34: auditoría de cuentas administradoras (ADMINISTRADOR_CREADO,
   * ADMINISTRADOR_SEMBRADO, ADMINISTRADOR_NOMINALIZADO).
   */
  async obtenerEventosDeAdministrador(opciones?: {
    limite?: number;
    desdeInstante?: Instante;
  }): Promise<EventoAuditoriaProjectado[]> {
    const limit = opciones?.limite || 1000;
    const desde = opciones?.desdeInstante ? new Date(opciones.desdeInstante) : new Date(0);

    const eventos = await this.prisma.eventoAuditoria.findMany({
      where: {
        accion: {
          in: ['ADMINISTRADOR_CREADO', 'ADMINISTRADOR_SEMBRADO', 'ADMINISTRADOR_NOMINALIZADO'],
        },
        momento: {
          gte: desde,
        },
      },
      orderBy: {
        momento: 'desc',
      },
      take: limit,
      select: {
        id: true,
        momento: true,
        accion: true,
        sujeto: true,
        titularAfectado: true,
        tipoRecurso: true,
        idRecurso: true,
        clasificacion: true,
        resultado: true,
        origenCanal: true,
      },
    });

    return eventos.map((e) => ({
      id: e.id,
      momento: e.momento,
      accion: e.accion,
      sujeto: e.sujeto,
      titularAfectado: e.titularAfectado,
      tipoRecurso: e.tipoRecurso,
      idRecurso: e.idRecurso,
      clasificacion: e.clasificacion,
      resultado: e.resultado,
      origenCanal: e.origenCanal,
    }));
  }
}
