/**
 * Superficie del contrato `identidad-y-acceso/v1` que usa esta frontera.
 *
 * ── Por qué esto no es otra copia del contrato ─────────────────────────────
 * ADR-017 manda que el contrato sea **un solo archivo**, copiado
 * mecánicamente a `packages/shared` y verificado byte a byte en el pipeline.
 * Copiarlo **otra vez** acá sería peor que redundante: el contrato construye
 * sus marcas nominales sobre `unique symbol` (`Instante`, `IdOpaco<…>`), y dos
 * copias en dos paquetes producen dos símbolos distintos, o sea dos tipos
 * mutuamente inasignables. El `Instante` del dominio no encajaría en el
 * `Instante` de las integraciones y `apps/api`, que usa los dos, no podría
 * cablearlos sin castear. Un `as` en esa costura anularía justamente la
 * garantía que las marcas nominales existen para dar.
 *
 * Así que hay una sola copia, la de `@mejorar/shared` (T-01), y este archivo
 * la reexporta. `@mejorar/shared` publica el dominio de identidad bajo el
 * espacio de nombres `identidad` —sus dos contratos declaran a propósito tipos
 * homónimos y distintos—, y la lista de abajo es, además de un alias, la
 * declaración explícita de **qué parte del contrato toca la frontera**: los
 * cinco puertos y los tipos que viajan por ellos. Nada más.
 */

import type { identidad } from '@mejorar/shared';

/* ── Base: tiempo, resultado y error ──────────────────────────────────── */
export type Instante = identidad.Instante;
export type Resultado<TValor, TError> = identidad.Resultado<TValor, TError>;
export type ErrorIdentidad = identidad.ErrorIdentidad;
export type ClaseErrorIdentidad = identidad.ClaseErrorIdentidad;
export type DatoDeEvento = identidad.DatoDeEvento;

/* ── §13.1 Correo transaccional ───────────────────────────────────────── */
export type PuertoCorreoTransaccional = identidad.PuertoCorreoTransaccional;
export type MensajeTransaccional = identidad.MensajeTransaccional;
export type ConstanciaDeEnvio = identidad.ConstanciaDeEnvio;
export type ClavePlantillaCorreo = identidad.ClavePlantillaCorreo;
export type AccionDeCorreo = identidad.AccionDeCorreo;

/* ── §13.2 Ubicación aproximada por IP ────────────────────────────────── */
export type PuertoUbicacionPorIp = identidad.PuertoUbicacionPorIp;
export type UbicacionAproximada = identidad.UbicacionAproximada;
export type DireccionIp = identidad.DireccionIp;

/* ── §13.3 Descripción de dispositivo ─────────────────────────────────── */
export type PuertoDescripcionDeDispositivo = identidad.PuertoDescripcionDeDispositivo;
export type DescripcionDeDispositivo = identidad.DescripcionDeDispositivo;

/* ── §13.4 Reloj ──────────────────────────────────────────────────────── */
export type PuertoReloj = identidad.PuertoReloj;

/* ── §6 Lista local de contraseñas filtradas (la consume el dominio) ──── */
export type PuertoListaDeContrasenasFiltradas = identidad.PuertoListaDeContrasenasFiltradas;
export type PoliticaDeContrasena = identidad.PoliticaDeContrasena;
export type IncumplimientoDePolitica = identidad.IncumplimientoDePolitica;

/* ── §7 Sesión: lo que la frontera ayuda a construir ──────────────────── */
export type SesionVisible = identidad.SesionVisible;
