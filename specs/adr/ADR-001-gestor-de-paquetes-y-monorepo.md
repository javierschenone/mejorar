# ADR-001 — Gestor de paquetes y estrategia de monorepo

| Campo | Valor |
| --- | --- |
| Estado | PROPUESTO |
| Fecha | 2026-09-20 |
| Autor | arquitecto |
| Aprobado por | pendiente — G2, feature 001 |
| Spec de origen | `specs/001-fundaciones/spec.md` (CA-01, CA-02, CA-03, R-03, R-04) |

## Contexto

Cinco unidades de código (`shared`, `integrations`, `api`, `web`, `mobile`) que
comparten tipos y reglas de negocio, ocho agentes desarrolladores con alcances de
escritura disjuntos, y un requisito de la constitución (#4) de que la separación
de roles sea **mecánica**. Además, la spec exige que las librerías compartidas se
compilen antes que las aplicaciones (R-03) y que cada paquete declare sus
dependencias permitidas (R-04).

El equipo es chico. Todo lo que haya que mantener a mano se va a desincronizar.

## Decisión

El repositorio es un **monorepo único con pnpm workspaces** (`packages/*` y
`apps/*`), sin orquestador de build adicional. El orden de compilación no se
escribe a mano: lo deriva `pnpm -r` por topología de dependencias y `tsc -b` por
referencias de proyecto (ADR-003). Las versiones de las dependencias compartidas
entre paquetes se declaran una sola vez en el `catalog:` de
`pnpm-workspace.yaml`.

Se ratifica `pnpm-workspace.yaml` tal como está y se ratifica `pnpm@10.33.0`
fijado en `packageManager`.

Corolarios obligatorios:

1. **Enlazado aislado.** Se usa el `node-linker` por defecto de pnpm
   (`isolated`). Queda **prohibido** `shamefully-hoist`, `public-hoist-pattern`
   amplio y cualquier opción que haga visible una dependencia no declarada. Esa
   propiedad es el primer nivel de aplicación de CA-07 (ver ADR-009).
2. **Cada paquete declara todo lo que importa**, incluidas las dependencias
   internas con `workspace:*`.
3. **Instalación sin advertencias** (CA-01). En pnpm 10 los scripts de ciclo de
   vida están bloqueados por defecto: la lista blanca
   (`onlyBuiltDependencies`) se declara explícitamente y se mantiene mínima.
4. Un único `pnpm-lock.yaml` en la raíz, versionado, y CI corre con
   `--frozen-lockfile`.

## Alternativas consideradas

| Alternativa | A favor | En contra | Por qué no |
| --- | --- | --- | --- |
| pnpm workspaces + **Turborepo** | Caché de tareas, grafo explícito, pipelines paralelos | Una dependencia y un modelo mental más; la caché remota exige servicio; el beneficio aparece con decenas de paquetes | Cinco paquetes y un pipeline objetivo de 10 minutos no justifican todavía la caché. Agregarlo después es aditivo y barato (ver "Cómo se revierte") |
| **Nx** | Generadores, grafo, límites de módulos con `@nx/enforce-module-boundaries` | Toma el control del repositorio: configuración propia, ejecutores propios, migraciones propias. Alto costo de salida | Viola "aburrido gana" y la reversibilidad. Los límites de módulos se logran con mecanismos nativos (ADR-009) sin ceder el control del build |
| **npm workspaces** | Viene con Node, cero instalación | Hoisting plano por defecto: cualquier paquete puede importar dependencias de otro sin declararlas. Rompe CA-07 de raíz | El aislamiento de pnpm es un requisito de arquitectura, no una preferencia |
| **Yarn Berry (PnP)** | Aislamiento estricto real, instalaciones rápidas | PnP todavía rompe con React Native/Metro y con herramientas que asumen `node_modules` | Riesgo alto en la capa móvil, que es la más frágil |
| **Polirepo** (un repo por paquete) | Límites de escritura triviales de aplicar | Versionado y publicación de `shared` en cada cambio; cambios atómicos imposibles; el dominio legal cambia por ley y arrastra a los tres clientes a la vez | El costo de coordinación supera cualquier beneficio para un equipo chico |

## Consecuencias

**Positivas**

- Un cambio en una regla legal y sus tres consumidores entran en un solo commit
  y en un solo PR revisable.
- El grafo de dependencias entre paquetes es el mismo objeto que usa el
  instalador, el compilador y el guardián de alcances: no hay tres verdades.
- Sin caché de tareas, el tiempo del pipeline es honesto y medible desde el día
  uno; si se degrada, se sabrá por qué.

**Negativas**

- Sin caché, el pipeline recompila todo en cada corrida. Aceptable mientras se
  mantenga bajo el objetivo de 10 minutos (spec §10); si se supera, dispara la
  reversión parcial descrita abajo.
- `catalog:` es específico de pnpm: migrar a otro gestor exige expandir las
  versiones.

**Qué cierra**

- Publicar `@mejorar/shared` a un registro externo deja de ser el camino
  principal. Si en el futuro un tercero necesita consumir el dominio, se agrega
  publicación sin cambiar la estructura interna.

## Cómo se revierte

- **Agregar Turborepo o similar:** aditivo. Se instala, se declara el pipeline y
  los scripts raíz pasan a delegarle. No toca ningún paquete. Costo estimado:
  medio día de `cicd`. Es la salida prevista si el pipeline supera los 10
  minutos.
- **Cambiar de gestor de paquetes:** costo alto y transversal (lockfile,
  `workspace:*`, `catalog:`, CI, Dockerfiles). Estimado: 2-3 días. No se prevé.
- **Pasar a polirepo:** costo muy alto. Se considera irreversible en la práctica
  para el horizonte de este proyecto.
