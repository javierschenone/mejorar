# Desglose de tareas 002 — Identidad y acceso

| Campo | Valor |
| --- | --- |
| Autor | orquestador |
| Estado | BORRADOR — para aprobación en G3 |
| Spec de origen | `specs/002-identidad-y-acceso/spec.md` **v4** (39 criterios de aceptación) |
| Insumos | `plan.md`, `modelo-datos.md`, `ux.md`, `specs/contratos/identidad-y-acceso.ts` |

## 0. Alcance real de esta implementación

A diferencia de la 004 (librería pura), esta feature cruza **cinco** alcances
de escritura: dominio puro, integraciones, dos módulos de la API
(`autorizacion` y `identidad`), persistencia y los tres portales web.
`dev-mobile` queda **fuera**: consume el mismo backend, pero el
almacenamiento seguro del token y la biometría son de su propia feature
(spec §8, obligación de frontera F-10).

Se sigue el orden de 10 fases que `plan.md` §2 ya sugirió — es del arquitecto,
no una invención de este desglose.

## Orden de ejecución

```
Ola 1 (paralelo):   T-01 (dev-dominio)      T-02 (dev-integraciones)   T-13 (cicd)
Ola 2:              T-03 (database-engineer) — depende de T-01 (tipos del dominio)
Ola 3:              T-04 (dev-backend: autorización + auditoría) — depende de T-01, T-03
Ola 4 (paralelo):   T-05 (dev-backend: alta/confirmación/recuperación)
                    T-09 (dev-web: portales) — arranca en cuanto el contrato está
                    congelado, no espera a T-05 completa
                    — ambas dependen de T-04
Ola 5:              T-06 (dev-backend: ingreso, tokens, sesiones) — depende de T-05
Ola 6:              T-07 (dev-backend: segundo factor) — depende de T-06
Ola 7:              T-08 (dev-backend: verificación de matrícula y back-office)
                    — depende de T-04
Ola 8:              T-10 (dev-backend: restitución de segundo factor)
                    — depende de T-07; BLOQUEADA hasta resolver el escalamiento E-4
Ola 9:              T-11 (dev-backend + cicd: retiro del andamiaje de ingreso de 001)
                    — depende de T-06
Ola 10:             T-12 (tester) — depende de todas las anteriores salvo T-10
```

Cuatro corrientes paralelas posibles desde la ola 1. La corriente de
`dev-web` (T-09) puede avanzar junto con toda la ola 4-8 de `dev-backend` en
cuanto el contrato esté congelado — no tiene que esperar a que cada endpoint
exista, siempre que trabaje contra el contrato y no contra la implementación.

## Tareas

| ID | Tarea | Agente | Archivos | Depende de | Criterios que cubre | Estado |
| --- | --- | --- | --- | --- | --- | --- |
| T-01 | Dominio puro completo: copia del contrato (ADR-017), `derivarPermisos`/`mapaRolPermisos`, `decidirAcceso`, `derivarEstadoMatricula`/`claveDeExhibicionDeMatricula`, `evaluarPoliticaDeContrasena`/`normalizarContrasena`, `decidirBloqueo`, `exigeSegundoFactor`, `crearIdOpaco`, `verificarDigitoVerificadorCuit` (el archivo que CA-04 daba por existente y no existía) | `dev-dominio` | `packages/shared/src/identidad/**` | — | CA-03, CA-04, CA-09, CA-18 a CA-20, CA-26 (parcial), CA-29 a CA-31, CA-32, CA-38, CA-39 | HECHA — 249/249 tests verificados por el orquestador (commit `c82aace`) |
| T-02 | Puertos y adaptadores de ADR-029, todos con mock determinista obligatorio: correo transaccional (mock + Sendgrid, R-12), ubicación por IP con base local, descripción de dispositivo, lista local de contraseñas filtradas, reloj | `dev-integraciones` | `packages/integrations/src/identidad/**` | — | CA-13, R-09, R-12 | HECHA — 159/159 tests verificados por el orquestador (commit `c82aace`) |
| T-03 | Modelo de datos completo de la feature: `Usuario` reconciliado con el de la 001, vigencia de matrícula, sesiones y tokens, MFA, consentimiento versionado, purga de no confirmadas, cuentas administradoras nominadas | `database-engineer` | `apps/api/prisma/**` | T-01 | CA-01, CA-05, CA-10, CA-11, CA-13, CA-14, CA-27, CA-28, CA-29 a CA-31, CA-33, CA-34 | EN CURSO |
| T-04 | Módulo de autorización (`autorizar`, `autorizarColeccion`, registro de tipos de recurso con validación de arranque que falla si falta clasificación, guarda que construye `ContextoDeAcceso`, caché de perfil con versión) y auditoría (`EventoAuditoria` extendido, consulta por titular y sujeto, sellado periódico) — **el módulo más sensible de la feature** | `dev-backend` | `apps/api/src/autorizacion/**`, `apps/api/src/auditoria/**` | T-01, T-03 | CA-18 a CA-22, CA-33, CA-34 | PENDIENTE |
| T-05 | Alta, confirmación de correo, recuperación de contraseña, con la respuesta uniforme de no-revelación (CA-02, CA-04, CA-06, CA-15, CA-17) siempre accionable | `dev-backend` | `apps/api/src/identidad/**` (alta, confirmación, recuperación) | T-04 | CA-01, CA-02, CA-04, CA-06, CA-15 a CA-17, CA-26, CA-27, CA-28 | PENDIENTE |
| T-06 | Ingreso en dos pasos, tokens (access + refresh con rotación por familia y detección de reutilización sin ventana de gracia), sesiones consultables y cerrables | `dev-backend` | `apps/api/src/identidad/**` (ingreso, tokens, sesiones) | T-05 | CA-07, CA-08, CA-09 a CA-14, CA-36, CA-37 | PENDIENTE |
| T-07 | Segundo factor: inscripción TOTP, verificación, códigos de respaldo, los cuatro cerrojos que hacen no configurable el MFA de administrador (ADR-023) | `dev-backend` | `apps/api/src/identidad/**` (segundo factor) | T-06 | CA-32, CA-38, CA-39 | PENDIENTE |
| T-08 | Verificación de matrícula (alta con evidencia registrada), back-office de aprobación/rechazo/suspensión inmediata, escalamiento a los 7 días corridos (CA-31, v4) | `dev-backend` | `apps/api/src/identidad/**` (matrícula, back-office) | T-04 | CA-05, CA-22, CA-29 a CA-31 | PENDIENTE |
| T-09 | Los tres portales según `ux.md` (pantallas AL, IN, RE, CL, AB, AD): alta con el bloque del art. 6, ingreso, MFA, sesiones, perfil, back-office de matrículas. Cliente HTTP con renovación *single-flight* y manejo de 403 (CA-20) | `dev-web` | `apps/web/**` | T-04 (contrato congelado) | CA-05, CA-13, CA-18 a CA-22, CA-26, CA-32, CA-38, CA-39 | PENDIENTE |
| T-10 | Restitución de segundo factor perdido: espera cancelable, doble control (ADR-027) | `dev-backend` | `apps/api/src/identidad/**` (restitución) | T-07 | CA-35 | **BLOQUEADA — ver §5** |
| T-11 | Retiro del andamiaje de ingreso provisorio de la feature 001 (`PERMITIR_LOGIN_DEMO`) y de las variables `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` que esta feature reemplaza (hallazgo del plan, ver `REGISTRO-COMPUERTAS.md` entrada 049) | `dev-backend` + `cicd` | `apps/api/src/**`, configuración de entorno | T-06 | — (limpieza de deuda técnica declarada) | PENDIENTE |
| T-13 | Pipeline: verificación de identidad del contrato, *benchmark* de `argon2id` con umbral que rompe la construcción, prueba estadística de temporización (no-revelación), generación y custodia de claves Ed25519/pimienta/clave de sellado, actualización mensual de la base de geolocalización | `cicd` | `.github/workflows/**` | — | CA-25 (transversal) | PARCIAL — falso positivo de la verificación de identidad del contrato corregido y verificado (commit `0752353`, 9º intento tras 8 caídas por sobrecarga del servidor); el resto de T-13 (benchmark argon2id, prueba de temporización, custodia de claves, actualización de geolocalización) sigue PENDIENTE |
| T-12 | QA: verificar que la cobertura declarada por T-01 a T-11 demuestra los 39 criterios, incluidos los tests de acceso cruzado entre roles y la prueba de temporización; informe `qa.md`; veredicto de G5 | `tester` | `tests/e2e/**`, `specs/002-identidad-y-acceso/qa.md` | T-01 a T-09, T-11 | Todos salvo CA-35 | PENDIENTE |

Estados: PENDIENTE → EN CURSO → EN REVISIÓN (G4) → HECHA → VALIDADA (G5).

## Cobertura

| Criterios | Tareas que los cubren |
| --- | --- |
| CA-01 a CA-06 (registro e identidad) | T-01, T-03, T-05 |
| CA-07 a CA-14 (ingreso y sesión) | T-01, T-03, T-06 |
| CA-15 a CA-17 (recuperación) | T-05 |
| CA-18 a CA-22 (RBAC y auditoría) | T-01, T-04, T-09 |
| CA-23 a CA-25 (perfil propio) | Sin tarea explícita — **ver §6, escalamiento propio de este desglose** |
| CA-26 a CA-28 (información y consentimiento) | T-01, T-05 |
| CA-29 a CA-31 (vigencia de matrícula) | T-01, T-03, T-08 |
| CA-32, CA-38, CA-39 (MFA) | T-01, T-07, T-09 |
| CA-33, CA-34 (cuentas administradoras) | T-03, T-04 |
| CA-35 (restitución de MFA) | T-10 — **bloqueada** |
| CA-36, CA-37 (bloqueo con salida) | T-01, T-06 |
| R-09, R-12 (terceros) | T-02 |
| Todo lo anterior, verificado | T-12 |

## 5. Por qué T-10 está bloqueada

CA-35 exige declarar "qué documentación se pide, con qué base legal, quién la
ve, por cuánto tiempo se conserva y cómo se destruye" para restituir un
segundo factor perdido. El `plan.md` (escalamiento E-4) y el `modelo-datos.md`
coinciden en que esto necesita un catálogo de comprobaciones de identidad
aceptables, que es trabajo de `compliance-legal`, no del `arquitecto` ni del
`database-engineer`. **No se implementa T-10 sin ese catálogo** — hacerlo
antes sería inventar qué documento pedirle a alguien para probar su
identidad, con el riesgo de sobre-recolectar datos sensibles sin base legal.

## 6. Hueco encontrado al armar este desglose

CA-23 a CA-25 (perfil propio de cada rol, incluida la exportación mínima de
datos personales) no tienen una tarea clara en la tabla de `plan.md` §2 — caen
implícitamente dentro de T-05/T-09 pero ningún componente los nombra
explícito. Se asignan a T-05 (backend) y T-09 (web) por extensión razonable,
sin volver a G2 por esto: es una omisión de asignación, no un criterio sin
diseño — el contrato y el modelo de datos ya cubren lo que hace falta.

## 7. Riesgo heredado

La condición C-002-10 (encargados de tratamiento de terceros) no se cierra
del todo con T-02: Sendgrid (R-12) sigue pendiente de la evaluación de
transferencia internacional y el DPA firmado (entrada 052 del registro). T-02
implementa el adaptador; la condición legal para usarlo en producción es
independiente y no bloquea el desarrollo, sólo el pasaje a producción real.
