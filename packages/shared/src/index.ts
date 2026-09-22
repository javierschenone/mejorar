/**
 * `@mejorar/shared` — dominio puro de la plataforma.
 *
 * La superficie pública del paquete se declara acá, explícita: nada se filtra
 * por accidente. Sin framework, sin ORM, sin HTTP, sin `process.env`, sin
 * reloj (ADR-003 §4, ADR-016).
 *
 * El paquete contiene dos dominios:
 *
 * - `./motor-legal` — motor de reglas legales argentinas (feature 004). Se
 *   reexporta plano, como estaba.
 * - `./identidad` — identidad y acceso (feature 002). Se reexporta **bajo un
 *   espacio de nombres**, no plano, y no por gusto: los dos contratos
 *   declaran a propósito tipos homónimos y distintos (`Resultado`,
 *   `FechaCivil`, `Jurisdiccion`, `IdOpaco`, `crearIdOpaco`…). El contrato de
 *   identidad lo dice en su §1: `IdUsuario` y el `IdPersona` del motor son
 *   entidades distintas y **no deben compartir la marca nominal**. Aplanar los
 *   dos dominios en un solo espacio de nombres los haría colisionar, y la
 *   salida fácil —renombrar uno— borraría justamente la distinción que la
 *   obligación de frontera F-12 quiere conservar.
 *
 *   Se usa así: `import { identidad } from '@mejorar/shared'` y después
 *   `identidad.derivarPermisos(...)`, `identidad.Rol`.
 */
export * from './motor-legal';
export * as identidad from './identidad';
