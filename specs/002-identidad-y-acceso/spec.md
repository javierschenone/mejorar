# Spec 002 — Identidad y acceso

| Campo | Valor |
| --- | --- |
| Versión | **4** — declara la finalidad del CUIT/CUIL (escalamiento E-1 de `plan.md`) |
| Estado | EN REVISIÓN (G1) |
| Autor | orquestador |
| Revisor legal | `compliance-legal` → `specs/002-identidad-y-acceso/cumplimiento.md` (APTO CON CONDICIONES) |
| Compuerta | G1 |
| Principios de la constitución involucrados | #3, #4, #5, #13, #14 |
| Origen | Adelantada en el orden del backlog: la feature 001 (escalamiento E-02, `REGISTRO-COMPUERTAS.md` entrada 031) pedía, sin saberlo, el contenido íntegro de esta feature. Se especifica ahora, en paralelo al cierre de G2 de la 004. |

## 0. Cambios de la versión 2

El dictamen de cumplimiento encontró una contradicción interna seria y ocho
condiciones exigibles ya en G1. Se corrigen acá.

| Origen | Cambio |
| --- | --- |
| C-002-01 | CA-26 (nueva): información del art. 6 de la Ley 25.326 en la pantalla de alta. |
| C-002-02 | CA-27 (nueva): la aceptación de términos se persiste como versión con hash, fecha e IP — nunca como booleano — y su alcance no incluye bureaus ni comunicaciones comerciales. |
| C-002-03 | CA-28 (nueva): plazo de conservación declarado; purga obligatoria de cuentas nunca confirmadas. |
| C-002-04 | CA-04 corregida: la detección de CUIT/CUIL duplicado deja de revelarle a un tercero que ese CUIT/CUIL tiene cuenta — mismo tratamiento que CA-02 le da al correo. |
| C-002-06 | CA-02, CA-06, CA-15, CA-17 corregidas: ninguna notificación a un tercer correo termina en un callejón sin salida. |
| C-002-07 | CA-05 corregida y CA-29 a CA-31 (nuevas): la matrícula verificada tiene vigencia, no es un evento permanente. |
| C-002-08 | R-08 (nueva) y CA-32 (nueva): MFA obligatorio y no configurable para `ADMINISTRADOR`, cualquiera sea la decisión de 002-B para los demás roles. |
| C-002-09 | CA-33, CA-34 (nuevas): ninguna cuenta administradora es genérica o compartida; su creación queda auditada. |
| C-002-10 | R-09 (nueva): IP, ubicación y dispositivo se declaran como datos personales tratados, con evaluación de encargados de tratamiento en G2. |
| C-002-12 | CA-35 (nueva): el circuito de restitución de MFA perdido se declara y se diseña en G2, no queda como "proceso de soporte" sin especificar. |
| Recaudos A-1, A-2 de 002-A | CA-36, CA-37 (nuevas): el bloqueo por intentos fallidos nunca cierra el camino de recuperación. |
| C-002-05 | Pendiente de decisión del product owner (§9). |

Registrado en `specs/REGISTRO-COMPUERTAS.md`, entrada 038 en adelante.

## 1. Problema

Sin identidad ni permisos reales, no hay producto: un cliente, un abogado y un
administrador no pueden coexistir en el mismo sistema sin que cada uno vea
exactamente lo que le corresponde y nada más. Y en este dominio en particular
—expedientes de deuda, informes crediticios, honorarios— una fuga de acceso no
es un bug de UX: es un dato patrimonial de una persona en manos de quien no
debía verlo.

## 2. Audiencia

Las tres audiencias del producto por igual: cliente deudor, abogado,
administrador de la plataforma. Cada una se registra, inicia sesión y opera
dentro de los límites de su rol.

## 3. Resultado esperado

Cualquiera de las tres audiencias puede registrarse, verificar su identidad de
forma proporcional a su rol, iniciar sesión de forma segura, recuperar el
acceso si lo pierde, y en todo momento el sistema le muestra exactamente lo que
su rol permite — nunca más, nunca con una comprobación que dependa sólo del
cliente.

## 4. Recorrido del usuario

### Alta

1. La persona elige su tipo de cuenta (cliente, abogado; el administrador no se
   autorregistra, ver §6).
2. Completa datos mínimos: correo, contraseña, nombre para mostrar, y CUIT/CUIL
   si aplica a su rol.
3. Si es abogado, además ingresa su número de matrícula y jurisdicción — sujeto
   a verificación (ver casos límite, §7).
4. Confirma su correo antes de poder operar.
5. Acepta los términos y la política de privacidad — el registro de esa
   aceptación es un consentimiento en el sentido de la feature 003, pero **el
   texto y el circuito de consentimientos informados propiamente dichos son de
   la 003**; acá sólo se deja el enganche.

### Ingreso

1. La persona ingresa correo y contraseña.
2. Si tiene MFA activado, completa el segundo factor.
3. Recibe un token de acceso de vida corta y uno de refresco.
4. Ve su portal según su rol, con lo que ese rol permite y nada más.

### Recuperación

1. La persona pide recuperar el acceso con su correo.
2. Recibe un enlace de un solo uso y de vida corta.
3. Define una contraseña nueva; todas las sesiones anteriores se cierran.

### Gestión de la sesión

1. La persona puede ver sus sesiones activas y cerrar cualquiera a distancia.
2. Un token de refresco usado dos veces (reutilización) cierra todas las
   sesiones de esa cuenta y la alerta.

## 5. Criterios de aceptación

### Registro e identidad

```gherkin
CA-01  Dada una persona sin cuenta
       Cuando se registra con correo, contraseña y nombre
       Entonces la cuenta se crea en estado NO_VERIFICADA y recibe un correo
       de confirmación con un enlace de un solo uso

CA-02  Dado un correo ya registrado                                        [v2]
       Cuando alguien intenta registrarse con el mismo correo
       Entonces el sistema no revela si el correo existe: responde igual que
       a un registro exitoso
       Y si existía, notifica al dueño real de la cuenta el intento, con un
       enlace ACCIONABLE (ingresar o recuperar contraseña), nunca un aviso
       sin salida
       [Condición C-002-06]

CA-03  Dada una contraseña que no cumple la política mínima (longitud, sin
       estar en una lista de contraseñas filtradas conocidas)
       Cuando se intenta registrar
       Entonces se rechaza con el motivo exacto, sin exponer la política
       completa como si fuera un desafío a resolver

CA-04  Dado un CUIT/CUIL ingresado que ya pertenece a una cuenta existente   [v4]
       Cuando alguien intenta registrarse con ese mismo CUIT/CUIL
       Entonces el sistema NO revela a quien se registra que el CUIT/CUIL ya
       tiene cuenta: aplica exactamente el mismo tratamiento de no-revelación
       que CA-02 le da al correo, y notifica al dueño real por su canal de
       contacto registrado
       Y en todos los casos se verifica el dígito verificador antes de
       aceptar el CUIT/CUIL (`packages/shared/src/identidad/cuit.ts` —
       **todavía no está implementado**; es entregable pendiente asignado a
       `dev-dominio`, ver decisión E-1 más abajo)
       [Condición C-002-04. Defecto corregido: la versión 1 revelaba, por
       CUIT/CUIL, exactamente lo que CA-02 y R-05 prohíben revelar por
       correo — que una persona determinada es usuaria de una plataforma de
       gestión de deudas. Finalidad declarada en R-11 — decisión de G2,
       escalamiento E-1 de `plan.md`]

CA-05  Dado un registro como abogado con número de matrícula y jurisdicción  [v2]
       Cuando se completa el alta
       Entonces la cuenta queda en estado PENDIENTE_DE_VERIFICACION_PROFESIONAL
       y no puede operar como abogado hasta que un administrador la verifique
       Y cuando un administrador verifica, la decisión registra la evidencia
       vista (constancia, colegio, número, fecha), no sólo el resultado
       Y el estado resultante nunca se presenta como "verificado" sin fecha:
       lleva `fechaDeVerificacion` y una `vigenciaHasta` (ver CA-29 a CA-31)
       [Ver casos límite §7: el sistema no tiene integración automática con
       los colegios profesionales en esta feature. Condición C-002-07,
       salvaguardas M-1, M-2 y M-6]

CA-06  Dado un enlace de confirmación de correo                             [v2]
       Cuando se usa una segunda vez, o después de su vencimiento
       Entonces se rechaza con un mensaje que permite pedir uno nuevo, sin
       revelar si el primero era válido, y ese mensaje es ACCIONABLE
       [Condición C-002-06]
```

### Ingreso y sesión

```gherkin
CA-07  Dado un correo y una contraseña correctos, sin MFA activado
       Cuando se envían al iniciar sesión
       Entonces se emite un token de acceso de vida corta y un token de
       refresco de vida más larga, y se registra el inicio de sesión en
       auditoría

CA-08  Dada una cuenta con MFA activado
       Cuando el correo y la contraseña son correctos
       Entonces el sistema exige el segundo factor antes de emitir cualquier
       token, y no revela si el primer factor fue correcto por sí solo

CA-38  Dada una cuenta con rol ABOGADO                                       [v3]
       Cuando completa su alta y su verificación profesional (CA-05)
       Entonces el MFA es obligatorio antes de poder operar como abogado — no
       es opcional, a diferencia de CLIENTE
       [Decisión 002-B. El abogado está alcanzado por el secreto profesional
       y expone a todos sus clientes asignados con una sola sesión]

CA-39  Dada una cuenta con rol CLIENTE                                       [v3]
       Entonces el MFA es opcional, pero: (a) se ofrece desde el perfil desde
       el día uno, con explicación en lenguaje llano, nunca escondido; (b) si
       se activa, no puede desactivarse sin reautenticación fuerte
       [Decisión 002-B, recaudos B-1 y B-3. El recaudo B-2 — revisión
       obligatoria de esta decisión en la feature 007, cuando el portal del
       cliente muestre informes crediticios — queda como dependencia
       declarada en el backlog de 007, no como CA de esta feature]

CA-09  Dada una contraseña incorrecta                                       [v2]
       Cuando se reintenta más de N veces en una ventana de tiempo
       Entonces la cuenta aplica una demora creciente y, superado un umbral,
       un bloqueo temporal notificado al dueño de la cuenta
       Y la notificación dice cuánto dura el bloqueo y cómo salir antes, no
       sólo que la cuenta fue bloqueada
       [Recaudo A-2]

CA-36  Dada una cuenta bloqueada por intentos fallidos (CA-09)               [v2]
       Cuando esa cuenta pide recuperar su contraseña (CA-15)
       Entonces el camino de recuperación funciona igual: el bloqueo por
       intentos fallidos NUNCA inhabilita la recuperación de contraseña
       [Recaudo A-1. Un tercero puede bloquear la cuenta de una víctima con
       sólo tipear mal su contraseña cinco veces; sin esta salida, sería una
       denegación de servicio sin escape sobre alguien bajo estrés
       financiero — art. 8 bis LDC]

CA-37  Dado cualquier umbral de bloqueo configurado                         [v2]
       Entonces es un parámetro de producto, no normativo, y su valor por
       defecto (5 intentos, ventana de 15 minutos) puede ajustarse sin
       revisión legal — a diferencia de los parámetros del motor de reglas
       legales de la feature 004
       [Decisión 002-A]

CA-10  Dado un token de refresco válido
       Cuando se usa para renovar el token de acceso
       Entonces se invalida y se emite uno nuevo (rotación), y el anterior
       queda registrado como usado

CA-11  Dado un token de refresco ya usado
       Cuando se intenta usar de nuevo
       Entonces el sistema interpreta reutilización, invalida TODAS las
       sesiones activas de esa cuenta y notifica al dueño

CA-12  Dado un token de acceso vencido
       Cuando se usa contra cualquier endpoint
       Entonces se rechaza sin distinguir "vencido" de "inválido" en el
       mensaje que ve el cliente, aunque el registro interno sí distinga

CA-13  Dada una persona con sesión iniciada
       Cuando consulta sus sesiones activas
       Entonces ve dispositivo aproximado, ubicación aproximada por IP y
       fecha de cada una, y puede cerrar cualquiera individualmente

CA-14  Dado un cierre de sesión a distancia (CA-13) o una detección de
       reutilización (CA-11)
       Cuando se ejecuta
       Entonces los tokens de esa sesión dejan de aceptarse de inmediato, sin
       esperar a su vencimiento natural
```

### Recuperación de contraseña

```gherkin
CA-15  Dado un pedido de recuperación con un correo                        [v2]
       Cuando se procesa
       Entonces se responde igual exista o no el correo (CA-02), y si existe
       se envía un enlace de un solo uso con vida corta, ACCIONABLE
       [Condición C-002-06]

CA-16  Dado un enlace de recuperación válido
       Cuando se define una contraseña nueva
       Entonces se cierran TODAS las sesiones activas de la cuenta, se
       notifica el cambio al correo, y el enlace queda inutilizado

CA-17  Dado un enlace de recuperación vencido o ya usado                   [v2]
       Cuando se intenta usar
       Entonces se rechaza con opción de pedir uno nuevo, de forma accionable
       [Condición C-002-06]
```

### Vigencia de la matrícula profesional

Implementan las salvaguardas M-2, M-3 y M-4 del dictamen (condición C-002-07).
El defecto que corrigen no es que la verificación sea manual —eso está bien
resuelto por CA-05 y CA-22— sino que se modelaba como un evento permanente
cuando la matrícula no lo es: se suspende, se cancela, caduca, y todo eso pasa
en el colegio profesional, sin que la plataforma se entere.

```gherkin
CA-29  Dada una matrícula verificada con `fechaDeVerificacion`               [v2]
       Cuando se cumple su `vigenciaHasta` (parámetro, propuesta inicial: 12
       meses, sujeta a validación) sin una nueva verificación
       Entonces la cuenta pasa a un estado que bloquea la asignación de casos
       NUEVOS, sin interrumpir los casos ya en curso
       [Salvaguarda M-2. Un corte abrupto perjudicaría al cliente que ya
       tiene a ese abogado — constitución #1]

CA-30  Dado un abogado verificado                                           [v2]
       Cuando un administrador recibe una notificación de suspensión,
       cancelación o denuncia sobre su matrícula
       Entonces puede aplicar el estado SUSPENDIDO de efecto inmediato, que
       bloquea toda acción del abogado sin esperar el vencimiento de
       `vigenciaHasta`
       [Salvaguarda M-3]

CA-31  Dada una cuenta en estado PENDIENTE_DE_VERIFICACION_PROFESIONAL       [v4]
       Cuando transcurren **7 días corridos** desde el alta (parámetro de
       producto, no normativo, ajustable sin volver a esta compuerta)
       Entonces se escala al back-office, y el sistema NUNCA presenta el
       texto "verificado" sin la fecha y la constancia contra la que se
       verificó
       [Salvaguarda M-4 y M-6. Se cambia de "5 días hábiles" a "7 días
       corridos" — decisión de G2, escalamiento E-5 de `plan.md`: el sistema
       no tiene calendario de feriados argentinos (nacionales y
       provinciales) y construir uno sólo para este cómputo no se justifica
       todavía. Un abogado en limbo indefinido es trato indigno — art. 8 bis
       LDC — y, para el cliente que lo espera, servicio no prestado.
       Declarado como dependencia hacia 008/012/013 el control de que la
       jurisdicción de la matrícula limita la asignación de casos —
       salvaguarda M-7, defecto D-002-07]
```

### Cuentas administradoras

Implementan los recaudos C-1 a C-3 del dictamen (condición C-002-09).

```gherkin
CA-33  Dado cualquier usuario con rol ADMINISTRADOR                         [v2]
       Entonces corresponde a una persona humana identificada: no existen
       cuentas administradoras compartidas ni genéricas (`admin@`, etc.)
       [Recaudo C-1. Una bitácora que dice que "admin" accedió a un
       expediente no prueba nada ante un reclamo de habeas data]

CA-34  Dada la creación de cualquier cuenta con rol ADMINISTRADOR            [v2]
       Cuando ocurre, incluida la cuenta de siembra inicial
       Entonces genera un `EventoAuditoria` — es la acción más sensible del
       sistema y hoy es la única que no queda auditada
       Y la cuenta de siembra se nominaliza en el primer ingreso o se
       deshabilita una vez creada la primera cuenta nominal: no queda viva
       "por las dudas"
       [Recaudos C-2 y C-3. Decisión 002-C]
```

### Restitución de segundo factor perdido

```gherkin
CA-35  Dada una persona que perdió su segundo factor de MFA y no tiene       [v2]
       códigos de respaldo
       Cuando pide su restitución
       Entonces el circuito de soporte humano (§7) queda formalmente
       declarado: qué documentación se pide, con qué base legal, quién la
       ve, por cuánto tiempo se conserva y cómo se destruye — no puede
       operar como "proceso de soporte" sin especificar
       [Condición C-002-12. Si el MFA pasa a ser obligatorio para abogado y
       administrador (ver CA-32), este circuito deja de ser un caso raro y
       pasa a ser rutina. Diseño completo en G2]
```

### RBAC por permiso

```gherkin
CA-18  Dado un mapa de permisos por rol (`CLIENTE`, `ABOGADO`,
       `ADMINISTRADOR`)
       Cuando se evalúa el acceso a una acción
       Entonces la evaluación es por PERMISO concreto, no por el nombre del
       rol — el rol es sólo el conjunto de permisos que trae por defecto

CA-19  Dado un abogado autenticado
       Cuando solicita el expediente de un caso
       Entonces la API verifica que el caso le fue asignado a ESE abogado
       específico, no sólo que su rol sea ABOGADO — la verificación ocurre en
       cada consulta, no sólo en el listado inicial

CA-20  Dado un usuario con un rol determinado
       Cuando intenta acceder a una ruta o a un dato de otro rol
       Entonces la API responde 403 y la interfaz lo redirige — el rechazo lo
       decide siempre la API; la interfaz nunca es el único límite

CA-21  Dado cualquier acceso a un recurso clasificado como dato personal o    [v2]
       patrimonial sensible
       Cuando ocurre
       Entonces genera un `EventoAuditoria` con quién, cuándo, qué recurso y
       con qué resultado — reutilizando la entidad ya construida en la
       feature 001
       [La clasificación PÚBLICO/INTERNO/PERSONAL/PATRIMONIAL SENSIBLE de
       cada campo es responsabilidad de `database-engineer` en
       `modelo-datos.md`, siguiendo el patrón ya usado en la feature 004.
       Este criterio no tiene dueño de la clasificación hasta G2 — se declara
       así para que no se pierda]

CA-22  Dado un administrador autenticado
       Cuando consulta el panel de gestión de usuarios
       Entonces puede ver el estado de verificación profesional de un
       abogado y aprobarla o rechazarla, con su decisión auditada (CA-05,
       CA-21)

CA-32  Dado cualquier usuario con rol ADMINISTRADOR                          [v2]
       Entonces el MFA es obligatorio y no puede desactivarse por
       configuración, cualquiera sea la decisión sobre MFA para CLIENTE y
       ABOGADO
       [Condición C-002-08. No hay norma argentina que imponga MFA, pero bajo
       el estándar de adecuación al riesgo del art. 9 de la Ley 25.326, una
       sesión de administrador comprometida expone a TODOS los titulares del
       sistema. Este piso no es parte de la decisión 002-B: es su mínimo]
```

### Información y consentimiento en el alta

Implementan las condiciones C-002-01 y C-002-02. El deber de informar del
art. 6 de la Ley 25.326 es la única obligación de esa ley que no puede
diferirse a la feature 003: el momento de la recolección es el alta, y ocurre
acá.

```gherkin
CA-26  Dada la pantalla de alta                                              [v2]
       Cuando una persona la completa
       Entonces ve, antes de confirmar, la información del art. 6 de la Ley
       25.326: identidad y domicilio del responsable del tratamiento,
       finalidad de cada dato pedido, destinatarios posibles, y el carácter
       obligatorio o facultativo de cada campo
       [Condición C-002-01. Texto exacto a cargo de `ux-expert`, ratificado
       por el abogado]

CA-27  Dada la aceptación de términos y política de privacidad en el alta    [v2]
       Cuando se registra
       Entonces se persiste como un registro versionado: identificador de la
       versión del documento aceptado, hash del texto mostrado, fecha, hora
       e IP — NUNCA como un campo booleano
       Y el alcance del texto aceptado se limita a lo necesario para la
       cuenta y el servicio: NO incluye consulta a bureaus de crédito, cesión
       a terceros ni comunicaciones comerciales — eso requiere su propio
       consentimiento separado en la feature 003
       [Condición C-002-02. Un booleano sin versión ni hash deja sin prueba
       a toda cuenta creada hasta que exista la 003 — la firma electrónica
       no tiene presunción de validez sin ese respaldo]

CA-28  Dada cualquier cuenta en estado NO_VERIFICADA                         [v2]
       Cuando transcurre el plazo de conservación configurado sin que se
       confirme el correo
       Entonces la cuenta y sus datos personales se purgan automáticamente
       [Condición C-002-03, mínimo no negociable en G1. El resto de los
       plazos de conservación del §2 del dictamen se completa como tabla en
       `modelo-datos.md`, G2]
```

### Perfil y datos propios de cada rol

```gherkin
CA-23  Dado un cliente autenticado
       Cuando consulta su perfil
       Entonces ve y puede editar sus datos de contacto propios; el CUIT/CUIL
       verificado no es editable sin un proceso de reverificación

CA-24  Dado un abogado autenticado y verificado
       Cuando consulta su perfil
       Entonces ve su matrícula, jurisdicción y estado de verificación, y
       puede declarar sus especialidades — sin poder autoeditar la matrícula
       ya verificada

CA-25  Dado cualquier usuario
       Cuando pide exportar sus propios datos personales
       Entonces recibe sus datos de identidad y de sesión (no los de otros)
       en un formato legible — encaje mínimo con el derecho de acceso de la
       Ley 25.326, que la feature 003 desarrolla en profundidad
```

## 6. Reglas de negocio

| # | Regla | Fundamento |
| --- | --- | --- |
| R-01 | El administrador nunca se autorregistra: se crea por otro administrador o por una siembra inicial fuera de la interfaz pública. | Superficie de ataque. Un panel de administración con alta pública es una puerta de entrada. |
| R-02 | Las contraseñas se almacenan con `argon2id`, nunca en texto plano ni con un hash reversible. | Constitución #5. Estándar de la industria para contraseñas. |
| R-03 | El token de acceso no lleva datos patrimoniales sensibles en su contenido, sólo identidad (como identificador opaco) y permisos. | Un token se loguea y se cachea en tránsito; no debe filtrar de más si se compromete. Corrección v2: "identidad" es el identificador opaco, no datos identificatorios en claro. |
| R-04 | La verificación de matrícula de un abogado es, en esta feature, manual por un administrador. La integración automática con colegios profesionales es una integración futura (ver `docs/04-integraciones.md`, fuera de alcance acá). | No hay API pública unificada de colegios de abogados por jurisdicción; automatizarlo mal generaría verificaciones falsas. |
| R-05 | Ninguna respuesta de autenticación revela si un correo existe en el sistema. | Enumeración de usuarios es una fuga de datos personales por sí sola. |
| R-06 | Rotación de refresco con detección de reutilización es obligatoria, no opcional. | Es el mecanismo estándar para detectar un token robado sin esperar a que el daño ya esté hecho. |
| R-07 | RBAC se evalúa por permiso concreto en cada consulta, nunca sólo por rol en el punto de entrada. | Constitución #4 y #5: un abogado no debe poder alcanzar el caso de otro cambiando un identificador en la URL. |
| R-08 | El MFA de `ADMINISTRADOR` es obligatorio y no configurable, con independencia de la decisión 002-B sobre los demás roles. | Ley 25.326 art. 9 (medidas adecuadas al riesgo): una sesión de administrador comprometida expone a todos los titulares. Condición C-002-08. |
| R-09 | La IP, la ubicación aproximada y el dispositivo de una sesión (CA-13) son datos personales tratados, con su finalidad declarada en el art. 6 (CA-26). Si su resolución depende de un tercero, ese tercero se identifica como encargado de tratamiento con contrato, y se evalúa si hay transferencia internacional. | Ley 25.326 arts. 12 y 25. Condición C-002-10. Preferencia por resolución local de IP a ubicación cuando sea posible. |
| R-10 | La primera cuenta de administrador se crea con un script de siembra ejecutado manualmente en el despliegue, fuera de toda interfaz pública. Nunca con credenciales en una variable de entorno. | Decisión 002-C. Una variable de entorno con una contraseña, aunque se fuerce el cambio, es una ventana de tiempo con una credencial conocida. |
| R-11 | El CUIT/CUIL se pide en el alta con una finalidad declarada y acotada: identificar de forma temprana al titular para poder iniciar sin fricción los procesos de diagnóstico de deuda (BCRA, bureaus — feature futura) en cuanto el cliente los autorice, y prevenir el alta duplicada de una misma persona bajo correos distintos. No se usa para ningún otro fin mientras esa feature no exista. | Decisión de G2 — escalamiento E-1 de `plan.md`. El product owner optó por mantener el campo en la 002 en vez de diferirlo, con esta finalidad explícita (Ley 25.326 art. 6, principio de finalidad). |
| R-12 | El correo transaccional (confirmación de alta, recuperación, notificaciones de seguridad) se envía a través de Sendgrid. | Decisión de G2 — escalamiento E-2 de `plan.md`. **Condición:** a diferencia de la alternativa evaluada por el arquitecto (Amazon SES en una región de la Unión Europea, que no requería análisis de transferencia internacional), Sendgrid procesa datos en Estados Unidos. Antes de producción se necesita evaluar la transferencia internacional de datos (Ley 25.326 art. 12) y contar con un acuerdo de tratamiento de datos (DPA) firmado con Sendgrid — condición C-002-10 sigue abierta para este tercero específico, no cerrada. |

## 7. Casos límite y errores

- Un abogado se registra con una matrícula que no corresponde a ninguna
  persona real o que ya está en uso por otra cuenta: el alta no falla en el
  acto (no hay verificación automática, R-04), pero el estado
  `PENDIENTE_DE_VERIFICACION_PROFESIONAL` bloquea toda acción de abogado hasta
  que un administrador decida.
- Doble registro con el mismo CUIT/CUIL y distinto correo: se detecta y se
  bloquea el segundo alta con un mensaje que no expone datos del primero.
- Pérdida del segundo factor de MFA sin códigos de respaldo: requiere proceso
  de soporte humano, no un camino automático (que sería una puerta trasera del
  MFA).
- Intento de recuperación de contraseña en una cuenta ya eliminada: responde
  igual que si no existiera (CA-02, CA-15).
- Reutilización de refresco detectada mientras el usuario tiene una operación
  en curso: la operación en curso también se corta; no hay excepción por
  estar "a mitad de algo".

## 8. Fuera de alcance

- **Consentimientos informados** propiamente dichos, versionados por
  finalidad, y los derechos de acceso/rectificación/supresión en profundidad
  → feature **003**. Acá sólo la aceptación de términos versionada de CA-27,
  con alcance limitado a la cuenta y el servicio — nunca a bureaus ni a
  comunicaciones comerciales, que requieren su propio consentimiento en 003.
- **Verificación automática de matrícula** contra colegios profesionales →
  integración futura, ver `docs/04-integraciones.md`.
- **Perfiles de negocio completos** (historial de casos del cliente, cartera
  del abogado) → features de cada dominio (008, 012, 013).
- **Inicio de sesión social** (Google, etc.) → no evaluado en este ciclo.
- **Aplicación móvil**: el mismo backend de identidad, pero el almacenamiento
  seguro del token en el dispositivo y la biometría son de `dev-mobile` en su
  propia feature, no acá.
- **Baja de cuenta** → sujeta a la decisión 002-D. Si se elige diferirla, es
  dependencia de la feature **003**, con la restricción de accesibilidad de la
  Res. SCI 424/2020 (botón desde la portada, sin requerir login) documentada
  desde ya para que no se pierda al pasar de una feature a otra. [v2]
- **Diseño completo del circuito de restitución de MFA perdido** (qué
  documentación, cómo se destruye) → declarado en CA-35, diseñado en G2. [v2]
- **Encargados de tratamiento de terceros** para IP/ubicación/correo
  transaccional, y evaluación de transferencia internacional → identificación
  concreta en G2 (R-09, condición C-002-10). [v2]

## 9. Decisiones — resueltas en G1

Las cinco decisiones quedaron resueltas por el product owner. Registradas en
`specs/REGISTRO-COMPUERTAS.md`, entradas 040 a 043.

| Decisión | Resolución | Dónde se implementa |
| --- | --- | --- |
| **002-A** — umbral de bloqueo | 5 intentos, ventana de 15 minutos, con los recaudos A-1/A-2. Parámetro de producto, no normativo. | CA-09, CA-36, CA-37 |
| **002-B** — MFA por rol | `ADMINISTRADOR` obligatorio sin excepción (piso legal). `ABOGADO` obligatorio. `CLIENTE` opcional, con los recaudos B-1 a B-3. | CA-32, CA-38, CA-39 |
| **002-C** — primera cuenta admin | Script de siembra manual en el despliegue, fuera de toda interfaz pública. Sin credenciales en variables de entorno. | R-10, CA-33, CA-34 |
| **002-D** — baja de cuenta | Diferida a la feature **003**. La restricción de la Res. SCI 424/2020 (botón accesible desde la portada, sin requerir login) queda documentada en `specs/003-consentimientos-y-datos-personales/spec.md` cuando se escriba, para que no se pierda al pasar de una feature a otra. | Fuera de alcance §8 |
| **002-E** — inscripción ante la AAIP | **Pospuesta.** El product owner se apartó de la recomendación de iniciarla ahora. | Riesgo de cronograma, ver abajo |

### Riesgo de cronograma — segunda dependencia externa pospuesta

La condición C-002-11 exige la inscripción de la base ante la AAIP y la
designación de un responsable de datos personales **antes de que la 002 trate
datos de una persona real, incluido un piloto**. Al postergarla, el proyecto
acumula una **segunda** dependencia externa sin fecha, junto a la del estudio
jurídico de la feature 004 (condición C-03, entrada 027). A diferencia de esa,
ésta no depende de tener código construido: cuando se decida arrancarla, no
hay trabajo previo que la bloquee, sólo el tiempo de trámite en sí.

## 10. Métricas de éxito

| Métrica | Objetivo |
| --- | --- |
| Tiempo de alta hasta cuenta verificada (cliente) | referencia a establecer con el piloto |
| Abogados en estado pendiente de verificación por más de 48 h | monitoreado, sin objetivo numérico aún — depende de disponibilidad del administrador |
| Incidentes de acceso cruzado entre roles detectados en producción | 0 |
| Reutilización de refresco detectada y contenida sin intervención manual | 100% |
