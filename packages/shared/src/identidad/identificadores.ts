/**
 * Identificadores opacos — contrato §1, obligación de frontera F-01,
 * defecto D-002-11, constitución #5 (minimización).
 *
 * Un identificador de este sistema **no dice nada de la persona**. No es el
 * DNI, no es el CUIL, no es el correo, no es un número correlativo que permita
 * contar cuántos usuarios hay ni enumerarlos. La forma elegida por F-01 es
 * ULID: 26 caracteres en base 32 de Crockford, ordenable por tiempo de
 * creación y con 80 bits de aleatoriedad.
 *
 * Este módulo **no genera** identificadores: generar exige azar, que es un
 * efecto, y el dominio es puro (ADR-016). Acá se **valida** la forma, que es
 * la guarda que hace falta en el borde HTTP, donde los tipos ya no existen y
 * alguien puede mandar un CUIL en el lugar de un identificador.
 */

import type { ErrorIdentidad, IdOpaco, IdSesion, IdUsuario, Resultado } from './contrato/v1';
import { errorDeEntrada, falla, ok } from './errores';

/** Longitud máxima admitida. Cota contra abuso, no contra ningún formato real. */
export const LONGITUD_MAXIMA_DE_ID = 64;

/** Caracteres admitidos en un identificador opaco: base 32, guion y guion bajo. */
const CARACTERES_ADMITIDOS = /^[A-Za-z0-9_-]+$/;

/**
 * DNI argentino: 7 u 8 dígitos exactos, y nada más.
 *
 * Las guardas de forma se anclan al valor **completo**, no a una subcadena.
 * Buscar "siete dígitos seguidos en cualquier parte" parece más estricto y es
 * un defecto: aproximadamente uno de cada doscientos ULID contiene una corrida
 * de siete dígitos por puro azar, y el alta de esa persona fallaría sin
 * explicación posible. Lo que la guarda tiene que impedir es que **el valor
 * sea** un dato identificatorio, que es lo que dice el contrato.
 */
const FORMA_DE_DOCUMENTO = /^\d{7,8}$/;

/** CUIT/CUIL: 11 dígitos corridos, con o sin guiones. */
const FORMA_DE_CUIT_CUIL = /^(?:\d{11}|\d{2}-\d{8}-\d)$/;

/** Cualquier valor puramente numérico: huele a identificador correlativo. */
const SOLO_NUMEROS = /^\d+$/;

/**
 * ULID canónico: 26 caracteres del alfabeto de Crockford (sin `I`, `L`, `O` ni
 * `U`, para que no se confundan al dictarlos), el primero acotado a `0`-`7`
 * porque la marca de tiempo no puede desbordar 48 bits.
 */
const FORMA_DE_ULID = /^[0-7][0-9ABCDEFGHJKMNPQRSTVWXYZ]{25}$/;

/**
 * Construye un identificador opaco validando que el valor **no** tenga forma
 * de dato identificatorio. Implementa la firma declarada en el contrato §1.
 *
 * El orden de las guardas es el orden en que se quiere ver el error: primero
 * lo que está vacío, después lo que delata un dato personal, y al final la
 * forma general. Se devuelve **un solo** motivo, el primero que corresponda.
 *
 * `entidad` no participa de la validación: es el argumento que fija la marca
 * nominal del tipo devuelto, de modo que un `IdSesion` no pueda pasar donde se
 * espera un `IdUsuario`.
 */
export function crearIdOpaco<TEntidad extends string>(
  entidad: TEntidad,
  valor: string,
): Resultado<IdOpaco<TEntidad>, ErrorIdentidad> {
  if (valor.length === 0) return falla(errorDeEntrada('ID_VACIO', entidad));
  if (/\s/.test(valor)) return falla(errorDeEntrada('ID_CON_ESPACIOS', entidad));
  if (valor.includes('@')) return falla(errorDeEntrada('ID_CON_FORMA_DE_CORREO', entidad));
  if (FORMA_DE_CUIT_CUIL.test(valor)) return falla(errorDeEntrada('ID_CON_FORMA_DE_CUIT_CUIL', entidad));
  if (FORMA_DE_DOCUMENTO.test(valor)) return falla(errorDeEntrada('ID_CON_FORMA_DE_DOCUMENTO', entidad));
  if (SOLO_NUMEROS.test(valor)) return falla(errorDeEntrada('ID_SOLO_NUMEROS', entidad));
  if (valor.length > LONGITUD_MAXIMA_DE_ID) return falla(errorDeEntrada('ID_DEMASIADO_LARGO', entidad));
  if (!CARACTERES_ADMITIDOS.test(valor)) {
    return falla(errorDeEntrada('ID_CON_CARACTERES_NO_ADMITIDOS', entidad));
  }
  // Única conversión a la marca nominal del contrato, que usa un `unique
  // symbol` no exportado. Encerrada acá a propósito.
  return ok(valor as IdOpaco<TEntidad>);
}

/** ¿El valor tiene la forma canónica de un ULID? (F-01) */
export function esUlidCanonico(valor: string): boolean {
  return FORMA_DE_ULID.test(valor);
}

/**
 * Construye un identificador opaco **exigiendo forma de ULID**. Es la puerta
 * para las entidades que F-01 obliga a identificar con ULID: usuario y sesión.
 */
export function crearIdOpacoUlid<TEntidad extends string>(
  entidad: TEntidad,
  valor: string,
): Resultado<IdOpaco<TEntidad>, ErrorIdentidad> {
  const base = crearIdOpaco(entidad, valor);
  if (!base.ok) return base;
  if (!esUlidCanonico(valor)) return falla(errorDeEntrada('ID_NO_ES_ULID', entidad));
  return base;
}

/** Identificador opaco de una cuenta (F-01: ULID, nunca derivado de la persona). */
export function crearIdUsuario(valor: string): Resultado<IdUsuario, ErrorIdentidad> {
  return crearIdOpacoUlid('usuario', valor);
}

/** Identificador opaco de una sesión (F-04). */
export function crearIdSesion(valor: string): Resultado<IdSesion, ErrorIdentidad> {
  return crearIdOpacoUlid('sesion', valor);
}
