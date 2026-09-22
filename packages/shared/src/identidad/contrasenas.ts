/**
 * Política de contraseñas — contrato §6, **ADR-024**. Criterio CA-03, regla R-02.
 *
 * Sólo la parte pura: **no se hashea acá**. `argon2id` y la pimienta son del
 * borde (`ServicioDeContrasenas`, `apps/api`), porque necesitan criptografía y
 * una clave que vive fuera de la base. Lo que vive acá es la política, que es
 * una regla y tiene que poder leerse y probarse sin levantar nada.
 *
 * Siguiendo NIST SP 800-63B, **no hay reglas de composición**: ni mayúsculas,
 * ni números, ni símbolos obligatorios. Producen `Contraseña1!` y contraseñas
 * peores, no mejores. Hay cuatro reglas: largo mínimo, largo máximo, no estar
 * en la lista de filtradas y no contener datos de la propia cuenta.
 *
 * Se permiten espacios y emoji, y **no se trunca nunca**: truncar en silencio
 * es la forma más elegante de dejar afuera a alguien sin que se entere.
 */

import type {
  IncumplimientoDePolitica,
  PoliticaDeContrasena,
  Resultado,
} from './contrato/v1';
import { PARAMETROS_DE_IDENTIDAD } from './parametros';

/**
 * Normalización previa obligatoria (Unicode NFKC) antes de hashear o comparar.
 * Implementa la firma declarada en el contrato §6.
 *
 * Tiene que aplicarse **igual en el alta y en el ingreso**. Si no, la misma
 * contraseña con acentos tipeada desde otro teclado produce otra secuencia de
 * puntos de código y la persona queda afuera de su propia cuenta sin entender
 * por qué. No recorta espacios: un espacio al final es parte de la contraseña
 * que la persona eligió.
 */
export function normalizarContrasena(contrasena: string): string {
  return contrasena.normalize('NFKC');
}

/** Longitud en puntos de código, no en unidades UTF-16: un emoji cuenta uno. */
function longitudReal(texto: string): number {
  return [...texto].length;
}

/**
 * Trozos de los datos de la cuenta contra los que se compara. De una dirección
 * de correo salen además la parte local, el dominio y el nombre del dominio
 * sin su sufijo, porque `juanperez` y `juanperez@correo.com` son el mismo dato
 * a los fines de adivinar la contraseña.
 */
function fragmentosDe(datos: readonly string[], longitudMinima: number): readonly string[] {
  const fragmentos = new Set<string>();
  for (const dato of datos) {
    const normalizado = normalizarContrasena(dato).toLowerCase().trim();
    if (normalizado.length === 0) continue;
    fragmentos.add(normalizado);
    for (const trozo of normalizado.split(/[\s@._+-]+/)) {
      if (trozo.length >= longitudMinima) fragmentos.add(trozo);
    }
  }
  return [...fragmentos].filter((fragmento) => fragmento.length >= longitudMinima);
}

/**
 * Evalúa la política. Implementa la firma declarada en el contrato §6.
 *
 * CA-03: devuelve **el incumplimiento concreto, uno solo**, el primero que
 * corresponda — no la política entera como si fuera un desafío a resolver.
 * Decirle a alguien "faltan mayúsculas, símbolos y 4 caracteres" es regalarle
 * a quien mira por encima del hombro la forma exacta de la contraseña.
 *
 * Es pura: la pertenencia a la lista de filtradas entra como dato, porque
 * consultarla es E/S y además, por ADR-024 §4, esa consulta es **local** y
 * nunca contra la API de un tercero (sería una cesión de datos, arts. 12 y 25
 * de la Ley 25.326).
 *
 * El orden de las comprobaciones: primero lo que ni siquiera es una
 * contraseña (sólo espacios), después el largo, después las dos listas. Una
 * contraseña de veinte espacios cumpliría el largo mínimo, así que la
 * comprobación de espacios va antes.
 */
export function evaluarPoliticaDeContrasena(
  contrasena: string,
  datosDeLaCuenta: readonly string[],
  estaEnListaDeFiltradas: boolean,
  politica: PoliticaDeContrasena,
): Resultado<void, IncumplimientoDePolitica> {
  const normalizada = normalizarContrasena(contrasena);

  if (normalizada.trim().length === 0) return incumple('SOLO_ESPACIOS');

  const largo = longitudReal(normalizada);
  if (largo < politica.longitudMinima) return incumple('DEMASIADO_CORTA');
  if (largo > politica.longitudMaxima) return incumple('DEMASIADO_LARGA');

  if (politica.rechazaContrasenasFiltradas && estaEnListaDeFiltradas) {
    return incumple('ESTA_EN_LISTA_DE_FILTRADAS');
  }

  if (politica.rechazaDatosDelUsuario) {
    const enMinusculas = normalizada.toLowerCase();
    const longitudMinimaDeFragmento =
      PARAMETROS_DE_IDENTIDAD['contrasena.longitudMinimaDeTokenDeCuenta'].valor;
    for (const fragmento of fragmentosDe(datosDeLaCuenta, longitudMinimaDeFragmento)) {
      if (enMinusculas.includes(fragmento)) return incumple('CONTIENE_DATOS_DE_LA_CUENTA');
    }
  }

  return { ok: true, valor: undefined };
}

function incumple(motivo: IncumplimientoDePolitica): Resultado<void, IncumplimientoDePolitica> {
  return { ok: false, error: motivo };
}

/**
 * Mensajes de cada incumplimiento, en castellano rioplatense y en lenguaje
 * llano (constitución #13). Dicen qué corregir sin enumerar la política
 * completa. El catálogo definitivo de microcopy es de `ux-expert`; esto es el
 * piso para que ninguna respuesta salga sin texto.
 */
export const MENSAJES_DE_POLITICA: Readonly<Record<IncumplimientoDePolitica, string>> = {
  DEMASIADO_CORTA: 'La contraseña es corta. Usá al menos 12 caracteres: una frase que recuerdes sirve.',
  DEMASIADO_LARGA: 'La contraseña es demasiado larga. El máximo es 128 caracteres.',
  ESTA_EN_LISTA_DE_FILTRADAS:
    'Esa contraseña ya apareció en filtraciones conocidas. Elegí otra, aunque sea parecida a la que pensaste.',
  CONTIENE_DATOS_DE_LA_CUENTA: 'La contraseña no puede contener tu correo ni tu nombre.',
  SOLO_ESPACIOS: 'La contraseña no puede ser sólo espacios.',
};
