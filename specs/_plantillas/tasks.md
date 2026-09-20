# Desglose de tareas NNN — <Título>

| Campo | Valor |
| --- | --- |
| Autor | orquestador |
| Estado | BORRADOR \| APROBADO (G3) |

## Orden de ejecución

```
Ola 1 (paralelo):  T-01  T-02
Ola 2:             T-03 (depende de T-01)
Ola 3 (paralelo):  T-04  T-05
Ola 4:             T-06 (QA)
```

## Tareas

| ID | Tarea | Agente | Archivos | Depende de | Criterios de aceptación que cubre | Estado |
| --- | --- | --- | --- | --- | --- | --- |
| T-01 | | `dev-dominio` | `packages/shared/src/...` | — | CA-01, CA-02 | PENDIENTE |

Estados: PENDIENTE → EN CURSO → EN REVISIÓN (G4) → HECHA → VALIDADA (G5).

## Cobertura

Toda fila de criterios de aceptación de la spec debe aparecer en al menos una
tarea. Verificar antes de presentar G3.

| Criterio | Tareas que lo cubren |
| --- | --- |
