/**
 * Tiempo civil del motor: fechas `AAAA-MM-DD`, aritmética de días civiles y
 * vigencias. El "ahora" nunca se lee acá: entra por parámetro (ADR-016, CA-31).
 */
export {
  ANIO_MAXIMO,
  ANIO_MINIMO,
  aDiaSerial,
  comoFechaCivil,
  comoFechaDeEvaluacion,
  comoFechaDelHecho,
  compararFechas,
  desdeDiaSerial,
  diasDelMes,
  diasEntre,
  esAnterior,
  esBisiesto,
  esLaMismaFecha,
  esPosterior,
  estaVigenteA,
  partesDeFecha,
  sumarAnios,
  sumarDias,
  sumarMeses,
} from './fecha-civil';

export type { PartesDeFecha } from './fecha-civil';
