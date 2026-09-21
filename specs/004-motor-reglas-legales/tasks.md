# Desglose de tareas 004 — Motor de reglas legales argentinas

| Campo | Valor |
| --- | --- |
| Autor | orquestador |
| Estado | BORRADOR — para aprobación en G3 |
| Spec de origen | `specs/004-motor-reglas-legales/spec.md` **v4** (67 criterios de aceptación) |
| Insumos | `plan.md`, `modelo-datos.md`, `ux.md`, `sistema-de-diseno.md`, `specs/contratos/motor-reglas-legales.ts` |

## 0. Alcance real de esta implementación

El `plan.md` §2 ya lo estableció y esta tabla lo hereda: **004 es una librería
de dominio puro (`packages/shared`) más su respaldo de persistencia
(`apps/api/prisma`). No incluye API, web ni móvil** — eso lo consume la
feature **007 (Diagnóstico de deuda)**, todavía sin especificar. Por eso no hay
tareas de `dev-backend`, `dev-web`, `dev-mobile` ni `dev-integraciones` en esta
compuerta: sería construir consumidores de algo que 007 va a diseñar con su
propia spec.

**Tests unitarios: cada tarea de implementación incluye los suyos.** Por la
decisión registrada en `REGISTRO-COMPUERTAS.md` entrada 022, `dev-dominio` y
`database-engineer` escriben los tests de su propio código como parte de la
tarea, no como una tarea aparte del `tester`. El `tester` verifica cobertura y
produce el veredicto de G5.

**El análisis B (intereses y capitalización) NO tiene tarea en este desglose.**
Por la decisión registrada en la entrada 023, está pausado hasta contar con un
criterio contable/actuarial real de normalización de tasas (escalamiento E-2).
Implementarlo sin ese insumo produciría hallazgos falsos. Ver §6.

## Orden de ejecución

```
Ola 1 (paralelo):   T-01  T-02  T-03  T-14
Ola 2 (paralelo):   T-04  T-05  (dependen de T-01/T-02)
                    T-06  (depende de T-03)
Ola 3 (paralelo):   T-07  T-08  (dependen de T-04)
                    T-09  (depende de T-06)
Ola 4 (paralelo):   T-10  (depende de T-04)
                    T-11  (depende de T-07, T-08)
Ola 5:              T-12  (depende de T-04; NO incluye análisis B)
Ola 6:              T-13  (depende de T-07, T-08, T-10, T-12)
Ola 7:              T-15  (depende de todas las anteriores) — QA, G5
```

Cuatro corrientes paralelas posibles desde la ola 1: dos de `dev-dominio`, una
de `database-engineer`, una de `cicd`. `ux-expert` no tiene tarea nueva: el
catálogo de plantillas que `dev-dominio` embebe en T-11 usa los textos ya
escritos en `ux.md` §3 y `cumplimiento.md` §3, aprobados como base en las
entradas 021 y 029 del registro — la ratificación del estudio jurídico llega
después, sin bloquear la implementación (mismo criterio que C-02: se
implementa y se testea ahora, se bloquea sólo en producción).

## Tareas

| ID | Tarea | Agente | Archivos | Depende de | Criterios que cubre | Estado |
| --- | --- | --- | --- | --- | --- | --- |
| T-01 | Copiar el contrato v1 byte a byte (ADR-017), tipos base, `Centavos` y aritmética exacta con la política de redondeo de CA-32 (incluida la aclaración v4 sobre `RECLAMO_ESTIMADO`) | `dev-dominio` | `packages/shared/src/motor-legal/contrato/v1.ts`, `packages/shared/src/motor-legal/dinero/**` | — | CA-32 | PENDIENTE |
| T-02 | Determinismo: el motor recibe la fecha de evaluación por parámetro, nunca lee el reloj (ADR-016) | `dev-dominio` | `packages/shared/src/motor-legal/tiempo/**` | — | CA-31 | PENDIENTE |
| T-03 | `schema.prisma` — Bloque A (catálogo normativo): `ParametroNormativo`, `TramoParametro` con vigencia `DATERANGE` y exclusión sin solapamiento, `CitaNormativa`, `Ratificacion`, `MatriculaProfesional`, `CatalogoNormativo`/`CatalogoTramo` | `database-engineer` | `apps/api/prisma/schema.prisma`, migración inicial | — | CA-27, CA-29 | PENDIENTE |
| T-04 | Catálogo normativo en memoria: resolución del parámetro vigente a la fecha del hecho (CA-29), versión del conjunto de parámetros (CA-27), y el bloqueo no anulable de CA-58 sobre parámetros sin ratificar en entorno productivo | `dev-dominio` | `packages/shared/src/motor-legal/catalogo/**` | T-01, T-02 | CA-27, CA-28, CA-29, CA-30, CA-58 | PENDIENTE |
| T-05 | Valores de referencia con activación humana: un valor `PROPUESTO` no participa de ningún cálculo (CA-59) | `dev-dominio` | `packages/shared/src/motor-legal/valores-referencia/**` | T-01, T-02 | CA-59 | PENDIENTE |
| T-06 | `schema.prisma` — Bloque B (evaluación y resultados): `Evaluacion`, `EntradaEvaluacionCifrada`, `ResultadoAnalisis` con las cuatro clases de "sin resultado", `Hallazgo` y satélites, tabla de valores de referencia con estado ACTIVO/PROPUESTO | `database-engineer` | `apps/api/prisma/schema.prisma`, migración | T-03 | CA-59, CA-60 | PENDIENTE |
| T-07 | Análisis A — prescripción liberatoria completo: estados presuntivos, hechos interruptivos y suspensivos, la regla del art. 2541 (CA-65), desempate de regímenes (CA-33), límite de una sola interpelación (CA-34) | `dev-dominio` | `packages/shared/src/motor-legal/analisis-a-prescripcion/**` | T-04 | CA-01 a CA-08, CA-33, CA-34, CA-65 | PENDIENTE |
| T-08 | Análisis C — plazos de archivo de información crediticia: registros separados (BCRA vs. bureau), `diesAQuo` exigido en la firma del estado CADUCADO (CA-39), datos sin mora sin plazo de eliminación (CA-67) | `dev-dominio` | `packages/shared/src/motor-legal/analisis-c-archivo-crediticio/**` | T-04 | CA-14 a CA-17, CA-38, CA-39, CA-67 | PENDIENTE |
| T-09 | `schema.prisma` — Bloque C (persona, advertencia y bitácora): `SujetoSeudonimo`, `AdvertenciaPreventiva`, `EntregaAdvertencia`, `BitacoraAcceso`, mecanismo de supresión — implementa la desvinculación de identidad primero, conservación probatoria diseñada y **apagada** (entrada 028: no se activa sin fundamento legal de `compliance-legal`) | `database-engineer` | `apps/api/prisma/schema.prisma`, migración | T-06 | CA-54 a CA-57, CA-60 | PENDIENTE |
| T-10 | Análisis D — embargabilidad de haberes: tramos del Decreto 484/87, causa alimentaria con régimen propio (CA-40), inembargabilidad previsional como regla salvo alimentos/litisexpensas (CA-41, v3), indemnización laboral (CA-42) | `dev-dominio` | `packages/shared/src/motor-legal/analisis-d-embargabilidad/**` | T-04 | CA-18 a CA-22, CA-40 a CA-42 | PENDIENTE |
| T-11 | Catálogo cerrado de plantillas de texto (ADR-014) con los literales aprobados en las entradas 021 y 029; salvaguardas S-01 a S-10 transversales; términos prohibidos (CA-45); marca de confirmación profesional propagada (CA-46, CA-47, CA-51) | `dev-dominio` | `packages/shared/src/motor-legal/plantillas/**`, `packages/shared/src/motor-legal/salvaguardas/**` | T-07, T-08 | CA-45 a CA-53 | PENDIENTE |
| T-12 | Análisis E — honorarios y cuota litis: jurisdicciones nacional/federal/Buenos Aires/CABA/Córdoba/Santa Fe (CA-43), topes separados con compromiso interno (CA-23, CA-44), forma escrita del pacto (CA-66), **exclusión explícita** de materias previsionales/alimentarias/con menores (CA-63) — el booleano de la entrada 025, no el análisis B | `dev-dominio` | `packages/shared/src/motor-legal/analisis-e-honorarios/**` | T-04 | CA-23 a CA-26, CA-43, CA-44, CA-63, CA-66 | PENDIENTE |
| T-13 | Reglas de conjunto: no-confusión prescripción/archivo (CA-62), no acumulación de impactos superpuestos, régimen en disputa del art. 277 LCT (CA-64), composición final del resultado | `dev-dominio` | `packages/shared/src/motor-legal/composicion/**` | T-07, T-08, T-10, T-12 | CA-62, CA-64 | PENDIENTE |
| T-14 | Pipeline: verificación de identidad del contrato contra `specs/contratos/motor-reglas-legales.ts` (ADR-017), regla de lint que prohíbe `new Date()` en `packages/shared`, *benchmark* de rendimiento del motor | `cicd` | `.github/workflows/**` | — | — (protege ADR-016, ADR-017) | PENDIENTE |
| T-15 | QA: verificar que la cobertura declarada por T-01 a T-13 demuestra los 67 criterios y los casos límite de la spec §7; informe `qa.md`; veredicto de G5 | `tester` | `tests/e2e/**` (si aplica a una librería pura), `specs/004-motor-reglas-legales/qa.md` | T-01 a T-14 | Todos | PENDIENTE |

Estados: PENDIENTE → EN CURSO → EN REVISIÓN (G4) → HECHA → VALIDADA (G5).

## Cobertura

| Criterios | Tareas que los cubren |
| --- | --- |
| CA-01 a CA-08, CA-33, CA-34, CA-65 (análisis A) | T-07 |
| CA-09 a CA-13, CA-35 a CA-37 (análisis B) | **Ninguna — bloqueado, ver §0 y §6** |
| CA-14 a CA-17, CA-38, CA-39, CA-67 (análisis C) | T-08 |
| CA-18 a CA-22, CA-40 a CA-42 (análisis D) | T-10 |
| CA-23 a CA-26, CA-43, CA-44, CA-63, CA-66 (análisis E) | T-12 |
| CA-27 a CA-31, CA-58 (catálogo y determinismo) | T-01, T-02, T-04 |
| CA-32 (dinero) | T-01 |
| CA-45 a CA-53 (salvaguardas y plantillas) | T-11 |
| CA-54 a CA-57 (advertencia preventiva) | T-09, T-11 |
| CA-59 (valores de referencia) | T-05, T-06 |
| CA-60, CA-61 (minimización, comisión) | T-06, T-11 |
| CA-62, CA-64 (reglas de conjunto) | T-13 |
| Persistencia de todo lo anterior | T-03, T-06, T-09 |
| Verificación transversal | T-14, T-15 |

Todas las filas de criterios de la spec v4 quedan cubiertas, salvo el análisis
B, que queda **explícitamente sin tarea** por la decisión de la entrada 023.

## 6. Qué pasa con el análisis B

No tiene tarea porque implementarlo hoy violaría R-05 (no completar con
supuestos): comparar una TNA contra un tope en TEA sin un criterio de
normalización real produce hallazgos falsos, y un hallazgo falso en este
producto es peor que no tener el hallazgo. Cuando exista el criterio
contable/actuarial (escalamiento E-2, entrada 023), esto vuelve como una tarea
nueva — no requiere reabrir G1 ni G2, sólo agregar `T-16` a este documento.

## 7. Riesgo de cronograma heredado

La condición C-03 (firma del estudio jurídico sobre la tabla completa de
parámetros) sigue abierta y pospuesta (entrada 027). Ninguna tarea de este
desglose depende de ella para **implementarse y testearse** — el bloqueo de
CA-58 opera en entorno productivo, no en desarrollo — pero **nada de esto
puede evaluar una deuda real hasta que esa firma exista**. Vale la pena
recordarlo en cada revisión de avance.
