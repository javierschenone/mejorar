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
| `tester` | Valida las features implementadas contra los criterios de aceptación de la spec. Plan de pruebas, e2e, informe de QA. | `**/*.test.ts`, `**/*.spec.ts`, `tests/**`, `specs/**/qa.md` | Código de producción |
| `cicd` | Implementa la entrega: pipelines, entornos, contenedores, migraciones automáticas, observabilidad, secretos. | `.github/workflows/**`, `Dockerfile*`, `docker-compose*`, `infra/**` | Código de aplicación |
| `compliance-legal` | Revisor. Verifica que cada spec y cada implementación respete el marco normativo argentino y marque lo que requiere validación de un abogado matriculado. | `specs/**/cumplimiento.md`, `docs/03-*` | Código |

Un agente que necesita tocar algo fuera de su columna "Escribe" **no lo toca**:
reporta el bloqueo al orquestador, que asigna al agente correcto.

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

## 6. Estado actual

Fase: **ciclo 001 + 004, compuerta G1.**

| Compuerta | Estado |
| --- | --- |
| G0 — proceso, roster y backlog | **APROBADA** (2026-09-20) |
| G1 — spec 001 Fundaciones | pendiente: 1 decisión abierta (001-A) |
| G1 — spec 004 Motor de reglas legales | pendiente: dictamen APTO CON CONDICIONES; 004-B y CA-23 ya decididas; faltan 004-A, 004-C y 004-D |

Modalidad acordada con el product owner: **las seis compuertas, una por una.**

Material preexistente en el repositorio, producido antes de adoptar SDD y por lo
tanto **sujeto a revisión** en las compuertas correspondientes:

- `docs/01` a `docs/07`: documentación de visión, negocio, arquitectura,
  cumplimiento e integraciones. Se toma como **insumo de las specs**, no como
  spec aprobada.
- Andamiaje raíz (`package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`,
  `docker-compose.yml`, `.env.example`): **propuesta** pendiente de ratificación
  por el `arquitecto` en G2 y por `cicd` en G6.
