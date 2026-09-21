# Catálogo de comprobaciones de identidad para la restitución de un segundo factor perdido

| Campo | Valor |
| --- | --- |
| Autor | `compliance-legal` |
| Fecha | 2026-09-21 |
| Spec de origen | `specs/002-identidad-y-acceso/spec.md` — **CA-35** |
| Condición que cierra | **C-002-12** del dictamen (`cumplimiento.md` §6) |
| Escalamiento que resuelve | **E-4** de `plan.md` §10 |
| Diseño del mecanismo | **ADR-027** (espera cancelable, doble control, destrucción al cerrar) |
| Pantallas | `ux.md` RE-4 y AB-2 (huecos `{DOCUMENTACIÓN}`, `{QUIÉN}`, `{PLAZO}`) |
| Contrato | `specs/contratos/identidad-y-acceso.ts` §8 — cierra el brazo `A_DEFINIR_EN_G2` |
| Desbloquea | **T-10** de `tasks.md` (§5) |
| Estado | BORRADOR — **requiere ratificación de un abogado matriculado antes de producción** |
| **Veredicto** | **APTO CON CONDICIONES** (7 condiciones, §12) |

---

> ## Advertencia principal — leer antes que cualquier otra cosa
>
> **Quien escribe este documento no es abogado y esto no es asesoramiento
> jurídico.** Es material de trabajo preparado por un agente revisor para que un
> **abogado matriculado** lo lea, lo corrija y lo firme.
>
> Este catálogo define qué documentación se le pide a una persona para probar
> que es quien dice ser. Es exactamente el tipo de decisión donde una
> equivocación se paga de los dos lados: si se pide de menos, se abre una puerta
> al fraude; si se pide de más, se crea un depósito de documentos de identidad
> que hay que custodiar para siempre. **Ninguna afirmación normativa de este
> documento debe tomarse como cierta.**
>
> Todos los parámetros del §11 salen con `requiereValidacionProfesional: true` y
> **no pueden usarse en producción** hasta que una persona matriculada los
> ratifique por escrito, con nombre, matrícula, jurisdicción y fecha.
>
> **Acceso a fuentes oficiales en esta ronda (2026-09-21).** Se intentó
> nuevamente InfoLeg (`servicios.infoleg.gob.ar`) y un espejo institucional del
> texto de la Ley 25.326: ambos devolvieron bloqueo del proxy de egreso, igual
> que en las rondas del 2026-09-20 y del 2026-09-21 registradas en
> `specs/legal/verificacion-documental.md`. **No hay una sola marca `[V]` en este
> documento.** Ver §13.

### Leyenda de confiabilidad

La misma de `specs/004-motor-reglas-legales/cumplimiento.md` y de
`specs/002-identidad-y-acceso/cumplimiento.md`, para que los tres se lean con el
mismo criterio.

| Marca | Significado |
| --- | --- |
| `[V]` | Verificada contra fuente oficial en línea. **No se usa en este documento.** |
| `[C]` | Corroborada por buscador, sin lectura de la fuente oficial. Orienta al estudio; **no vale para citar hacia afuera ni para evaluar en producción.** |
| `[P]` | Pendiente de verificación documental. Conocimiento del revisor, no contrastado. |
| `[D]` | A determinar por el estudio. El revisor no propone valor. |
| `[I]` | Interpretación o criterio del revisor, no texto legal. |

### Nota de numeración

Las condiciones de este documento **continúan** la serie del dictamen de la 002:
empiezan en **C-002-13**. Los defectos siguen en **D-002-15**.

---

## 1. Qué decide este documento y qué no

**Decide:** qué comprobaciones de identidad son admisibles, con qué base legal se
recolecta cada una, quién las ve, cuánto duran y cómo se destruyen; qué cambia
entre cliente y abogado; qué pasa cuando la persona no puede aportar nada; y si
el trámite exige presencialidad, videollamada o puede ser asincrónico.

**No decide:** el mecanismo. La espera obligatoria cancelable por el titular, el
doble control, el hecho de que la restitución no emita sesión y la destrucción
al cerrar el caso ya están decididos en **ADR-027** y este documento no los
reabre — los presupone, y varias conclusiones de acá **sólo se sostienen porque
ese mecanismo existe** (ver §10.4).

**Tampoco decide** el plazo de espera (escalamiento E-3, del product owner), ni
el dimensionamiento del equipo de soporte.

---

## 2. Encuadre: por qué esto es más delicado de lo que parece

`[I]` Tres cosas hacen que este circuito merezca un documento propio y no un
párrafo en una spec:

1. **Es el único lugar del producto donde la plataforma le pide a una persona un
   documento de identidad.** El resto del alta es liviano a propósito: correo,
   contraseña, nombre y, eventualmente, CUIT/CUIL. `docs/03` describe el KYC
   como liviano y la spec lo mantuvo así. Este circuito abre una categoría de
   dato que hoy el sistema no trata en ningún otro lado.
2. **Es un circuito de excepción, y los circuitos de excepción son donde se
   improvisa.** Nadie escribe una carpeta compartida con fotos de DNI en una
   spec: aparece sola, en el tercer mes, porque un operador necesitaba resolver
   un caso. Escribirlo antes es lo único que lo evita.
3. **Con el MFA obligatorio para `ABOGADO` y `ADMINISTRADOR`** (decisión 002-B,
   entrada 040 del registro), deja de ser excepción y pasa a ser rutina. Un
   circuito de excepción mal definido que ocurre una vez por año es un riesgo
   tolerable; el mismo circuito ocurriendo todas las semanas es un depósito de
   documentos de identidad creciendo sin dueño.

`[I]` Y hay una asimetría que conviene nombrar desde el principio: **la persona
que pide la restitución está, por definición, en el peor momento para negociar.**
Un abogado sin segundo factor no puede trabajar. Eso significa que aceptará
entregar lo que sea que le pidamos. **Esa aceptación no es consentimiento libre
en ningún sentido útil**, y es la razón por la que el catálogo tiene que ser
acotado por diseño y no "lo que el operador considere suficiente".

---

## 3. Principio rector: es una escalera, no un menú

`[I]` La regla de forma, que gobierna todo lo demás y que debe quedar
implementada como tal:

> **El operador usa el primer escalón que alcance. Sólo sube si el anterior no
> resuelve, y el sistema le exige registrar por qué no resolvió.**

Un menú de opciones equivalentes degrada siempre hacia la más cómoda para el
operador, que es pedir el documento. Una escalera con justificación obligatoria
de ascenso hace que la minimización del art. 4 inc. 1 de la Ley 25.326 `[P]` sea
una propiedad del sistema y no una virtud del empleado.

**Consecuencia para `dev-backend` (T-10):** la transición al escalón siguiente
requiere un motivo registrado del escalón anterior. No es un `enum` libre.

---

## 4. El catálogo

Cinco entradas. Cuatro escalones y una salida final. **Nada más que esto se
admite**, y agregar una entrada requiere volver a este documento con dictamen
específico.

### Resumen

| # | Clase | Para quién | Datos nuevos recolectados | Persiste algo |
| --- | --- | --- | --- | --- |
| **E1** | Canal alternativo ya registrado antes del incidente | Todos | **Ninguno** | No |
| **E2** | Cotejo por canal institucional del colegio profesional | Sólo `ABOGADO` | **Ninguno del titular** | No |
| **E3** | Videollamada con operador, sin grabación | Todos | Ninguno persistido | No |
| **E4** | Documento nacional de identidad por visor efímero | Todos | Los mínimos | **No** — se destruye (§8) |
| **E5** | Escalamiento humano final (§9) | Todos | Variable, con dictamen caso por caso | Según §9 |

`[I]` Obsérvese que **cuatro de las cinco entradas no persisten ningún dato
nuevo**. Ése es el objetivo del diseño: que el escalón que crea un depósito de
documentos sea el que casi nunca se usa.

---

### E1 · Canal alternativo ya registrado antes del incidente

**Qué es.** El sistema envía una confirmación a un canal de contacto que **ya
estaba verificado en la cuenta antes de que se abriera la solicitud** — hoy, el
correo verificado; a futuro, un teléfono, si alguna feature lo incorpora.

**Qué se le pide a la persona.** Nada. Que confirme desde un canal que ya es
suyo.

**Base legal.** `[I]` Art. 5 inc. 2 ap. d de la Ley 25.326 `[C]`: los datos
derivan de la relación contractual del titular y son necesarios para su
desarrollo. **No hay recolección nueva**: se usa un dato que el titular ya
aportó, para la misma finalidad de seguridad de la cuenta con la que se aportó
(art. 4 inc. 3 `[P]`). Éste es el escalón legalmente más limpio que existe y por
eso es el primero.

**Quién lo ve.** Nadie ve nada nuevo. El operador ve el resultado
(`COINCIDE` / `NO_COINCIDE`), no el contenido.

**Conservación.** No hay documentación. Queda la
`ConstanciaDeVerificacionDeIdentidad` (§8.3).

**Límite duro, y es el que le da sentido al escalón.** `[I]` El canal tiene que
haber sido verificado **antes** de que se abriera la solicitud, y el sistema debe
verificarlo por fecha, no por confianza. Un atacante que ya comprometió el correo
pasa este escalón sin esfuerzo — por eso E1, **por sí solo, no alcanza para
`ABOGADO` ni para `ADMINISTRADOR`** (ver §6.2) y por eso la espera cancelable de
ADR-027 corre igual: el aviso va **a todos los canales registrados**, no sólo al
que confirmó.

---

### E2 · Cotejo por canal institucional del colegio profesional — sólo `ABOGADO`

**Qué es.** El operador confirma la identidad **a través del canal de contacto
que el colegio profesional tiene registrado para ese matriculado**, no a través
del canal que aportó quien pide la restitución.

**Qué se le pide a la persona.** Nada nuevo. El número de matrícula y la
jurisdicción **ya están en el sistema** con su evidencia registrada (salvaguarda
M-1, ADR-026).

**Por qué es fuerte.** `[I]` Lo valioso no es la matrícula —que es pública— sino
que el canal de contacto **no lo elige quien pide**. Es una vía fuera de banda
contra un registro independiente y ajeno a la plataforma. Un atacante que
comprometió el correo del abogado no controla lo que el colegio tiene en su
padrón.

**Base legal.** `[I]` Doble:
- Respecto del titular: art. 5 inc. 2 ap. d `[C]` — relación contractual, sin
  dato nuevo.
- Respecto del dato de matrícula: `[I]` es información de **publicidad
  registral** del colegio. Consultarla no es una cesión y no requiere
  consentimiento. **El estudio debe confirmarlo por jurisdicción** (`[D]`, §14).

**Quién lo ve.** El operador que instruye. La aprobación es de otra persona
(doble control, ADR-027 §5).

**Conservación.** Ninguna documentación. Sólo la constancia.

**Dos límites que hay que implementar, no confiar.**

| # | Límite | Por qué |
| --- | --- | --- |
| E2-a | **La consulta al colegio nunca revela que la persona es usuaria de la plataforma, ni el motivo del contacto.** El operador usa datos de acceso público del padrón; si necesita contactar al colegio, lo hace sin mencionar el trámite. | `[I]` Revelarlo sería comunicar a un tercero un dato del titular sin base legal (arts. 5 y 11 `[P]`), y en este producto insinúa además la relación del abogado con una plataforma de gestión de deudas. Es el mismo criterio de no-enumeración de R-05. |
| E2-b | **E2 no reemplaza al doble control ni acorta la espera.** Sustituye a E3/E4, nada más. | `[I]` Ver el conflicto de interés del §6.3. |

---

### E3 · Videollamada con operador, sin grabación

**Qué es.** Una conversación en vivo donde el operador coteja a la persona con lo
que ya está en la cuenta. **No se graba, no se captura pantalla, no se piden
capturas.**

**Qué se le pide a la persona.** Que se muestre y conversemos. Puede exhibir su
documento **en cámara** sin que se capture nada — y esa es la diferencia
sustantiva con E4.

**Base legal.** `[I]` Art. 5 inc. 2 ap. d `[C]` (necesario para el desarrollo de
la relación contractual: devolverle el acceso a su cuenta) y art. 9 `[P]` (medida
de seguridad adecuada al riesgo). `[I]` El argumento adicional, y que conviene
que el estudio evalúe: **al no persistirse ningún dato, no se forma archivo,
registro, base ni banco de datos** en el sentido del art. 2 `[P]`, de modo que el
tratamiento es efímero e instrumental. **No lo afirmo como certeza** — es la
lectura del revisor y es exactamente el tipo de punto donde un abogado puede
discrepar. `[D]`

**Quién lo ve.** Únicamente el operador que instruye, en vivo. Nadie más, nunca
después, porque no queda nada que ver.

**Conservación.** Cero. La prohibición de grabar es **regla, no parámetro**: no
admite configuración.

`[I]` **Por qué la prohibición de grabar es central y no un detalle.** Una
grabación de video de una persona exhibiendo su documento es, de una sola vez: un
dato identificatorio, una imagen facial —con toda la discusión abierta sobre
tratamiento biométrico, §5.3— y un archivo que después hay que custodiar, indexar
y destruir. Grabar convierte el escalón más limpio del catálogo en el más sucio.
Si alguien propone grabar "para respaldo", la respuesta es que el respaldo es la
`ConstanciaDeVerificacionDeIdentidad` más el doble control más la espera
cancelable (§10.4).

**Límite de accesibilidad, y es serio.** `[I]` La videollamada exige ancho de
banda, cámara y sincronía. La constitución #13 dice que el producto tiene que
funcionar en teléfonos de gama baja y con conexión pobre. **E3 no puede ser el
único camino**, y por eso E4 existe y por eso §10 dictamina asincronía por
defecto.

---

### E4 · Documento nacional de identidad por visor efímero

**Éste es el único escalón que recolecta un dato nuevo.** Todo lo que sigue
existe para que se use poco y dure poco.

#### 4.1 Qué se acepta, exactamente

| Se acepta | Observación |
| --- | --- |
| **Anverso y reverso del DNI tarjeta argentino** | Es el documento de identidad de uso corriente. |
| **Pasaporte argentino o extranjero**, sólo si la persona **no tiene DNI** | `[I]` Excepción para residentes extranjeros y casos de documento en trámite. Requiere motivo registrado. |
| **Constancia de DNI en trámite del RENAPER**, sólo junto con E3 | `[I]` No prueba identidad por sí sola; acompaña a la videollamada. |

#### 4.2 Qué NO se acepta — lista cerrada de prohibiciones

`[I]` Esta lista importa tanto como la de arriba, porque nombra lo que un
operador con buena intención pediría por su cuenta.

| Prohibido | Por qué |
| --- | --- |
| **Selfie sosteniendo el DNI** | `[I]` Es la práctica de mercado y **la descarto como regla**. Duplica el dato (imagen facial + documento) en un solo archivo, es trivialmente falsificable con edición, y lo que pretende probar —que la persona está viva y es la del documento— lo prueba mejor E3 sin persistir nada. Si en un caso puntual el operador entiende que hace falta, **la respuesta correcta es subir a E3, no pedir una selfie.** |
| **Recibo de sueldo, resumen bancario, factura de servicios, constancia de CUIL de ANSES o de AFIP** | `[I]` Son **datos patrimoniales**, la categoría que este producto más tiene que cuidar (constitución #5). Pedirlos para probar identidad es recolectar información económica para una finalidad que no la necesita: excesivo frente al art. 4 inc. 1 `[P]`. |
| **Partida de nacimiento, libreta de matrimonio, certificado de domicilio** | Desproporcionados y, algunos, con información de terceros. |
| **Cualquier documento que revele datos del art. 7** (certificados médicos, carnet de obra social, afiliación sindical o política) | `[I]` Datos sensibles con régimen agravado `[P]`. **Si una persona los envía por su cuenta, se destruyen de inmediato y se le pide que no los reenvíe.** |
| **Documento enviado por correo electrónico, WhatsApp, mensajería o adjunto de cualquier tipo** | ADR-027 §4 ya lo cierra. Un adjunto queda en el buzón del operador, en el del titular, en los servidores del proveedor y en cualquier copia de seguridad. Es irrecuperable. |
| **Prueba de vida, cotejo facial automatizado o cualquier verificación biométrica** | Ver §5.3. Requiere dictamen propio y vuelve a compuerta. |
| **Verificación contra el CUIT/CUIL como secreto compartido** | Ver §5.4. |

#### 4.3 Cómo se recibe — seis reglas de forma

| # | Regla | Fundamento |
| --- | --- | --- |
| F-1 | **Enlace de un solo uso** hacia un almacenamiento cifrado **separado de la base principal**. Nunca un adjunto. | ADR-027 §4; art. 9 `[P]` |
| F-2 | **Visor sin descarga, sin impresión y con marca de agua** con el identificador del caso y el del operador. | `[I]` Si el archivo no se puede sacar del visor, no puede terminar en una carpeta compartida. La marca de agua hace atribuible una captura de pantalla. |
| F-3 | **Cada apertura genera un `EventoAuditoria` con motivo.** No basta con registrar el acceso: hay que registrar para qué. | Constitución #5; art. 9 `[P]` |
| F-4 | **No se transcribe ningún campo del documento a la base de datos.** Ni número, ni domicilio, ni fecha de nacimiento, ni sexo registral. El operador **coteja** contra lo que ya hay y registra `COINCIDE` / `NO_COINCIDE` / `INSUFICIENTE`. | `[I]` Es la regla más importante de este documento. El DNI muestra domicilio y fecha de nacimiento, que el sistema hoy no trata y no necesita. Transcribirlos sería usar el trámite de restitución como puerta de entrada de datos nuevos, con una base legal que sólo cubre la verificación. |
| F-5 | **Destrucción automática** según §8, con evento propio. No depende de que alguien se acuerde. | Art. 4 inc. 7 `[P]` |
| F-6 | **Vista limitada a quien instruye el caso.** Quien aprueba (doble control) **ve la constancia y el expediente del trámite, no el documento**. | §6. `[I]` Contraintuitivo y deliberado: ver el documento no mejora la aprobación, y duplicar los ojos duplica la exposición. |

#### 4.4 Base legal de E4 — y por qué la dejo abierta entre dos

`[I]` **Éste es el punto del documento donde más necesito que un abogado decida,
y prefiero decirlo antes que elegir yo.** Hay dos encuadres posibles y no son
equivalentes:

**Encuadre A — art. 5 inc. 2 ap. d `[C]`, relación contractual.** La restitución
del acceso es desarrollo del contrato; verificar identidad antes de devolver el
acceso es necesario para cumplirlo sin dañar al propio titular. *A favor:* no
depende de un consentimiento que, en este contexto, es dudosamente libre (§2).
*En contra:* `[I]` es una lectura amplia de "necesario", porque existen escalones
que logran lo mismo sin documento.

**Encuadre B — art. 5 inc. 1 `[P]`, consentimiento libre, expreso e informado
prestado en el acto.** *A favor:* es la lectura conservadora y encaja con que el
dato sea nuevo y no derivado. *En contra:* `[I]` el consentimiento de quien no
puede trabajar hasta entregarlo tiene un problema de libertad evidente, y un
consentimiento inválido es peor que ninguna base.

**Propuesta del revisor:** `[I]` **base principal el encuadre A, con
consentimiento específico registrado como recaudo adicional** — no como base sino
como prueba de que se informó y de que la persona pudo elegir otra vía. Y lo que
vuelve defendible al encuadre A es precisamente que **existan alternativas
reales** (E1, E2, E3 y la salida del §9): si E4 fuera el único camino, el
argumento de necesidad se caería y el consentimiento tampoco sería libre.

**`[D]` El estudio decide cuál se invoca.** De la respuesta depende un detalle de
implementación menor (un registro de consentimiento más o menos) y un argumento
mayor ante un reclamo.

#### 4.5 La información del art. 6 en el momento de la carga

`[I]` El art. 6 `[C]` obliga a informar **en el momento en que se recogen los
datos**. Ese momento acá es la pantalla de carga, no los términos y condiciones
firmados hace ocho meses. `ux.md` RE-4 ya dejó los huecos abiertos; **este es el
texto propuesto para llenarlos**, a reescribir por `ux-expert` y a ratificar por
el abogado:

> **Qué te vamos a pedir**
> Primero probamos sin pedirte nada: te escribimos al correo de tu cuenta.
> Si con eso no alcanza, te ofrecemos una videollamada corta con alguien del
> equipo. Recién si ninguna de las dos sirve, te pedimos una foto del frente y
> del dorso de tu DNI.
>
> **Quién lo ve.** Sólo la persona del equipo que está resolviendo tu pedido.
> Nadie más, ni siquiera quien después lo aprueba. Cada vez que alguien lo abre,
> queda registrado.
>
> **Qué hacemos con eso.** Lo miramos para confirmar que sos vos. **No copiamos
> ningún dato del documento a tu cuenta.**
>
> **Cuánto lo guardamos.** Lo borramos dentro de las {PLAZO} de resolver tu
> pedido, salga como salga. Queda sólo el registro de que la verificación se
> hizo, quién la hizo y cuándo — nunca la foto.
>
> **No estás obligado.** Si no querés o no podés mandarlo, decínoslo y buscamos
> otra forma. {enlace a la salida del §9}
>
> **Podés pedir ver, corregir o borrar tus datos cuando quieras**, escribiendo a
> {canal}. Responsable de la base: {razón social y domicilio}.

`[I]` Los cinco incisos del art. 6 `[C]` están: finalidad, responsable, carácter
facultativo con su consecuencia, qué pasa si no se da, y los derechos de acceso,
rectificación y supresión. **El inciso c) —el carácter facultativo— es el que más
se olvida y acá es el que más importa**, porque es lo que sostiene el encuadre
del §4.4.

---

### E5 · Escalamiento humano final

Ver §9. No es un escalón más: es la garantía de que nadie queda sin salida.

---

## 5. Cuatro cosas que quedan expresamente fuera, y por qué

### 5.1 Presencialidad como requisito

No se exige. Ver el dictamen del §10.

### 5.2 Proveedor externo de verificación de identidad (KYC comercial)

`[I]` Ya descartado en ADR-027 y lo ratifico: un encargado de tratamiento nuevo
(art. 25 `[P]`), con datos identificatorios y probablemente biométricos,
transferencia internacional probable (art. 12 `[P]`) y costo por verificación,
para resolver un trámite de excepción. Desproporcionado.

### 5.3 SID de RENAPER y cualquier cotejo biométrico

`[C]` Existe el **Sistema de Identidad Digital (SID)** del RENAPER, que valida
identidad a distancia por cotejo facial contra la base del registro y que
entidades privadas pueden usar mediante convenio (Disposición RENAPER 4133/18 y
Convenio Único de Confronte de Datos Personales `[C]`, no leídos).

`[I]` **No lo incorporo a este catálogo, y recomiendo no incorporarlo para este
trámite**, por tres razones:

1. Implica **cotejo facial**, es decir tratamiento biométrico. Bajo la Ley 25.326
   el dato biométrico **no figura en la enumeración de datos sensibles del art. 2**
   `[P]` —a diferencia de lo que proponen los proyectos de reforma— pero la
   autoridad de aplicación lo ha tratado como de alto riesgo `[P]`, y la
   constitución #5 no se conforma con el mínimo legal.
2. Requiere **convenio firmado con un organismo público** y encuadre propio.
3. `[I]` Es una solución excelente para un problema que no tenemos: sería
   razonable si hiciéramos onboarding con KYC fuerte. Acá restituye un factor.

**Si el product owner quiere evaluarlo, vuelve a compuerta con dictamen
específico.** No es una decisión que este documento pueda absorber.

### 5.4 Verificación contra el CUIT/CUIL registrado como prueba de identidad

`[I]` **La descarto expresamente, y lo hago con énfasis porque el encargo la
menciona como opción razonable.** El propio dictamen de la 002 (§2.2.c) concluyó
que **el CUIL en Argentina no es un secreto**: se deriva del DNI, circula en
listados y aparece en facturas. Usarlo como secreto compartido para devolver el
acceso a una cuenta con MFA sería degradar el segundo factor a un dato público.
Es, con precisión, el ataque más barato contra este circuito.

**Lo que sí es admisible**, y conviene distinguirlo: **señales internas de
corroboración** —fecha de alta, últimas sesiones, dispositivos conocidos,
historial de actividad— que el operador puede usar **para reforzar o para
desconfiar, nunca como comprobación suficiente por sí sola**. No son un escalón
del catálogo y no producen una `ConstanciaDeVerificacionDeIdentidad` por sí
mismas. `dev-backend` debe implementarlas así: contexto para el operador, no
resultado.

---

## 6. Quién ve qué

### 6.1 Regla de acceso

| Rol en el trámite | Qué ve | Qué no ve |
| --- | --- | --- |
| **Operador que instruye** (`restitucionMfa.instruir`) | El expediente del trámite y, si se llegó a E4, el documento **en el visor**, con marca de agua y sin descarga | Nada de otros trámites que no le estén asignados |
| **Persona que aprueba** (`restitucionMfa.aprobar`) | El expediente, la `ConstanciaDeVerificacionDeIdentidad` y el motivo de ascenso de cada escalón | **El documento. Nunca.** (regla F-6) |
| **Resto del back-office** | Nada | Todo |
| **Auditoría** (`auditoria.leer.total`) | Los eventos: quién abrió qué, cuándo y con qué motivo | El contenido del documento |
| **El titular** | Su propio trámite, su estado, su fecha de resolución y el registro de quién lo miró | — |

`[I]` **Asignación explícita, no permiso general.** Tener
`restitucionMfa.instruir` no debe habilitar a ver cualquier documento de
cualquier trámite: habilita a ver el del trámite asignado. Es el mismo criterio
que CA-19 aplica a los expedientes, y es la diferencia entre un control de acceso
real y uno decorativo.

### 6.2 Por qué el doble control no se toca

ADR-027 §5 ya lo decidió para `ABOGADO` y `ADMINISTRADOR`. Lo ratifico y agrego
un matiz de encuadre: `[I]` el doble control **es la medida técnica y
organizativa del art. 9 `[P]` que compensa** que la verificación sea remota.
Quien proponga sacarlo debe proponer, en el mismo acto, qué lo reemplaza.

### 6.3 Conflicto de interés — obligado a marcarlo

`[I]` Mi mandato me obliga a marcar toda función donde el ingreso de la
plataforma mejora mientras la posición del titular empeora. Acá no hay un
conflicto de esa forma, pero hay uno de forma vecina y prefiero dejarlo escrito:

**ADR-027 propone una espera más corta para `ABOGADO` y `ADMINISTRADOR` (24 h
hábiles) que para `CLIENTE` (72 h).** Visto desde el riesgo, es al revés de lo
que correspondería: la cuenta del abogado expone a todos sus clientes y la del
administrador a todos los titulares. La justificación real de la diferencia es
operativa y comercial —un profesional parado no factura, ni él ni nosotros—, no
de seguridad.

`[I]` **No digo que esté mal.** Digo que la diferencia se sostiene **sólo
porque** el camino profesional lleva doble control y, para el abogado, el canal
institucional independiente de E2. Si alguna vez se quita cualquiera de esos dos
controles manteniendo el plazo corto, la conclusión cambia: sería el rol que paga
comprando un control de seguridad más débil. **Queda como advertencia asociada al
escalamiento E-3**, que resuelve el product owner.

---

## 7. Diferencia entre cliente y abogado

> **Dictamen: sí, la matrícula es una vía razonable para reducir la recolección
> en el caso del abogado, y recomiendo usarla. No reduce el doble control ni la
> espera.**

| | `CLIENTE` | `ABOGADO` | `ADMINISTRADOR` |
| --- | --- | --- | --- |
| Escalones disponibles | E1 → E3 → E4 → E5 | E1 → **E2** → E3 → E4 → E5 | E1 → E3 → E4 → E5 |
| E1 solo alcanza | `[I]` Sí, con la espera y el aviso multicanal | **No.** E1 + un escalón más | **No.** E1 + un escalón más |
| Doble control | No (salvo reincidencia en 90 días, ADR-027 §6) | **Sí** | **Sí** |
| Probabilidad de llegar a E4 | `[I]` Media | `[I]` **Baja** — E2 debería resolver la mayoría | `[I]` Media-alta |

**Por qué E2 funciona para el abogado y no para el cliente.** `[I]` No es que el
abogado merezca menos verificación: es que **ya existe, fuera de la plataforma,
un registro público e independiente que lo identifica** y al que la plataforma ya
está conectada por la verificación de matrícula (CA-05, ADR-026). El cliente no
tiene un equivalente. Aprovechar un registro que ya está ahí es exactamente lo
que la minimización pide: **la mejor manera de proteger un dato es no pedirlo**.

**Por qué el administrador no tiene atajo.** `[I]` Es la cuenta que más puede
ver, es personal interno y es un grupo chico. Ahí la fricción no es un problema
de producto: es el precio correcto. Además `[I]` un administrador tiene, en la
práctica, una vía que ningún usuario externo tiene —reconocimiento directo por
sus pares dentro de la organización— que encaja naturalmente en E3 con doble
control.

**Tres límites de E2, que ya están en §4/E2 y repito porque es donde se van a
perder:**

1. No revela que la persona es usuaria de la plataforma (E2-a).
2. No acorta la espera ni saltea el doble control (E2-b).
3. `[I]` Requiere que la **matrícula esté vigente** según ADR-026. Una matrícula
   vencida o suspendida **invalida E2** —el registro ya no confirma nada útil— y
   el trámite sube a E3.

---

## 8. Conservación y destrucción

### 8.1 Regla

> **La documentación de E4 se destruye al cerrarse el caso, resuelto como sea.
> Nunca se archiva "por las dudas".**

`[I]` Fundamento: art. 4 inc. 7 de la Ley 25.326 `[P]` — los datos se destruyen
cuando dejan de ser necesarios para la finalidad. La finalidad acá es verificar
una identidad en un trámite concreto. Cerrado el trámite, la finalidad se agotó.
**Un rechazo agota la finalidad igual que una aprobación.**

### 8.2 Los tres plazos propuestos

| Situación | Plazo propuesto `[I]` | Acción |
| --- | --- | --- |
| Caso **resuelto** (aprobado o rechazado) | **Dentro de las 24 horas corridas del cierre** | `PURGA_FISICA` con evento `DOCUMENTACION_DE_RESTITUCION_DESTRUIDA` |
| Caso **abierto** pero documentación cargada hace mucho | **Tope absoluto de 15 días corridos desde la carga**, esté el caso cerrado o no. Vencido, se purga y, si sigue haciendo falta, **se vuelve a pedir** | Ídem |
| **Enlace de carga** emitido y no usado | **72 horas** | Caducidad del enlace |

`[I]` Las 24 horas, y no "inmediatamente", por una razón operativa honesta: deja
margen para que el segundo control (quien aprueba) pida al que instruye una
aclaración sin que el documento ya no exista. Si el estudio prefiere destrucción
inmediata al cierre, es más conservador y no tengo objeción — es una de las
preguntas del §14.

El tope de 15 días existe porque `[I]` un caso abierto indefinidamente no puede
ser la vía por la que un documento sobrevive para siempre. Pedirlo de nuevo es
molesto; conservarlo sin plazo es indefendible.

### 8.3 Qué sobrevive

Sólo la `ConstanciaDeVerificacionDeIdentidad` del contrato: **qué clase** de
comprobación se hizo, **quién**, **cuándo** y con qué resultado. Nunca el
documento, nunca su contenido, nunca una transcripción (regla F-4).

`[I]` **La constancia es la prueba.** Si algún día alguien reclama que la
restitución fue indebida, lo que hay que poder demostrar es que **existió un
procedimiento y que se siguió** —quién instruyó, quién aprobó, qué clase de
comprobación, si el titular fue avisado y no canceló—. Nada de eso requiere
conservar la foto del DNI. Guardar el documento no fortalece la prueba: agrega un
riesgo sin agregar valor probatorio.

La constancia se conserva con el mismo plazo que la bitácora de auditoría
(`retencion.bitacoraAuditoria`, hoy `[D]` en el dictamen §5.B).

### 8.4 La excepción que hay que decidir: sospecha de fraude

`[I]` Si en un trámite se detecta un intento de suplantación, aparece una tensión
real entre destruir (art. 4 inc. 7 `[P]`) y conservar prueba de un hecho
posiblemente delictivo. **No la resuelvo.**

Propuesta del revisor, conservadora: la conservación excepcional procede **sólo
si existe denuncia penal formalizada o requerimiento de autoridad competente**,
queda bajo custodia separada, con acceso restringido al responsable de datos
personales, con evento propio, y **con plazo determinado por el estudio** `[D]`.
Lo que no puede pasar es que "sospecha de fraude" se vuelva la etiqueta que
mantiene vivo un depósito de documentos. **C-002-19.**

---

## 9. Si la persona no puede aportar ninguna comprobación aceptable

`[I]` **La constitución #13 y el art. 8 bis de la Ley 24.240 `[P]` hacen que
"entonces no puede entrar" no sea una respuesta admisible.** Y hay una razón
legal más específica y más dura, que conviene tener presente:

> **Los derechos de acceso, rectificación y supresión de los arts. 14 y 16 de la
> Ley 25.326 `[C]` son derechos del titular frente al responsable de la base. No
> pueden quedar condicionados a que el titular tenga su segundo factor.** Una
> persona que no puede probar su identidad para restituir el MFA **conserva de
> todos modos** el derecho a saber qué datos tenemos y a pedir que los borremos,
> por el canal que la 003 defina.

Es decir: el peor escenario posible no es "queda afuera para siempre". Es "no
recupera el acceso en línea, pero sigue teniendo sus derechos y una vía para
ejercerlos". Eso hay que decirlo en la pantalla, no dejarlo implícito.

### La escalera final

| # | Paso | Quién |
| --- | --- | --- |
| **S-1** | **Revisión de conjunto.** Una persona distinta del operador —el responsable de datos personales o quien se designe— revisa el caso completo: señales internas, historial, coherencia del relato, qué falló en cada escalón. Puede resolver por convicción fundada, **con constancia de resultado `INSUFICIENTE` superada por decisión motivada** y registro del motivo. | Responsable designado |
| **S-2** | **Certificación de firma de la solicitud** ante escribano, juez de paz, autoridad policial o banco, según lo que esté disponible en la jurisdicción del titular. Es el mecanismo clásico y no requiere que la plataforma trate ningún dato nuevo más allá de la constancia. **`[I]` El costo no se le traslada al titular** (§ siguiente). | Titular, fuera de la plataforma |
| **S-3** | **Verificación presencial**, si la persona la ofrece y la organización puede recibirla. **Nunca obligatoria** (§10). | Titular y organización |
| **S-4** | **Si nada de lo anterior resuelve:** se comunica el rechazo **por escrito, con motivo concreto y con las dos salidas abiertas** — (a) ejercer los derechos de los arts. 14 y 16 por el canal alternativo, incluida la supresión de la cuenta; (b) volver a intentar el trámite si cambian las circunstancias. **No hay carpetazo silencioso.** | Responsable designado |

**Plazo y escalamiento automático.** `[I]` Igual que CA-31 hizo con la matrícula:
el trámite tiene plazo máximo de resolución y, vencido, **escala solo**. Un
abogado esperando sin fecha es el mismo problema de trato digno que ya se
resolvió una vez en esta feature. Parámetro en §11.

**Sobre el costo de S-2.** `[I]` Una certificación de firma cuesta plata y varía
mucho por jurisdicción. Trasladarle al consumidor el costo de recuperar el acceso
a un servicio que contrató es, a mi criterio, discutible frente al art. 8 bis
`[P]` y candidato a cláusula abusiva del art. 37 `[P]` si quedara escrito en los
términos. **Propuesta: la plataforma absorbe el costo, o al menos ofrece una
alternativa gratuita.** Decisión de producto con arista legal; la marco y no la
cierro. **C-002-18.**

**Lo provincial.** `[I]` Qué autoridad puede certificar una firma y a qué costo
**varía por provincia**. La pantalla no puede decir "andá a un escribano" como si
fuera lo mismo en todos lados.

---

## 10. Dictamen: ¿presencialidad, videollamada o asincronía?

> ## Dictamen
>
> **El circuito es asincrónico por defecto, sincrónico por elección del titular
> o del operador, y nunca presencial como requisito.**
>
> 1. **La presencialidad no se exige en ningún caso ni para ningún rol.**
> 2. **La videollamada es el escalón preferido antes de pedir un documento, pero
>    no es obligatoria**: siempre tiene que existir un camino asincrónico
>    equivalente.
> 3. **Lo que hace defendible la verificación no es el canal. Es el conjunto:
>    espera cancelable + aviso multicanal + doble control + constancia.**

### 10.1 Por qué no corresponde exigir presencialidad

`[I]` **No conozco ninguna norma argentina que imponga forma presencial para
restituir un factor de autenticación** `[P]`. Y no la habría: no es un acto con
forma tasada. No es una firma digital bajo la Ley 25.506 `[P]`, no es un poder,
no es un pacto de cuota litis —que sí exige forma escrita con tantos ejemplares
como partes, según lo corroborado en el dictamen de la 004 `[C]`—, no es un acto
que requiera escritura pública. Es un procedimiento interno de seguridad, y su
forma la elige el responsable de la base bajo el estándar de adecuación al riesgo
del art. 9 `[P]`.

Tres razones más, en orden de peso:

1. **Excluye.** `[I]` Un producto para personas sobreendeudadas de todo el país,
   con un requisito de comparecencia física, deja afuera a quien vive lejos, a
   quien no puede faltar al trabajo y a quien no tiene con qué viajar. Es
   exactamente la barrera que la constitución #13 prohíbe, y para la audiencia
   que menos puede sortearla.
2. **No prueba más.** `[I]` Un operador no capacitado que mira un DNI en la mano
   no detecta una falsificación razonable. La presencialidad **se siente** más
   segura y no lo es. Lo que agrega certeza acá es la espera cancelable, que es
   independiente del canal.
3. **Crea un problema nuevo.** `[I]` Recibir personas implica un lugar físico, un
   registro de visitas —otro dato personal— y un procedimiento presencial que
   también hay que especificar. Se resuelve un riesgo creando dos.

### 10.2 Por qué la videollamada tampoco puede ser obligatoria

`[I]` Es el mejor escalón desde la privacidad —no persiste nada— y el peor desde
la accesibilidad: exige ancho de banda, cámara, un lugar donde hablar y
disponibilidad horaria simultánea. Volverla obligatoria empuja a E4 a quien no
puede hacerla, que suele ser quien menos recursos tiene. **Se ofrece siempre, no
se exige nunca.**

### 10.3 Qué significa "asincrónico por defecto" para la implementación

| Regla | Consecuencia para T-10 |
| --- | --- |
| Toda comprobación tiene un camino que no exige simultaneidad | E1 y E4 son asincrónicos; E3 es la única sincrónica y tiene siempre alternativa |
| El titular elige el canal dentro de lo que el escalón permite | La pantalla ofrece, no impone |
| El trámite avanza sin que el titular esté conectado | El estado y la fecha de resolución son visibles en todo momento (ADR-027 §3) |
| Ninguna pantalla dice "tenés que presentarte" | Microcopy revisado por `ux-expert` |

### 10.4 Sobre la validez probatoria — el punto que importa

`[I]` El encargo pregunta por el valor probatorio de la verificación, y creo que
ahí está el error de intuición que hay que desarmar. **Lo que se prueba después
no es "que la persona era quien decía ser".** Eso no lo prueba nadie, ni
presencialmente. Lo que hay que poder probar es **que la organización siguió un
procedimiento razonable, documentado y no arbitrario**. Y eso se prueba con:

- la `ConstanciaDeVerificacionDeIdentidad` (qué clase, quién, cuándo, resultado);
- el motivo registrado de ascenso de cada escalón;
- la identidad de **las dos** personas que intervinieron;
- el aviso al titular por todos los canales y el hecho de que **no canceló**
  dentro del plazo;
- la bitácora inmutable de cada apertura del documento;
- el evento de destrucción.

`[I]` **Ese expediente es más fuerte ante un reclamo que una fotocopia de DNI
guardada en un servidor** — que, además, sólo prueba que alguien nos mandó una
imagen. La presencialidad no agrega ninguna de las seis piezas de esa lista.

---

## 11. Parámetros que requieren validación profesional

**Todas las filas salen con `requiereValidacionProfesional: true`.** Las columnas
"Validado por" y "Fecha" **deben quedar vacías** hasta que una persona
matriculada las complete con nombre, matrícula, jurisdicción, fecha y fecha de
próxima revisión.

### 11.A — Conservación (derivan del art. 4 inc. 7; ninguno es un número normativo)

| Parámetro | Qué representa | Fundamento | Valor propuesto | Validado por | Fecha |
| --- | --- | --- | --- | --- | --- |
| `retencion.documentacionRestitucionMfa.trasCierre` | Cuánto sobrevive la documentación de E4 después de resuelto el caso. | Ley 25.326 art. 4 inc. 7 `[P]` | **24 horas corridas** `[I]`, con purga física y evento. `[D]` El estudio puede preferir destrucción inmediata: es más conservador y no tengo objeción. | | |
| `retencion.documentacionRestitucionMfa.topeAbsoluto` | Tope desde la carga, esté el caso cerrado o no. | Ídem | **15 días corridos** `[I]`. Vencido, se purga y se vuelve a pedir si hace falta. | | |
| `restitucion.enlaceDeCarga.vida` | Vida del enlace de un solo uso para cargar el documento. | Art. 9 `[P]` + producto | **72 horas** `[I]`. Sin objeción legal a otros valores. | | |
| `retencion.constanciaDeVerificacion` | Cuánto se conserva la constancia que sobrevive al caso. | Constitución #5; art. 9 `[P]` | **Igual que `retencion.bitacoraAuditoria`**, hoy `A DETERMINAR POR EL ESTUDIO` (dictamen §5.B). | | |
| `retencion.documentacionRestitucionMfa.sospechaDeFraude` | Conservación excepcional ante intento de suplantación. | Art. 4 inc. 7 `[P]` vs. prueba de un hecho posiblemente delictivo `[D]` | `A DETERMINAR POR EL ESTUDIO` — ver §8.4 y C-002-19. Propuesta: sólo con denuncia formalizada o requerimiento, custodia separada, plazo del estudio. | | |

### 11.B — Encuadre (no son números: son decisiones jurídicas)

| Parámetro | Qué representa | Fundamento | Estado | Validado por | Fecha |
| --- | --- | --- | --- | --- | --- |
| `restitucion.baseLegal.documentoDeIdentidad` | Con qué base legal se recolecta el documento de E4. | Ley 25.326 art. 5 inc. 1 vs. art. 5 inc. 2 ap. d `[C]` | `A DETERMINAR POR EL ESTUDIO` entre los encuadres A y B del §4.4. Propuesta del revisor: **A con consentimiento registrado como recaudo**. | | |
| `restitucion.videollamada.encuadre` | Si una videollamada no grabada constituye tratamiento registrado. | Ley 25.326 art. 2 `[P]` | `A DETERMINAR` — §4/E3. Propuesta: tratamiento efímero, sin formación de base. **No lo afirmo.** | | |
| `restitucion.matriculaComoComprobacion` | Si consultar el padrón público del colegio es tratamiento que requiera base propia. | Leyes de colegiación provinciales `[P]` | `A DETERMINAR POR EL ESTUDIO` — **varía por jurisdicción** (§7, §14). | | |
| `restitucion.biometria` | Si se admite cotejo facial o prueba de vida. | Ley 25.326 arts. 2 y 7 `[P]`; criterio AAIP `[P]` | **NO ADMITIDO** en este catálogo (§5.3). Reabrirlo exige dictamen propio y vuelve a compuerta. | | |
| `restitucion.costoDeLaSalidaFinal` | Quién paga la certificación de firma de S-2. | Ley 24.240 arts. 8 bis y 37 `[P]` | **Propuesta: lo absorbe la plataforma, o hay alternativa gratuita** `[I]`. Decisión de producto con arista legal. C-002-18. | | |

### 11.C — Producto, sin contenido normativo (los miré y concluí que no son jurídicos)

| Parámetro | Valor propuesto | Observación |
| --- | --- | --- |
| `restitucion.plazoMaximoDeResolucion` | **5 días hábiles** `[I]`, con escalamiento automático al vencer | Mismo criterio que la salvaguarda M-4 de la matrícula. Fundamento en art. 8 bis `[P]`, valor de producto. |
| `restitucion.plazoDeEspera` | Escalamiento **E-3**, del product owner | ADR-027 propone 72 h para `CLIENTE` y 24 h hábiles para roles profesionales. Sin objeción normativa; ver la advertencia del §6.3. |
| `restitucion.escalonMinimoPorRol` | `CLIENTE`: E1 puede bastar. `ABOGADO` y `ADMINISTRADOR`: **E1 nunca alcanza solo** | `[I]` Adecuación al riesgo bajo el art. 9 `[P]`. |
| `restitucion.enfriamiento` | **90 días** (ADR-027 §6) | Decisión de arquitectura ya tomada. Sin objeción. |

---

## 12. Veredicto y condiciones

> ## Veredicto: **APTO CON CONDICIONES**
>
> El catálogo de §4 puede usarse como base para implementar **T-10**.
> **Este catálogo requiere ratificación de un abogado matriculado antes de
> producción.** No bloquea que `dev-backend` empiece a construir el mecanismo;
> **sí** condiciona el pasaje a producción, exactamente igual que la tabla de
> parámetros de la feature 004 (condición C-03, entrada 027 del registro).

### Fundamento

`[I]` **No corresponde NO APTO.** Con el catálogo escrito, cada dato que el
circuito trata tiene finalidad declarada, base legal propuesta, destinatario
acotado, plazo de conservación y procedimiento de destrucción auditable. No hay
tratamiento sin base legal posible, no hay promesa de resultado y no hay cobro de
encuadre dudoso. Los tres supuestos bloqueantes de mi mandato están ausentes.

`[I]` **No corresponde APTO liso** por dos motivos, y ninguno es reparable por
este agente:

1. **La elección entre los dos encuadres del §4.4 es una decisión jurídica**, no
   una de producto ni de arquitectura. Está razonada, no está resuelta.
2. **Ninguna fuente oficial pudo leerse en esta ronda.** El art. 4 inc. 7, el
   art. 5 inc. 2 ap. d y el art. 6 —los tres pilares de este documento— están en
   `[C]` o `[P]`. Un catálogo de verificación de identidad apoyado en citas no
   verificadas no puede declararse apto sin más.

### Condiciones

| # | Condición | Cómo se verifica | Compuerta |
| --- | --- | --- | --- |
| **C-002-13** | **Ratificación del catálogo por abogado matriculado antes de producción.** En particular: el encuadre del §4.4, el criterio del §4/E3 sobre la videollamada efímera, los plazos del §11.A y la excepción del §8.4. `[I]` No bloquea T-10. | Ratificación por escrito con nombre, matrícula, jurisdicción y fecha, registrada en `REGISTRO-COMPUERTAS.md`. | **Antes de G6** |
| **C-002-14** | **Información del art. 6 en el momento de la carga**, con el texto del §4.5 reescrito por `ux-expert`: finalidad, quién lo ve, qué no se copia, cuánto dura, carácter facultativo con su alternativa, y derechos. Llena los huecos `{DOCUMENTACIÓN}`, `{QUIÉN}` y `{PLAZO}` de `ux.md` RE-4. | Test de presencia obligatoria del bloque antes de habilitar la carga + revisión de microcopy. | **G2** |
| **C-002-15** | **Las prohibiciones del §4.2 y las reglas F-1 a F-6 son imposibilidad técnica, no política escrita.** En particular: no existe camino de recepción por correo o adjunto; el visor no permite descarga; ningún campo del documento se transcribe a la base. | Tests: intento de carga por adjunto ⇒ rechazado; ausencia de campos del documento en el esquema (revisión de `database-engineer` y test de forma); apertura del visor ⇒ evento con motivo. | **G4** |
| **C-002-16** | **La destrucción es automática, con evento, y verificable.** Los tres plazos del §8.2 implementados como `ReglaDeRetencion` con `requiereValidacionProfesional: true`. `DOCUMENTACION_DE_RESTITUCION_DESTRUIDA` en la taxonomía de auditoría. | Test: caso cerrado ⇒ documentación inexistente pasado el plazo, constancia presente, evento emitido. Test del tope absoluto con caso abierto. | **G4** |
| **C-002-17** | **E2 no debilita nada.** La vía de la matrícula sustituye a E3/E4 y **no** acorta la espera ni saltea el doble control; la consulta al colegio no revela que la persona es usuaria; una matrícula no vigente invalida E2. | Tests: E2 con matrícula vencida ⇒ escalón inválido; E2 con `instruidaPor === aprobadaPor` ⇒ rechazo. | **G4** |
| **C-002-18** | **La salida final del §9 existe y no termina en silencio**, con rechazo motivado por escrito, con las dos vías abiertas, con plazo máximo y escalamiento automático. **Los derechos de los arts. 14 y 16 no quedan condicionados al MFA.** Decisión registrada sobre quién paga S-2. | Test del escalamiento por plazo + plantilla de rechazo motivado + decisión de producto registrada. | **G2** (decisión) / **G4** (implementación) |
| **C-002-19** | **La conservación excepcional por sospecha de fraude (§8.4) no se implementa sin dictamen del estudio.** Hasta entonces, **no existe** como camino en el código: destrucción sin excepciones. | Ausencia de cualquier rama de conservación excepcional en T-10, verificada en G4. | **G4** |

### Lo que este veredicto **no** dice

`[I]` Dice que T-10 puede construirse sobre este catálogo. **No dice que el
circuito sea legalmente seguro.** Quien lo escribe no es abogado, ninguna fuente
oficial pudo leerse, y hay piezas —el texto que la persona lee al cargar su
documento, el encuadre del §4.4, el contrato con quien aloje el almacenamiento
cifrado— que no son código y que ningún criterio de aceptación puede sustituir.

---

## 13. Defectos y observaciones que escalo

**Este agente no modifica la spec, el plan, el ADR ni las tareas.** Lo que sigue
va al orquestador.

| # | Observación | Dónde | Gravedad |
| --- | --- | --- | --- |
| D-002-15 | `ClaseDeComprobacionDeIdentidad` en el contrato tiene tres brazos más `A_DEFINIR_EN_G2`. Este catálogo define **cinco** clases (E1 a E5) y E2 y E5 no existen en el enumerado. El contrato necesita revisión aditiva del `arquitecto` y el brazo `A_DEFINIR_EN_G2` debe **desaparecer**, no quedar como opción viva. | `specs/contratos/identidad-y-acceso.ts` §8 | Media (G2) |
| D-002-16 | `ClaveDeRetencion` tiene una sola clave (`documentacionRestitucionMfa`) y este catálogo propone **tres plazos distintos** (§8.2) más la constancia. Falta granularidad. | Contrato §11 | Media (G2) |
| D-002-17 | La escalera de ADR-027 §4 registra la clase de comprobación pero **no el motivo de ascenso** de un escalón al siguiente, que es lo que hace operativa la minimización (§3). | ADR-027 §4 | Media (G2) |
| D-002-18 | **El almacenamiento cifrado separado de ADR-027 §4 no tiene encargado de tratamiento identificado.** Si se aloja en un servicio de terceros, es art. 25 y probablemente art. 12 `[P]`, igual que el correo transaccional de E-2. ADR-029 no lo contempla. | ADR-027 §4 vs. ADR-029 | **Alta (G2)** |
| D-002-19 | La espera más corta para los roles profesionales (§6.3) se justifica por necesidad operativa, no por riesgo. Es aceptable **sólo** mientras convivan el doble control y E2. Debe quedar anotado junto al escalamiento E-3. | ADR-027 §3 / plan §10 E-3 | Baja (advertencia) |
| D-002-20 | **`docs/03-cumplimiento-legal-argentina.md` sigue sin la tabla de parámetros pendientes de validación**, por tercera ronda consecutiva. El encargo de esta tarea volvió a fijar un entregable único, así que no lo toqué. Ya está escalado desde el dictamen de la 002 §7 y desde el D-22 de la 004. **Recomiendo una tarea específica** que barra los tres de una vez, ahora con los diez parámetros de §11 sumados. | `docs/03` | Media |

---

## 14. Estado de la verificación documental y preguntas concretas para el estudio

**Ninguna fuente oficial pudo leerse (2026-09-21).** Se intentó InfoLeg y un
espejo institucional del texto de la Ley 25.326; ambos bloqueados por el proxy de
egreso. Único canal disponible: un buscador.

| Punto | Estado | Qué falta |
| --- | --- | --- |
| Ley 25.326 art. 5 inc. 2 ap. d (relación contractual) | `[C]` — transcripción coincidente entre fuentes secundarias en esta ronda | Lectura del texto oficial. Es la base de E1, E2 y del encuadre A. |
| Ley 25.326 art. 4 incs. 1 y 7 (minimización y destrucción) | `[P]` | Base de todo el §8. |
| Ley 25.326 art. 6 (información en la recolección) | `[C]` | Base de C-002-14. |
| Ley 25.326 arts. 2 y 7 (dato sensible; estatus del dato biométrico) | `[P]` | Base del §5.3. |
| Ley 25.326 arts. 9, 11, 12, 25 | `[P]` | Base de §6 y D-002-18. |
| SID de RENAPER; Disposición RENAPER 4133/18; Convenio Único de Confronte | `[C]` en cuanto a existencia, funcionamiento por cotejo facial y acceso de privados por convenio | No leídos. Sólo importa si se reabre §5.3. |
| Criterio de la AAIP sobre tratamiento biométrico | `[P]` | Pregunta concreta al estudio. |
| Leyes de colegiación provinciales — publicidad del padrón | `[P]` | Base de E2. **Varía por jurisdicción.** |

### Cinco preguntas concretas

1. **¿Encuadre A o B para E4?** (§4.4) Es la pregunta principal.
2. **¿Una videollamada no grabada constituye tratamiento registrado** bajo el art.
   2? (§4/E3)
3. **¿24 horas tras el cierre, o destrucción inmediata?** (§8.2) ¿Y les parece
   defendible el tope absoluto de 15 días?
4. **¿Qué hacemos ante sospecha de fraude?** (§8.4) Es la única tensión real del
   documento.
5. **¿Consultar el padrón público de un colegio es tratamiento que requiera base
   propia**, y varía eso por jurisdicción? (§7)

---

## 15. Resumen para la compuerta

- **Catálogo de cinco entradas**, cuatro de las cuales **no persisten ningún dato
  nuevo**: canal ya registrado (E1), canal institucional del colegio para el
  abogado (E2), videollamada sin grabación (E3), DNI por visor efímero (E4) y
  escalamiento humano final (E5). **Escalera con motivo de ascenso obligatorio,
  no menú.**
- **Fuera, expresamente:** selfie con DNI, cualquier documento patrimonial,
  biometría y SID de RENAPER, adjuntos por correo, y el CUIT/CUIL como secreto
  compartido —el CUIL no es un secreto y usarlo degradaría el segundo factor a un
  dato público—.
- **Cliente vs. abogado:** el abogado tiene la matrícula ya verificada y un
  registro público independiente detrás. E2 aprovecha eso y **le evita entregar
  documentación nueva**, sin acortar la espera ni saltear el doble control. El
  cliente no tiene equivalente; el administrador no tiene atajo.
- **Conservación:** destrucción automática dentro de las 24 h del cierre, tope
  absoluto de 15 días desde la carga, evento de destrucción auditable. Sobrevive
  sólo la constancia: qué clase, quién, cuándo, resultado. **Nunca el documento
  ni una transcripción.**
- **Sin salida:** nadie queda afuera. Revisión de conjunto, certificación de
  firma cuyo costo no debería trasladarse al titular, presencialidad voluntaria,
  y rechazo motivado por escrito con los derechos de los arts. 14 y 16 intactos
  —que no pueden quedar condicionados a tener el segundo factor—.
- **Dictamen de canal: asincrónico por defecto, sincrónico por elección, nunca
  presencial como requisito.** Lo que hace defendible la verificación no es el
  canal sino el expediente: espera cancelable, aviso multicanal, doble control y
  constancia.
- **Requiere ratificación de un abogado matriculado antes de producción**
  (C-002-13). No bloquea T-10.
