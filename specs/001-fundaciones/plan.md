# Plan técnico 001 — Fundaciones del monorepo

| Campo | Valor |
| --- | --- |
| Autor | arquitecto |
| Spec de origen | `specs/001-fundaciones/spec.md` (aprobada en G1, registro entrada 012) |
| Estado | BORRADOR — pendiente de aprobación en G2 |
| Rango de ADR asignado | ADR-001 a ADR-009 (registro entrada 013) |
| Decisión previa que este plan ejecuta | 001-A, opción A (registro entrada 011): el andamiaje preexistente se audita acá |

> **Nota sobre la plantilla.** Este plan sigue `specs/_plantillas/plan.md` con dos
> desvíos deliberados: se agrega §3 (auditoría del andamiaje preexistente),
> porque es un entregable explícito de esta feature, y los contratos se
> presentan en §5 junto con el contrato de configuración de arranque, que es el
> único que cruza componentes en 001. La numeración resultante es la que ya
> referencian ADR-003, ADR-004, ADR-005 y ADR-006.

---

## 1. Enfoque

Esta feature no construye producto: construye el terreno donde el producto se va
a poder construir sin que nadie tenga que confiar en la buena conducta de nadie.
Por eso el criterio que ordena todas las decisiones no es la elegancia ni la
velocidad de desarrollo, sino **cuántas de las reglas del proyecto pueden dejar
de ser un acuerdo y pasar a ser una propiedad verificable por máquina**. El
dominio no depende de nada porque el compilador y el instalador no lo dejan,
no porque esté escrito en la constitución. Las librerías compartidas se compilan
antes que las aplicaciones porque el grafo de referencias de TypeScript lo
impone, no porque haya un script con el orden a mano. La web no puede hablar con
la base porque la importación no resuelve. Cada vez que hubo que elegir entre
una convención documentada y un mecanismo que falla solo, se eligió el
mecanismo.

La segunda fuerza es la **reversibilidad**. Un equipo chico con un dominio que
cambia por ley no puede permitirse decisiones caras de deshacer, y la forma
concreta de lograrlo acá es la misma en los nueve ADR: todo el valor del
producto —las reglas legales argentinas, los cálculos, las decisiones— vive en
`@mejorar/shared`, que es TypeScript puro sin framework, sin ORM y sin HTTP.
NestJS, Next.js, Expo, Prisma y hasta PostgreSQL son cáscara alrededor de eso.
Cambiar cualquiera de ellos cuesta semanas de reescritura de infraestructura y
cero líneas de negocio. Esa es la apuesta estructural del plan, y es la razón
por la que se puede elegir tecnología aburrida sin quedar atrapado en ella.

La tercera es el **alcance**. La spec 001 pide la cáscara, no el producto: la
estructura, el tooling, el pipeline y un ingreso de demostración. Todo lo que
este plan define del modelo de datos, de la sesión o de las pantallas es
deliberadamente mínimo y está rotulado como provisional, con la feature que lo
reemplaza indicada. La tentación real de esta etapa es adelantar la 002 "ya que
estamos", y el resultado sería un modelo de usuarios decidido sin spec y sin
dictamen de cumplimiento. La §5.3 acota eso con precisión.

---

## 2. Alcance técnico por componente

| Componente | Cambios | Agente responsable |
| --- | --- | --- |
| Raíz del repositorio | Corregir `package.json` (motor, scripts, lista blanca de builds), `tsconfig.base.json` y `docker-compose.yml` según §3. Crear `.npmrc`, `eslint.config.js`, `.prettierrc`, `vitest` raíz, `alcances.json`, `commitlint` + enganches de git, `README.md` | `cicd` |
| `.github/workflows` | Pipeline de integración continua con el orden de CA-08, verificación de alcances de escritura (ADR-009 capa 3), caché de pnpm y de navegadores de Playwright | `cicd` |
| `.github/CODEOWNERS` | Una entrada por ruta del roster de `CLAUDE.md` §3 | `cicd` |
| `packages/shared` | Esqueleto del paquete: `package.json` con `exports` por área, `tsconfig.json` con `composite`, un módulo real con su test (candidato: validación de CUIL/CUIT, que es dominio puro y no depende de la 004) | `dev-dominio` |
| `packages/integrations` | Esqueleto: contrato de puerto genérico, un puerto de ejemplo con su mock determinista, selector de implementación por `INTEGRACIONES_MODO`, test de contrato | `dev-integraciones` |
| `apps/api` | Esqueleto NestJS: arranque, validación de configuración con Zod (CA-06), `/salud`, Swagger, guarda de rol, interceptor de auditoría, ingreso de demostración provisional (§5.3) | `dev-backend` |
| `apps/api/prisma` | `schema.prisma` con las dos entidades mínimas de §5.3, migración inicial versionada, invariantes de ADR-007 §4 en SQL, seed de demostración (R-05: datos generados) | `database-engineer` |
| `apps/web` | Esqueleto Next.js con los cuatro grupos de ruta de ADR-005, comprobación de sesión y rol en servidor, cliente HTTP a la API, cáscaras rotuladas como provisionales | `dev-web` |
| `apps/mobile` | Esqueleto Expo con Expo Router, `metro.config.js` resolviendo el workspace (riesgo R-02), pantalla de ingreso de demostración, test que demuestre el consumo de `@mejorar/shared` | `dev-mobile` |
| `tests/e2e` | Escenario único de CA-10 con los tres perfiles, más análisis de accesibilidad con axe sobre las cuatro rutas existentes | `tester` |
| Tests por paquete | Al menos un test real por paquete con código (CA-04) | `tester` — ver escalamiento E-01 en §10 |
| `docs/02-arquitectura.md` | Corregir la puesta en marcha (`db:push` → `db:migrate`, `build:libs` → `build`) para que no contradiga a este plan | `cicd` |

**Orden de ejecución sugerido para G3** (el desglose es del orquestador): raíz y
tooling → `shared` → `integrations` → `prisma` → `api` → `web` → `mobile` →
`tests/e2e` → pipeline. La única dependencia dura es que nada compila antes de
que existan `shared` y la configuración de TypeScript.

---

## 3. Auditoría del andamiaje preexistente — veredicto 001-A

Veredicto por archivo. **Yo no edito ninguno**: cada corrección se convierte en
tarea de G3 para el agente indicado.

### 3.1 `package.json` (raíz) — **SE CORRIGE**

Estructura y convenciones correctas. Cinco defectos, dos de ellos de fondo.

| # | Qué | Veredicto | Fundamento |
| --- | --- | --- | --- |
| 1 | `engines.node: ">=20.11"` | **Defecto de fondo.** Cambiar a `">=22.12.0 <23"` y agregar `engines.pnpm: ">=10.33.0 <11"` | Contradice CA-01, que es texto aprobado en G1. ADR-002 |
| 2 | `"build:libs"` con el orden escrito a mano | **Defecto de fondo.** Eliminar. `build` pasa a ser `tsc -b` más la construcción de las aplicaciones | El orden lo deriva el grafo de referencias. ADR-003 §2. Un orden a mano se desincroniza el día que aparezca un tercer paquete compartido |
| 3 | `"db:push"` | Reemplazar por `db:migrate` (`prisma migrate dev`) y `db:migrate:deploy` | ADR-007 §3: un esquema sin historial no permite reconstruir el pasado, que es obligación de auditoría |
| 4 | `"test"` corre sólo `shared` e `integrations` | Reemplazar por la suite completa del espacio de trabajo | CA-04 exige resultado por paquete y §10 exige cero paquetes sin test |
| 5 | Falta `pnpm.onlyBuiltDependencies` | Agregar, con lista mínima y explícita (previsiblemente `@prisma/engines`, `argon2`, `@swc/core`, `esbuild`) | ADR-001 corolario 3. Sin esa lista, pnpm 10 emite advertencias en la instalación y CA-01 exige instalación sin advertencias |
| 6 | Faltan scripts: `lint`, `format`, `format:check`, `e2e`, `verificar-alcances`, `prepare` | Agregar | CA-08 fija el orden del pipeline; sin estos scripts el pipeline no se puede escribir |
| 7 | `clean` con `rm -rf` | **Se conserva.** Observación menor: no funciona en `cmd` de Windows | El equipo trabaja sobre Linux y macOS. Si entra alguien en Windows, se resuelve entonces |
| 8 | `packageManager: "pnpm@10.33.0"`, `private: true`, `description` | **Se conservan tal cual** | Ratificados por ADR-001 y ADR-002 |

### 3.2 `pnpm-workspace.yaml` — **SE CONSERVA Y SE AMPLÍA**

Las dos líneas de `packages` son correctas y ADR-001 las ratifica. Se amplía con
el bloque `catalog:` (versiones compartidas declaradas una sola vez, ADR-001) y,
si se prefiere ahí antes que en `package.json`, con `onlyBuiltDependencies`. No
hay nada que corregir.

### 3.3 `tsconfig.base.json` — **SE CORRIGE**

Es el archivo con más defectos de fondo, y los tres primeros no son de estilo:
cada uno desactiva una garantía que el resto del plan da por hecha.

| # | Qué | Veredicto | Fundamento |
| --- | --- | --- | --- |
| 1 | `"experimentalDecorators": true` y `"emitDecoratorMetadata": true` en la base | **Quitar de la base; van sólo en `apps/api/tsconfig.json`** | ADR-004: el framework vive en los bordes. Hoy el dominio puro y la web heredan la capacidad de usar decoradores de Nest, que es exactamente lo que la arquitectura prohíbe |
| 2 | `"moduleResolution": "node"` | **Defecto de fondo.** Cambiar a `"module": "node16"` + `"moduleResolution": "node16"` | Con `node`, TypeScript **ignora el campo `exports`**. Toda la capa 0 de ADR-009 y las subrutas explícitas de ADR-003 quedan sin correlato en el compilador: la importación prohibida se vería recién al ejecutar, no al escribir |
| 3 | `"noUncheckedIndexedAccess": false` | **Cambiar a `true`** | El dominio indexa tablas de parámetros normativos por clave. Con la opción en `false`, un parámetro ausente se convierte en `undefined` silencioso dentro de un cálculo de quita o de embargabilidad. La lista de `CLAUDE.md` §6 exige que INDETERMINABLE sea un resultado de primera clase: un `undefined` accidental es su opuesto exacto |
| 4 | Falta `"isolatedModules": true` | Agregar | SWC (ADR-008), Next.js y Vitest transforman archivo por archivo. Sin esta opción, el compilador acepta construcciones que esas herramientas no saben traducir, y el error aparece en tiempo de ejecución |
| 5 | `"exclude"` en la base | **Quitar.** Cada paquete declara su propio `include`/`exclude` | Las rutas relativas de una configuración extendida se resuelven contra el archivo que las declara: este `exclude` apunta a la raíz y no excluye nada en los subpaquetes. Es un defecto silencioso |
| 6 | `"lib": ["ES2022"]` | **Se conserva** como base; `apps/web` y `apps/mobile` agregan `"DOM"` en su propia configuración | Correcto que la base no asuma navegador |
| 7 | `target`, `strict`, `declaration`, `declarationMap`, `sourceMap`, `skipLibCheck`, `forceConsistentCasingInFileNames`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `esModuleInterop` | **Se conservan** | Correctos y coherentes con ADR-002 y ADR-003 |

`composite: true` **no** va en la base: va en el `tsconfig.json` de cada
paquete, junto con `rootDir` y `references` (ADR-009 capa 1).

### 3.4 `docker-compose.yml` — **SE CORRIGE**

Los tres servicios son los correctos y las versiones de PostgreSQL y Redis están
bien elegidas (ADR-007). Seis correcciones:

| # | Qué | Veredicto | Fundamento |
| --- | --- | --- | --- |
| 1 | Puertos publicados en todas las interfaces (`'5432:5432'`) | **Defecto de seguridad.** Publicar sólo en bucle local: `'127.0.0.1:${POSTGRES_PORT:-5432}:5432'`, y lo mismo en Redis y MinIO | Una notebook de desarrollo en una red ajena expone hoy PostgreSQL con usuario y contraseña conocidos. Además, parametrizar el puerto cubre el caso límite de §7 de la spec |
| 2 | `minio/minio:latest` | Fijar una versión concreta | `latest` hace que dos desarrolladores tengan dos sistemas distintos, y que un `docker compose pull` cambie el entorno sin que nadie lo decida |
| 3 | Sin `healthcheck` en Redis ni en MinIO | Agregar a los dos, y usar `depends_on: condition: service_healthy` donde corresponda | Sin eso, `db:up` devuelve el control antes de que los servicios acepten conexiones, y el paso siguiente del README falla de forma intermitente. CA-11 exige que el recorrido funcione siempre |
| 4 | MinIO sin creación del bucket | Agregar un servicio de un solo uso que cree el bucket, o un paso en el seed | Hoy el almacenamiento de documentos no está utilizable después de `db:up` |
| 5 | Falta la base de tests | Crear `mejorar_test` en el mismo contenedor mediante script de inicialización | ADR-007 §5 y ADR-008 §4 |
| 6 | `container_name` fijo | **Quitar** | Impide levantar dos copias del proyecto y choca con otros proyectos del mismo desarrollador. El nombre de proyecto de compose ya da el prefijo |
| 7 | Credenciales `mejorar/mejorar` | **Se conservan** | No son secretos reales (R-02) y el servicio queda en bucle local tras la corrección 1 |

### 3.5 `.env.example` — **SE CORRIGE**

Buena estructura, buena documentación en línea, y cumple R-02 en la letra: no
hay ningún secreto real. Pero tiene un defecto de seguridad de fondo y varios
huecos.

| # | Qué | Veredicto | Fundamento |
| --- | --- | --- | --- |
| 1 | `DATA_ENCRYPTION_KEY` con 64 ceros y `JWT_*_SECRET=cambiar-en-produccion-*` | **Defecto de fondo.** Dejar los tres vacíos, y que el esquema de configuración (§5.1) **rechace el arranque** con un valor de la lista de marcadores conocidos cuando `NODE_ENV=production` | Un marcador que tiene el formato válido arranca sin quejarse. Así es como una clave de cifrado de ceros llega a producción: nadie la cambia porque nada avisa. Un valor vacío falla de entrada; uno válido-pero-falso falla tarde y en silencio |
| 2 | MinIO no tiene ninguna variable | Agregar endpoint, región, bucket, clave y secreto | El servicio está en `docker-compose` y no hay forma de configurarlo. Hueco |
| 3 | Faltan `WEB_PORT`, `NEXT_PUBLIC_API_URL`, `EXPO_PUBLIC_API_URL`, `DATABASE_URL_TEST`, `LOG_LEVEL`, `CORS_ORIGINS` | Agregar | Sin ellas, web y móvil no saben a qué API hablar y CA-05 no se cumple con el archivo copiado sin modificar |
| 4 | Falta `PERMITIR_LOGIN_DEMO` | Agregar, con valor `true` y comentario explícito de que es provisional | §5.3 |
| 5 | Falta el encabezado de R-02 | Agregar una línea: ningún valor de este archivo es un secreto real, y ninguno sirve fuera de desarrollo | Hace explícita la regla en el lugar donde se rompe |
| 6 | Estructura general, comentarios, agrupación por integración, `INTEGRACIONES_MODO=mock` por defecto | **Se conservan** | Correctos y alineados con R-01 |

**Decisión sobre la forma:** se mantiene **un único `.env` en la raíz**, copiado
una sola vez (CA-11 limita el recorrido a siete pasos). `apps/web` y
`apps/mobile` lo leen desde la raíz y reexponen únicamente el subconjunto con
prefijo público. No se crean `.env` por aplicación.

### 3.6 Archivos que no estaban en la lista pero forman parte del andamiaje

| Archivo | Veredicto |
| --- | --- |
| `.nvmrc` (`22`) | **Se conserva tal cual.** Ratificado por ADR-002 |
| `.editorconfig` | **Se conserva.** Coherente con la configuración de Prettier que hay que agregar |
| `.gitignore` | **Se conserva con dos agregados:** `playwright-report/`, `test-results/`. La entrada `apps/api/prisma/migrations/dev/` es inocua pero confusa: las migraciones **se versionan** (ADR-007 §3); conviene quitarla para que nadie deduzca lo contrario |
| `README.md` | **No existe.** CA-11 lo exige y es el criterio de aceptación más fácil de olvidar. Tarea de `cicd` |
| `.npmrc` | **No existe.** Lo necesitan ADR-002 (`engine-strict=true`) y ADR-009 capa 0 (prohibición explícita de hoisting). Tarea de `cicd` |

### 3.7 Resumen del veredicto

**Se conservan:** `pnpm-workspace.yaml`, `.nvmrc`, `.editorconfig`, `.gitignore`.
**Se corrigen:** `package.json`, `tsconfig.base.json`, `docker-compose.yml`,
`.env.example`.
**Se descarta:** nada. Ningún archivo del andamiaje merece rehacerse desde cero.

La recomendación del orquestador en la spec §9 era acertada: son convencionales.
Lo que la auditoría agrega son cuatro defectos que no se veían desde afuera y
que habrían costado caro más tarde: el motor de Node contradiciendo la spec, la
resolución de módulos anulando el campo `exports`, `noUncheckedIndexedAccess`
apagado en un dominio de cálculo legal, y tres marcadores de secreto con formato
válido.

---

## 4. Decisiones de arquitectura

| ADR | Decisión | Estado |
| --- | --- | --- |
| [ADR-001](../adr/ADR-001-gestor-de-paquetes-y-monorepo.md) | Monorepo único con pnpm workspaces, enlazado aislado, sin orquestador de build | PROPUESTO |
| [ADR-002](../adr/ADR-002-runtime-node-y-fijacion-de-versiones.md) | Node 22 LTS con verificación dura por `engine-strict`; una sola fuente por cada versión | PROPUESTO |
| [ADR-003](../adr/ADR-003-compilacion-y-consumo-de-librerias-compartidas.md) | `shared` e `integrations` se compilan con `tsc` a CJS y se consumen desde `dist/`; el orden lo deriva el grafo de referencias | PROPUESTO |
| [ADR-004](../adr/ADR-004-framework-de-backend.md) | NestJS 11 sobre Express, con Zod en todos los bordes y el framework confinado a los bordes | PROPUESTO |
| [ADR-005](../adr/ADR-005-framework-web-y-tres-portales.md) | Una sola aplicación Next.js con los tres portales como grupos de ruta | PROPUESTO |
| [ADR-006](../adr/ADR-006-plataforma-movil.md) | React Native con Expo, para no duplicar el dominio legal en otro lenguaje | PROPUESTO |
| [ADR-007](../adr/ADR-007-motor-de-base-de-datos-y-capa-de-acceso.md) | PostgreSQL 16 ratificado por sus garantías temporales y de inmutabilidad; Prisma 6 confinado a `apps/api`; migraciones versionadas, nunca `db push` | PROPUESTO |
| [ADR-008](../adr/ADR-008-framework-de-tests.md) | Vitest en cuatro paquetes, Jest con `jest-expo` sólo en móvil; Playwright con axe para CA-10 y accesibilidad | PROPUESTO |
| [ADR-009](../adr/ADR-009-aplicacion-mecanica-de-los-limites-por-agente.md) | Defensa en cuatro capas para CA-07: resolución de pnpm, referencias de TypeScript, ESLint por zona, CODEOWNERS más verificación de alcance | PROPUESTO |

Decisiones **explícitamente diferidas**, para que no se resuelvan por omisión:

| Qué | Dónde se decide | Por qué no acá |
| --- | --- | --- |
| Aritmética de dinero (coma flotante vs. decimal exacto) | ADR del rango 010-019, features 004/005 | Afecta al dominio y merece su propio análisis. Hasta entonces, `shared` no incorpora biblioteca de aritmética ni implementa cálculo monetario (ADR-003 §4) |
| Gestión de la clave de cifrado en reposo | Feature 003 | Es parte del tratamiento de datos personales y necesita dictamen de `compliance-legal` |
| Modelo completo de identidad, permisos y sesión | Feature 002 | Ver §5.3 |
| Taxonomía completa de eventos de auditoría y retención | Feature 003 | En 001 sólo el mecanismo |
| Entornos, despliegue, observabilidad, tiendas | Feature 025 | Fuera de alcance por spec §8 |

---

## 5. Contratos y configuración de arranque

En 001 hay tres cosas que cruzan componentes. Ninguna justifica todavía un
archivo versionado en `specs/contratos/`: son la forma del arranque, no la forma
del negocio. Se declaran acá y se extraen a `specs/contratos/` en cuanto la 002
les dé contenido real.

### 5.1 Contrato de configuración — CA-06

La API valida **toda** su configuración con un esquema de Zod **antes** de
construir el contenedor de dependencias. Si falta una variable obligatoria o
tiene un valor inválido, el proceso escribe un error que **nombra cada variable
en falta y qué se esperaba**, y termina con código distinto de cero. No existe
arranque parcial ni valor por defecto silencioso para nada que sea secreto.

| Variable | Obligatoria | Forma | Regla adicional |
| --- | --- | --- | --- |
| `NODE_ENV` | sí | `development` \| `test` \| `production` | — |
| `API_PORT`, `API_PREFIX` | sí | entero 1-65535 / texto | — |
| `DATABASE_URL` | sí | URL `postgresql://` | — |
| `REDIS_URL` | sí | URL `redis://` | — |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | sí | ≥ 32 caracteres | rechaza marcadores conocidos si `NODE_ENV=production` |
| `DATA_ENCRYPTION_KEY` | sí | 64 caracteres hexadecimales | rechaza todo ceros si `NODE_ENV=production` |
| `INTEGRACIONES_MODO` | sí | `mock` \| `sandbox` \| `produccion` | por defecto `mock` (R-01) |
| Credenciales de cada integración | sólo si `INTEGRACIONES_MODO != mock` | — | validación condicional: con `mock` no se exige ninguna (CA-05) |
| `PERMITIR_LOGIN_DEMO` | sí | booleano | **el arranque falla** si es `true` con `NODE_ENV=production` |

Las dos últimas filas son las que hacen que CA-05 y §5.3 sean verdad por
construcción y no por promesa.

### 5.2 Contrato del chequeo de salud — CA-05

`GET /{API_PREFIX}/salud`, público, sin autenticación, devuelve 200 con el estado
del proceso, la versión, el modo de integraciones vigente y el estado de la
conexión a PostgreSQL y a Redis; 503 si alguna dependencia esencial no responde.
Es el único endpoint que la spec 001 exige como contrato estable.

### 5.3 Resolución de CA-10 — qué significa "datos coherentes" en el alcance de 001

**El problema.** CA-10 exige ingresar con un usuario de demostración de cada
perfil y ver "datos coherentes", pero el modelo de identidad es de la feature
002 y no existe. Tomado literalmente, CA-10 obliga a inventar en 001 el modelo
de usuarios, el de permisos y alguna entidad de negocio que mostrar: decidiría
sin spec y sin dictamen de cumplimiento tres cosas que tienen su propia
compuerta.

**La resolución.** Se acota, y se acota con precisión, apoyándose en que la
propia spec ya lo previó en §8: *"Modelo de datos del negocio: acá sólo lo
mínimo para que el seed de demostración funcione"*. En el alcance de 001,
**"datos coherentes" significa exactamente estas tres afirmaciones, y ninguna
más**:

1. Cada usuario de demostración ingresa y su portal muestra **su** nombre y
   **su** rol, obtenidos de la API, no del cliente.
2. Un usuario con un rol que intenta entrar al portal de otro rol recibe **403
   de la API** y la ruta de la web lo rechaza en el servidor. El rechazo lo
   decide la API; la web no es un límite de seguridad (ADR-005 punto 1).
3. El panel "mi actividad reciente" de cada portal lista **únicamente los
   eventos de auditoría propios** del usuario que ingresó. Cero eventos de los
   otros dos.

Lo mínimo que hace falta para sostener esas tres afirmaciones:

| Entidad | Contenido mínimo | Quién la modela |
| --- | --- | --- |
| `Usuario` | identificador opaco, correo, hash de contraseña con argon2id, rol (`CLIENTE` \| `ABOGADO` \| `ADMINISTRADOR`), nombre para mostrar, marcas de tiempo | `database-engineer` |
| `EventoAuditoria` | identificador, momento, usuario, acción, recurso, resultado, origen. **Invariante: sin `UPDATE` ni `DELETE` desde el rol de la aplicación** (ADR-007 §4) | `database-engineer` |

**Lo que queda explícitamente fuera de 001**, y va a la 002 o a la 003: perfiles
de cliente y de abogado, verificación de matrícula, mapa rol → permisos, MFA,
rotación de refresh con detección de reutilización, recuperación de contraseña,
consentimientos, taxonomía completa de eventos de auditoría, retención y
encadenamiento de hashes.

**El ingreso de 001 es andamiaje y está marcado como tal.** Es correo más
contraseña con un único token de acceso de vida corta, sin refresh y sin MFA.
Lo reemplaza íntegramente la 002. Para que ese andamiaje no se escape:
`PERMITIR_LOGIN_DEMO` lo habilita, y **la API se niega a arrancar si está
habilitado con `NODE_ENV=production`** (§5.1). Elegir la bitácora de auditoría
como el "dato" que cada portal muestra no es un capricho: es la única entidad
que 001 necesita construir de todos modos, porque la auditoría es requisito de
arquitectura y no una feature (criterio 6 del mandato del arquitecto,
constitución #5), y así CA-10 se cumple sin adelantar ni una línea de la 002.

**Lo que le pido a la compuerta.** Esta es una lectura restrictiva de un
criterio aprobado, no una interpretación libre: pido que G2 registre el texto de
las tres afirmaciones de arriba como la redacción operativa de CA-10, de modo
que el `tester` valide contra ella y no contra "datos coherentes", que no es
medible. Si el product owner entiende que CA-10 pedía más que esto, entonces
001 depende de 002 y el orden del backlog tiene que revisarse: eso ya no es
decisión mía (escalamiento E-02, §10).

---

## 6. Atributos de calidad

Todos con número y con forma de verificación. Los que no aplican a esta feature
se declaran como tales en lugar de quedar en blanco.

| Atributo | Objetivo | Cómo se verifica |
| --- | --- | --- |
| **Tiempo de puesta en marcha** | < 15 min desde clonar hasta el sistema corriendo, en máquina limpia (spec §10) | `cicd` cronometra el recorrido completo del README en un runner limpio y publica el número en el informe de G6. Se repite al cierre de cada ola |
| **Pasos del README** | ≤ 7 pasos manuales (spec §10) | Recuento en la revisión de G4; el `tester` ejecuta el recorrido paso a paso y lo registra en `qa.md` (CA-11) |
| **Duración del pipeline** | < 10 min extremo a extremo (spec §10); alerta al superar 8 min | Duración informada por el pipeline. Superar el objetivo dispara la reversión parcial prevista en ADR-001 (incorporar caché de tareas) |
| **Instalación** | `pnpm install` en frío < 4 min; con caché < 60 s; **cero advertencias** (CA-01) | Paso del pipeline con `--frozen-lockfile`; las advertencias se tratan como error |
| **Compilación incremental** | `tsc -b` sin cambios < 5 s; tras un cambio en `shared` < 20 s | Medición local documentada en el README; se revisa si degrada |
| **Arranque de la API** | < 5 s hasta responder `/salud`; falla por configuración en < 1 s (CA-06) | Test de integración que arranca la aplicación y mide; test negativo que quita una variable obligatoria y verifica el código de salida y el mensaje |
| **Paquetes sin test** | 0 (spec §10) | El comando raíz de tests falla si un paquete con código no reporta ningún test (ADR-008 §2) |
| **Cobertura** | `shared` ≥ 90% de líneas y ramas; `integrations` ≥ 80%; `api` ≥ 70%. **Exigible desde la primera feature que aporte lógica real (004)**; en 001 los umbrales se configuran y se informan | Informe de cobertura de Vitest en el pipeline; por debajo del umbral, falla |
| **Accesibilidad** | WCAG 2.2 AA. **0 violaciones críticas o serias** de axe en las 4 rutas existentes (ingreso y los tres portales) | Análisis automático con axe dentro del escenario de Playwright (ADR-008 §6). Revisión manual: de `ux-expert`, desde la 002 |
| **Peso de la web** | JavaScript de primera carga ≤ 180 KB comprimido en las rutas del grupo `(publico)` | Salida de `next build` comparada con el presupuesto en el pipeline; por encima, falla. Objetivo fijado por ADR-005 |
| **Seguridad — secretos** | 0 secretos reales en el repositorio y en el historial (R-02) | Análisis de secretos en el pipeline sobre el árbol y sobre el diff |
| **Seguridad — dependencias** | 0 vulnerabilidades **críticas**. Las **altas** admiten dispensa escrita con fecha de vencimiento a 7 días | `pnpm audit` en el pipeline: falla ante crítica, informa ante alta |
| **Seguridad — exposición local** | 0 servicios de `docker-compose` escuchando fuera de `127.0.0.1` | Revisión en G4 del archivo corregido (§3.4 corrección 1) |
| **Separación de roles** | 0 importaciones fuera de la matriz de ADR-009; 0 comentarios de desactivación sobre `no-restricted-imports` | Pasos de lint y de tipos del pipeline (CA-07). Test negativo del `tester`: una importación prohibida de prueba tiene que hacer fallar el pipeline; si no falla, el mecanismo no existe |
| **Auditabilidad** | 100% de las peticiones a rutas autenticadas generan un evento de auditoría; 0 filas de auditoría modificables o borrables desde el rol de la aplicación | Test de integración que cuenta eventos por petición; test que intenta `UPDATE` y `DELETE` sobre la tabla y **espera el error** de la base |
| **Reproducibilidad** | `pnpm install --frozen-lockfile` no modifica el lockfile; dos compilaciones del mismo commit dan el mismo resultado | Pipeline: falla si el lockfile queda sucio |
| **Rendimiento en ejecución** | **No aplica en 001.** No hay carga real que medir. Los objetivos de latencia se fijan en la primera feature con endpoints de negocio (002) | — |
| **Disponibilidad** | **No aplica en 001.** No se despliega a ningún entorno (spec §8). Objetivos de disponibilidad: feature 025 | — |

---

## 7. Riesgos técnicos

| # | Riesgo | Impacto | Mitigación |
| --- | --- | --- | --- |
| R-01 | **El back-office viaja en el mismo despliegue que la web pública** (ADR-005) | Alto si se materializa | Ninguna comprobación de autorización en el cliente; toda decisión en servidor y contra la API. Salida prevista y estimada: extraer el portal a su propia aplicación, 3-5 días |
| R-02 | **Metro no resuelve los paquetes del workspace.** Es el riesgo más concreto de la feature (ADR-003 y ADR-006 punto 4): enlaces simbólicos, `watchFolders` y consumo de `dist/` | Alto — bloquea `apps/mobile` por completo | `dev-mobile` configura `metro.config.js` con `watchFolders` y `nodeModulesPaths` explícitos, y entrega un test que importa una función de `@mejorar/shared` y la ejecuta en la app. Se ataca **primero**, no último. Salida si falla: consumir `shared` como paquete empaquetado local mientras se resuelve |
| R-03 | **Motores binarios de Prisma** en contenedores y en ARM (ADR-007) | Medio — rompe el pipeline y las imágenes | Fijar `binaryTargets` para glibc, musl y ARM desde el primer commit del esquema; el pipeline construye la imagen en 001 aunque no se despliegue |
| R-04 | **`engine-strict` frena el ingreso de una persona nueva** con otro Node instalado | Bajo, pero golpea justo en CA-11 | Primer paso del README: instalar la versión de `.nvmrc` en un comando. El mensaje de pnpm ya nombra la versión esperada (ADR-002) |
| R-05 | **`unplugin-swc` se rompe** en una actualización mayor de Vitest o de NestJS (ADR-008) | Medio — deja los tests de la API sin correr | Versiones fijas en el catálogo; la actualización de cualquiera de los tres es un cambio propio con su corrida completa. Salida: Jest con `@swc/jest` en `apps/api`, un día |
| R-06 | **Sin caché de tareas, el pipeline crece** hasta pasar los 10 minutos (ADR-001) | Medio | Medición en cada corrida y alerta a los 8 minutos; la incorporación de caché ya está analizada y estimada en medio día |
| R-07 | **El andamiaje de ingreso de demostración sobrevive a la 002** y termina en producción | Alto si se materializa — es un ingreso sin MFA | `PERMITIR_LOGIN_DEMO` y el rechazo de arranque en producción (§5.1). Además, la 002 tiene como criterio de salida eliminar el módulo |
| R-08 | **Los umbrales de cobertura se configuran en 001 y nadie los activa** cuando llega la 004 | Medio — la garantía queda decorativa | Queda como tarea explícita del plan de la 004 y como punto de control de G5 de esa feature |
| R-09 | **La matriz de alcances se desactualiza** al aparecer un paquete nuevo | Bajo | Un paquete nuevo pasa por compuerta de todos modos; actualizar `alcances.json` y ESLint es parte de la definición de terminado de ese cambio |
| R-10 | **Docker no disponible** en la máquina de alguien (spec §7) | Bajo | Camino documentado contra una base externa; los tests que necesitan base se omiten con mensaje explícito en lugar de tumbar la suite (ADR-008 §4) |

---

## 8. Alternativas descartadas a nivel de plan

Las alternativas de cada decisión técnica están en su ADR. Acá sólo las que
afectan al plan entero.

| Alternativa | Por qué no |
| --- | --- |
| **Rehacer el andamiaje desde cero** (opción B de la decisión 001-A) | La auditoría de §3 encontró cuatro defectos de fondo y ninguno estructural. Rehacer costaría lo mismo que corregir y perdería la historia de por qué cada cosa estaba ahí |
| **Diferir CA-07 a una feature posterior** y arrancar con convenciones documentadas | Los límites que no existen desde el primer commit no se agregan nunca: cuando se intentan, ya hay cien importaciones que violarlos. Es la decisión más barata de tomar ahora y la más cara de postergar |
| **Postergar la bitácora de auditoría a la 003** | El mandato la define como requisito de arquitectura, no como feature. Además, sin ella CA-10 no tiene ningún dato que mostrar sin adelantar la 002 |
| **Arrancar las cinco aplicaciones con contenido real y no con cáscaras** | Sería implementar la 002, la 006 y la 022 sin spec aprobada. Contradice la constitución #2 |
| **Adoptar Turborepo, Nx o caché remota desde el día uno** | Sin medición que lo justifique. La incorporación posterior es aditiva y está estimada (ADR-001) |
| **Desplegar un entorno de homologación como parte de 001** | Fuera de alcance por spec §8; es la feature 025 |

---

## 9. Plan de puesta en marcha y verificación

**Despliegue: no hay.** La spec 001 no despliega a ningún entorno (§8). Lo que sí
hay que definir:

- **Migraciones.** La primera migración de Prisma crea las dos entidades de §5.3
  más las invariantes de ADR-007 §4 escritas como SQL en la misma migración. Es
  la línea de base del esquema: todas las features posteriores parten de ella.
- **Datos de demostración.** El seed genera los tres usuarios de demostración y
  sus eventos de auditoría iniciales. Datos generados, nunca reales (R-05). El
  seed es idempotente: correrlo dos veces no duplica nada (constitución #12
  aplicada al propio tooling).
- **Banderas.** `INTEGRACIONES_MODO` (por defecto `mock`, R-01) y
  `PERMITIR_LOGIN_DEMO` (provisional, muere con la 002).
- **Compatibilidad hacia atrás.** No aplica: no hay versión anterior.
- **Vuelta atrás.** Revertir el commit. No hay estado externo que reparar
  porque no hay nada desplegado.
- **Orden del pipeline** (CA-08), y falla visible en cualquier paso:
  1. instalación con lockfile congelado
  2. verificación de formato
  3. lint, incluida la matriz de alcances de ADR-009
  4. verificación de tipos y compilación (`tsc -b`)
  5. tests unitarios y de integración, con informe por paquete
  6. levantar servicios, migrar, sembrar
  7. extremo a extremo con Playwright más accesibilidad con axe
  8. presupuesto de peso de la web, análisis de secretos y de dependencias
  9. verificación de alcances de escritura por autor (ADR-009 capa 3)

**Definición de terminado de la feature.** Los once criterios de aceptación
verificados, con el detalle de cuál mecanismo prueba cada uno registrado en
`qa.md` por el `tester`. CA-07 exige además el test negativo del §6: una
importación prohibida de prueba tiene que hacer fallar el pipeline.

---

## 10. Decisiones abiertas y escalamientos

Ninguna decisión de arquitectura queda sin marcar. Lo que sigue son tres puntos
que **no me corresponde decidir** y que llevo a la compuerta.

**E-01 — ¿Quién escribe los tests?**
`CLAUDE.md` §3 le asigna `**/*.test.ts` en exclusiva al `tester` y le prohíbe al
resto tocar archivos de test. Leído al pie de la letra, un desarrollador no
puede escribir el test de la función que acaba de escribir: no hay TDD posible,
el `tester` se vuelve cuello de botella de las ocho corrientes de trabajo, y la
cobertura del dominio legal —que es donde más falta hace— depende de alguien que
no escribió la regla.
*Opciones:* **(a)** dejarlo como está; **(b)** los desarrolladores escriben los
tests unitarios de su propio paquete y el `tester` es dueño exclusivo de
`tests/e2e/`, de `qa.md` y del veredicto de G5; **(c)** los desarrolladores
proponen tests y el `tester` los aprueba como dueño en CODEOWNERS.
*Mi recomendación:* **(b)**. Conserva lo que la constitución #4 realmente
protege —que quien valida no sea quien construye— sin volver imposible probar
mientras se construye. Afecta a `CLAUDE.md` §3, así que es decisión del product
owner.

**E-02 — Redacción operativa de CA-10.**
Pido que G2 registre las tres afirmaciones de §5.3 como la lectura de "datos
coherentes" en el alcance de 001. Si el product owner esperaba más, 001 pasa a
depender de 002 y hay que reordenar el backlog. *Mi recomendación:* aprobar la
lectura restrictiva.

**E-03 — Capa 4 de ADR-009: enganche `PreToolUse` sobre los alcances.**
Es el único mecanismo que **previene** que un agente escriba fuera de su columna
en lugar de detectarlo después. Vive en la configuración del entorno de agentes,
que no es del arquitecto, y cambiar permisos de herramientas es decisión humana.
*Mi recomendación:* adoptarlo, con `alcances.json` como fuente única. Las capas
0 a 3 cumplen CA-07 igual si no se adopta; esta capa agrega la prevención, no la
detección.

**Sin decisiones pendientes fuera de estas tres.** Las cinco diferidas del §4
tienen feature y compuerta asignadas.
