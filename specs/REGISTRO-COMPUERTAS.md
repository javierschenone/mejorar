# Registro de compuertas

Bitácora de toda decisión humana del proyecto. Append-only: las entradas no se
editan ni se borran; una decisión que cambia se registra como entrada nueva que
referencia a la anterior.

| # | Fecha | Compuerta | Feature | Material presentado | Decisión | Quién | Motivo / observaciones |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 001 | 2026-09-20 | G0 | — | `CLAUDE.md`, `specs/CONSTITUCION.md`, `specs/PROCESO.md`, `specs/BACKLOG.md`, `.claude/agents/*` | **APROBADO** | Javier Schenone | Adopción de SDD, roster completo de 11 agentes (se conserva `compliance-legal`). Modalidad de compuertas: **las 6, una por una**. Primer ciclo: **001 Fundaciones + 004 Motor de reglas legales**. |
| 002 | 2026-09-20 | G1 | 001-fundaciones | `specs/001-fundaciones/spec.md` | **PENDIENTE** | — | Especificación de las fundaciones del monorepo. |
| 003 | 2026-09-20 | G1 | 004-motor-reglas-legales | `specs/004-motor-reglas-legales/spec.md`, `cumplimiento.md` | **PENDIENTE** | — | Especificación del motor de reglas legales argentinas. 4 decisiones abiertas para el humano. |

## Leyenda

- **APROBADO** — se avanza a la etapa siguiente.
- **APROBADO CON CAMBIOS** — se avanza incorporando las observaciones que se
  detallan en la fila.
- **RECHAZADO** — vuelve a la etapa anterior.
- **PENDIENTE** — presentado, esperando al humano. El trabajo está detenido.
