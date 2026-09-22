/**
 * Conformidad de las implementaciones con el contrato — ADR-017 punto 5,
 * aplicado a la feature 002 por `plan.md` §2 y por la obligación F-11.
 *
 * El contrato declara firmas; este archivo verifica, **en tiempo de
 * compilación**, que cada implementación tiene exactamente la firma declarada.
 * Si alguien cambia una firma en el paquete, `pnpm --filter @mejorar/shared
 * build` falla acá y no en el consumidor, que es mucho más tarde y mucho más
 * caro.
 *
 * No emite código: son alias de tipos sobre importaciones de tipo. Las
 * funciones del contrato que esta tarea no implementa —`autorizar`,
 * `autorizarColeccion`, `validarRegistroDeRecursos`, `exportarDatosPropios`—
 * son del borde o de tareas posteriores y se agregan a esta lista cuando
 * existan.
 */

import type * as Contrato from './v1';
import type { decidirAcceso } from '../autorizacion';
import type { decidirBloqueo } from '../bloqueo';
import type { evaluarPoliticaDeContrasena, normalizarContrasena } from '../contrasenas';
import type { verificarDigitoVerificadorCuit } from '../cuit';
import type { crearIdOpaco } from '../identificadores';
import type { claveDeExhibicionDeMatricula, derivarEstadoMatricula } from '../matricula';
import type { derivarPermisos, mapaRolPermisos, permisosDeCuentaNoOperativa } from '../permisos';
import type { exigeSegundoFactor } from '../segundo-factor';

type Identicos<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Afirmar<T extends true> = T;

export type ConformidadCrearIdOpaco = Afirmar<
  Identicos<typeof crearIdOpaco, typeof Contrato.crearIdOpaco>
>;
export type ConformidadMapaRolPermisos = Afirmar<
  Identicos<typeof mapaRolPermisos, typeof Contrato.mapaRolPermisos>
>;
export type ConformidadDerivarPermisos = Afirmar<
  Identicos<typeof derivarPermisos, typeof Contrato.derivarPermisos>
>;
export type ConformidadPermisosDeCuentaNoOperativa = Afirmar<
  Identicos<typeof permisosDeCuentaNoOperativa, typeof Contrato.permisosDeCuentaNoOperativa>
>;
export type ConformidadDecidirAcceso = Afirmar<
  Identicos<typeof decidirAcceso, typeof Contrato.decidirAcceso>
>;
export type ConformidadDerivarEstadoMatricula = Afirmar<
  Identicos<typeof derivarEstadoMatricula, typeof Contrato.derivarEstadoMatricula>
>;
export type ConformidadClaveDeExhibicionDeMatricula = Afirmar<
  Identicos<typeof claveDeExhibicionDeMatricula, typeof Contrato.claveDeExhibicionDeMatricula>
>;
export type ConformidadEvaluarPoliticaDeContrasena = Afirmar<
  Identicos<typeof evaluarPoliticaDeContrasena, typeof Contrato.evaluarPoliticaDeContrasena>
>;
export type ConformidadNormalizarContrasena = Afirmar<
  Identicos<typeof normalizarContrasena, typeof Contrato.normalizarContrasena>
>;
export type ConformidadDecidirBloqueo = Afirmar<
  Identicos<typeof decidirBloqueo, typeof Contrato.decidirBloqueo>
>;
export type ConformidadExigeSegundoFactor = Afirmar<
  Identicos<typeof exigeSegundoFactor, typeof Contrato.exigeSegundoFactor>
>;
export type ConformidadVerificarDigitoVerificadorCuit = Afirmar<
  Identicos<typeof verificarDigitoVerificadorCuit, typeof Contrato.verificarDigitoVerificadorCuit>
>;
