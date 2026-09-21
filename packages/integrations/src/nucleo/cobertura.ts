/**
 * Declaración de cobertura — regla 8 del mandato.
 *
 * "Lo que no soporta se resuelve por carga manual, y el sistema tiene que
 * saberlo." Cada adaptador publica qué hace, contra qué proveedor, con qué
 * precisión y qué **no** cubre. Es lo que permite que la interfaz rotule un
 * dato como aproximado (ADR-029: la provincia se muestra siempre como
 * aproximada) sin que eso quede escrito a mano en una pantalla.
 */

import type { ProveedorDeIntegracion } from './errores';

export interface DeclaracionDeCobertura {
  readonly puerto: string;
  readonly adaptador: string;
  readonly proveedor: ProveedorDeIntegracion;
  /** `true` si la implementación puede abrir una conexión de red. */
  readonly usaRed: boolean;
  /** `true` si trata datos personales fuera de nuestra infraestructura (art. 25). */
  readonly esEncargadoDeTratamiento: boolean;
  /** Qué cubre, en lenguaje de producto. */
  readonly cubre: readonly string[];
  /** Qué no cubre y cómo se resuelve mientras tanto. */
  readonly noCubre: readonly string[];
  /** Versión del dato o del catálogo con el que responde, si aplica. */
  readonly version: string | null;
}

export interface AdaptadorDeclarado {
  readonly cobertura: DeclaracionDeCobertura;
}
