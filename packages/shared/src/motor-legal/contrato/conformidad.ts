/**
 * Conformidad de las implementaciones con el contrato — ADR-017 punto 5.
 *
 * El contrato declara firmas; este archivo verifica, **en tiempo de
 * compilación**, que cada implementación tiene exactamente la firma declarada.
 * Si alguien cambia una firma en el paquete, `pnpm --filter @mejorar/shared
 * build` falla acá y no en el consumidor.
 *
 * No emite código: son alias de tipos sobre importaciones de tipo. Las
 * funciones del contrato todavía no implementadas (`evaluar`, `crearIdOpaco`,
 * `resolverParametro`, …) se irán agregando a esta lista en sus tareas.
 */

import type * as Contrato from './v1';
import type { redondear } from '../dinero/redondeo';
import type {
  comoFechaCivil,
  comoFechaDeEvaluacion,
  comoFechaDelHecho,
} from '../tiempo/fecha-civil';

type Identicos<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Afirmar<T extends true> = T;

export type ConformidadRedondear = Afirmar<Identicos<typeof redondear, typeof Contrato.redondear>>;
export type ConformidadComoFechaCivil = Afirmar<
  Identicos<typeof comoFechaCivil, typeof Contrato.comoFechaCivil>
>;
export type ConformidadComoFechaDelHecho = Afirmar<
  Identicos<typeof comoFechaDelHecho, typeof Contrato.comoFechaDelHecho>
>;
export type ConformidadComoFechaDeEvaluacion = Afirmar<
  Identicos<typeof comoFechaDeEvaluacion, typeof Contrato.comoFechaDeEvaluacion>
>;
