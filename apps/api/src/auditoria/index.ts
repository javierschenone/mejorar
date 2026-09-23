/**
 * Módulo de auditoría.
 *
 * Exporta la API pública del sistema de auditoría basado en ADR-028.
 */

export { EmisorDeAuditoria } from './emisor';
export type { SolicitudDeEvento, ResultadoEmision } from './emisor';

export { ConsultasDeAuditoria } from './consultas';
export type { EventoAuditoriaProjectado } from './consultas';

export { SelladorDeBitacora } from './sellado';
export type { SelloDeBitacora } from './sellado';

export { VerificadorDeBitacora } from './verificador';
export type { ResultadoVerificacion } from './verificador';
