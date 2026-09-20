# ADR-009 — Aplicación mecánica de los límites de importación y de escritura por agente

| Campo | Valor |
| --- | --- |
| Estado | PROPUESTO |
| Fecha | 2026-09-20 |
| Autor | arquitecto |
| Aprobado por | pendiente — G2, feature 001 |
| Spec de origen | `specs/001-fundaciones/spec.md` (CA-07, R-04) |

## Contexto

CA-07 es explícito: si alguien intenta importar código de un paquete fuera de su
alcance declarado, **la configuración de TypeScript o de dependencias lo
impide**. R-04 lo fundamenta en la constitución #4: *la separación de roles debe
ser mecánica, no voluntaria*.

Hay dos límites distintos y conviene no confundirlos, porque se aplican con
herramientas distintas:

- **Límite de importación** (el que pide CA-07): qué le está permitido a un
  *paquete* depender. Es una propiedad del código y se verifica sin saber quién
  lo escribió.
- **Límite de escritura** (la columna "Escribe" de `CLAUDE.md` §3): qué archivos
  le está permitido tocar a un *agente*. Es una propiedad del autor del cambio.

El primero es el que sostiene la arquitectura: si `apps/web` no puede importar
`@prisma/client`, da igual quién escriba el archivo. El segundo es el que
sostiene la trazabilidad del proceso de SDD. Los dos hacen falta; el primero es
el que tiene que ser infalible.

Restricción de honestidad que atraviesa todo este ADR: **no existe un mecanismo
que impida a un proceso con permiso de escritura editar un archivo.** Cualquiera
que diga lo contrario está vendiendo algo. Lo que sí existe es un conjunto de
capas que hacen que la violación **no compile, no instale, no pase el pipeline y
no se pueda fusionar**. El objetivo realista no es prevenir el tecleo: es que
una violación nunca llegue a la rama principal y se detecte en segundos, no en
la revisión.

## Decisión

Se adopta una **defensa en cuatro capas**, cada una con un mecanismo distinto y
un momento de detección distinto. Ninguna capa se apoya en la disciplina de
quien escribe.

### Capa 0 — Resolución: lo no declarado no existe

Ya decidida en ADR-001 (enlazado aislado de pnpm) y ADR-003 (campo `exports` con
subrutas explícitas). Consecuencias que acá se hacen normativas:

1. Un paquete sólo puede importar lo que declara en **su propio**
   `package.json`. Con el enlazado aislado de pnpm, importar algo no declarado
   falla en la resolución, en el momento de ejecutar. No hay hoisting que
   salve.
2. Sólo son importables las subrutas declaradas en `exports`. Una importación
   profunda a un archivo interno de otro paquete no resuelve.
3. Queda prohibido `shamefully-hoist`, `public-hoist-pattern` amplio, y `link:`
   o `file:` apuntando a carpetas de otros paquetes.

**Momento de detección:** al ejecutar o al construir. **Quién lo garantiza:**
el gestor de paquetes, sin configuración adicional.

### Capa 1 — Tipos: el compilador conoce el grafo

Cada paquete tiene su `tsconfig.json` con `composite: true`, `rootDir: "src"`,
`include: ["src"]` y una lista **explícita** de `references` con los paquetes del
workspace de los que depende. De ahí salen tres garantías del compilador:

| Intento | Qué pasa |
| --- | --- |
| `import { x } from '../../packages/shared/src/x'` | Error `TS6059`: el archivo no está bajo `rootDir`. La importación relativa que se escapa del paquete es un error de tipos |
| Importar `@mejorar/integrations` desde un paquete que no lo lista en `references` | Error: el proyecto referido no está en el grafo; el `.d.ts` no se resuelve |
| Alias `paths` hacia el `src/` de otro paquete | Prohibido por ADR-003 y verificado por la capa 2; `paths` sólo se admite para rutas internas del propio paquete |

Además, `moduleResolution: "node16"` (corrección al andamiaje, `plan.md` §3) es
lo que hace que TypeScript **respete el campo `exports`**. Con el
`moduleResolution: "node"` que traía el andamiaje, `exports` se ignora y la
capa 0 quedaba sin correlato en el compilador: se veía el error recién al
ejecutar.

**Momento de detección:** en el editor, mientras se escribe. Es la capa más
valiosa por eso.

### Capa 2 — Reglas: la matriz de dependencias permitidas

ESLint con configuración plana en la raíz, y la regla **nativa**
`no-restricted-imports` con bloques `files` por paquete. Sin plugins de
límites de módulos: con cinco paquetes, la regla del núcleo alcanza, y cada
plugin evitado es una dependencia menos que justificar (ADR-001, "aburrido
gana").

La matriz que se codifica:

| Paquete | Puede importar | Nunca, y el pipeline lo impide |
| --- | --- | --- |
| `packages/shared` | `zod` y módulos internos propios | cualquier otro paquete del workspace, `node:*`, `@nestjs/*`, `@prisma/*`, `react*`, `next*`, `expo*`, clientes HTTP |
| `packages/integrations` | `@mejorar/shared`, `zod`, `node:*` acotado | `@nestjs/*`, `@prisma/*`, `react*`, `next*`, `expo*`, `apps/*` |
| `apps/api` | `@mejorar/shared`, `@mejorar/integrations`, `@nestjs/*`, `@prisma/client` | `react*`, `next*`, `expo*`, `apps/web/*`, `apps/mobile/*` |
| `apps/web` | `@mejorar/shared`, `react*`, `next*` | `@mejorar/integrations`, `@prisma/*`, `@nestjs/*`, `apps/api/*`, `expo*` |
| `apps/mobile` | `@mejorar/shared`, `react*`, `react-native*`, `expo*` | `@mejorar/integrations`, `@prisma/*`, `@nestjs/*`, `apps/api/*`, `next*` |

Tres aclaraciones que son parte de la decisión:

1. **`packages/shared` no importa `node:*`.** Ni `node:crypto`, ni `node:fs`, ni
   `Date.now()` implícito. El dominio tiene que poder ejecutarse idéntico en el
   navegador, en React Native y en Node. La fecha de referencia y las fuentes de
   aleatoriedad entran siempre como parámetro.
2. **La web y la app no importan la API porque no lo necesitan.** Los tipos del
   contrato HTTP —esquemas de Zod de petición y respuesta— viven en
   `@mejorar/shared` (ADR-004 punto 3). Por eso prohibir `apps/api/*` no le
   quita tipado a nadie: se lo da mejor.
3. La misma configuración prohíbe las importaciones relativas que salen del
   paquete (`../../`), duplicando la capa 1 con un mensaje de error en
   castellano que explica **por qué** está prohibido, no sólo que lo está.

Cada regla lleva su mensaje: *"`apps/web` no puede depender de
`@mejorar/integrations`: la web habla con la API por HTTP y con nada más
(ADR-005 punto 2)."* Un error que enseña la regla vale más que uno que la
recita.

**Momento de detección:** en el editor y en el paso de `lint` del pipeline.

### Capa 3 — Autoría: quién puede tocar qué archivo

Las tres capas anteriores cubren CA-07 por completo. Esta cubre R-04 y la
columna "Escribe" de `CLAUDE.md` §3, y se apoya en dos mecanismos:

1. **`CODEOWNERS`** en `.github/`, con una entrada por cada ruta de la tabla del
   roster, más protección de la rama principal exigiendo la aprobación del
   dueño. Limitación declarada: los agentes no son identidades de GitHub, así
   que en la práctica el dueño efectivo de todas las rutas es el product owner.
   Lo que aporta igual es que **ninguna ruta queda huérfana** y que el cambio
   fuera de alcance se hace visible en la revisión con el nombre de la ruta
   violada.
2. **Verificación de alcance en el pipeline.** Los mensajes de commit ya llevan
   el pie `Spec:` (`CLAUDE.md` §5); se agrega el pie **`Agente:`** con el nombre
   del agente del roster que produjo el cambio. Un paso del pipeline compara la
   lista de archivos modificados contra la tabla de alcances y falla nombrando
   el archivo y el agente esperado. La tabla vive en un único archivo
   declarativo en la raíz (`alcances.json`), cuya modificación requiere pasar
   por compuerta.

Un cambio sin pie `Agente:` no falla: se marca como "sin agente declarado" y
queda visible en la revisión. Endurecerlo a error es una decisión del product
owner, no mía, porque cambia el flujo de trabajo humano.

**Momento de detección:** en el pipeline y en la revisión del PR.

### Lo que NO se hace, y por qué

- **No se generan tres tablas desde una sola fuente.** La matriz de importación
  (capa 2) y la de escritura (capa 3) parecen la misma tabla y no lo son: una
  habla de paquetes, la otra de rutas de archivo, y un agente escribe en rutas
  que pertenecen a varios paquetes. Unificarlas sería una abstracción falsa que
  habría que deshacer a la primera excepción.
- **No se usa `eslint-plugin-boundaries` ni `eslint-plugin-import-x`.** Aportan
  expresividad que cinco paquetes no necesitan. Si la matriz llegara a más de
  diez paquetes o a capas dentro de un paquete, se reconsidera con un ADR
  nuevo; la migración desde `no-restricted-imports` es directa.
- **No se verifica la coherencia entre `CLAUDE.md` §3 y `alcances.json` de forma
  automática.** `CLAUDE.md` es el texto normativo para las personas;
  `alcances.json` es su versión para máquinas. Mantenerlos sincronizados es
  parte de pasar por compuerta, y una verificación automática exigiría parsear
  una tabla de Markdown, que es más frágil que el problema que resuelve.

## Alternativas consideradas

| Alternativa | A favor | En contra | Por qué no |
| --- | --- | --- | --- |
| **Nx con `@nx/enforce-module-boundaries`** | Resuelve exactamente este problema, con etiquetas por paquete y una regla madura | Obliga a adoptar todo Nx: ejecutores, caché, migraciones, configuración propia | Ya descartado en ADR-001. No se cede el control del build para obtener una regla de ESLint |
| **Sólo `CODEOWNERS` y revisión humana** | Cero configuración | Es disciplina con otro nombre; una importación prohibida llega a la rama y se descubre en la revisión, si alguien la ve | CA-07 pide que el sistema lo **impida**, no que lo señale |
| **Un repositorio por paquete** | Los límites de escritura son triviales | Ya descartado en ADR-001: imposibilita el cambio atómico que exige un dominio que cambia por ley | El remedio es peor |
| **Verificación propia del grafo de dependencias** (script que lee los `package.json` y falla) | Total control, sin dependencias | Duplica lo que ya garantizan pnpm y TypeScript, y hay que mantenerlo | La capa 0 y la capa 1 ya lo hacen, y gratis |
| **`dependency-cruiser`** | Herramienta específica, buenos reportes y visualización del grafo | Una dependencia y un lenguaje de reglas más, que se superpone con lo que ya hacen las capas 0 a 2 | Sin problema restante que resuelva |
| **Enganche de `pre-commit` que bloquee escrituras fuera de alcance** | Detección antes del commit | Se saltea con `--no-verify`, y en un repositorio operado por agentes la detección temprana la da mejor la capa 4 propuesta abajo | Se agrega igual como comodidad, pero no se cuenta como garantía |
| **Enganche `PreToolUse` que bloquee la escritura al agente antes de que ocurra** | Es la única capa que realmente **previene** en lugar de detectar | Vive en la configuración del entorno de agentes, no en el repositorio: es decisión del product owner, y el repositorio no puede depender de que exista | **No se descarta: se escala.** Ver abajo |

## Capa 4 propuesta, fuera del alcance de este ADR

La prevención real —que un agente no pueda siquiera escribir un archivo fuera de
su columna— se obtiene con un enganche `PreToolUse` que consulte `alcances.json`
antes de cada `Write`/`Edit` y rechace la operación. Es el mecanismo más fuerte
disponible y encaja con la letra de R-04.

**No lo decido yo y no lo escribo yo**, por dos motivos: vive en la
configuración del entorno de agentes, que no es del arquitecto, y cambiar
permisos de herramientas es una decisión del product owner. Queda **escalado en
`plan.md` §10** con mi recomendación a favor. El diseño de las cuatro capas de
este ADR no depende de que se apruebe: si se aprueba, se suma; si no, las capas
0 a 3 siguen cumpliendo CA-07 por sí solas.

## Consecuencias

**Positivas**

- Una importación fuera de alcance se ve subrayada en el editor antes de
  guardar, falla al compilar, falla en el lint y falla en el pipeline. Hay que
  esforzarse mucho para que llegue a la rama principal.
- Los mensajes de error explican la razón arquitectónica, con lo cual la
  configuración documenta el diseño.
- Ninguna capa depende de una herramienta que controle el build.

**Negativas**

- La matriz hay que mantenerla cuando aparezca un paquete nuevo. Es un costo
  real y recurrente; se mitiga con que el paquete nuevo pasa por compuerta de
  todos modos.
- Las reglas van a molestar legítimamente alguna vez. La salida es explícita:
  una excepción se documenta en el ADR que la motive, nunca con un comentario
  de desactivación de regla suelto. Los comentarios `eslint-disable` sobre
  `no-restricted-imports` quedan **prohibidos** y el pipeline los rechaza.
- El pie `Agente:` en los commits agrega fricción al flujo humano.

**Qué cierra**

- Consumir el `src/` de otro paquete "para ir rápido".
- Que un paquete tome una dependencia sin declararla.

## Cómo se revierte

Capa por capa, y cada una por separado:

- **Capa 2 (ESLint):** borrar un bloque de configuración. Minutos. Es la más
  fácil de aflojar y por eso la que más se va a tentar aflojar: por eso la
  prohibición de `eslint-disable` es parte de la decisión.
- **Capa 3 (CODEOWNERS y verificación de alcance):** borrar dos archivos y un
  paso del pipeline. Una hora.
- **Capa 1 (referencias de proyecto):** costo medio, arrastra a ADR-003; exigiría
  un ADR de reemplazo.
- **Capa 0 (enlazado aislado):** cambiar una línea de `.npmrc` es trivial de
  hacer y **muy** caro de deshacer, porque una vez que el hoisting plano
  esconde las dependencias no declaradas, descubrir cuáles eran exige revisar
  cada importación del repositorio. Se considera irreversible en la práctica y
  exige ADR de reemplazo.
