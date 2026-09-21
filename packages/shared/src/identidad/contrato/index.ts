/**
 * Superficie de tipos del contrato `identidad-y-acceso/v1`.
 *
 * Se reexportan **sólo tipos**: `v1.ts` es una copia byte a byte de
 * `specs/contratos/identidad-y-acceso.ts` (ADR-017, aplicado a esta feature
 * por `plan.md` §2 y por la obligación de frontera F-11) y contiene únicamente
 * declaraciones — sus `declare function` y `declare const` no existen en
 * tiempo de ejecución. Las implementaciones viven en los módulos de
 * `src/identidad` y son las que se exportan como valores.
 */
export type * from './v1';
