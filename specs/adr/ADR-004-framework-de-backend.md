# ADR-004 — Framework de backend: NestJS, con Zod en todos los bordes

| Campo | Valor |
| --- | --- |
| Estado | PROPUESTO |
| Fecha | 2026-09-20 |
| Autor | arquitecto |
| Aprobado por | pendiente — G2, feature 001 |
| Spec de origen | `specs/001-fundaciones/spec.md` (CA-02, CA-05, CA-06) |

## Contexto

La API es el único backend de tres portales web y una app móvil (criterio 4 del
mandato: un backend, tres vistas con distinto RBAC). Tiene por delante los 17
módulos de `docs/02-arquitectura.md`, un requisito transversal de auditoría
inmutable, idempotencia en los bordes externos (constitución #12) y un modelo
de puertos y adaptadores donde la implementación de cada integración se elige en
tiempo de arranque según `INTEGRACIONES_MODO`.

Ese último punto es el que más pesa: intercambiar una implementación por otra
sin tocar a los consumidores es exactamente el problema que resuelve un
contenedor de inyección de dependencias. Hacerlo a mano con fábricas propias es
posible y es código nuestro que hay que mantener y auditar.

## Decisión

El backend es **NestJS 11 sobre Node 22**, con Express como adaptador HTTP,
estructurado en módulos que se corresponden con los de
`docs/02-arquitectura.md`.

Reglas de arquitectura que acompañan a la elección y que son tan vinculantes
como ella:

1. **El framework vive en los bordes.** Controladores, guardas, interceptores y
   proveedores son infraestructura. Toda regla legal o financiera vive en
   `@mejorar/shared`, sin decoradores y sin saber que Nest existe. Un módulo de
   Nest orquesta; no calcula.
2. **Cada integración externa se inyecta por su interfaz** (el puerto definido
   en `@mejorar/integrations`), nunca por su implementación concreta. La fábrica
   que elige `mock` / `sandbox` / `produccion` es el único lugar del sistema que
   conoce las dos.
3. **Validación con Zod en todos los bordes**: cuerpo, parámetros y query de
   cada endpoint, respuestas de cada adaptador externo, y **la configuración de
   arranque** (ver `plan.md` §5, CA-06). Un solo validador para todo el sistema,
   compartido con web y móvil vía `@mejorar/shared`. No se usan
   `class-validator`/`class-transformer`, que obligarían a duplicar cada
   esquema como clase decorada y que no se pueden reutilizar en el dominio puro.
4. **Adaptador Express, no Fastify**, hasta que exista una medición que lo
   justifique. La carga esperada del producto está lejos de ser la restricción.
5. Se adoptan de Nest los componentes transversales que el producto necesita y
   que no conviene reescribir: guardas para RBAC, interceptores para la bitácora
   de auditoría y el identificador de correlación, filtros de excepción para
   normalizar errores, y `@nestjs/swagger` para el contrato público.

## Alternativas consideradas

| Alternativa | A favor | En contra | Por qué no |
| --- | --- | --- | --- |
| **Express o Fastify "pelados"** | Mínima magia, arranque rápido, nada que aprender | Hay que construir inyección de dependencias, modularidad, guardas, interceptores y documentación del contrato. Con 17 módulos y ocho agentes, cada uno lo resolvería distinto | Terminaríamos escribiendo un Nest peor y sin documentación |
| **Fastify como adaptador de Nest** | Más rendimiento por request | Ecosistema de plugins más chico; algunos paquetes de Nest asumen Express | Se puede cambiar después con un ADR de reemplazo y poco código; hoy no hay medición que lo pida |
| **AdonisJS** | Framework integrado, ORM incluido, muy productivo | Comunidad y oferta de talento mucho menores en el mercado argentino; acopla ORM y framework, lo contrario de lo que este diseño busca | Riesgo de contratación y de acoplamiento |
| **tRPC** o **Hono** con contratos tipados | Tipos punta a punta sin generación de código | La app móvil y eventuales integradores externos necesitan un contrato HTTP estable y documentado; tRPC ata el cliente a TypeScript y al despliegue conjunto | Un backend que también sirve a terceros y a una app publicada en tiendas necesita REST documentado |
| **`class-validator` + DTO decorados** (camino por defecto de Nest) | Idiomático en Nest, ejemplos por todas partes | Los esquemas no se pueden reutilizar en web, móvil ni dominio; validación e inferencia de tipos viven separadas | Una sola definición de la forma de un dato, compartida por los cuatro consumidores, vale más que la idiomaticidad |

## Consecuencias

**Positivas**

- El intercambio mock/real de cada integración es configuración, no código: el
  sistema completo corre sin una sola credencial (CA-05, R-01).
- Las guardas y los interceptores dan un punto único donde aplicar RBAC y
  auditoría a todos los endpoints, que es la forma de que la constitución #5 sea
  arquitectura y no disciplina.
- Estructura predecible: cualquier agente encuentra las cosas en el mismo lugar.

**Negativas**

- NestJS exige `experimentalDecorators` y `emitDecoratorMetadata`. Esas opciones
  quedan **confinadas a `apps/api/tsconfig.json`** y se eliminan de
  `tsconfig.base.json` (auditoría en `plan.md` §3): no deben contaminar el
  dominio ni la web.
- Los decoradores exigen una transformación especial en el runner de tests (ver
  ADR-008).
- Curva de aprendizaje inicial y arranque algo más lento que un Express pelado.

**Qué cierra**

- Ejecución de la API en runtimes de borde (Workers, Deno Deploy) sin un
  rediseño.

## Cómo se revierte

- **Cambiar Express por Fastify:** costo bajo, una línea de arranque más la
  revisión de los middlewares que se hayan usado. Medio día.
- **Salir de NestJS:** costo alto. Controladores, módulos y proveedores habría
  que reescribirlos. La mitigación es estructural y ya está tomada: el valor del
  producto —reglas legales, cálculos, decisiones— vive en `@mejorar/shared`, que
  no se toca. Se reescribiría la cáscara, no el negocio. Estimado: 2-3 semanas
  para el estado del sistema al completar la ola 2.
