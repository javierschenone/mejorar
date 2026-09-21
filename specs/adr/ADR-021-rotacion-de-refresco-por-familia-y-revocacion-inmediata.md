# ADR-021 — Rotación de refresco por familia, detección de reutilización sin ventana de gracia y revocación que falla cerrado

| Campo | Valor |
| --- | --- |
| Estado | PROPUESTO |
| Fecha | 2026-09-21 |
| Autor | arquitecto |
| Aprobado por | pendiente — G2, feature 002 |
| Spec de origen | `specs/002-identidad-y-acceso/spec.md` v3 (CA-10, CA-11, CA-13, CA-14, R-06) |
| Contrato | `specs/contratos/identidad-y-acceso.ts` §7 |

## Contexto

R-06 lo pone como obligación, no como opción: rotación con detección de
reutilización. CA-10 exige que el refresco usado quede registrado como usado;
CA-11 exige que el segundo uso cierre **todas** las sesiones de la cuenta y
avise; CA-14 exige que el corte tenga efecto inmediato; el §7 de la spec agrega
que una operación en curso también se corta, sin excepción por "estar a mitad de
algo".

Las dos decisiones difíciles son: **dónde vive la marca de "usado"** —porque
tiene que sobrevivir a un reinicio y a la caída de la caché— y **si se tolera
una ventana de gracia** para el caso frecuentísimo del cliente móvil que
reintenta la misma rotación por una red mala. La ventana de gracia es lo que
hace casi todo el mercado; también es un agujero de treinta segundos.

## Decisión

**El refresco es una cadena opaca por familia, se rota en cada uso, y el segundo
uso de una generación ya consumida es un incidente inmediato sin ventana de
gracia. La vigencia de la sesión se consulta en cada petición contra un índice
negativo que falla cerrado.**

### 1. Forma del token

- No es un JWT. Es `<idFamilia>.<secreto>`, con **256 bits** de aleatoriedad
  criptográfica en el secreto. El `idFamilia` es un ULID opaco y sólo existe
  para encontrar la fila sin recorrer la tabla; no autoriza nada por sí solo.
- Se guarda **`HMAC-SHA-256(secreto, pimienta)`**, con la pimienta fuera de la
  base (misma custodia que ADR-024). Con 256 bits de entropía no hace falta un
  hash lento; la clave sirve para que alguien con escritura en la base **no
  pueda plantar** un refresco válido, que es el escenario que un hash simple no
  cubre.
- La comparación es en tiempo constante.

### 2. Familia y generación

Una familia = una sesión = una cadena de rotaciones. Cada rotación incrementa
`generacion`. Se guarda el hash de la generación vigente y el de las
**anteriores todavía no vencidas**, marcadas como usadas.

| Se presenta | Resultado |
| --- | --- |
| Hash de la generación vigente, familia activa | `ROTADO`: se marca usada, se emite la generación siguiente, evento `REFRESCO_ROTADO` |
| Hash de una generación anterior, marcada como usada | **`REUTILIZACION_DETECTADA`** |
| Hash inexistente, familia inexistente, familia ya revocada, o vencido | `NO_ACEPTABLE` → `401` idéntico al de credencial inválida (CA-12) |

### 3. Reutilización: sin ventana de gracia

Detectada la reutilización: se revoca la familia entera, **se revocan todas las
sesiones de la cuenta** (CA-11), se emite
`REUTILIZACION_DE_REFRESCO_DETECTADA` en la bitácora y se envía el correo
accionable `REUTILIZACION_DE_REFRESCO` con clave de idempotencia. No hay
excepción por operación en curso. No se le dice al presentante qué pasó: recibe
el mismo `401` de siempre.

**No se implementa ventana de gracia**, aunque es la práctica habitual. CA-11
dice "un token de refresco ya usado ⇒ reutilización", y una ventana de gracia es
reinterpretarlo. El problema real que la gracia resuelve —el reintento del
cliente— se resuelve del lado del cliente, que es donde está la causa:

- **Obligación F-10**: `dev-web` y `dev-mobile` implementan la renovación con
  *single-flight* (un único refresco en vuelo por proceso; las demás peticiones
  esperan ese resultado) y reintento **sólo** ante error de red antes de
  recibir respuesta, nunca ante `401`.
- Se mide: **falsos positivos de reutilización / rotaciones totales**. Si supera
  **0,5 %** sostenido, el asunto vuelve a G2 con la propuesta de gracia acotada,
  con número medido en la mano. No se decide hoy por las dudas.

### 4. Revocación con efecto inmediato

- `IndiceDeRevocacion` es un índice **negativo** en Redis: sólo contiene las
  sesiones revocadas, con expiración igual a la del último token de acceso
  emitido para esa sesión. Es chico y se consulta en cada petición.
- Cachear "revocada" en memoria del proceso **es seguro** (la revocación es
  monótona: nunca vuelve atrás). Cachear "no revocada" **está prohibido**: es
  exactamente lo que rompe CA-14.
- **Falla cerrado.** El índice lleva una `marcaDeGeneracion` que se escribe al
  poblarlo. Si Redis no responde, o responde con una generación distinta de la
  esperada (se vació, se reemplazó la instancia), la verificación **no** asume
  vigencia: consulta PostgreSQL. Si PostgreSQL tampoco responde, la petición se
  rechaza con `503`. Un índice negativo vacío es el modo de falla peligroso de
  este patrón y por eso se detecta explícitamente.
- Lo mismo vale para el cierre a distancia (CA-13/CA-14), el cambio de
  contraseña (CA-16) y la suspensión de matrícula (CA-30): todos escriben en el
  índice y en la base, en ese orden inverso (primero base, después índice), de
  modo que un fallo entre las dos deja el sistema del lado seguro.

### 5. Metadatos de la sesión

Cada sesión guarda creación, último uso, dispositivo por categoría cerrada y
ubicación aproximada de resolución local (ADR-029). Son datos personales
tratados (R-09) con plazo de conservación propio (`retencion.sesionCerrada`,
propuesta 90 días). La IP **no se le muestra al cliente** —decisión de `ux.md`
CL-5, que este plan respeta— pero sí se guarda y sí se le muestra al profesional
en su propia vista.

### Verificación

Un test por CA-10, CA-11, CA-13 y CA-14. Además: rotación concurrente desde dos
procesos sobre la misma generación (uno rota, el otro dispara incidente); caída
simulada de Redis (la petición va a PostgreSQL y sigue rechazando la sesión
revocada); vaciado de Redis (la `marcaDeGeneracion` lo detecta y no se degrada a
permisivo); y medición de latencia entre el cierre a distancia y el primer
rechazo, con objetivo **≤ 1 segundo**.

## Alternativas consideradas

| Alternativa | A favor | En contra | Por qué no |
| --- | --- | --- | --- |
| Ventana de gracia de 30 s que devuelve el par ya emitido | Elimina los falsos positivos por red inestable; es lo que hacen Auth0 y otros | Abre 30 s en los que un token robado se usa sin disparar nada; y es una reinterpretación de CA-11, que el arquitecto no puede hacer | Se descarta **hoy**, con la puerta abierta y un umbral medido (0,5 %) que la reabre en compuerta |
| Refresco como JWT firmado con `jti` en lista negra | Verificación local | Igual hay que ir al almacén por el `jti`; y un JWT de refresco filtra su propio contenido | La cadena opaca no tiene contenido que filtrar y cuesta lo mismo |
| Sin rotación: refresco de larga vida | Simple, sin falsos positivos | R-06 lo prohíbe; un refresco robado vive meses sin señal alguna | Cerrado por la spec |
| Rotación sin familias: sólo invalidar el token usado | Menos estado | Sin familia no se puede distinguir "robaron la cadena" de "expiró": se pierde la señal de CA-11 | La familia **es** el mecanismo de detección |
| Guardar el refresco en claro | Comparación directa | Un volcado de la base entrega todas las sesiones activas | Inaceptable bajo art. 9 y constitución #5 |
| Hash simple SHA-256 sin clave | Un secreto menos que custodiar | No protege contra escritura maliciosa en la base | La pimienta ya existe para las contraseñas: costo marginal cero |
| Índice **positivo** de sesiones vigentes en Redis | Un vaciado de Redis falla cerrado por definición | Un vaciado desloguea a todo el mundo, incluido en un reinicio rutinario; y el índice es grande | Se prefiere el índice chico con detección explícita de vaciado |
| Revocar sólo la familia comprometida, no toda la cuenta | Menos daño al usuario legítimo | CA-11 dice "TODAS las sesiones activas de esa cuenta" | Cerrado por la spec, y además es lo correcto: no se sabe qué más se llevaron |

## Consecuencias

**Positivas**

- Un refresco robado se detecta en el primer uso cruzado y el daño se corta
  solo, sin intervención manual (métrica de la spec §10: 100 %).
- El corte a distancia es efectivo en menos de un segundo, y el modo de falla de
  la caché es cerrado y detectable, no silencioso.
- El almacén de refrescos no contiene nada reutilizable si se filtra.

**Negativas**

- Sin ventana de gracia, **va a haber falsos positivos** con redes malas, y cada
  uno le cierra todas las sesiones a una persona y le manda un correo de alarma.
  Es el costo consciente de no reinterpretar CA-11; lo acota F-10 y lo vigila
  una métrica con umbral de reapertura.
- Una consulta al índice por petición: ~0,3 ms de Redis. Entra en el
  presupuesto del plan §6.
- Hay estado nuevo que purgar (`retencion.tokenRefrescoUsado`).

**Qué cierra**

- Cachear "sesión vigente" en cualquier capa.
- Aceptar un refresco sin consultar el estado de su familia.

## Cómo se revierte

- **Agregar la ventana de gracia**: medio día, un campo de tiempo y una rama.
  Requiere decisión humana registrada porque toca la lectura de CA-11.
- **Cambiar el índice negativo por uno positivo**: un día, más una migración de
  caché y asumir que cada despliegue de Redis desloguea a todos.
- **Volver a refresco sin rotación**: prohibido por R-06; exigiría ADR de
  reemplazo y nuevo dictamen.
