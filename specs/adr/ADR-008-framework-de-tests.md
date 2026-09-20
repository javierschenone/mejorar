# ADR-008 — Framework de tests y estrategia de verificación

| Campo | Valor |
| --- | --- |
| Estado | PROPUESTO |
| Fecha | 2026-09-20 |
| Autor | arquitecto |
| Aprobado por | pendiente — G2, feature 001 |
| Spec de origen | `specs/001-fundaciones/spec.md` (CA-04, CA-08, CA-10, §10 "Paquetes sin test: 0") |

## Contexto

La constitución #14 dice que "funciona" significa que hay un test que lo
demuestra. El dominio legal y financiero exige casos límite, no camino feliz.
`CLAUDE.md` §5 condiciona el paso por G5 a que cada criterio de aceptación tenga
test.

La restricción técnica es que los cinco paquetes no corren en el mismo lugar:

| Paquete | Qué hay que poder ejecutar | Qué lo complica |
| --- | --- | --- |
| `packages/shared` | TypeScript puro sobre Node | nada; es el caso fácil |
| `packages/integrations` | Puertos, mocks deterministas, adaptadores HTTP | hay que interceptar `fetch` y congelar el reloj |
| `apps/api` | NestJS con inyección de dependencias | los decoradores necesitan `emitDecoratorMetadata`, que **esbuild no implementa** |
| `apps/web` | React 19 / Next App Router | DOM simulado, y los componentes de servidor no se testean como los de cliente |
| `apps/mobile` | React Native sobre Expo | el preset `jest-expo` no tiene reemplazo: Metro, los módulos nativos y las transformaciones de RN se resuelven ahí |

Las decisiones ya tomadas acotan el terreno: ADR-003 fija salida CJS (lo que
elimina el principal dolor histórico de Jest), ADR-004 anticipa que los
decoradores exigen una transformación especial en el runner, ADR-006 anticipa un
segundo runner para móvil, y ADR-002 ya cuenta con `@swc/core` entre las
dependencias nativas del proyecto.

## Decisión

### 1. Dos runners, y sólo dos, con motivo distinto cada uno

| Alcance | Runner | Motivo |
| --- | --- | --- |
| `packages/shared`, `packages/integrations`, `apps/api`, `apps/web` | **Vitest 3** | Un solo runner, una sola sintaxis, una sola configuración de cobertura |
| `apps/mobile` | **Jest con el preset `jest-expo`** | No es una elección: es la única cadena soportada por Expo/React Native |

No se unifica a la fuerza en Jest para tener "un solo runner": el resultado
serían cinco configuraciones de Jest distintas, una por preset, que es
exactamente la fragmentación que la unificación pretendía evitar, con peor
velocidad. No se unifica a la fuerza en Vitest tampoco: forzar React Native
sobre Vitest es pelearse con Metro en cada actualización de SDK, y ese pleito lo
paga `dev-mobile` cada tres meses.

La sintaxis de aserciones y de dobles es compatible entre ambos (`describe`,
`it`, `expect`), de modo que el costo del segundo runner es de configuración,
no de aprendizaje.

### 2. Un solo comando, resultado por paquete

`pnpm test` en la raíz corre la suite completa y reporta **por paquete**
(CA-04). Los cuatro paquetes de Vitest se declaran como *projects* de un único
espacio de trabajo de Vitest en la raíz; `apps/mobile` se ejecuta como un paso
más del mismo comando. Un paquete que tenga código y no reporte al menos un test
hace fallar el comando: la métrica "paquetes sin test = 0" se verifica sola, no
se audita a mano.

### 3. Configuración por paquete

- **`apps/api`**: Vitest con `unplugin-swc`. Es la pieza que resuelve lo que
  ADR-004 dejó anotado: SWC sí implementa `emitDecoratorMetadata`, esbuild no, y
  sin eso la inyección de dependencias de NestJS no resuelve los tipos del
  constructor. Los tests de módulo usan `Test.createTestingModule` de
  `@nestjs/testing`, con los puertos de `@mejorar/integrations` sustituidos por
  sus mocks deterministas.
- **`apps/web`**: Vitest con entorno `jsdom` y Testing Library. Se testean
  componentes de cliente, hooks y utilidades. Los componentes de servidor y el
  ruteo **no** se testean unitariamente: se cubren por el nivel de extremo a
  extremo, que es donde son observables.
- **`packages/shared`**: entorno `node`, sin dobles de ningún tipo salvo el
  reloj. Regla dura: **ninguna función del dominio lee la hora del sistema por
  su cuenta**; la fecha de referencia es siempre un parámetro. Un test del
  motor de prescripción que dependa del día en que se ejecuta es un test roto
  que todavía no falló.
- **`packages/integrations`**: cada puerto tiene un test de contrato que se
  ejecuta contra el mock, y ese mismo test de contrato queda disponible para
  ejecutarse contra el adaptador HTTP cuando haya credenciales de homologación
  (fuera de 001). El adaptador HTTP se prueba contra respuestas grabadas, nunca
  contra el organismo real.
- **`apps/mobile`**: `jest-expo` más Testing Library de React Native. En 001 el
  alcance es un test que demuestre que la app resuelve e importa
  `@mejorar/shared` desde el workspace, que es el riesgo técnico real
  (ADR-006 punto 4).

### 4. Tests que tocan la base

Los tests de `apps/api` que necesitan persistencia corren contra **PostgreSQL
real**, en la base `mejorar_test` del mismo contenedor de desarrollo (ADR-007
§5). No se sustituye el motor. Cada test se aísla en una transacción que se
revierte al terminar; el esquema se prepara una vez por corrida con
`prisma migrate deploy`. Si Docker no está disponible, esos tests se marcan como
omitidos con un mensaje explícito y el resto de la suite corre igual: la spec
(§7) exige un camino sin Docker, y una suite que no arranca sin contenedores
convierte un problema de entorno en un bloqueo total.

### 5. Extremo a extremo: Playwright, con alcance mínimo y creciente

Se incorpora **Playwright** en `tests/e2e/` en la raíz, propiedad del `tester`.
Es la única dependencia verdaderamente nueva de este ADR y se justifica así: la
spec 001 tiene dos criterios —CA-10 (los tres perfiles de demostración ven lo
suyo y no lo ajeno) y CA-11 (una persona nueva llega al sistema corriendo)— que
no son verificables por ningún test unitario. Sin Playwright, la única
verificación posible es que alguien lo pruebe a mano y lo escriba en un informe,
lo que contradice la constitución #14 para el criterio más visible de la
feature.

Alcance en 001: **un solo escenario** —ingresar con cada usuario de
demostración, ver el portal propio y recibir rechazo en los otros dos— más la
verificación de accesibilidad descrita abajo. Crece feature por feature, no de
entrada.

### 6. Accesibilidad como test, no como revisión

La constitución #13 exige WCAG 2.2 AA. Se integra **`axe-core`** al recorrido de
Playwright: cada ruta que el escenario visita se analiza automáticamente y el
pipeline falla ante cualquier violación **crítica o seria**. En 001 son cuatro
rutas (ingreso y los tres portales, todavía cáscaras). La accesibilidad deja de
ser una revisión que alguien hace al final y pasa a ser una condición del
pipeline desde la primera pantalla que existe.

### 7. Convenciones

| Qué | Dónde | Patrón |
| --- | --- | --- |
| Unitario y de integración | junto al código que prueba | `<nombre>.test.ts` |
| Extremo a extremo | `tests/e2e/` | `<escenario>.spec.ts` |
| Datos de prueba | por paquete, en `tests/fixtures/` | generados, nunca reales (R-05) |

Los tests se escriben en español rioplatense (`describe('prescripción
liberatoria')`, `it('devuelve INDETERMINABLE cuando falta la fecha de mora')`),
igual que el resto del dominio.

Umbrales de cobertura, exigibles en CI, con los números y el momento en que
empiezan a regir en `plan.md` §6. La cobertura se mide con `v8` en Vitest; no se
persigue el 100%: se persigue que las ramas del dominio legal estén todas
ejercitadas, que es otra cosa.

## Alternativas consideradas

| Alternativa | A favor | En contra | Por qué no |
| --- | --- | --- | --- |
| **Jest en los cinco paquetes** | Un solo nombre; es el camino por defecto tanto de NestJS como de Expo; con CJS (ADR-003) desaparece el dolor de ESM | Cinco presets distintos igual (`@swc/jest`, `next/jest`, `jest-expo`, nodo puro): la unidad es nominal. Notablemente más lento, y el tiempo de la suite es un objetivo numérico de la spec | La supuesta unificación no existe en la práctica, y se paga con velocidad |
| **Vitest en los cinco paquetes** | Unificación real | React Native sobre Vitest exige emular Metro y remendar módulos nativos; se rompe con cada SDK de Expo, y lo paga el paquete con menos capacidad de absorber mantenimiento | El riesgo se concentra justo en la capa más frágil |
| **`node:test` (runner incorporado de Node)** | Cero dependencias, biblioteca estándar primero, alineado con "aburrido gana" | Para TypeScript exige o compilar antes o el borrado de tipos experimental de Node 22; sin cobertura ni dobles al nivel que el dominio necesita; sin ecosistema de Testing Library | Es la opción que más me tienta para `packages/shared` y la descarto por una razón concreta: partiría la suite en tres runners para ahorrar una dependencia que igual entra por la web y por la API |
| **Testcontainers** en lugar de la base del `docker-compose` | Aislamiento perfecto, sin estado compartido entre corridas | Levanta y tira contenedores por suite: más lento localmente y una dependencia más en el camino crítico | La base `mejorar_test` del contenedor que ya está levantado alcanza. Es la salida prevista si el estado compartido da problemas en CI |
| **Cypress** para extremo a extremo | Muy buena experiencia de depuración | Un solo navegador por corrida, más lento, peor integración con axe y con CI | Playwright cubre los tres motores y trae generación de escenarios |
| **Sin extremo a extremo en 001**, verificación manual de CA-10 documentada en `qa.md` | Una dependencia menos, coherente con YAGNI | El criterio más visible de la feature quedaría sin prueba automática, y el andamiaje de accesibilidad entraría tarde, cuando ya haya pantallas que arreglar | Contradice la constitución #14 justo donde más se nota |
| **Revisión manual de accesibilidad al cierre de cada feature** | Detecta lo que ninguna herramienta automática detecta | Llega tarde y compite con la fecha de entrega | No se descarta: se **suma**. El análisis automático es el piso, no el techo; la revisión manual es de `ux-expert` a partir de la 002 |

## Consecuencias

**Positivas**

- Una sola forma de escribir un test para el 80% del código, y el 20% restante
  (móvil) usa la única cadena que su plataforma soporta.
- CA-04 y la métrica "paquetes sin test = 0" se verifican por máquina.
- Probar contra PostgreSQL real elimina la clase de defectos que aparece cuando
  el test corre sobre un motor distinto al de producción.
- La accesibilidad entra al pipeline con la primera pantalla, no con la última.

**Negativas**

- Dos runners significan dos configuraciones, dos formas de invocar la
  depuración y dos actualizaciones. Es el costo aceptado de tener una app
  nativa.
- `unplugin-swc` es una pieza de pegamento más en la API, y es el punto que más
  probablemente se rompa en una actualización mayor de Vitest o de NestJS
  (riesgo R-05 del plan).
- Playwright descarga navegadores: la primera instalación es pesada y hay que
  cachearla en CI para no comerse el presupuesto de 10 minutos.
- Los tests contra base real son más lentos que los dobles en memoria y exigen
  disciplina de aislamiento transaccional.

**Qué cierra**

- Ejecutar la suite completa sin Node ni Docker.
- Usar utilidades específicas de Jest (por ejemplo `jest.mock` con elevación de
  ámbito) en los cuatro paquetes de Vitest.

## Cómo se revierte

- **Cambiar Vitest por Jest en uno o en los cuatro paquetes:** costo bajo. La
  sintaxis de los tests es compatible en lo esencial; se reemplaza la
  configuración y los dobles (`vi.fn` → `jest.fn`), con búsqueda y reemplazo.
  Estimado: un día por paquete, decreciente si se hace temprano.
- **Unificar móvil en Vitest el día que Expo lo soporte de fábrica:** aditivo, se
  borra una configuración. Medio día.
- **Sacar Playwright:** trivial, se borra una carpeta y un paso del pipeline. Lo
  que se pierde es la verificación automática de CA-10 y de accesibilidad, que
  habría que reemplazar por revisión manual registrada en `qa.md`.
- **Pasar a Testcontainers:** aditivo y local a la configuración de tests de la
  API. Un día.
