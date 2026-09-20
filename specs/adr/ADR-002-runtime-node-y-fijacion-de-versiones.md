# ADR-002 — Runtime Node y fijación de versiones del entorno

| Campo | Valor |
| --- | --- |
| Estado | PROPUESTO |
| Fecha | 2026-09-20 |
| Autor | arquitecto |
| Aprobado por | pendiente — G2, feature 001 |
| Spec de origen | `specs/001-fundaciones/spec.md` (CA-01, §7 primer caso límite) |

## Contexto

La spec aprobada fija Node 22 en CA-01. El repositorio ya tiene `.nvmrc` con
`22`, pero `package.json` declara `engines.node: ">=20.11"`. Son dos
afirmaciones distintas sobre el mismo hecho, y la que gana en la práctica —
`engines`, que es la que puede verificar el instalador— es la que **contradice
la spec**.

Además, la spec exige que una versión distinta a la declarada se advierta con
claridad en lugar de fallar de forma críptica (§7), y `cicd` exige que lo que
corre en CI sea lo mismo que corre local.

## Decisión

El runtime es **Node 22 LTS**, declarado en un único lugar por cada cosa que hay
que declarar:

| Qué | Dónde | Valor |
| --- | --- | --- |
| Versión de Node para desarrolladores y CI | `.nvmrc` | `22` |
| Rango admitido, verificado por el instalador | `package.json` → `engines.node` | `>=22.12.0 <23` |
| Gestor de paquetes | `package.json` → `packageManager` | `pnpm@10.33.0` |
| Rango admitido de pnpm | `package.json` → `engines.pnpm` | `>=10.33.0 <11` |
| Compilador | dependencia de desarrollo raíz, versión exacta | `typescript` `5.9.2` |

La verificación es **dura, no informativa**: `.npmrc` declara
`engine-strict=true`, de modo que instalar con un Node fuera del rango aborta
con el mensaje del propio pnpm, que nombra la versión esperada y la encontrada.
CI obtiene la versión desde `.nvmrc` y nunca la escribe en el workflow.

El parche de Node flota dentro de la línea 22 (`>=22.12.0 <23`) para que las
actualizaciones de seguridad no requieran un commit. Las dependencias de npm no
flotan: el `pnpm-lock.yaml` versionado y `--frozen-lockfile` en CI las clavan.

**Revisión agendada:** Node 22 termina su mantenimiento en abril de 2027. Antes
de finalizar el primer trimestre de 2027 se abre un ADR de reemplazo para migrar
a la LTS vigente. Queda registrado acá para que no se descubra por un aviso de
fin de soporte.

## Alternativas consideradas

| Alternativa | A favor | En contra | Por qué no |
| --- | --- | --- | --- |
| Conservar `>=20.11` | No toca nada | Contradice CA-01, que es texto aprobado en G1; permite que dos desarrolladores usen runtimes distintos y que un fallo aparezca sólo en uno | Una spec aprobada no se contradice en silencio |
| Saltar directo a **Node 24 LTS** | Más recorrido de soporte; evita la migración de 2027 | Contradice CA-01; el ecosistema de Expo/React Native suele ir un paso atrás en runtimes; obliga a volver a G1 por un cambio de bajo valor hoy | Se prefiere respetar la spec aprobada y agendar la migración con un ADR propio |
| Versión de parche exacta en `.nvmrc` (p. ej. `22.12.3`) | Reproducibilidad total | Cada parche de seguridad de Node es un commit y un PR; en la práctica se posterga y el repo queda con un runtime vulnerable | El riesgo de divergencia por parche es menor que el de quedarse sin parchear |
| No usar `engine-strict` | Menos fricción para quien quiere probar rápido | Convierte el requisito en una sugerencia; el error aparece más tarde y peor | §7 de la spec pide fallo claro y temprano |
| **Bun** o **Deno** como runtime | Arranque y tests más rápidos, menos herramientas | NestJS, Prisma y el ecosistema React Native están probados sobre Node; los bordes son exactamente donde este producto no puede permitirse sorpresas | "Aburrido gana" |

## Consecuencias

**Positivas**

- Una sola respuesta a "¿qué versión uso?", verificable por máquina.
- El caso límite de §7 queda cubierto por el propio gestor de paquetes, sin
  scripts caseros.

**Negativas**

- `engine-strict=true` puede frenar a alguien con un Node viejo instalado. Es el
  comportamiento buscado; el README documenta cómo instalar la versión correcta
  en un paso.
- La línea 22 obliga a una migración planificada en 2027.

**Qué cierra**

- Uso de APIs de Node posteriores a la 22 hasta que se haga esa migración.

## Cómo se revierte

Cambiar de línea de Node es de costo bajo: se editan `.nvmrc` y `engines`, se
reinstala y se corre el pipeline completo. El riesgo real no está en el número
sino en las dependencias nativas (`argon2`, el motor de Prisma, `@swc/core`),
que hay que recompilar y verificar. Estimado: medio día de `cicd` más una
corrida completa de `tester`. Camino de vuelta: revertir el commit; el lockfile
y el `.nvmrc` vuelven juntos.
