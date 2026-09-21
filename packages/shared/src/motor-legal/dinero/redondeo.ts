/**
 * Redondeo por rol del monto — CA-32, ADR-011 §3 y §4, constitución #1 y #3.
 *
 * "El redondeo favorece al cliente" no es una dirección: depende de qué
 * representa el número. Por eso el sentido lo decide el **rol** del monto y no
 * el sitio de llamada, y por eso el redondeo aplicado viaja en el resultado
 * (`RedondeoAplicado`) con su fundamento: un abogado tiene que poder ver por
 * qué el número terminó en ese centavo.
 *
 * | Rol | Sentido | Por qué favorece al cliente |
 * | --- | --- | --- |
 * | `PISO_DE_PROTECCION` | hacia arriba | porción intocable del ingreso: más alta, más protege |
 * | `TECHO_DE_AFECTACION` | hacia abajo | máximo que un tercero puede retenerle |
 * | `TECHO_DE_COBRO_AL_CLIENTE` | hacia abajo | máximo que se le puede cobrar |
 * | `RECLAMO_ESTIMADO` | hacia abajo | sobreestimar el reclamo destruye credibilidad (RL-07) e inflaría toda base de comisión (RL-09, CA-61) — aclaración v4 de CA-32, escalamiento E-1 |
 * | `SEGUN_NORMA` | el que fije la norma | la norma prevalece sobre todo lo anterior |
 *
 * El redondeo ocurre **una sola vez**, acá, al construir el `Monto` que sale en
 * el resultado. No hay redondeos intermedios y por lo tanto no hay acumulación
 * de error (ADR-011 §2).
 *
 * Nota sobre el signo: el contrato declara `redondear` como función **total**
 * —no devuelve `Resultado`—, así que no puede rechazar un racional negativo.
 * Conserva el signo, con semántica matemática estricta: hacia arriba es hacia
 * +∞ y hacia abajo es hacia −∞. Los importes del dominio son no negativos y su
 * validación está en `crearCentavos`; acá queda documentado y cubierto por test.
 */

import type {
  Moneda,
  Monto,
  Racional,
  RedondeoAplicado,
  ReglaRedondeoNormativa,
  RolDelMonto,
  SentidoRedondeo,
} from '../contrato/v1';
import { centavosSinValidarSigno } from './centavos';

/** Unidad por defecto: el centavo. La norma puede fijar otra (ej.: el peso). */
export const UNIDAD_CENTAVO = 1n;

/**
 * Sentido de redondeo que corresponde a cada rol cuando la norma no dispone
 * otra cosa. Tabla explícita y exhaustiva sobre `RolDelMonto`: agregar un rol
 * al contrato sin decidir su sentido es un error de compilación.
 *
 * `SEGUN_NORMA` no tiene sentido propio: lo aporta la `ReglaRedondeoNormativa`.
 */
const SENTIDO_POR_ROL: { readonly [R in Exclude<RolDelMonto, 'SEGUN_NORMA'>]: SentidoRedondeo } = {
  PISO_DE_PROTECCION: 'HACIA_ARRIBA',
  TECHO_DE_AFECTACION: 'HACIA_ABAJO',
  TECHO_DE_COBRO_AL_CLIENTE: 'HACIA_ABAJO',
  RECLAMO_ESTIMADO: 'HACIA_ABAJO',
};

/**
 * Sentido aplicable. La regla normativa prevalece siempre que esté presente
 * (ADR-011 §3).
 *
 * Caso degenerado: `SEGUN_NORMA` sin regla normativa. El motor no conoce el
 * criterio de la norma y la firma del contrato no le deja fallar, así que
 * aplica `AL_MAS_CERCANO` —el sentido que menos desplaza el número— y el
 * `RedondeoAplicado` sale con `fundamento: null`, que es la marca detectable
 * aguas arriba (`redondeoEsConsistente`). Escalado al orquestador.
 */
export function sentidoDeRedondeo(
  rol: RolDelMonto,
  reglaNormativa: ReglaRedondeoNormativa | null,
): SentidoRedondeo {
  if (reglaNormativa !== null) return reglaNormativa.sentido;
  if (rol === 'SEGUN_NORMA') return 'AL_MAS_CERCANO';
  return SENTIDO_POR_ROL[rol];
}

/**
 * `false` cuando el redondeo se pidió `SEGUN_NORMA` pero no vino la norma.
 * Es una inconsistencia de catálogo, no un error de cálculo: quien compone el
 * hallazgo la detecta con esta función y decide qué hacer.
 */
export function redondeoEsConsistente(redondeo: RedondeoAplicado): boolean {
  return !(redondeo.rol === 'SEGUN_NORMA' && redondeo.fundamento === null);
}

/** División entera hacia −∞ (no truncada hacia cero). `divisor` > 0. */
function divisionHaciaAbajo(dividendo: bigint, divisor: bigint): bigint {
  const cociente = dividendo / divisor;
  const resto = dividendo % divisor;
  return resto !== 0n && dividendo < 0n ? cociente - 1n : cociente;
}

/**
 * Sentido que rompe el empate en `AL_MAS_CERCANO`: el del rol, para que la
 * mitad exacta siga favoreciendo al cliente. Si el rol es `SEGUN_NORMA` (y por
 * lo tanto no hay rol que consultar), el empate va hacia abajo: es el criterio
 * conservador, no infla ningún importe.
 */
function sentidoDelEmpate(rol: RolDelMonto): 'HACIA_ARRIBA' | 'HACIA_ABAJO' {
  if (rol === 'SEGUN_NORMA') return 'HACIA_ABAJO';
  return SENTIDO_POR_ROL[rol] === 'HACIA_ARRIBA' ? 'HACIA_ARRIBA' : 'HACIA_ABAJO';
}

/**
 * Redondea un racional expresado en **centavos** al múltiplo de `unidad`.
 * Implementa la firma declarada en el contrato (§2).
 */
export function redondear(
  valor: Racional,
  moneda: Moneda,
  rol: RolDelMonto,
  reglaNormativa: ReglaRedondeoNormativa | null,
): { readonly monto: Monto; readonly redondeo: RedondeoAplicado } {
  const sentido = sentidoDeRedondeo(rol, reglaNormativa);
  const unidadPedida = reglaNormativa === null ? UNIDAD_CENTAVO : reglaNormativa.unidadEnCentavos;
  // Una unidad no positiva sería un catálogo mal armado; acá no se puede
  // fallar, así que se usa el centavo y el `RedondeoAplicado` lo declara.
  const unidad = unidadPedida > 0n ? unidadPedida : UNIDAD_CENTAVO;

  // `valor.d` es siempre positivo: el módulo `racional` normaliza el signo.
  const denominador = valor.d * unidad;
  const multiploInferior = divisionHaciaAbajo(valor.n, denominador);
  const resto = valor.n - multiploInferior * denominador;

  let multiplo: bigint;
  if (resto === 0n) {
    multiplo = multiploInferior;
  } else if (sentido === 'HACIA_ABAJO') {
    multiplo = multiploInferior;
  } else if (sentido === 'HACIA_ARRIBA') {
    multiplo = multiploInferior + 1n;
  } else {
    const dobleDelResto = resto * 2n;
    if (dobleDelResto > denominador) multiplo = multiploInferior + 1n;
    else if (dobleDelResto < denominador) multiplo = multiploInferior;
    else multiplo = sentidoDelEmpate(rol) === 'HACIA_ARRIBA' ? multiploInferior + 1n : multiploInferior;
  }

  return {
    monto: { centavos: centavosSinValidarSigno(multiplo * unidad), moneda },
    redondeo: {
      rol,
      sentido,
      unidadEnCentavos: unidad,
      fundamento: reglaNormativa === null ? null : reglaNormativa.fundamento,
    },
  };
}
