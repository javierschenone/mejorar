/**
 * Dinero exacto del motor: centavos enteros, racionales y redondeo por rol.
 * ADR-011, CA-32.
 */
export {
  CERO,
  UNO,
  comparar,
  dividir,
  esCero,
  esNegativo,
  multiplicar,
  negar,
  porcentaje,
  racional,
  racionalDesdeEntero,
  restar,
  sonIguales,
  sumar,
} from './racional';

export {
  centavosATexto,
  compararMontos,
  crearCentavos,
  crearCentavosDesdeTexto,
  crearMonto,
  esCeroElMonto,
  esNegativoElMonto,
  montoARacional,
  montoCero,
  restarMontos,
  sumarMontos,
} from './centavos';

export { UNIDAD_CENTAVO, redondear, redondeoEsConsistente, sentidoDeRedondeo } from './redondeo';
