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
| 007 | 2026-09-20 | G1 | 004-motor-reglas-legales | Decisión **004-A** — carga inicial de valores normativos | **DECIDIDO: opción A** | Javier Schenone | Estimaciones cargadas con `requiereValidacionProfesional`, más bloqueo duro: en entorno productivo un parámetro sin ratificar no puede usarse y el bloqueo no admite anulación por configuración. Permite implementar y validar el motor completo ahora. Cumple la condición **C-02**. |
| 008 | 2026-09-20 | G1 | 004-motor-reglas-legales | Decisión **004-C** — origen de los valores de referencia variables | **DECIDIDO: opción B** | Javier Schenone | El salario mínimo y las tasas se obtienen automáticamente de la fuente oficial, pero quedan en estado propuesto y no se usan en ningún cálculo hasta que una persona los activa. Un valor mal cargado alteraría la embargabilidad de toda la cartera y la validación de capacidad de pago de las suscripciones (constitución #7). |
| 009 | 2026-09-20 | G1 | 004-motor-reglas-legales | Decisión **004-D** — alcance jurisdiccional del análisis de honorarios | **DECIDIDO: opción B (se aparta de la recomendación)** | Javier Schenone | Cobertura ampliada: nacional y federal más Buenos Aires, CABA, Córdoba y Santa Fe. `compliance-legal` y la spec recomendaban limitarse a nacional/federal. **Consecuencia asumida:** cada jurisdicción agregada suma un juego completo de parámetros arancelarios que el estudio jurídico debe ratificar antes de G4, lo que agranda la dependencia externa C-03. Las jurisdicciones sin parámetros siguen devolviendo INDETERMINABLE (CA-52). |
| 010 | 2026-09-20 | **G1** | 004-motor-reglas-legales | `spec.md` **versión 2** — 62 criterios de aceptación, 14 reglas de negocio, 11 de las 12 condiciones del dictamen cumplidas. | **APROBADA** | Javier Schenone | Avanza a G2. C-03 (firma del estudio jurídico) queda abierta como dependencia externa con límite en G4. |
| 011 | 2026-09-20 | G1 | 001-fundaciones | Decisión **001-A** — destino del andamiaje preexistente | **DECIDIDO: opción A** | Javier Schenone | Se conserva como propuesta. El `arquitecto` lo audita en G2 y lo ratifica o lo corrige con fundamento. Nada entra al proyecto sin pasar por una compuerta. |
| 012 | 2026-09-20 | **G1** | 001-fundaciones | `spec.md` — 11 criterios de aceptación, 5 reglas. | **APROBADA** | Javier Schenone | Avanza a G2. |
| 013 | 2026-09-20 | G2 | 001 y 004 | Convocatoria de `arquitecto` (plan y ADRs de ambas features), `database-engineer` (modelo de datos de 004) y `ux-expert` (diseño de 004) | **EN CURSO** | — | Rangos de ADR asignados para evitar colisión: 001 → ADR-001..009, 004 → ADR-010..019. |

## Leyenda

- **APROBADO** — se avanza a la etapa siguiente.
- **APROBADO CON CAMBIOS** — se avanza incorporando las observaciones que se
  detallan en la fila.
- **RECHAZADO** — vuelve a la etapa anterior.
- **PENDIENTE** — presentado, esperando al humano. El trabajo está detenido.
