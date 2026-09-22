/**
 * Bloqueo por intentos fallidos — contrato §9, **ADR-025** §4.
 * Criterios CA-09, CA-36, CA-37; recaudos A-1 y A-2.
 *
 * Tres cosas que esta función tiene que sostener a la vez:
 *
 * 1. **Demora creciente y bloqueo temporal** (CA-09), para que probar
 *    contraseñas a ciegas salga caro.
 * 2. **El bloqueo no puede ser el oráculo de enumeración** (ADR-025 §4). Por
 *    eso la decisión se toma sobre una `ClaveDeTrafico` —el HMAC del
 *    identificador presentado— y **exista o no la cuenta**. Esta función no
 *    sabe ni puede saber si la cuenta existe: recibe una lista de instantes,
 *    nada más. Que no lo sepa es la garantía.
 * 3. **El bloqueo nunca cierra el camino de recuperación** (CA-36, recaudo
 *    A-1). Cualquiera puede bloquear la cuenta de otra persona tipeando mal su
 *    contraseña cinco veces; sin salida, eso sería una denegación de servicio
 *    sin escape sobre alguien bajo estrés financiero (art. 8 bis de la Ley
 *    24.240). La garantía está en el tipo: `laRecuperacionSiempreDisponible`
 *    es el literal `true` del contrato y **no se puede poner en `false`**.
 *
 * El umbral y la ventana son parámetros de **producto**, no normativos
 * (CA-37, decisión 002-A): se ajustan sin revisión legal. Viven en
 * `parametros.ts` con su cita igual, porque son una decisión humana
 * registrada y hay que poder reconstruir de dónde salieron.
 */

import type {
  DecisionDeBloqueo,
  DuracionEnSegundos,
  Instante,
  InstanteDeEvaluacion,
  PoliticaDeBloqueo,
} from './contrato/v1';
import { PARAMETROS_DE_IDENTIDAD } from './parametros';
import { duracionLiteral, instanteDesdeMilisegundos, milisegundosDe } from './tiempo';

const PERMITIR: DecisionDeBloqueo = { clase: 'PERMITIR' };

/**
 * Demora creciente, en segundos, según cuántos intentos fallidos hay en la
 * ventana. Duplica a partir del segundo fallo y tiene tope.
 *
 * Con la política por defecto (umbral 5) la escalera es 0 · 1 · 2 · 4 y al
 * quinto fallo hay bloqueo, así que el tope de 30 s no se alcanza; existe para
 * que subir el umbral no produzca una espera absurda por aritmética.
 */
export function demoraPorIntentos(intentosEnLaVentana: number): DuracionEnSegundos {
  if (intentosEnLaVentana <= 1) return duracionLiteral(0);
  const base = PARAMETROS_DE_IDENTIDAD['bloqueo.demoraBase'].valor;
  const tope = PARAMETROS_DE_IDENTIDAD['bloqueo.demoraMaxima'].valor;
  return duracionLiteral(Math.min(base * 2 ** (intentosEnLaVentana - 2), tope));
}

/**
 * Decide qué hacer con el intento que está llegando. Pura: recibe el historial
 * de intentos fallidos y el instante de evaluación. Implementa la firma
 * declarada en el contrato §9.
 *
 * Detalles que importan y están cubiertos por test:
 *
 * - Los intentos **posteriores** al instante de evaluación se ignoran. Un
 *   instante futuro en el historial es un dato mal cargado o un reloj
 *   desfasado, y contarlo castigaría a quien no hizo nada.
 * - La ventana es **cerrada por abajo**: un intento de hace exactamente 15
 *   minutos con ventana de 15 minutos todavía cuenta. El borde exacto se
 *   prueba en los dos sentidos.
 * - El bloqueo se cuenta desde el **último** intento fallido de la ventana, no
 *   desde el primero: si no, seguir insistiendo no costaría nada.
 * - Si el bloqueo ya venció (posible con una duración menor que la ventana),
 *   se permite. El bloqueo es temporal de verdad, no una etiqueta pegada.
 */
export function decidirBloqueo(
  intentosFallidos: readonly Instante[],
  politica: PoliticaDeBloqueo,
  momento: InstanteDeEvaluacion,
): DecisionDeBloqueo {
  const ahora = milisegundosDe(momento);
  const desde = ahora - politica.ventana * 1000;

  let cantidad = 0;
  let ultimo = Number.NEGATIVE_INFINITY;
  for (const intento of intentosFallidos) {
    const cuando = milisegundosDe(intento);
    if (cuando > ahora || cuando < desde) continue;
    cantidad += 1;
    if (cuando > ultimo) ultimo = cuando;
  }

  if (cantidad === 0) return PERMITIR;

  if (cantidad >= politica.umbralDeIntentos) {
    const hasta = ultimo + politica.duracionDelBloqueo * 1000;
    if (hasta <= ahora) return PERMITIR;
    return { clase: 'BLOQUEAR', hasta: instanteDesdeMilisegundos(hasta) };
  }

  const demora = demoraPorIntentos(cantidad);
  return demora === 0 ? PERMITIR : { clase: 'DEMORAR', demora };
}

/**
 * CA-36 / recaudo A-1, hecho función para que exista un lugar donde probarlo.
 *
 * El tipo de retorno es el literal `true`, no `boolean`: una versión de esta
 * función que alguna vez devolviera `false` **no compilaría**. Y el valor sale
 * de `politica.laRecuperacionSiempreDisponible`, que en el contrato también es
 * el literal `true`. Dos veces la misma garantía, por si alguien alguna vez
 * reescribe una de las dos.
 *
 * Se le pasa la decisión de bloqueo, aunque no la use, a propósito: quien lea
 * el llamado tiene que ver que **ni siquiera estando bloqueada** la cuenta
 * pierde el camino de recuperación.
 */
export function laRecuperacionSigueDisponible(
  _decision: DecisionDeBloqueo,
  politica: PoliticaDeBloqueo,
): true {
  return politica.laRecuperacionSiempreDisponible;
}
