# ADR-003 — Compilación y consumo de `@mejorar/shared` y `@mejorar/integrations`

| Campo | Valor |
| --- | --- |
| Estado | PROPUESTO |
| Fecha | 2026-09-20 |
| Autor | arquitecto |
| Aprobado por | pendiente — G2, feature 001 |
| Spec de origen | `specs/001-fundaciones/spec.md` (CA-02, CA-03, R-03, R-04) |

## Contexto

`@mejorar/shared` contiene las reglas legales y financieras argentinas. Las
tienen que ejecutar **exactamente iguales** tres consumidores con tres
empaquetadores distintos: la API (NestJS sobre Node, CommonJS, con
decoradores), la web (Next.js, empaquetador propio) y la app móvil (Expo sobre
Metro). Si el cálculo de una quita da distinto en el simulador de la app que en
el acuerdo que emite la API, el defecto es de arquitectura, no de una feature.

`@mejorar/integrations` depende de `shared` y es consumido **sólo** por la API.

Restricción adicional de la constitución (#4 y criterio 2 del mandato del
arquitecto): el dominio no depende de nada. Tiene que poder auditarlo un abogado
o un actuario sin saber de infraestructura.

## Decisión

### 1. Formato y compilación

Ambas librerías se compilan con **`tsc` a CommonJS más declaraciones de tipos**
(`.js`, `.d.ts`, `.js.map`, `.d.ts.map`) en `dist/`. No hay empaquetador
(bundler) intermedio: el compilador de TypeScript es la única herramienta que
las transforma.

Cada paquete declara en su `package.json`:

- `main` → `dist/index.js`, `types` → `dist/index.d.ts`.
- Un campo `exports` con subrutas explícitas por área del dominio, de modo que
  el grafo de importaciones sea legible y restringible.
- `files: ["dist"]`, `sideEffects: false`.

### 2. Orden de compilación: derivado, nunca escrito a mano

Se usan **referencias de proyecto de TypeScript** (`composite: true` +
`references`). `tsc -b` en la raíz compila `shared` → `integrations` →
aplicaciones en el orden que impone el grafo declarado. R-03 deja de ser una
convención que alguien tiene que recordar en un script y pasa a ser una
propiedad del compilador.

Consecuencia directa: el script `build:libs` con el orden escrito a mano se
elimina (ver auditoría en `plan.md` §3).

### 3. Consumo

Los tres consumidores declaran `"@mejorar/shared": "workspace:*"` y consumen
`dist/`. Queda **prohibido**:

- cualquier alias `paths` de TypeScript que apunte al `src/` de otro paquete;
- cualquier importación por ruta relativa que salga del propio paquete
  (`../../packages/...`);
- cualquier importación de subruta no declarada en `exports`.

Las tres prohibiciones se aplican mecánicamente (ADR-009). El motivo no es
estético: un alias a `src/` haría que cada consumidor recompile el dominio con
su propia configuración de TypeScript y sus propias opciones de destino, que es
exactamente la forma en que dos clientes terminan calculando distinto.

En desarrollo, `tsc -b --watch` mantiene `dist/` al día; el README lo documenta
como un paso del arranque.

### 4. Política de dependencias de las librerías

| Paquete | Puede depender de | Nunca depende de |
| --- | --- | --- |
| `@mejorar/shared` | `zod` y nada más | framework, ORM, cliente HTTP, `node:*`, `react`, reloj del sistema tomado implícitamente |
| `@mejorar/integrations` | `@mejorar/shared`, `zod`, `fetch` global de Node 22 | NestJS, Prisma, `react`, acceso a base de datos |

`zod` queda autorizada en el dominio: los esquemas de validación de los valores
de entrada **son** parte del contrato del dominio, es una biblioteca sin
dependencias y sin E/S, y la alternativa —validadores escritos a mano— produce
más código propio que auditar, no menos. Cualquier otra dependencia de runtime
en `shared` requiere un ADR nuevo.

Los adaptadores HTTP usan el `fetch` incorporado de Node 22 con
`AbortSignal.timeout`. No se incorpora un cliente HTTP externo.

**Decisión abierta y marcada:** la aritmética de dinero (punto flotante vs.
decimal exacto) afecta a `shared` y es un riesgo real en cálculos de quita,
intereses y comisiones. **No se decide en 001**: pertenece al plan de la feature
004/005 y su ADR sale del rango 010-019. Hasta que exista ese ADR, `shared` no
incorpora ninguna biblioteca de aritmética y no se implementa ningún cálculo
monetario.

## Alternativas consideradas

| Alternativa | A favor | En contra | Por qué no |
| --- | --- | --- | --- |
| Consumir `src/` directamente vía `paths` de TypeScript | Sin paso de build, recarga instantánea | Cada consumidor transpila el dominio con su propia configuración; Next y Metro necesitan `transpilePackages`; rompe la garantía de "mismo código en los tres clientes" y anula el control de dependencias | Es cómodo y es exactamente el riesgo que este ADR existe para evitar |
| Empaquetar con **tsup/esbuild/rollup** | Salida dual CJS+ESM, más rápido, *tree-shaking* | Una dependencia más en el camino crítico del dominio; el `.d.ts` pasa a generarlo otra herramienta; dificulta explicar qué se ejecuta exactamente | No hay problema que resolver todavía: son librerías chicas de TypeScript puro |
| Salida **ESM pura** | Es el futuro del ecosistema | NestJS con decoradores y buena parte de sus paquetes siguen asentados en CJS; Jest y `jest-expo` complican ESM | CJS es hoy el denominador común de los tres consumidores. Migrar después es aditivo |
| Salida **dual CJS + ESM** | Sirve a todos, mejor *tree-shaking* en web | Duplica la superficie de build y trae el problema de la "doble instancia" del mismo módulo | Complejidad sin beneficio medible con el tamaño actual |
| Publicar las librerías a un **registro privado** y versionarlas | Límite duro entre dominio y aplicaciones | Cada cambio legal exige publicar y bumpear tres consumidores; el derecho argentino cambia por ley y con urgencia | Fricción incompatible con el ritmo del dominio |
| Meter las reglas en la API y exponerlas por HTTP | Una sola implementación viva | La app móvil pierde el simulador sin conexión; la web depende de la red para validar un formulario | Contradice el objetivo de que los tres clientes compartan la regla |

## Consecuencias

**Positivas**

- La misma línea de JavaScript compilada corre en la API, en la web y en la app.
- El orden de compilación es una propiedad verificable del grafo, no una
  convención.
- `dist/` con *source maps* y *declaration maps* permite depurar y navegar al
  código fuente original desde cualquier consumidor.

**Negativas**

- Hay un paso de build antes de poder usar las librerías; quien lo olvide ve
  errores de "módulo no encontrado". Se mitiga con `tsc -b --watch` documentado
  y con un mensaje explícito en el README (CA-11).
- Salida CJS: el empaquetado de la web no puede hacer *tree-shaking* fino sobre
  `shared`. Irrelevante con el tamaño actual; se revisa si el paquete de la web
  supera el presupuesto de tamaño fijado en `plan.md` §6.
- Metro (Expo) debe resolver paquetes del workspace con enlaces simbólicos;
  requiere configuración explícita de `metro.config.js` (tarea asignada a
  `dev-mobile`, riesgo R-02 del plan).

**Qué cierra**

- Uso de decoradores, `reflect-metadata` o cualquier construcción específica de
  NestJS dentro de `shared` e `integrations`.

## Cómo se revierte

- **Pasar a un empaquetador (tsup) o a salida dual:** costo bajo y local. Se
  cambia el script `build` de dos paquetes y el campo `exports`; los
  consumidores no se enteran. Estimado: medio día.
- **Pasar a ESM puro:** costo medio-alto, porque arrastra a la API y a los
  runners de test. Estimado: 2-3 días. Se hará cuando NestJS y `jest-expo` lo
  soporten sin artificios.
- **Volver a consumir `src/` por alias:** trivial de hacer y difícil de
  deshacer, porque una vez que la disciplina se relaja vuelven las
  importaciones profundas. Si se hace, exige ADR de reemplazo.
