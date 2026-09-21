/**
 * CUIT/CUIL — dígito verificador. Contrato §9, criterio **CA-04**.
 *
 * Este archivo es el que la spec 002 daba por existente desde su versión 1 y
 * que en realidad nunca se construyó: quedó anotado como obligación de
 * frontera **F-15** del plan y como hallazgo de la entrada 049 del registro de
 * compuertas. Se construye acá, con la ruta que el resto de las specs ya cita
 * (`packages/shared/src/identidad/cuit.ts`), para no inventar una convención
 * nueva.
 *
 * Alcance, y es importante: verificar el dígito verificador **no** verifica
 * identidad. Dice que el número está bien formado, no que exista, ni que sea
 * de quien lo escribe. El sistema no puede afirmar más que eso, y ninguna
 * pantalla debe decir "CUIT válido" en el sentido de "verificado".
 *
 * Tampoco decide nada sobre duplicados: CA-04 y ADR-025 son categóricos en que
 * el duplicado **no** altera la respuesta a quien se registra. Acá sólo se
 * valida la forma.
 *
 * El algoritmo es el módulo 11 que publica la AFIP (hoy ARCA): se multiplican
 * los primeros diez dígitos por la serie de pesos 5-4-3-2-7-6-5-4-3-2, se suma,
 * se toma el resto de dividir por 11 y el dígito verificador es 11 menos ese
 * resto.
 */

import type { ErrorIdentidad, Resultado } from './contrato/v1';
import { errorDeEntrada, falla, ok } from './errores';

/** Pesos del módulo 11, en el orden de los diez primeros dígitos. */
const PESOS: readonly number[] = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

/**
 * Prefijos de tipo conocidos. `20`, `23`, `24` y `27` son de personas humanas;
 * `30`, `33` y `34` de personas jurídicas. No se usan para validar el dígito:
 * se exponen aparte porque rechazar un prefijo desconocido es una decisión de
 * producto —hay prefijos históricos y de casos especiales— y no una regla de
 * aritmética.
 */
export const PREFIJOS_CONOCIDOS: readonly string[] = ['20', '23', '24', '27', '30', '33', '34'];

/** Sólo dígitos, guiones, puntos y espacios: nada más se admite como entrada. */
const CARACTERES_ADMITIDOS = /^[\d\s.-]+$/;

/**
 * Quita separadores. Devuelve `null` si el valor trae algo que no es dígito ni
 * separador, para no "limpiar" en silencio una entrada que en realidad está
 * mal (por ejemplo un correo escrito en el campo equivocado).
 */
export function normalizarCuitCuil(valor: string): string | null {
  if (valor.length === 0 || !CARACTERES_ADMITIDOS.test(valor)) return null;
  return valor.replace(/[\s.-]/g, '');
}

/**
 * Verifica el dígito verificador de un CUIT/CUIL. Implementa la firma
 * declarada en el contrato §9.
 *
 * Acepta el número con o sin separadores (`20-12345678-6`, `20123456786`).
 *
 * Caso especial documentado: cuando el resto de la división por 11 da 1, el
 * dígito calculado sería 10, que no es un dígito. La regla de la AFIP para ese
 * caso es que el número se emite con prefijo `23` y dígito verificador `9`
 * —histórico `4` para las CUIL femeninas asignadas bajo el régimen anterior—.
 * Fuera del prefijo `23`, un resto de 1 significa que el número no existe.
 *
 * `00000000000` se rechaza explícitamente: su dígito verificador cierra, pero
 * no es un CUIT, y aceptarlo dejaría pasar el campo vacío disfrazado de número.
 */
export function verificarDigitoVerificadorCuit(valor: string): boolean {
  return verificarCuitCuil(valor).ok;
}

/**
 * Misma verificación, con el motivo del rechazo. El borde la usa cuando tiene
 * que decirle a la persona qué corregir; `verificarDigitoVerificadorCuit` es
 * la forma booleana que declara el contrato.
 *
 * Devuelve el CUIT/CUIL **normalizado** (once dígitos, sin separadores), que
 * es la forma con la que se calcula el índice ciego de F-01: normalizar en un
 * solo lugar evita que `20-12345678-6` y `20123456786` produzcan dos índices
 * distintos y, con ellos, dos cuentas para la misma persona.
 */
export function verificarCuitCuil(valor: string): Resultado<string, ErrorIdentidad> {
  const normalizado = normalizarCuitCuil(valor);
  if (normalizado === null) return falla(errorDeEntrada('CUIT_FORMATO_INVALIDO', 'cuitCuil'));
  if (normalizado.length !== 11) return falla(errorDeEntrada('CUIT_LONGITUD_INVALIDA', 'cuitCuil'));
  if (normalizado === '00000000000') {
    return falla(errorDeEntrada('CUIT_DIGITO_VERIFICADOR_INVALIDO', 'cuitCuil'));
  }

  let suma = 0;
  for (let posicion = 0; posicion < 10; posicion += 1) {
    const digito = normalizado.charCodeAt(posicion) - 48;
    const peso = PESOS[posicion] ?? 0;
    suma += digito * peso;
  }
  const resto = suma % 11;
  const declarado = normalizado.charCodeAt(10) - 48;
  const prefijo = normalizado.slice(0, 2);

  if (resto === 0) {
    return declarado === 0 ? ok(normalizado) : falla(errorDeEntrada('CUIT_DIGITO_VERIFICADOR_INVALIDO', 'cuitCuil'));
  }
  if (resto === 1) {
    const admitidos = prefijo === '23' ? [9, 4] : [];
    return admitidos.includes(declarado)
      ? ok(normalizado)
      : falla(errorDeEntrada('CUIT_DIGITO_VERIFICADOR_INVALIDO', 'cuitCuil'));
  }
  return declarado === 11 - resto
    ? ok(normalizado)
    : falla(errorDeEntrada('CUIT_DIGITO_VERIFICADOR_INVALIDO', 'cuitCuil'));
}

/**
 * ¿El prefijo de tipo es uno de los conocidos? Se expone por separado, y no
 * dentro de la verificación del dígito, porque es una regla de producto
 * revisable, no aritmética: el día que la AFIP habilite un prefijo nuevo, un
 * sistema que lo rechazara dejaría a una persona sin poder registrarse.
 */
export function tienePrefijoConocido(valor: string): boolean {
  const normalizado = normalizarCuitCuil(valor);
  if (normalizado === null || normalizado.length !== 11) return false;
  return PREFIJOS_CONOCIDOS.includes(normalizado.slice(0, 2));
}
