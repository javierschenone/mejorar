# Backlog priorizado

Estado: **propuesta del orquestador, pendiente de aprobación humana en G0.**

Cada ítem es una unidad que atraviesa el ciclo SDD completo (G1→G6). El número
es el identificador permanente de la carpeta `specs/NNN-slug/`.

## Ola 0 — Habilitadores

Sin esto no se puede construir nada más. Deberían ser ciclos cortos.

| # | Feature | Por qué primero | Agentes |
| --- | --- | --- | --- |
| 001 | **Fundaciones del monorepo** — estructura, tooling, convenciones, pipeline mínimo. Ratifica o corrige el andamiaje preexistente. | Desbloquea a todos. | `arquitecto`, `cicd` |
| 002 | **Identidad y acceso** — registro, login, MFA, recuperación, RBAC por permiso, los tres perfiles. | Todo lo demás cuelga de saber quién es quién y qué puede ver. | `arquitecto`, `database-engineer`, `ux-expert`, `dev-backend`, `dev-web`, `tester` |
| 003 | **Consentimientos y datos personales** — consentimiento versionado por finalidad, derechos de acceso/rectificación/supresión, bitácora de auditoría. | Ley 25.326. Sin esto no se puede consultar un solo bureau. Constitución #5. | `compliance-legal`, `database-engineer`, `dev-backend`, `dev-dominio` |

## Ola 1 — Núcleo de valor

El diferencial del producto. Es lo que hace que alguien se registre.

| # | Feature | Descripción | Agentes |
| --- | --- | --- | --- |
| 004 | **Motor de reglas legales argentinas** | Prescripción liberatoria, topes de interés (Ley 25.065 y BCRA), plazos de archivo de información crediticia (Ley 25.326 art. 26), topes de embargabilidad (Dec. 484/87), límites de honorarios y cuota litis. Todo como parámetros citados y validables. | `compliance-legal`, `arquitecto`, `dev-dominio`, `tester` |
| 005 | **Motor financiero** | Capacidad de pago real sin comprometer el mínimo inembargable, recomposición de saldos, simulador de quitas y de planes de pago. | `dev-dominio`, `tester` |
| 006 | **Captación y onboarding del deudor** | Alta con fricción mínima, validación de CUIL, promesa clara, precio visible. | `ux-expert`, `dev-web`, `dev-mobile`, `dev-backend` |
| 007 | **Diagnóstico de deuda** | Consolidación desde BCRA, bureaus y carga asistida. Detección de deuda presumiblemente prescripta, de intereses por encima del tope y de información crediticia vencida. **Es el gancho del producto.** | `dev-integraciones`, `dev-backend`, `ux-expert`, `dev-web`, `dev-mobile`, `tester` |

## Ola 2 — Gestión y negociación

Donde el producto entrega el beneficio que promete.

| # | Feature | Descripción |
| --- | --- | --- |
| 008 | **Expediente del caso** | Máquina de estados, línea de tiempo, chat, documentos, asignación. |
| 009 | **Negociación individual** | Ofertas, contraofertas, acuerdos, firma, registro de la quita lograda. |
| 010 | **Cumplimiento del acuerdo** | Cuotas, seguimiento, alertas, consecuencias del incumplimiento. |
| 011 | **Negociación colectiva** | Armado de colectivos por acreedor y producto, propuesta de cartera, distribución de la quita. |
| 023 | **Notificaciones multicanal** | Push, email y WhatsApp con preferencias, franja horaria y registro de envío. |

## Ola 3 — Asistencia legal

| # | Feature | Descripción |
| --- | --- | --- |
| 012 | **Marketplace de abogados** | Alta y verificación de matrícula, matching por jurisdicción y especialidad, aceptación de casos. |
| 013 | **Portal del abogado** | Estudio digital: cartera, expedientes, plantillas, agenda, liquidaciones. |
| 014 | **Documentos legales y firma** | Poder de gestión extrajudicial, convenio de honorarios, carta documento, firma electrónica y acuse. |
| 015 | **Defensa del Consumidor** | Armado y presentación de denuncias, carga de evidencia, seguimiento de audiencias. |
| 016 | **Juicios y embargos** | Detección de causas, seguimiento, verificación de topes de embargabilidad. |

## Ola 4 — Monetización

| # | Feature | Descripción |
| --- | --- | --- |
| 017 | **Suscripciones** | Planes, alta con validación de capacidad de pago, cobro recurrente, baja inmediata en línea. |
| 018 | **Comisión de éxito** | Devengamiento contra acuerdo firmado, atado al cumplimiento, con topes duros. |
| 019 | **Tarifas de abogados** | Abono de plataforma, fee por lead, fee por caso. Nunca porcentaje de honorarios. |
| 020 | **Facturación electrónica** | AFIP/ARCA, comprobantes por concepto. |

## Ola 5 — Escala y operación

| # | Feature | Descripción |
| --- | --- | --- |
| 021 | **Educación financiera** | Cursos, progreso, simuladores, certificados. |
| 022 | **Back-office** | Métricas del negocio, parámetros normativos, gestión de usuarios y acreedores, consulta de auditoría. |
| 024 | **App móvil completa** | Paridad definida con la web, offline, push, biometría, carga de evidencia. |
| 025 | **Entrega continua y observabilidad** | Entornos, despliegue reversible, alertas, publicación en tiendas. |

## Dependencias críticas

```
001 ─┬─▶ 002 ─┬─▶ 003 ─┬─▶ 007 ─▶ 008 ─┬─▶ 009 ─▶ 010 ─▶ 018
     │        │        │               ├─▶ 011
     │        │        └─▶ 004 ─▶ 005 ─┘
     │        ├─▶ 006
     │        ├─▶ 012 ─▶ 013 ─▶ 014 ─▶ 015
     │        │                      └─▶ 016
     │        └─▶ 017 ─▶ 019 ─▶ 020
     └─▶ 025
```

## Recomendación del orquestador para el primer ciclo

Arrancar por **001 + 004**:

- **001** es corto y ratifica (o corrige) el andamiaje que ya existe en el repo,
  dejando el proceso limpio.
- **004 (Motor de reglas legales)** es el mejor candidato a primer ciclo SDD
  completo: es el diferencial competitivo real, es dominio puro —se puede
  especificar, planificar, implementar y validar al 100% sin depender de UI ni
  de terceros—, y ejercita la cadena completa de compuertas con un entregable
  auditable. Si el motor legal está bien, todo lo demás se apoya en algo sólido.

Alternativa razonable: **rebanada vertical** (002 + 003 + 007 acotado) para
tener algo demostrable end-to-end antes. Cuesta más y toca a todos los agentes
a la vez.

**La decisión es del humano en G0.**
