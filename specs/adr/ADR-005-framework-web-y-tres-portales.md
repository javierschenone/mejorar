# ADR-005 — Framework web y convivencia de los tres portales en una sola aplicación

| Campo | Valor |
| --- | --- |
| Estado | PROPUESTO |
| Fecha | 2026-09-20 |
| Autor | arquitecto |
| Aprobado por | pendiente — G2, feature 001 |
| Spec de origen | `specs/001-fundaciones/spec.md` (CA-02, CA-10) |

## Contexto

Hay tres audiencias: el cliente deudor, el abogado y el administrador. Comparten
el mismo backend y el mismo modelo; se diferencian por permisos y por lo que
pueden ver (criterio 4 del mandato: un backend, tres vistas, no tres productos).

La audiencia principal está bajo estrés financiero, entra mayormente desde
teléfonos de gama baja y con conexión pobre, y la constitución #13 exige WCAG
2.2 AA. El portal del cliente además tiene páginas públicas de captación donde
la velocidad de la primera carga y el posicionamiento importan comercialmente.

La spec 001 sólo pide la cáscara y el ingreso demostrativo (CA-10); el sistema
de diseño es de `ux-expert` a partir de la 002.

## Decisión

La web es **una única aplicación Next.js (App Router, React 19)** en
`apps/web`, con los tres portales como **grupos de ruta** dentro del mismo
proyecto:

```
apps/web/src/app/
  (publico)/      páginas abiertas: captación, contenidos, ingreso
  (cliente)/      portal del deudor
  (abogado)/      portal del abogado
  (admin)/        back-office
```

Reglas que acompañan a la decisión:

1. **La autorización no la decide el portal.** Cada grupo de ruta comprueba la
   sesión y el rol en el servidor antes de renderizar, pero la fuente de verdad
   es la API: la web nunca muestra un dato que el backend no le habría dado. Un
   portal es una vista, no un límite de seguridad.
2. **La web no habla con la base ni con terceros.** `apps/web` no puede depender
   de `@mejorar/integrations` ni de `@prisma/client`; su única fuente de datos
   es la API HTTP. Se aplica mecánicamente (ADR-009).
3. **Las reglas de negocio se importan, no se reimplementan.** Validaciones de
   formulario y simuladores usan los esquemas y las funciones de
   `@mejorar/shared`.
4. Renderizado del lado del servidor para lo público (velocidad de primera
   carga y posicionamiento); componentes de cliente sólo donde hay
   interactividad real.
5. El sistema de diseño, los componentes y el microcopy son de `ux-expert`
   (specs 002 en adelante). En 001 las pantallas son cáscaras explícitamente
   rotuladas como provisionales.

## Alternativas consideradas

| Alternativa | A favor | En contra | Por qué no |
| --- | --- | --- | --- |
| **Tres aplicaciones Next.js separadas** | Despliegue y permisos independientes; el back-office nunca se sirve al público | Triplica configuración, dependencias y pipeline; el componente compartido necesita un cuarto paquete; tres veces el costo de cada cambio de diseño | Contradice "un backend, tres portales". Si el back-office necesitara aislamiento real, se extrae después |
| **Vite + React Router (SPA)** | Más simple, sin servidor de renderizado, build rapidísimo | Sin renderizado en servidor: primera carga peor en gama baja y peor posicionamiento en la parte pública, que es captación comercial | La audiencia y el canal de captación pesan más que la simplicidad |
| **Remix / React Router v7 en modo framework** | Muy buen modelo de datos, estándares web | Ecosistema y oferta de talento menores; menos material y menos ejemplos | "Aburrido gana" entendido como "lo que más gente sabe mantener" |
| **Renderizar la web desde la API (plantillas)** | Un solo despliegue, menos JavaScript | La app móvil obliga igual a tener API JSON; se duplicaría la capa de presentación | Sin beneficio neto |
| **Sólo PWA, sin app nativa** | Un cliente menos | Decisión de producto, no de arquitectura; hay requisitos de push, biometría y cámara | Fuera del mandato del arquitecto |

## Consecuencias

**Positivas**

- Un cambio de diseño, de token o de componente impacta a los tres portales a la
  vez.
- Un solo pipeline, un solo despliegue, una sola configuración de accesibilidad
  y de medición.
- El paquete de la app móvil y el de la web comparten literalmente las mismas
  reglas de validación.

**Negativas**

- El código del back-office está en el mismo repositorio y en el mismo
  despliegue que la parte pública. **Mitigación obligatoria:** ningún dato ni
  lógica sensible viaja al cliente; toda comprobación es en servidor y contra la
  API. Queda como riesgo registrado (`plan.md` §7).
- El presupuesto de tamaño del paquete inicial se comparte entre portales: se
  fija objetivo numérico y se verifica en CI (`plan.md` §6).
- Next.js es un framework con opinión y con ritmo de cambio alto; cada
  actualización mayor cuesta.

**Qué cierra**

- Servir la web como sitio totalmente estático sin servidor.

## Cómo se revierte

- **Separar un portal en su propia aplicación:** costo medio y acotado. Los
  grupos de ruta ya aíslan el árbol de archivos; se mueve una carpeta, se
  extrae el código común a un paquete y se agrega un despliegue. Estimado: 3-5
  días por portal. Esta es la salida prevista si el back-office necesitara
  aislamiento de red.
- **Cambiar Next.js por otro framework de React:** costo alto (rutas, capa de
  datos, renderizado). La mitigación es la misma de siempre: la lógica de
  negocio no está en la web.
