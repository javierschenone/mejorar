/**
 * `@mejorar/shared` — dominio puro de la plataforma.
 *
 * La superficie pública del paquete se declara acá, explícita: nada se filtra
 * por accidente. Sin framework, sin ORM, sin HTTP, sin `process.env`, sin
 * reloj (ADR-003 §4, ADR-016).
 *
 * Hoy el paquete contiene un solo dominio: el motor de reglas legales
 * argentinas (`./motor-legal`), que reexporta los tipos del contrato
 * `motor-reglas-legales/v1` y las implementaciones ya construidas.
 */
export * from './motor-legal';
