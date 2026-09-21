# ADR-027 — Restitución del segundo factor perdido: espera obligatoria, doble control y mínima documentación

| Campo | Valor |
| --- | --- |
| Estado | PROPUESTO |
| Fecha | 2026-09-21 |
| Autor | arquitecto |
| Aprobado por | pendiente — G2, feature 002 |
| Spec de origen | `specs/002-identidad-y-acceso/spec.md` v3 (CA-35, §7) |
| Dictamen | §4.2 ("lo que la spec no vio en 002-B"), condición **C-002-12** |
| Contrato | `specs/contratos/identidad-y-acceso.ts` §8, bloque de restitución |
| Diseño | `ux.md` RE-4 y AB-2 |

## Contexto

Con el MFA obligatorio para `ABOGADO` y `ADMINISTRADOR` (decisión 002-B), la
pérdida del segundo factor deja de ser un caso raro y pasa a ser rutina. Y el
dictamen señala el problema que nadie había escrito: para verificar la identidad
de quien reclama, soporte va a pedir documentación —foto de documento, selfie,
comprobantes— y eso es **recolección de datos identificatorios adicionales, por
un canal no especificado, sin finalidad declarada, sin plazo de conservación y
sin base legal escrita**. Es exactamente el circuito que se improvisa en una
conversación de soporte y queda para siempre en una carpeta compartida.

Del otro lado hay un requisito de seguridad tan fuerte como el de privacidad: un
camino automático de restitución **es una puerta trasera del MFA**. Si existe un
botón que devuelve el acceso, el segundo factor vale lo que vale ese botón.

Y del lado del usuario hay un tercer requisito, que `ux.md` `[ESCALAMIENTO-D]`
plantea bien: un profesional sin segundo factor **no puede trabajar**, y un
plazo indefinido es el mismo problema de trato digno que CA-31 resolvió para la
matrícula.

## Decisión

**La restitución es un circuito humano, con espera obligatoria cancelable por el
titular, doble control para roles profesionales, escalera de comprobación
ordenada por minimización, y destrucción de la documentación al cerrar el caso.
La restitución nunca entrega una sesión: sólo desbloquea la reinscripción.**

### 1. Primero, las salidas que no requieren a nadie

1. **Código de respaldo** (ADR-023). No es una restitución: es un segundo factor.
2. **Otro dispositivo con el mismo secreto**, si la persona lo aprovisionó en dos
   lugares. La pantalla de inscripción lo sugiere explícitamente.

El circuito de abajo es para quien no tiene ninguna de las dos.

### 2. Apertura sin canal lateral

La solicitud se abre desde el desafío de ingreso (`ux.md` RE-4), o sea **después
de la contraseña y antes del segundo factor**. La solicitud sólo se persiste si
el primer factor fue correcto, pero la pantalla y la respuesta son idénticas en
todos los casos (ADR-025): pedir una restitución no puede servir para averiguar
si una contraseña es válida.

### 3. Espera obligatoria y cancelación por el titular

Abierta la solicitud, pasa a `EN_ESPERA_OBLIGATORIA` y **se avisa por todos los
canales registrados** con un enlace de un solo uso: *"si no fuiste vos, cancelá
esto acá"*. La cancelación (`CANCELADA_POR_EL_TITULAR`) es inmediata, no admite
apelación por el mismo canal y genera evento.

Ésta es la defensa principal del circuito: **el atacante puede engañar a un
operador, pero no puede evitar que el titular real se entere y cancele**. La
duración de la espera es un parámetro de producto y es `[ESCALAMIENTO-D]` de
`ux.md`; la recomendación del arquitecto, escalada como **E-3** del plan, es
**72 horas para `CLIENTE` y 24 horas hábiles para `ABOGADO` y `ADMINISTRADOR`**,
con escalamiento automático al vencerse el plazo de resolución, en la misma
forma que CA-31.

Durante la espera, la cuenta profesional queda en `RESTITUCION_MFA_EN_CURSO`:
sin operar, pero con el estado visible y con fecha concreta de resolución. No
hay limbo sin plazo.

### 4. Escalera de comprobación, ordenada por minimización

El operador usa el **primer escalón que alcance**, y sube sólo si el anterior no
resuelve:

| Escalón | Comprobación | Datos nuevos recolectados |
| --- | --- | --- |
| 1 | Canal alternativo **ya registrado antes del incidente** (correo verificado; a futuro, teléfono si alguna feature lo incorpora) | **Ninguno** |
| 2 | Videollamada con operador: se coteja a la persona con los datos que ya están en la cuenta | Ninguno persistido: **no se graba** |
| 3 | Documento de identidad, visto por un visor de acceso restringido | Los mínimos, y se destruyen al cerrar |

**El escalón 3 nunca por correo, ni por mensajería, ni por adjunto.** La carga
va por un enlace de un solo uso a un almacenamiento cifrado, separado de la base
principal, con acceso limitado a quien instruye el caso y con cada apertura
auditada.

**El catálogo definitivo de comprobaciones admisibles y su base legal no lo
decide el arquitecto**: es de `compliance-legal` con el product owner
(**escalamiento E-4** del plan). Por eso `ClaseDeComprobacionDeIdentidad`
incluye el brazo `A_DEFINIR_EN_G2`: el contrato declara la forma para que el
circuito no pueda operar sin registro, no para cerrar la decisión.

### 5. Doble control para roles profesionales

Para `ABOGADO` y `ADMINISTRADOR`: **una persona instruye y otra distinta
aprueba**. La invariante `instruidaPor !== aprobadaPor` se verifica en el
dominio y en la base. Para `CLIENTE`: un operador con permiso, más la espera
obligatoria.

Los permisos son tres y separados —`restitucionMfa.solicitar.propia`,
`restitucionMfa.instruir`, `restitucionMfa.aprobar`— justamente para que puedan
recaer en personas distintas.

### 6. Resolución

Aprobada: el segundo factor pasa a `NO_CONFIGURADO`, **se cierran todas las
sesiones**, se fuerza la reinscripción en el ingreso siguiente y se avisa por
todos los canales. **La restitución no emite ninguna sesión por sí misma**: la
persona sigue necesitando su contraseña. Es lo que impide que el circuito sea
una puerta trasera completa.

Tiempo de enfriamiento: una segunda restitución dentro de los 90 días exige
doble control aunque sea `CLIENTE`, y se marca para revisión.

### 7. Qué queda y qué se destruye

Al cerrar el caso se destruye la documentación y sólo sobrevive
`ConstanciaDeVerificacionDeIdentidad`: **qué clase** de comprobación se hizo,
**quién** la hizo, **cuándo** y con qué resultado. Nunca el documento ni su
contenido. La destrucción es un trabajo programado con su propio evento
(`DOCUMENTACION_DE_RESTITUCION_DESTRUIDA`), de modo que la destrucción también
es auditable. Coincide con la propuesta del dictamen para
`retencion.documentacionRecuperacionMFA`.

### Verificación

Un test por CA-35. Además: la solicitud no revela validez de contraseña; la
cancelación por el titular cierra el caso en cualquier estado previo a la
aprobación; el mismo usuario no puede instruir y aprobar; la aprobación no emite
tokens; la documentación desaparece y la constancia queda; y cada paso del
circuito produce su evento de auditoría.

## Alternativas consideradas

| Alternativa | A favor | En contra | Por qué no |
| --- | --- | --- | --- |
| Restitución automática por enlace al correo | Cero trabajo humano, instantánea | Reduce el MFA a un solo factor: quien controla el correo entra. Es la puerta trasera que el §7 de la spec descarta expresamente | Anula la decisión 002-B |
| Restitución por el equipo de soporte sin espera | Rápida para el usuario legítimo | La ingeniería social contra un operador apurado es el ataque más barato que existe contra este circuito | La espera cancelable es lo que convierte el engaño al operador en un ataque detectable |
| Espera sin aviso al titular | Más simple | Sin aviso, la espera no defiende nada: sólo demora | El aviso **es** la defensa; la espera es la ventana para reaccionar |
| Verificación de identidad con un proveedor externo (KYC, prueba de vida) | Verificación fuerte y trazable | Un encargado de tratamiento nuevo, con datos biométricos —los más sensibles del sistema—, transferencia internacional probable y costo por verificación. `docs/03` ya marca que el KYC del producto es liviano a propósito | Desproporcionado para restituir un factor. Volvería a compuerta con dictamen específico |
| Guardar la documentación "por las dudas" | Prueba disponible ante un reclamo | Conservación sin finalidad subsistente (art. 4 inc. 7); crea un repositorio de documentos de identidad que hay que custodiar para siempre | La constancia de que la verificación ocurrió es la prueba; el documento no |
| Códigos de respaldo únicamente, sin circuito humano | Elimina el problema entero | Quien perdió el teléfono y los códigos queda fuera del servicio para siempre; con MFA obligatorio, un abogado perdería su cartera | Inaceptable bajo art. 8 bis y constitución #1 |
| Un solo operador también para roles profesionales | Menos fricción operativa con equipo chico | La cuenta de un abogado expone a todos sus clientes; la de un administrador, a todos los titulares | El doble control es barato: son dos clics de dos personas |

## Consecuencias

**Positivas**

- El circuito existe, está escrito y es auditable de punta a punta: cierra
  C-002-12, que hoy es el hueco más probable de improvisación.
- La documentación sensible se recolecta sólo si hace falta y no sobrevive al
  caso.
- Un ataque por ingeniería social requiere engañar a dos personas **y** que el
  titular real no reaccione en el plazo de espera.

**Negativas**

- **Es trabajo humano con costo operativo real**, y crece con el MFA
  obligatorio. Hay que dimensionar el equipo de soporte antes del piloto.
- Un profesional legítimo espera hasta 24 horas hábiles para volver a trabajar.
  Es el precio de no tener puerta trasera; se mitiga insistiendo en los códigos
  de respaldo y en el segundo dispositivo.
- Hay almacenamiento cifrado separado que construir y operar, aunque casi
  siempre esté vacío.

**Qué cierra**

- Cualquier camino automático de restitución.
- Recibir documentación de identidad por correo o mensajería.
- Conservar documentación después de cerrado el caso.

## Cómo se revierte

- **Acortar o eliminar la espera**: es un parámetro; eliminarla requiere
  decisión humana registrada, porque es la defensa principal del circuito.
- **Pasar a verificación con proveedor externo**: el puerto de comprobación está
  declarado en el contrato como enumerado extensible; agregar un escalón es
  aditivo, pero requiere dictamen de `compliance-legal` y contrato de encargado
  de tratamiento antes de tocar un dato.
- **Quitar el doble control**: un cambio de invariante, medio día. Desaconsejado
  y con test en contra.
