/**
 * Puerto de descripción de dispositivo (§13 del contrato, ADR-029 punto 2).
 *
 * Analiza la cadena de agente de usuario **en el proceso** y devuelve
 * categorías cerradas. La cadena cruda **no se guarda y no sale de esta
 * función**: es una huella con mucha más entropía de la que este producto
 * necesita, y conservarla contradice la minimización del art. 4 de la Ley
 * 25.326.
 *
 * No hay adaptador HTTP y no puede haberlo: no hay ningún tercero en esta
 * resolución. Por eso este directorio tiene `local.ts` en vez de `http.ts`,
 * y por eso el mock delega en el analizador real —no hay red que simular—
 * agregando sólo una batería de fijaciones para la demostración.
 */

import type { DescripcionDeDispositivo } from '../contrato';

export type { DescripcionDeDispositivo };

export interface PuertoDescripcionDeDispositivo {
  describir(agenteDeUsuario: string): DescripcionDeDispositivo;
}

export type ClaseDeDispositivo = DescripcionDeDispositivo['clase'];

/**
 * Vocabulario cerrado de familias de sistema operativo. Sin versiones: la
 * versión sube la entropía de la huella y no le sirve a nadie para reconocer
 * su propia sesión.
 */
export const SISTEMAS = [
  'Windows',
  'macOS',
  'iOS',
  'iPadOS',
  'Android',
  'ChromeOS',
  'Linux',
] as const;
export type Sistema = (typeof SISTEMAS)[number];

/** Vocabulario cerrado de familias de navegador. Tampoco lleva versión. */
export const NAVEGADORES = [
  'Chrome',
  'Edge',
  'Firefox',
  'Safari',
  'Opera',
  'Samsung Internet',
] as const;
export type Navegador = (typeof NAVEGADORES)[number];

export const CLASES: readonly ClaseDeDispositivo[] = [
  'ESCRITORIO',
  'TELEFONO',
  'TABLETA',
  'APLICACION_MOVIL',
  'DESCONOCIDO',
];

/**
 * Qué se devuelve cuando no se reconoce nada. Es el modo de falla del
 * analizador y es inofensivo: la interfaz muestra "dispositivo desconocido"
 * (ADR-029, consecuencias).
 */
export const DESCONOCIDO: DescripcionDeDispositivo = Object.freeze({
  clase: 'DESCONOCIDO',
  sistema: null,
  navegador: null,
});
