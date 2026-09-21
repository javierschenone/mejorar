/**
 * Errores del motor.
 *
 * El contrato (§3) ya fija la forma: `ErrorMotor` lleva `clase`, `codigo`,
 * `referencia` y un `detalle` de **valores cerrados**. No lleva texto libre
 * sobre el caso: la salvaguarda S-05 prohíbe que el motor redacte lenguaje
 * propio sobre una persona, así que el mensaje que ve el usuario se resuelve
 * por plantilla a partir del `codigo` (ADR-014, tarea T-11). Acá se declara el
 * vocabulario cerrado de códigos y los constructores.
 *
 * El motor **no lanza**: estos errores viajan dentro de `Resultado`
 * (ADR-012, regla de lectura 4 del contrato).
 */

import type { ClaveParametro, ErrorMotor, Resultado, RutaCampoEntrada } from './contrato/v1';

/**
 * Códigos estables de error emitidos por los módulos de dinero y de tiempo.
 * Unión cerrada: un código mal escrito es un error de compilación, y la
 * plantilla que lo traduce a texto se busca por esta clave.
 */
export type CodigoError =
  // dinero
  | 'DINERO_MONTO_NEGATIVO'
  | 'DINERO_MONEDAS_DISTINTAS'
  | 'DINERO_RESTA_DA_NEGATIVO'
  | 'DINERO_DENOMINADOR_CERO'
  | 'DINERO_DIVISION_POR_CERO'
  | 'DINERO_VALOR_NO_ENTERO'
  // tiempo
  | 'FECHA_FORMATO_INVALIDO'
  | 'FECHA_INEXISTENTE_EN_EL_CALENDARIO'
  | 'FECHA_FUERA_DE_RANGO_ADMITIDO'
  | 'FECHA_ANIO_FUERA_DE_RANGO'
  | 'PLAZO_NO_ENTERO'
  // consistencia interna
  | 'REDONDEO_SEGUN_NORMA_SIN_REGLA';

/** Constructor del error de entrada inválida (§7 de la spec). */
export function errorDeEntrada(
  codigo: CodigoError,
  referencia: RutaCampoEntrada | ClaveParametro | null = null,
): ErrorMotor {
  return {
    clase: 'ENTRADA_INVALIDA',
    codigo,
    referencia,
    detalle: { fechaDeEvaluacion: null, versionCatalogo: null, datos: [] },
  };
}

/** Defecto del propio motor. Nunca debería ocurrir; si ocurre, se registra. */
export function errorDeInconsistenciaInterna(
  codigo: CodigoError,
  referencia: RutaCampoEntrada | ClaveParametro | null = null,
): ErrorMotor {
  return {
    clase: 'INCONSISTENCIA_INTERNA',
    codigo,
    referencia,
    detalle: { fechaDeEvaluacion: null, versionCatalogo: null, datos: [] },
  };
}

export function ok<TValor>(valor: TValor): Resultado<TValor, ErrorMotor> {
  return { ok: true, valor };
}

export function falla<TValor>(error: ErrorMotor): Resultado<TValor, ErrorMotor> {
  return { ok: false, error };
}
