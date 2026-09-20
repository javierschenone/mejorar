# ADR-016 — El motor es una librería pura sin efectos, con todo el contexto inyectado

| Campo | Valor |
| --- | --- |
| Estado | PROPUESTO |
| Fecha | 2026-09-20 |
| Autor | arquitecto |
| Aprobado por | pendiente — G2, feature 004 |
| Spec de origen | `specs/004-motor-reglas-legales/spec.md` v3 (CA-27, CA-31, R-04, §8 "fuera de alcance") |
| Contrato | `specs/contratos/motor-reglas-legales.ts` §9, §13, §14 |
| Relación | Se apoya en ADR-003 (compilación y consumo de `@mejorar/shared`) |

## Contexto

La spec dice, en su §8, que el motor es una librería pura: la persistencia, la
obtención de datos y la interfaz son de la feature 007. Pero "librería pura" se
dice fácil y se erosiona en la tercera semana, cuando alguien necesita el
salario mínimo y le resulta cómodo consultarlo desde adentro.

Tres exigencias lo vuelven no negociable:

- **CA-31**: la misma entrada con la misma fecha de evaluación da el mismo
  resultado. Si el motor lee el reloj, no hay forma de reproducir en 2030 lo que
  dijo en 2026, y eso es exactamente lo que un abogado va a necesitar si hay un
  reclamo.
- **Criterio 2 del mandato del arquitecto**: el dominio no depende de nada,
  porque es la pieza que un abogado o un actuario tiene que poder auditar. Un
  módulo que abre una conexión a la base no lo puede auditar nadie que no sea
  desarrollador.
- **ADR-003**: el mismo código compilado corre en la API, en la web y en la app
  móvil. Cualquier E/S lo ata a un entorno y rompe esa propiedad.

## Decisión

`evaluar` es una **función pura y total**: mismos argumentos, mismo resultado,
sin efectos observables.

### 1. El motor no accede a nada

No lee el reloj, ni el entorno (`process.env`), ni la red, ni el disco, ni una
base de datos. No tiene estado global ni memorias entre llamadas. No registra
nada: la bitácora es de quien llama.

Todo lo que necesita entra por `ContextoEvaluacion`: `entorno`,
`fechaDeEvaluacion`, `catalogo`, `valoresReferencia`, `plantillas`. Los cinco
son datos, no servicios: ninguno tiene métodos.

### 2. El tiempo es una entrada, con dos tipos que no se confunden

`FechaDeEvaluacion` (cuándo se corre) y `FechaDelHecho` (contra qué fecha se
resuelven los parámetros) son marcas nominales distintas sobre `FechaCivil`.
Pasar una donde va la otra no compila. Es la contracara de tipos de CA-29 y
CA-18 (defecto D-24).

`FechaCivil` es `AAAA-MM-DD`, sin hora y sin zona horaria. No se usa `Date`: los
plazos legales se cuentan en días civiles y `Date` arrastra zona horaria,
horario de verano y el reloj del proceso, que son tres fuentes de
indeterminismo. La aritmética de fechas es propia, sobre días civiles, y por lo
tanto verificable.

### 3. El motor no lanza, no muta y no sale por otro lado

Devuelve `Resultado` (ADR-012). Toda su entrada es `readonly` en profundidad: no
muta lo que le pasan. No hay `async` en ninguna firma del motor, y esa ausencia
es la prueba estructural de que no hay E/S.

### 4. Ubicación y dependencias

Vive en `packages/shared/src/motor-legal/**`, lo implementa `dev-dominio`, y
hereda de ADR-003 la política de dependencias: `zod` y nada más. Sin NestJS, sin
Prisma, sin cliente HTTP, sin `node:*`.

### 5. Los puertos hacia afuera se **declaran** acá y se implementan afuera

`PuertoReproduccion` (obtener el catálogo, la tabla de valores y el catálogo de
plantillas de una versión pasada) es una interfaz `async` **que el motor no
consume**: la consume la infraestructura para poder alimentarlo. Está declarada
en el contrato porque la frontera tiene que estar escrita y versionada, no
porque el dominio la use.

Lo mismo con `HallazgoRevisado`, `ConfirmacionProfesional` y `BaseDeComision`:
tipos que el motor declara y que produce la feature 007.

### 6. Consecuencia buscada: el sistema corre sin una sola credencial

Con un catálogo de prueba, una tabla de valores de referencia de prueba y el
catálogo de plantillas, el motor completo se ejecuta y se testea sin base de
datos, sin red y sin credenciales de ningún organismo. Es el criterio 3 del
mandato del arquitecto y CA-01/CA-11 de la spec 001.

## Alternativas consideradas

| Alternativa | A favor | En contra | Por qué no |
| --- | --- | --- | --- |
| Motor como servicio de NestJS con repositorios inyectados | Idiomático en el backend; el llamador no arma el contexto | Ata el dominio al framework; obliga a levantar infraestructura para testear una regla legal; la app móvil no lo puede usar | Contradice ADR-003 y el criterio "el dominio no depende de nada" |
| Motor que resuelve el catálogo por sí mismo con un puerto `async` | Menos plomería en cada llamada | Vuelve asíncrono todo el dominio; introduce E/S y con ella indeterminismo y latencia variable; hay que simular el puerto en cada test | La plomería la paga el borde una vez; el determinismo se paga en cada evaluación |
| Reloj inyectado como servicio (`Clock`) en vez de fecha por parámetro | Patrón conocido, permite avanzar el tiempo en tests | Sigue siendo un servicio, y el motor podría llamarlo dos veces en una evaluación y obtener dos valores | La fecha como valor es más simple y más fuerte. R-04 lo pide así |
| Usar `Date` con UTC forzado | Nativo, aritmética disponible | El plazo de prescripción se cuenta en días civiles argentinos; UTC introduce corrimientos de un día en los bordes, y un día decide si una deuda prescribió | Un defecto de un día acá es un hallazgo falso |
| Motor detrás de HTTP, consumido por los tres clientes | Una sola instancia viva, actualización inmediata | La app móvil pierde el funcionamiento sin conexión; la web depende de la red para validar; ADR-003 ya descartó este camino | Decisión ya tomada en 001 |
| Permitir logging estructurado desde el motor | Diagnóstico más fácil | Un log del motor contendría datos patrimoniales y quedaría fuera de la bitácora auditada de 007 | La observabilidad va en el borde, donde hay control de acceso |

## Consecuencias

**Positivas**

- CA-31 es una propiedad estructural: sin fuentes de indeterminismo, no hace
  falta disciplina para ser determinista.
- Los tests del dominio son puros y rápidos: entrada, contexto, aserción. Los 64
  criterios de aceptación se cubren sin infraestructura.
- Un abogado puede leer el código de un análisis sin saber de NestJS ni de
  Prisma.
- El mismo resultado en el teléfono y en el servidor.

**Negativas**

- El llamador tiene que armar el `ContextoEvaluacion` completo en cada
  evaluación: cargar el catálogo, la tabla de valores y las plantillas. Se
  resuelve con una memoria por versión **en la capa de aplicación**, no en el
  motor (obligación de frontera F-10 del plan).
- El catálogo completo en memoria por evaluación tiene un costo. Medido contra
  el presupuesto de §6 del plan.
- Reproducir un resultado pasado exige que la infraestructura haya guardado la
  versión del catálogo: sin `PuertoReproduccion` implementado, CA-27 y CA-31 no
  son verificables sobre el pasado. Es una dependencia dura hacia el
  `database-engineer` (F-03).

**Qué cierra**

- `async` en la API pública del motor.
- Decoradores, `reflect-metadata` y cualquier construcción de NestJS dentro de
  `motor-legal`.
- `new Date()` sin argumentos en todo `packages/shared`, verificable con una
  regla de lint (ADR-009 de la feature 001).

## Cómo se revierte

- **Envolver el motor en un servicio de NestJS que arme el contexto**: es lo
  esperado y es aditivo. No revierte nada.
- **Volverlo asíncrono con puertos**: costo alto (todas las firmas, todos los
  tests) y pérdida de determinismo. Exigiría ADR de reemplazo.
- **Agregar una memoria interna al motor**: prohibido, rompe CA-31. Si el
  rendimiento lo exigiera, la memoria va en la capa de aplicación, indexada por
  versión de catálogo, que es inmutable y por lo tanto segura de memorizar.
