# Plan técnico NNN — <Título>

| Campo | Valor |
| --- | --- |
| Autor | arquitecto |
| Spec de origen | `specs/NNN-slug/spec.md` |
| Estado | BORRADOR \| APROBADO (G2) |

## 1. Enfoque

En tres párrafos: cómo se resuelve, y por qué así.

## 2. Alcance técnico por componente

| Componente | Cambios | Agente responsable |
| --- | --- | --- |
| `packages/shared` | | `dev-dominio` |
| `packages/integrations` | | `dev-integraciones` |
| `apps/api` | | `dev-backend` |
| `apps/web` | | `dev-web` |
| `apps/mobile` | | `dev-mobile` |

## 3. Contratos

Interfaces públicas que cruzan componentes: firmas de funciones del dominio,
endpoints con request/response, eventos. Van versionadas en `specs/contratos/`.

## 4. Decisiones de arquitectura

Las significativas se extraen a un ADR propio en `specs/adr/`. Acá sólo el
índice y el resumen de una línea de cada una.

## 5. Alternativas descartadas

| Alternativa | Por qué no |
| --- | --- |

## 6. Atributos de calidad

| Atributo | Objetivo | Cómo se verifica |
| --- | --- | --- |
| Rendimiento | | |
| Seguridad | | |
| Disponibilidad | | |
| Auditabilidad | | |
| Accesibilidad | WCAG 2.2 AA | |

## 7. Riesgos técnicos

| Riesgo | Impacto | Mitigación |
| --- | --- | --- |

## 8. Plan de despliegue

Migraciones, feature flags, compatibilidad hacia atrás, rollback.
