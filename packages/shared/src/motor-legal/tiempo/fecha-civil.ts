/**
 * Tiempo civil argentino — ADR-016 §2, CA-31.
 *
 * El motor **no lee el reloj**. No hay en este árbol ni una llamada a
 * `new Date()`, `Date.now()` ni equivalente: el "ahora" entra siempre por
 * parámetro como `FechaDeEvaluacion`, y la fecha contra la que se resuelven
 * los parámetros normativos entra como `FechaDelHecho`. Las dos son marcas
 * nominales distintas sobre `FechaCivil`, así que confundirlas no compila
 * (defecto D-24, CA-18, CA-29). Hay un test que recorre el código fuente del
 * paquete y falla si aparece cualquier lectura del reloj.
 *
 * Tampoco se usa `Date` para calcular: los plazos legales se cuentan en días
 * civiles, y `Date` arrastra zona horaria, horario de verano y el reloj del
 * proceso. Un corrimiento de un día acá decide si una deuda prescribió. La
 * aritmética es entera, propia y verificable.
 */

import type {
  ErrorMotor,
  FechaCivil,
  FechaDeEvaluacion,
  FechaDelHecho,
  Resultado,
} from '../contrato/v1';
import { errorDeEntrada, falla, ok } from '../errores';

/** Año mínimo y máximo admitidos. Fuera de ese rango es dato mal cargado. */
export const ANIO_MINIMO = 1800;
export const ANIO_MAXIMO = 2999;

const FORMATO = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface PartesDeFecha {
  readonly anio: number;
  readonly mes: number;
  readonly dia: number;
}

/**
 * Únicas conversiones a las marcas nominales de fecha del contrato, que usan
 * `unique symbol` no exportados. Encerradas acá a propósito.
 */
function marcarComoFechaCivil(texto: string): FechaCivil {
  return texto as FechaCivil;
}

export function esBisiesto(anio: number): boolean {
  return (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0;
}

export function diasDelMes(anio: number, mes: number): number {
  if (mes === 2) return esBisiesto(anio) ? 29 : 28;
  return mes === 4 || mes === 6 || mes === 9 || mes === 11 ? 30 : 31;
}

function aTextoDeFecha(anio: number, mes: number, dia: number): string {
  const a = String(anio).padStart(4, '0');
  const m = String(mes).padStart(2, '0');
  const d = String(dia).padStart(2, '0');
  return `${a}-${m}-${d}`;
}

/**
 * Construye una `FechaCivil` desde texto `AAAA-MM-DD`. Implementa la firma
 * declarada en el contrato (§1). Rechaza formatos inválidos y fechas que no
 * existen en el calendario (31 de abril, 29 de febrero de un año común).
 */
export function comoFechaCivil(texto: string): Resultado<FechaCivil, ErrorMotor> {
  const coincidencia = FORMATO.exec(texto);
  if (coincidencia === null) return falla(errorDeEntrada('FECHA_FORMATO_INVALIDO'));
  const anio = Number(coincidencia[1]);
  const mes = Number(coincidencia[2]);
  const dia = Number(coincidencia[3]);
  if (anio < ANIO_MINIMO || anio > ANIO_MAXIMO) {
    return falla(errorDeEntrada('FECHA_ANIO_FUERA_DE_RANGO'));
  }
  if (mes < 1 || mes > 12) return falla(errorDeEntrada('FECHA_INEXISTENTE_EN_EL_CALENDARIO'));
  if (dia < 1 || dia > diasDelMes(anio, mes)) {
    return falla(errorDeEntrada('FECHA_INEXISTENTE_EN_EL_CALENDARIO'));
  }
  return ok(marcarComoFechaCivil(texto));
}

/** Marca una fecha como la del hecho evaluado (contrato §1). */
export function comoFechaDelHecho(fecha: FechaCivil): FechaDelHecho {
  return fecha as FechaDelHecho;
}

/**
 * Marca una fecha como fecha de evaluación (contrato §1). Es el único "ahora"
 * del motor y **siempre** lo provee quien llama: el borde de la aplicación
 * lee el reloj una vez y lo pasa como dato (obligación de frontera del plan).
 */
export function comoFechaDeEvaluacion(fecha: FechaCivil): FechaDeEvaluacion {
  return fecha as FechaDeEvaluacion;
}

export function partesDeFecha(fecha: FechaCivil): PartesDeFecha {
  // El tipo `FechaCivil` sólo se obtiene de `comoFechaCivil`, que ya validó
  // el formato: acá el desarme es seguro.
  const texto = fecha as string;
  return {
    anio: Number(texto.slice(0, 4)),
    mes: Number(texto.slice(5, 7)),
    dia: Number(texto.slice(8, 10)),
  };
}

/**
 * Día civil como entero, contado desde una época fija. Algoritmo entero de
 * calendario gregoriano proléptico (days_from_civil): sin `Date`, sin zona
 * horaria y por lo tanto sin corrimientos en los bordes.
 */
export function aDiaSerial(fecha: FechaCivil): number {
  const { anio, mes, dia } = partesDeFecha(fecha);
  const a = mes <= 2 ? anio - 1 : anio;
  const era = Math.floor(a / 400);
  const anioDeLaEra = a - era * 400;
  const diaDelAnio = Math.floor((153 * (mes + (mes > 2 ? -3 : 9)) + 2) / 5) + dia - 1;
  const diaDeLaEra = anioDeLaEra * 365 + Math.floor(anioDeLaEra / 4) - Math.floor(anioDeLaEra / 100) + diaDelAnio;
  return era * 146097 + diaDeLaEra - 719468;
}

/** Inversa exacta de `aDiaSerial`. */
export function desdeDiaSerial(diaSerial: number): FechaCivil {
  const z = diaSerial + 719468;
  const era = Math.floor(z / 146097);
  const diaDeLaEra = z - era * 146097;
  const anioDeLaEra = Math.floor(
    (diaDeLaEra - Math.floor(diaDeLaEra / 1460) + Math.floor(diaDeLaEra / 36524) - Math.floor(diaDeLaEra / 146096)) / 365,
  );
  const anio = anioDeLaEra + era * 400;
  const diaDelAnio = diaDeLaEra - (365 * anioDeLaEra + Math.floor(anioDeLaEra / 4) - Math.floor(anioDeLaEra / 100));
  const mp = Math.floor((5 * diaDelAnio + 2) / 153);
  const dia = diaDelAnio - Math.floor((153 * mp + 2) / 5) + 1;
  const mes = mp + (mp < 10 ? 3 : -9);
  return marcarComoFechaCivil(aTextoDeFecha(mes <= 2 ? anio + 1 : anio, mes, dia));
}

/** `-1` si a es anterior, `0` si es la misma, `1` si es posterior. */
export function compararFechas(a: FechaCivil, b: FechaCivil): -1 | 0 | 1 {
  // `AAAA-MM-DD` ordena lexicográficamente igual que cronológicamente.
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function esAnterior(a: FechaCivil, b: FechaCivil): boolean {
  return compararFechas(a, b) === -1;
}

export function esPosterior(a: FechaCivil, b: FechaCivil): boolean {
  return compararFechas(a, b) === 1;
}

export function esLaMismaFecha(a: FechaCivil, b: FechaCivil): boolean {
  return compararFechas(a, b) === 0;
}

/**
 * Días civiles entre dos fechas: positivo si `hasta` es posterior a `desde`.
 * Cuenta días completos, sin horas y sin zona horaria.
 */
export function diasEntre(desde: FechaCivil, hasta: FechaCivil): number {
  return aDiaSerial(hasta) - aDiaSerial(desde);
}

/** Suma (o resta, con negativo) días civiles. */
export function sumarDias(fecha: FechaCivil, dias: number): Resultado<FechaCivil, ErrorMotor> {
  if (!Number.isInteger(dias)) return falla(errorDeEntrada('PLAZO_NO_ENTERO'));
  return enRango(desdeDiaSerial(aDiaSerial(fecha) + dias));
}

/**
 * Suma meses calendario. Si el día no existe en el mes destino, se toma el
 * último día de ese mes (31/01 + 1 mes = 28/02, o 29/02 en año bisiesto). Es
 * el criterio del art. 6 CCyC —el plazo de meses termina el día del mes
 * correspondiente y, si no lo hay, el último—; queda expuesto como supuesto
 * del cálculo y no como detalle oculto.
 */
export function sumarMeses(fecha: FechaCivil, meses: number): Resultado<FechaCivil, ErrorMotor> {
  if (!Number.isInteger(meses)) return falla(errorDeEntrada('PLAZO_NO_ENTERO'));
  const { anio, mes, dia } = partesDeFecha(fecha);
  const totalDeMeses = anio * 12 + (mes - 1) + meses;
  const anioDestino = Math.floor(totalDeMeses / 12);
  const mesDestino = totalDeMeses - anioDestino * 12 + 1;
  const diaDestino = Math.min(dia, diasDelMes(anioDestino, mesDestino));
  return enRango(marcarComoFechaCivil(aTextoDeFecha(anioDestino, mesDestino, diaDestino)));
}

/** Suma años calendario, con la misma regla de ajuste que `sumarMeses`. */
export function sumarAnios(fecha: FechaCivil, anios: number): Resultado<FechaCivil, ErrorMotor> {
  if (!Number.isInteger(anios)) return falla(errorDeEntrada('PLAZO_NO_ENTERO'));
  return sumarMeses(fecha, anios * 12);
}

function enRango(fecha: FechaCivil): Resultado<FechaCivil, ErrorMotor> {
  const { anio } = partesDeFecha(fecha);
  if (anio < ANIO_MINIMO || anio > ANIO_MAXIMO) {
    return falla(errorDeEntrada('FECHA_FUERA_DE_RANGO_ADMITIDO'));
  }
  return ok(fecha);
}

/**
 * Vigencia de un tramo a una fecha, sobre el intervalo **cerrado**
 * `[vigenciaDesde, vigenciaHasta]`; `vigenciaHasta: null` es "vigente sin
 * término conocido" (contrato, `TramoParametro`).
 *
 * Es la primitiva temporal sobre la que se apoya CA-29: quien resuelve un
 * parámetro le pasa la **fecha del hecho**, no la de evaluación. La resolución
 * completa del catálogo es la tarea T-04; acá vive sólo la aritmética.
 */
export function estaVigenteA(
  vigenciaDesde: FechaCivil,
  vigenciaHasta: FechaCivil | null,
  fecha: FechaCivil,
): boolean {
  if (esAnterior(fecha, vigenciaDesde)) return false;
  if (vigenciaHasta === null) return true;
  return !esPosterior(fecha, vigenciaHasta);
}
