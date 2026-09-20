# ADR-017 — El contrato es un artefacto único, copiado al paquete y verificado en integración continua

| Campo | Valor |
| --- | --- |
| Estado | PROPUESTO |
| Fecha | 2026-09-20 |
| Autor | arquitecto |
| Aprobado por | pendiente — G2, feature 004 |
| Spec de origen | `specs/004-motor-reglas-legales/spec.md` v3 (CA-27, CA-30) y `CLAUDE.md` §1 |
| Contrato | `specs/contratos/motor-reglas-legales.ts`, regla de lectura 1 |

## Contexto

`CLAUDE.md` es explícito: la especificación es la fuente de verdad y el código
es su consecuencia. *"Si el código y la spec discrepan, se corrige uno de los
dos de forma explícita y se deja registro — nunca se arregla en silencio."*

Con los contratos eso tiene un problema práctico. El contrato de este motor vive
en `specs/contratos/motor-reglas-legales.ts` porque es donde el arquitecto puede
escribir y donde el humano lo aprueba en G2. Pero el código que lo implementa
vive en `packages/shared`, y `packages/shared` no puede importar desde
`specs/`: sería una dependencia de un paquete publicable hacia un directorio de
documentación, fuera del `tsconfig` del paquete y fuera de su `dist/`.

Sin una decisión, pasa lo de siempre: alguien copia los tipos a mano, y a los
dos meses el contrato aprobado y el que se ejecuta son documentos distintos.
Nadie miente; simplemente derivaron.

## Decisión

**Un solo archivo fuente, copiado mecánicamente, con verificación de identidad
byte a byte en el pipeline.**

1. `specs/contratos/motor-reglas-legales.ts` es la **fuente normativa**. Es lo
   que el humano aprueba en G2 y sólo lo modifica el `arquitecto`.
2. `packages/shared/src/motor-legal/contrato/v1.ts` es una **copia exacta**. La
   escribe `dev-dominio` copiando, no transcribiendo, y la mantiene idéntica.
3. El pipeline de integración continua ejecuta una verificación de identidad
   (comparación de hash del contenido). **Si difieren, falla la construcción**
   con un mensaje que nombra los dos archivos y dice cuál manda. Lo implementa
   `cicd` (tarea del plan §7).
4. El archivo contiene **sólo declaraciones**: `type`, `interface`,
   `declare function`. No compila a ningún JavaScript emitido. Que sea copiable
   sin consecuencias depende de esa propiedad, y por eso la regla de lectura 1
   del contrato y el límite duro del mandato del arquitecto son la misma cosa
   vista desde dos lados.
5. Las implementaciones del motor **importan desde el contrato copiado** y
   nunca redeclaran un tipo que el contrato ya define.
6. **Versionado por archivo, no por rama de git.** El día que exista
   `motor-reglas-legales/v2`, será `specs/contratos/motor-reglas-legales-v2.ts`
   y `contrato/v2.ts`, conviviendo con v1 mientras haya consumidores. El
   `VersionContrato` viaja en la entrada y en la salida, así que un resultado
   guardado siempre dice con qué contrato se produjo.

## Alternativas consideradas

| Alternativa | A favor | En contra | Por qué no |
| --- | --- | --- | --- |
| `packages/shared` importa directamente desde `specs/` | Un solo archivo, cero duplicación | Dependencia de un paquete publicable hacia documentación; queda fuera de `dist/`, del `tsconfig` del paquete y de `files`; rompe ADR-003 | El paquete publicado no puede depender de la carpeta de specs |
| Mover el contrato a `packages/shared` y que `specs/` lo referencie | Sin duplicación, sin verificación | El `arquitecto` no puede escribir en `packages/**` (roster de `CLAUDE.md`), y el humano aprobaría en G2 algo que vive en el árbol de código | Rompe la separación de roles, que es lo que hace auditable el resultado (constitución #4) |
| Paquete propio `@mejorar/contratos` | Límite limpio, versionable con semver | Un paquete más en el workspace para tres archivos de tipos; el arquitecto tampoco podría escribirlo | Ceremonia sin beneficio en esta escala. Se reconsidera si los contratos pasan de una docena |
| Generar los tipos desde un esquema neutral (OpenAPI, JSON Schema) | Una fuente, varios lenguajes | El contrato usa marcas nominales, uniones discriminadas, genéricos condicionales (`Minimizada<E>`) y `bigint`: nada de eso sobrevive a una generación desde JSON Schema | El contrato **es** TypeScript y su valor está justamente en lo que el sistema de tipos garantiza |
| Copia a mano, sin verificación, con revisión en el PR | Cero herramienta | Depende de que alguien compare 1500 líneas. No va a pasar | Es el escenario que este ADR existe para evitar |
| Enlace simbólico | Un solo archivo real | No funciona bien en Windows ni en todos los empaquetadores; git lo trata de forma distinta según configuración | Frágil de una manera silenciosa |

## Consecuencias

**Positivas**

- Lo que el humano aprueba en G2 es, byte a byte, lo que se compila.
- Un cambio de contrato hecho en `packages/` sin pasar por el arquitecto rompe
  la construcción y queda visible. La disciplina de roles se aplica sola.
- El contrato se puede leer completo en `specs/` sin abrir el árbol de código,
  que es lo que necesita quien revisa en la compuerta.

**Negativas**

- Hay un archivo duplicado en el repositorio. Es la molestia deliberada que
  compra la verificación; el pipeline la vuelve inofensiva.
- Todo cambio de contrato es dos ediciones: la del arquitecto y la copia de
  `dev-dominio`. Las dos, en el mismo PR.
- La verificación es un paso más de CI. Es un `sha256sum` de dos archivos:
  costo despreciable.

**Qué cierra**

- Redeclarar en `packages/**` un tipo que el contrato ya define.
- Modificar el contrato desde un agente que no sea el `arquitecto`.

## Cómo se revierte

- **Pasar a un paquete `@mejorar/contratos`**: costo bajo (medio día) y se hace
  sin tocar el contenido. Sería el paso natural cuando haya varios contratos
  cruzando varios paquetes, pero requiere resolver antes quién puede escribir en
  ese paquete: probablemente un ADR de reemplazo y una modificación del roster
  en `CLAUDE.md`, que es decisión humana.
- **Quitar la verificación de CI**: trivial y desaconsejado. Sin ella la copia
  deriva y el contrato aprobado deja de significar nada.
