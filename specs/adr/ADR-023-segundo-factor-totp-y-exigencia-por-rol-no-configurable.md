# ADR-023 — Segundo factor TOTP, y la exigencia por rol es una función de tipos, no una configuración

| Campo | Valor |
| --- | --- |
| Estado | PROPUESTO |
| Fecha | 2026-09-21 |
| Autor | arquitecto |
| Aprobado por | pendiente — G2, feature 002 |
| Spec de origen | `specs/002-identidad-y-acceso/spec.md` v3 (CA-08, CA-32, CA-38, CA-39, R-08) |
| Origen de la decisión | Decisión humana **002-B**, `REGISTRO-COMPUERTAS.md` entrada 040; condición **C-002-08** |
| Contrato | `specs/contratos/identidad-y-acceso.ts` §8 |

## Contexto

La decisión 002-B ya está tomada: `ADMINISTRADOR` obligatorio sin excepción,
`ABOGADO` obligatorio, `CLIENTE` opcional con los recaudos B-1 y B-3. Lo que
falta decidir es arquitectónico y son dos cosas distintas:

1. **Qué segundo factor.** El dictamen deja claro que no hay norma argentina que
   imponga uno; el estándar aplicable es el de adecuación al riesgo del art. 9.
   La restricción que manda es otra, y es de la constitución #13: la audiencia
   está bajo estrés financiero y usa **teléfonos de gama baja con conexión
   pobre**. Un segundo factor que exija hardware, datos o un teléfono moderno
   excluye del servicio a las personas para las que el producto existe.
2. **Cómo se vuelve imposible apagar el MFA del administrador.** CA-32 dice "no
   puede desactivarse por configuración". Es la misma familia de problema que
   ADR-013 resolvió para el bloqueo de parámetros sin ratificar, y merece la
   misma respuesta: no alcanza con que esté en `false` por defecto.

Hay un tercer hecho que cambia el peso del asunto: con MFA obligatorio para dos
roles, **la pérdida del segundo factor deja de ser un caso raro** y pasa a ser
rutina de soporte (ADR-027).

## Decisión

**TOTP (RFC 6238) como único segundo factor de esta feature, más códigos de
respaldo de un solo uso. La exigencia por rol es una función total sobre el
enumerado de rol que devuelve un literal de tipo; no existe ninguna clave de
configuración que la contradiga.**

### 1. TOTP, con los parámetros que maximizan compatibilidad

`SHA-1`, 6 dígitos, paso de 30 segundos, secreto de 20 bytes, tolerancia de
**±1 paso** (30 s hacia cada lado). SHA-1 acá no es una debilidad: en HMAC-TOTP
no hay ataque práctico y es lo único que aceptan todas las aplicaciones
autenticadoras que la gente ya tiene instaladas. Subir a SHA-256 rompe la
compatibilidad con la mitad del parque y no compra seguridad medible.

- **Inscripción en dos pasos**: el secreto se genera, se muestra como QR
  (`otpauth://totp/...`) **y como clave manual en texto** —sin la clave manual,
  quien no puede escanear queda afuera—, y **no se activa** hasta que la persona
  ingresa un código válido. Un secreto inscripto a medias no bloquea la cuenta.
- El secreto se guarda **cifrado con AES-256-GCM**, con clave fuera de la base
  (`DATA_ENCRYPTION_KEY`, ya declarada en el plan 001 §5.1). No se exporta nunca
  (CA-25: `SinSecretos` lo impide en tiempo de compilación).
- **Anti-repetición**: el último paso consumido se registra por cuenta; un
  código válido no se acepta dos veces. Sin esto, TOTP es reutilizable durante
  90 segundos por quien mira la pantalla.
- La ventana de ±1 paso **no se amplía**. El error de "código incorrecto" dice
  explícitamente que revise la hora del teléfono, que es la causa real en el 90 %
  de los casos con equipos de gama baja.
- Los intentos de segundo factor cuentan contra la política de bloqueo de
  ADR-025, con la misma clave de tráfico.

### 2. Códigos de respaldo

Diez códigos, de 10 caracteres en alfabeto Base32 sin ambigüedades (~50 bits).
Se muestran **una sola vez**, con opción de descargar e imprimir. Se guardan con
`HMAC-SHA-256` con pimienta del servidor y sal por código. Cada uno se consume
una vez y queda en la bitácora (`CODIGO_DE_RESPALDO_CONSUMIDO`). Con dos o menos
restantes, se avisa. Regenerar exige reautenticación fuerte.

### 3. La exigencia por rol es tipo, no configuración

Cuatro cerrojos independientes, ninguno apoyado en la disciplina de quien
programa:

1. **`ExigeSegundoFactor<R>`** es un tipo condicional:
   `ExigeSegundoFactor<'ADMINISTRADOR'>` **es el literal `true`**. Una rama que
   trate el caso contrario no compila.
2. **No existe la clave.** El esquema de configuración de arranque (Zod, plan
   001 §5.1) no tiene ninguna entrada para MFA por rol. Como en ADR-013: no hay
   perilla que apagar porque no hay perilla.
3. **El permiso no existe para el rol.** `mapaRolPermisos.ADMINISTRADOR` no
   contiene `mfa.desactivar.propio`, y `mapaRolPermisos.ABOGADO` tampoco. El
   endpoint de desactivación no puede autorizarse (ADR-022 capa 3): no hay nada
   que apagar aunque alguien llame a la ruta.
4. **La cuenta sin MFA no opera.** `derivarPermisos` devuelve, para
   `ADMINISTRADOR` o `ABOGADO` con `estadoMfa !== 'ACTIVO'`, únicamente los
   permisos de inscripción. Una cuenta administradora recién creada puede
   inscribir su factor y nada más.

La válvula legítima —cambié de teléfono— no es desactivar: es **reinscribir**,
con reautenticación fuerte y con el factor viejo o un código de respaldo. Es lo
que `ux.md` AD-6 llama "Cambiar de dispositivo", y este ADR lo ratifica.

### 4. Cliente: opcional, ofrecido, y difícil de apagar

`CLIENTE` puede activarlo y desactivarlo, pero desactivar exige
**reautenticación fuerte** (contraseña + segundo factor vigente, dentro de la
ventana de 5 minutos de `CREDENCIAL`, recaudo B-3), y genera evento y correo.
La oferta activa desde el día uno es de `ux.md` CL-2; la cadencia del
reofrecimiento es `[ESCALAMIENTO-F]` de `ux.md` y no la decide el arquitecto.

### 5. Qué aplicación recomendar (hueco `{APP}` de `ux.md` §11.1)

**No se recomienda una sola aplicación y no se exige ninguna.** El requisito es
"cualquier aplicación compatible con TOTP", y la pantalla nombra al menos tres
opciones de distinta clase —una libre, una de un gran proveedor, y el gestor de
contraseñas del propio teléfono, que en iOS y Android ya genera códigos TOTP sin
instalar nada—. Nombrar una sola aplicación es recomendar un producto de un
tercero a una audiencia vulnerable, y eso no es una decisión técnica. La
pantalla siempre ofrece la clave manual además del QR.

### Verificación

Un test por CA-08, CA-32, CA-38 y CA-39. Además: **test de forma** que verifica
que el esquema de configuración no tiene ninguna clave que mencione MFA; test de
que `mapaRolPermisos.ADMINISTRADOR` no contiene `mfa.desactivar.propio`; test de
tipos que falla si `ExigeSegundoFactor<'ADMINISTRADOR'>` deja de ser `true`;
test de que un código TOTP válido no se acepta dos veces; test de que el primer
paso del ingreso no revela si la contraseña era correcta (ADR-025).

## Alternativas consideradas

| Alternativa | A favor | En contra | Por qué no |
| --- | --- | --- | --- |
| **WebAuthn / passkeys** | Resistente a *phishing*, que es el ataque real; sin secreto compartido; buena experiencia en equipos modernos | Requiere navegador y sistema recientes; en Android de gama baja y versiones viejas es irregular; la recuperación es peor (si se pierde el dispositivo no hay "código de respaldo" equivalente); y en la app móvil agrega complejidad nativa | Excluiría a parte de la audiencia (constitución #13). Se adopta TOTP ahora y WebAuthn queda como **método adicional aditivo**, sin romper nada |
| **SMS / OTP por mensaje de texto** | Cero fricción, no hace falta instalar nada | Suplantación de SIM; requiere recolectar el teléfono (dato personal que hoy no pedimos: minimización, art. 4); depende de un tercero y cuesta plata por mensaje; el usuario puede no tener crédito | Peor en seguridad, peor en minimización y con costo variable. Es el peor de los mundos acá |
| **Código por correo electrónico** | Nada que instalar | El correo **es** el canal de recuperación de la contraseña: no es un segundo factor, es el mismo factor otra vez | No agrega nada frente a un correo comprometido, que es el escenario que el MFA cubre |
| **Aplicación propia con notificación push** | Buena experiencia, vinculada al dispositivo | Exige tener la app instalada (la web no la tiene), infraestructura de push, y un tercero (FCM/APNs) en el camino crítico del ingreso | Desproporcionado. Reconsiderable cuando la app móvil esté madura |
| TOTP con SHA-256 y 8 dígitos | Marginalmente más fuerte | Varias aplicaciones populares lo ignoran o lo implementan mal; el usuario tipea más | Compatibilidad vale más que un margen teórico |
| Ventana de ±2 pasos o más | Menos errores por reloj desfasado | Amplía a 2,5 minutos la vida útil de un código robado | Se resuelve con microcopy sobre la hora del teléfono, no aflojando la ventana |
| Bandera de configuración `mfaObligatorioPorRol` con valores seguros por defecto | Flexible, permite un piloto sin MFA | CA-32 la prohíbe; y una bandera de emergencia se enciende una noche y no se apaga nunca | Mismo razonamiento que ADR-013 |
| Exigir MFA también al cliente | Más seguro en abstracto | Excluye a quien no tiene un teléfono capaz; el dictamen lo desaconseja por art. 8 bis y la decisión 002-B ya lo resolvió | Cerrado por decisión humana |

## Consecuencias

**Positivas**

- Funciona sin conexión, sin costo por uso, sin teléfono moderno y sin ningún
  tercero: el ingreso con segundo factor no depende de que nada externo esté
  disponible.
- CA-32 se cumple por construcción y por cuatro caminos distintos; apagarlo
  requeriría cuatro cambios coordinados, cada uno con su test en contra.
- Los tres roles comparten el mismo mecanismo: no hay tres implementaciones.

**Negativas**

- **TOTP no protege contra *phishing*.** Una página falsa que pida contraseña y
  código entra igual. Es la limitación conocida y la razón por la que WebAuthn
  queda anotado como paso siguiente; se mitiga con el aviso de sesión nueva y
  con la visibilidad de sesiones (CA-13).
- Un secreto compartido que hay que cifrar, custodiar y rotar.
- **Crece el volumen del circuito de restitución** (ADR-027), que es trabajo
  humano y tiene costo operativo real.
- La cuenta administradora sembrada queda inoperante hasta inscribir su factor.
  Es deliberado, y el guion de siembra lo dice en su salida.

**Qué cierra**

- Cualquier configuración que apague el MFA de `ADMINISTRADOR` o `ABOGADO`.
- Recolectar el número de teléfono con fines de autenticación en esta feature.

## Cómo se revierte

- **Agregar WebAuthn**: aditivo. `MetodoSegundoFactor` es una unión: se suma un
  brazo, se suma un verificador y nada existente cambia. Dos o tres días. Es el
  camino recomendado cuando el parque de dispositivos lo permita.
- **Quitar el MFA obligatorio de un rol**: requiere revertir la decisión humana
  002-B, un ADR de reemplazo y dictamen nuevo; y tocar cuatro cerrojos. El costo
  alto es intencional.
- **Cambiar los parámetros de TOTP**: trivial para nuevas inscripciones, pero
  invalida los secretos existentes salvo que se versionen. Si alguna vez se
  hace, se versiona el parámetro junto al secreto.
