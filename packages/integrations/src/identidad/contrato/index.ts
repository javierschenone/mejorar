/**
 * Superficie de tipos del contrato `identidad-y-acceso/v1` para los puertos
 * de esta feature (§13 del contrato, ADR-029).
 *
 * Se reexportan **sólo tipos**: `v1.ts` es una copia byte a byte de
 * `specs/contratos/identidad-y-acceso.ts` (ADR-017) y contiene únicamente
 * declaraciones — sus `declare function` no existen en tiempo de ejecución.
 *
 * ── Deuda declarada, para el arquitecto y para T-01 ────────────────────────
 * El contrato usa marcas nominales construidas sobre `unique symbol`
 * (`Instante`, `IdOpaco<…>`). Dos copias del mismo archivo en dos paquetes
 * producen dos símbolos distintos y por lo tanto dos tipos **incompatibles**:
 * el `Instante` de `@mejorar/shared` no sería asignable al `Instante` de este
 * paquete. Hoy eso no rompe nada porque `packages/shared/src/identidad/`
 * todavía no existe (T-01 corre en paralelo con esta tarea), pero en cuanto
 * exista hay que dejar **una sola** copia en el workspace:
 *
 *   1. `@mejorar/shared` mantiene la copia del contrato (ADR-017, punto 2).
 *   2. Este archivo pasa a ser `export type * from '@mejorar/shared/identidad/contrato'`
 *      y se borran `v1.ts`, su test de identidad y `scripts/verificar-contrato.mjs`.
 *   3. Nada más cambia: **todo** el código de identidad de este paquete importa
 *      sus tipos desde acá y de ningún otro lado, justamente para que el
 *      cambio sea de un archivo.
 *
 * Quien haga el cableado en `apps/api` (T-04 en adelante) tiene que verificar
 * que ese paso ya ocurrió; si ve un error de asignabilidad entre dos
 * `Instante`, es esto y no un defecto suyo.
 */
export type * from './v1';
