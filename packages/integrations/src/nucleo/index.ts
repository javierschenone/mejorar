/**
 * Núcleo común de la frontera con terceros.
 *
 * No conoce ningún dominio: errores normalizados, resiliencia, idempotencia,
 * sanitizado para el registro y declaración de cobertura. Lo comparten todas
 * las integraciones, las de esta feature y las que vengan.
 */
export * from './cobertura';
export * from './errores';
export * from './idempotencia';
export * from './registro';
export * from './resiliencia';
export * from './sanitizado';
