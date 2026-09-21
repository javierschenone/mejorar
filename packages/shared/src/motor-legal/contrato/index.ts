/**
 * Superficie de tipos del contrato `motor-reglas-legales/v1`.
 *
 * Se reexportan **sólo tipos**: `v1.ts` es una copia byte a byte de
 * `specs/contratos/motor-reglas-legales.ts` (ADR-017) y contiene únicamente
 * declaraciones — sus `declare function` no existen en tiempo de ejecución.
 * Las implementaciones viven en los módulos del motor y son las que se
 * exportan como valores.
 */
export type * from './v1';
