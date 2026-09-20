# Registro de compuertas

Bitácora de toda decisión humana del proyecto. Append-only: las entradas no se
editan ni se borran; una decisión que cambia se registra como entrada nueva que
referencia a la anterior.

| # | Fecha | Compuerta | Feature | Material presentado | Decisión | Quién | Motivo / observaciones |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 001 | 2026-09-20 | G0 | — | `CLAUDE.md`, `specs/CONSTITUCION.md`, `specs/PROCESO.md`, `specs/BACKLOG.md`, `.claude/agents/*` | **APROBADO** | Javier Schenone | Adopción de SDD, roster completo de 11 agentes (se conserva `compliance-legal`). Modalidad de compuertas: **las 6, una por una**. Primer ciclo: **001 Fundaciones + 004 Motor de reglas legales**. |
| 002 | 2026-09-20 | G1 | 001-fundaciones | `specs/001-fundaciones/spec.md` | **PENDIENTE** | — | Especificación de las fundaciones del monorepo. |
| 003 | 2026-09-20 | G1 | 004-motor-reglas-legales | `specs/004-motor-reglas-legales/spec.md`, `cumplimiento.md` | **PENDIENTE** | — | Dictamen de `compliance-legal`: APTO CON CONDICIONES (12 condiciones, 15 defectos). Decisiones 004-A, 004-C y 004-D todavía abiertas. |
| 004 | 2026-09-20 | G1 | 004-motor-reglas-legales | Decisión **004-B** — visibilidad del hallazgo de prescripción | **DECIDIDO: opción B** | Javier Schenone | Visible para abogado y operador; al cliente sólo tras confirmación profesional. Con los cinco recaudos del dictamen §7.1, entre ellos B-1 (advertencia preventiva inmediata, gratuita e incondicional: no reconocer la deuda, no firmar planes, no hacer pagos parciales) y B-3 (el diferimiento es profesional y nunca comercial). Cumple la condición **C-01**. |
| 005 | 2026-09-20 | G1 | 004-motor-reglas-legales | Decisión sobre **CA-23** — interacción entre cuota litis y comisión de plataforma | **DECIDIDO: topes separados con compromiso interno** | Javier Schenone | El tope arancelario limita únicamente al abogado. La comisión de plataforma tiene su propio tope contractual. Se agrega una regla interna de que la suma no supere un porcentaje del beneficio neto del cliente. Mantiene la separación exigida por la constitución #10 (prohibición de partición de honorarios) sin dejar al cliente sin techo agregado. Cumple la condición **C-09**. |
| 006 | 2026-09-20 | G1 | 004-motor-reglas-legales | Verificación documental de los 12 puntos sin fuente oficial | **EN CURSO** | Javier Schenone | Se autoriza a `compliance-legal` a verificar los textos normativos en fuentes oficiales alternativas (SAIJ, Boletín Oficial, sitios de organismos), dado que InfoLeg resultó inaccesible desde el entorno. |

## Leyenda

- **APROBADO** — se avanza a la etapa siguiente.
- **APROBADO CON CAMBIOS** — se avanza incorporando las observaciones que se
  detallan en la fila.
- **RECHAZADO** — vuelve a la etapa anterior.
- **PENDIENTE** — presentado, esperando al humano. El trabajo está detenido.
