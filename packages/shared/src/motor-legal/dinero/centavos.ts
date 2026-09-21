/**
 * Centavos enteros y montos con moneda — ADR-011 §1, CA-32.
 *
 * `Centavos` es `bigint` con marca nominal: nunca `number`, nunca punto
 * flotante, nunca un monto sin moneda. Dos montos de monedas distintas no se
 * suman ni se comparan: el §7 de la spec prohíbe que el motor convierta.
 *
 * Los importes del dominio son **no negativos**. Un importe negativo es dato
 * mal cargado (`ENTRADA_INVALIDA`, §7 de la spec y comentario de
 * `ClaseErrorMotor` en el contrato), y por eso el único constructor público de
 * un monto lo rechaza. La excepción documentada es `redondear`, que por
 * contrato es total y conserva el signo del racional que recibe: ver la nota
 * en `redondeo.ts`.
 */

import type { Centavos, ErrorMotor, Monto, Moneda, Racional, Resultado } from '../contrato/v1';
import { errorDeEntrada, falla, ok } from '../errores';
import { racionalDesdeEntero } from './racional';

/**
 * Única conversión de `bigint` a `Centavos` del paquete. La marca nominal del
 * contrato usa un `unique symbol` no exportado, así que no hay forma de
 * construir el tipo sin esta aserción; queda encerrada acá, en una función de
 * una línea, para que el resto del dominio no tenga aserciones sueltas.
 */
function marcarComoCentavos(valor: bigint): Centavos {
  return valor as Centavos;
}

/**
 * Constructor validado de centavos de entrada. Rechaza el negativo.
 * `bigint` ya garantiza la integridad (no hay parte decimal posible).
 */
export function crearCentavos(valor: bigint): Resultado<Centavos, ErrorMotor> {
  if (valor < 0n) return falla(errorDeEntrada('DINERO_MONTO_NEGATIVO'));
  return ok(marcarComoCentavos(valor));
}

/**
 * Centavos desde texto decimal, que es como el borde HTTP los serializa
 * (obligación de frontera F-06 del plan: `Centavos` viaja como cadena, nunca
 * como número JSON). Acepta sólo dígitos: el texto ya viene en centavos.
 */
export function crearCentavosDesdeTexto(texto: string): Resultado<Centavos, ErrorMotor> {
  if (!/^\d+$/.test(texto)) return falla(errorDeEntrada('DINERO_VALOR_NO_ENTERO'));
  return ok(marcarComoCentavos(BigInt(texto)));
}

/**
 * Centavos sin validar el signo. **Uso interno del módulo de dinero**: sólo
 * `redondeo.ts` la necesita, porque el contrato declara `redondear` como
 * función total que no puede devolver `Resultado`.
 */
export function centavosSinValidarSigno(valor: bigint): Centavos {
  return marcarComoCentavos(valor);
}

export function crearMonto(centavos: Centavos, moneda: Moneda): Monto {
  return { centavos, moneda };
}

export function montoCero(moneda: Moneda): Monto {
  return { centavos: marcarComoCentavos(0n), moneda };
}

/** Serialización decimal del importe. Cadena, nunca número (ADR-011). */
export function centavosATexto(centavos: Centavos): string {
  return centavos.toString();
}

export function esCeroElMonto(monto: Monto): boolean {
  return monto.centavos === 0n;
}

export function esNegativoElMonto(monto: Monto): boolean {
  return monto.centavos < 0n;
}

/** El monto como racional en centavos, para entrar en la cadena de cálculo. */
export function montoARacional(monto: Monto): Racional {
  return racionalDesdeEntero(monto.centavos);
}

export function sumarMontos(a: Monto, b: Monto): Resultado<Monto, ErrorMotor> {
  if (a.moneda !== b.moneda) return falla(errorDeEntrada('DINERO_MONEDAS_DISTINTAS'));
  return ok({ centavos: marcarComoCentavos(a.centavos + b.centavos), moneda: a.moneda });
}

/**
 * Resta de montos. Nunca devuelve un importe negativo: si el minuendo es menor
 * que el sustraendo, es dato inconsistente y se informa como error, no como un
 * monto en rojo que después alguien interpreta como crédito a favor.
 */
export function restarMontos(a: Monto, b: Monto): Resultado<Monto, ErrorMotor> {
  if (a.moneda !== b.moneda) return falla(errorDeEntrada('DINERO_MONEDAS_DISTINTAS'));
  const diferencia = a.centavos - b.centavos;
  if (diferencia < 0n) return falla(errorDeEntrada('DINERO_RESTA_DA_NEGATIVO'));
  return ok({ centavos: marcarComoCentavos(diferencia), moneda: a.moneda });
}

/** `-1` si a < b, `0` si iguales, `1` si a > b. Monedas distintas: error. */
export function compararMontos(a: Monto, b: Monto): Resultado<-1 | 0 | 1, ErrorMotor> {
  if (a.moneda !== b.moneda) return falla(errorDeEntrada('DINERO_MONEDAS_DISTINTAS'));
  if (a.centavos < b.centavos) return ok<-1 | 0 | 1>(-1);
  if (a.centavos > b.centavos) return ok<-1 | 0 | 1>(1);
  return ok<-1 | 0 | 1>(0);
}
