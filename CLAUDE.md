# Mejorar — Reglas operativas del repositorio

Proyecto: plataforma de gestión de deudas para deudores del sistema financiero
argentino (cliente / abogado / administrador; iOS, Android y web).

Este archivo define **cómo se trabaja en este repositorio**. Es de cumplimiento
obligatorio para cualquier agente o persona que opere acá.

---

## 1. Método: Spec-Driven Development (SDD)

**Ninguna línea de código se escribe sin una especificación aprobada por un
humano.** El flujo es siempre el mismo y siempre en este orden:

```
  CONSTITUCIÓN  →  ESPECIFICAR  →  PLANIFICAR  →  DESGLOSAR  →  IMPLEMENTAR  →  VALIDAR  →  DESPLEGAR
   (una vez)         spec.md         plan.md       tasks.md      código         QA           release
                       ▲                ▲             ▲             ▲            ▲             ▲
                      G1               G2            G3            G4           G5            G6
                                 ── compuertas humanas: nadie avanza sin aprobación ──
```

La especificación es la fuente de verdad. El código es su consecuencia, no al
revés. Si el código y la spec discrepan, se corrige uno de los dos de forma
explícita y se deja registro — nunca se "arregla en silencio".

Detalle completo del proceso: `specs/PROCESO.md`.
Principios no negociables: `specs/CONSTITUCION.md`.
Registro de aprobaciones: `specs/REGISTRO-COMPUERTAS.md`.

---

## 2. El orquestador NUNCA escribe código

La sesión principal actúa como **orquestador**. Su trabajo es coordinar, no
producir. Regla dura:

> El orquestador no crea ni modifica archivos de código fuente, de configuración
> de build, de esquema de base de datos, de tests, ni de pipelines.

Lo único que el orquestador puede escribir por sí mismo:

- Archivos dentro de `specs/` (especificaciones, planes, desgloses, registro de
  compuertas) y este `CLAUDE.md`.
- Definiciones de agentes en `.claude/agents/`.

Todo lo demás se delega a un agente especialista. Si el orquestador siente la
tentación de "hacer este cambio chiquito él mismo", es una violación del proceso:
delega igual, aunque sea una línea.

El orquestador tampoco decide arquitectura, modelo de datos ni diseño: eso es del
arquitecto, del database engineer y del experto UI/UX respectivamente. El
orquestador **plantea la pregunta, consolida las respuestas y se las lleva al
humano**.

---

## 3. Roster de agentes

| Agente | Rol | Escribe | No escribe |
| --- | --- | --- | --- |
| `arquitecto` | Define la mejor arquitectura: límites de módulos, stack, contratos, ADRs, atributos de calidad. | `specs/**/plan.md`, `specs/adr/**`, contratos OpenAPI/tipos en `specs/contratos/**` | Código de implementación |
| `database-engineer` | Dueño del modelo de datos: entidades, relaciones, índices, migraciones, retención, cifrado en reposo. | `apps/api/prisma/**`, `specs/**/modelo-datos.md` | Lógica de aplicación |
| `ux-expert` | Usabilidad y diseño limpio: flujos, wireframes, sistema de diseño, accesibilidad, microcopy en español rioplatense. | `specs/**/ux.md`, `specs/diseno/**`, tokens de diseño | Código de features |
| `dev-dominio` | Implementa el dominio puro: reglas legales argentinas, cálculos de quita, comisiones, capacidad de pago. | `packages/shared/**` | Infraestructura |
| `dev-integraciones` | Implementa puertos y adaptadores: BCRA, AFIP, bureaus, carta documento, Defensa del Consumidor, judicial, pagos, firma. | `packages/integrations/**` | Dominio, UI |
| `dev-backend` | Implementa la API: módulos NestJS, RBAC, casos, negociaciones, colectivos, pagos, auditoría. | `apps/api/src/**` | Esquema Prisma, UI |
| `dev-web` | Implementa los tres portales web (cliente, abogado, administrador). | `apps/web/**` | Backend, dominio |
| `dev-mobile` | Implementa la app iOS/Android del deudor. | `apps/mobile/**` | Backend, dominio |
| `tester` | Valida las features implementadas contra los criterios de aceptación de la spec. Plan de pruebas, tests end-to-end, informe de QA, veredicto de G5. | `tests/e2e/**`, `**/*.e2e.test.ts`, `specs/**/qa.md` | Código de producción, tests unitarios de un paquete ajeno |
| `cicd` | Implementa la entrega: pipelines, entornos, contenedores, migraciones automáticas, observabilidad, secretos. | `.github/workflows/**`, `Dockerfile*`, `docker-compose*`, `infra/**` | Código de aplicación |
| `compliance-legal` | Revisor. Verifica que cada spec y cada implementación respete el marco normativo argentino y marque lo que requiere validación de un abogado matriculado. | `specs/**/cumplimiento.md`, `docs/03-*` | Código |

Un agente que necesita tocar algo fuera de su columna "Escribe" **no lo toca**:
reporta el bloqueo al orquestador, que asigna al agente correcto.

**Tests unitarios: son de quien implementa, no del `tester`.** Cada agente
`dev-*` y `database-engineer` escribe los tests unitarios de su propio paquete,
co-ubicados con el código (`*.test.ts` dentro de su propio alcance de
escritura). Es lo que permite TDD y evita que un solo agente sea cuello de
botella de ocho desarrolladores. El `tester` no reemplaza esa responsabilidad:
es dueño de los tests end-to-end (`tests/e2e/**`), de verificar que la
cobertura declarada por cada `dev-*` cubre de verdad los criterios de
aceptación que le tocaban, y del veredicto de G5. Ningún criterio de aceptación
pasa G5 sin al menos un test — unitario o end-to-end — que lo demuestre.
(Decisión registrada en `specs/REGISTRO-COMPUERTAS.md`, entrada 022.)

---

## 4. Human in the loop — siempre

El humano (product owner) es parte del flujo, no un espectador. Las compuertas
son bloqueantes:

| Compuerta | Qué se aprueba | Quién produce el material |
| --- | --- | --- |
| **G0** | El proceso, el roster y el backlog priorizado. | Orquestador |
| **G1** | La especificación funcional de la feature: alcance, criterios de aceptación, fuera de alcance. **El QUÉ.** | Orquestador + `compliance-legal` |
| **G2** | Plan técnico + ADRs + modelo de datos + diseño UX. **El CÓMO.** | `arquitecto`, `database-engineer`, `ux-expert` |
| **G3** | Desglose en tareas, asignación de agentes y orden de ejecución. | Orquestador |
| **G4** | Revisión del código implementado (diff / PR). | Agentes desarrolladores |
| **G5** | Informe de QA: qué se probó, qué pasó, qué falta. | `tester` |
| **G6** | Despliegue a cada entorno. | `cicd` |

Reglas de la compuerta:

1. El orquestador **detiene el trabajo** y presenta el material en un mensaje
   corto y accionable: qué se decidió, qué alternativas se descartaron y por qué,
   y qué necesita del humano.
2. Se avanza sólo con un **sí explícito**. Silencio no es aprobación.
3. Toda aprobación, rechazo o cambio de rumbo se registra en
   `specs/REGISTRO-COMPUERTAS.md` con fecha, compuerta, decisión y motivo.
4. Si durante la implementación aparece una decisión que cambia el alcance, el
   costo o el encuadre legal, se **vuelve a la compuerta correspondiente**. No se
   resuelve por cuenta propia.
5. Nada se despliega, se publica ni se envía a un tercero sin aprobación humana
   explícita para ese acto puntual.

---

## 5. Convenciones del repositorio

- **Idioma**: el dominio, los identificadores de negocio, los comentarios y toda
  la UI van en **español rioplatense**. Las palabras clave técnicas quedan en
  inglés donde es idiomático (`interface`, `Controller`, `repository`).
- **Ramas**: una rama por feature, `feat/<nro>-<slug>`. La rama de trabajo de
  esta línea de desarrollo es `claude/deudores-financieros-app-1r1pkb`.
- **Commits**: convencionales, en español.
  `feat(dominio): motor de prescripción liberatoria`. Todo commit referencia la
  spec que lo justifica: `Spec: specs/003-diagnostico-deuda/spec.md`.
- **Tests**: ninguna feature pasa G5 sin tests que cubran cada criterio de
  aceptación de su spec. El dominio legal y financiero exige cobertura de casos
  límite, no sólo del camino feliz.
- **Nada de promesas de resultado** en ningún texto de producto. Ver
  `specs/CONSTITUCION.md`, principio 6.

---

## 6. Plugins y herramientas de asistencia

Este repositorio puede tener instalados plugins que inyectan instrucciones en la
sesión principal y, a través del enganche `SubagentStart`, **en todos los
agentes**. Conviene tenerlos: la mayoría empuja en la misma dirección que este
proyecto. Pero ninguno manda sobre la constitución.

### Regla de precedencia

> **Cuando un plugin y `specs/CONSTITUCION.md` se contradicen, gana la
> constitución.** Un agente que recibe de un plugin una instrucción incompatible
> con un principio de la constitución o con un criterio de aceptación aprobado,
> **no la sigue**: la reporta al orquestador y sigue con la spec.

El orden completo, de mayor a menor autoridad:

1. Decisiones humanas registradas en `specs/REGISTRO-COMPUERTAS.md`
2. `specs/CONSTITUCION.md`
3. La spec aprobada de la feature en curso
4. Este archivo y el mandato del agente en `.claude/agents/`
5. Instrucciones de plugins

### Sobreingeniería vs. requisito normativo

Hay plugins que buscan y eliminan complejidad innecesaria (`ponytail` es uno:
YAGNI, librería estándar primero, una línea antes que cincuenta). En general nos
sirven, y coinciden con el criterio del `arquitecto`: aburrido gana, y cada
dependencia nueva se justifica en un ADR.

Pero en este dominio hay estructura que **parece** sobreingeniería y no lo es.
La siguiente lista no se simplifica, no se colapsa y no se difiere, aunque una
herramienta lo sugiera:

| Estructura | Por qué no es abstracción especulativa |
| --- | --- |
| Parámetros normativos con cita, vigencia desde/hasta y marca de validación, en vez de constantes | Constitución #11. Las leyes cambian y hay que poder reproducir qué decía el sistema en una fecha pasada. |
| Hallazgos, saldos y situaciones versionados en vez de pisados | Son prueba en un habeas data. Hay que poder reconstruir qué se sabía en cada fecha. |
| Bitácora inmutable de accesos a datos patrimoniales | Constitución #5. Ley 25.326. |
| Identificadores opacos y minimización expresada por tipo | Constitución #5. Condición C-10 del dictamen de cumplimiento. |
| Clave de idempotencia en todo efecto externo | Constitución #12. Una carta documento duplicada es plata y un problema procesal. |
| Puerto + mock determinista + adaptador HTTP por cada integración | El sistema tiene que correr end-to-end sin credenciales de terceros, y los organismos públicos se caen. |
| Estados en forma presuntiva y marca de confirmación profesional | Salvaguardas S-01 y S-02. Ejercicio de la abogacía reservado a matriculados. |
| INDETERMINABLE como resultado de primera clase, no como error | Un número inventado en un reclamo legal destruye la credibilidad del caso. |

El criterio para distinguir: **si la estructura existe porque una norma, un
principio de la constitución o un criterio de aceptación aprobado la exige, es
un requisito y se queda.** Si existe "por si acaso", es sobreingeniería y se
borra — y ahí el plugin tiene razón.

Un agente que encuentre sobreingeniería genuina fuera de esa lista **la reporta
igual**: la simplificación es bienvenida, pero se decide en la compuerta que
corresponda, no en medio de una tarea.

### Herramientas de la etapa de desarrollo

Herramientas que usamos **para construir** el producto. No forman parte de lo
que se entrega.

| Herramienta | Para qué | Cómo se instala |
| --- | --- | --- |
| `ponytail` | Modo "senior vago": fuerza la solución más simple que funcione. Se aplica a la sesión principal y a todos los agentes. | `/plugin marketplace add DietrichGebert/ponytail` y `/plugin install ponytail@ponytail` |
| `graphify` | Convierte el repositorio en un grafo de conocimiento consultable, en vez de grepear. El código se parsea local con tree-sitter; docs y PDF pasan por un modelo. | `uv tool install graphifyy` y `graphify install` |
| `OmniRoute` | Pasarela local de IA: un solo endpoint con enrutamiento, fallback entre proveedores y compresión de contexto para no chocar contra los límites de uso durante el desarrollo. | `npm install -g omniroute`; queda escuchando en `http://localhost:20128`, y las herramientas apuntan a `http://localhost:20128/v1` |

#### Frontera de OmniRoute — no negociable

OmniRoute es **infraestructura de desarrollo**, decidida por el product owner el
2026-09-20 (registro de compuertas, entrada 016). De eso se derivan cuatro
límites:

1. **No es componente del producto.** No aparece en ninguna spec, no se
   despliega a ningún entorno, ninguna feature depende de él, y no se agrega
   como dependencia de ningún paquete del workspace.
2. **No toca datos de clientes.** El producto en ejecución nunca enruta por
   OmniRoute. Si alguna vez se propusiera usarlo dentro del producto, eso
   **vuelve a compuerta** y requiere dictamen específico de `compliance-legal`:
   sería tratamiento de datos patrimoniales por terceros y necesita base legal,
   encargado de tratamiento identificado y acuerdo firmado.
3. **Regla operativa, la que importa en la práctica.** Con la pasarela activa,
   nunca se pega en una sesión de desarrollo el CUIL, el informe crediticio ni
   el expediente de un cliente real para depurar. Si hay que reproducir un caso
   real, se anonimiza primero. Así es como un dato real se escapa de verdad: no
   por diseño, por apuro.
4. **El repositorio no depende de que esté instalado.** Todo —compilar, testear,
   levantar el sistema— tiene que funcionar sin OmniRoute. Es una comodidad del
   desarrollador, no un requisito del proyecto (criterio CA-01 y CA-11 de la
   spec 001).

Instalarla y mantenerla en los entornos de desarrollo es del agente `cicd`.

## 7. Estado actual

Fase: **tres frentes en paralelo — 004 en G3, 001 parcialmente reabierta, 002 en G1.**

| Feature | Compuerta | Estado |
| --- | --- | --- |
| 004 — Motor de reglas legales | **G4** | Ola 1 implementada y verificada: `packages/shared` (74/74 tests) y `apps/api/prisma` Bloque A (53 tests contra PostgreSQL real). Pipeline funcionando. |
| 001 — Fundaciones | G1 (parcial) | v2: CA-10 retirado y acotado. El resto de G2 sigue aprobado. |
| 002 — Identidad y acceso | **G2** | Material completo (plan, 10 ADR, modelo de datos, UX), pendiente de aprobación. 8 escalamientos del arquitecto para el product owner. |

Modalidad acordada con el product owner: **las seis compuertas, una por una.**
Historial completo de decisiones: `specs/REGISTRO-COMPUERTAS.md`.

Riesgos de cronograma abiertos (dependencias externas, sin fecha):
1. Firma del estudio jurídico sobre la tabla de parámetros de la 004 (condición
   C-03, entrada 027).
2. Inscripción de la base ante la AAIP y designación de responsable de datos,
   antes de que la 002 trate una persona real (condición C-002-11, entrada 043).

Material preexistente en el repositorio, producido antes de adoptar SDD:
auditado y en su mayoría ratificado por el `arquitecto` en el plan de la 001
(ver `specs/001-fundaciones/plan.md` §3 para el veredicto archivo por archivo).
