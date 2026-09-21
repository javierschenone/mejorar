/**
 * Registro de llamadas a terceros.
 *
 * Toda llamada que cruza la frontera deja una entrada con petición y respuesta
 * **ya sanitizadas** (regla 7 del mandato). Este paquete no sabe dónde se
 * guarda: `apps/api` la persiste como `TramiteIntegracion`. Acá vive el puerto
 * y una implementación en memoria que es la que usan los tests y el modo mock.
 */

import type { ProveedorDeIntegracion } from './errores';
import { sanitizarParaRegistro, type ValorRegistrable } from './sanitizado';

export interface EntradaDeRegistro {
  readonly proveedor: ProveedorDeIntegracion;
  readonly operacion: string;
  readonly momento: string;
  readonly duracionEnMs: number;
  readonly resultado: 'EXITO' | 'FALLO';
  /** Número de intento, empezando en 1. */
  readonly intento: number;
  readonly peticionSanitizada: ValorRegistrable;
  readonly respuestaSanitizada: ValorRegistrable;
  readonly codigoDeError: string | null;
  readonly referencia: string;
}

export interface PuertoRegistroDeLlamadas {
  registrar(entrada: EntradaDeRegistro): void;
}

/**
 * Registro en memoria. Determinista y consultable: los tests verifican acá que
 * no se filtró nada sensible.
 */
export class RegistroDeLlamadasEnMemoria implements PuertoRegistroDeLlamadas {
  private readonly entradas: EntradaDeRegistro[] = [];

  registrar(entrada: EntradaDeRegistro): void {
    this.entradas.push({
      ...entrada,
      peticionSanitizada: sanitizarParaRegistro(entrada.peticionSanitizada),
      respuestaSanitizada: sanitizarParaRegistro(entrada.respuestaSanitizada),
    });
  }

  listar(): readonly EntradaDeRegistro[] {
    return [...this.entradas];
  }

  limpiar(): void {
    this.entradas.length = 0;
  }
}

/** Registro que descarta todo. Para cuando el consumidor todavía no cableó el suyo. */
export const registroSilencioso: PuertoRegistroDeLlamadas = {
  registrar(): void {
    /* a propósito, nada */
  },
};
