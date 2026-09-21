# Diseño UX 002 — Identidad y acceso

| Campo | Valor |
| --- | --- |
| Autor | `ux-expert` |
| Spec de origen | `specs/002-identidad-y-acceso/spec.md` **versión 3, 39 criterios** |
| Dictamen vinculante | `specs/002-identidad-y-acceso/cumplimiento.md` §3 (deber de información), §4.2 (recaudos A/B/C), §4.4 (salvaguardas M-1 a M-7) |
| Sistema de diseño | `specs/diseno/sistema-de-diseno.md` · `specs/diseno/tokens.md` (versión 1, sin cambios) |
| Estado | BORRADOR — se aprueba en G2 |
| Compuerta | G2 |

> **Qué es este documento y qué no.**
> Especifica **todo lo que se ve** del alta, el ingreso, la recuperación, el
> segundo factor, las sesiones, el perfil y el panel de verificación de
> matrículas, para las tres audiencias. No define reglas de negocio, no define el
> mecanismo técnico del segundo factor (es del `arquitecto`), no redacta el texto
> legal del responsable de la base (es de `compliance-legal` + el estudio) y no
> escribe código.
>
> **Todo texto entre `{LLAVES MAYÚSCULAS}` es un hueco que este agente no puede
> llenar.** Está listado uno por uno en §11. Ninguna pantalla puede implementarse
> con el hueco vacío.

---

## 1. Contexto de uso

### 1.1 Quién abre esto y en qué estado

**El cliente.** Esta es la **primera pantalla del producto que ve en su vida**.
Llegó porque tiene deudas en mora y probablemente porque alguien le está
reclamando. Tres cosas condicionan todo:

- **Viene lastimado por formularios.** El último que llenó fue el de un banco que
  le dijo que no, o el de un estudio de cobranzas. Un formulario largo, con
  campos que no entiende para qué son, le confirma que esto es lo mismo de antes.
- **Tiene miedo de que esto empeore su situación.** La pregunta que no hace en
  voz alta es *"si les doy mis datos, ¿esto va a figurar en algún lado? ¿me van a
  consultar el Veraz?"*. Si no se la respondemos sin que la pregunte, la responde
  él solo con lo peor.
- **Tiene vergüenza.** No le contó a nadie. Si en algún momento la pantalla lo
  trata como sospechoso —"intentos fallidos", "cuenta bloqueada", "verificación
  de identidad"— confirma que lo estamos tratando como a un moroso.

Dispositivo: Android de gama baja o media-baja, LCD de 5 a 6,5", fuente del
sistema agrandada. Datos móviles medidos. Sesión de 2 a 6 minutos, muchas de
noche. Alfabetización digital media-baja: **el correo lo abre en la app de
correo del teléfono, y volver a la app después de tocar el enlace no es obvio.**

**El abogado.** Se está dando de alta **para trabajar**, no para resolver un
problema personal. No necesita contención: necesita saber en cuánto tiempo puede
empezar a facturar. Escritorio, 1440px o más. Su frustración típica no es "no
entiendo", es "llené todo y no me dicen cuándo". Un limbo sin plazo es, para él,
una plataforma que no funciona — y para el dictamen, art. 8 bis LDC.

**El administrador.** Escritorio. En esta feature hace dos cosas caras de
equivocarse: **habilitar a alguien a ejercer la abogacía dentro de la plataforma**
y **crear a otro administrador**. Necesita que la interfaz le impida aprobar sin
mirar, y necesita saber que todo lo que hace queda con su nombre.

### 1.2 Restricciones que atraviesan todo

| # | Restricción | Origen |
| --- | --- | --- |
| R1 | **La información del art. 6 se muestra en la pantalla de alta**, no sólo en un documento enlazado, y no es letra chica: `texto.base` mínimo, 7:1 de contraste, no plegable | CA-26, dictamen §3 |
| R2 | **Ninguna pantalla revela si un correo o un CUIT/CUIL tienen cuenta**, ni por el texto, ni por el tiempo de respuesta, ni por la diferencia entre dos pantallas | CA-02, CA-04, R-05 |
| R3 | **Ningún camino termina sin salida.** Todo error de correo, enlace o bloqueo ofrece una acción que el usuario puede ejecutar ahí mismo | CA-02, CA-06, CA-15, CA-17, CA-36, condición C-002-06 |
| R4 | **La palabra "verificado" nunca aparece sola.** Siempre "verificada el {fecha} contra {constancia}" | CA-05, CA-31, salvaguarda M-6 |
| R5 | El segundo factor obligatorio (abogado, administrador) **siempre explica por qué lo es**, en el mismo bloque donde se impone | CA-32, CA-38 |
| R6 | El segundo factor del cliente **se ofrece, nunca se presiona**. "Ahora no" es un botón real del mismo tamaño y no penaliza | CA-39, recaudo B-1 |
| R7 | **La contraseña nunca se guarda en un borrador local**, ni en un campo recordado, ni en la cola offline | Constitución #5 |
| R8 | Ningún texto de esta feature contiene una promesa de resultado ni un término de la lista prohibida del dictamen 004 §3.8 | Constitución #6 |
| R9 | El camino de baja **no puede quedar detrás del login** ni exigir registración previa: el enlace vive en el pie de las pantallas públicas | Res. SCI 424/2020, C-002-05, decisión 002-D |

### 1.3 Lo que esta feature **no** vende

No hay alta de plan, no hay precio, no hay suscripción en ninguna de estas
pantallas. La regla 6 del mandato (precio siempre visible) **no tiene objeto acá
y eso es deliberado**: el alta es gratuita y no se le pide al usuario ninguna
decisión económica en su primera sesión. Si en una revisión posterior alguien
propone poner una oferta de plan en el alta o en la confirmación de correo, eso
**vuelve a compuerta**: sería pedirle una decisión de plata a alguien que todavía
no vio ni un dato de su propia situación.

---

## 2. Flujo

### 2.1 Alta

```
                       ┌────────────────────────┐
                       │  AL-1  ¿Qué tipo de    │
                       │  cuenta necesitás?     │   una pantalla, una decisión
                       └────┬──────────────┬────┘
                    cliente │              │ abogado
                            ▼              ▼
              ┌──────────────────┐  ┌──────────────────┐
              │ AL-2 Crear tu    │  │ AL-3a Crear tu   │
              │ cuenta           │  │ cuenta (idéntica)│
              │ + ART. 6 (CA-26) │  │ + ART. 6         │
              │ + términos v.X   │  │ + términos v.X   │
              └────────┬─────────┘  └────────┬─────────┘
                       │                     ▼
                       │            ┌──────────────────┐
                       │            │ AL-3b Matrícula  │
                       │            │ y jurisdicción   │
                       │            └────────┬─────────┘
                       └──────────┬──────────┘
                                  ▼
                   ┌────────────────────────────────┐
                   │ AL-4  "Revisá tu correo"       │  ← MISMA pantalla
                   │ Respuesta idéntica exista o no │    exista o no la
                   │ la cuenta (CA-02, CA-04)       │    cuenta (R2)
                   └───────────────┬────────────────┘
                                   │ toca el enlace del correo
                                   ▼
                   ┌────────────────────────────────┐
                   │ AL-5 Confirmación              │
                   │  ├ válido  → cuenta activa     │
                   │  └ vencido/usado → pedir otro  │  (CA-06, siempre accionable)
                   └───────┬──────────────┬─────────┘
                  cliente  │              │ abogado
                           ▼              ▼
                ┌────────────────┐  ┌──────────────────────┐
                │ CL-2 Ofrecemos │  │ AB-1 Cuenta en       │
                │ 2º factor      │  │ revisión (CA-05)     │
                │ (opcional)     │  │ + AB-2 2º factor     │
                └────────────────┘  │   obligatorio(CA-38) │
                                    └──────────┬───────────┘
                                               │ ≤ {plazoRevision}
                                               ▼
                                    ┌──────────────────────┐
                                    │ AD-2 Un administrador│
                                    │ decide con evidencia │
                                    │ → verificada el X    │
                                    │ → rechazada + motivo │
                                    │ → vencido el plazo:  │
                                    │   escala solo (CA-31)│
                                    └──────────────────────┘
```

**Por qué el alta del cliente es una sola pantalla y la del abogado son dos.** El
cliente da tres datos y ninguno le cuesta pensar; partirlo en pasos alarga sin
agregar claridad. El abogado da tres datos personales **y dos datos
profesionales que tienen otra consecuencia** (quedar sujeto a verificación): son
dos decisiones distintas y por eso son dos pantallas.

### 2.2 Ingreso

```
  IN-1 Ingresar ──► ¿credenciales correctas?
                      │
        ┌─────────────┼──────────────────┬─────────────────────┐
        │ sí, sin MFA │ sí, con MFA      │ no                  │
        ▼             ▼                  ▼                     │
   portal del    IN-2 Segundo        mensaje único y genérico  │
   rol           factor              (no dice qué falló)       │
                    │                     │                    │
                    │  no lo tengo        │  5 intentos / 15 min
                    ▼                     ▼                    │
              RE-4 Restitución      IN-3 Ingresos pausados ◄────┘
              (persona, no          + SIEMPRE "Cambiar mi
               automático, CA-35)     contraseña" habilitado (CA-36)
```

### 2.3 Recuperación

```
  RE-1 pedir enlace ──► respuesta idéntica exista o no el correo (CA-15)
         │
         ├─ enlace válido ──► RE-2 contraseña nueva ──► se cierran TODAS las
         │                                              sesiones (CA-16) +
         │                                              correo de aviso
         └─ enlace vencido/usado ──► RE-3 "pedí uno nuevo" (CA-17)
```

### 2.4 Puntos de abandono probables y qué hacemos

| Momento | Por qué se va | Mitigación |
| --- | --- | --- |
| AL-2, al ver el bloque de datos personales | "Esto es un contrato, después lo leo" y cierra | El bloque tiene 5 frases y ninguna cláusula. La finalidad de cada campo está **junto al campo**, no en el bloque |
| AL-2, en la casilla de términos | Miedo a autorizar una consulta al Veraz | La casilla dice, en el mismo lugar, **qué no autoriza**. Es lo primero que este producto puede hacer para ganarse la confianza |
| AL-4, esperando el correo | El correo cae en spam o no sabe volver a la app | La pantalla dice dónde mirar, cuánto dura el enlace, y tiene "Mandarlo de nuevo" con contador de espera |
| AB-1, abogado esperando | No hay plazo visible | El plazo está en la pantalla con **fecha concreta** y con qué pasa si se vence, sin que tenga que reclamar (CA-31) |
| IN-3, cuenta pausada | Pánico: "me bloquearon, perdí el expediente" | El título no dice "bloqueada". Dice que se pausaron los intentos, por cuánto, y ofrece la salida inmediata |
| CL-2, ofrecimiento del segundo factor | Siente que le imponen un trámite más | "Ahora no" es primario-secundario del mismo tamaño y no vuelve a aparecer en la misma sesión |

---

## 3. Pantallas comunes: alta, ingreso y recuperación

Móvil primero. Las diferencias de web están en §9.

### AL-1 · ¿Qué tipo de cuenta necesitás?

**Propósito.** Separar los dos formularios antes de que existan. Es la única
decisión de la pantalla.

```
┌──────────────────────────────────────────────────┐
│  Mejorar                                         │
├──────────────────────────────────────────────────┤
│ ¿Qué tipo de cuenta necesitás?                   │  h1, texto.2xl
│                                                  │
│ ┌──────────────────────────────────────────────┐ │
│ │ Tengo deudas y quiero ver qué puedo hacer    │ │  tarjeta, 1px borde,
│ │                                              │ │  toda la tarjeta es el
│ │ Es la cuenta para vos si te reclaman una     │ │  objetivo táctil
│ │ deuda, o si querés entender la situación     │ │
│ │ de la que ya tenés.                     ›    │ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ ┌──────────────────────────────────────────────┐ │
│ │ Soy abogado o abogada y quiero trabajar acá  │ │
│ │                                              │ │
│ │ Te vamos a pedir tu matrícula y tu           │ │
│ │ jurisdicción, y las verificamos antes de     │ │
│ │ asignarte casos.                        ›    │ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ Ya tengo cuenta                                  │  terciario
├──────────────────────────────────────────────────┤
│ Cancelar mi suscripción  ·  Términos  ·  Datos   │  pie público, R9
└──────────────────────────────────────────────────┘
```

- **No hay tarjeta de administrador** y no se menciona que el rol existe (R-01).
- El pie con "Cancelar mi suscripción" (botón de arrepentimiento, R9) está en
  **todas** las pantallas públicas. Su contenido es de la feature 003; acá se
  reserva el lugar y se garantiza que no queda detrás del login.

| Estado | Qué se ve |
| --- | --- |
| **Vacío** | No aplica: la pantalla es una elección, siempre tiene sus dos opciones |
| **Cargando** | No aplica: es estática y se sirve del caché |
| **Error** | No aplica |
| **Parcial** | No aplica |
| **Éxito** | Navega a AL-2 o AL-3a |

---

### AL-2 · Crear tu cuenta (cliente) — la pantalla del art. 6

**Propósito.** Abrir la cuenta con tres datos y, en el mismo acto, cumplir el
deber de informar del art. 6 de la Ley 25.326 sin que la pantalla se convierta en
un contrato.

#### Cómo se resuelve el art. 6 sin que se sienta un contrato

El error que se comete siempre es **juntar los cinco incisos en un solo bloque**
al final. Ese bloque, por corto que sea, es un muro, y el muro no se lee. Acá los
cinco incisos se reparten en tres capas, cada una en el lugar donde esa
información sirve para algo:

| Capa | Qué incisos cubre | Dónde está | Por qué ahí |
| --- | --- | --- | --- |
| **1. Nota de campo** | a) finalidad · c) obligatorio o facultativo · d) consecuencia de que el dato esté mal | Debajo de cada campo, en `texto.base` | Es donde la persona está mirando cuando decide dar el dato. Una línea sobre un campo se lee; un párrafo sobre once campos, no |
| **2. Bloque "Qué hacemos con estos datos"** | b) existencia de la base, identidad y domicilio del responsable · a) destinatarios · e) derechos · d) consecuencia de negarse | Encima de la casilla de aceptación, no plegable | Es lo único que no se puede repartir por campo: es información sobre el responsable, no sobre un dato |
| **3. Política completa** | Todo, en extenso | Enlace, abre en pantalla propia | Existe para quien quiera leerlo, y **no es requisito de nada** |

Tres reglas que hacen que la capa 2 no se sienta un contrato:

1. **Cinco frases, ninguna cláusula.** Sujeto concreto ("Los guarda {RAZÓN
   SOCIAL}"), verbo en presente, sin "el usuario declara", sin "a los efectos
   de", sin "el presente documento".
2. **Dice lo que NO hacemos, no sólo lo que hacemos.** "No los vendemos ni los
   cedemos" y "esto no autoriza a consultar tu informe crediticio" son las dos
   frases que esta audiencia necesita leer. Son las únicas dos que va a recordar.
3. **No se puede plegar, no se puede truncar, y no está debajo del botón.** Va
   entre el último campo y la casilla de aceptación: en el camino del pulgar,
   no en el pie.

```
┌──────────────────────────────────────────────────┐
│ ←  Crear tu cuenta                               │
├──────────────────────────────────────────────────┤
│ Necesitamos tres datos. Nada más que eso         │  texto.lg
│ por ahora.                                       │
├──────────────────────────────────────────────────┤
│ Tu correo                            Obligatorio │  etiqueta texto.sm/600
│ ┌──────────────────────────────────────────────┐ │  + marca TEXTUAL, no color
│ │                                              │ │  campo 48px
│ └──────────────────────────────────────────────┘ │
│ Con esto identificamos tu cuenta, te             │  nota de campo,
│ confirmamos el alta y te avisamos si alguien     │  texto.base secundario
│ intenta entrar. Si lo escribís mal no vas a      │  ← inciso d)
│ poder confirmar la cuenta ni recuperarla.        │
│                                                  │  esp.6 entre grupos
│ Tu contraseña                        Obligatorio │
│ ┌────────────────────────────────────┐ ┌───────┐ │
│ │ ••••••••••••                       │ │  Ver  │ │  48×48, aria-pressed
│ └────────────────────────────────────┘ └───────┘ │
│ Al menos 10 caracteres. Puede ser una frase      │
│ que te acuerdes fácil, con espacios.             │
│                                                  │
│ Cómo querés que te llamemos          Obligatorio │
│ ┌──────────────────────────────────────────────┐ │
│ │                                              │ │
│ └──────────────────────────────────────────────┘ │
│ Lo usamos para saludarte en la app y en los      │
│ correos. Puede ser sólo tu nombre de pila.       │
├──────────────────────────────────────────────────┤
│▍ℹ Qué hacemos con estos datos                    │  BloqueAvisoLegal
│▍                                                 │  NO plegable, 7:1,
│▍ Los guarda {RAZÓN SOCIAL}, con domicilio en     │  texto.base mínimo
│▍ {DOMICILIO}. Los usamos para tu cuenta y para   │
│▍ el servicio, nada más: no los vendemos ni los   │
│▍ cedemos a nadie.                                │
│▍                                                 │
│▍ Para mandarte los correos usamos a              │
│▍ {PROVEEDOR DE CORREO}, que los envía por        │
│▍ nosotros y no puede usarlos para otra cosa.     │
│▍                                                 │
│▍ Cada vez que entrás guardamos la fecha, el      │
│▍ dispositivo y una ubicación aproximada, para    │
│▍ que puedas ver desde dónde entraron a tu        │
│▍ cuenta y cerrar lo que no reconozcas.           │
│▍                                                 │
│▍ Los tres datos de arriba son obligatorios: sin  │
│▍ ellos no podemos abrir la cuenta. No te         │
│▍ pedimos ningún otro dato.                       │
│▍                                                 │
│▍ Podés pedir ver, corregir o borrar tus datos    │
│▍ cuando quieras, desde tu perfil o escribiendo   │
│▍ a {CANAL DE CONTACTO}.                          │
│▍                                                 │
│▍ Leer la política de privacidad completa  ›      │  enlace, 7.54:1
├──────────────────────────────────────────────────┤
│ ┌──┐                                             │
│ │  │  Leí y acepto los Términos y condiciones    │  casilla 48×48,
│ └──┘  y la Política de privacidad.               │  SIN marcar por defecto
│       Términos {VERSIÓN} · Política {VERSIÓN}    │
│                                                  │
│       Guardamos qué versión aceptaste, con la    │  CA-27 hecho visible
│       fecha y la hora, para que las dos partes   │
│       podamos probar lo mismo.                   │
│                                                  │
│       Esto no autoriza a consultar tu informe    │  CA-27, alcance limitado
│       crediticio ni a mandarte publicidad. Si    │
│       alguna vez hiciera falta, te lo pedimos    │
│       aparte y podés decir que no.               │
├──────────────────────────────────────────────────┤
│ [          Crear mi cuenta          ]            │  primario, 48px
│ Ya tengo cuenta                                  │  terciario
├──────────────────────────────────────────────────┤
│ Cancelar mi suscripción · Términos · Datos       │
└──────────────────────────────────────────────────┘
```

**Decisiones de detalle que importan:**

- **"Obligatorio" se escribe con la palabra**, alineado a la derecha de la
  etiqueta. Nunca un asterisco rojo: el asterisco es convención de formulario
  bancario, no lo entiende todo el mundo, y depende de color. Cuando exista un
  campo facultativo, dirá **"Podés no completarlo"**, no "opcional".
- **No hay campo "repetir contraseña".** Está el botón "Ver". Repetir la
  contraseña duplica el trabajo y es la principal causa de abandono en teclado de
  teléfono; el riesgo de tipeo lo cubre la recuperación, que existe igual.
- **No hay medidor de fuerza con barritas de colores.** El requisito se dice una
  vez en la nota de campo y, si falla, se dice exactamente qué falta (CA-03).
- **El botón no dice "Registrarme" ni "Empezar".** Dice qué va a pasar.
- **El CUIT/CUIL no está en esta pantalla.** Ver `[ESCALAMIENTO-A]` en §11: la
  spec v3 no declara su finalidad, y sin finalidad declarada no se puede escribir
  la nota de campo que el art. 6 inciso a) exige. La recomendación de diseño es
  no pedirlo en el alta.

#### Los cinco estados de AL-2

| Estado | Qué se ve |
| --- | --- |
| **Vacío** | **Es el estado inicial y el que más se ve.** Los tres campos vacíos, las tres notas visibles desde el primer segundo (no aparecen al enfocar), el bloque del art. 6 completo y el botón primario **habilitado**. El botón no se deshabilita por campos vacíos: al tocarlo, mueve el foco al primer campo incompleto y muestra el error. Un botón gris y mudo no enseña nada |
| **Cargando** | El botón primario pasa a "Creando tu cuenta…" con `aria-busy`, mismo tamaño, sin overlay. Los campos quedan en sólo lectura, no deshabilitados (deshabilitados pierden contraste y el lector de pantalla los saltea) |
| **Error** | Tres niveles. (a) **Por campo**: mensaje bajo el campo, `aria-describedby`, ícono `aviso` + texto. (b) **Resumen arriba**: `role="alert"`, "Falta completar 2 cosas", con enlaces que llevan a cada campo — necesario porque en móvil el error puede quedar fuera de pantalla. (c) **Falla del sistema**: `PanelSemantico problema` con reintento, y **lo escrito no se pierde** (menos la contraseña, R7) |
| **Parcial** | Sin conexión al enviar: "No pudimos crear la cuenta porque no hay conexión. Lo que escribiste queda guardado en este teléfono, menos la contraseña — esa la vas a tener que escribir de nuevo. Probá cuando vuelva la señal." Botón "Reintentar" |
| **Éxito** | Navega a AL-4. **No hay pantalla de felicitación, ni animación, ni confeti** (sistema de diseño §6.3.4) |

---

### AL-3 · Crear tu cuenta (abogado)

**AL-3a** es idéntica a AL-2 salvo tres cosas: el indicador "Paso 1 de 2", el
botón dice "Seguir" y el tono baja la contención (no "nada más que eso por
ahora", sino "Datos de la cuenta"). El bloque del art. 6 es **el mismo texto**:
la ley no distingue por profesión y dos textos distintos se desincronizan.

**AL-3b · Tu matrícula:**

```
┌──────────────────────────────────────────────────┐
│ ←  Tu matrícula                       Paso 2 de 2│
├──────────────────────────────────────────────────┤
│ Verificamos la matrícula antes de asignarte      │  texto.lg
│ casos. Te decimos abajo cuánto tarda.            │
├──────────────────────────────────────────────────┤
│ Colegio o consejo                    Obligatorio │
│ ┌──────────────────────────────────────────────┐ │
│ │ Buscar…                                    ▾ │ │  selección con búsqueda
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ Número de matrícula                  Obligatorio │
│ ┌──────────────────────────────────────────────┐ │
│ └──────────────────────────────────────────────┘ │
│ Tal como figura en tu credencial.                │
│                                                  │
│ Jurisdicción en la que ejercés       Obligatorio │
│ ┌──────────────────────────────────────────────┐ │
│ │                                            ▾ │ │
│ └──────────────────────────────────────────────┘ │
│ Determina en qué casos podemos asignarte.        │
│                                                  │
│ Constancia de matrícula              Obligatorio │
│ ┌──────────────────────────────────────────────┐ │
│ │  Adjuntar archivo o foto                     │ │  48px
│ └──────────────────────────────────────────────┘ │
│ Credencial, constancia del colegio o captura     │
│ del padrón público. JPG, PNG o PDF, hasta 5 MB.  │
├──────────────────────────────────────────────────┤
│▍ℹ Qué hacemos con la matrícula                   │  art. 6, dato nuevo
│▍ La usamos para verificar que podés ejercer y    │
│▍ para mostrarle al cliente quién lleva su caso.  │
│▍ La matrícula, la jurisdicción y la fecha de     │
│▍ verificación **son visibles para el cliente     │
│▍ que tenga un caso asignado con vos.** La        │
│▍ constancia que adjuntás no: la ve sólo quien    │
│▍ hace la verificación, y queda en la bitácora.   │
├──────────────────────────────────────────────────┤
│ [        Enviar para verificación        ]       │
└──────────────────────────────────────────────────┘
```

| Estado | Qué se ve |
| --- | --- |
| **Vacío** | Los cuatro campos vacíos con sus notas. Botón habilitado |
| **Cargando** | Subida del archivo con barra de progreso **determinada** (el peso se conoce) y "Cancelar". El botón primario espera a que termine la subida, con texto "Esperando el archivo…" |
| **Error** | Archivo pesado: "El archivo pesa 8 MB y el máximo es 5 MB. Si es una foto, sacala de nuevo con menos calidad o mandá sólo la página que tiene la matrícula." Formato: nombra los tres que aceptamos. Falla de red en la subida: se reintenta sola dos veces antes de mostrar error, y el resto del formulario no se pierde |
| **Parcial** | Formulario completo y archivo sin subir: "Te falta la constancia. Podés mandar el resto ahora y adjuntarla después desde tu perfil — la verificación arranca cuando esté." **Se permite avanzar**: bloquear el alta por un archivo es dejar afuera a quien no tiene la constancia a mano |
| **Éxito** | AL-4, y después del correo confirmado, AB-1 |

---

### AL-4 · Revisá tu correo

**Propósito.** Una sola pantalla para tres situaciones que el usuario no puede
distinguir y que el sistema no puede revelar: alta nueva, correo ya registrado
(CA-02) y CUIT/CUIL ya registrado (CA-04).

```
┌──────────────────────────────────────────────────┐
│                                                  │
│ Revisá tu correo                                 │  h1, texto.2xl
│                                                  │
│ Si el correo que pusiste está bien, te llega un  │  texto.lg
│ mensaje nuestro en los próximos minutos. Abrilo  │
│ y tocá el botón para terminar.                   │
│                                                  │
│ Te lo mandamos a:  juan***@gmail.com             │  eco enmascarado
│                                                  │
│▍ℹ Si no lo ves                                   │  PanelSemantico informativo
│▍ · Mirá en Correo no deseado o Spam.             │
│▍ · El enlace vale por {VIGENCIA ENLACE}.         │
│▍ · Si ya tenías una cuenta con este correo, el   │  ← resuelve CA-02 sin
│▍   mensaje te va a decir cómo entrar o cómo      │    revelar nada
│▍   recuperar la contraseña.                      │
│                                                  │
│ [ Mandarlo de nuevo ]                            │  secundario; se deshabilita
│ Vas a poder pedirlo de nuevo a las 21:14.        │  60s con motivo visible
│                                                  │
│ Escribí mal el correo  ›                         │  terciario → vuelve a AL-2
│                                                  │
└──────────────────────────────────────────────────┘
```

**Por qué la tercera viñeta es la pieza clave.** Es lo que evita el callejón sin
salida que el dictamen §4.3 marcó: la persona que ya tenía cuenta y no se
acuerda lee acá, en la pantalla, que el correo que le va a llegar es distinto y
que igual tiene salida. No se revela nada —la frase es condicional y se le
muestra a todo el mundo— y el usuario legítimo ya sabe qué esperar.

| Estado | Qué se ve |
| --- | --- |
| **Vacío** | No aplica |
| **Cargando** | Al reenviar: el botón pasa a "Mandando…". Nunca un overlay de página |
| **Error** | Falla el reenvío: "No pudimos mandarlo ahora. Probá de nuevo en un minuto, o volvé a intentar el alta." Nunca se dice "ese correo no existe" |
| **Parcial** | Sin conexión: "Sin conexión. El correo ya salió de nuestro lado, buscalo cuando vuelva la señal." (si el alta se había confirmado) |
| **Éxito** | El reenvío confirma con texto en la propia pantalla, `aria-live="polite"`: "Listo, lo mandamos de nuevo." **Sin toast que se va** (sistema de diseño §8) |

---

### AL-5 · Confirmación del correo

Tres resultados, una sola pantalla con tres contenidos. Ninguno es un callejón
(CA-06).

| Resultado | Título | Cuerpo | Acción |
| --- | --- | --- | --- |
| Enlace válido | `Listo, tu cuenta está activa.` | Cliente: "Ya podés entrar." Abogado: "Ya podés entrar. Falta verificar tu matrícula: te lo explicamos adentro." | `Entrar` (primario) |
| Vencido o ya usado | `Este enlace ya no sirve.` | "Los enlaces valen {VIGENCIA ENLACE} y se usan una sola vez. Te mandamos uno nuevo ahora mismo si querés." — **no dice si el enlace existió** | `Mandarme un enlace nuevo` (primario) · `Entrar` (secundario) |
| Enlace roto / cortado por el cliente de correo | `No pudimos leer el enlace.` | "A veces el correo corta el enlace en dos líneas. Copiá el enlace completo y pegalo en el navegador, o pedí uno nuevo." | `Mandarme un enlace nuevo` |

| Estado | Qué se ve |
| --- | --- |
| **Vacío** | No aplica |
| **Cargando** | Esqueleto del bloque de resultado, `umbral.esqueleto` 300ms. La pantalla **no salta** |
| **Error** | Falla del sistema al validar: `problema`, "No pudimos confirmar el correo ahora. No perdiste nada: probá de nuevo en un rato con el mismo enlace." + reintento |
| **Parcial** | No aplica |
| **Éxito** | Cuenta activa, navega al portal o a AB-1 |

---

### IN-1 · Ingresar

```
┌──────────────────────────────────────────────────┐
│  Mejorar                                         │
├──────────────────────────────────────────────────┤
│ Entrar a tu cuenta                               │  h1
│                                                  │
│ Tu correo                                        │
│ ┌──────────────────────────────────────────────┐ │  autocomplete="username"
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ Tu contraseña                                    │
│ ┌────────────────────────────────────┐ ┌───────┐ │  autocomplete
│ │                                    │ │  Ver  │ │  ="current-password"
│ └────────────────────────────────────┘ └───────┘ │
│                                                  │
│ [              Entrar               ]            │  primario
│                                                  │
│ Me olvidé la contraseña  ›                       │  terciario, SIEMPRE visible
│ No tengo cuenta  ›                               │  terciario
├──────────────────────────────────────────────────┤
│ Cancelar mi suscripción · Términos · Datos       │
└──────────────────────────────────────────────────┘
```

- **"Me olvidé la contraseña" está siempre visible**, no aparece recién después
  de un error. En esta audiencia el olvido es el caso frecuente, no el borde.
- Un solo mensaje de error para credenciales incorrectas, para correo inexistente
  y para cuenta no confirmada: `El correo o la contraseña no coinciden.` Nada
  más (R2, CA-12). **La cuenta sin confirmar no se distingue acá**: si el
  ingreso es válido pero falta confirmar, se entra a una pantalla CL-1 que lo
  explica — así el mensaje de error no filtra existencia.

| Estado | Qué se ve |
| --- | --- |
| **Vacío** | Estado inicial. Sin mensajes, sin alertas previas |
| **Cargando** | Botón "Entrando…", `aria-busy`. Sin overlay |
| **Error** | `El correo o la contraseña no coinciden.` en `role="alert"` sobre el formulario + los dos campos marcados. Debajo, siempre: "¿Te olvidaste la contraseña? Te mandamos un enlace para cambiarla." con el enlace. **Un error de ingreso nunca es un `PanelSemantico problema`**: no es una falla del sistema y no se pinta como tal |
| **Parcial** | Sin conexión: "No hay conexión, así que no podemos verificar tu contraseña. Guardamos tu correo para que no lo escribas de nuevo." La contraseña **no** se guarda (R7) |
| **Éxito** | Al portal, o a IN-2 si tiene segundo factor |

---

### IN-2 · Tu código de seguridad

```
┌──────────────────────────────────────────────────┐
│ ←  Tu código de seguridad                        │
├──────────────────────────────────────────────────┤
│ Abrí la app {APP} y escribí el código de         │  texto.lg
│ 6 números que te muestra.                        │
│                                                  │
│ ┌──────────────────────────────────────────────┐ │  UN campo, no seis cajas
│ │  ______                                      │ │  inputmode=numeric
│ └──────────────────────────────────────────────┘ │  autocomplete=one-time-code
│ El código cambia cada 30 segundos. Si estás      │
│ justo en el cambio, esperá el siguiente.         │
│                                                  │
│ [             Confirmar             ]            │
│                                                  │
│ Usar un código de respaldo  ›                    │  terciario
│ No puedo usar ninguno de los dos  ›              │  terciario → RE-4 (CA-35)
└──────────────────────────────────────────────────┘
```

- **Un solo campo, no seis cajitas.** Las seis cajitas rompen el pegado desde el
  portapapeles, rompen el autorrelleno del código, y el lector de pantalla las
  anuncia como seis campos sin etiqueta. Es una decisión de accesibilidad, no
  estética.
- El error nunca dice si la contraseña anterior era correcta (CA-08): la pantalla
  de código sólo aparece **después** de credenciales válidas, así que el mensaje
  de error de esta pantalla se limita al código. Cuando el código se agota, se
  vuelve a IN-1 con el mensaje genérico.

| Estado | Qué se ve |
| --- | --- |
| **Vacío** | Campo vacío, foco puesto en él automáticamente |
| **Cargando** | "Verificando…" en el botón |
| **Error** | `Ese código no coincide. Probá con el que muestra la app ahora.` Tras 3 intentos: `Probamos tres veces. Te conviene esperar al próximo código o usar uno de respaldo.` con los dos enlaces de salida más visibles |
| **Parcial** | Sin conexión: `No hay conexión. El código no se puede verificar sin señal — el que tenés en la app sigue sirviendo cuando vuelva.` |
| **Éxito** | Al portal |

---

### IN-3 · Ingresos pausados (bloqueo por intentos) — CA-09, CA-36, CA-37

**El problema.** Esta es la pantalla más peligrosa de la feature para nuestra
audiencia. Un cliente con una intimación con plazo, o un abogado con una
audiencia, que lee "tu cuenta fue bloqueada" a las 11 de la noche, entiende que
lo echaron. Y puede no haber hecho nada: alcanza con que un tercero tipee mal su
contraseña cinco veces (dictamen §4.2, recaudo A-1).

**Dos mensajes distintos, y la diferencia es de seguridad, no de tono.**

**(a) En pantalla, a quien está tipeando** — que puede ser un atacante. No puede
confirmar que la cuenta existe (R2), así que el mensaje se refiere a los
intentos, no a la cuenta:

```
┌──────────────────────────────────────────────────┐
│  Mejorar                                         │
├──────────────────────────────────────────────────┤
│▍⚑ Pausamos los intentos por un rato              │  PanelSemantico atencion
│▍                                                 │  (NO problema: no es una
│▍ Hubo varios intentos seguidos de entrar desde   │   falla del sistema)
│▍ acá. Para proteger las cuentas, esperamos       │
│▍ {DURACIÓN BLOQUEO} antes de aceptar otro.       │
│▍                                                 │
│▍ Vas a poder intentar de nuevo a las 21:14.      │  hora absoluta,
│▍                                                 │  NUNCA cuenta regresiva
│▍ Si la cuenta es tuya, no tenés que esperar:     │
│▍ cambiá la contraseña y entrás enseguida.        │
│▍                                                 │
│▍ [ Cambiar mi contraseña ahora ]                 │  primario, SIEMPRE
│▍                                                 │  habilitado (CA-36)
│▍ Esto no significa que tu cuenta esté en riesgo. │
│▍ A veces es alguien que se equivoca de correo.   │
└──────────────────────────────────────────────────┘
```

**(b) Por correo, al dueño real** — ahí sí se puede hablar de su cuenta. Texto
completo en §7, plantilla `CO-4`.

**Decisiones:**
- El título **no contiene la palabra "bloqueada"**, ni "suspendida", ni
  "inhabilitada". Dice qué pasó (pausamos los intentos) y es literalmente cierto.
- **Hora absoluta, no cuenta regresiva.** El reloj de arena y la cuenta regresiva
  están prohibidos (sistema de diseño §6.3.4) y acá además serían crueles.
- **El botón de recuperar contraseña es primario y funciona**: es la traducción
  visible de CA-36. No hay ninguna combinación de estados en la que quede
  deshabilitado.
- El parámetro `{DURACIÓN BLOQUEO}` y el umbral son de producto (CA-37): la
  pantalla los lee, no los fija.

| Estado | Qué se ve |
| --- | --- |
| **Vacío** | No aplica |
| **Cargando** | No aplica: es una respuesta, no una consulta |
| **Error** | Si la propia recuperación falla: `problema` con reintento, y el texto agrega el canal de contacto — **es el único punto de esta feature donde un usuario legítimo puede quedar realmente afuera**, así que ahí sí aparece {CANAL DE CONTACTO} |
| **Parcial** | Pasó la hora pero el reloj del teléfono está desfasado: si el servidor sigue rechazando, el mensaje se re-renderiza con la nueva hora en vez de decir "error" |
| **Éxito** | Pasada la ventana, IN-1 normal, sin rastro ni marca en la cuenta |

---

### RE-1 a RE-3 · Recuperar la contraseña

**RE-1 · Pedido.** Un campo, el correo, y una nota: "Te mandamos un enlace para
poner una contraseña nueva. Vale {VIGENCIA RECUPERACIÓN} y se usa una sola vez."
La respuesta es **siempre la misma** (CA-15) y es la pantalla AL-4 con otro
título: `Revisá tu correo`.

**RE-2 · Contraseña nueva.**

```
│ Poné una contraseña nueva                        │
│                                                  │
│ Contraseña nueva                     Obligatorio │
│ ┌────────────────────────────────────┐ ┌───────┐ │
│ └────────────────────────────────────┘ │  Ver  │ │
│ Al menos 10 caracteres.                          │
│                                                  │
│▍ℹ Cuando la cambies, se cierran todas las        │  aviso ANTES, no después
│▍  sesiones abiertas: vas a tener que entrar de   │  (CA-16)
│▍  nuevo en el teléfono y en la computadora.      │
│                                                  │
│ [ Guardar la contraseña nueva ]                  │
```

El aviso de cierre de sesiones va **antes** de guardar. Enterarse después de que
te echaron de todos lados es exactamente el tipo de sorpresa que esta audiencia
lee como "algo salió mal".

**RE-3 · Enlace vencido o usado (CA-17).** Mismo patrón que AL-5: `Este enlace
ya no sirve.` + "Los enlaces para cambiar la contraseña valen {VIGENCIA
RECUPERACIÓN} y se usan una sola vez." + botón primario `Mandarme uno nuevo`.

| Estado (RE-2) | Qué se ve |
| --- | --- |
| **Vacío** | Campo vacío, con el aviso de cierre de sesiones ya visible |
| **Cargando** | "Guardando…" en el botón |
| **Error** | Contraseña corta: `Te faltan 3 caracteres.` Contraseña en listas filtradas: `Esa contraseña aparece en listas de contraseñas robadas que circulan por internet. No es culpa tuya: son millones. Probá con una frase que te acuerdes.` — **el motivo exacto, sin humillar** (CA-03) |
| **Parcial** | Sin conexión: no se puede guardar. "Necesitamos conexión para cambiar la contraseña. El enlace sigue valiendo hasta las {hora}." |
| **Éxito** | `Listo. Ya podés entrar con la contraseña nueva.` + `Entrar`. Y se manda el correo de aviso (CA-16, plantilla CO-5) |

---

### RE-4 · Perdí mi segundo factor — CA-35

**Propósito.** Que alguien que se quedó sin segundo factor sepa, en treinta
segundos, que tiene salida, que es humana, y cuánto tarda.

**Lo que este documento NO define** (y no puede): qué documentación se pide, con
qué base legal y cómo se destruye. Eso es la condición C-002-12 y está en
definición. Lo que sí se diseña es el punto de entrada, la expectativa y **los
huecos donde ese contenido tiene que entrar**, para que no se improvise en un
correo de soporte.

```
┌──────────────────────────────────────────────────┐
│ ←  Recuperar el acceso                           │
├──────────────────────────────────────────────────┤
│ Probemos las dos salidas rápidas primero         │  h1
│                                                  │
│ ┌──────────────────────────────────────────────┐ │
│ │ Tengo un código de respaldo              ›   │ │  tarjeta
│ │ Son los 8 códigos que guardaste cuando       │ │
│ │ activaste el segundo factor.                 │ │
│ └──────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────┐ │
│ │ Tengo la app en otro dispositivo         ›   │ │
│ │ Si la instalaste en más de un teléfono o en  │ │
│ │ la computadora, el código es el mismo.       │ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ ── Si ninguna de las dos te sirve ────────────── │
│                                                  │
│▍⚑ Esto lo resuelve una persona                   │  PanelSemantico atencion
│▍                                                 │
│▍ Sacarte el segundo factor no puede ser          │
│▍ automático: si lo fuera, sería una puerta de    │
│▍ atrás al mismo candado que te protege. Alguien  │
│▍ de nuestro equipo tiene que asegurarse de que   │
│▍ sos vos.                                        │
│▍                                                 │
│▍ Cuánto tarda: {PLAZO RESTITUCIÓN}. Te           │
│▍ contestamos al correo de tu cuenta.             │
│▍                                                 │
│▍ Qué te vamos a pedir:                           │
│▍ {DOCUMENTACIÓN — PENDIENTE C-002-12}            │
│▍                                                 │
│▍ Quién lo ve: {QUIÉN}.                           │
│▍ Cuánto lo guardamos: {PLAZO}, y después se      │
│▍ borra. Queda sólo el registro de que la         │
│▍ verificación se hizo y quién la hizo.           │
│▍                                                 │
│▍ [ Pedir ayuda para recuperar el acceso ]        │
└──────────────────────────────────────────────────┘
```

**Por qué los tres últimos huecos están en la pantalla y no en una política.**
Porque le vamos a pedir a una persona una foto de su documento. Si no le decimos
en el mismo lugar quién la mira y cuándo se borra, estamos pidiendo un dato
sensible a cambio de nada. Que los huecos estén visibles obliga a llenarlos antes
de implementar.

| Estado | Qué se ve |
| --- | --- |
| **Vacío** | Las dos salidas rápidas + el bloque humano. **Siempre las tres opciones**, aunque la persona no tenga códigos de respaldo: no sabemos qué tiene |
| **Cargando** | Al enviar el pedido: "Enviando el pedido…" |
| **Error** | `No pudimos registrar el pedido. Escribinos a {CANAL DE CONTACTO} contando que perdiste el segundo factor.` — **siempre hay un canal humano de último recurso** |
| **Parcial** | Pedido ya abierto: `Ya tenemos un pedido tuyo del {fecha}. Lo estamos mirando. Si querés agregar algo, respondé el correo que te mandamos.` — sin duplicar el trámite |
| **Éxito** | `Pedido registrado el {fecha} a las {hora}.` + "Te vamos a escribir a {correo enmascarado} dentro de {PLAZO RESTITUCIÓN}. No hace falta que insistas: si nos pasamos del plazo, se escala solo." |

---

## 4. Pantallas del cliente

Tono: contención y claridad. `texto.base` mínimo, una tarjeta por bloque.

### CL-1 · Falta confirmar tu correo

Estado `NO_VERIFICADA` con credenciales válidas. **No es un error, es un
pendiente.**

> **Falta un paso: confirmar tu correo.**
> Te mandamos un mensaje a juan\*\*\*@gmail.com cuando creaste la cuenta. Abrilo y
> tocá el botón, y ya está.
> Mientras tanto no podés usar la app, para que nadie pueda abrir una cuenta con
> un correo que no es suyo.
> Si no lo encontrás, te mandamos otro.
> `[ Mandarme el correo de nuevo ]` · `Escribí mal el correo ›`

Y, abajo, la consecuencia de CA-28 dicha sin amenazar:

> Si no la confirmás, borramos la cuenta y todo lo que cargaste a los
> {RETENCIÓN NO VERIFICADA}. No queda nada guardado.

Eso no es una amenaza: es una **buena noticia** para alguien que teme que sus
datos queden dando vueltas, y hay que escribirlo como tal.

| Estado | Qué se ve |
| --- | --- |
| **Vacío** | Es el estado en sí |
| **Cargando** | Botón "Mandando…" |
| **Error** | "No pudimos mandarlo. Probá de nuevo en un minuto." |
| **Parcial** | No aplica |
| **Éxito** | Texto en la propia pantalla, `aria-live`: "Listo, lo mandamos de nuevo." |

---

### CL-2 · Ofrecemos el segundo factor (CA-39, recaudo B-1)

**Propósito.** Que el cliente pueda activar el segundo factor **desde el día
uno** sin que la oferta se sienta una imposición ni un susto.

**Dónde y cuándo aparece:**

| Momento | Forma |
| --- | --- |
| Primer ingreso, después de confirmar el correo | Pantalla completa, **una sola vez** |
| Perfil → "Seguridad de tu cuenta" | Siempre disponible, primer ítem de la sección |
| A los 30 días, si no lo activó | Una tarjeta en el perfil, **no una pantalla completa**, y no vuelve a proponerse sola nunca más *(cadencia propuesta, ver `[ESCALAMIENTO-F]`)* |

```
┌──────────────────────────────────────────────────┐
│  Antes de empezar                                │
├──────────────────────────────────────────────────┤
│ ¿Querés sumar un código además de la             │  h1, texto.2xl
│ contraseña?                                      │
│                                                  │
│ Es un código de 6 números que cambia solo, en    │  texto.base
│ una app del teléfono. Cuando entrés, te vamos a  │
│ pedir la contraseña y ese código.                │
│                                                  │
│ Para qué sirve: si alguien averigua tu           │
│ contraseña, igual no puede entrar, porque el     │
│ código lo tenés sólo vos.                        │
│                                                  │
│ Tarda unos 3 minutos y se puede sacar después.   │
│                                                  │
│ [        Activarlo ahora        ]                │  primario
│ [        Ahora no               ]                │  secundario, MISMO tamaño
│                                                  │
│ Podés activarlo cuando quieras desde tu perfil.  │  sin culpa, sin "¿seguro?"
└──────────────────────────────────────────────────┘
```

**Prohibido en esta pantalla**, y es lo que la distingue de cómo lo hace todo el
mercado:
- "Ahora no" **no** es un enlace chiquito gris. Es un botón secundario del mismo
  ancho y la misma altura.
- **No hay segundo diálogo de confirmación** del tipo "¿Estás seguro de dejar tu
  cuenta desprotegida?". Eso es culpa fabricada.
- **No se dice "tu cuenta está en riesgo"** ni se muestra un indicador de
  seguridad en rojo/amarillo en el perfil de quien no lo activó. El cliente no
  tiene por qué cargar con un estigma por ejercer una opción que le dimos.
- Se dice **cuánto tarda** y que **se puede sacar después**. Las dos cosas
  bajan la barrera real.

| Estado | Qué se ve |
| --- | --- |
| **Vacío** | Es el estado en sí |
| **Cargando** | No aplica: es estática |
| **Error** | No aplica |
| **Parcial** | Si ya lo tenía activo (por ejemplo, reinstaló la app), no se muestra |
| **Éxito** | "Ahora no" → al portal, sin marca de nada. "Activarlo ahora" → CL-3 |

---

### CL-3 · Activar el segundo factor (tres pasos)

Una decisión por pantalla.

**Paso 1 — Instalar la app.** Qué app, dónde bajarla, cuánto pesa (importa en
datos medidos). Salida: "Ya la tengo instalada".

**Paso 2 — Vincular.** Código QR **y** el código en texto, siempre los dos: en
un teléfono de gama baja escanear el QR de la misma pantalla del teléfono no se
puede hacer, y hay que copiar el texto. El sistema de diseño no permite que la
información dependa de una sola forma de entrega, y acá se aplica literal.

**Paso 3 — Guardar los códigos de respaldo.**

```
│▍⚑ Guardá estos 8 códigos                         │
│▍                                                 │
│▍ Si perdés el teléfono, con uno de estos entrás. │
│▍ Cada uno se usa una sola vez.                   │
│▍                                                 │
│▍  4821-9930     7716-2048                        │  fuente.numeros
│▍  1093-4471     6624-8815                        │  tabular, seleccionable
│▍  3350-7729     9902-1163                        │
│▍  5587-0412     2274-6698                        │
│▍                                                 │
│▍ [ Copiar los 8 códigos ]  [ Descargar ]         │
│▍                                                 │
│▍ Guardalos donde no sea el mismo teléfono: un    │
│▍ papel en un cajón sirve, y sirve bien.          │
│                                                  │
│ ┌──┐ Ya los guardé                               │  casilla obligatoria
│ └──┘                                             │
│ [ Terminar ]                                     │
```

"Un papel en un cajón sirve, y sirve bien" es deliberado: le da permiso a una
solución que la persona puede ejecutar de verdad, en vez de mandarla a un gestor
de contraseñas que no tiene.

| Estado | Qué se ve |
| --- | --- |
| **Vacío** | Paso 1, sin nada completado |
| **Cargando** | Generación del vínculo: esqueleto en el lugar del QR, no spinner de página |
| **Error** | Código incorrecto en la verificación: `Ese código no coincide. Fijate que la hora del teléfono esté en automático: si está atrasada, los códigos no coinciden.` — **la causa real y frecuente, no "código inválido"** |
| **Parcial** | Abandona en el paso 2: **el segundo factor no queda activado**. Al volver: "Habías empezado a activar el código. Empezamos de nuevo desde el vínculo, así no te queda a medias." |
| **Éxito** | `Listo. La próxima vez que entres te vamos a pedir el código.` Sin celebración |

---

### CL-4 · Sacar el segundo factor (CA-39, recaudo B-3)

Sólo cliente. Exige reautenticación fuerte (contraseña **y** un código vigente)
antes de mostrar el botón, y lo dice:

> **Para sacar el código de seguridad necesitamos que vuelvas a entrar.**
> Es para que, si alguien te dejó la sesión abierta en un dispositivo, no pueda
> sacarlo sin saber tu contraseña.

Después de sacarlo: correo de aviso (plantilla CO-8) y una línea en la pantalla:
"Lo sacamos el {fecha}. Podés volver a activarlo cuando quieras." **Sin
advertencia de riesgo, sin ícono de alarma.**

| Estado | Qué se ve |
| --- | --- |
| **Vacío** | No aplica |
| **Cargando** | "Sacando el código…" |
| **Error** | `La contraseña no coincide.` / `El código no coincide.` Por separado, porque acá ya está autenticado y no hay enumeración que proteger |
| **Parcial** | Reautenticó pero falla el guardado: el segundo factor **queda activo** y se dice: "No pudimos sacarlo. Sigue activo. Probá de nuevo." Nunca un estado ambiguo |
| **Éxito** | Confirmación en pantalla + correo |

---

### CL-5 · Dónde está abierta tu cuenta (CA-13, CA-14)

**Propósito.** Que una persona sin ningún conocimiento de seguridad informática
entienda qué son las sesiones y pueda cerrar la que no reconoce.

**La palabra "sesión" no se usa en el título.** Se usa "dónde está abierta tu
cuenta", que es lo que significa.

```
┌──────────────────────────────────────────────────┐
│ ←  Dónde está abierta tu cuenta                  │
├──────────────────────────────────────────────────┤
│ Esta es la lista de los teléfonos y las          │  texto.base
│ computadoras donde tu cuenta está abierta        │
│ ahora. Si hay algo que no reconocés, cerralo.    │
├──────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────┐ │
│ │ Este teléfono                                │ │  título texto.xl
│ │ Android · Buenos Aires (aproximado)          │ │
│ │ Abierta desde el 14/03 · Usándose ahora      │ │
│ └──────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────┐ │
│ │ Una computadora con Windows                  │ │
│ │ Navegador Chrome · Córdoba (aproximado)      │ │
│ │ Abierta desde el 02/03 · Última vez: ayer    │ │
│ │ a las 19:40                                  │ │
│ │                                              │ │
│ │ [ Cerrar esta ]                              │ │  secundario, 48px
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ [ Cerrar todas menos esta ]                      │  secundario
├──────────────────────────────────────────────────┤
│▍ℹ Sobre la ubicación                             │
│▍ La sacamos de la conexión a internet, no del    │
│▍ GPS. Por eso puede mostrar una ciudad cercana   │
│▍ y no la tuya: eso es normal y no significa que  │
│▍ alguien entró.                                  │
│▍                                                 │
│▍ Guardamos esto {RETENCIÓN SESIÓN CERRADA}       │
│▍ después de cerrar la sesión, y después se       │
│▍ borra.                                          │
├──────────────────────────────────────────────────┤
│ Si no reconocés algo, cerralo y cambiá tu        │
│ contraseña.  [ Cambiar mi contraseña ]           │
└──────────────────────────────────────────────────┘
```

**Decisiones:**
- La aclaración sobre la ubicación aproximada es obligatoria y va **en la
  pantalla**, no en un tooltip: sin ella, ver "Córdoba" cuando estás en Rosario
  genera un pánico injustificado, y esta audiencia no necesita otro susto.
- Nunca se muestra la IP en crudo al cliente. Al abogado y al administrador, sí
  (§5, §6): la necesitan y la entienden.
- "Cerrar todas menos esta" existe porque es lo que la gente quiere hacer cuando
  algo la asusta, y si no está, cierra una por una y se equivoca.
- La acción de cerrar **pide confirmación en línea**, no en modal: "Si cerrás
  esta, en esa computadora va a tener que entrar de nuevo con la contraseña.
  `[Sí, cerrarla]` `[No]`".

| Estado | Qué se ve |
| --- | --- |
| **Vacío** | Sólo la sesión actual: `EstadoVacio` → "Tu cuenta está abierta sólo acá, en este teléfono. Cuando entres desde otro lado, lo vas a ver en esta lista." **No es una pantalla en blanco** |
| **Cargando** | `Esqueleto` con la forma de dos tarjetas de sesión, a los 300ms |
| **Error** | `problema`: "No pudimos traer la lista. Tu cuenta sigue abierta normalmente." + `Reintentar`. **Se aclara que no pasó nada con la cuenta**: el error de esta pantalla asusta más que cualquier otro |
| **Parcial** | Se listan las sesiones pero no se resolvió la ubicación de alguna: la tarjeta dice "Ubicación no disponible" en vez de omitir la fila. Nunca se inventa una ciudad |
| **Éxito** | Al cerrar: la tarjeta desaparece con `mov.normal` y aparece, en la propia pantalla, "Cerramos la sesión de la computadora con Windows." (`aria-live="polite"`, sin toast) |

**Offline.** La lista se muestra desde caché con `BandaConexion` en modo "Datos
viejos". **Los botones de cerrar quedan deshabilitados con el motivo visible**:
"Para cerrar una sesión hace falta conexión: la orden tiene que llegar al
servidor para que valga." No se encola (sistema de diseño §9.5): una sesión que
el usuario cree cerrada y no lo está es peor que no poder cerrarla.

---

### CL-6 · Tu perfil (CA-23, CA-25)

Secciones, en este orden: **Tus datos** · **Seguridad de tu cuenta** · **Tus
datos y vos**.

| Sección | Contenido |
| --- | --- |
| Tus datos | Nombre para mostrar (editable), correo (editable con reconfirmación), {CUIT/CUIL si finalmente se pide: **no editable**, con el camino de corrección — ver `[ESCALAMIENTO-B]`} |
| Seguridad de tu cuenta | Código de seguridad (CL-2/CL-3/CL-4) · Cambiar contraseña · Dónde está abierta tu cuenta (CL-5) |
| Tus datos y vos | "Descargar todo lo que tenemos tuyo" (CA-25) · "Leer la política de privacidad" · "Cancelar mi suscripción" (003) |

**Descargar mis datos (CA-25)** — el texto importa porque fija expectativas:

> **Descargar todo lo que tenemos tuyo**
> Te preparamos un archivo con tus datos de la cuenta y con la lista de tus
> ingresos: fechas, dispositivos y ubicaciones aproximadas.
> No incluye tu contraseña — la guardamos de una forma en la que ni nosotros
> podemos leerla — ni las claves internas de tu sesión, porque tenerlas escritas
> en un archivo sería un riesgo para vos.
> `[ Preparar mi archivo ]`

| Estado | Qué se ve |
| --- | --- |
| **Vacío** | Perfil recién creado: el nombre está, el resto de las secciones con su acción. Nunca campos vacíos sin explicar |
| **Cargando** | Esqueleto por sección |
| **Error** | Al guardar: "No pudimos guardar el cambio. Lo que escribiste sigue acá." — **el dato no se pierde** |
| **Parcial** | Correo cambiado y sin reconfirmar: chip `pendiente` **"Falta confirmar el correo nuevo"** junto al campo, y el correo viejo sigue funcionando hasta que se confirme |
| **Éxito** | "Guardado." en línea, junto al campo, `aria-live="polite"` |

---

### CL-7 · Quién lleva tu caso — la ficha del abogado (M-6)

**Propósito.** Mostrarle al cliente quién es el abogado asignado sin que la
plataforma afirme algo que no puede sostener.

> **El problema.** "Abogado verificado ✓" es una afirmación de la plataforma al
> consumidor sobre una característica esencial del servicio (art. 4 y art. 40 de
> la Ley 24.240, dictamen §4.4). Es verdadera el día que se otorga y puede ser
> falsa al mes siguiente, porque la matrícula se suspende, se cancela o caduca en
> el colegio, sin que nos enteremos. **La plataforma no puede afirmar un estado
> presente; sólo puede informar un hecho pasado con su fecha.**

```
┌──────────────────────────────────────────────────┐
│ Quién lleva tu caso                              │
├──────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────┐ │
│ │ {Nombre del abogado}                         │ │  texto.xl
│ │                                              │ │
│ │ ✓ Matrícula verificada el 14/03/2026         │ │  ChipEstado confirmado
│ │                                              │ │  ícono + palabra
│ │ Matrícula 12.345 · Colegio Público de        │ │  texto.base
│ │ Abogados de la Capital Federal               │ │
│ │ Ejerce en: Ciudad Autónoma de Buenos Aires   │ │
│ │                                              │ │
│ │ ⌄ ¿Qué quiere decir "verificada"?            │ │  Acordeon
│ │                                              │ │
│ │   Quiere decir que el 14 de marzo de 2026    │ │
│ │   una persona de nuestro equipo miró la      │ │
│ │   constancia de matrícula del Colegio        │ │
│ │   Público de Abogados de la Capital Federal  │ │
│ │   y comprobó que el número existe y es de    │ │
│ │   esta persona.                              │ │
│ │                                              │ │
│ │   No quiere decir que la matrícula esté      │ │
│ │   vigente hoy mismo: eso lo lleva el         │ │
│ │   colegio, no nosotros. Volvemos a           │ │
│ │   verificarla cada {VIGENCIA VERIFICACIÓN}.  │ │
│ │                                              │ │
│ │   Podés consultar la matrícula vos mismo en  │ │
│ │   el colegio: {CÓMO}.                        │ │
│ └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

**El microcopy exacto, por estado de la matrícula:**

| Estado | Chip (cliente) | Línea de detalle (cliente) |
| --- | --- | --- |
| Verificada y vigente | `Matrícula verificada el 14/03/2026` | "Volvemos a verificarla cada {VIGENCIA VERIFICACIÓN}." |
| Verificada, vigencia vencida (CA-29) | `Matrícula verificada el 14/03/2026` (mismo chip, sin alarma) | "Nos toca volver a verificarla: la última vez fue el 14/03/2026 y ya se cumplió el plazo que nos pusimos. **Tu caso sigue igual.** Mientras la renovamos no le asignamos casos nuevos." |
| Suspendida por el administrador (CA-30) | `Matrícula en revisión` (`pendiente`) | "Estamos revisando una novedad sobre la matrícula. Mientras tanto, {QUÉ PASA CON EL CASO — ver `[ESCALAMIENTO-C]`}." |
| Pendiente de verificación (CA-05) | **No se muestra ningún abogado.** Una cuenta pendiente no puede tener casos asignados, así que esta ficha no existe para ese abogado | — |

**Prohibido, en todo el producto:**
- `Abogado verificado` · `Profesional verificado` · `✓ Verificado` a secas
- Cualquier sello, insignia o escudo de verificación sin fecha adosada
- Presentar la fecha en `texto.xs` o en un tooltip: **la fecha tiene el mismo
  cuerpo que la palabra "verificada"**, siempre, en las tres audiencias

| Estado | Qué se ve |
| --- | --- |
| **Vacío** | Sin abogado asignado todavía: "Todavía no te asignamos un abogado. Cuando lo hagamos, vas a ver acá quién es y desde cuándo." |
| **Cargando** | Esqueleto de la tarjeta |
| **Error** | "No pudimos traer los datos del abogado. Tu caso sigue igual." + reintento |
| **Parcial** | Falta la jurisdicción o el colegio en el registro: se muestra lo que hay y se **omite** la línea faltante; nunca "—" ni "No disponible" en un dato de habilitación profesional |
| **Éxito** | La tarjeta completa |

---

## 5. Pantallas del abogado

Tono: impersonal, denso, con fechas. `texto.sm` de cuerpo, tabla donde
corresponda. **El abogado no necesita que lo contengan: necesita saber cuándo.**

### AB-1 · Tu cuenta está en revisión (CA-05, CA-31)

```
┌────────────────────────────────────────────────────────────────────┐
│  Mejorar · Portal profesional                    {Nombre}  ▾       │
├────────────────────────────────────────────────────────────────────┤
│▍⏳ Matrícula pendiente de verificación                             │  pendiente
│▍                                                                   │
│▍ Enviada: 14/03/2026 10:22                                         │
│▍ Matrícula 12.345 · CPACF · CABA                                   │
│▍ Constancia adjunta: credencial_cpacf.pdf                          │
│▍                                                                   │
│▍ Plazo de revisión: {PLAZO REVISIÓN} hábiles → vence el 21/03/2026 │
│▍ Si el 21/03 no tenés respuesta, el caso se escala automáticamente │  CA-31
│▍ a nuestro back-office y te avisamos por correo. No hace falta     │
│▍ que reclames.                                                     │
├────────────────────────────────────────────────────────────────────┤
│  Qué podés hacer ahora           │  Qué no, hasta la verificación  │
│  ─────────────────────────────── │  ────────────────────────────── │
│  · Activar el segundo factor     │  · Recibir casos                │
│    (obligatorio, hacelo ahora)   │  · Ver expedientes              │
│  · Completar especialidades      │  · Contactar clientes           │
│  · Cargar datos de facturación   │                                 │
├────────────────────────────────────────────────────────────────────┤
│ [ Activar el segundo factor ]   Cambiar la constancia   Cancelar   │
│                                                          el alta   │
└────────────────────────────────────────────────────────────────────┘
```

**Por qué las dos columnas.** El limbo se hace intolerable cuando no se sabe si
hay algo que hacer. Poner lado a lado lo habilitado y lo bloqueado convierte una
espera en una lista de tareas, y **elimina el reclamo por teléfono**, que es lo
que un abogado hace a las 48 horas.

**Por qué el segundo factor se ofrece acá.** Es obligatorio para operar (CA-38) y
la espera es tiempo muerto. Hacerlo durante la revisión evita que el día que se
apruebe la matrícula tenga que hacer un trámite más antes de empezar.

| Estado | Qué se ve |
| --- | --- |
| **Vacío** | No aplica: siempre hay al menos la solicitud |
| **Cargando** | Esqueleto del panel de estado |
| **Error** | `problema`: "No pudimos traer el estado de tu verificación. Tu solicitud del 14/03 sigue en pie." + reintento |
| **Parcial** | Falta la constancia (llegó por AL-3b sin archivo): el panel pasa a `atencion` — "La revisión no arrancó: falta la constancia. `[Adjuntar ahora]`". **El plazo no corre hasta que esté**, y se dice |
| **Éxito** | Verificada → el panel pasa a `confirmado`: "Matrícula verificada el 18/03/2026 contra la constancia del CPACF. Válida hasta el 18/03/2027." + `[Entrar al portal]` |

**Y el estado que casi nadie diseña — el plazo vencido (CA-31):**

```
│▍⚑ Nos pasamos del plazo                                            │  atencion
│▍ Nos habíamos puesto {PLAZO REVISIÓN} hábiles y vencieron el 21/03.│
│▍ Ya está escalado a nuestro back-office; lo está mirando una       │
│▍ persona. Te escribimos apenas haya una respuesta.                 │
│▍ Si preferís hablarlo: {CANAL DE CONTACTO}.                        │
```

Sin disculpa vacía, sin "perdón por las molestias": se nombra el hecho, quién lo
tiene y qué sigue. Es lo que el abogado necesita, y es lo que el art. 8 bis
convierte en obligación de trato digno.

---

### AB-2 · El segundo factor del abogado es obligatorio (CA-38)

**El problema.** Imponer sin explicar es lo que hace que una medida de seguridad
se sienta un capricho de la plataforma. Y en este caso hay una razón que el
abogado **ya conoce y comparte**: el secreto profesional es una obligación suya,
no nuestra.

```
┌────────────────────────────────────────────────────────────────────┐
│  Segundo factor de autenticación — obligatorio                     │
├────────────────────────────────────────────────────────────────────┤
│▍ℹ Por qué no es opcional para tu rol                               │  informativo
│▍                                                                   │
│▍ Con tu cuenta se accede a los expedientes de todos los clientes   │
│▍ que tengas asignados. Esa información está alcanzada por el       │
│▍ secreto profesional, que es una obligación tuya frente a tus      │
│▍ clientes y frente al colegio, no nuestra.                         │
│▍                                                                   │
│▍ Una contraseña sola no la sostiene: si se filtra en cualquier     │
│▍ otro sitio donde la hayas usado, se expone toda tu cartera de     │
│▍ una vez. Por eso el segundo factor es condición para operar.      │
│▍                                                                   │
│▍ Se puede cambiar de dispositivo cuando quieras. No se puede       │
│▍ desactivar mientras tengas casos.                                 │
├────────────────────────────────────────────────────────────────────┤
│ [ Configurar el segundo factor ]                                   │
│                                                                    │
│ Guardá los códigos de respaldo: si perdés el teléfono y no los     │
│ tenés, la restitución la hace una persona y tarda                  │
│ {PLAZO RESTITUCIÓN}. Ese día no vas a poder trabajar.              │  ← honesto
└────────────────────────────────────────────────────────────────────┘
```

Esa última frase es deliberadamente cruda. Al abogado hay que decirle la
consecuencia operativa, no tranquilizarlo: es lo único que hace que guarde los
códigos de respaldo de verdad.

| Estado | Qué se ve |
| --- | --- |
| **Vacío** | Es el estado en sí, al primer ingreso |
| **Cargando** | Esqueleto del bloque de vínculo |
| **Error** | Igual que CL-3, con la pista del reloj desfasado |
| **Parcial** | Configuración a medias: no queda activo, y el portal sigue mostrando AB-2 al entrar. No hay forma de saltearlo |
| **Éxito** | "Segundo factor activo desde el 14/03/2026 10:40." Al portal |

---

### AB-3 · Perfil profesional (CA-24)

Tabla de dos columnas, densa. **Lo que el abogado ve de su propia matrícula:**

```
│ Matrícula          12.345            No editable                   │
│ Colegio            CPACF             No editable                   │
│ Jurisdicción       CABA              No editable                   │
│ Estado             ✓ Verificada el 18/03/2026                      │
│                      contra: constancia CPACF del 12/03/2026       │
│                      verificó: {nombre del administrador}          │
│                      válida hasta: 18/03/2027                      │
│                      [ Renovar la verificación ]                   │
│ Especialidades     Ejecuciones · Consumidor · Concursos  [Editar]  │
```

- "No editable" lleva al lado el camino: "Para cambiar la matrícula hay que
  verificarla de nuevo. `[Pedir cambio de matrícula]`". **Un campo no editable
  sin camino de cambio es un callejón** (dictamen D-002-04).
- El abogado ve **quién** lo verificó y **contra qué**. Es transparencia hacia el
  profesional sobre una decisión que lo afecta, y es el mismo dato que la
  bitácora guarda.
- `[Renovar la verificación]` aparece desde 30 días antes del vencimiento, con:
  "Tu verificación vence el 18/03/2027. Subí una constancia actualizada y la
  revisamos antes de esa fecha, así no se te corta la asignación de casos
  nuevos."

| Estado | Qué se ve |
| --- | --- |
| **Vacío** | Especialidades sin cargar: "Sin especialidades declaradas. Se usan para asignarte casos." + `[Agregar]` |
| **Cargando** | Esqueleto de tabla |
| **Error** | Al guardar especialidades: mensaje en línea, sin perder lo escrito |
| **Parcial** | Verificación vencida: la fila Estado pasa a `atencion` — "Verificada el 18/03/2026. El plazo de 12 meses venció el 18/03/2027. **No se te asignan casos nuevos** hasta renovar; los que tenés siguen." (CA-29) |
| **Éxito** | Datos completos |

---

### AB-4 · Verificación rechazada

Nunca un "rechazado" seco:

> **No pudimos verificar la matrícula con lo que mandaste.**
> Revisado el 18/03/2026. Motivo: {motivo que escribió el administrador}.
> Qué podés hacer: subir otra constancia, o corregir el número si lo cargaste
> mal. La revisamos de nuevo dentro de {PLAZO REVISIÓN} hábiles.
> `[ Subir otra constancia ]` · `[ Corregir la matrícula ]` · Hablar con nosotros ›

El motivo lo escribe el administrador en AD-2 y es **campo obligatorio** ahí,
precisamente para que esta pantalla nunca esté vacía.

---

## 6. Pantallas del administrador

Tono: control y trazabilidad. Tabla densa + panel de detalle. Todo lo que hace
queda con su nombre, y la interfaz se lo recuerda donde corresponde.

### AD-1 · Matrículas pendientes de verificación (CA-22, CA-31)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Usuarios › Verificación de matrículas                                        │
├──────────┬───────────────────────────────────────────────────────────────────┤
│ FILTROS  │  Pendientes (7)   Vencen hoy (2)   Escaladas (1)   Verificadas    │
│          │ ┌───────────────────────────────────────────────────────────────┐ │
│ Estado   │ │ Espera │ Matrícula │ Colegio │ Jurisdic. │ Constancia │ Vence  │ │
│ ☑ Pend.  │ ├────────┼───────────┼─────────┼───────────┼────────────┼────────┤ │
│ ☐ Escal. │ │ 6 d ⚑  │ 12.345    │ CPACF   │ CABA      │ PDF        │ hoy    │ │
│ ☐ Verif. │ │ 4 d    │ 8.812     │ CASI    │ Bs. As.   │ JPG        │ 23/03  │ │
│          │ │ 2 d    │ 41.009    │ CPACF   │ CABA      │ —  sin     │ 25/03  │ │
│ Colegio  │ │        │           │         │           │ constancia │ (no    │ │
│ Jurisd.  │ │        │           │         │           │            │ corre) │ │
│          │ └───────────────────────────────────────────────────────────────┘ │
└──────────┴───────────────────────────────────────────────────────────────────┘
```

- La columna **Espera** es la primera, y la fila que superó el plazo lleva ícono
  `aviso` **y** el texto "escalada" — nunca sólo un color de fila.
- La fila sin constancia dice explícitamente "(no corre)": el plazo de CA-31 no
  corre si falta el insumo, y el administrador tiene que verlo para no
  perseguir un pendiente que no es suyo.
- Atajos `j`/`k`/`Enter` del sistema de diseño §4.4.

| Estado | Qué se ve |
| --- | --- |
| **Vacío** | `EstadoVacio`: "No hay matrículas esperando verificación." + "Las nuevas solicitudes aparecen acá y tienen {PLAZO REVISIÓN} hábiles de plazo." |
| **Cargando** | Esqueleto de 5 filas con la altura real (40px) |
| **Error** | Banda sobre la tabla: "No pudimos traer la lista (intento de las 10:32)." + `Reintentar`. La tabla anterior **queda visible** con su marca de dato viejo |
| **Parcial** | Filtro que no devuelve nada: "Ningún resultado con estos filtros." + `Limpiar filtros`. **Se distingue de la tabla vacía real** |
| **Éxito** | La tabla con su contador por pestaña |

---

### AD-2 · Decidir una verificación (CA-05, CA-22, salvaguarda M-1)

**Propósito.** Que sea imposible aprobar sin registrar contra qué se aprobó.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Matrícula 12.345 · CPACF · CABA                    En espera: 6 días ⚑       │
├──────────────────────────────────────────────────────────────────────────────┤
│ SOLICITANTE                    │ CONSTANCIA APORTADA                         │
│ {Nombre}                       │ ┌─────────────────────────────────────────┐ │
│ Cuenta creada 14/03/2026       │ │                                         │ │
│ Correo confirmado 14/03/2026   │ │   [vista previa del PDF]                │ │
│ 2º factor: activo desde 14/03  │ │                                         │ │
│                                │ └─────────────────────────────────────────┘ │
├────────────────────────────────┴─────────────────────────────────────────────┤
│ QUÉ VERIFICASTE — obligatorio para aprobar                                   │
│                                                                              │
│ Fuente de la verificación   ( ) Constancia aportada por el solicitante       │
│                             ( ) Padrón público del colegio                   │
│                             ( ) Consulta telefónica o por correo al colegio  │
│                             ( ) Otra: ______________________                 │
│                                                                              │
│ Colegio            [ Colegio Público de Abogados de la Capital Federal  ▾ ]  │
│ Número verificado  [ 12.345                                              ]   │
│ Fecha de la        [ 12/03/2026 ]   Fecha en que el colegio emitió o          │
│ constancia                           publicó lo que miraste                  │
│ Nombre en la       [ ......................... ]  ¿Coincide con el del        │
│ constancia                                        solicitante?  ( ) Sí ( ) No│
│ Observaciones      [                                                      ]  │
├──────────────────────────────────────────────────────────────────────────────┤
│ Si aprobás: la verificación queda con fecha de hoy (18/03/2026) y válida     │
│ hasta el 18/03/2027 ({VIGENCIA VERIFICACIÓN}). Después de esa fecha no se    │
│ le asignan casos nuevos hasta que se renueve.                                │
│                                                                              │
│ Esta decisión queda registrada con tu nombre, la fecha y todo lo que         │
│ cargaste arriba.                                                             │
│                                                                              │
│ [ Aprobar la verificación ]   [ Rechazar ]   Suspender de inmediato          │
└──────────────────────────────────────────────────────────────────────────────┘
```

- **`Aprobar` está deshabilitado hasta que los cinco campos de evidencia estén
  completos**, y el motivo se muestra al lado, en texto: "Faltan: fuente de la
  verificación, fecha de la constancia." (sistema de diseño §5.5: ningún botón
  deshabilitado queda gris y mudo).
- **`Rechazar` exige motivo** en texto libre, porque ese motivo es el que ve el
  abogado en AB-4. Placeholder: "Qué faltó o qué no coincidió. Lo va a leer el
  solicitante."
- El bloque "Si aprobás" **dice la consecuencia antes de la acción**, con la
  fecha de vencimiento ya calculada. Es lo que impide que la vigencia se
  convierta en una sorpresa doce meses después.
- La frase de auditoría es la neutralización del conflicto de interés que marca
  el dictamen §4.4: aprobar sin mirar deja rastro con nombre.

| Estado | Qué se ve |
| --- | --- |
| **Vacío** | Formulario de evidencia vacío, `Aprobar` deshabilitado con el motivo listado |
| **Cargando** | La vista previa del PDF con su propio esqueleto; los campos se pueden completar mientras carga |
| **Error** | No carga la constancia: "No pudimos mostrar el archivo. `[Descargarlo]` para verlo, o `[Reintentar]`." **No se puede aprobar sin haber podido ver la constancia**: si la fuente elegida es "constancia aportada" y el archivo no se pudo abrir, el botón sigue bloqueado |
| **Parcial** | Evidencia a medias, se sale de la pantalla: se guarda como borrador con su marca ("Borrador guardado 10:44"), **sin** aprobar nada |
| **Éxito** | "Verificación aprobada el 18/03/2026 10:47 por {vos}. Válida hasta el 18/03/2027." + el siguiente pendiente de la cola, con el foco puesto ahí |

---

### AD-3 · Suspender de inmediato (CA-30)

Acción destructiva: botón terciario, no primario, y confirmación con escritura
del motivo. Nunca en el flujo feliz.

> **Suspender la matrícula 12.345 en la plataforma**
> Efecto inmediato: {Nombre} deja de poder operar, **incluidos los casos que
> tiene en curso**. Sus clientes quedan sin abogado asignado hasta que alguien
> decida qué hacer con cada caso.
> Motivo (obligatorio): [ ........................ ]
> Origen de la novedad: ( ) Notificación del colegio ( ) Denuncia ( ) Otro
> Queda registrado con tu nombre y la fecha, y se le notifica a {Nombre}.
> `[ Suspender ahora ]` `[ Cancelar ]`

La frase "Sus clientes quedan sin abogado asignado" está ahí para que el
administrador entienda el costo sobre terceros antes de actuar. **Qué se hace
con esos casos no lo define esta feature** — `[ESCALAMIENTO-C]`.

---

### AD-4 · Crear una cuenta de administrador (CA-33, CA-34)

```
│ Nueva cuenta de administrador                                                │
│                                                                              │
│▍ℹ Las cuentas de administrador son de una persona, no de un equipo           │
│▍ La bitácora tiene que poder decir quién miró el expediente de quién. Una    │
│▍ cuenta compartida rompe eso y no sirve como prueba ante un reclamo.         │
│▍ No se aceptan correos genéricos (admin@, soporte@, sistemas@).              │
│                                                                              │
│ Nombre y apellido        [ ................................. ]  Obligatorio  │
│ Correo de la persona     [ ................................. ]  Obligatorio  │
│ Motivo del alta          [ ................................. ]  Obligatorio  │
│                                                                              │
│ La persona va a recibir un correo para poner su contraseña y va a tener      │
│ que configurar el segundo factor antes de entrar. No se puede desactivar.    │
│                                                                              │
│ Esta alta queda registrada con tu nombre y la fecha.                         │
│                                                                              │
│ [ Crear la cuenta ]                                                          │
```

Si el correo tipeado coincide con un patrón genérico, el error es específico y
educativo: `"admin@" es una cuenta de equipo. Poné el correo de la persona que
la va a usar: si mañana hay que saber quién hizo algo, tiene que haber un
nombre.`

**AD-5 · Nominalizar la cuenta de siembra (CA-34).** Al primer ingreso de la
cuenta sembrada, pantalla bloqueante, sin salteo:

> **Esta es la cuenta de instalación. Antes de seguir, ponele nombre.**
> Se creó con el despliegue del sistema y todavía no es de nadie. Todo lo que
> hagas desde ahora tiene que poder atribuirse a una persona.
> Nombre y apellido · Correo personal · Contraseña nueva
> Después de esto, la cuenta de instalación deja de existir como tal.
> `[ Hacerla mía ]`

| Estado (AD-4) | Qué se ve |
| --- | --- |
| **Vacío** | Formulario vacío con el bloque explicativo visible |
| **Cargando** | "Creando la cuenta…" |
| **Error** | Correo genérico (arriba) · correo ya usado: acá **sí se dice** que existe, porque quien opera ya es administrador y no hay enumeración que proteger: "Ya hay una cuenta con ese correo. {Nombre}, creada el 02/02/2026." |
| **Parcial** | Cuenta creada y falla el envío del correo: "La cuenta está creada pero no pudimos mandar el correo de bienvenida. `[Reenviarlo]`" — nunca se deja la cuenta en un estado que nadie ve |
| **Éxito** | "Cuenta creada el 18/03/2026 10:52. {Nombre} tiene que configurar el segundo factor antes del primer ingreso." |

---

### AD-6 · El segundo factor del administrador (CA-32)

En **Seguridad de tu cuenta** del administrador **no existe ningún interruptor
de apagado**. En su lugar:

```
│ Segundo factor          ✓ Activo desde el 02/02/2026                         │
│                         Obligatorio para este rol. No se puede desactivar.   │
│                         [ Cambiar de dispositivo ]  [ Ver códigos de respaldo]│
│                                                                              │
│▍ℹ Por qué                                                                    │
│▍ Con una cuenta de administrador se accede a la información de todas las     │
│▍ personas del sistema: clientes, abogados y expedientes. Si esta sesión se   │
│▍ compromete, se exponen todos a la vez, no uno.                              │
│▍ Por eso no hay una opción para apagarlo, ni para vos ni para nadie.         │
```

**"Cambiar de dispositivo" es la válvula de escape imprescindible.** Sin ella,
"no se puede desactivar" significa que un administrador que cambia de teléfono
queda afuera para siempre y termina en el circuito de CA-35 sin necesidad.

---

## 7. Microcopy — consolidado

### 7.1 Correos y notificaciones

Todos llevan: asunto sin alarma, un solo mensaje, **una acción**, y una línea
final de "si no fuiste vos". Ninguno usa signos de exclamación.

| # | Situación | Asunto | Cuerpo |
| --- | --- | --- | --- |
| CO-1 | Confirmación de alta (CA-01) | `Confirmá tu correo en Mejorar` | "Hola {nombre}: tocá el botón para terminar de abrir tu cuenta. El enlace vale {VIGENCIA ENLACE} y se usa una sola vez. **[Confirmar mi correo]** · Si no pediste esta cuenta, ignorá este mensaje: sin confirmar, la borramos a los {RETENCIÓN NO VERIFICADA} y no queda nada." |
| CO-2 | Alguien intentó registrarse con un correo que ya tiene cuenta (CA-02) | `Alguien intentó crear una cuenta con tu correo` | "Alguien puso tu correo en el formulario de alta de Mejorar. **Si fuiste vos:** ya tenés una cuenta. **[Entrar]** o **[Cambiar mi contraseña]** si no te acordás. **Si no fuiste vos:** no tenés que hacer nada. No creamos ninguna cuenta nueva y nadie vio tus datos." |
| CO-3 | Alguien intentó registrarse con un CUIT/CUIL ya registrado (CA-04) | `Alguien intentó crear una cuenta con tu CUIL` | Mismo patrón que CO-2. **Pendiente de que la spec declare si el CUIL se pide (`[ESCALAMIENTO-A]`)** |
| CO-4 | Bloqueo por intentos fallidos (CA-09, recaudo A-2) | `Pausamos los intentos de entrar a tu cuenta` | "Hubo 5 intentos de entrar a tu cuenta con una contraseña equivocada, en los últimos 15 minutos, desde {ubicación aproximada}. **Pausamos los intentos por {DURACIÓN BLOQUEO}: vas a poder entrar de nuevo a las 21:14.** No hace falta que esperes: si cambiás la contraseña, entrás enseguida. **[Cambiar mi contraseña]** · Si fuiste vos y te equivocaste, no pasó nada: la cuenta está bien y nadie entró. Si no fuiste vos, cambiá la contraseña igual." |
| CO-5 | Contraseña cambiada (CA-16) | `Cambiaste tu contraseña` | "Cambiaste la contraseña de tu cuenta el {fecha} a las {hora}. Cerramos todas las sesiones abiertas: vas a tener que entrar de nuevo en cada dispositivo. **Si no fuiste vos**, alguien tiene acceso a tu correo: escribinos ahora a {CANAL DE CONTACTO}." |
| CO-6 | Recuperación de contraseña (CA-15) | `Cambiá tu contraseña en Mejorar` | "Pediste cambiar tu contraseña. El enlace vale {VIGENCIA RECUPERACIÓN} y se usa una sola vez. **[Poner una contraseña nueva]** · Si no lo pediste, ignorá este mensaje: tu contraseña sigue siendo la misma." |
| CO-7 | Reutilización de token detectada (CA-11) | `Cerramos todas las sesiones de tu cuenta` | "Detectamos algo raro en una de las sesiones de tu cuenta y, por las dudas, las cerramos todas. **No perdiste nada**: entrá de nuevo con tu contraseña. Te recomendamos cambiarla. **[Entrar]** · Pasó el {fecha} a las {hora}." — **no se usa jerga: nunca "token", nunca "refresh", nunca "reutilización"** |
| CO-8 | Segundo factor activado / sacado | `Activaste el código de seguridad` / `Sacaste el código de seguridad` | "{Acción} el {fecha} a las {hora}. Si no fuiste vos, cambiá tu contraseña ahora: **[Cambiar mi contraseña]**" |
| CO-9 | Matrícula verificada (abogado) | `Verificamos tu matrícula` | "Verificamos la matrícula 12.345 el 18/03/2026 contra la constancia del CPACF del 12/03/2026. Ya podés operar. La verificación vale hasta el 18/03/2027; un mes antes te avisamos para renovarla." |
| CO-10 | Matrícula rechazada | `No pudimos verificar tu matrícula` | "Revisamos tu solicitud el 18/03/2026 y no pudimos verificarla. Motivo: {motivo}. Podés subir otra constancia o corregir el número: **[Ir a mi solicitud]**. La revisamos de nuevo dentro de {PLAZO REVISIÓN} hábiles." |
| CO-11 | Plazo de revisión vencido (CA-31) | `Nos pasamos del plazo para revisar tu matrícula` | "Nos habíamos puesto {PLAZO REVISIÓN} hábiles y vencieron el 21/03. Ya está escalado y lo está mirando una persona. Te escribimos apenas haya respuesta." |
| CO-12 | Verificación por vencer (CA-29) | `Tu verificación de matrícula vence el 18/03/2027` | "Para seguir recibiendo casos nuevos hace falta renovarla. Subí una constancia actualizada: **[Renovar]**. Los casos que ya tenés siguen igual en cualquier caso." |
| CO-13 | Suspensión (CA-30) | `Suspendimos tu matrícula en la plataforma` | "El {fecha} suspendimos tu matrícula en Mejorar. Motivo: {motivo}. Mientras tanto no podés operar. Si creés que hay un error, escribinos a {CANAL DE CONTACTO}: lo revisa una persona." |
| CO-14 | Alta de administrador (CA-34) | `Te crearon una cuenta de administrador en Mejorar` | "{Quién} creó una cuenta de administrador a tu nombre el {fecha}. Poné tu contraseña y configurá el segundo factor: **[Empezar]**. El segundo factor es obligatorio y no se puede desactivar." |

### 7.2 Errores de formulario — texto exacto

| Situación | Texto |
| --- | --- |
| Correo vacío | `Falta el correo.` |
| Correo mal escrito | `Ese correo no parece completo. Fijate que tenga @ y el punto del final.` |
| Contraseña corta | `Te faltan {n} caracteres.` |
| Contraseña en lista de filtradas (CA-03) | `Esa contraseña aparece en listas de contraseñas robadas que circulan por internet. No es culpa tuya: son millones. Probá con una frase que te acuerdes.` |
| Nombre vacío | `Falta el nombre. Puede ser sólo tu nombre de pila.` |
| Términos sin aceptar | `Para abrir la cuenta hace falta aceptar los términos. Si querés leerlos primero, están acá.` |
| Credenciales incorrectas | `El correo o la contraseña no coinciden.` |
| Código de 2º factor incorrecto | `Ese código no coincide. Probá con el que muestra la app ahora.` |
| Código vencido | `Ese código ya venció. Los códigos duran 30 segundos: probá con el que se ve ahora.` |
| Matrícula vacía | `Falta el número de matrícula.` |
| Archivo pesado | `El archivo pesa {n} MB y el máximo es 5 MB. Si es una foto, sacala de nuevo con menos calidad.` |
| Archivo de formato no aceptado | `Aceptamos JPG, PNG y PDF. Ese archivo es {formato}.` |
| Falla del sistema, genérica | `No pudimos {acción}. No perdiste nada de lo que cargaste. Probá de nuevo.` + `[Reintentar]` |
| Sin conexión al enviar | `No hay conexión. Guardamos lo que escribiste en este teléfono, menos la contraseña. Probá cuando vuelva la señal.` |

### 7.3 Palabras que usamos y las que no

| No decimos | Decimos | Por qué |
| --- | --- | --- |
| Tu cuenta fue bloqueada | Pausamos los intentos por un rato | "Bloqueada" suena definitivo y a castigo. Y hay salida inmediata |
| Credenciales inválidas | El correo o la contraseña no coinciden | Jerga |
| Autenticación de dos factores / 2FA / MFA | Código de seguridad · segundo factor (cliente: sólo "código de seguridad") | El cliente no sabe qué es un factor |
| Token / refresh token / sesión expirada | Tu cuenta se cerró sola por seguridad. Entrá de nuevo | Jerga |
| Verificación de identidad | Asegurarnos de que sos vos | "Verificación de identidad" activa la memoria de la ventanilla |
| Usuario | Tu correo · vos | "Usuario" es el lenguaje del sistema, no de la persona |
| Abogado verificado | Matrícula verificada el {fecha} | R4, salvaguarda M-6 |
| Cuenta no verificada | Falta confirmar tu correo | "No verificada" suena a sospecha sobre la persona |
| Registro / registrarse | Crear tu cuenta | "Registro" evoca padrón y fichero |
| Datos sensibles / tratamiento de datos | Tus datos · qué hacemos con tus datos | Art. 6 en lenguaje llano |
| Por razones de seguridad no podemos informarle | *(nunca)* | Es la frase que deja al usuario sin salida |
| ¿Estás seguro de dejar tu cuenta desprotegida? | *(nunca)* | Culpa fabricada, R6 |

---

## 8. Accesibilidad

### 8.1 Contrastes usados en estas pantallas

Todos los pares provienen de `tokens.md` versión 1. **No hace falta ningún token
nuevo.** Los seis pares nuevos se calcularon con la fórmula de `tokens.md` §0 y
se redondearon hacia abajo.

| # | Primer plano | Fondo | Ratio | Uso en esta feature | Umbral | ¿Pasa? |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `#1B2A33` | `#FFFFFF` | 14.73:1 | Cuerpo de todos los formularios | 4.5 | ✅ |
| 2 | `#4A5A66` | `#FFFFFF` | 7.13:1 | **Notas de campo del art. 6** | 4.5 (se le exige 7) | ✅ |
| 7 | `#0F5468` | `#FFFFFF` | 8.44:1 | "Me olvidé la contraseña", enlaces | 4.5 | ✅ |
| 8 | `#FFFFFF` | `#0F5468` | 8.44:1 | Botón primario | 4.5 | ✅ |
| 11 | `#0F5468` | `#E6F1F4` | 7.34:1 | Enlace a la política dentro del bloque art. 6 | 4.5 | ✅ |
| 12 | `#1B2A33` | `#E6F1F4` | 12.81:1 | **Cuerpo del bloque del art. 6** | **7.0** | ✅ |
| 13 | `#1B2A33` | `#FBF1DF` | 13.16:1 | Cuerpo de IN-3 (ingresos pausados) | 7.0 | ✅ |
| 15 | `#6B4708` | `#FBF1DF` | 7.41:1 | Chip del panel de atención | 4.5 | ✅ |
| 19 | `#3E4A7A` | `#ECEEF8` | 7.36:1 | Chip "Matrícula pendiente" | 4.5 | ✅ |
| 21 | `#1B2A33` | `#ECEEF8` | 12.74:1 | Cuerpo de AB-1 (cuenta en revisión) | 4.5 | ✅ |
| 22 | `#14603C` | `#E7F2EC` | 6.61:1 | Chip "Matrícula verificada el {fecha}" | 4.5 | ✅ |
| 25 | `#8C3A22` | `#FBEDE8` | 6.70:1 | Error del sistema | 4.5 | ✅ |
| 28 | `#6B7B86` | `#FFFFFF` | 4.37:1 | Borde de campo de texto | 3.0 | ✅ |
| 29 | `#5E6E79` | `#EDEFF1` | 4.58:1 | Botón "Mandarlo de nuevo" durante la espera | 4.5 | ✅ |
| **N1** | `#4A5A66` | `#E6F1F4` | **6.19:1** | Metadato dentro del bloque del art. 6 | 4.5 | ✅ |
| **N2** | `#4A5A66` | `#ECEEF8` | **6.16:1** | Metadato en el panel "en revisión" | 4.5 | ✅ |
| **N3** | `#5E6E79` | `#E6F1F4` | **4.58:1** | "Términos versión X" bajo la casilla | 4.5 | ✅ |
| **N4** | `#4A5A66` | `#E7F2EC` | **6.21:1** | "válida hasta {fecha}" en la ficha del abogado | 4.5 | ✅ |
| **N5** | `#1B2A33` | `#EDEFF1` | **12.78:1** | Vista previa de la constancia (AD-2) | 4.5 | ✅ |
| **N6** | `#0F5468` | `#ECEEF8` | **7.29:1** | Enlace dentro del panel "en revisión" | 4.5 | ✅ |

Los seis pares nuevos (N1–N6) son combinaciones de tokens existentes. Se
proponen para incorporarse a `tokens.md` §1.4 cuando ese documento vuelva a
abrirse; no se editó acá por el alcance del encargo (§11, `[ESCALAMIENTO-G]`).

### 8.2 Nada depende del color

| Estado | Color | Ícono | Texto |
| --- | --- | --- | --- |
| Campo obligatorio | — | — | La palabra **"Obligatorio"** al lado de la etiqueta |
| Campo con error | Borde `color.problema.borde` | `aviso` | El mensaje bajo el campo |
| Matrícula verificada | `confirmado` | `revisado` | "Matrícula verificada el 14/03/2026" |
| Matrícula pendiente | `pendiente` | `revision` | "Matrícula pendiente de verificación" |
| Matrícula escalada | `atencion` | `aviso` | "Escalada — venció el plazo el 21/03" |
| Ingresos pausados | `atencion` | `aviso` | "Pausamos los intentos por un rato" |
| Segundo factor activo | `confirmado` | `revisado` | "Activo desde el 02/02/2026" |

**La fila "Espera" de la tabla de AD-1 no se pinta**: lleva ícono y la palabra
"escalada". Una fila roja en una tabla densa es la forma más común de romper la
regla 6 del sistema de diseño.

### 8.3 Orden de foco en AL-2

```
1  Volver
2  Campo: Tu correo
3  Campo: Tu contraseña
4  Botón: Ver (contraseña)
5  Campo: Cómo querés que te llamemos
6  Región: "Qué hacemos con estos datos"   ← role="region", tabulable, aria-label
7  Enlace: Leer la política de privacidad completa
8  Casilla: Leí y acepto…
9  Enlace: Términos y condiciones
10 Enlace: Política de privacidad
11 Botón: Crear mi cuenta
12 Enlace: Ya tengo cuenta
13..15 Pie: Cancelar mi suscripción · Términos · Datos
```

El bloque del art. 6 **está en el orden de foco antes de la casilla de
aceptación**: quien navega con teclado o con lector de pantalla llega a la
información antes que al consentimiento, igual que quien mira la pantalla.

### 8.4 Lector de pantalla

| Elemento | Cómo se anuncia |
| --- | --- |
| Bloque del art. 6 | `role="region"` `aria-label="Qué hacemos con estos datos"`. Se anuncia como región navegable, no como texto suelto |
| "Obligatorio" | Parte de la etiqueta accesible del campo, no un `aria-required` mudo: se escucha "Tu correo, obligatorio, campo de texto" |
| Errores por campo | `aria-describedby` al campo + el resumen de arriba en `role="alert"` |
| Campo de contraseña | El botón "Ver" es `aria-pressed`, y al activarlo se anuncia "Contraseña visible / oculta". **Nunca se lee la contraseña en voz alta automáticamente** |
| Campo del código de 2º factor | `inputmode="numeric"` `autocomplete="one-time-code"`, etiqueta "Código de 6 números" |
| Chip de matrícula | Se lee completo: "Matrícula verificada el 14 de marzo de 2026". Nunca "verificado, tilde verde" |
| Lista de sesiones | Cada sesión es un `<li>` con encabezado propio; el botón de cerrar tiene `aria-label` "Cerrar la sesión de Una computadora con Windows, Córdoba" — **nunca sólo "Cerrar"** |
| Cuenta atrás de "Mandarlo de nuevo" | El botón deshabilitado anuncia el motivo: "Mandarlo de nuevo, no disponible, vas a poder pedirlo a las 21:14" |
| Confirmaciones | `aria-live="polite"` en el mismo lugar de la pantalla. Sin `toast` que desaparece |

### 8.5 Otros

- Toque mínimo 48×48 en móvil, 44×44 en web; la casilla de aceptación tiene
  área de 48px aunque el cuadro dibuje 24px, y **el texto de la casilla también
  la activa**.
- Zoom al 200% y fuente del sistema a 1.3× sin scroll horizontal. El bloque del
  art. 6 es el peor caso: se probó con 60 caracteres de ancho máximo.
- `lang="es-AR"`. `autocomplete` correcto en todos los campos de credenciales:
  sin él, los gestores de contraseñas no funcionan y la gente vuelve a usar la
  misma contraseña de siempre. Es accesibilidad **y** seguridad.
- El tiempo de espera de 60s para reenviar el correo no es un límite de sesión en
  el sentido de WCAG 2.2.1, pero igual se anuncia y el usuario nunca pierde
  contexto por su vencimiento.

---

## 9. Conexión pobre, offline y diferencias web / móvil

### 9.1 Qué se puede hacer sin red

| Acción | Sin red | Por qué |
| --- | --- | --- |
| Completar el formulario de alta | **Sí.** Borrador local, **sin la contraseña** (R7) | Se puede escribir en el subte y enviar al salir |
| Enviar el alta | No. Mensaje claro y el borrador se conserva | Necesita servidor |
| Ingresar | No. "No hay conexión, así que no podemos verificar tu contraseña." Se guarda el correo, no la contraseña | — |
| Ver el portal si la sesión sigue abierta | **Sí**, con `BandaConexion` "Datos viejos" | Constitución #13 |
| Ver la lista de sesiones | Sí, desde caché, con la fecha del dato | — |
| Cerrar una sesión a distancia | **No**, y se dice por qué. **No se encola** | Una sesión que se cree cerrada y no lo está es peor que no poder cerrarla |
| Ver el código de 2º factor | Sí: lo genera la app del teléfono, no nosotros. **Se lo decimos**: "El código se genera en tu teléfono, funciona sin internet" | Baja la ansiedad en el subte |
| Ver los códigos de respaldo ya guardados | No desde la app: se guardan fuera. La pantalla lo recuerda | — |
| Leer el bloque del art. 6 y la política | **Sí**, cacheados sin vencimiento | Sistema de diseño §9.4: las advertencias legales se guardan siempre |

### 9.2 Presupuesto de datos

El alta completa del cliente (AL-1 → AL-4) tiene que caber en **menos de 120 KB**
transferidos, sin fuentes web y sin ilustraciones. Es la primera sesión y muchas
veces se hace con los datos casi agotados.

### 9.3 Web vs. móvil, por audiencia

| | Móvil (cliente) | Web cliente | Web abogado / admin |
| --- | --- | --- | --- |
| Alta | Una columna, 16px de margen, campos a ancho completo | Igual, **contenido a 720px centrado** (sistema de diseño §4.1): el bloque del art. 6 a 1400px de ancho no se lee | Abogado: dos pasos en una columna de 720px. Admin: no se autorregistra |
| Bloque del art. 6 | Completo, no plegable | Idéntico | Idéntico. **No se abrevia por ser un profesional** |
| Segundo factor | Campo único, teclado numérico, autorrelleno del SMS/app | Campo único, foco automático | Igual + atajo `Enter` |
| Sesiones | Tarjetas apiladas, una por sesión | Tarjetas, 720px | **Tabla densa** con columna de IP en `fuente.mono`, orden por última actividad |
| Ubicación de la sesión | "Buenos Aires (aproximado)" | Igual | "Buenos Aires, AR · 200.1.2.3" — el profesional necesita el dato crudo |
| Verificación de matrículas | **No existe en móvil.** Es una tarea de escritorio con lectura de documentos | — | Lista 380px + panel de detalle (sistema de diseño §4.1) |
| Perfil del abogado | Consulta sí, edición no | Completo | Completo, tabla densa |
| Densidad | `texto.base`, una tarjeta por bloque | Igual | `texto.sm`, filas de 40px |

**Lo que no cambia nunca entre plataformas:** el texto del art. 6, el texto de la
casilla de aceptación, el microcopy de la matrícula verificada con fecha, y el
mensaje de ingresos pausados. Son los cuatro textos con consecuencia legal, y dos
versiones de un texto legal terminan siendo dos textos distintos.

---

## 10. Componentes

### 10.1 Del sistema de diseño, sin cambios

`Boton` · `Campo` · `Tarjeta` · `ChipEstado` · `PanelSemantico` (variantes
`informativo`, `atencion`, `pendiente`, `confirmado`, `problema`) ·
`BloqueAvisoLegal` · `Acordeon` · `Esqueleto` · `EstadoVacio` · `BandaConexion` ·
`TablaDensa`.

Íconos ya especificados que se usan: `aviso`, `revision`, `revisado`,
`informacion`, `reintentar`, `sin-conexion`, `calendario`, `documento`,
`historial`, `volver`, `cerrar`, `filtro`, `cargando`, `expandir`/`contraer`.

### 10.2 Nuevos que esta feature necesita

| Componente | Qué es | Por qué no alcanza con lo que hay |
| --- | --- | --- |
| `NotaDeCampo` | Bloque de 1 a 3 líneas bajo un `Campo`, `texto.base`, `color.texto.secundario`, siempre visible (no aparece al enfocar) | Es la pieza que hace que el art. 6 no sea un muro. No es un "hint" ni un tooltip: es texto permanente con valor legal |
| `MarcaObligatorio` | Etiqueta textual "Obligatorio" / "Podés no completarlo", alineada a la derecha de la etiqueta del campo | Reemplaza el asterisco. Requisito del art. 6 inciso c) |
| `CampoContrasena` | `Campo` + botón "Ver" de 48×48 con `aria-pressed` + `autocomplete` correcto | Necesita comportamiento propio y no puede tener "repetir contraseña" |
| `CampoCodigo` | Campo único de 6 dígitos, `inputmode="numeric"`, `autocomplete="one-time-code"` | Prohíbe explícitamente el patrón de seis cajitas |
| `SelectorTipoCuenta` | Dos tarjetas grandes, toda la tarjeta es el objetivo táctil, con descripción de a quién le sirve | Un `select` o dos radios no dan lugar a explicar la consecuencia de cada opción |
| `FilaSesion` | Dispositivo + navegador + ubicación aproximada + fechas + acción de cierre. Variante cliente (sin IP) y variante profesional (con IP en `fuente.mono`) | Las dos audiencias necesitan datos distintos del mismo objeto |
| `ChipMatricula` | `ChipEstado` que **no puede renderizarse sin fecha**. Si falta la fecha, no muestra "verificada": muestra "Estado sin confirmar" | Es la traducción en componente de la salvaguarda M-6. Hacerlo imposible por construcción es más seguro que confiar en la revisión de cada pantalla |
| `AvisoAuditoria` | Línea fija en las acciones sensibles del administrador: "Esta acción queda registrada con tu nombre y la fecha" | Patrón repetido en AD-2, AD-3, AD-4 |
| `BloqueEvidencia` | Conjunto de campos de AD-2 que gobierna el estado del botón "Aprobar" y muestra en texto qué falta | Es el mecanismo que impone M-1 |
| `PiePublico` | Pie de las pantallas no autenticadas con "Cancelar mi suscripción", "Términos", "Datos" | Requisito de la Res. SCI 424/2020: fuera del login |

### 10.3 Patrones nuevos

| Patrón | Regla |
| --- | --- |
| **Información legal en tres capas** (§3, AL-2) | Nota por campo + bloque de responsable + documento completo. Se aplica a toda pantalla que recolecte datos personales, en ésta y en las próximas features |
| **Respuesta indistinguible** (AL-4, RE-1) | Cuando el sistema no puede revelar si algo existe, la pantalla es **la misma**, el tiempo de respuesta es el mismo, y el texto incluye una frase condicional que le da salida al usuario legítimo sin revelar nada |
| **Bloqueo con salida** (IN-3) | Todo límite temporal se comunica con: qué se pausó, hasta qué hora (absoluta), cómo salir antes, y una frase que descarta la interpretación más asustada |
| **Obligación explicada** (AB-2, AD-6) | Toda restricción no negociable lleva, en el mismo bloque, el motivo en términos del interés del usuario o de sus obligaciones, no de las nuestras |
| **Afirmación con fecha** (CL-7, AB-3) | La plataforma nunca afirma un estado presente sobre un hecho que no controla. Informa qué verificó, contra qué y cuándo, y dice qué no significa |

### 10.4 Cambios a `tokens.md`

**Ninguno.** Todos los colores, tamaños, espaciados y radios salen de la versión
1. Se proponen seis pares de contraste nuevos (N1–N6, §8.1) que son
combinaciones de tokens ya existentes y no agregan valores.

---

## 11. Escalamientos y huecos

### `[ESCALAMIENTO-A]` — el CUIT/CUIL no tiene finalidad declarada. **Bloqueante para AL-2.**

La spec v3 corrigió CA-04 (no-revelación) pero **no resolvió el defecto D-002-01**:
el §4 paso 2 sigue diciendo "CUIT/CUIL si aplica a su rol", sin declarar para qué
se usa ni a qué rol aplica. El art. 6 inciso a) y c) exigen decir la finalidad y
si es obligatorio. **No puedo escribir esa nota de campo sin inventar una regla
de negocio**, y no me corresponde.

Las dos salidas, y lo que implica cada una en la pantalla:

| Salida | Efecto en AL-2 |
| --- | --- |
| **(a) No pedirlo en la 002** (recomendación de diseño) | AL-2 queda como está diseñada: tres campos. Es el alta más corta posible y cumple minimización. El CUIL se pide en la feature que lo necesita, con su finalidad concreta |
| **(b) Pedirlo, con finalidad declarada** | Se agrega un cuarto campo con su `NotaDeCampo` y su `MarcaObligatorio`, y el bloque del art. 6 suma una frase. **Requiere, además, definir el camino de rectificación** (`[ESCALAMIENTO-B]`) |

He diseñado la pantalla en la variante (a) y dejado el hueco marcado en CL-6.
**Si el product owner elige (b), esta pantalla vuelve a mí antes de G3.**

### `[ESCALAMIENTO-B]` — rectificación del CUIT/CUIL sin proceso (D-002-04)

CA-23 dice que el CUIT/CUIL verificado "no es editable sin un proceso de
reverificación" y **ninguna CA define ese proceso**. En CL-6 eso produce un campo
gris con un botón que no lleva a ningún lado. Dejé el botón "Pedir cambio de
CUIL" con destino `{PENDIENTE}`. Un dato identificatorio mal cargado y sin camino
de corrección es, según el dictamen, un problema del art. 16 de la Ley 25.326.
Sólo aplica si se elige la salida (b) de A.

### `[ESCALAMIENTO-C]` — qué le pasa al cliente cuando suspenden a su abogado (CA-30)

CA-30 define el efecto sobre el abogado y AD-3 lo implementa. Pero **nadie definió
qué ve el cliente** cuyo caso queda sin abogado de un día para el otro. La spec lo
declara dependencia hacia 008/012/013, y eso está bien para la reasignación; pero
**el mensaje al cliente ocurre el mismo día de la suspensión**, no cuando se
construya la 012. En CL-7 dejé el hueco `{QUÉ PASA CON EL CASO}`. Constitución #1:
el perjudicado por una suspensión no puede ser el deudor.

### `[ESCALAMIENTO-D]` — no hay plazo para la restitución del segundo factor (CA-35)

No existe parámetro `soporte.plazoRestitucionMFA` en ningún documento. RE-4 y AB-2
lo necesitan para decir "esto tarda X", que es el requisito explícito del encargo.
**Con MFA obligatorio para abogado y administrador, un profesional sin segundo
factor no puede trabajar**: un plazo indefinido es el mismo problema de art. 8 bis
que CA-31 resolvió para la matrícula. Propongo, como parámetro de producto y
sujeto a decisión: **1 día hábil, con escalamiento automático al vencerlo**, en
la misma forma que CA-31. No lo fijo: lo pido.

Y lo que sigue abierto por C-002-12 y que la pantalla ya tiene reservado:
`{DOCUMENTACIÓN}`, `{QUIÉN LA VE}`, `{CUÁNTO SE GUARDA}`.

### `[ESCALAMIENTO-E]` — la edad del titular no está en la spec (D-002-08)

El dictamen marcó que un menor puede registrarse y celebrar un contrato de
adhesión impugnable. Si se decide pedir una declaración de edad, **es un campo
más en AL-2 con su nota del art. 6 inciso c) y d)**, y la pantalla cambia. Hoy no
lo puse porque no hay CA que lo sostenga. Si se agrega después de G2, vuelve a
diseño.

### `[ESCALAMIENTO-F]` — cadencia del reofrecimiento del segundo factor al cliente

CA-39 dice "se ofrece desde el día uno, nunca escondido". Interpreté eso como:
una vez al primer ingreso, siempre disponible en el perfil, y **una sola
reaparición a los 30 días**. La reaparición periódica es un límite que estoy
proponiendo yo para que "ofrecer activamente" no se degrade en hostigamiento.
Es una decisión de producto; la marco para que se ratifique.

### `[ESCALAMIENTO-G]` — el sistema de diseño necesita una extensión menor

La gobernanza de `sistema-de-diseno.md` §10 dice que un componente nuevo se
define allí **antes** de usarse en un `ux.md`. El encargo de esta tarea fijó un
entregable único y me pidió no tocar ese archivo. Cumplí el encargo y dejé los
diez componentes y los cinco patrones nuevos documentados en §10 de este
documento. **Falta una tarea de consolidación** que los agregue a
`sistema-de-diseno.md` §5.1 y §7, y los seis pares de contraste a `tokens.md`
§1.4, antes de que empiece la implementación.

### 11.1 Huecos de texto legal — todos marcados en las pantallas

| Hueco | Quién lo llena | Dónde aparece |
| --- | --- | --- |
| `{RAZÓN SOCIAL}` | `compliance-legal` + estudio | AL-2, AL-3a |
| `{DOMICILIO}` | ídem | AL-2, AL-3a |
| `{CANAL DE CONTACTO}` | product owner | AL-2, IN-3, RE-4, AB-1, CO-5, CO-13 |
| `{PROVEEDOR DE CORREO}` | `arquitecto` en G2 (R-09, C-002-10) | AL-2 |
| `{VERSIÓN}` de términos y política | `compliance-legal` | AL-2 |
| Texto completo de términos y de la política | estudio jurídico | Enlaces de AL-2 |
| `{CÓMO}` consultar la matrícula en el colegio | `compliance-legal` | CL-7 |
| `{APP}` de segundo factor recomendada | `arquitecto` | IN-2, CL-3 |

### 11.2 Parámetros que las pantallas leen y no fijan

`{VIGENCIA ENLACE}` (24 h propuesto) · `{VIGENCIA RECUPERACIÓN}` (1 h propuesto) ·
`{DURACIÓN BLOQUEO}` (15 min, CA-37) · `{RETENCIÓN NO VERIFICADA}` (30 días
propuesto, CA-28) · `{RETENCIÓN SESIÓN CERRADA}` (90 días propuesto) ·
`{PLAZO REVISIÓN}` (5 días hábiles, CA-31) · `{VIGENCIA VERIFICACIÓN}` (12 meses,
CA-29) · `{PLAZO RESTITUCIÓN}` (sin valor, `[ESCALAMIENTO-D]`).

**Todos se muestran al usuario en unidades y con fecha concreta**, nunca como
"según corresponda" ni "en breve".

### 11.3 Confirmación: ninguna pantalla empuja contra el interés del usuario

Revisé el flujo completo contra la constitución #1. **No encontré ninguna
pantalla que empuje a una decisión contraria al interés del usuario.** Tres
puntos donde el diseño habitual del mercado sí lo hace y acá no:

1. **CL-2 no usa culpa** para forzar el segundo factor, y "Ahora no" es un botón
   real del mismo peso.
2. **AL-2 no empaqueta consentimientos.** Dice explícitamente qué no autoriza,
   en contra del interés comercial de corto plazo de la plataforma.
3. **Ninguna pantalla de esta feature ofrece un plan pago**, y IN-3 —el momento
   de máxima vulnerabilidad del usuario— no ofrece absolutamente nada más que la
   salida.

---

## 12. Trazabilidad: criterio de aceptación → correlato visible

| CA | Correlato visible |
| --- | --- |
| CA-01 | AL-2 → AL-4 → correo CO-1 → AL-5 |
| CA-02 | AL-4 (misma pantalla, tercera viñeta) + correo CO-2 accionable |
| CA-03 | RE-2 y AL-2: mensaje con el motivo exacto, sin humillar (§7.2) |
| CA-04 | AL-4 (misma respuesta) + correo CO-3. **Condicionado a `[ESCALAMIENTO-A]`** |
| CA-05 | AB-1 (estado en revisión, bloqueo de operación) · AD-2 (evidencia obligatoria) · AB-3 y CL-7 (fecha siempre) |
| CA-06 | AL-5, variantes "vencido" y "roto", siempre con botón de enlace nuevo |
| CA-07 | Sin pantalla propia: es el ingreso exitoso de IN-1 |
| CA-08 | IN-2: la pantalla de código aparece sin haber confirmado nada de la contraseña; el error de IN-1 es único |
| CA-09 | IN-3 (pantalla) + CO-4 (correo con duración y salida) |
| CA-10 | Sin correlato visible — rotación interna |
| CA-11 | CO-7 + al volver a entrar, IN-1 normal. **Sin jerga de tokens** |
| CA-12 | El mensaje genérico de IN-1 y el cierre de sesión silencioso ("Tu cuenta se cerró sola por seguridad. Entrá de nuevo.") |
| CA-13 | CL-5 (cliente, sin IP) y su variante profesional (con IP) |
| CA-14 | CL-5: la sesión desaparece de la lista y el aviso se anuncia en la propia pantalla |
| CA-15 | RE-1, con respuesta idéntica exista o no el correo + CO-6 |
| CA-16 | RE-2: el aviso de cierre de sesiones **antes** de guardar + CO-5 |
| CA-17 | RE-3, con botón primario de enlace nuevo |
| CA-18 | Sin correlato visible — evaluación por permiso |
| CA-19 | Sin correlato visible |
| CA-20 | Al recibir 403, la interfaz muestra: "Esta parte no está disponible para tu cuenta." + volver al inicio del rol. Nunca una pantalla en blanco ni un 403 crudo |
| CA-21 | `AvisoAuditoria` en AD-2, AD-3, AD-4. Del lado del cliente, sin correlato en esta feature |
| CA-22 | AD-1 (bandeja) y AD-2 (decisión) |
| CA-23 | CL-6, sección "Tus datos" |
| CA-24 | AB-3, con matrícula no editable **y con camino de cambio** |
| CA-25 | CL-6, "Descargar todo lo que tenemos tuyo", con lo que excluye dicho en la pantalla |
| **CA-26** | **AL-2, las tres capas de §3: nota por campo, bloque no plegable del responsable, política completa** |
| CA-27 | AL-2: casilla sin marcar, versión visible, "guardamos qué versión aceptaste y cuándo", y la frase de alcance limitado |
| CA-28 | CL-1: "Si no la confirmás, borramos la cuenta y todo lo que cargaste a los {RETENCIÓN NO VERIFICADA}" + CO-1 |
| CA-29 | AB-3 (fila Estado en `atencion`) · CL-7 (segunda fila de la tabla de estados) · CO-12 |
| CA-30 | AD-3 (suspensión con motivo y aviso de efecto sobre terceros) · CO-13 · CL-7 tercera fila |
| **CA-31** | **AB-1: plazo con fecha concreta, escalamiento automático anunciado, y el bloque "Nos pasamos del plazo". AD-1: columna Espera y pestaña Escaladas. CO-11** |
| **CA-32** | **AD-6: sin interruptor de apagado, con el porqué en el mismo bloque, y "Cambiar de dispositivo" como válvula** |
| CA-33 | AD-4: bloque explicativo + error específico para correos genéricos |
| CA-34 | AD-4 (`AvisoAuditoria`) + AD-5 (nominalización bloqueante de la siembra) + CO-14 |
| CA-35 | RE-4: punto de entrada desde IN-2, expectativa de plazo, y los huecos de C-002-12 visibles |
| **CA-36** | **IN-3: "Cambiar mi contraseña ahora" es el botón primario y nunca se deshabilita** |
| **CA-37** | **IN-3 y CO-4 leen `{DURACIÓN BLOQUEO}` como parámetro; ningún texto trae el número escrito a mano** |
| **CA-38** | **AB-2: obligatorio, con la explicación del secreto profesional, y ofrecido durante la espera de AB-1** |
| **CA-39** | **CL-2 (oferta sin presión, día uno, siempre en el perfil) + CL-4 (desactivar exige reautenticación fuerte)** |

---

## 13. Qué falta para dar esto por terminado

| # | Falta | Quién | Cuándo |
| --- | --- | --- | --- |
| 1 | Resolver `[ESCALAMIENTO-A]` (CUIT/CUIL). **Bloquea AL-2** | product owner | Antes de G3 |
| 2 | Resolver `[ESCALAMIENTO-D]` (plazo de restitución de MFA). **Bloquea RE-4** | product owner + `compliance-legal` | Antes de G3 |
| 3 | Llenar los ocho huecos legales de §11.1 | `compliance-legal` + estudio | Antes de G4 |
| 4 | Ratificación del texto del art. 6 de AL-2 por el abogado matriculado | estudio | Antes de que se dé de alta una persona real |
| 5 | Identificar el proveedor de correo y el de resolución IP→ubicación, para nombrarlos en AL-2 | `arquitecto` | G2 (C-002-10) |
| 6 | Consolidar los componentes y patrones de §10 en `sistema-de-diseno.md` y los pares N1–N6 en `tokens.md` | `ux-expert` | Tarea aparte, antes de G3 |
| 7 | Dibujar los trazos de los íconos usados acá (pendiente T-01) | `ux-expert` | Antes de G4 |
| 8 | Probar AL-2 y IN-3 con una persona con baja visión y con lector de pantalla (T-03) | `tester` + `ux-expert` | Antes de G5 |
| 9 | Prueba de comprensión del bloque del art. 6 con 5 personas de la audiencia real: que después de leerlo puedan responder quién guarda sus datos y si autorizaron una consulta al informe crediticio | `tester` | Antes de G5 |
