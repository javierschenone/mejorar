# `apps/api/prisma` — esquema, migraciones y sus tests

Feature 004 — Motor de reglas legales argentinas, tarea T-03.
Fuente de verdad del modelo: `specs/004-motor-reglas-legales/modelo-datos.md`
(aprobado en G2). **Este directorio transcribe ese documento; no decide nada.**

Alcance de hoy: **Bloque A** (catálogo normativo), A.1 a A.6. Los bloques A.7 a
A.9, B, C y D los agregan las tareas T-06 y T-09.

---

## 1. Qué hay acá

| Ruta | Qué es |
| --- | --- |
| `schema.prisma` | Tablas, columnas y relaciones. Lo que el DSL de Prisma sabe expresar. |
| `migrations/**/migration.sql` | La migración que se aplica. Primera mitad generada por `prisma migrate diff`; segunda mitad —desde "SQL CRUDO"— escrita a mano. |
| `migrations/**/reversion.sql` | La vuelta atrás. **Prisma no la ejecuta nunca** (ADR-007 §3): está versionada para que la reversión sea una decisión escrita y revisada, y para que el test la pueda verificar. |
| `tests/**` | Los tests del esquema. Ver §3. |

### Lo que Prisma no expresa y vive en el SQL crudo

Es la consecuencia práctica de `modelo-datos.md` §6.4 y hay que tenerla presente
antes de tocar nada:

- el tipo `daterange` de `TramoParametro.vigencia` (en el DSL, `Unsupported`);
- la restricción de exclusión GiST que prohíbe vigencias solapadas (R-13);
- todas las restricciones `CHECK`;
- los índices **parciales** de Q-04 y Q-09 (Prisma los declara totales y la
  migración los reemplaza);
- la clasificación de sensibilidad de cada columna, como `COMMENT`.

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
- la extensión **`pgcrypto`** (la usan los bloques B y C, todavía no escritos).

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
