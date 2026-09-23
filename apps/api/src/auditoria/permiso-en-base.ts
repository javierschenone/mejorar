/**
 * Traducción del permiso del contrato al enum de Prisma.
 *
 * El contrato (`@mejorar/shared/identidad/contrato/v1`) nombra los permisos con puntos
 * ("usuario.leer"); el cliente de Prisma no admite puntos en un identificador y los expone
 * con `_` ("usuario_leer"); la base guarda el literal del contrato por el `@map` del
 * esquema. La conversión es mecánica, y su correspondencia completa —los 25 permisos, en
 * los dos sentidos y contra la base— la verifica `autorizacion/autorizar.test.ts`.
 *
 * Todo lo que escriba `permisoEvaluado` en la bitácora pasa por acá.
 */

import type { Permiso } from '@mejorar/shared/identidad/contrato/v1';
import type { Permiso as PermisoPrisma } from '@prisma/client';

export function convertirPermisoAlPrismaEnum(permiso: Permiso): PermisoPrisma {
  return permiso.replace(/\./g, '_') as PermisoPrisma;
}
