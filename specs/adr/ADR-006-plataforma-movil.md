# ADR-006 — Plataforma móvil: React Native con Expo

| Campo | Valor |
| --- | --- |
| Estado | PROPUESTO |
| Fecha | 2026-09-20 |
| Autor | arquitecto |
| Aprobado por | pendiente — G2, feature 001 |
| Spec de origen | `specs/001-fundaciones/spec.md` (CA-02, CA-10) |

## Contexto

El deudor usa el teléfono. Hay que estar en iOS y en Android con un equipo
chico, sin especialistas en Swift ni en Kotlin, y compartir con la web y la API
las reglas legales y financieras: si el simulador de quita de la app dice algo
distinto de lo que dice la web, el problema es de credibilidad, no de software.

Requisitos que ya se conocen del producto: notificaciones push, carga de
evidencia desde cámara y archivos, biometría, y funcionamiento razonable en
gama baja y con conexión pobre (constitución #13). La publicación en tiendas es
de la spec 025.

## Decisión

La app es **React Native con Expo** (flujo administrado, *dev client* cuando se
necesite un módulo nativo), navegación con **Expo Router**, compartiendo
`@mejorar/shared` con la web y la API.

Reglas que acompañan:

1. **La app es cliente de la API y de nada más.** No puede depender de
   `@mejorar/integrations` ni de ningún acceso a datos. Se aplica
   mecánicamente (ADR-009).
2. **Un solo lenguaje para los tres clientes.** Toda regla de negocio que la app
   necesite se importa de `@mejorar/shared`; no se reescribe.
3. La compilación y la firma se hacen con el servicio de build de Expo
   (definición y credenciales: spec 025, `cicd`). En 001 el entregable es que la
   app levante en el simulador y en el cliente de desarrollo, y que resuelva
   correctamente los paquetes del workspace.
4. Metro necesita configuración explícita para resolver enlaces simbólicos del
   monorepo y el `dist/` de los paquetes compartidos; es tarea de `dev-mobile`
   y es el riesgo técnico más concreto de esta feature (`plan.md` §7).

## Alternativas consideradas

| Alternativa | A favor | En contra | Por qué no |
| --- | --- | --- | --- |
| **React Native "bare"** (sin Expo) | Control total de la capa nativa, sin intermediario | Toda la cadena de build, firma, actualización y push queda a cargo del equipo; hoy no hay quién la sostenga | Expo resuelve exactamente el trabajo que este equipo no puede absorber |
| **Flutter** | Excelente rendimiento y consistencia visual | Dart: segundo lenguaje, segundo ecosistema y, sobre todo, **imposibilidad de compartir `@mejorar/shared`**. Habría que reimplementar las reglas legales en Dart y mantenerlas sincronizadas | Duplicar el dominio legal es el peor resultado posible para este producto |
| **Nativo puro (Swift + Kotlin)** | Lo mejor por plataforma | Tres implementaciones del dominio y dos equipos que no existen | Inviable con el equipo real |
| **Sólo PWA** | Un cliente menos, cero tiendas | Push en iOS limitado, biometría y captura de evidencia con restricciones, percepción de producto menor; la app es canal de retención | Se descarta como reemplazo; la web sigue siendo responsive igual |
| **Capacitor sobre la web Next.js** | Reutiliza la web entera | Rendimiento y ergonomía pobres en gama baja, que es justamente el parque de la audiencia; Next.js no está pensado para empaquetarse así | Contradice el requisito de funcionar bien en equipos modestos |

## Consecuencias

**Positivas**

- Un solo lenguaje y un solo dominio para los tres clientes.
- Actualizaciones de contenido JavaScript sin pasar por revisión de tienda
  (dentro de lo que permiten las políticas), valioso cuando cambia una norma.
- Push, cámara, biometría y almacenamiento seguro resueltos por módulos
  mantenidos.

**Negativas**

- Dependencia de un proveedor (Expo) en la cadena de build y de actualización.
  Mitigación: el flujo administrado es abandonable (`expo prebuild` produce los
  proyectos nativos) y la app en sí sigue siendo React Native estándar.
- Las actualizaciones de SDK de Expo son periódicas y obligatorias; hay que
  presupuestar mantenimiento.
- Metro y los monorepos con enlaces simbólicos conviven, pero no gratis.
- Segundo runner de tests (`jest-expo`), ver ADR-008.

**Qué cierra**

- Funciones que exijan módulos nativos no soportados obligan a salir del flujo
  administrado (costo previsto, no bloqueante).

## Cómo se revierte

- **Salir del flujo administrado a bare:** camino soportado y de ida y vuelta
  parcial (`expo prebuild`). Costo: 2-3 días más asumir la cadena de build.
- **Abandonar React Native:** costo muy alto (reescritura completa de la app) y,
  peor, reimplementación del consumo del dominio. Se considera la decisión menos
  reversible de este plan; por eso se eligió la opción que **no** obliga a
  duplicar el dominio.
