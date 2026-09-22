/**
 * Exigencia de segundo factor por rol — contrato §8, **ADR-023**.
 * Criterios CA-32, CA-38, CA-39; regla R-08; condición C-002-08.
 *
 * **No es configuración: es una función.** No hay clave que apagar porque no
 * hay clave. Los cuatro cerrojos de ADR-023, y dónde vive cada uno:
 *
 * | # | Cerrojo | Dónde |
 * | --- | --- | --- |
 * | 1 | `ExigeSegundoFactor<'ADMINISTRADOR'>` es el literal `true` | contrato §8 + `TABLA_DE_EXIGENCIA` de este archivo |
 * | 2 | No existe ninguna clave de configuración de MFA por rol | esquema de arranque de `apps/api` (`dev-backend`/`cicd`) |
 * | 3 | `mapaRolPermisos.ADMINISTRADOR` no tiene `'mfa.desactivar.propio'` | `permisos.ts` |
 * | 4 | Sin MFA activo, un rol profesional sólo puede inscribirlo | `derivarPermisos` en `permisos.ts` |
 *
 * A los cuatro se les agregó un quinto en `permisos.ts`
 * (`PERMISOS_NO_CONCEDIBLES_POR_AJUSTE`), porque el contrato admite ajustes
 * individuales de permiso y sin él el cerrojo 3 se podía sortear concediendo
 * el permiso a mano.
 *
 * Tres de los cinco viven en este paquete y tienen test propio. El cerrojo 2
 * pertenece al esquema de configuración de `apps/api` y su test es de
 * `dev-backend`: acá queda declarado para que nadie lo dé por cubierto.
 */

import type { ExigeSegundoFactor, ParametrosTotp, Rol } from './contrato/v1';

/**
 * Cerrojo 1, hecho dato. El tipo del mapa es
 * `{ [R in Rol]: ExigeSegundoFactor<R> }`, así que poner `false` en
 * `ADMINISTRADOR` o en `ABOGADO` **no compila**: el tipo de esa entrada es el
 * literal `true`, no `boolean`. No hace falta acordarse de nada, ni revisar
 * este archivo en cada cambio; lo revisa el compilador.
 */
export const TABLA_DE_EXIGENCIA: { readonly [R in Rol]: ExigeSegundoFactor<R> } = {
  CLIENTE: false,
  ABOGADO: true,
  ADMINISTRADOR: true,
};

/**
 * ¿Este rol exige segundo factor? Implementa la firma declarada en el
 * contrato §8.
 *
 * La conversión explícita es necesaria porque TypeScript no resuelve un tipo
 * condicional sobre un parámetro genérico todavía sin instanciar: el valor que
 * se devuelve **es** el de la tabla, y la tabla ya está restringida por el
 * mismo tipo condicional, así que la conversión no agrega ninguna libertad —
 * sólo le dice al compilador lo que la tabla ya garantiza.
 */
export function exigeSegundoFactor<R extends Rol>(rol: R): ExigeSegundoFactor<R> {
  return TABLA_DE_EXIGENCIA[rol] as ExigeSegundoFactor<R>;
}

/**
 * Parámetros de TOTP (ADR-023 §1). Todos son literales en el contrato: los
 * valores están elegidos para que funcionen en cualquier aplicación
 * autenticadora ya instalada, incluidas las de teléfonos de gama baja
 * (constitución #13). Subir a SHA-256 o a 8 dígitos rompe compatibilidad con
 * parte del parque y no compra seguridad medible.
 *
 * La tolerancia de ±1 paso **no se amplía**: ampliarla alarga la vida útil de
 * un código robado. El error de "código incorrecto" apunta a la hora del
 * teléfono, que es la causa real en la enorme mayoría de los casos.
 */
export const PARAMETROS_TOTP: ParametrosTotp = {
  algoritmo: 'SHA1',
  digitos: 6,
  pasoEnSegundos: 30,
  ventanaDePasos: 1,
  longitudDelSecretoEnBytes: 20,
};

/** Cantidad de códigos de respaldo que se entregan de una vez (ADR-023 §2). */
export const CANTIDAD_DE_CODIGOS_DE_RESPALDO = 10;

/** Con esta cantidad de códigos restantes o menos, se avisa (ADR-023 §2). */
export const CODIGOS_DE_RESPALDO_PARA_AVISAR = 2;
