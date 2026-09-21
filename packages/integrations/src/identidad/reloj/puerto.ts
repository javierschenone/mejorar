/**
 * Puerto del reloj (§13 del contrato, ADR-029 punto 4).
 *
 * No es un tercero. Existe porque el dominio **no lee el reloj** (ADR-016): el
 * instante entra siempre por parámetro. Que `new Date()` no aparezca en el
 * dominio es lo que permite reproducir en 2029 qué decidió el sistema en 2026,
 * y es el mismo determinismo que ya exige la feature 004.
 *
 * Regla de uso: en `apps/api`, el reloj se inyecta una vez en el arranque y
 * viaja por el contenedor. Un `new Date()` suelto en un servicio es un defecto
 * de revisión, no una decisión.
 */

import type { Instante, PuertoReloj } from '../contrato';

export type { Instante, PuertoReloj };

/**
 * Convierte una fecha de JavaScript al formato del contrato: ISO 8601 en UTC
 * con milisegundos (`2026-09-21T14:03:11.412Z`). `toISOString` ya produce
 * exactamente ese formato; la marca nominal se aplica acá y en ningún otro
 * lado del paquete.
 */
export function comoInstante(fecha: Date): Instante {
  if (Number.isNaN(fecha.getTime())) {
    throw new RangeError('Fecha inválida: no se puede construir un Instante.');
  }
  return fecha.toISOString() as Instante;
}

/** Reconoce el formato del contrato. Útil en los tests y en las guardas. */
export const FORMA_DE_INSTANTE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export function esInstanteBienFormado(valor: string): valor is Instante {
  return FORMA_DE_INSTANTE.test(valor) && !Number.isNaN(Date.parse(valor));
}
