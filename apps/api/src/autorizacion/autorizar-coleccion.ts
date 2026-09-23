/**
 * Autorización sobre una colección de recursos.
 *
 * Devuelve un `FiltroDeAlcance` que la consulta **tiene que** incorporar en su `WHERE`.
 * Implementa ADR-022 capa 5: "Las colecciones llevan su criterio al WHERE".
 */

import { decidirAcceso } from '@mejorar/shared/identidad/autorizacion';
import type {
  ContextoDeAcceso,
  FiltroDeAlcance,
  Instante,
  Permiso,
  TipoRecurso,
} from '@mejorar/shared/identidad/contrato/v1';

import type { PrismaClient } from '@prisma/client';
import type {
  AlcanceResuelto,
  CriterioDeAlcance,
  ErrorDeAutorizacion,
  SolicitudDeAutorizacionColeccion,
} from './tipos';
import { registroDeRecursos } from './registro';

/**
 * Marca privada para FiltroDeAlcance.
 */
const marcaFiltroPrivada = Symbol('FiltroDeAlcance');

/**
 * Constructor privado.
 */
function construirFiltro<P extends Permiso, T extends TipoRecurso>(
  permiso: P,
  tipo: T,
  criterio: CriterioDeAlcance,
  sujeto: any,
  sesion: any,
  momento: any,
  evento: string | null,
): FiltroDeAlcance<P, T> {
  return {
    [marcaFiltroPrivada]: true,
    permiso,
    tipo,
    criterio,
    sujeto,
    sesion,
    momento,
    evento,
  } as FiltroDeAlcance<P, T>;
}

/**
 * Resultado de autorización sobre una colección.
 */
export type ResultadoDeAutorizacionColeccion<P extends Permiso, T extends TipoRecurso> =
  | { ok: true; filtro: FiltroDeAlcance<P, T> }
  | { ok: false; error: ErrorDeAutorizacion };

/**
 * Autoriza el acceso a una colección de recursos.
 *
 * La devolución del criterio `NINGUNO` no es un 403: significa que el usuario
 * tiene el permiso pero su alcance es vacío (p.ej., un abogado sin casos asignados).
 * La interfaz devuelve una lista vacía, nunca un rechazo.
 */
export async function autorizarColeccion<P extends Permiso, T extends TipoRecurso>(
  solicitud: SolicitudDeAutorizacionColeccion<P, T>,
  contexto: ContextoDeAcceso,
  prisma: PrismaClient,
  momento: Instante,
): Promise<ResultadoDeAutorizacionColeccion<P, T>> {
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

  // 2. Evaluar decisión sobre la colección
  const alcanceColeccion: AlcanceResuelto = {
    clase: 'COLECCION',
    criterio: { clase: 'TODOS' }, // Placeholder; se refina según el resolvedor
  };

  const decision = decidirAcceso(contexto, solicitud.permiso, alcanceColeccion, exigencia);

  if (decision.decision === 'DENEGADO') {
    return {
      ok: false,
      error: {
        clase: 'AUTORIZACION_DENEGADA',
        motivo: decision.motivo,
      },
    };
  }

  // 3. Determinar criterio de alcance según el tipo de recurso y el sujeto
  let criterio: CriterioDeAlcance;

  // Heurística simple: si el permiso contiene `.propio`, es alcance PROPIOS
  if (solicitud.permiso.includes('.propio')) {
    criterio = {
      clase: 'PROPIOS',
      titular: contexto.sujeto,
    };
  }
  // Si contiene `.asignado`, es ASIGNADOS (features 008/012/013)
  else if (solicitud.permiso.includes('.asignado')) {
    criterio = {
      clase: 'ASIGNADOS',
      profesional: contexto.sujeto,
      vigentesAl: momento,
    };
  }
  // Caso de back-office: el resolvedor especifica si es TODOS o NINGUNO
  else {
    // Por defecto, TODOS para permisos administrativos (usuario.listar, matricula.leer)
    // pero esto puede refinarse con un resolvedor si hace falta
    criterio = { clase: 'TODOS' };
  }

  // 4. Emitir evento de autorización si corresponde (no es crítico para colecciones)
  // Por ahora omitimos la auditoría para colecciones; se puede agregar si es necesario

  // 5. Devolver el filtro
  return {
    ok: true,
    filtro: construirFiltro(solicitud.permiso, solicitud.tipo, criterio, contexto.sujeto, contexto.sesion, momento, null),
  };
}
