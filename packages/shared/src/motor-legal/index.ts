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
