/**
 * Función de autorización y producción de prueba tipada.
 *
 * Implementa ADR-022 capa 3:
 *   - Resuelve el alcance con el `ResolvedorDeAlcance` del tipo de recurso
 *   - Llama a `decidirAcceso` (pura) para evaluar la decisión
 *   - **Emite el evento de auditoría** (ADR-028) antes de devolver la prueba
 *   - Devuelve una `Autorizacion<P, T>` inconstruible fuera de este módulo
 *
 * Criterios CA-19, CA-20, CA-21.
 */

import { decidirAcceso, reautenticacionVencida } from '@mejorar/shared/identidad/autorizacion';
import type {
  Autorizacion,
  ContextoDeAcceso,
  IdRecurso,
  IdSesion,
  IdUsuario,
  Instante,
  MotivoDenegacion,
  Permiso,
  TipoRecurso,
} from '@mejorar/shared/identidad/contrato/v1';

import type { PrismaClient } from '@prisma/client';
import type { AlcanceResuelto, ErrorDeAutorizacion, SolicitudDeAutorizacion } from './tipos';
import { registroDeRecursos } from './registro';
import { convertirPermisoAlPrismaEnum } from '../auditoria/permiso-en-base';

/**
 * Marca privada que hace inconstruible el tipo `Autorizacion` fuera de este módulo.
 * Declarada acá; no se exporta.
 */
const marcaAutorizacionPrivada = Symbol('Autorizacion');

/**
 * Sobre los datos de quién es el acceso (CA-21, ADR-028 §3). Lo informa el resolvedor;
 * nunca se deduce del sujeto, que es quién actúa.
 */
function titularAfectadoDe(alcance: AlcanceResuelto | null): string | null {
  if (alcance === null || alcance.clase === 'COLECCION') return null;
  return alcance.titularRecurso ?? null;
}

/**
 * Constructor privado. Produce la `Autorizacion<P, T>` verificada internamente.
 */
function construirAutorizacion<P extends Permiso, T extends TipoRecurso>(
  permiso: P,
  objetivo: Extract<{ readonly clase: 'INDIVIDUAL'; readonly tipo: T; readonly id: IdRecurso<T> }, any>,
  sujeto: IdUsuario,
  sesion: IdSesion,
  momento: Instante,
  eventoId: string | null,
): Autorizacion<P, T> {
  return {
    [marcaAutorizacionPrivada]: true,
    permiso,
    objetivo,
    sujeto,
    sesion,
    momento,
    evento: eventoId as any,
  } as unknown as Autorizacion<P, T>;
}

/**
 * Resultado de una operación de autorización.
 */
export type ResultadoDeAutorizacion<P extends Permiso, T extends TipoRecurso> =
  | { ok: true; autorizacion: Autorizacion<P, T> }
  | { ok: false; error: ErrorDeAutorizacion };

/**
 * Autoriza el acceso a un recurso individual.
 *
 * Pasos:
 * 1. Valida que el tipo de recurso está registrado
 * 2. Resuelve el alcance con el resolvedor específico del tipo
 * 3. Llama a `decidirAcceso` para evaluar la decisión
 * 4. Emite el evento de auditoría si corresponde
 * 5. Devuelve la prueba tipada o error
 *
 * La auditoría se emite **incluso en caso de denegación** (ADR-028).
 */
export async function autorizar<P extends Permiso, T extends TipoRecurso>(
  solicitud: SolicitudDeAutorizacion<P, T>,
  contexto: ContextoDeAcceso,
  prisma: PrismaClient,
  momento: Instante,
): Promise<ResultadoDeAutorizacion<P, T>> {
  // 1. Validar que el tipo está registrado
  const exigencia = registroDeRecursos.obtenerExigencia(solicitud.tipo);
  if (!exigencia) {
    return {
      ok: false,
      error: {
        clase: 'CLASIFICACION_AUSENTE',
        motivo: `Tipo de recurso '${solicitud.tipo}' no registrado`,
      },
    };
  }

  // 2. Resolver alcance. Sin resolvedor no hay forma de saber si el sujeto alcanza el
  // recurso: se falla cerrado. Suponer ALCANCE_GLOBAL dejaría a cualquier abogado con
  // `caso.leer.asignado` leer cualquier caso (CA-19) y el evento saldría sin titular (CA-21).
  const resolvedor = registroDeRecursos.obtenerResolvedor(solicitud.tipo);
  if (!resolvedor) {
    return {
      ok: false,
      error: {
        clase: 'ERROR_INTERNO',
        motivo: `Tipo de recurso '${solicitud.tipo}' sin resolvedor de alcance registrado`,
      },
    };
  }

  let alcanceResuelto: AlcanceResuelto;
  try {
    alcanceResuelto = await resolvedor.resolver(contexto.sujeto, solicitud.id, momento);
  } catch (e) {
    return {
      ok: false,
      error: {
        clase: 'ERROR_INTERNO',
        motivo: `Error resolviendo alcance para ${solicitud.tipo}: ${e instanceof Error ? e.message : 'desconocido'}`,
      },
    };
  }

  // 3. Verificar ventana de reautenticación si aplica
  if (exigencia.ventanaDeReautenticacion !== null) {
    if (reautenticacionVencida(contexto.autenticadoEn, exigencia.ventanaDeReautenticacion, momento)) {
      // El alcance ya está resuelto: el evento lleva el titular del recurso.
      await emitirEventoDenegacion(
        contexto.sujeto,
        solicitud.permiso,
        'REAUTENTICACION_REQUERIDA',
        solicitud.tipo,
        solicitud.id,
        exigencia.clasificacion,
        alcanceResuelto,
        contexto,
        prisma,
        momento,
      );

      return {
        ok: false,
        error: {
          clase: 'AUTORIZACION_DENEGADA',
          motivo: 'Reautenticación requerida',
        },
      };
    }
  }

  // 4. Evaluar decisión (pura, sin efectos)
  const decision = decidirAcceso(contexto, solicitud.permiso, alcanceResuelto, exigencia);

  if (decision.decision === 'DENEGADO') {
    // Emitir evento de denegación (con alcanceResuelto para titularAfectado)
    await emitirEventoDenegacion(
      contexto.sujeto,
      solicitud.permiso,
      decision.motivo,
      solicitud.tipo,
      solicitud.id,
      exigencia.clasificacion,
      alcanceResuelto,
      contexto,
      prisma,
      momento,
    );

    return {
      ok: false,
      error: {
        clase: 'AUTORIZACION_DENEGADA',
        motivo: decision.motivo,
      },
    };
  }

  // 5. Emitir evento de autorización si el recurso lo exige
  let eventoId: string | null = null;
  if (exigencia.clasificacion === 'PERSONAL' || exigencia.clasificacion === 'PATRIMONIAL_SENSIBLE') {
    eventoId = await emitirEventoAutorizacion(
      contexto.sujeto,
      solicitud.permiso,
      solicitud.tipo,
      solicitud.id,
      exigencia.clasificacion,
      alcanceResuelto,
      contexto,
      prisma,
      momento,
    );
  }

  // 6. Devolver la prueba
  return {
    ok: true,
    autorizacion: construirAutorizacion(
      solicitud.permiso,
      {
        clase: 'INDIVIDUAL',
        tipo: solicitud.tipo,
        id: solicitud.id,
      },
      contexto.sujeto,
      contexto.sesion,
      momento,
      eventoId,
    ),
  };
}

/**
 * Emite un evento de autorización exitosa (CA-21, ADR-028).
 * Se escribe **antes** de entregar el dato, en la misma conexión.
 * Si falla, la petición falla con 503.
 *
 * CA-21: `titularAfectado` debe ser el dueño real del recurso, no quien actúa:
 * - Si el sujeto ES_TITULAR, es el mismo sujeto.
 * - Si el sujeto ESTA_ASIGNADO (p.ej., abogado), es el titular del recurso.
 * - Si tiene ALCANCE_GLOBAL (p.ej., administrador), es el titular que informe el resolvedor.
 * Eso permite que el titular consulte "quién miró mi información" vía `obtenerBitacoraDeTitular`.
 */
async function emitirEventoAutorizacion(
  sujeto: IdUsuario,
  permiso: Permiso,
  tipo: TipoRecurso,
  idRecurso: IdRecurso<any>,
  clasificacion: 'PERSONAL' | 'PATRIMONIAL_SENSIBLE',
  alcanceResuelto: AlcanceResuelto,
  contexto: ContextoDeAcceso,
  prisma: PrismaClient,
  momento: Instante,
): Promise<string> {
  const titularAfectado = titularAfectadoDe(alcanceResuelto);

  try {
    const evento = await prisma.eventoAuditoria.create({
      data: {
        id: crypto.randomUUID(),
        momento: new Date(momento),
        accion: 'RECURSO_LEIDO', // O RECURSO_MODIFICADO según la acción
        sujeto: sujeto as string,
        titularAfectado,
        tipoRecurso: tipo,
        idRecurso: idRecurso as string,
        clasificacion,
        permisoEvaluado: convertirPermisoAlPrismaEnum(permiso),
        resultado: 'PERMITIDO',
        origenSesionId: contexto.sesion as string,
        origenCanal: 'API',
        idCorrelacion: contexto.idCorrelacion,
      },
    });

    return evento.id;
  } catch (e) {
    // ADR-028: fallo cerrado. Un acceso no auditado a datos patrimoniales es peor que un acceso denegado.
    throw new Error(`No se pudo auditar acceso a ${tipo}: ${e instanceof Error ? e.message : 'desconocido'}`);
  }
}

/**
 * Emite un evento de denegación (ADR-028).
 *
 * `titularAfectado` es el titular que informó el resolvedor, si lo informó: el intento
 * denegado de un abogado sobre un caso ajeno queda a la vista del dueño de ese caso.
 * Nunca es el sujeto que intentó acceder, salvo que sea también el titular.
 */
async function emitirEventoDenegacion(
  sujeto: IdUsuario,
  permiso: Permiso,
  motivo: MotivoDenegacion,
  tipo: TipoRecurso,
  idRecurso: IdRecurso<any>,
  clasificacion: 'PERSONAL' | 'PATRIMONIAL_SENSIBLE' | 'INTERNO' | 'PUBLICO',
  alcanceResuelto: AlcanceResuelto | null,
  contexto: ContextoDeAcceso,
  prisma: PrismaClient,
  momento: Instante,
): Promise<string> {
  const titularAfectado = titularAfectadoDe(alcanceResuelto);

  try {
    const evento = await prisma.eventoAuditoria.create({
      data: {
        id: crypto.randomUUID(),
        momento: new Date(momento),
        accion: 'ACCESO_DENEGADO',
        sujeto: sujeto as string,
        titularAfectado,
        tipoRecurso: tipo,
        idRecurso: idRecurso as string,
        clasificacion,
        permisoEvaluado: convertirPermisoAlPrismaEnum(permiso),
        resultado: 'DENEGADO',
        motivo,
        origenSesionId: contexto.sesion as string,
        origenCanal: 'API',
        idCorrelacion: contexto.idCorrelacion,
      },
    });

    return evento.id;
  } catch (e) {
    // Para denegaciones no es crítico, pero se registra
    console.error(`Error emitiendo evento de denegación: ${e instanceof Error ? e.message : 'desconocido'}`);
    return '';
  }
}
