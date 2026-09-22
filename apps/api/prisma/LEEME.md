# `apps/api/prisma` — esquema, migraciones y sus tests

**Dos features conviven acá, en esquemas separados y sin mezclarse.** El
directorio transcribe dos modelos de datos aprobados en G2; no decide nada.

| Esquema | Feature | Fuente de verdad | Alcance de hoy |
| --- | --- | --- | --- |
| `motor` | 004 — Motor de reglas legales | `specs/004-motor-reglas-legales/modelo-datos.md` | **Bloque A** (catálogo normativo), A.1 a A.6. Los bloques A.7 a A.9, B, C y D los agregan T-06 y T-09. |
| `acceso` + `auditoria` | 002 — Identidad y acceso | `specs/002-identidad-y-acceso/modelo-datos.md` | **Completo**: bloques A a H, salvo A.2 y E.4 (ver §6). |
| `identidad` | 007 | — | Existe vacío desde la migración `0001`. **Prisma no lo administra** y la 002 no lo toca. |

Por qué `acceso` y no `identidad` para la 002: `identidad` es el único lugar
donde vive el vínculo entre un seudónimo y una persona real, con otro rol y
otra clave. Son problemas distintos — `identidad` responde "quién es el sujeto
01J…" para el motor; `acceso` responde "quién se está autenticando".

**Y por qué la 002 no puso una sola tabla en `motor`:** la migración `0001` dejó
escrito que `motor` no tiene datos identificatorios del deudor (CA-60 de la 004,
condición C-10). La 002 es exactamente lo contrario: es donde vive el correo y
el nombre. Mezclarlas destruiría la garantía que la 004 compró con esa
separación.

---

## 1. Qué hay acá

| Ruta | Qué es |
| --- | --- |
| `schema.prisma` | Tablas, columnas y relaciones. Lo que el DSL de Prisma sabe expresar. |
| `seed.ts` | Datos de demostración de la 002 (§6.5). **No es una migración**: ver §7. |
| `migraciones-en-espera/**` | Migraciones escritas que **no se ejecutan**, bloqueadas por un escalamiento. Prisma no mira este directorio. Ver §6. |
| `migrations/**/migration.sql` | La migración que se aplica. Primera mitad generada por `prisma migrate diff`; segunda mitad —desde "SQL CRUDO"— escrita a mano. |
| `migrations/**/reversion.sql` | La vuelta atrás. **Prisma no la ejecuta nunca** (ADR-007 §3): está versionada para que la reversión sea una decisión escrita y revisada, y para que el test la pueda verificar. |
| `tests/**` | Los tests del esquema. Ver §3. |

### Lo que Prisma no expresa y vive en el SQL crudo

Es la consecuencia práctica de `modelo-datos.md` §6.4 y hay que tenerla presente
antes de tocar nada:

- el tipo `daterange` de `TramoParametro.vigencia` (en el DSL, `Unsupported`);
- la restricción de exclusión GiST que prohíbe vigencias solapadas (R-13);
- todas las restricciones `CHECK`;
- los índices **parciales** (Prisma los declara totales y la migración los
  reemplaza **conservando el nombre**, para que el test los encuentre);
- la clasificación de sensibilidad de cada columna, como `COMMENT`;
- la columna **generada** `acceso.Usuario.esAdministrador`;
- las claves foráneas **compuestas** contra columnas de estado, con
  `ON UPDATE RESTRICT` — el mecanismo central de las invariantes de la 002;
- los **disparadores de restricción diferidos** (R-002-03, R-002-05, R-002-06)
  y los de inmutabilidad de las tablas de sólo inserción;
- el **particionado** por rango mensual de `auditoria.EventoAuditoria`;
- **RLS** con `FORCE ROW LEVEL SECURITY` y el `GRANT` a nivel de columna.

> **Sobre `esAdministrador` y el `@default(dbgenerated(...))` del DSL.** Ese
> `@default` no crea nada: la columna la crea la migración como
> `GENERATED ALWAYS … STORED`. Está para que el cliente de Prisma trate el
> campo como **opcional al escribir** y lo omita del `INSERT`. Sin eso,
> `prisma.usuario.create()` exigiría un valor y PostgreSQL rechazaría la
> sentencia con *"cannot insert a non-DEFAULT value into column"*: la tabla de
> cuentas sería inescribible desde el cliente. Escribirla explícitamente sigue
> fallando, y está bien que falle.
>
> Consecuencia conocida: `prisma migrate diff` reporta esa columna y los
> índices parciales como diferencia permanente. **No es deriva**, es lo que el
> DSL no sabe representar; el mismo efecto ya existía con los dos índices
> parciales del `motor`.

> **Cuidado al regenerar.** Si alguien corre `prisma migrate dev` y deja que
> regenere esta migración desde el DSL, todo lo de arriba desaparece **en
> silencio**: el esquema sigue pareciendo correcto y ya no garantiza ninguna de
> las invariantes de `modelo-datos.md` §7.1. Los tests de `tests/` existen
> sobre todo para eso: verifican que cada restricción está presente, con su
> nombre y con su definición.

---

## 2. Levantar una base para trabajar

El `docker-compose.yml` de la raíz ya trae PostgreSQL 16:

```sh
pnpm db:up                     # postgres + redis
```

También sirve cualquier PostgreSQL 16 local. Requisitos del esquema:

- **PostgreSQL 16** (se usa `DROP DATABASE ... WITH (FORCE)`, de la 13 en
  adelante, y rangos con exclusión);
- la extensión **`btree_gist`** disponible. No es opcional: sin ella no se puede
  crear la exclusión de R-13, que mezcla `=` sobre texto y enum con `&&` sobre
  el rango. Viene en `postgresql-contrib`, y es *trusted* desde la 13, así que
  la crea el dueño de la base sin superusuario;
- la extensión **`pgcrypto`** (la usa la migración `0023` de la 002 para
  calcular los `sha256` del catálogo de documentos, y la usarán los bloques B y
  C de la 004).

---

## 3. Correr los tests del esquema

```sh
DATABASE_URL_TEST=postgresql://mejorar:mejorar@localhost:5432/postgres \
  pnpm --filter @mejorar/api test
```

### Sobre `DATABASE_URL_TEST`

Es **una variable distinta de `DATABASE_URL`, a propósito**: estos tests crean y
borran bases de datos enteras (`mejorar_t_<algo>_<azar>`, una por archivo de
test, descartada al terminar). Reusar la variable del entorno de desarrollo
haría que un `pnpm test` distraído trabaje sobre una base con datos.

Apunta a **cualquier base existente del clúster** —típicamente `postgres`—; las
bases de trabajo se crean desde esa conexión. El rol necesita `CREATEDB`.

### Si la variable no está definida

Los tests que necesitan base quedan **omitidos**, no fallan. Es deliberado: el
job `calidad` del pipeline corre `pnpm -r run test` sin servicio de base, y no
puede romperse por eso. Los tests que sólo leen los archivos de migración corren
siempre, así la suite nunca queda vacía en verde, y se emite un aviso por
`stderr` diciendo qué no se verificó.

**Consecuencia que conviene tener clara:** hoy, en CI, las invariantes de
`modelo-datos.md` §7.1 **no se están verificando**. Para que se verifiquen hace
falta un servicio de PostgreSQL en el job y exportar `DATABASE_URL_TEST`. Eso es
del agente `cicd` y se decide en la compuerta que corresponda; acá sólo queda
declarado el requisito. Un esbozo del servicio, para cuando se resuelva:

```yaml
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready --health-interval 5s
          --health-timeout 5s --health-retries 10
        ports: ['5432:5432']
    env:
      DATABASE_URL_TEST: postgresql://postgres:postgres@localhost:5432/postgres
```

---

## 4. Qué cubren los tests

| Archivo | Qué demuestra |
| --- | --- |
| `tests/migracion.test.ts` | Las migraciones corren limpias contra una base nueva; cada una tiene su `reversion.sql`; aplicar → revertir → volver a aplicar deja un esquema idéntico (`modelo-datos.md` §6.2). El bloque de "migraciones en disco" corre sin base. |
| `tests/tramo-vigencia.test.ts` | **R-13 / CA-29.** Dos tramos vigentes de la misma clave y jurisdicción no pueden solaparse, ni al insertar ni al levantar una baja lógica; los contiguos sí (caso del DNU 70/2023, CA-35); rangos vacíos o sin inicio rechazados; el GiST sirve Q-04 y no hay btree redundante. |
| `tests/ratificacion-y-catalogo.test.ts` | **R-1 / R-2, CA-47 y CA-58.** No hay "ratificado" sin quién ratificó, y no existe secuencia de SQL que meta un tramo sin ratificar en un catálogo apto para producción: ni de frente, ni mintiendo en las réplicas, ni levantando la bandera después. |
| `tests/clasificacion-sensibilidad.test.ts` | **Regla 5 del mandato y R-20.** Toda columna de `motor` está clasificada PUB / INT / PERS / PATR en un `COMMENT`; ninguna se llama como un dato identificatorio del deudor (CA-60, C-10). |
| `tests/acceso-cuenta-y-mfa.test.ts` | **002: R-002-01, R-002-02, R-002-10, R-002-16, R-002-20.** Una cuenta de administrador o de abogado operativa sin segundo factor no es representable; el MFA del administrador no se puede apagar **por ninguna de las tres vías** (desactivar el secreto, conceder el permiso por ajuste, degradar el rol); la lápida está verdaderamente vacía; cuatro ojos en la restitución. |
| `tests/acceso-verificacion-profesional.test.ts` | **002: R-002-08, R-002-09, R-002-18, R-002-19.** No hay "verificado" sin vencimiento ni sin evidencia; dos cuentas pueden *declarar* la misma matrícula pero sólo una puede estar verificada; la matrícula aprobada no se autoedita. Y que **no existe ninguna columna con el estado de la verificación** (D-2). |
| `tests/acceso-administradores-y-bitacora.test.ts` | **002: R-002-03, R-002-04, R-002-05, R-002-11, R-002-12, R-002-22.** Los cuatro disparadores diferidos, forzados con `SET CONSTRAINTS ALL IMMEDIATE`; no se puede borrar una cuenta con eventos; la bitácora no se edita; el particionado mensual. |
| `tests/acceso-aceptacion-y-retencion.test.ts` | **002: R-002-06, R-002-07, R-002-13, R-002-14, R-002-15, C-002-01.** No hay columna booleana de aceptación en ningún lado; los términos no pueden arrastrar finalidades de la 003; el canje de refresco y de enlace es atómico; no se puede registrar una purga bajo un plazo que nadie determinó. |
| `tests/acceso-clasificacion-y-aislamiento.test.ts` | **002: §4.1, §4.2, §4.4, §7.4.** Cada columna clasificada; nada de domicilio, teléfono ni DNI; correo y nombre nunca en claro; **ningún rol salvo `rol_acceso` lee las columnas secretas**; y el aislamiento se ejerce de verdad con `SET ROLE`. |
| `tests/seed-acceso.test.ts` | **002 §6.5.** Corre el seed **dos veces** contra una base real: que la transacción cierre ya demuestra los cuatro disparadores diferidos, y que la segunda corrida no duplique nada demuestra la idempotencia. |

Cada test de rechazo verifica **qué** restricción rechazó, por nombre, no sólo
que hubo un error. Un rechazo por el motivo equivocado es un test que miente.

### Un hueco conocido, anotado y no arreglado

`tests/ratificacion-y-catalogo.test.ts` tiene un caso marcado `it.fails`:
`ck_tramo_valor_presente_si_cargado` verifica `valor IS NOT NULL`, y en JSONB el
`null` de JSON no es SQL NULL, así que hoy entra un tramo `CARGADO` cuyo valor
es el JSON `null`. El arreglo es una línea (`AND jsonb_typeof("valor") <>
'null'`) en una migración nueva, pero toca una invariante aprobada en G2: se
decide en compuerta, no acá. El `it.fails` está puesto para que, el día que se
corrija, **el test empiece a fallar** y obligue a cerrarlo. Un `skip` se
olvidaría.

---

## 5. Reglas al modificar el esquema

1. Primero `modelo-datos.md`, después el esquema. El documento se aprueba en G2.
2. Nunca `prisma db push`. Migraciones versionadas, siempre (ADR-007).
3. Una migración editada después de aplicarse en cualquier entorno **no se
   edita**: se escribe una nueva.
4. Toda migración lleva su `reversion.sql`. El test lo exige.
5. Todo índice nuevo se justifica con la consulta que lo motiva, documentada en
   `modelo-datos.md` §3. Un índice sin consulta es costo.
6. Toda columna nueva lleva su `COMMENT` con la clasificación de sensibilidad,
   o el test falla.
7. **Una tabla nueva de `acceso` con dueño va a la lista `propias` de la
   migración `0020`**, o nace sin política de fila. El test cuenta cuántas
   tienen RLS: si agregás una y no la ponés ahí, el número deja de coincidir.

---

## 6. Lo que NO está, a propósito (feature 002)

Dos tablas del modelo de datos de la 002 **no se crearon**, y la diferencia
entre los dos casos importa:

| Tabla | Estado | Por qué |
| --- | --- | --- |
| `acceso.IdentificadorFiscal` (A.2) | **Migración escrita, guardada fuera de `migrations/`** en `prisma/migraciones-en-espera/0022_identificador_fiscal/`. No se ejecuta. | Escalamiento **E-002-1**: la condición C-002-04(a) exige declarar la finalidad del CUIT/CUIL o diferir el dato, y la spec v3 dejó abierta esa parte. Falta una decisión sobre un dato que la spec ya pide recolectar. Ver el `LEEME.md` de ese directorio: desbloquearla tiene tres pasos y el segundo es estructural, no un recordatorio. |
| `acceso.DocumentacionDeRestitucion` (E.4) | **No existe, ni escrita.** | Escalamiento **E-002-2**: acá falta decidir *qué dato se recolecta*, que es un problema anterior al modelo. Escribir la tabla sería inventar qué documento pedirle a alguien para probar su identidad. E.3 registra la constancia **del hecho**, nunca el dato. |

Hay un test que afirma que ninguna de las dos existe. Si alguien las crea sin
pasar por compuerta, el pipeline se pone rojo.

### Dos huecos declarados, no escondidos

1. **`acceso.CorreoDeRolProhibido` queda vacía después de las migraciones**, y
   por lo tanto R-002-04 nace inerte. Su clave primaria es un HMAC con
   `k_indice`, que por diseño vive **fuera de la base**; una migración no la
   tiene y no debe tenerla. La siembra `prisma/seed.ts`.
2. **El texto del art. 6 sembrado por la `0023` es un borrador de desarrollo**
   y lo dice en el propio dato (`SIN DETERMINAR — BORRADOR DE DESARROLLO`). El
   inciso b) exige identidad y domicilio del responsable, que dependen de la
   inscripción ante la AAIP (condición C-002-11, abierta). **No es apto para
   una persona real.**

---

## 7. El seed de demostración

```sh
DATABASE_URL=postgresql://mejorar:mejorar@localhost:5432/mejorar pnpm db:seed
```

Idempotente: correrlo dos veces no duplica nada. Crea un cliente con dos
sesiones, un abogado verificado con MFA, un abogado con la revisión vencida
(para que la cola de CA-31 tenga contenido), un administrador nominal con su
designación y su evento de auditoría, y una cuenta nunca confirmada y vieja
para que la purga de CA-28 tenga qué purgar. **Todo generado, nada real.**

Cifra de verdad, con las tres claves de §4.3. En desarrollo las deriva de una
constante para ser reproducible; **fuera de desarrollo se niega a inventarlas**
y exige `MEJORAR_K_ACCESO`, `MEJORAR_K_MFA` y `MEJORAR_K_INDICE`. Una clave por
defecto en producción es peor que no tener cifrado, porque parece que lo hay.
