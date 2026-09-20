# ADR-007 — Motor de base de datos y capa de acceso a datos

| Campo | Valor |
| --- | --- |
| Estado | PROPUESTO |
| Fecha | 2026-09-20 |
| Autor | arquitecto |
| Aprobado por | pendiente — G2, feature 001 |
| Spec de origen | `specs/001-fundaciones/spec.md` (CA-02, CA-05, CA-06, R-05) |

## Contexto

`docs/02-arquitectura.md` y el andamiaje preexistente dan por hecho PostgreSQL 16
con Prisma 6. Ninguna de las dos cosas pasó nunca por una compuerta: son
propuestas, y la spec 001 obliga a ratificarlas o corregirlas con fundamento
(decisión 001-A, registro de compuertas entrada 011).

Las fuerzas reales que empujan la decisión no son las de un CRUD cualquiera:

1. **Historia, no estado.** La constitución #11 y la lista de `CLAUDE.md` §6
   exigen parámetros normativos con vigencia desde/hasta, y hallazgos, saldos y
   situaciones **versionados en vez de pisados**. Hay que poder responder "qué
   decía el sistema el 14 de marzo" en un habeas data. Eso es historia temporal
   con solapamientos prohibidos, no una fila que se actualiza.
2. **Bitácora inmutable** de todo acceso a dato patrimonial (constitución #5,
   Ley 25.326). Inmutable significa que ni la aplicación ni un error de código
   pueden actualizar ni borrar una fila: hace falta un motor capaz de revocar
   permisos por tabla y de imponerlo con reglas propias.
3. **Idempotencia en todo efecto externo** (constitución #12): claves únicas y
   la capacidad de hacer "insertar o no hacer nada" de forma atómica bajo
   concurrencia.
4. **Cifrado en reposo** de CUIL, domicilio y números de cuenta, con clave
   gestionada fuera de la base.
5. **Dinero y plazos legales.** Los importes exigen decimal exacto, nunca punto
   flotante; los plazos de prescripción exigen aritmética de fechas con zona
   horaria de la Argentina.
6. **Un equipo chico.** Lo que haya que mantener a mano se desincroniza.

## Decisión

### 1. Motor: PostgreSQL 16

Se **ratifica PostgreSQL 16** como único almacén de registro del sistema. No es
inercia: es el único motor de la lista corta que trae, sin extensiones exóticas,
las cinco cosas que este dominio necesita.

| Necesidad del dominio | Qué de PostgreSQL la resuelve |
| --- | --- |
| Vigencias sin solapamiento | Tipos de rango (`daterange`, `tstzrange`) y restricciones de exclusión con `GIST` |
| Bitácora inmutable | Permisos por tabla (`REVOKE UPDATE, DELETE`), reglas y disparadores, más particionado por fecha para la retención |
| Dinero exacto | `numeric` de precisión arbitraria |
| Idempotencia | Índice único parcial más `INSERT ... ON CONFLICT DO NOTHING` |
| Respuestas crudas de organismos públicos | `jsonb` con índices `GIN`, sin inventar un segundo motor documental |
| Cifrado y hash | `pgcrypto` disponible; la clave de datos vive fuera de la base (ADR pendiente de 003) |

Complementos que **no** son almacén de registro y se declaran acá para que nadie
los use como tal: **Redis 7** es caché y cola (nada que esté sólo en Redis es
verdad), y **MinIO / S3** guarda documentos binarios (la base guarda la
referencia, el hash y los metadatos, nunca el archivo).

### 2. Capa de acceso: Prisma 6, confinado a `apps/api`

Se **ratifica Prisma 6** como cliente de base de datos y motor de migraciones,
con cuatro condiciones que son parte de la decisión:

1. **`@prisma/client` es una dependencia exclusiva de `apps/api`.** No aparece en
   `packages/shared`, ni en `packages/integrations`, ni en `apps/web`, ni en
   `apps/mobile`. Se aplica mecánicamente (ADR-009).
2. **Los tipos generados por Prisma no cruzan el borde del módulo de
   persistencia.** Un caso de uso recibe y devuelve tipos de `@mejorar/shared`.
   Prisma modela cómo se guarda; `shared` modela qué es. Si el día de mañana
   cambia el ORM, cambia una capa, no el dominio.
3. **No se construye una abstracción de repositorio genérica por encima de
   Prisma.** Prisma **es** la capa de acceso. Se admiten servicios de
   persistencia por agregado cuando la consulta es no trivial, pero una interfaz
   `Repository<T>` que sólo reenvía a Prisma es abstracción especulativa y se
   rechaza. La condición 2 ya da la reversibilidad que esa capa prometía.
4. **Se admite SQL crudo donde Prisma no llega**, y se espera que haga falta:
   restricciones de exclusión, disparadores de inmutabilidad, particionado,
   índices parciales y permisos por tabla se escriben como SQL dentro de las
   migraciones versionadas. Prisma no "sabe" de esas construcciones, pero no las
   estorba: sobreviven a `migrate` porque viven en el historial de migraciones.

### 3. Migraciones: `prisma migrate`, nunca `db push`

El flujo es **`prisma migrate dev` en desarrollo y `prisma migrate deploy` en
cualquier entorno compartido**. Las migraciones son archivos SQL versionados en
el repositorio, revisados en el PR como cualquier otro cambio, y de aplicación
estrictamente hacia adelante.

Esto **corrige** el andamiaje: el script `db:push` del `package.json` raíz y el
paso `pnpm db:push` de `docs/02-arquitectura.md` se eliminan. `db push` sincroniza
el esquema sin dejar rastro de cómo se llegó ahí; en un sistema cuya obligación
es reconstruir qué sabía en cada fecha, un esquema sin historial es un defecto de
auditoría, no una comodidad. `db push` queda admitido en un solo caso: prototipar
contra una base descartable local, nunca versionado y nunca en un script raíz.

No se usan migraciones de reversión automáticas. La vuelta atrás de un esquema es
una migración nueva, escrita a mano, porque una reversión ciega sobre datos de
producción destruye información.

### 4. Reglas que la base tiene que hacer cumplir por sí sola

Declaro las invariantes; el modelo concreto es del `database-engineer`:

| Invariante | Por qué no alcanza con validarlo en la aplicación |
| --- | --- |
| La tabla de auditoría no admite `UPDATE` ni `DELETE` desde el rol de la aplicación | Un error de código o un ORM distraído no pueden alterar prueba |
| Dos vigencias del mismo parámetro normativo no se solapan | Dos filas vigentes dan dos cálculos legales distintos para la misma fecha |
| La clave de idempotencia de un trámite externo es única | Dos procesos concurrentes envían dos cartas documento |
| Importes en `numeric`, jamás en coma flotante | Un centavo de error en un reclamo legal es un argumento en contra |
| Todo identificador expuesto es opaco | Constitución #5, condición C-10; un `id` secuencial filtra volumen de cartera |
| Borrado lógico con fecha en entidades de negocio; borrado físico sólo por ejercicio del derecho de supresión, registrado | Ley 25.326 exige poder suprimir, y exige poder probar que se suprimió |

### 5. Bases y entornos locales

Un único contenedor de PostgreSQL con **dos bases**: `mejorar` para desarrollo y
`mejorar_test` para la suite automatizada. No se usa un motor distinto ni más
liviano para los tests: probar contra SQLite un esquema que depende de rangos,
exclusiones y permisos por tabla es probar otro sistema (ver ADR-008).

## Alternativas consideradas

| Alternativa | A favor | En contra | Por qué no |
| --- | --- | --- | --- |
| **MySQL / MariaDB** | Hosting barato y ubicuo en la Argentina | Sin tipos de rango ni restricciones de exclusión, `jsonb` más pobre, semántica de transacciones DDL peor | Las vigencias sin solapamiento tendrían que emularse con disparadores propios: más código nuestro para una garantía más débil |
| **MongoDB** | Esquema flexible para respuestas dispares de organismos | Sin integridad referencial ni transacciones cómodas entre agregados; auditoría e inmutabilidad quedan a cargo de la aplicación | Un dominio legal es relacional y tiene que ser íntegro por construcción. La flexibilidad que aporta ya la da `jsonb` |
| **SQLite** para desarrollo y tests | Cero infraestructura, tests instantáneos | No soporta lo que el esquema real necesita; los tests pasarían contra un sistema que no es el que se despliega | Falsa velocidad: los defectos aparecerían en producción |
| **Drizzle ORM** | Cercano al SQL, tipado excelente, sin motor binario, migraciones legibles | Ecosistema y material mucho menores; el modelo de migraciones todavía cambia; menos gente sabe mantenerlo | Es la alternativa técnicamente más atractiva y la que más me costó descartar. Se descarta por "aburrido gana" y por riesgo de contratación, no por capacidad |
| **Kysely** o **SQL crudo con `pg`** | Control total, cero magia, sin binarios nativos | Hay que construir migraciones, tipado del esquema y carga de relaciones a mano; con 17 módulos y ocho agentes, cada uno lo resolvería distinto | Terminaríamos manteniendo un ORM propio sin documentación |
| **TypeORM** | Idiomático en NestJS, entidades decoradas | Historial de defectos en migraciones, decoradores en las entidades que empujan el modelo hacia el framework | Contradice ADR-004 punto 1: el framework vive en los bordes |
| **MikroORM** | Unidad de trabajo real, buen soporte de identidad | Menos difundido; su mayor virtud (unidad de trabajo) no es una carencia sentida hoy | Sin problema que resolver |
| **Prisma con `db push` y sin migraciones** | Iteración velocísima al principio | Esquema sin historial reproducible | Incompatible con la obligación de reconstruir el pasado |
| **Postgres gestionado desde el día uno** (Neon, Supabase) | Sin Docker local | Contradice CA-05 (arrancar sin credenciales de terceros) y §7 de la spec | El sistema tiene que correr sin cuenta en ningún lado |

## Consecuencias

**Positivas**

- Las garantías más caras de este dominio —inmutabilidad de la bitácora, no
  solapamiento de vigencias, unicidad de la clave de idempotencia— las sostiene
  el motor, no la buena conducta de cada módulo.
- Prisma da esquema declarativo, migraciones versionadas y un cliente tipado sin
  que nadie escriba infraestructura de acceso a datos.
- Confinar Prisma a `apps/api` deja el dominio auditable por alguien que no sabe
  de ORMs, que es el punto del criterio 2 del mandato del arquitecto.

**Negativas**

- Prisma trae un motor binario por plataforma: hay que fijar `binaryTargets`
  para Linux/glibc, Linux/musl y ARM, y es una fuente concreta de fallas en
  contenedores (riesgo R-03 del plan).
- El SQL crudo de las migraciones (exclusiones, disparadores, permisos) no se
  refleja en `schema.prisma`: hay dos lugares donde mirar. Se mitiga con la
  regla de que toda invariante estructural se documenta en
  `specs/**/modelo-datos.md`, responsabilidad del `database-engineer`.
- Docker deja de ser opcional para el camino principal de desarrollo. El camino
  alternativo contra una base externa queda documentado (spec §7).
- Las consultas analíticas del back-office (spec 022) probablemente excedan lo
  que Prisma expresa cómodamente y se resuelvan con SQL crudo o vistas.

**Qué cierra**

- Desplegar la API en runtimes donde el motor binario de Prisma no corre sin
  adaptaciones (borde, funciones efímeras muy restringidas).
- Usar un segundo almacén de registro sin un ADR de reemplazo.

## Cómo se revierte

- **Cambiar Prisma por Drizzle o Kysely, conservando PostgreSQL:** costo medio y
  acotado por construcción. Se reescribe la capa de persistencia de `apps/api` y
  las migraciones se conservan tal cual (son SQL). Nada del dominio, de las
  integraciones, de la web ni de la app se toca, porque los tipos de Prisma
  nunca salieron del módulo de persistencia. Estimado: 1-2 semanas al terminar
  la ola 2; creciente con el tamaño del esquema. Ésta es la salida prevista si
  el motor binario o el rendimiento de Prisma se vuelven un problema real.
- **Cambiar PostgreSQL por otro motor relacional:** costo alto. Habría que
  reimplementar las invariantes que hoy sostiene el motor y migrar los datos.
  Estimado: 3-4 semanas más una ventana de migración. No se prevé.
- **Volver a `db push`:** trivial de hacer y caro de deshacer, porque se pierde
  el historial del período en que estuvo activo. Exige ADR de reemplazo.
