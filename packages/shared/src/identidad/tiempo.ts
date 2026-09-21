/**
 * Tiempo del dominio de identidad — aritmética de instantes y de fechas
 * civiles, sin reloj y sin `Date`.
 *
 * Dos reglas heredadas de ADR-016 y de la regla de lectura 5 del contrato:
 *
 * 1. **El dominio no lee el reloj.** El "ahora" entra siempre por parámetro
 *    como `InstanteDeEvaluacion`. Un test estructural recorre todo
 *    `packages/shared` y falla si aparece cualquier lectura del reloj.
 * 2. **No se usa el objeto de fecha de la plataforma para calcular.** Arrastra
 *    zona horaria, horario de verano y el reloj del proceso. Acá la aritmética
 *    es entera y propia, con el algoritmo de días civiles de Howard Hinnant,
 *    que es exacto para todo el rango proléptico gregoriano.
 *
 * Una decisión que importa y se declara: la vigencia de una matrícula
 * (`vigenciaHasta`) es una **fecha civil argentina**, no un instante UTC. Un
 * instante se convierte a fecha civil argentina con un desplazamiento fijo de
 * −03:00. La República Argentina no aplica horario de verano desde 2009
 * (Ley 26.350 y su no prórroga), así que el desplazamiento es constante; si
 * alguna vez volviera a aplicarse, esta constante deja de alcanzar y hay que
 * volver a compuerta. Tomar la fecha en UTC en vez de en hora local dejaría
 * vencida una matrícula a las 21:00 del último día de vigencia, tres horas
 * antes de lo que dice la norma interna: el criterio es no perjudicar a quien
 * depende del plazo.
 */

import type {
  DuracionEnSegundos,
  ErrorIdentidad,
  FechaCivil,
  Instante,
  InstanteDeEvaluacion,
  Resultado,
} from './contrato/v1';
import { errorDeEntrada, falla, ok } from './errores';

/** Desplazamiento horario de la República Argentina respecto de UTC, en minutos. */
export const DESPLAZAMIENTO_ARGENTINA_EN_MINUTOS = -180;

const MILISEGUNDOS_POR_DIA = 86_400_000;
const MILISEGUNDOS_POR_MINUTO = 60_000;

/** `2026-09-21T14:03:11.412Z` — ISO 8601 en UTC. Los milisegundos son opcionales. */
const FORMATO_INSTANTE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?Z$/;
const FORMATO_FECHA_CIVIL = /^(\d{4})-(\d{2})-(\d{2})$/;

const ANIO_MINIMO = 1900;
const ANIO_MAXIMO = 2999;

export interface PartesDeFechaCivil {
  readonly anio: number;
  readonly mes: number;
  readonly dia: number;
}

export function esBisiesto(anio: number): boolean {
  return (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0;
}

export function diasDelMes(anio: number, mes: number): number {
  if (mes === 2) return esBisiesto(anio) ? 29 : 28;
  return mes === 4 || mes === 6 || mes === 9 || mes === 11 ? 30 : 31;
}

/**
 * Días transcurridos desde la época (1970-01-01) hasta una fecha civil.
 * Algoritmo de Howard Hinnant, `days_from_civil`: aritmética entera pura.
 */
export function diasDesdeLaEpoca(anio: number, mes: number, dia: number): number {
  const a = mes <= 2 ? anio - 1 : anio;
  const era = Math.floor(a / 400);
  const anioDeLaEra = a - era * 400;
  const diaDelAnio = Math.floor((153 * (mes + (mes > 2 ? -3 : 9)) + 2) / 5) + dia - 1;
  const diaDeLaEra = anioDeLaEra * 365 + Math.floor(anioDeLaEra / 4) - Math.floor(anioDeLaEra / 100) + diaDelAnio;
  return era * 146_097 + diaDeLaEra - 719_468;
}

/** Inversa de `diasDesdeLaEpoca` (`civil_from_days` de Hinnant). */
export function fechaDesdeDiasDeLaEpoca(dias: number): PartesDeFechaCivil {
  const z = dias + 719_468;
  const era = Math.floor(z / 146_097);
  const diaDeLaEra = z - era * 146_097;
  const anioDeLaEra = Math.floor(
    (diaDeLaEra - Math.floor(diaDeLaEra / 1460) + Math.floor(diaDeLaEra / 36_524) - Math.floor(diaDeLaEra / 146_096)) /
      365,
  );
  const anio = anioDeLaEra + era * 400;
  const diaDelAnio = diaDeLaEra - (365 * anioDeLaEra + Math.floor(anioDeLaEra / 4) - Math.floor(anioDeLaEra / 100));
  const mp = Math.floor((5 * diaDelAnio + 2) / 153);
  const dia = diaDelAnio - Math.floor((153 * mp + 2) / 5) + 1;
  const mes = mp + (mp < 10 ? 3 : -9);
  return { anio: mes <= 2 ? anio + 1 : anio, mes, dia };
}

function dosDigitos(n: number): string {
  return String(n).padStart(2, '0');
}

function textoDeFechaCivil(partes: PartesDeFechaCivil): string {
  return `${String(partes.anio).padStart(4, '0')}-${dosDigitos(partes.mes)}-${dosDigitos(partes.dia)}`;
}

/**
 * Únicas conversiones a las marcas nominales del contrato, que usan
 * `unique symbol` no exportados. Encerradas acá a propósito: fuera de este
 * archivo no hay forma de fabricar un `Instante` sin validarlo.
 */
function marcarComoInstante(texto: string): Instante {
  return texto as Instante;
}

function marcarComoFechaCivil(texto: string): FechaCivil {
  return texto as FechaCivil;
}

/** Construye un `Instante` desde texto ISO 8601 en UTC. */
export function comoInstante(texto: string): Resultado<Instante, ErrorIdentidad> {
  const coincidencia = FORMATO_INSTANTE.exec(texto);
  if (coincidencia === null) return falla(errorDeEntrada('INSTANTE_FORMATO_INVALIDO'));
  const anio = Number(coincidencia[1]);
  const mes = Number(coincidencia[2]);
  const dia = Number(coincidencia[3]);
  const hora = Number(coincidencia[4]);
  const minuto = Number(coincidencia[5]);
  const segundo = Number(coincidencia[6]);
  if (anio < ANIO_MINIMO || anio > ANIO_MAXIMO) {
    return falla(errorDeEntrada('INSTANTE_FUERA_DE_RANGO'));
  }
  if (mes < 1 || mes > 12 || dia < 1 || dia > diasDelMes(anio, mes)) {
    return falla(errorDeEntrada('INSTANTE_INEXISTENTE_EN_EL_CALENDARIO'));
  }
  // No se admiten segundos intercalares (`:60`): el contrato habla de un
  // instante absoluto en UTC, y `60` sólo aparece en relojes que los publican.
  if (hora > 23 || minuto > 59 || segundo > 59) {
    return falla(errorDeEntrada('INSTANTE_INEXISTENTE_EN_EL_CALENDARIO'));
  }
  return ok(marcarComoInstante(normalizarTextoDeInstante(coincidencia)));
}

function normalizarTextoDeInstante(coincidencia: RegExpExecArray): string {
  const milisegundos = coincidencia[7] ?? '000';
  return `${coincidencia[1]}-${coincidencia[2]}-${coincidencia[3]}T${coincidencia[4]}:${coincidencia[5]}:${coincidencia[6]}.${milisegundos}Z`;
}

/**
 * Marca un instante como el instante de evaluación de una regla. Es la única
 * puerta hacia `InstanteDeEvaluacion`: el borde lee el reloj una sola vez y lo
 * pasa por acá, y de ahí en más el tiempo es un dato.
 */
export function comoInstanteDeEvaluacion(instante: Instante): InstanteDeEvaluacion {
  return instante as InstanteDeEvaluacion;
}

/** Construye una `FechaCivil` argentina desde texto `AAAA-MM-DD`. */
export function comoFechaCivil(texto: string): Resultado<FechaCivil, ErrorIdentidad> {
  const coincidencia = FORMATO_FECHA_CIVIL.exec(texto);
  if (coincidencia === null) return falla(errorDeEntrada('FECHA_FORMATO_INVALIDO'));
  const anio = Number(coincidencia[1]);
  const mes = Number(coincidencia[2]);
  const dia = Number(coincidencia[3]);
  if (anio < ANIO_MINIMO || anio > ANIO_MAXIMO) return falla(errorDeEntrada('FECHA_FUERA_DE_RANGO'));
  if (mes < 1 || mes > 12 || dia < 1 || dia > diasDelMes(anio, mes)) {
    return falla(errorDeEntrada('FECHA_INEXISTENTE_EN_EL_CALENDARIO'));
  }
  return ok(marcarComoFechaCivil(textoDeFechaCivil({ anio, mes, dia })));
}

/**
 * Milisegundos desde la época de un instante **ya validado**. Total: si el
 * texto no tuviera forma de instante devuelve `NaN`, que propaga la falla en
 * vez de disfrazarla — pero por construcción no puede ocurrir, porque la única
 * forma de obtener un `Instante` es `comoInstante`.
 */
export function milisegundosDe(instante: Instante): number {
  const coincidencia = FORMATO_INSTANTE.exec(instante);
  if (coincidencia === null) return Number.NaN;
  const dias = diasDesdeLaEpoca(Number(coincidencia[1]), Number(coincidencia[2]), Number(coincidencia[3]));
  const segundosDelDia =
    Number(coincidencia[4]) * 3600 + Number(coincidencia[5]) * 60 + Number(coincidencia[6]);
  return dias * MILISEGUNDOS_POR_DIA + segundosDelDia * 1000 + Number(coincidencia[7] ?? '0');
}

/** Inversa de `milisegundosDe`. Redondea hacia abajo al milisegundo. */
export function instanteDesdeMilisegundos(milisegundos: number): Instante {
  const enteros = Math.floor(milisegundos);
  const dias = Math.floor(enteros / MILISEGUNDOS_POR_DIA);
  const restoDelDia = enteros - dias * MILISEGUNDOS_POR_DIA;
  const { anio, mes, dia } = fechaDesdeDiasDeLaEpoca(dias);
  const hora = Math.floor(restoDelDia / 3_600_000);
  const minuto = Math.floor((restoDelDia % 3_600_000) / 60_000);
  const segundo = Math.floor((restoDelDia % 60_000) / 1000);
  const milis = restoDelDia % 1000;
  return marcarComoInstante(
    `${textoDeFechaCivil({ anio, mes, dia })}T${dosDigitos(hora)}:${dosDigitos(minuto)}:${dosDigitos(segundo)}.${String(
      milis,
    ).padStart(3, '0')}Z`,
  );
}

/** Suma segundos a un instante. Acepta valores negativos. */
export function sumarSegundos(instante: Instante, segundos: number): Instante {
  return instanteDesdeMilisegundos(milisegundosDe(instante) + segundos * 1000);
}

/** Segundos transcurridos de `desde` a `hasta`. Negativo si `hasta` es anterior. */
export function segundosEntre(desde: Instante, hasta: Instante): number {
  return (milisegundosDe(hasta) - milisegundosDe(desde)) / 1000;
}

/** Fecha civil **argentina** correspondiente a un instante UTC. */
export function fechaCivilArgentinaDe(instante: Instante): FechaCivil {
  const corrido = milisegundosDe(instante) + DESPLAZAMIENTO_ARGENTINA_EN_MINUTOS * MILISEGUNDOS_POR_MINUTO;
  return marcarComoFechaCivil(textoDeFechaCivil(fechaDesdeDiasDeLaEpoca(Math.floor(corrido / MILISEGUNDOS_POR_DIA))));
}

/**
 * Último milisegundo de una fecha civil argentina, expresado en milisegundos
 * desde la época en UTC. `2027-03-18` vence el `2027-03-19T02:59:59.999Z`.
 */
export function finDelDiaCivilArgentinoEnMilisegundos(fecha: FechaCivil): number {
  const coincidencia = FORMATO_FECHA_CIVIL.exec(fecha);
  if (coincidencia === null) return Number.NaN;
  const dias = diasDesdeLaEpoca(Number(coincidencia[1]), Number(coincidencia[2]), Number(coincidencia[3]));
  return (
    (dias + 1) * MILISEGUNDOS_POR_DIA - DESPLAZAMIENTO_ARGENTINA_EN_MINUTOS * MILISEGUNDOS_POR_MINUTO - 1
  );
}

/**
 * ¿El instante cae **dentro** de la vigencia que termina el último día de
 * `vigenciaHasta`? El último día cuenta entero: el redondeo favorece a quien
 * depende del plazo.
 */
export function estaDentroDeLaVigencia(instante: Instante, vigenciaHasta: FechaCivil): boolean {
  return milisegundosDe(instante) <= finDelDiaCivilArgentinoEnMilisegundos(vigenciaHasta);
}

/** Construye una duración en segundos. Rechaza valores no enteros o negativos. */
export function comoDuracionEnSegundos(segundos: number): Resultado<DuracionEnSegundos, ErrorIdentidad> {
  if (!Number.isInteger(segundos) || segundos < 0) {
    return falla(errorDeEntrada('DURACION_INVALIDA'));
  }
  return ok(segundos as DuracionEnSegundos);
}

/**
 * Igual que `comoDuracionEnSegundos` pero para las constantes del propio
 * paquete, que son literales verificados por test. No se exporta fuera del
 * dominio de identidad: las duraciones que vienen de afuera se validan.
 */
export function duracionLiteral(segundos: number): DuracionEnSegundos {
  return segundos as DuracionEnSegundos;
}
