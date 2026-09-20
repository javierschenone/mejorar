# Proceso SDD — cómo se construye Mejorar

## Flujo por feature

```
┌──────────────────────────────────────────────────────────────────────────┐
│ 0. ENCUADRE          orquestador          backlog priorizado             │
│                                                                    ▼ G0  │
├──────────────────────────────────────────────────────────────────────────┤
│ 1. ESPECIFICAR       orquestador          specs/NNN-slug/spec.md         │
│                    + compliance-legal     specs/NNN-slug/cumplimiento.md │
│    ¿QUÉ problema, para quién, con qué criterios de aceptación?     ▼ G1  │
├──────────────────────────────────────────────────────────────────────────┤
│ 2. PLANIFICAR        arquitecto           specs/NNN-slug/plan.md         │
│                                           specs/adr/ADR-NNN-*.md         │
│                      database-engineer    specs/NNN-slug/modelo-datos.md │
│                      ux-expert            specs/NNN-slug/ux.md           │
│    ¿CÓMO se construye, con qué datos y con qué experiencia?        ▼ G2  │
├──────────────────────────────────────────────────────────────────────────┤
│ 3. DESGLOSAR         orquestador          specs/NNN-slug/tasks.md        │
│    Tareas atómicas, agente asignado, dependencias, orden.          ▼ G3  │
├──────────────────────────────────────────────────────────────────────────┤
│ 4. IMPLEMENTAR       dev-* (en paralelo   código + tests unitarios       │
│                      donde no hay deps)                                  │
│    Cada tarea = un commit con referencia a la spec.                ▼ G4  │
├──────────────────────────────────────────────────────────────────────────┤
│ 5. VALIDAR           tester               specs/NNN-slug/qa.md           │
│    Un resultado por criterio de aceptación. Sin excepciones.       ▼ G5  │
├──────────────────────────────────────────────────────────────────────────┤
│ 6. DESPLEGAR         cicd                 pipeline + release             │
│                                                                    ▼ G6  │
└──────────────────────────────────────────────────────────────────────────┘
```

## Estructura de una feature

```
specs/
├── CONSTITUCION.md
├── PROCESO.md
├── REGISTRO-COMPUERTAS.md
├── BACKLOG.md
├── _plantillas/
│   ├── spec.md
│   ├── plan.md
│   ├── modelo-datos.md
│   ├── ux.md
│   ├── tasks.md
│   ├── qa.md
│   ├── cumplimiento.md
│   └── adr.md
├── adr/
│   └── ADR-001-....md
├── contratos/            API/tipos acordados entre backend y clientes
└── 001-<slug>/
    ├── spec.md           G1
    ├── cumplimiento.md   G1
    ├── plan.md           G2
    ├── modelo-datos.md   G2
    ├── ux.md             G2
    ├── tasks.md          G3
    └── qa.md             G5
```

## Reglas del proceso

### Sobre las specs

- Una spec describe **comportamiento observable**, no implementación. Si menciona
  una tabla, un framework o un endpoint, está mal escrita: eso va en el plan.
- Todo criterio de aceptación es **verificable**: alguien externo debe poder
  decir sí o no sin interpretar.
- Toda ambigüedad se marca explícitamente con `[NECESITA DECISIÓN: ...]`. Una
  spec con marcas abiertas **no puede pasar G1**. El orquestador las lleva al
  humano como preguntas concretas con opciones.
- La sección "Fuera de alcance" es obligatoria. Lo que no está escrito ahí es
  ambigüedad, no alcance implícito.

### Sobre las compuertas

- El orquestador presenta en el chat un resumen de **una pantalla**: qué se
  decidió, qué alternativas se descartaron y por qué, y qué necesita del humano.
  El documento completo queda en el repo para quien quiera profundizar.
- Se avanza con un sí explícito. El silencio no aprueba.
- Cada paso por una compuerta se anota en `REGISTRO-COMPUERTAS.md`.
- Una compuerta rechazada vuelve a la etapa anterior; no se "parchea hacia
  adelante".

### Sobre la delegación

- El orquestador delega con un encargo cerrado: objetivo, insumos (rutas exactas
  de los documentos que el agente debe leer), entregable, límites, y criterios de
  terminado.
- Un agente que necesita una decisión humana **no la toma**: devuelve la pregunta
  al orquestador, que la lleva a la compuerta.
- Un agente que necesita tocar archivos fuera de su alcance reporta el bloqueo;
  no invade.
- Los agentes se ejecutan en paralelo sólo cuando sus entregables no se pisan.
  Dos desarrolladores no escriben en el mismo paquete al mismo tiempo.

### Sobre los cambios de rumbo

Si durante la implementación aparece algo que cambia el alcance, el costo, el
modelo de datos o el encuadre legal:

1. El agente detiene esa tarea (las demás siguen).
2. Reporta al orquestador con el hallazgo y las opciones.
3. El orquestador vuelve a la compuerta correspondiente (G1 si cambia el qué, G2
   si cambia el cómo) y consulta al humano.
4. Se actualiza la spec y se registra el cambio. **La spec nunca queda
   desactualizada respecto del código.**

### Sobre la trazabilidad

Cadena completa, verificable en cualquier momento:

```
Principio de la constitución
  └─ Feature del backlog
       └─ Criterio de aceptación de la spec
            └─ Tarea en tasks.md
                 └─ Commit (referencia la spec)
                      └─ Test que lo cubre
                           └─ Resultado en qa.md
                                └─ Aprobación humana en REGISTRO-COMPUERTAS.md
```
