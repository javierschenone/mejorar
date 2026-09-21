# Revisión de cumplimiento 002 — Identidad y acceso

| Campo | Valor |
| --- | --- |
| Autor | `compliance-legal` |
| Spec de origen | `specs/002-identidad-y-acceso/spec.md` |
| Compuerta | G1 |
| Fecha de la revisión | 2026-09-21 |
| Estado | BORRADOR — pendiente de aprobación humana en G1 |
| **Veredicto** | **APTO CON CONDICIONES** (12 condiciones verificables, §6) |

---

> ## Advertencia principal — leer antes que cualquier otra cosa
>
> **Quien escribe este documento no es abogado y esto no es asesoramiento
> jurídico.** Es material de trabajo preparado por un agente revisor para que un
> **abogado matriculado** lo lea, lo corrija y lo firme.
>
> Ninguna afirmación normativa de este documento debe tomarse como cierta. Todo
> parámetro del §5 sale con `requiereValidacionProfesional: true` y **no puede
> usarse en producción** hasta que una persona matriculada lo ratifique por
> escrito, con nombre, matrícula, jurisdicción y fecha.
>
> **Acceso a fuentes oficiales en esta revisión (2026-09-21).** Se repitió la
> situación de la ronda del 2026-09-20: la política de egreso de red bloqueó
> InfoLeg, `argentina.gob.ar` y los demás destinos oficiales intentados. El único
> canal disponible fue un buscador. Por eso **ninguna afirmación de este
> documento lleva `[V]`**: lo mejor que se pudo obtener es `[C]`. Ver §8.

### Leyenda de confiabilidad

Misma leyenda que `specs/004-motor-reglas-legales/cumplimiento.md`, para que los
dos documentos se lean con el mismo criterio.

| Marca | Significado |
| --- | --- |
| `[V]` | Verificada contra fuente oficial en línea. **No se usa en este documento: ninguna fuente oficial pudo abrirse.** |
| `[C]` | **Corroborada por buscador, sin lectura de la fuente oficial.** Sirve para orientar al estudio; **no vale para citar hacia afuera ni para evaluar en producción.** A efectos de bloqueo se trata igual que `[P]`. |
| `[P]` | **Pendiente de verificación documental.** Conocimiento del revisor, no contrastado. Hipótesis, no dato. |
| `[D]` | **A determinar por el estudio.** El revisor no propone valor. |
| `[!]` | **Contradicción abierta.** No se eligió entre versiones. |
| `[I]` | Interpretación o criterio del revisor, no texto legal. |

### Nota de numeración

Las condiciones de este documento se identifican **`C-002-NN`** y los defectos
**`D-002-NN`**, para que no se confundan con las `C-NN` / `D-NN` de la spec 004
en `REGISTRO-COMPUERTAS.md`.

---

## 0. Encuadre: por qué esta feature es más liviana, y en qué no lo es

`[I]` La 004 trata datos patrimoniales y emite conclusiones jurídicas. La 002 no
hace ninguna de las dos cosas: trata datos de identidad y de sesión, no consulta
bureaus, no dictamina, no calcula, no promete nada. **No se detectó en toda la
spec una sola promesa de resultado** (constitución #6) ni un cobro de encuadre
dudoso. El riesgo legal es, efectivamente, mucho menor.

Hay tres cosas, sin embargo, que esta feature sí hace y que no son livianas:

1. **Es la feature que crea la primera base de datos personales del producto.**
   Todas las obligaciones de la Ley 25.326 que hoy figuran como "pendientes antes
   de producción" en `docs/03` §3 (registro de la base, designación del
   responsable, política de privacidad) **empiezan a correr con esta feature**, no
   con la 003 ni con la 007.
2. **Es el punto de recolección.** El art. 6 de la Ley 25.326 `[C]` obliga a
   informar **en el momento en que se recogen los datos**. Ese momento es el
   formulario de alta de la 002. Es la única obligación de la 25.326 que, por
   definición, no puede diferirse a la 003.
3. **Es el control de acceso de todo lo demás.** El art. 9 de la Ley 25.326 `[P]`
   (seguridad de los datos) se cumple o se incumple mayormente acá. Un fallo de
   RBAC en la 002 expone los datos patrimoniales de las features 007 en adelante.

`[I]` El resto de la spec es, técnicamente, sólida y en varios puntos **mejor de
lo que exige la norma**: CA-19 (verificación de asignación en cada consulta, no
sólo en el listado) y R-07 son la traducción correcta del art. 9 y del deber de
confidencialidad del art. 10 `[P]`. Conviene decirlo antes de la lista de lo que
falta.

---

## 1. Normativa aplicable

| Norma | Artículo | Qué exige | Cómo lo cumple la feature |
| --- | --- | --- | --- |
| Ley 25.326 | Art. 4 incs. 1 y 2 — calidad y **minimización** `[P]` | Los datos deben ser ciertos, adecuados, pertinentes y **no excesivos** respecto de la finalidad para la que se obtuvieron, y no pueden usarse para finalidades distintas. | Parcial. El alta pide correo, contraseña, nombre y **CUIT/CUIL "si aplica al rol"**, sin declarar para qué se usa el CUIT/CUIL en esta feature. Ver §2.2 y D-002-01. |
| Ley 25.326 | Art. 4 inc. 7 — **destrucción** `[P]` | Los datos deben destruirse cuando dejen de ser necesarios o pertinentes para la finalidad. | **No cubierto por ninguna CA.** La spec no fija plazo de conservación para ningún dato. Condición C-002-03. |
| Ley 25.326 | Art. 5 inc. 2 ap. d — base legal sin consentimiento `[P]` | No se requiere consentimiento cuando los datos **derivan de una relación contractual** del titular y **resultan necesarios para su desarrollo o cumplimiento**. | `[I]` Ésta es, a criterio del revisor, la base legal de casi todo lo que trata la 002. **La spec no la declara en ningún lado.** Condición C-002-01. |
| Ley 25.326 | Art. 6 — **información al titular en la recolección** `[C]` | Al recoger los datos hay que informar, en forma **expresa y clara**: (a) finalidad y destinatarios o clase de destinatarios; (b) existencia de la base y **identidad y domicilio del responsable**; (c) **carácter obligatorio o facultativo** de cada respuesta; (d) consecuencias de darlos, de negarse o de su inexactitud; (e) posibilidad de ejercer acceso, rectificación y supresión. | **No cubierto por ninguna CA.** El §4 paso 5 sólo dice "acepta los términos y la política de privacidad". Aceptar no es ser informado. **Ésta es la principal condición de G1.** C-002-01. |
| Ley 25.326 | Art. 9 — **seguridad de los datos** `[P]` | Medidas técnicas y organizativas necesarias para garantizar seguridad y confidencialidad y evitar adulteración, pérdida, **consulta o tratamiento no autorizado**. Estándar de adecuación al riesgo, sin tecnologías nombradas. | Bien cubierto en lo sustantivo: R-02 (argon2id), R-05, R-06, R-07, CA-08, CA-10, CA-11, CA-14, CA-19, CA-20. Es la parte más fuerte de la spec. Ver §4 sobre MFA. |
| Ley 25.326 | Art. 10 — **deber de confidencialidad** `[P]` | El responsable y quienes intervengan en el tratamiento están obligados al secreto, que **subsiste aun después de finalizada la relación**. | Alcanza al abogado y al administrador. `[I]` No hay CA ni regla que lo traslade al vínculo contractual con ellos. Corresponde a la spec 018, pero **debe declararse como dependencia** (D-002-09). |
| Ley 25.326 | Arts. 14 y 15 — **derecho de acceso** `[C]` | Acceso gratuito con intervalo mínimo de seis meses; respuesta dentro de **diez días corridos**; la información debe ser amplia y versar sobre la totalidad del registro del titular. | CA-25 (exportación autoservicio de datos de identidad y sesión). Sobre si el recorte es correcto, ver §4.1. |
| Ley 25.326 | Art. 16 — rectificación, actualización, supresión `[C]` | Plazo de **cinco días hábiles** para rectificar o suprimir. | CA-23 cubre la rectificación **de los datos de contacto**. **No hay camino para rectificar un CUIT/CUIL mal cargado** (D-002-04) ni para **suprimir la cuenta** (D-002-05). |
| Ley 25.326 | Art. 12 — **transferencia internacional** `[P]` | Prohibida hacia países sin nivel de protección adecuado, salvo excepciones o cláusulas contractuales. Disposición 60-E/2016 AAIP, cláusulas modelo `[P]`. | No aparece en la spec. Se dispara con el proveedor de correo transaccional y con cualquier servicio de geolocalización por IP (CA-13). C-002-10. |
| Ley 25.326 | Art. 25 — **tratamiento por encargo de terceros** `[P]` | El tratamiento por cuenta de terceros debe estar regulado por contrato, con la finalidad limitada y sin cesión ulterior. | Ídem. El proveedor de correo y el de geolocalización son encargados de tratamiento. C-002-10. |
| Ley 25.326 | Art. 21 — **inscripción de la base** `[P]` | Toda base de datos personales que exceda el uso exclusivamente personal debe inscribirse ante la autoridad de aplicación, con responsable designado. | `[I]` **La 002 es la feature que hace exigible esta obligación**, porque es la que crea la base. Figura en `docs/03` §3 punto 4 como pendiente genérico; acá tiene destinatario y momento. C-002-11. |
| Res. AAIP 47/2018 | Anexo I — **medidas de seguridad recomendadas** `[C]` | Derogó las Disposiciones DNPDP 11/2006 y 9/2008. Incluye control de acceso, mecanismos de autenticación, segregación de roles y funciones, e identificación fehaciente de quien accede a entornos con datos personales. **Son recomendaciones, no un piso obligatorio tasado** `[C]`. | `[I]` Importante para la decisión 002-B: **no encontré una norma argentina que imponga MFA de forma expresa**. Lo que hay es un estándar abierto (art. 9) más recomendaciones. Ver §4.2. |
| Ley 24.240 | Art. 4 — **deber de información** `[P]` | Información cierta, clara y detallada sobre las características esenciales del servicio y sus condiciones de comercialización. | Aplica al alta. Ver §3 y el análisis del patrón de no-revelación en §4.3. |
| Ley 24.240 | Art. 8 bis — **trato digno** `[P]` | Condiciones de atención y trato digno; prohibición de conductas que coloquen al consumidor en situaciones vergonzantes o vejatorias. | `[I]` Relevante en dos puntos concretos de esta spec: el **bloqueo por intentos fallidos** (002-A) y el **limbo del abogado pendiente de verificación** (R-04). Un consumidor bloqueado sin salida clara es un problema de trato digno, no sólo de UX. |
| Ley 24.240 | Art. 37 — cláusulas abusivas `[P]` | Se tienen por no convenidas las cláusulas que desnaturalicen las obligaciones o importen renuncia de derechos del consumidor. | Aplica al texto de términos y condiciones que se acepta en §4 paso 5. Un consentimiento "todo en uno" que arrastre finalidades ajenas al servicio es candidato a este artículo. C-002-02. |
| Ley 24.240 | Art. 40 — responsabilidad solidaria `[P]` | Responde toda la cadena de prestación por el daño derivado del servicio. | `[I]` Es el fundamento del riesgo de R-04: si la plataforma exhibe a un abogado como verificado y no lo está, la plataforma no es ajena al daño. Ver §4.4. |
| Res. SCI 424/2020 | Botón de arrepentimiento y baja `[C]` | Quien comercializa por web o aplicación debe publicar un enlace "BOTÓN DE ARREPENTIMIENTO" accesible desde la portada, en lugar destacado; **al usarlo no se puede exigir registración previa ni ningún otro trámite**; el proveedor informa el código de arrepentimiento dentro de las 24 h por el mismo medio. | **No aparece en la spec.** `[I]` Impacta directamente en el diseño de la 002: el camino de baja **no puede exigir iniciar sesión**. Ver D-002-05 y C-002-05. |
| Ley 25.506 | Arts. 2, 5 y concordantes — firma electrónica `[P]` | La firma electrónica es válida, pero **quien la invoca soporta la carga de acreditar su validez** (a diferencia de la firma digital, que goza de presunción). | `[I]` El checkbox del §4 paso 5 es firma electrónica. De ahí se sigue que **hay que poder probar qué texto se aceptó y cuándo**, lo que convierte a C-002-02 en un requisito probatorio además de uno de datos personales. |
| CCyC | Arts. 24 a 26 — capacidad `[P]` | Los menores de edad tienen capacidad restringida para contratar; el acto celebrado sin la representación debida es impugnable. | **La spec no dice nada sobre la edad del titular.** D-002-08. |
| Ley 23.187 (CABA) y leyes provinciales de colegiación | Ejercicio de la abogacía reservado a matriculados `[P]` | Sólo puede ejercer quien está inscripto y con matrícula **vigente** en el colegio de **esa** jurisdicción. | R-04 y CA-05. Ver §4.4: el problema no es el alta, es la **vigencia sobreviniente**. |

**Lo provincial.** `[I]` Dos cosas de esta feature dependen de normativa local y hay
que decirlo explícitamente: **(a)** la matrícula y su régimen de vigencia,
suspensión y cancelación son de cada colegio provincial, y no hay un régimen
unificado; **(b)** la autoridad de defensa del consumidor competente frente a un
reclamo por el alta o por la baja es la del **domicilio del consumidor**, lo que
multiplica las jurisdicciones posibles. Nada de esto bloquea G1, pero condiciona
el diseño del proceso manual de R-04 y el de la baja.

---

## 2. Datos personales (Ley 25.326)

### 2.1 Inventario dato por dato

Todas las bases legales de esta tabla son **propuesta del revisor** `[I]` sobre el
art. 5 inc. 2 ap. d `[P]`, y todas las columnas de conservación son **propuesta**,
porque **la spec no fija ninguna**.

| Dato | Finalidad declarada | Base legal propuesta `[I]` | Conservación propuesta | Quién accede |
| --- | --- | --- | --- | --- |
| Correo electrónico | Identificación de la cuenta, confirmación, recuperación, avisos de seguridad | Relación contractual (art. 5.2.d) `[P]` | Vida de la cuenta + plazo de baja (`[D]`, §5) | Titular; administrador con permiso de gestión de usuarios; auditoría |
| Contraseña (hash `argon2id`) | Autenticación | Ídem | Vida de la cuenta. **Nunca reversible ni exportable**; queda excluida de CA-25 | Nadie. Ningún rol la lee |
| Nombre para mostrar | Identificación en la interfaz y en la comunicación | Ídem | Vida de la cuenta | Titular; contrapartes del caso según RBAC; administrador |
| CUIT/CUIL | **No declarada en la spec.** Se valida el dígito verificador (CA-04) y se usa para detectar doble alta (§7) | `[!]` **Sin finalidad declarada, no hay base legal que evaluar.** Ver D-002-01 | `[D]` | Titular; administrador; auditoría |
| Matrícula y jurisdicción (abogado) | Habilitación profesional y responsabilidad identificable | Relación contractual con el abogado `[P]`. `[I]` Dato de un profesional, de publicidad registral en el colegio: sensibilidad baja | Vida de la cuenta + plazo de prescripción de la responsabilidad profesional `[D]` | Titular; administrador; cliente asignado; auditoría |
| Especialidades declaradas (CA-24) | Asignación de casos | Ídem | Ídem | Ídem |
| Estado de verificación profesional | Control de habilitación | Ídem | Ídem | Ídem |
| **Dirección IP** (CA-13) | Seguridad de la sesión y detección de accesos anómalos | Art. 5.2.d `[P]` + art. 9 `[P]` | `[I]` Propuesta: 90 días para sesiones cerradas; la bitácora, aparte (§5) | Titular (sus sesiones); administrador con permiso; auditoría |
| **Ubicación aproximada por IP** (CA-13) | Ídem | Ídem | Ídem | Ídem |
| **Dispositivo aproximado / agente de usuario** (CA-13) | Ídem | Ídem | Ídem | Ídem |
| Tokens de refresco (y su estado usado/revocado) | Rotación y detección de reutilización (CA-10, CA-11) | Art. 9 `[P]` | `[I]` Sólo mientras sean necesarios para detectar reutilización; después, purga | Nadie los lee; el sistema los compara |
| Registro de intentos fallidos (CA-09) | Defensa contra fuerza bruta | Art. 9 `[P]` | `[I]` Ventana del parámetro + margen. No indefinido | Auditoría |
| Aceptación de términos y política (§4 paso 5) | Prueba del consentimiento y del contrato | Art. 6 `[C]`; Ley 25.506 `[P]` | Vida de la cuenta + plazo de prescripción de la acción del consumidor `[D]` | Titular; auditoría; legal |
| `EventoAuditoria` (CA-21) | Bitácora inmutable de accesos, constitución #5 | Art. 9 `[P]` | `[D]` — ver §5 | Auditoría; administrador con permiso; `[I]` el titular debería poder verla, ver §4.1 |

### 2.2 Tres hallazgos de esta tabla

**(a) `[I]` El CUIT/CUIL es el único dato del alta sin finalidad declarada, y es
el más identificatorio de todos.** La spec lo pide "si aplica a su rol" y lo
valida por dígito verificador, pero **en la feature 002 no hay ninguna función
que lo necesite**: la autenticación funciona con correo, el RBAC funciona con
permisos, el perfil funciona con el nombre. Su único uso efectivo dentro del
alcance de la 002 es la detección de doble alta del §7 — que es un uso, pero es
un uso que nadie declaró y que, además, tiene el efecto colateral del punto (c).

`[I]` Frente al art. 4 inc. 1 `[P]`, recolectar en 002 un identificador que va a
hacer falta recién en la 007 es exactamente lo que la minimización desalienta. La
salida correcta no es necesariamente sacarlo: es **decidirlo y declararlo**. Dos
caminos legítimos, y hay que elegir uno en G1: declarar la finalidad ("identificar
unívocamente al titular para evitar duplicación de cuentas y para las consultas
que el titular autorice más adelante") y dejarlo, o diferirlo a la feature que lo
necesita. Lo que no pasa es dejarlo sin declarar. **D-002-01, C-002-04.**

**(b) `[I]` CA-13 introduce tres datos personales que el §4 de la spec no
enumera.** El recorrido del usuario declara como datos del alta "correo,
contraseña, nombre y CUIT/CUIL". Pero CA-13 trata además **IP, ubicación
aproximada y dispositivo**. La IP es dato personal, y derivar de ella una
ubicación es **generar** un dato nuevo que el titular no aportó. No es grave —la
finalidad de seguridad es legítima y la funcionalidad es a favor del usuario—
pero tiene dos consecuencias concretas: hay que **informarlo en el art. 6**
(C-002-01) y, si la geolocalización la resuelve un tercero, ese tercero es
**encargado de tratamiento** y probablemente **transferencia internacional**
(C-002-10). `[I]` Recomendación de minimización: que la resolución IP→ubicación
se haga con una base de datos local, no enviando la IP del cliente a un servicio
externo. Es la diferencia entre un tratamiento interno y una cesión.

**(c) `[!] La spec protege contra la enumeración por correo y la habilita por
CUIT/CUIL.** R-05 y CA-02 son categóricos: "ninguna respuesta de autenticación
revela si un correo existe". Pero el §7 dice: *"Doble registro con el mismo
CUIT/CUIL y distinto correo: se detecta y **se bloquea el segundo alta**"*.

`[I]` Eso es un oráculo de enumeración por CUIL, y el CUIL en Argentina no es un
secreto: se deduce del DNI y circula en listados. Cualquiera con una lista de
CUILes puede preguntarle a la plataforma cuáles tienen cuenta. Y lo que revela no
es trivial: **que una persona determinada es usuaria de una plataforma de gestión
de deudas**, o sea, una inferencia sobre su situación patrimonial. No es un dato
sensible en el sentido del art. 2 de la Ley 25.326 `[P]` —no está en la
enumeración taxativa— pero **sí es exactamente lo que la constitución #5 manda
proteger**, y la propia spec reconoce en R-05 que la enumeración "es una fuga de
datos personales por sí sola".

`[I]` La contradicción es interna a la spec y no requiere criterio jurídico para
verse. Hay soluciones conocidas (diferir la detección al momento de la
verificación del correo, y resolverla por el canal del titular real, igual que
CA-02 hace con el correo), pero **elegir la solución no es del revisor legal**. Lo
que sí es del revisor legal es decir que el tratamiento actual es incoherente.
**D-002-02, C-002-04.**

### 2.3 Lo que la spec no dice sobre conservación, y por qué importa acá

`[I]` La spec no fija **ningún** plazo de conservación. En la 004 eso era
aceptable porque el motor no persiste nada. Acá no lo es: la 002 **es** la
persistencia.

El caso más concreto, y el que a mi criterio no puede pasar a G2 sin decisión:
**CA-01 crea una cuenta con datos personales por el solo hecho de que alguien
escriba un correo en un formulario.** Si nunca se confirma, quedan almacenados
indefinidamente el correo, el nombre y eventualmente el CUIL de una persona que
**nunca fue usuaria** —y que pudo no haber sido quien tipeó el formulario—. Frente
al art. 4 inc. 7 `[P]`, eso es conservación sin finalidad subsistente. Es barato
resolverlo ahora (una regla de purga) y caro después. **C-002-03.**

El caso más difícil, y por eso lo dejo en `[D]`: **cuánto se conserva una cuenta
dada de baja.** Hay una tensión real entre el art. 4 inc. 7 (destruir) y la
necesidad de conservar prueba del consentimiento, de la contratación y de la
facturación por los plazos contables y de prescripción. `[I]` La respuesta
probable es conservación diferenciada —se suprime el perfil, se conserva un
núcleo probatorio mínimo y bloqueado— pero **el corte exacto lo tiene que
dictaminar el estudio**, y la spec 003 no puede diseñarlo sin esa respuesta.

---

## 3. Deber de información al consumidor (Ley 24.240)

`[I]` En esta feature el deber de información y el art. 6 de la Ley 25.326 se
superponen en un mismo lugar físico —el formulario de alta— y conviene tratarlos
juntos, porque si se tratan por separado terminan en dos textos distintos que se
contradicen.

**Regla de forma, heredada de la 004 y de la constitución #13:** la información
del art. 6 va **en la pantalla de alta**, no exclusivamente dentro del documento
de términos y condiciones. Un enlace a un PDF de doce páginas no es informar "en
forma expresa y clara" `[C]`. `[I]` El patrón aceptable es: texto breve en la
pantalla, con lo mínimo del art. 6, y enlace al documento completo.

**Contenido mínimo que debe estar en la pantalla de alta** (propuesta del revisor,
a reescribir por `ux-expert` y a ratificar por el abogado):

> **Qué hacemos con estos datos.**
> Usamos tu correo para identificar tu cuenta, confirmarla y avisarte si alguien
> intenta entrar. Guardamos tu nombre para mostrártelo en la app. {Si se pide
> CUIT/CUIL: *Te pedimos el CUIL para {finalidad declarada}.*}
> Cuando entrás, guardamos la fecha, el dispositivo y una ubicación aproximada de
> tu sesión, para que puedas ver desde dónde se accedió a tu cuenta y cerrarla si
> no fuiste vos.
> **Responsable de la base de datos:** {razón social y domicilio}.
> **Podés pedir ver, corregir o borrar tus datos cuando quieras**, desde tu perfil
> o escribiendo a {canal}.
> {Marcar cuáles campos son obligatorios y cuáles no, y qué pasa si no los das.}

`[I]` Los cinco bloques corresponden a los incisos a) a e) del art. 6 `[C]`. El
que más se olvida y más fácil es de incumplir es el **inciso c)**: decir cuáles
respuestas son obligatorias y cuáles facultativas. Si el CUIL se pide, hay que
decir si se puede seguir sin darlo.

**Lo que este texto no debe hacer** `[I]`: no debe mencionar consulta a bureaus,
ni informes crediticios, ni cesión a terceros con fines comerciales, ni
marketing. Nada de eso ocurre en la 002, y anticiparlo acá dentro de un
consentimiento genérico es precisamente lo que convierte un consentimiento en
inválido. Ver §4.5.

**Prohibiciones de copy.** `[I]` Aplica la lista del §3.8 del dictamen de la 004.
En esta feature no hay hallazgos que rotular, pero **la pantalla de alta es la
primera pieza de producto que ve el usuario** y es donde más tienta poner "te
ayudamos a salir del Veraz". Debe quedar sujeta al mismo test de términos
prohibidos.

---

## 4. Los cinco puntos del encargo

### 4.1 CA-25 y el recorte del derecho de acceso — ¿es correcto?

> **Dictamen: el recorte es correcto y se sostiene, con una excepción que no
> puede esperar a la 003, y dos advertencias.**

**Por qué el recorte se sostiene.** `[I]` El art. 14 `[C]` da derecho a acceder a
la **totalidad** de los datos del titular en el registro. A la altura de la
feature 002, la totalidad de los datos del titular **es** identidad y sesión: no
hay expediente, no hay deuda, no hay informe crediticio, no hay consentimientos
versionados. CA-25 no recorta el derecho: agota lo que hay. El recorte real es
del **circuito formal** (plazos, gratuidad semestral, verificación de identidad
del solicitante, respuesta cuando el pedido no puede resolverse por autoservicio),
y ése sí es razonable que viva en la 003, que es donde el derecho se vuelve
complejo.

**La excepción que no puede esperar: el art. 6, no el art. 14.** `[I]` Acá está,
a mi criterio, el error de encuadre de la pregunta —no de la spec—. Lo que no
puede diferirse a la 003 no es el derecho de **acceso**: es el deber de
**información en la recolección**. El acceso es un derecho que se ejerce después y
que puede tener su circuito en otra feature; la información del art. 6 se debe
**en el instante** en que el dato se recoge, y ese instante está íntegramente
dentro de la 002. Si la 002 sale a un piloto sin el art. 6 cumplido, **cada alta
es una recolección sin información previa**, y eso no se repara retroactivamente
en la 003. **C-002-01.**

**Advertencia 1 — CA-25 debe declarar qué excluye.** `[I]` Tal como está, "recibe
sus datos de identidad y de sesión" es un alcance positivo sin negativo. Debe
decir expresamente que **no** se exportan el hash de la contraseña ni los tokens
—exportarlos sería crear un vector de ataque a pedido— y que la exportación se
entrega al titular autenticado. Es un matiz de seguridad con consecuencia legal:
una exportación mal diseñada es una fuga con forma de derecho.

**Advertencia 2 — la bitácora.** `[I]` CA-21 genera `EventoAuditoria` con "quién
accedió". En un producto donde abogados y administradores ven expedientes ajenos,
**poder decirle al cliente quién miró su información** es la transparencia más
valiosa que el producto puede ofrecer, y refuerza el art. 9 en su faz de control.
No afirmo que el art. 14 lo exija —`[D]`, es una pregunta abierta para el
estudio—, pero recomiendo que la 003 lo contemple y que la 002 **no cierre la
puerta** guardando la bitácora en una forma que impida filtrarla por titular.

### 4.2 Las tres decisiones abiertas del §9 — aristas legales

No decido ninguna. Dictamino sobre lo que la spec no vio.

#### 002-A — umbral de bloqueo por intentos fallidos

`[I]` **No es un parámetro normativo.** No hay norma argentina, que este revisor
conozca, que fije un número de intentos. Es un parámetro de producto y la
recomendación de la spec (5 intentos / 15 minutos / demora exponencial) no tiene
objeción legal.

**Lo que la spec no vio, y sí tiene arista legal:** el bloqueo es una
**denegación de servicio que un tercero puede provocar sobre la cuenta de un
consumidor**. Basta con que alguien tipee mal la contraseña de una víctima cinco
veces. Frente al art. 8 bis `[P]` y al art. 4 `[P]`, y con una audiencia bajo
estrés financiero que puede necesitar entrar a su expediente con urgencia (una
intimación con plazo, una audiencia), un bloqueo sin salida es un problema. Dos
recaudos, ambos verificables:

| # | Recaudo | Verificación |
| --- | --- | --- |
| A-1 | **El bloqueo por intentos fallidos nunca inhabilita el camino de recuperación de contraseña.** Quien se bloquea siempre tiene una salida autoservicio. | Test: cuenta bloqueada por CA-09 + pedido de recuperación (CA-15) ⇒ funciona. |
| A-2 | **La notificación al dueño (CA-09) dice cuánto dura el bloqueo y cómo salir antes.** No sólo "tu cuenta fue bloqueada". | Test de plantilla. |

`[I]` A-1 tiene además un efecto de seguridad deseable: quita el incentivo a
poner umbrales bajos "por las dudas", que es como se degrada la disponibilidad.

#### 002-B — MFA obligatorio por rol

> **Dictamen: opción B como piso, con MFA obligatorio no negociable para
> ADMINISTRADOR, y con revisión obligada en la feature 007.**

**Respuesta directa a la pregunta del encargo: no encontré una norma argentina
que imponga autenticación multifactor a quien accede a datos crediticios de
terceros.** Lo que hay es:

- **Ley 25.326 art. 9** `[P]`: obligación de medidas "necesarias" para garantizar
  la seguridad. `[I]` Es un estándar de **adecuación al riesgo**, no una lista.
  No nombra MFA, pero tampoco lo excluye: si el riesgo es alto, la medida
  adecuada sube.
- **Res. AAIP 47/2018** `[C]`: reemplazó a la Disposición DNPDP 11/2006, que era
  la que fijaba niveles de seguridad tasados (básico/medio/crítico). El régimen
  actual es de **medidas recomendadas**, con control de acceso, mecanismos de
  autenticación y segregación de roles entre sus materias. `[C]` **No leí el
  Anexo I** —fuente oficial bloqueada— y no puedo afirmar qué dice sobre segundo
  factor. Queda `[D]` y es una pregunta concreta para el estudio.
- **Normativa BCRA sobre gestión de riesgos de tecnología y seguridad de la
  información** `[D]`: impone requisitos fuertes de autenticación, pero **a
  entidades financieras**, que la plataforma no es. `[I]` Hay que mirar si algún
  régimen de **proveedores no financieros de crédito** o similar pudiera
  alcanzarnos por alguna vía; a criterio del revisor, hoy no, porque no
  otorgamos crédito ni custodiamos fondos (constitución #9). **Pregunta para el
  estudio, no conclusión.**

`[I]` **Conclusión del revisor:** la ausencia de una norma expresa **no vuelve
indiferente la decisión**. Bajo un estándar de adecuación al riesgo, lo que
importa es el perfil de cada rol, y los tres perfiles son distintos de verdad:

| Rol | A cuántos titulares expone una sesión comprometida | Dictamen |
| --- | --- | --- |
| `ADMINISTRADOR` | **A todos.** Incluye la aprobación de matrículas (CA-22) y la gestión de usuarios. | `[I]` **MFA obligatorio, sin excepción y sin configuración que lo apague.** A mi criterio esto no es una opción de la decisión 002-B: es el mínimo defendible del art. 9. Si el producto decide la opción A, este punto debería tratarse igual. |
| `ABOGADO` | A todos sus clientes asignados; por diseño, muchos. Además está alcanzado por el secreto profesional `[P]`, que es una obligación **suya**, y un factor único la compromete. | `[I]` **MFA obligatorio.** Coincide con la opción B. |
| `CLIENTE` | A sí mismo. | `[I]` **Opcional es aceptable**, con los tres recaudos de abajo. El argumento de la spec sobre barrera de adopción no es una excusa comercial: es la constitución #13 y el art. 8 bis, y es correcto. Exigirle MFA a una persona sin smartphone de gama media es excluirla del servicio. |

**Tres recaudos para el cliente opcional:**

| # | Recaudo | Verificación |
| --- | --- | --- |
| B-1 | El MFA **se ofrece y se puede activar desde el día uno** desde el perfil, con explicación en lenguaje llano. Opcional no significa escondido. | CA nueva + test. |
| B-2 | **La decisión se revisa obligatoriamente en la feature 007**, cuando el portal del cliente empiece a mostrar informes crediticios. `[I]` Hoy la cuenta del cliente contiene su correo y su nombre; ahí va a contener su informe de deuda. El cálculo de riesgo cambia y la decisión tomada hoy no debe heredarse por inercia. | Dependencia declarada en el backlog de 007. |
| B-3 | El segundo factor del cliente, si lo activa, **no puede desactivarse sin reautenticación fuerte**, para que un atacante con la sesión abierta no lo apague. | Test. |

**Lo que la spec no vio en 002-B: la recuperación del segundo factor.** El §7
dice que la pérdida del MFA sin códigos de respaldo "requiere proceso de soporte
humano". Es la decisión correcta —un camino automático sería una puerta trasera—
pero **crea un tratamiento de datos nuevo que nadie especificó**: para verificar
la identidad de quien reclama, soporte va a pedir documentación (foto de DNI,
selfie, comprobantes). Eso es recolección de **datos identificatorios adicionales,
por un canal no especificado, sin finalidad declarada, sin plazo de conservación
y sin base legal escrita**. `[I]` Es el tipo de circuito que se improvisa en una
conversación de soporte y queda para siempre en una carpeta compartida. Si el MFA
pasa a ser obligatorio para dos roles, este circuito **deja de ser un caso raro y
pasa a ser rutina**. **C-002-12.**

#### 002-C — quién crea la primera cuenta de administrador

`[I]` Ninguna de las dos opciones tiene obstáculo legal, y coincido con la
recomendación de la spec (opción A): una credencial conocida en una variable de
entorno es una ventana de exposición, y el argumento de la spec es correcto.

**Lo que la spec no vio, y sí es legal:** la cuenta sembrada es, por definición,
la que más puede ver. Si es una cuenta **genérica** (`admin@`), la bitácora del
art. 9 `[P]` y de la constitución #5 **deja de poder atribuir el acceso a una
persona**, que es justamente para lo que existe. Una bitácora que dice que "admin"
accedió al expediente de alguien no prueba nada ante un reclamo de habeas data ni
sirve para deslindar responsabilidades. Tres recaudos:

| # | Recaudo | Verificación |
| --- | --- | --- |
| C-1 | **No existen cuentas administradoras compartidas ni genéricas.** Toda cuenta con rol `ADMINISTRADOR` corresponde a una persona humana identificada. | Test + revisión del script de siembra en G4. |
| C-2 | La cuenta de siembra **se nominaliza en el primer ingreso o se deshabilita** una vez creada la primera cuenta nominal. No queda viva "por las dudas". | Test. |
| C-3 | **La propia siembra genera `EventoAuditoria`**, y también toda alta de administrador (CA-22 audita la verificación de matrícula, pero **ninguna CA audita la creación de un administrador**). | Test + D-002-06. |

`[I]` C-3 es un agujero pequeño y concreto: la acción más sensible del sistema
—crear a alguien que puede ver todo— es la única que hoy no tiene CA de
auditoría.

### 4.3 El patrón de no-revelación (CA-02, CA-06, CA-15, CA-17) vs. el deber de información

> **Dictamen: no hay tensión con el art. 4 de la Ley 24.240, con una excepción
> concreta en CA-02 que sí hay que corregir.**

**Por qué en general no hay tensión.** `[I]` El art. 4 `[P]` obliga a informar
sobre **el servicio**: qué es, qué incluye, qué no, en qué condiciones, a qué
precio. No obliga a confirmarle a un desconocido si una persona determinada tiene
cuenta. Son planos distintos: el deber de información es hacia **el consumidor
sobre su contratación**; la no-revelación opera hacia **quien todavía no acreditó
ser ese consumidor**. De hecho, revelar la existencia de la cuenta a quien no
acreditó ser su titular sería un incumplimiento del art. 9 de la Ley 25.326 `[P]`
—y en este producto, como expliqué en §2.2(c), una inferencia patrimonial—. El
patrón de CA-02/06/15/17 **protege** al consumidor; no lo desinforma.

**Dónde el deber de información sí muerde, y la spec lo tiene bien puesto:** en
el momento del alta, que es donde el encargo lo ubica. Y ahí el problema **no es
la no-revelación** sino lo que señalé en §3: falta el art. 6 de la 25.326 y falta
declarar qué campo es obligatorio y para qué. **C-002-01** resuelve las dos cosas.

**La excepción concreta: CA-02 puede dejar al usuario en un callejón sin salida.**
`[I]` CA-02 dice que ante un correo ya registrado el sistema "responde igual que a
un registro exitoso". Un registro exitoso responde, según CA-01, *"te mandamos un
correo de confirmación"*. Entonces: una persona que **ya tiene cuenta y no se
acuerda** —caso frecuentísimo en esta audiencia— se registra de nuevo, lee "revisá
tu correo", y espera un correo de confirmación que nunca va a llegar con esa
forma. Queda afuera del servicio sin entender por qué. **Eso sí es un problema de
art. 4 y de art. 8 bis** `[P]`, y también de constitución #13.

`[I]` La reparación es barata y no debilita la seguridad en nada: el correo que
CA-02 ya manda al dueño real —que es a quien hay que hablarle— tiene que ser
**accionable**, no sólo una alerta. Algo como: *"Alguien intentó crear una cuenta
con tu correo. Si fuiste vos: ya tenés una cuenta, entrá desde acá o recuperá tu
contraseña desde acá. Si no fuiste vos, no tenés que hacer nada."* Con eso, el
mensaje genérico de la pantalla sigue sin revelar nada y el usuario legítimo tiene
salida por el único canal que prueba que es él. **C-002-06.**

Lo mismo, en menor grado, aplica a **CA-03**: "sin exponer la política completa"
no puede significar ocultar el requisito que se incumplió. El usuario tiene que
poder cumplir. CA-03 ya dice "con el motivo exacto", así que está bien resuelto;
lo dejo señalado para que no se degrade en implementación.

**CA-06 y CA-17 están bien.** Ambos ofrecen pedir un enlace nuevo: hay salida
autoservicio y no hay callejón.

### 4.4 R-04 — verificación manual de matrícula

> **Dictamen: la verificación manual es sostenible como decisión de alcance, y
> CA-05 es la salvaguarda estructural correcta. Pero el riesgo que importa no es
> el que R-04 y CA-05 atacan.**

**Por qué la verificación manual se sostiene.** `[I]` El fundamento de R-04 es
correcto y prefiero decirlo antes de criticar: no hay API pública unificada de
colegios por jurisdicción, y una integración mal hecha produciría verificaciones
**falsamente positivas**, que son peores que ninguna. Además CA-05 resuelve bien
el riesgo del alta: estado `PENDIENTE_DE_VERIFICACION_PROFESIONAL` que **bloquea
toda acción de abogado**. Mientras eso se cumpla, la plataforma no habilita a
ejercer a nadie sin revisión humana previa. Ése no es el problema.

**El problema es la vigencia sobreviniente.** `[I]` CA-05 y CA-22 modelan la
verificación como un **evento**: un administrador aprueba, y la cuenta queda
verificada. Pero la matrícula no es un atributo permanente: **se suspende, se
cancela, caduca por falta de pago, se pierde por sanción disciplinaria**, y todo
eso es competencia de cada colegio provincial y ocurre sin que la plataforma se
entere. Un estado `VERIFICADO` sin fecha y sin vencimiento **es verdadero el día
que se otorga y puede ser falso al mes siguiente, y el sistema seguiría
afirmándolo**.

`[I]` Ahí es donde aparece el riesgo que el encargo pregunta —que la plataforma
habilite a ejercer a alguien sin matrícula vigente— y no aparece por el proceso
manual: aparecería igual con integración automática si la consulta fuera de una
sola vez. **El defecto no es "manual", es "puntual".** Un proceso manual con
revalidación periódica es más seguro que una integración automática que se
consulta una vez en el alta.

**La segunda cara: lo que la plataforma le dice al consumidor.** `[I]` Si la
interfaz muestra a un abogado como "verificado", eso es una **afirmación de la
plataforma al consumidor** sobre una característica esencial del servicio (art. 4
y art. 8 de la Ley 24.240 `[P]`, y lealtad comercial bajo la Ley 22.802 `[P]`). Y
el art. 40 `[P]` pone a la plataforma dentro de la cadena de prestación. Si la
afirmación es falsa, la plataforma no es una espectadora del daño. Por eso
importa **qué palabra se usa**: "matrícula verificada el {fecha} contra
{constancia}" es una afirmación que la plataforma puede sostener; "abogado
verificado", a secas y sin fecha, es una afirmación permanente que no puede
sostener.

**Salvaguardas mínimas** (propuesta del revisor, todas verificables):

| # | Salvaguarda | Verificación |
| --- | --- | --- |
| M-1 | La verificación **registra la evidencia, no sólo la decisión**: qué constancia vio el administrador, de qué colegio, con qué número y de qué fecha. CA-22 audita la decisión; esto audita su fundamento. | Test: aprobación sin evidencia registrada ⇒ rechazo. |
| M-2 | El estado verificado lleva **`fechaDeVerificacion` y `vigenciaHasta`**. Vencida la vigencia, la cuenta pasa a un estado que **bloquea la asignación de casos nuevos** sin romper los casos en curso (un corte abrupto perjudicaría al cliente, constitución #1). Periodicidad propuesta: **12 meses** `[I]`, ver §5. | Test sobre el vencimiento. |
| M-3 | Existe un estado **`SUSPENDIDO`** que un administrador puede aplicar **de inmediato** y que bloquea todo, para cuando llega una notificación del colegio o una denuncia. La revocación tiene que ser tan rápida como el daño. | Test + CA nueva. |
| M-4 | **Plazo máximo de revisión del estado pendiente**, con escalamiento al vencerlo. Propuesta: **5 días hábiles** `[I]`. La métrica del §10 ("abogados pendientes por más de 48 h, sin objetivo numérico") **mide pero no obliga**: un abogado en limbo indefinido es trato indigno (art. 8 bis `[P]`) y, para el cliente que lo espera, servicio no prestado. | Alerta de back-office + test. |
| M-5 | **Obligación contractual del abogado de notificar** toda suspensión, cancelación o cambio de estado de su matrícula, dentro de un plazo. No reemplaza a M-2, la complementa. | Cláusula en el convenio (spec 018), declarada como dependencia. |
| M-6 | La interfaz **nunca afirma "verificado" sin fecha**. El microcopy dice qué se verificó, contra qué y cuándo. | Test de plantilla + revisión de `ux-expert`. |
| M-7 | La **jurisdicción de la matrícula limita la asignación de casos**. Un abogado matriculado en una jurisdicción no puede quedar asignado a un caso de otra sin matrícula en ella. | `[I]` Excede el alcance de la 002 (es de 008/012/013), pero **la 002 tiene que dejar el dato disponible y declarar la dependencia**, o después no hay con qué hacer el control. D-002-07. |

**Conflicto de interés a marcar** (mandato, punto 3). `[I]` El mismo actor que
aprueba matrículas es la organización que gana con cada abogado incorporado (fee
por lead o abono, `docs/03`). El incentivo a aprobar rápido y liviano es
estructural, aunque nadie lo ejerza. Es de baja gravedad y **M-1 lo neutraliza
casi por completo**: si hay que registrar la evidencia, aprobar sin mirar deja
rastro. Lo dejo asentado porque el mandato obliga a marcarlo, no porque lo
considere un problema grave hoy.

### 4.5 El enganche de consentimientos del §4 paso 5

> **Dictamen: dejarlo como enganche a la 003 es aceptable para G1 de la 002, pero
> "un simple checkbox" no. Hacen falta tres cosas ya en esta feature — y las tres
> son baratas ahora y caras después.**

**Por qué el diferimiento es correcto.** `[I]` El circuito de consentimientos
versionados por finalidad —con revocación, con granularidad por finalidad, con
texto histórico recuperable— es una pieza sustantiva y está bien asignada a la
003. La 002 no consulta bureaus, no cede datos y no hace marketing. Diferirlo no
deja ningún tratamiento sin base legal, porque lo que la 002 trata se apoya en la
relación contractual (art. 5.2.d `[P]`), no en el consentimiento.

**Lo que no puede diferirse, punto por punto:**

**(1) La información del art. 6** — ya desarrollado en §3 y §4.1. Aceptar no es
ser informado, y el momento de informar es el de la recolección. **C-002-01.**

**(2) La aceptación se guarda como versión, no como booleano.** `[I]` Éste es el
punto de mayor consecuencia práctica de todo el dictamen, y el más fácil de
perder. Si la 002 persiste `aceptoTerminos: true`, entonces:

- Cuando la 003 construya el registro de consentimientos, **todas las cuentas
  creadas en el interín van a tener un consentimiento que no se puede probar**:
  no se sabrá qué texto aceptaron ni cuándo.
- Frente a la Ley 25.506 `[P]`, la firma electrónica **no goza de presunción de
  validez**: la carga de probarla es de quien la invoca, o sea nuestra. Un
  booleano no prueba nada.
- La única reparación posterior sería **volver a pedirle la aceptación a toda la
  base**, que es caro, ruidoso y erosiona la confianza justo con los primeros
  usuarios.

Mínimo que la 002 debe persistir en el alta: **identificador de versión del texto
de términos, identificador de versión de la política de privacidad, hash del
texto exacto mostrado, fecha y hora, dirección IP** y, si hay más de una casilla,
cuál se marcó. No hace falta el módulo de consentimientos de la 003 para esto:
hace falta no guardar un booleano. **C-002-02.**

**(3) El alcance del checkbox se limita a lo que la 002 hace.** `[I]` La tentación
—y la práctica habitual del mercado— es redactar unos términos amplios que
incluyan de una vez la consulta a bureaus, la cesión a terceros y las
comunicaciones comerciales, para "no volver a molestar al usuario". Si eso pasa
en la 002:

- El consentimiento para la consulta de bureaus quedaría dado **empaquetado**,
  sin finalidad diferenciada y sin posibilidad de revocarlo por separado, lo que
  a mi criterio no satisface el consentimiento **expreso e informado** que exige
  la Ley 25.326 `[P]` ni la constitución #5.
- Una cláusula así, en un contrato de adhesión de consumo, es candidata directa
  al art. 37 de la Ley 24.240 `[P]`.
- Y desactivaría de hecho el control de `integrations/src/core/consentimiento.ts`
  descrito en `docs/03`, porque el adaptador de bureau encontraría siempre un
  consentimiento "vigente".

`[I]` Hay que decirlo ahora, en G1 de la 002, porque el texto de términos se
redacta una sola vez y después se hereda. **C-002-02.**

**(4) Advertencia hacia adelante, sin efecto en G1.** `[I]` El mecanismo de
aceptación por clic que se construya acá **no debe reutilizarse tal cual** para el
poder de gestión extrajudicial ni para el convenio de honorarios / cuota litis.
Esos actos tienen exigencias de forma propias —el pacto de cuota litis requiere
forma escrita con tantos ejemplares como partes, según lo corroborado en el
dictamen de la 004 `[C]`— y un clic-wrap puede no satisfacerlas. No afecta a la
002; lo dejo asentado para que nadie lo dé por resuelto en la 018.

---

## 5. Parámetros que requieren validación profesional

**Todas las filas salen con `requiereValidacionProfesional: true`.** Las columnas
"Validado por" y "Fecha" están vacías en todas y **deben quedar vacías** hasta que
una persona matriculada las complete, con nombre, matrícula, jurisdicción, fecha y
fecha de próxima revisión.

`[I]` A diferencia de la 004, **la mayoría de los parámetros de esta feature no son
normativos**: son de producto. Los marco igual, con su naturaleza explícita, para
que el estudio no pierda tiempo en los que no le corresponden y para que nadie
confunda una elección de producto con una exigencia legal.

### 5.A — Plazos normativos

| Parámetro | Qué representa | Norma que lo funda | Valor propuesto | Validado por | Fecha |
| --- | --- | --- | --- | --- | --- |
| `datosPersonales.plazoRespuestaAcceso` | Plazo para responder un pedido de acceso. | Ley 25.326 art. 14 `[C]` | **10 días corridos** `[C]`. `[!]` Subsiste la discrepancia señalada en el dictamen de la 004: alguna fuente dice "hábiles". **El estudio debe cerrarlo.** | | |
| `datosPersonales.intervaloGratuidadAcceso` | Periodicidad con que el acceso es gratuito. | Ley 25.326 art. 14 `[P]` | **6 meses** `[P]` — no corroborado en esta ronda. `[I]` Relevante para 003: si CA-25 es autoservicio ilimitado, superamos el piso legal, lo cual está bien y no genera obligación adicional. | | |
| `datosPersonales.plazoRespuestaRectificacionSupresion` | Plazo para rectificar, actualizar o suprimir. | Ley 25.326 art. 16 `[C]` | **5 días hábiles** `[C]` | | |
| `consumidor.botonArrepentimiento.plazoCodigo` | Plazo para informar el código de arrepentimiento. | Res. SCI 424/2020 `[C]` | **24 horas, por el mismo medio** `[C]` | | |
| `consumidor.botonArrepentimiento.sinRegistracionPrevia` | Si el camino de baja puede exigir iniciar sesión. | Res. SCI 424/2020 `[C]` | **No puede exigir registración previa ni otro trámite** `[C]`. `[I]` **Restricción de diseño concreta sobre la 002/003:** la baja no puede vivir únicamente detrás del login. | | |
| `identidad.edadMinima` | Edad mínima para titularizar una cuenta. | CCyC arts. 24 a 26 `[P]`; Ley 24.240 `[P]` | **18 años** `[P]`, con declaración en el alta. `[D]` **El estudio debe dictaminar** si alcanza con la declaración o hace falta otra cosa, y qué pasa con el adolescente de 16/17 que tiene deuda propia. | | |
| `datosPersonales.transferenciaInternacional.instrumento` | Instrumento que habilita el envío de datos a un proveedor en el exterior. | Ley 25.326 art. 12 `[P]`; Disposición AAIP 60-E/2016 `[P]` | `A DETERMINAR POR EL ESTUDIO` — depende de dónde se alojen el correo transaccional y la geolocalización (decisión de G2). | | |
| `datosPersonales.inscripcionBase` | Inscripción de la base y designación del responsable. | Ley 25.326 art. 21 `[P]` | **Obligación, no parámetro.** `A DETERMINAR` el momento exacto en que se vuelve exigible respecto del piloto. | | |
| `secretoProfesional.alcanceAbogado` | Alcance del secreto profesional del abogado sobre lo que ve en la plataforma. | Ley 23.187 y leyes provinciales `[P]` | `A DETERMINAR POR EL ESTUDIO` — **varía por jurisdicción**. Impacta en el convenio de la 018. | | |

### 5.B — Conservación (derivados del art. 4 inc. 7, valores no normativos)

`[I]` Ninguno de estos plazos está fijado por norma. Todos derivan de "hasta que
deje de ser necesario", que es un criterio, no un número. Los propongo para que
exista algo que discutir; **el estudio los ajusta**.

| Parámetro | Qué representa | Fundamento | Valor propuesto | Validado por | Fecha |
| --- | --- | --- | --- | --- | --- |
| `retencion.cuentaNoVerificada` | Cuánto sobrevive una cuenta creada por CA-01 y nunca confirmada. | Ley 25.326 art. 4 inc. 7 `[P]` | **30 días y purga completa** `[I]`. Ver §2.3: es el caso más claro de dato sin finalidad subsistente. | | |
| `retencion.enlaceConfirmacionYRecuperacion` | Vida de los enlaces de un solo uso. | Art. 9 `[P]` + producto | `[I]` Producto. Propuesta: **24 h** confirmación, **1 h** recuperación. Sin objeción legal a otros valores. | | |
| `retencion.tokenRefrescoUsado` | Cuánto se guarda el registro de un refresco usado, necesario para detectar reutilización (CA-11). | Art. 9 `[P]` | **Vida del token original + margen**, después purga `[I]`. No indefinido. | | |
| `retencion.intentosFallidos` | Cuánto se guarda el registro de intentos fallidos. | Art. 9 `[P]` | **Ventana del parámetro 002-A + margen** `[I]`. | | |
| `retencion.sesionCerrada` | Cuánto se guarda el registro de una sesión cerrada, con IP y dispositivo. | Art. 4 inc. 7 y art. 9 `[P]` | **90 días** `[I]` — propuesta. Es el dato más identificatorio que la 002 genera de forma continua. | | |
| `retencion.bitacoraAuditoria` | Cuánto se conserva el `EventoAuditoria`. | Constitución #5; art. 9 `[P]` | `A DETERMINAR POR EL ESTUDIO` — **tensión real**: la bitácora es prueba en un habeas data y a la vez contiene datos personales. `[I]` Probablemente el plazo de prescripción de la acción, pero no lo arriesgo. | | |
| `retencion.cuentaDadaDeBaja` | Qué se suprime y qué se conserva al darse de baja. | Ley 25.326 art. 4 inc. 7 y art. 16 `[P]`; obligaciones contables y probatorias `[D]` | `A DETERMINAR POR EL ESTUDIO` — ver §2.3. `[I]` **Bloquea el diseño de la 003**, no el G1 de la 002. | | |
| `retencion.documentacionRecuperacionMFA` | Qué se conserva de la documentación que soporte pida para restituir un MFA perdido. | Art. 4 incs. 1 y 7 `[P]` | `A DETERMINAR` — ver C-002-12. `[I]` Propuesta del revisor: **destruir apenas resuelto el caso**, conservando sólo el registro de que la verificación ocurrió y quién la hizo. | | |

### 5.C — Parámetros de producto sin contenido normativo

`[I]` Los listo para que quede constancia de que **los miré y concluí que no son
jurídicos**. No requieren firma del estudio; requieren decisión de producto.

| Parámetro | Valor propuesto | Observación |
| --- | --- | --- |
| `autenticacion.umbralIntentos` / `ventana` / `duracionBloqueo` | 5 / 15 min / 15 min `[I]` (decisión 002-A) | Sin norma que lo fije. Sujeto a los recaudos A-1 y A-2 del §4.2. |
| `autenticacion.mfaObligatorioPorRol` | `ADMINISTRADOR: true` (no configurable), `ABOGADO: true`, `CLIENTE: false` `[I]` | Decisión 002-B. Sin norma expresa; es adecuación al riesgo bajo el art. 9 `[P]`. Recaudos B-1 a B-3. |
| `token.vidaAcceso` / `token.vidaRefresco` | `[I]` Producto y seguridad. Sin objeción legal. | — |
| `matricula.vigenciaVerificacion` | **12 meses** `[I]` (salvaguarda M-2) | Propuesta del revisor. `[D]` El estudio podría tener criterio sobre la periodicidad razonable según la práctica de los colegios. |
| `matricula.plazoMaximoRevision` | **5 días hábiles** `[I]` (salvaguarda M-4) | Producto, con fundamento en art. 8 bis `[P]`. |

---

## 6. Veredicto

> ## Veredicto: **APTO CON CONDICIONES**

### Fundamento

`[I]` **No corresponde NO APTO.** No se detectó ninguno de los tres supuestos que
mi mandato define como bloqueantes: no hay tratamiento de datos sin base legal
posible (la relación contractual del art. 5.2.d `[P]` cubre razonablemente todo
lo que la 002 trata, aunque la spec no lo diga), no hay promesa de resultado en
ningún texto de la spec, y no hay cobro de encuadre dudoso. Todo lo que encontré
se corrige con criterios de aceptación adicionales, sin rediseñar la feature.

`[I]` Además, hay que decir lo que la spec hace bien, porque es sustancial y
porque varias de esas decisiones son la parte del art. 9 `[P]` que más se
incumple en la industria:

- **CA-19** verifica la asignación en **cada** consulta, no en el listado. Es la
  diferencia entre un control de acceso real y uno decorativo, y es la defensa
  concreta contra que un abogado alcance el expediente de otro cambiando un
  identificador.
- **R-07 y CA-18** evalúan por permiso concreto, no por nombre de rol.
- **CA-20** pone el rechazo siempre en la API y nunca sólo en la interfaz.
- **R-05 y CA-02** tratan la enumeración de usuarios como lo que es: una fuga de
  datos personales. El criterio es correcto; el problema es que **no se aplicó de
  forma pareja** (§2.2.c).
- **CA-05** bloquea toda acción del abogado no verificado. Es la salvaguarda
  estructural correcta y sostiene por sí sola la decisión de R-04.
- **CA-11 y CA-14** cortan de inmediato, sin esperar vencimientos.
- **R-02** y **R-03** son decisiones conservadoras y correctas.
- **§7** resuelve la pérdida de MFA por soporte humano en vez de por una puerta
  trasera automática, que es la respuesta difícil y la correcta.

`[I]` **No corresponde APTO liso** por cuatro motivos, en orden de gravedad:

1. **Falta la información del art. 6 de la Ley 25.326 en el punto de
   recolección.** Es la única obligación de esa ley que, por su propia
   estructura, no puede diferirse a la feature 003, y ninguna CA la cubre. Cada
   alta que ocurra sin ella es una recolección sin información previa, y no se
   repara después.
2. **La aceptación de términos, si se guarda como booleano, deja sin prueba a
   toda la base creada hasta la 003** (§4.5.2). Es el hallazgo con peor relación
   entre costo de hacerlo ahora y costo de repararlo.
3. **La spec no fija ningún plazo de conservación**, y crea al menos un depósito
   de datos personales de no-usuarios (cuentas nunca confirmadas) que hoy sería
   perpetuo.
4. **El estado `VERIFICADO` de la matrícula es una afirmación permanente sobre un
   hecho que no lo es** (§4.4), y la plataforma se la afirma a un consumidor.

### Condiciones

Verificables una por una. La columna "Compuerta" indica el momento límite.

| # | Condición | Cómo se verifica | Compuerta |
| --- | --- | --- | --- |
| **C-002-01** | **Información del art. 6 de la Ley 25.326 en la pantalla de alta**, con los cinco incisos, incluida la identidad y el domicilio del responsable y el carácter obligatorio o facultativo de cada campo. Se incorpora como CA nueva, con el texto del §3 revisado por `ux-expert` y ratificado por el abogado. Además, la spec **declara expresamente la base legal** de cada dato del §2.1. | CA nueva + test de presencia obligatoria + revisión de microcopy en G2. | **G1** |
| **C-002-02** | La aceptación del §4 paso 5 **se persiste como versión, no como booleano**: identificador de versión de cada documento, hash del texto mostrado, fecha/hora e IP. Y **el alcance del texto se limita** al tratamiento necesario para la cuenta y el servicio: **prohibido** incluir consulta a bureaus, cesión a terceros o comunicaciones comerciales. | CA nueva + revisión del modelo de datos en G2 + test de que no existe un campo booleano de aceptación. Revisión del texto de términos por el abogado. | **G1** |
| **C-002-03** | **Plazo de conservación declarado para cada dato del §2.1**, con purga verificable. Mínimo no negociable en G1: **regla de purga de cuentas nunca confirmadas**. El resto puede quedar como parámetro `[D]` a ratificar, pero tiene que existir la fila. | CA nueva + tabla de retención en `modelo-datos.md` (G2) + test de purga. | **G1** (la regla de purga) / G2 (la tabla completa) |
| **C-002-04** | **CUIT/CUIL: decidir y declarar.** (a) Declarar su finalidad en la 002 o diferirlo a la feature que lo necesita. (b) **Resolver la asimetría de enumeración del §7**: la detección de doble alta por CUIL no puede revelarle a un tercero que ese CUIL tiene cuenta. | Decisión registrada + CA corregida + test de no-enumeración por CUIL equivalente al de correo. | **G1** |
| **C-002-05** | **La baja de la cuenta deja de estar implícita.** O se especifica en la 002, o se declara explícitamente fuera de alcance y asignada a la 003 — pero con la restricción de la Res. SCI 424/2020 `[C]` ya anotada: **el camino de baja no puede exigir registración previa ni estar sólo detrás del login**, y debe existir el botón accesible desde la portada. Hoy el §7 supone cuentas eliminadas que ninguna CA crea. | Corrección del §8 de la spec o CA nueva + dependencia declarada hacia la 003 y hacia el portal web. | **G1** |
| **C-002-06** | **Ningún camino de no-revelación termina en un callejón sin salida.** En particular CA-02: el correo que se envía al dueño real debe ser accionable (ingresar / recuperar contraseña). Verificar lo mismo en CA-06, CA-15 y CA-17. | CA corregida + test de plantilla de correo. | **G1** |
| **C-002-07** | **Vigencia de la matrícula**: salvaguardas M-1 a M-4 y M-6 del §4.4 (evidencia registrada, `fechaDeVerificacion` + `vigenciaHasta`, estado `SUSPENDIDO` de efecto inmediato, plazo máximo de revisión con escalamiento, y microcopy que nunca afirma "verificado" sin fecha). M-5 y M-7 se declaran como dependencias hacia 018 y 008/012/013. | CAs nuevas + tests + dependencias declaradas. | **G1** (M-1 a M-4, M-6) / G2 (M-7) |
| **C-002-08** | **Decisión 002-B con piso**: MFA **obligatorio y no desactivable para `ADMINISTRADOR`**, cualquiera sea la opción elegida para los otros roles. Recaudos B-1 a B-3 del §4.2, incluida la **revisión obligatoria de la decisión en la feature 007**. | Decisión registrada en `REGISTRO-COMPUERTAS.md` + test de que el MFA de administrador no se puede apagar por configuración + dependencia declarada en 007. | **G1** |
| **C-002-09** | **Cuentas administradoras nominadas**: recaudos C-1 a C-3 del §4.2 (sin cuentas compartidas, siembra que se nominaliza o se deshabilita, y `EventoAuditoria` en la creación de todo administrador). | Tests + revisión del script de siembra en G4. | **G1** (C-1, C-3) / G4 (C-2) |
| **C-002-10** | **IP, ubicación y dispositivo declarados como datos personales tratados** (§2.2.b), con su finalidad en el art. 6. Si la geolocalización o el correo transaccional los resuelve un tercero: **encargado de tratamiento identificado con contrato (art. 25) y evaluación de transferencia internacional (art. 12)**. Preferencia expresa por resolución local de IP→ubicación. | Inventario en `modelo-datos.md` + ADR o sección del `plan.md` que identifique cada tercero. | G1 (declaración) / **G2** (terceros) |
| **C-002-11** | **Inscripción de la base ante la AAIP y designación del responsable de datos personales antes de que la 002 trate datos de personas reales**, incluido un piloto. `docs/03` §3 punto 4 pasa de pendiente genérico a pendiente con fecha. | Constancia de inscripción + designación registrada. | **Antes de G6** (antes de cualquier alta real) |
| **C-002-12** | **El circuito de restitución de MFA perdido se especifica**: qué documentación se pide, con qué base legal, quién la ve, por cuánto se conserva y cómo se destruye. No puede quedar como "proceso de soporte humano" sin definir, y menos si el MFA pasa a ser obligatorio para dos roles. | CA nueva o spec propia declarada + parámetro de retención del §5.B. | **G1** (declaración) / G2 (diseño) |

### Lo que este veredicto **no** dice

`[I]` Dice que la spec 002 puede avanzar a G2 si se cumplen las doce condiciones.
**No dice que la feature sea legalmente segura.** Quien lo escribe no es abogado,
ninguna fuente oficial pudo leerse en esta ronda, y hay obligaciones —la
inscripción de la base, la política de privacidad, el texto de términos, el
convenio con el abogado— que no son código y que ningún criterio de aceptación
puede sustituir.

---

## 7. Defectos detectados en la spec y escalamiento

**Este agente no modifica la spec.** Lo que sigue se escala al orquestador. Los
marcados **(G1)** requieren corregir la spec y volver a pasar la compuerta.

| # | Defecto | Dónde | Gravedad |
| --- | --- | --- | --- |
| D-002-01 | El CUIT/CUIL se recolecta sin finalidad declarada y sin uso funcional dentro del alcance de la 002. | §4 paso 2, CA-04 | **Alta (G1)** |
| D-002-02 | **Contradicción interna**: R-05 y CA-02 prohíben revelar si un correo existe, pero el §7 habilita la enumeración por CUIT/CUIL al bloquear el segundo alta. | R-05 / CA-02 vs. §7 | **Alta (G1)** |
| D-002-03 | No hay ninguna CA que cubra el deber de información del art. 6 de la Ley 25.326 en la recolección. | §4 paso 5 | **Alta (G1)** |
| D-002-04 | CA-23 dice que el CUIT/CUIL verificado "no es editable sin un proceso de reverificación", pero **ninguna CA define ese proceso**. Un titular con el CUIL mal cargado no tiene camino de rectificación (art. 16 `[C]`). | CA-23 | Media **(G1)** |
| D-002-05 | **No existe CA de baja ni de supresión de cuenta**, y el §8 tampoco la declara fuera de alcance — pero el §7 supone que las cuentas eliminadas existen. Además falta contemplar la Res. SCI 424/2020 `[C]`. | §7, §8 | **Alta (G1)** |
| D-002-06 | CA-22 audita la verificación de matrícula, pero **ninguna CA audita la creación de una cuenta de administrador**, que es la acción más sensible del sistema. | CA-21 / CA-22 | Media **(G1)** |
| D-002-07 | La jurisdicción de la matrícula no limita nada. Nada impide que un abogado matriculado en una jurisdicción quede asignado a un caso de otra. | CA-24, R-04 | Media (G2, dependencia) |
| D-002-08 | La spec no dice nada sobre la edad del titular. Un menor puede registrarse y celebrar un contrato de adhesión impugnable (CCyC arts. 24 a 26 `[P]`). | §4, CA-01 | Media **(G1)** |
| D-002-09 | El deber de confidencialidad del art. 10 `[P]` y el secreto profesional del abogado no se trasladan a ninguna obligación del sistema ni se declaran como dependencia hacia el convenio (018). | Transversal | Media |
| D-002-10 | **CA-21 depende de una clasificación de datos que nadie define ni posee.** "Recurso clasificado como dato personal o patrimonial sensible" presupone un criterio de clasificación que no está en la spec ni tiene agente asignado. Sin él, CA-21 no es verificable. | CA-21 | **Alta (G2)** |
| D-002-11 | R-03 dice que el token lleva "sólo identidad y permisos". `[I]` "Identidad" es ambiguo: debe ser un **identificador opaco**, nunca el CUIT/CUIL ni el correo. Un token se loguea y se cachea, como la propia R-03 reconoce. Coherente con la condición C-10 del dictamen de la 004. | R-03 | Media **(G1)** |
| D-002-12 | CA-13 introduce IP, ubicación y dispositivo como datos tratados, pero el §4 (recorrido) no los enumera entre los datos del usuario. El inventario de la spec está incompleto respecto de sus propias CAs. | §4 vs. CA-13 | Media **(G1)** |
| D-002-13 | La métrica del §10 sobre abogados pendientes de verificación "monitorea sin objetivo numérico". Para el abogado en limbo y para el cliente que lo espera, monitorear no es una salvaguarda. | §10 | Baja **(G1)** |
| D-002-14 | **Inconsistencia entre documentos**: `docs/03` describe un "KYC liviano: validación de CUIL contra padrón", mientras CA-04 sólo valida el dígito verificador. `[I]` **La spec elige la opción correcta y más conservadora** —consultar el padrón sería un tratamiento con un tercero que necesita base legal propia—, pero `docs/03` quedó describiendo otra cosa. | `docs/03` vs. CA-04 | Baja |

### Pendiente de mi propio mandato, escalado

`[I]` Mi mandato me obliga a mantener actualizada la tabla de parámetros
pendientes de validación en `docs/03-cumplimiento-legal-argentina.md`. **El
encargo de esta tarea fijó un entregable único**, así que no toqué ese archivo.
Queda escalado, junto con D-002-14 y con el D-22 del dictamen de la 004, que
sigue abierto sobre el mismo archivo. **Recomiendo una tarea específica de
actualización de `docs/03`** que barra los tres de una vez.

---

## 8. Estado de la verificación documental

**Ninguna fuente oficial pudo leerse en esta ronda (2026-09-21).** Se intentó
InfoLeg (`servicios.infoleg.gob.ar`), `argentina.gob.ar` y un repositorio
secundario de textos normativos: los tres devolvieron bloqueo del proxy de
egreso, igual que en la ronda del 2026-09-20 registrada en
`specs/legal/verificacion-documental.md`. El único canal disponible fue un
buscador.

**Consecuencia:** en este documento **no hay una sola marca `[V]`**. Lo mejor
obtenido es `[C]`, que a efectos de uso en producción se trata igual que `[P]`.

| Punto | Estado | Qué falta |
| --- | --- | --- |
| Ley 25.326 art. 6, incisos a) a e) | `[C]` — transcripción coincidente entre fuentes secundarias | Lectura del texto oficial. Es la base de C-002-01. |
| Ley 25.326 arts. 14 y 16, plazos | `[C]` — coinciden con el dictamen de la 004 | `[!]` Cerrar "corridos" vs. "hábiles" en el art. 14. |
| Ley 25.326 arts. 4, 5, 9, 10, 12, 21, 25 | `[P]` | No se obtuvo transcripción en esta ronda. |
| Res. AAIP 47/2018 | `[C]` en cuanto a su existencia, objeto, derogación de las Disposiciones 11/2006 y 9/2008, y a que aprueba **medidas recomendadas** en dos anexos | **No se leyó el Anexo I.** Pregunta concreta al estudio: ¿dice algo sobre segundo factor de autenticación, y con qué fuerza? Decide el fundamento de C-002-08. |
| Res. SCI 424/2020 | `[C]` — botón accesible desde la portada, sin registración previa, código dentro de 24 h por el mismo medio | Lectura del texto oficial. Es la base de C-002-05. |
| Normativa BCRA sobre autenticación | `[D]` | Determinar si algún régimen alcanza a la plataforma. A criterio del revisor hoy no, pero no lo verifiqué. |
| Ley 23.187 y leyes provinciales de colegiación | `[P]` | Sigue abierto desde la ronda de la 004. Régimen de vigencia, suspensión y cancelación de matrícula por jurisdicción: base de C-002-07. |
| Ley 25.506, régimen probatorio de la firma electrónica | `[P]` | Confirmar la distribución de la carga probatoria. Es el argumento de C-002-02. |
| Disposición AAIP 60-E/2016, cláusulas modelo de transferencia internacional | `[P]` | Confirmar vigencia y modelo aplicable. C-002-10. |
| CCyC arts. 24 a 26, capacidad del menor | `[P]` | D-002-08. |

---

## 9. Resumen para la compuerta

- **Veredicto: APTO CON CONDICIONES.** 12 condiciones, 8 de ellas exigibles en G1.
- **Nada de lo encontrado obliga a rediseñar la feature.** Todo se resuelve con
  criterios de aceptación adicionales y con decisiones de producto.
- **Lo único verdaderamente urgente** —en el sentido de que no se puede reparar
  después— son C-002-01 (información del art. 6 en la recolección) y C-002-02
  (la aceptación como versión, no como booleano). Si sólo se pudieran atender dos
  condiciones antes del piloto, son ésas.
- **Sobre las tres decisiones abiertas:** ninguna tiene un impedimento normativo.
  002-B es la única con arista legal relevante, y la respuesta es que **no hay
  norma argentina que imponga MFA**, pero sí un estándar de adecuación al riesgo
  que, a criterio del revisor, vuelve indiscutible el MFA para el administrador.
- **Sobre R-04:** la verificación manual se sostiene; lo que no se sostiene es
  que la verificación sea **puntual** en vez de **vigente**.
