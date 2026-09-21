/**
 * Idempotencia de efectos externos — constitución #12, regla 3 del mandato.
 *
 * "Una carta documento duplicada es plata y es un problema procesal." Para el
 * correo transaccional el costo es otro —dos avisos iguales de "bloquearon tu
 * cuenta" son ruido y alarma (ADR-029)— pero la mecánica es la misma: la
 * operación se identifica por su clave, no por el momento en que se pidió.
 *
 * Hay proveedores que aceptan una clave de idempotencia y la respetan de su
 * lado. Sendgrid **no**: su endpoint de envío no tiene cabecera de
 * idempotencia. Por eso el control vive acá y no allá, y por eso este puerto
 * existe: `apps/api` va a enchufar una implementación persistente (Redis o
 * tabla), porque una memoria de proceso no sobrevive a un reinicio ni se
 * comparte entre réplicas.
 */

export interface PuertoRegistroDeIdempotencia<T> {
  /**
   * Devuelve el resultado ya producido para esa clave, o `null` si es la
   * primera vez. Debe ser atómico respecto de `recordar` en la implementación
   * persistente.
   */
  recordado(clave: string): Promise<T | null>;
  recordar(clave: string, resultado: T): Promise<void>;
}

/**
 * Implementación en memoria, con tope de entradas y descarte del más viejo.
 * Es la que corre en modo mock y en los tests. **No usar en producción con
 * más de una réplica**: la fábrica lo advierte.
 */
export class RegistroDeIdempotenciaEnMemoria<T> implements PuertoRegistroDeIdempotencia<T> {
  private readonly entradas = new Map<string, T>();

  constructor(private readonly maximoDeEntradas = 10_000) {}

  async recordado(clave: string): Promise<T | null> {
    return this.entradas.has(clave) ? (this.entradas.get(clave) as T) : null;
  }

  async recordar(clave: string, resultado: T): Promise<void> {
    if (this.entradas.size >= this.maximoDeEntradas) {
      const masViejo = this.entradas.keys().next();
      if (!masViejo.done) this.entradas.delete(masViejo.value);
    }
    this.entradas.set(clave, resultado);
  }

  get cantidad(): number {
    return this.entradas.size;
  }

  limpiar(): void {
    this.entradas.clear();
  }
}

/** Una clave de idempotencia vacía es un defecto de quien llama, no un caso borde. */
export function claveDeIdempotenciaValida(clave: string): boolean {
  return clave.trim().length >= 8 && clave.length <= 255;
}
