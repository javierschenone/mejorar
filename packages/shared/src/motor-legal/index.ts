/**
 * Motor de reglas legales argentinas — feature 004.
 *
 * Librería de dominio **pura y total** (ADR-016): no lee el reloj, ni el
 * entorno, ni la red, ni el disco; no muta su entrada; no lanza excepciones
 * como flujo de control. Todo lo que necesita entra por parámetro.
 *
 * Estado de implementación (ola 1 de G4): tipos del contrato, dinero exacto
 * (T-01) y tiempo civil determinista (T-02). El catálogo normativo, los
 * valores de referencia y los cinco análisis son tareas posteriores.
 */

export type * from './contrato';
export * from './dinero';
export * from './tiempo';
export { errorDeEntrada, errorDeInconsistenciaInterna, falla, ok } from './errores';
export type { CodigoError } from './errores';

/**
 * Desambiguación explícita contrato ↔ implementación.
 *
 * El contrato declara varias de sus funciones con `declare function`
 * (`redondear`, `comoFechaCivil`, …): son **firmas**, no código — no existen en
 * tiempo de ejecución. La implementación de esa misma firma vive en los
 * módulos del motor y sale de acá con el mismo nombre, así que TypeScript ve
 * dos exportaciones homónimas y pide que se diga cuál manda (TS2308).
 *
 * Manda siempre la implementación: es la que tiene valor en ejecución, y su
 * firma es la que el contrato declara — el test de ADR-017 garantiza que la
 * copia del contrato no se movió. Cada vez que una tarea posterior implemente
 * otra función declarada en el contrato (`resolverParametro`, `evaluar`,
 * `crearIdOpaco`, …), agrega acá su línea.
 */
export { redondear } from './dinero';
export { comoFechaCivil, comoFechaDeEvaluacion, comoFechaDelHecho } from './tiempo';
