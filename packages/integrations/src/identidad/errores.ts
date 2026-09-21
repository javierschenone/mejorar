/**
 * Traducción de la frontera hacia el vocabulario de la feature 002.
 *
 * Los puertos del contrato devuelven `ErrorIdentidad` (§1), que es
 * deliberadamente pobre: clase, código y referencia, nada más. La riqueza
 * —proveedor, si conviene reintentar, mensaje para la persona— vive en
 * `ErrorIntegracion` y se queda **de este lado**: va al registro de llamadas,
 * no al borde HTTP, porque el borde de esta feature no revela nada (R-05,
 * CA-12).
 */

import type { ErrorIdentidad } from './contrato';
import type { ClaseErrorIntegracion, ErrorIntegracion } from '../nucleo';

const CLASE_DE_IDENTIDAD: Readonly<
  Record<ClaseErrorIntegracion, ErrorIdentidad['clase']>
> = {
  // Armamos mal la petición: el defecto es nuestro y la entrada que la generó
  // es lo que hay que revisar.
  PETICION_INVALIDA: 'ENTRADA_INVALIDA',
  CREDENCIAL_RECHAZADA: 'INCONSISTENCIA_INTERNA',
  LIMITE_DE_USO: 'INCONSISTENCIA_INTERNA',
  FALLO_DEL_PROVEEDOR: 'INCONSISTENCIA_INTERNA',
  TIEMPO_AGOTADO: 'INCONSISTENCIA_INTERNA',
  SIN_CONEXION: 'INCONSISTENCIA_INTERNA',
  CIRCUITO_ABIERTO: 'INCONSISTENCIA_INTERNA',
  CONFIGURACION_AUSENTE: 'INCONSISTENCIA_INTERNA',
  RESPUESTA_INESPERADA: 'INCONSISTENCIA_INTERNA',
};

export function comoErrorDeIdentidad(error: ErrorIntegracion): ErrorIdentidad {
  return {
    clase: CLASE_DE_IDENTIDAD[error.clase],
    codigo: error.codigo,
    referencia: error.referencia,
  };
}
