/**
 * Errores del dominio de identidad.
 *
 * El contrato (§1) ya fija la forma: `ErrorIdentidad` lleva `clase`, `codigo`
 * y `referencia`. **No lleva texto libre**: el borde HTTP lo traduce a una de
 * las respuestas cerradas de §14, que son deliberadamente pocas y poco
 * informativas (R-05, CA-12). El mensaje que ve la persona se resuelve por
 * plantilla a partir del `codigo`, y lo escribe `ux-expert`.
 *
 * El dominio **no lanza** excepciones como flujo de control: estos errores
 * viajan dentro de `Resultado` (regla de lectura 4 del contrato).
 *
 * Para que el catálogo no quede sólo en la plantilla, cada código lleva acá su
 * mensaje en castellano rioplatense apto para mostrar. El borde decide si lo
 * usa o si usa uno más genérico por no-revelación: el dominio nunca decide qué
 * se le cuenta a quien está del otro lado.
 */

import type { ClaseErrorIdentidad, ErrorIdentidad, Resultado } from './contrato/v1';

/**
 * Códigos estables emitidos por el dominio de identidad. Unión cerrada: un
 * código mal escrito es un error de compilación.
 */
export type CodigoErrorIdentidad =
  // tiempo
  | 'INSTANTE_FORMATO_INVALIDO'
  | 'INSTANTE_INEXISTENTE_EN_EL_CALENDARIO'
  | 'INSTANTE_FUERA_DE_RANGO'
  | 'FECHA_FORMATO_INVALIDO'
  | 'FECHA_INEXISTENTE_EN_EL_CALENDARIO'
  | 'FECHA_FUERA_DE_RANGO'
  | 'DURACION_INVALIDA'
  // identificadores opacos
  | 'ID_VACIO'
  | 'ID_CON_ESPACIOS'
  | 'ID_CON_FORMA_DE_CORREO'
  | 'ID_CON_FORMA_DE_DOCUMENTO'
  | 'ID_CON_FORMA_DE_CUIT_CUIL'
  | 'ID_SOLO_NUMEROS'
  | 'ID_CON_CARACTERES_NO_ADMITIDOS'
  | 'ID_DEMASIADO_LARGO'
  | 'ID_NO_ES_ULID'
  // CUIT/CUIL
  | 'CUIT_FORMATO_INVALIDO'
  | 'CUIT_LONGITUD_INVALIDA'
  | 'CUIT_DIGITO_VERIFICADOR_INVALIDO'
  | 'CUIT_PREFIJO_DESCONOCIDO';

/** Mensajes en castellano rioplatense, aptos para mostrar. Sin jerga. */
const MENSAJES: Readonly<Record<CodigoErrorIdentidad, string>> = {
  INSTANTE_FORMATO_INVALIDO: 'La fecha y hora no tienen el formato esperado.',
  INSTANTE_INEXISTENTE_EN_EL_CALENDARIO: 'Esa fecha y hora no existen en el calendario.',
  INSTANTE_FUERA_DE_RANGO: 'Esa fecha está fuera del rango que el sistema admite.',
  FECHA_FORMATO_INVALIDO: 'La fecha no tiene el formato esperado (día, mes y año).',
  FECHA_INEXISTENTE_EN_EL_CALENDARIO: 'Esa fecha no existe en el calendario.',
  FECHA_FUERA_DE_RANGO: 'Esa fecha está fuera del rango que el sistema admite.',
  DURACION_INVALIDA: 'La duración tiene que ser una cantidad entera de segundos y no puede ser negativa.',
  ID_VACIO: 'Falta el identificador.',
  ID_CON_ESPACIOS: 'El identificador no puede tener espacios.',
  ID_CON_FORMA_DE_CORREO: 'Ahí no va una dirección de correo.',
  ID_CON_FORMA_DE_DOCUMENTO: 'Ahí no va un número de documento.',
  ID_CON_FORMA_DE_CUIT_CUIL: 'Ahí no va un CUIT o CUIL.',
  ID_SOLO_NUMEROS: 'El identificador no puede ser un número.',
  ID_CON_CARACTERES_NO_ADMITIDOS: 'El identificador tiene caracteres que no se admiten.',
  ID_DEMASIADO_LARGO: 'El identificador es más largo de lo que se admite.',
  ID_NO_ES_ULID: 'El identificador no tiene la forma esperada.',
  CUIT_FORMATO_INVALIDO: 'El CUIT/CUIL sólo puede tener números, guiones o espacios.',
  CUIT_LONGITUD_INVALIDA: 'El CUIT/CUIL tiene que tener 11 números.',
  CUIT_DIGITO_VERIFICADOR_INVALIDO: 'Revisá el CUIT/CUIL: el último número no verifica.',
  CUIT_PREFIJO_DESCONOCIDO: 'Revisá el CUIT/CUIL: no empieza con ninguno de los prefijos conocidos.',
};

/** Mensaje en castellano de un código de error, apto para mostrar. */
export function mensajeDeError(codigo: CodigoErrorIdentidad): string {
  return MENSAJES[codigo];
}

function construir(
  clase: ClaseErrorIdentidad,
  codigo: CodigoErrorIdentidad,
  referencia: string | null,
): ErrorIdentidad {
  return { clase, codigo, referencia };
}

/** Entrada que no cumple la forma esperada. */
export function errorDeEntrada(
  codigo: CodigoErrorIdentidad,
  referencia: string | null = null,
): ErrorIdentidad {
  return construir('ENTRADA_INVALIDA', codigo, referencia);
}

/** Defecto del propio dominio. Nunca debería ocurrir; si ocurre, se registra. */
export function errorDeInconsistenciaInterna(
  codigo: CodigoErrorIdentidad,
  referencia: string | null = null,
): ErrorIdentidad {
  return construir('INCONSISTENCIA_INTERNA', codigo, referencia);
}

export function ok<TValor>(valor: TValor): Resultado<TValor, ErrorIdentidad> {
  return { ok: true, valor };
}

export function falla<TValor>(error: ErrorIdentidad): Resultado<TValor, ErrorIdentidad> {
  return { ok: false, error };
}
