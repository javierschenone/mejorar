/**
 * Puerto de lista de contraseñas filtradas (§6 del contrato, ADR-024 punto 4).
 *
 * Lo consume `evaluarPoliticaDeContrasena` del dominio, que es pura: la
 * pertenencia a la lista **entra como dato**, no la consulta ella. Este puerto
 * es el que produce ese dato.
 *
 * **Consulta local, siempre.** Está prohibido consultar la API de un tercero,
 * aun con k-anonimato: enviar el prefijo del hash de la contraseña de un
 * titular es una cesión que necesitaría base legal y encargado de tratamiento
 * (arts. 12 y 25 de la Ley 25.326), y pone una dependencia externa en el
 * camino crítico del alta. Por eso este directorio no tiene `http.ts`.
 *
 * Y lo que no hace falta decir pero se dice igual: la contraseña que entra acá
 * no se registra, no se cachea en claro y no aparece en ningún mensaje de
 * error.
 */

import { createHash } from 'node:crypto';

import type { PuertoListaDeContrasenasFiltradas } from '../contrato';

export type { PuertoListaDeContrasenasFiltradas };

/**
 * Normalización previa. El contrato recibe la contraseña ya normalizada por
 * `normalizarContrasena` del dominio (NFKC); se repite acá porque es idempotente
 * y porque un adaptador no debería depender de que quien lo llama se acuerde.
 *
 * El plegado a minúsculas **no** se hace: "Password" y "password" son
 * contraseñas distintas y las listas publicadas las traen por separado.
 */
export function normalizarParaBusqueda(contrasena: string): string {
  return contrasena.normalize('NFKC');
}

/** SHA-1 en mayúsculas, que es el formato en el que se publican las listas. */
export function huellaSha1(contrasena: string): string {
  return createHash('sha1').update(normalizarParaBusqueda(contrasena), 'utf8').digest('hex').toUpperCase();
}
