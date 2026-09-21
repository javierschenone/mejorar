# Diseño UX 004 — Motor de reglas legales argentinas

| Campo | Valor |
| --- | --- |
| Autor | `ux-expert` |
| Spec de origen | `specs/004-motor-reglas-legales/spec.md` **versión 3, 64 criterios** |
| Dictamen vinculante | `specs/004-motor-reglas-legales/cumplimiento.md` §3 (textos obligatorios) y §4.2 (salvaguardas) |
| Sistema de diseño | `specs/diseno/sistema-de-diseno.md` · `specs/diseno/tokens.md` |
| Estado | BORRADOR — se aprueba en G2 |
| Compuerta | G2 |

> **Qué es este documento y qué no.**
> La spec 004 dice en su §8 que la interfaz es de la feature 007. Cierto para
> **las pantallas que obtienen los datos**. Pero la 004 produce salidas que
> obligatoriamente tienen forma visible: los textos del dictamen §3, la marca de
> validación pendiente (CA-28), la advertencia preventiva (CA-54 a CA-57), los
> tres tipos de "sin resultado" y la regla de no-confusión (CA-62). Este
> documento especifica **la presentación de las salidas del motor**. La carga de
> datos, la navegación general de la app y el alta de deudas son de la 007 y acá
> sólo se referencian.

---

## 1. Contexto de uso

### 1.1 Quién abre esto y en qué estado

**El cliente.** Una persona de entre 28 y 60 años con una o varias deudas en
mora. Llega acá después de haber cargado una deuda, y lo que quiere saber es una
sola cosa: *¿esto se puede arreglar o estoy hundido?* Está con miedo, y muy
probablemente con vergüenza: no le contó a nadie de su entorno. Es probable que
ya haya recibido llamados de un estudio de cobranzas, que le hayan hablado de
"embargo" y de "juicio", y que no sepa si eso es cierto. Viene con una desconfianza
razonable hacia cualquier cosa que le prometa salvarlo.

- **Dispositivo:** Android de gama baja o media-baja, pantalla de 5 a 6,5", LCD,
  2 a 4 GB de RAM. Muchos con la fuente del sistema agrandada.
- **Conexión:** datos móviles medidos, a veces agotados. Sesiones en el colectivo
  y en el subte. Wi-Fi ajeno e inestable.
- **Tiempo:** sesiones de 2 a 6 minutos. Muchas a la noche.
- **Alfabetización financiera y jurídica:** baja a nula. "Prescripción",
  "caducidad", "capitalización", "morigeración" no significan nada.
- **Qué hace si no entiende:** no pregunta. Cierra. Y ahí es donde se hace daño
  solo, porque al día siguiente el estudio de cobranzas lo llama y le ofrece un
  plan de pago.

Ese último punto es el que ordena todo el diseño de esta feature: **el riesgo
principal no es que el cliente no entienda un hallazgo, es que actúe antes de
entenderlo.**

**El abogado.** Escritorio, dos monitores, 1440px o más, navegador con muchas
pestañas. Tiene una cola de hallazgos para revisar y el tiempo contado. No
necesita contención: necesita ver el caso entero en una pantalla y decidir sin
hacer diez clics. Su unidad de trabajo es el hallazgo, no la persona.

**El administrador.** Escritorio. Mantiene el catálogo de parámetros normativos.
Su miedo es distinto y muy concreto: que un valor mal cargado le rompa el cálculo
de toda la cartera. Necesita ver qué está sin ratificar, qué se usó en qué
evaluación, y poder demostrar quién cargó qué y cuándo.

### 1.2 Restricciones que atraviesan todo

| # | Restricción | Origen |
| --- | --- | --- |
| R1 | El cliente **no ve** el hallazgo de prescripción hasta que un abogado lo confirme, pero sí ve la advertencia preventiva desde el minuto cero | CA-54, decisión 004-B |
| R2 | La advertencia preventiva es **gratuita, inmediata e incondicional** | CA-56, constitución #8 |
| R3 | Los textos del dictamen §3 son **literales y completos**, en el mismo bloque que el hallazgo, con el mismo cuerpo | CA-50, condición C-07 |
| R4 | El motor **no dirige la conducta procesal** del cliente. Las únicas acciones que se le sugieren son consultar al abogado y no innovar sobre la deuda | CA-48, salvaguarda S-04 |
| R5 | Todo hallazgo lleva marca de confirmación profesional hasta que un matriculado lo confirme, y la marca llega a la pantalla | CA-28, CA-46 |
| R6 | **Prohibido agregar los impactos en un número único.** No existe la pantalla "total que podrías recuperar" | RL-07, constitución #6 |
| R7 | El motor no recibe ni muestra nombre, DNI, CUIL ni domicilio | CA-60, constitución #5 |
| R8 | Ningún texto del producto contiene los términos prohibidos del dictamen §3.8 | CA-45 |

---

## 2. Flujo

### 2.1 Mapa general

```
                        ┌───────────────────────────────┐
                        │  El motor evalúa la deuda     │
                        │  (no tiene interfaz propia)   │
                        └───────────────┬───────────────┘
                                        │ conjunto de hallazgos
              ┌─────────────────────────┼─────────────────────────┐
              ▼                         ▼                         ▼
   ┌────────────────────┐    ┌────────────────────┐   ┌────────────────────┐
   │ ¿Hay hallazgo de   │    │  Resto de los      │   │ ¿Se usó parámetro  │
   │ prescripción sin   │    │  hallazgos         │   │ sin ratificar?     │
   │ confirmar?         │    │                    │   │ → §3.7 + chip      │
   └─────┬────────┬─────┘    └─────────┬──────────┘   └────────────────────┘
      sí │        │ no                 │
         ▼        ▼                    ▼
  ┌────────────┐ (nada)   ┌──────────────────────────────┐
  │ AVISO      │          │  Se muestran al cliente con  │
  │ PREVENTIVO │          │  su texto obligatorio §3.x   │
  │ C-2        │          │  y su marca de revisión      │
  │ gratis,    │          └──────────────────────────────┘
  │ inmediato  │
  └─────┬──────┘
        │  el hallazgo va a la cola del abogado (A-1)
        ▼
  ┌──────────────────────────────────────────────────────────┐
  │  Abogado: confirma / rechaza / corrige   (CA-47, CA-51)   │
  │  Plazo 10 días hábiles → escalamiento     (CA-55)         │
  └─────┬──────────────────────┬──────────────────────────────┘
        │ confirmado           │ rechazado
        ▼                      ▼
  ┌────────────────┐    ┌──────────────────────────────────┐
  │ C-3 Hallazgo   │    │ El aviso preventivo se levanta   │
  │ + texto §3.1   │    │ con explicación. El hallazgo NO  │
  │ + acción       │    │ se muestra como vigente (CA-51)  │
  │   (CA-57)      │    └──────────────────────────────────┘
  └────────────────┘
```

### 2.2 Ramas de "sin resultado"

```
   El análisis no produce un resultado
                 │
    ┌────────────┼─────────────────────┬──────────────────────┐
    ▼            ▼                     ▼                      ▼
 falta un    materia excluida     régimen en disputa     jurisdicción sin
 dato        (CA-63)              (CA-64, CA-35,         parámetros
 (CA-07,     previsional,         CA-39)                 (CA-26, CA-52)
  CA-10,     alimentaria,                                       │
  CA-13)     con menores                                        │
    │            │                     │            ┌───────────┴─────┐
    ▼            ▼                     ▼            ▼                 ▼
  C-4          C-5                   C-6        jurisdicción      la cargamos
 "Falta un   "Lo ve un abogado    "Ley en       cubierta →         → variante A
  dato"       primero"             discusión"   variante A         del mismo
                                                                   bloque
  ACTÚA EL    ACTÚA UN ABOGADO     NO ACTÚA
  CLIENTE                          NADIE AÚN
```

### 2.3 Puntos de abandono probables y qué hacemos

| Momento | Por qué se va | Mitigación |
| --- | --- | --- |
| Primera pantalla del diagnóstico | Ve un muro de texto legal | El aviso preventivo arriba, en 3 líneas y una lista. El encabezado §3.0 es corto y no se puede plegar, pero está después |
| Al ver "Falta un dato" | Se siente examinado | Un campo por pantalla, con el "para qué" antes del campo, y siempre una salida ("No lo tengo a mano") |
| Al ver varios "sin resultado" juntos | Concluye "esto no sirve" | Se agrupan al final, bajo un rótulo que los enmarca, y se muestra primero lo que sí se pudo mirar |
| Al leer que el resultado "podría" ser algo | Concluye "no me dicen nada" | Cada bloque cierra con **qué sigue y quién lo hace**, con fecha |
| Después de 10 días sin novedades | Siente que lo abandonaron | La tarjeta muestra "En revisión desde el {fecha}". Si se pasa el plazo, cambia a "Se pasó del plazo que nos pusimos. Ya lo escalamos." (CA-55) |

---

## 3. Pantallas del cliente

Móvil primero. Las diferencias de web están en §6.3.

### C-1 · Diagnóstico de una deuda (contenedor)

**Propósito.** Mostrar todo lo que el motor pudo y no pudo decir sobre una deuda,
en un orden que evite que el cliente actúe antes de entender.

**Acción principal.** Ninguna, salvo las que abran los bloques. Es una pantalla
de lectura. **Deliberadamente no tiene botón primario global**: no hay nada que
el cliente deba decidir acá (regla 1 del mandato).

**Jerarquía.** El orden de `sistema-de-diseno.md` §4.2, sin excepciones.

#### Estado ÉXITO (con todo lo que puede aparecer)

```
┌──────────────────────────────────────────────────┐
│ ←  Tarjeta Banco Sur · $ 412.300                 │  h1, texto.2xl
├──────────────────────────────────────────────────┤
│▍⚑ Aviso importante sobre esta deuda              │  PanelSemantico atencion
│▍                                                 │  ← SIEMPRE PRIMERO
│▍ Estamos revisando esta deuda con un abogado.    │  texto.lg
│▍ Mientras tanto:                                 │
│▍                                                 │
│▍  • No reconozcas la deuda.                      │  texto.base
│▍  • No firmes planes de pago.                    │
│▍  • No hagas pagos parciales.                    │
│▍                                                 │
│▍ Eso puede hacerte perder defensas: cosas que    │
│▍ podrías decir a tu favor si algún día te        │
│▍ reclaman esta deuda en la justicia.             │
│▍                                                 │
│▍ En revisión desde el 14/09/2026. Suele tardar   │
│▍ hasta 10 días hábiles.                          │
│▍                                                 │
│▍ Este aviso es gratis y no depende de ningún     │
│▍ plan.                                           │
│▍                                                 │
│▍ [ Hablar con el equipo ]                        │  botón primario 48px
│▍ ⌄ ¿Por qué me dicen esto?                       │  acordeón → C-2
├──────────────────────────────────────────────────┤
│ Esto es una estimación, no un dictamen legal.    │  BloqueAvisoLegal §3.0
│ Lo que sigue lo calculó un sistema automático    │  LITERAL, no plegable
│ con los datos que cargaste. Sirve para saber     │  7:1 · texto.base
│ qué revisar y qué preguntar. No reemplaza el     │
│ consejo de un abogado ni de un contador. Antes   │
│ de pagar, de firmar o de dejar de pagar algo,    │
│ hablá con un profesional. Si un dato que         │
│ cargaste está mal, el resultado va a estar mal.  │
├──────────────────────────────────────────────────┤
│ La deuda, como está cargada                      │  h2
│ Acreedor        Banco Sur                        │  datos neutros,
│ Tipo            Tarjeta de crédito               │  sin color semántico
│ Te reclaman     $ 412.300                        │
│ Desde           marzo de 2021                    │
│ Cargada el      14/09/2026  · [ Corregir ]       │
├──────────────────────────────────────────────────┤
│ Qué miramos                                      │  h2
│                                                  │
│ ┌──────────────────────────────────────────────┐ │
│ │▍🔍 Intereses          [En revisión]          │ │  → C-3 variante B
│ └──────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────┐ │
│ │▍📄 Informes de crédito [Revisado]            │ │  → C-3 variante C
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ ┌──────────────────────────────────────────────┐ │
│ │ ⇄  No son lo mismo                           │ │  BloqueNoConfusion
│ │    (ver C-7)                                 │ │  CA-62
│ └──────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────┤
│ Lo que todavía no podemos mirar            (3)   │  h2 — agrupado al final
│  ┌────────────────────────────────────────────┐  │
│  │▍➕ Falta un dato  → C-4                     │  │  informativo
│  ├────────────────────────────────────────────┤  │
│  │▍↪  Lo ve un abogado primero → C-5           │  │  pendiente
│  ├────────────────────────────────────────────┤  │
│  │ ⑂  Ley en discusión → C-6                   │  │  sin fondo, borde 1px
│  └────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────┤
│ ⌄ Con qué datos se calculó esto                  │  PieProcedencia,
│   Evaluado el 20/09/2026 · parámetros v2026.09.1 │  plegado
└──────────────────────────────────────────────────┘
```

#### Los cinco estados de C-1

| Estado | Cuándo | Qué se ve |
| --- | --- | --- |
| **Vacío** | La deuda está cargada pero el motor todavía no la evaluó nunca | `EstadoVacio`: **"Todavía no revisamos esta deuda."** / "En cuanto la revisemos, vas a ver acá qué encontramos y qué no. Suele estar listo el mismo día." / botón secundario "Avisarme cuando esté" |
| **Cargando** | Primera evaluación en curso | Nada hasta 300ms. Luego esqueleto con la forma real: barra de título, un bloque grande, tres tarjetas. A los 5s se agrega "Está tardando más de lo normal. Podés cerrar y volver: no se pierde nada." A los 20s → Error |
| **Error** | No se pudo obtener el diagnóstico | Ver abajo. **Si hay un aviso preventivo cacheado, se muestra igual, arriba del error** (§6.4) |
| **Parcial** | Algunos análisis dieron resultado y otros no. **Es el estado normal** | La pantalla completa de arriba. Nunca se oculta lo que sí hay porque falte lo demás |
| **Éxito** | Los cinco análisis devolvieron algo | La misma pantalla, sin el grupo "Lo que todavía no podemos mirar" |

**Estado de error, completo:**

```
┌──────────────────────────────────────────────────┐
│▍⚑ Aviso importante sobre esta deuda              │  ← si hay aviso cacheado,
│▍ … (texto completo, desde la caché)              │     va PRIMERO igual
├──────────────────────────────────────────────────┤
│▍↻ No pudimos traer el diagnóstico                │  PanelSemantico problema
│▍                                                 │
│▍ Es un problema nuestro, no tuyo. Tus datos      │
│▍ están guardados y no se perdió nada.            │
│▍                                                 │
│▍ [ Volver a intentar ]                           │
│▍ Si sigue pasando, escribinos desde Ayuda.       │
└──────────────────────────────────────────────────┘
```

Nunca se muestra un código de error al cliente. El identificador técnico va en
el `PieProcedencia` plegado, con rótulo "Referencia para soporte: `ev-8f2a`".

---

### C-2 · Aviso preventivo y la respuesta a "¿por qué?"

Implementa **CA-54, CA-56** y el recaudo B-1. Es el componente más delicado de la
feature: tiene que evitar una conducta concreta **sin revelar el hallazgo** y sin
que el cliente sienta que le esconden algo.

#### Las cuatro cosas que este bloque tiene que lograr a la vez

1. Que el cliente **no reconozca la deuda, no firme un plan y no pague una
   parte** en los próximos días.
2. Que **no se asuste**: nada de esto significa que su situación empeoró.
3. Que **no sienta que le ocultan algo**, porque eso destruye la confianza y
   además sería cierto si no lo explicáramos.
4. Que **no lo lea como una venta**: no hay nada que contratar acá (CA-56).

#### Cómo se resuelve la tensión

La trampa es el suspenso. "Detectamos algo, no te podemos decir qué" es
exactamente el mensaje que no hay que dar: genera ansiedad y sugiere una carta
escondida. La salida es **cambiar el sujeto de la frase**: no es que hay un
hallazgo secreto, es que **hay una revisión en curso**, y el consejo de no innovar
**vale igual cualquiera sea su resultado**. Eso es verdad, es verificable, y saca
al cliente del lugar de destinatario de un secreto.

Por eso el bloque:

- **No dice "detectamos", "encontramos" ni "hay algo".** Dice "estamos
  revisando".
- **No usa el futuro cargado** ("vas a tener novedades"). Usa presente y fecha.
- **No tiene cuenta regresiva.** Tiene fecha de inicio y plazo declarado.
- **Dice explícitamente que es gratis**, antes de que el cliente se lo pregunte.
- **Explica el "por qué" completo si se lo pide**, sin esquivar.

#### Acordeón "¿Por qué me dicen esto?" — texto completo

Se abre en la misma pantalla (no navega, no es un modal), queda abierto, y su
estado se recuerda.

> **¿Por qué me dicen esto?**
>
> Cuando cargás una deuda, el sistema revisa varias cosas: desde cuándo te la
> reclaman, qué intereses tiene, si figura en informes de crédito, si hay algún
> descuento sobre tu sueldo.
>
> Algunas de esas revisiones las tiene que mirar un abogado matriculado **antes**
> de que te demos un resultado. No porque el resultado sea malo ni bueno: porque
> en algunos temas, un resultado mal dado te puede llevar a hacer algo que después
> no se puede deshacer.
>
> **Este aviso te lo damos desde el primer día porque vale igual, termine como
> termine la revisión.** Mientras una deuda está en revisión, reconocerla, firmar
> un plan o pagar una parte puede cerrarte puertas que hoy tenés abiertas. Si la
> revisión no encuentra nada, no perdiste nada por haber esperado unos días. Si
> encuentra algo, esos días te lo van a haber cuidado.
>
> **No te estamos ocultando una buena noticia ni una mala.** Todavía no hay una
> respuesta: hay una revisión en curso. Cuando esté, te la damos entera, con lo
> que se puede hacer.
>
> **No te cuesta nada** y no depende de ningún plan: este aviso lo ves también
> con el plan gratuito.
>
> **¿Cuánto tarda?** Hasta 10 días hábiles. Si se pasa, salta un aviso interno y
> alguien del equipo lo toma. Te avisamos cuando esté.
>
> **¿Y si me llaman del estudio de cobranzas mientras tanto?** Podés escuchar,
> anotar y pedir que te manden todo por escrito. Lo que conviene no hacer es
> aceptar un monto, firmar algo o pagar una parte en esa llamada.
> [ Hablar con el equipo ]

`[ESCALAMIENTO-1]` El último párrafo es orientación de conducta frente a un
tercero. Está escrito para quedar del lado permitido de la salvaguarda S-04
("no innovar sobre la deuda") y no dirige ninguna conducta procesal, pero
**requiere ratificación de `compliance-legal`** antes de G4. Ver §9.

#### Los cinco estados de C-2

| Estado | Qué se ve |
| --- | --- |
| **Vacío** | No aplica: el bloque existe o no existe. Si no hay hallazgo de prescripción pendiente, no se renderiza nada — **y no se deja un hueco ni un "todo en orden"**, que sería informar por omisión |
| **Cargando** | **Nunca.** El aviso no tiene estado de carga propio: si está cacheado se pinta de inmediato; si no, aparece cuando llega el diagnóstico. Un esqueleto con forma de aviso es un aviso |
| **Error** | Si falla el diagnóstico pero hay aviso cacheado, el aviso **se muestra igual** (§6.4). Si nunca hubo aviso cacheado y falla, no se inventa uno |
| **Parcial** | El aviso se muestra completo aunque el resto de la pantalla esté incompleto. No admite versión resumida |
| **Éxito (resuelto)** | Cuando el abogado confirma → C-3. Cuando **rechaza** → el aviso se reemplaza por: **"Ya lo revisó un abogado."** / "Sobre esta deuda no encontró nada que cambie lo que te pueden reclamar. El aviso de no firmar ni pagar sin consultarnos ya no aplica a esta deuda en particular; si te ofrecen un plan, igual conviene que lo veamos juntos antes." / `Revisado por un abogado` |

**Reglas duras del aviso preventivo:**

1. Nunca plegado, nunca truncado, nunca con "ver más".
2. Nunca debajo de un resultado, ni debajo del encabezado §3.0.
3. Nunca con contador regresivo ni con "quedan N días".
4. Nunca adyacente a una oferta, un precio, un plan o un botón de contratación.
   En la pantalla donde está el aviso **no puede haber ningún módulo comercial**
   (CA-56). Verificable.
5. Se envía además como notificación push y como correo, con el mismo texto
   íntegro; el push nunca dice "tenés novedades", dice el aviso.
6. Si hay más de una deuda con aviso, **un solo bloque** que las nombra a todas.

#### Texto de la notificación

| Canal | Texto |
| --- | --- |
| Push (título) | `Aviso sobre tu deuda con {acreedor}` |
| Push (cuerpo) | `Mientras la revisamos con un abogado: no reconozcas la deuda, no firmes planes y no hagas pagos parciales. Es gratis y no tenés que hacer nada.` |
| Asunto de correo | `Un aviso sobre tu deuda con {acreedor} (no hace falta que respondas)` |

---

### C-3 · Hallazgo presentado al cliente

**Propósito.** Mostrar un hallazgo con su texto obligatorio, su marca de revisión
y, si está confirmado, la acción recomendada (CA-57).

**Estructura fija de todo hallazgo:**

```
┌──────────────────────────────────────────────────┐
│ ←  Intereses de la tarjeta                       │  h1
├──────────────────────────────────────────────────┤
│  [Revisado por un abogado]                       │  ChipEstado
│  o [En revisión]                                 │
│  o [Dato legal sin confirmar]   (§3.7)           │
├──────────────────────────────────────────────────┤
│ TEXTO OBLIGATORIO DEL DICTAMEN §3.x              │  BloqueAvisoLegal
│ literal, completo, 7:1, texto.base, no plegable  │  CA-50
├──────────────────────────────────────────────────┤
│ Estimado: $ 128.400                              │  patrón "cifra estimada"
│ Es una estimación con los datos que cargaste.    │  §7.6 del sistema
│ No es un monto que el acreedor esté obligado     │
│ a devolverte.                                    │
├──────────────────────────────────────────────────┤
│ Qué sigue                                        │  h2 — obligatorio (CA-57)
│  1. No reconozcas ni pagues nada de esta deuda   │
│     hasta hablar con nosotros.                   │
│  2. Hablá con el abogado que tiene tu caso.      │
│     Ya tiene este análisis.                      │
│  [ Hablar con el equipo ]                        │
├──────────────────────────────────────────────────┤
│ ⌄ Con qué datos se calculó esto                  │  PieProcedencia
│   Evaluado el 20/09/2026                         │
│   Conjunto de parámetros v2026.09.1              │
│   Norma: Ley 25.065, art. 16                     │
│   Tasa de referencia usada: 62,4 % · fuente BCRA │  CA-59
│   · vigente desde 01/08/2026 · activada por una  │
│   persona el 03/08/2026                          │
│   Supuestos: el emisor es una entidad bancaria   │
│   Referencia para soporte: ev-8f2a               │
└──────────────────────────────────────────────────┘
```

**El bloque "Qué sigue" es obligatorio y nunca está vacío** (CA-57). Su contenido
sale del catálogo cerrado de acciones (CA-48) y, para el cliente, sólo puede
tener dos entradas: *no innovar* y *consultar al abogado*. Si el catálogo no
tiene una acción aplicable, el bloque dice: "Por ahora no hay nada que tengas que
hacer. Lo seguimos nosotros."

#### Qué texto obligatorio va en cada hallazgo

| Hallazgo | Texto literal | Cuándo lo ve el cliente |
| --- | --- | --- |
| A — prescripción | §3.1 | **Sólo confirmado** (CA-54). Antes: C-2 |
| B — intereses, régimen general | §3.2 primer bloque | Siempre |
| B — tarjetas | §3.2 segundo bloque | Siempre |
| B — capitalización | §3.2 tercer bloque | Siempre |
| C — informes de crédito | §3.3 | Siempre |
| D — embargo | §3.4 primer bloque | Siempre |
| D — cuenta sueldo | §3.4 segundo bloque | Siempre |
| E — honorarios y comisión | §3.5 — **hay que reescribirlo, ver §9** | Siempre |
| Sin resultado por falta de dato | §3.6 | Siempre |
| Sin resultado, materia excluida | **no existe — propuesto en §9** | Siempre |
| Sin resultado, régimen en disputa | **no existe — propuesto en §9** | Siempre |
| Parámetro sin ratificar | §3.7 | Siempre que aplique |

#### Los cinco estados de C-3

| Estado | Qué se ve |
| --- | --- |
| **Vacío** | No aplica: un hallazgo sin contenido no se emite |
| **Cargando** | Esqueleto con la forma: chip, bloque de texto de 8 líneas, línea de cifra, bloque de acción |
| **Error** | `problema`: "No pudimos abrir este análisis. Es un problema nuestro. [Volver a intentar]" — y el resto de la pantalla del diagnóstico sigue accesible |
| **Parcial** | Hay hallazgo pero no hay impacto económico calculable: el bloque de cifra se reemplaza por **"No pudimos calcular cuánto representa esto. El resto del análisis vale igual."** Nunca se pone `$ 0` ni un guion |
| **Éxito** | La pantalla completa |

**Caso especial — hallazgo rechazado por el abogado (CA-51).** No se muestra
como vigente, y tampoco desaparece en silencio, porque el cliente ya vio el chip
"En revisión". Se muestra: **"Lo revisó un abogado y no corresponde."** /
"Miramos {los intereses} de esta deuda y, con los datos que hay, no encontramos
nada para reclamar. Si conseguís el resumen completo, lo volvemos a mirar." Sin
color semántico de error: variante `informativo`.

---

### C-4 · Sin resultado, variante A: **falta un dato**

`ChipEstado`: **`Falta un dato`** · Panel `informativo` · Ícono `dato-faltante`

**Es el caso más frecuente y se diseña primero.** Origen: CA-07 (sin fecha de
exigibilidad), CA-10 (sin tipo de emisor), CA-13 (sin composición del saldo),
CA-26 y CA-52 (jurisdicción sin parámetros, cuando la jurisdicción está cubierta
y falta el dato de cuál es).

**El problema de tono.** Pedir cinco datos seguidos convierte la pantalla en un
formulario de banco, y a un deudor con vergüenza el formulario le recuerda
exactamente la ventanilla donde lo trataron mal. La diferencia entre *pedir* e
*interrogar* es de estructura, no de redacción.

**Las siete reglas anti-interrogatorio:**

1. **Un dato por pantalla.** Nunca un formulario con cinco campos.
2. **El "para qué" va antes del campo**, no después ni en un tooltip.
3. **Siempre hay salida:** "No lo tengo a mano" es un botón real, del mismo
   tamaño que el otro, y no penaliza.
4. **Nunca se pregunta dos veces** lo mismo, ni algo que el sistema pueda
   derivar de algo que ya tiene.
5. **Nunca se pide un dato identificatorio** (CA-60): ni nombre, ni DNI, ni CUIL,
   ni domicilio. Si un flujo parece necesitarlo, es un error de diseño del flujo.
6. **Se dice cuántos faltan y cuánto rinde cada uno**, para que el esfuerzo tenga
   una medida: "Con este dato podemos revisar los intereses".
7. **Progreso sin castigo.** "1 de 3", nunca "te faltan 3" ni una barra que
   arranca vacía en rojo.

```
┌──────────────────────────────────────────────────┐
│ ←  Falta un dato                          1 de 3 │
├──────────────────────────────────────────────────┤
│▍➕ Para revisar los intereses de la tarjeta       │  h1, texto.2xl
│▍   necesitamos saber quién la emitió              │
│▍                                                 │
│▍ La ley pone un máximo distinto según la          │
│▍ tarjeta sea de un banco o de una financiera      │
│▍ o casa de créditos. Con los dos casos da         │
│▍ números muy distintos, así que preferimos        │
│▍ preguntarte antes que adivinar.                  │
├──────────────────────────────────────────────────┤
│ ¿Quién emitió la tarjeta?                        │  etiqueta visible
│  ( ) Un banco                                    │  radio, 48px de alto
│  ( ) Una financiera o casa de créditos           │
│  ( ) No estoy seguro                             │
│                                                  │
│  ⌄ ¿Dónde lo veo?                                │  acordeón
│    Está en el resumen, arriba de todo, al lado   │
│    del logo. Si dice "Banco" algo, es un banco.  │
├──────────────────────────────────────────────────┤
│ [ Guardar y seguir ]                             │  primario
│ [ No lo tengo a mano ]                           │  secundario, mismo tamaño
└──────────────────────────────────────────────────┘
```

**Al elegir "No lo tengo a mano":**

> **Está bien.** Guardamos todo lo demás y podés volver cuando quieras. Mientras
> tanto, el resto del diagnóstico sigue valiendo: sólo queda sin revisar este
> punto.

**Caso CA-13 — el dato lo tiene el acreedor, no el cliente.** No se le pide al
cliente lo que no puede tener:

> **Este dato tiene que darlo el acreedor.**
> Para revisar cómo se armó el saldo hace falta el detalle de cuánto es capital,
> cuánto intereses y cuánto gastos. Eso lo tiene que informar quien te reclama la
> deuda; vos no tenés cómo saberlo.
> Lo anotamos para que el equipo se lo pida. **No tenés que hacer nada.**

`[ESCALAMIENTO-2]` Ese "lo anotamos para que el equipo se lo pida" describe una
acción de la plataforma (intimar al acreedor, CA-13) que se ejecuta en las specs
014/015. Si esa gestión no está disponible cuando salga esta feature, **el texto
promete algo que no ocurre** y hay que cambiarlo por "Cuando tengas el resumen
completo, cargalo acá". Depende de una decisión de secuencia, no mía. Ver §9.

#### Los cinco estados de C-4

| Estado | Qué se ve |
| --- | --- |
| **Vacío** | No aplica: el bloque existe porque falta algo. Si no falta nada, no se renderiza |
| **Cargando** | Al guardar: el botón primario pasa a "Guardando…" con `aria-busy`, no desaparece, no aparece overlay |
| **Error** | `problema` bajo el campo: "No pudimos guardar el dato. Lo tenemos anotado en este teléfono y lo vamos a mandar cuando vuelva la conexión. Podés seguir." — **el dato no se pierde** |
| **Parcial** | Cargó 2 de 3 datos: el bloque dice "Con lo que cargaste ya pudimos revisar los intereses. Falta 1 dato para revisar el plazo del informe de crédito." Y se muestra **lo que se desbloqueó**, no sólo lo que falta |
| **Éxito** | "Listo. Estamos volviendo a revisar con este dato." + el análisis vuelve a estado `Cargando` en C-1 |

---

### C-5 · Sin resultado, variante B: **materia excluida** (CA-63)

`ChipEstado`: **`Lo ve un abogado primero`** · Panel `pendiente` · Ícono `derivacion`

**El problema de tono.** Si esto se dice mal, el cliente entiende "el sistema no
sabe hacer tu caso" — y de ahí a "este producto no sirve para mí" hay un paso.
Y es exactamente al revés: el sistema **sí** sabe que este tema tiene reglas
propias, más protectoras, y por eso no calcula.

**Los tres movimientos que resuelven el tono:**

1. **El sujeto es la materia, no el sistema.** No "no podemos calcular esto":
   "este tema tiene reglas propias".
2. **La razón es protectora, no técnica.** La ley es más estricta *a favor* del
   cliente en jubilaciones, alimentos y casos con chicos. Decirlo cambia el signo
   completo del mensaje.
3. **El orden correcto es el orden que estamos siguiendo.** No es un rodeo: que
   un abogado defina la regla antes de que se hagan cuentas es cómo debería ser
   siempre.

```
┌──────────────────────────────────────────────────┐
│▍↪ Este tema lo mira un abogado antes que el      │  h2, texto.xl
│▍  sistema                                        │
│▍                                                 │
│▍ Tu caso es de materia previsional: tiene que    │
│▍ ver con una jubilación o una pensión.           │
│▍                                                 │
│▍ En estos temas —y también en los de alimentos   │
│▍ y en los que hay chicos involucrados— la ley    │
│▍ es más estricta con cuánto se puede cobrar por  │
│▍ llevar el caso. En algunos casos ni siquiera    │
│▍ se puede pactar un porcentaje sobre lo que se   │
│▍ consiga.                                        │
│▍                                                 │
│▍ Como esa regla es más protectora que la         │
│▍ general, acá no hacemos la cuenta nosotros:     │
│▍ primero un abogado matriculado define qué       │
│▍ regla se aplica a tu caso, y recién después     │
│▍ se calcula. Al revés sería ponerte un número    │
│▍ que después hay que dar vuelta.                 │
│▍                                                 │
│▍ Ya está en la cola de revisión. No tenés que    │
│▍ hacer nada.                                     │
│▍                                                 │
│▍ [ Hablar con el equipo ]                        │  secundario
│▍ ⌄ ¿Por qué este tema es distinto?               │
└──────────────────────────────────────────────────┘
```

**Acordeón "¿Por qué este tema es distinto?":**

> La ley que fija cuánto puede cobrar un abogado por un caso trata aparte las
> jubilaciones y pensiones, los alimentos y los casos donde hay personas menores
> de edad. La idea es proteger a quien cobra una jubilación o a un chico que
> recibe una cuota: que el porcentaje que se lleva el profesional no se coma lo
> que se consiguió.
>
> Hoy hay dos lecturas posibles de esa norma: una dice que hay un tope, y la otra
> dice que directamente no se puede pactar un porcentaje sobre el resultado.
> Mientras esa diferencia no esté aclarada por un abogado, cualquier número que
> te demos podría estar mal en tu contra.
>
> Esto no afecta el resto de tu diagnóstico.

**Variantes de la primera oración según la materia:**

| Materia | Texto |
| --- | --- |
| Previsional | `Tu caso es de materia previsional: tiene que ver con una jubilación o una pensión.` |
| Alimentaria | `Tu caso es de alimentos: tiene que ver con una cuota alimentaria.` |
| Con menores | `En tu caso hay derechos de personas menores de edad involucrados.` |
| Más de una | `Tu caso toca más de uno de estos temas: {lista}.` |

#### Los cinco estados de C-5

| Estado | Qué se ve |
| --- | --- |
| **Vacío** | No aplica |
| **Cargando** | Esqueleto de bloque de texto. El chip aparece de entrada: no hay suspenso |
| **Error** | Si falla la consulta del estado de revisión, el bloque se muestra igual con "No pudimos ver en qué estado está la revisión. El resto de lo que dice acá sigue valiendo." |
| **Parcial** | Se sabe que la materia está excluida pero no se sabe cuál de las tres: se usa el texto genérico **"Tu caso toca un tema que la ley trata aparte."** y el resto igual. Nunca se adivina la materia |
| **Éxito (resuelto)** | Cuando el abogado dictamina: el bloque se reemplaza por el resultado, con chip `Revisado por un abogado`. Si el dictamen es que no se puede pactar, se lo dice en positivo: **"Un abogado revisó esto: en tu caso no corresponde cobrarte un porcentaje sobre el resultado."** |

---

### C-6 · Sin resultado, variante C: **régimen legal en disputa** (CA-64)

`ChipEstado`: **`Ley en discusión`** · Panel `informativo` **sin fondo** (fondo
`color.fondo`, borde 1px `color.borde`, barra 4px `color.primario`) · Ícono
`bifurcacion`

**Por qué es el tratamiento visual más apagado de los tres.** Los otros dos le
piden algo a alguien: al cliente (A) o a un abogado (B). Éste no le pide nada a
nadie: es información de contexto sobre un hecho externo. Darle el mismo peso
visual que a los otros haría que el cliente crea que hay un problema con su caso.
Por eso va último, sin fondo de color, y con un cierre que acota el alcance.

**El problema de tono.** "La ley está en discusión" puede leerse como "nada de
esto es confiable" o como "en este país no se puede saber nada". Los tres
antídotos:

1. **Nombrar que la discusión es afuera**, no en nuestro sistema. "No es una duda
   nuestra."
2. **Acotar el alcance explícitamente, en la última línea.** "Esto afecta este
   punto. El resto no cambia." Sin eso, la duda se derrama sobre todo el
   diagnóstico.
3. **Explicar por qué no ponemos un número igual**, en términos de su interés:
   una cuenta que después hay que dar vuelta lo perjudica a él, no a nosotros.

```
┌──────────────────────────────────────────────────┐
│ ⑂ Hay una discusión abierta sobre qué ley se     │  h2, texto.xl
│   aplica a este punto                            │  sin fondo, borde 1px
│                                                  │
│  Una ley de este año cambió la regla que se usa  │
│  para este cálculo. Todavía no está resuelto     │
│  qué regla rige para los casos del período en    │
│  el que cae el tuyo.                             │
│                                                  │
│  No es una duda nuestra: es una discusión legal  │
│  que está abierta y que todavía no se definió.   │
│                                                  │
│  Mientras no se defina, no ponemos un número.    │
│  Una cuenta que después hay que dar vuelta te    │
│  perjudica a vos, no a nosotros.                 │
│                                                  │
│  Esto afecta sólo a este punto. El resto de tu   │  ← línea obligatoria
│  diagnóstico no cambia.                          │
│                                                  │
│  ⌄ ¿Qué está en discusión?                       │
└──────────────────────────────────────────────────┘
```

**Acordeón "¿Qué está en discusión?":** texto corto, factual, con la cita, y
**sin opinar sobre quién tiene razón**:

> {Nombre de la norma} cambió {qué cambió} a partir del {fecha}. Para los hechos
> anteriores a esa fecha se aplicaba la regla vieja, y para los posteriores la
> nueva. Lo que no está claro es qué pasa con los hechos que caen justo en el
> medio, y hay posiciones distintas al respecto.
>
> Cuando eso se aclare, vamos a poder calcular este punto.

**Sin acción, a propósito.** No hay botón primario. Un "Avisarme cuando se
defina" sería razonable, pero **la spec no define quién dispara esa notificación
ni cuándo se reevalúa el caso** — es una regla de negocio que no me corresponde
inventar. Ver `[ESCALAMIENTO-3]` en §9.

Se aplica también a **CA-35** (tope de punitorios de tarjeta después del DNU
70/2023) y a **CA-39** (inicio del cómputo del plazo de archivo sin ratificar),
que son la misma situación desde la vista del cliente: la regla existe pero no
está definida.

#### Los cinco estados de C-6

| Estado | Qué se ve |
| --- | --- |
| **Vacío** | No aplica |
| **Cargando** | Esqueleto de tres líneas. Contenido estático: casi nunca se ve |
| **Error** | El bloque es contenido estático de plantilla: si falla el resto de la pantalla, se muestra igual |
| **Parcial** | Si se sabe que hay disputa pero no cuál: **"Hay una discusión abierta sobre qué ley se aplica a este punto."** sin el acordeón. Nunca se nombra una norma que no se tiene |
| **Éxito (resuelto)** | Al cargarse y ratificarse el parámetro de transición, el bloque se reemplaza por el hallazgo o por "Ya se aclaró: {resultado}". **Nunca desaparece sin decir nada** |

---

### C-7 · Bloque de no confusión: prescripción vs. caducidad del archivo (CA-62)

**Propósito.** Evitar que el cliente concluya "la deuda se borró" cuando aparecen
los dos hallazgos juntos. Implementa la condición C-12.

**Dónde va.** **Entre** los dos bloques, no debajo de ambos y nunca como nota al
pie. Si aparece un solo hallazgo de los dos, este bloque **no** se muestra: sería
introducir una confusión que el cliente no tenía.

**Móvil** — dos filas etiquetadas, porque dos columnas a 320px no se leen:

```
┌──────────────────────────────────────────────────┐
│ ⇄  Estas dos cosas se parecen y no son lo mismo  │  h2, informativo
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │ Lo de los intereses y el tiempo            │  │
│  │ (prescripción)                             │  │
│  │ Tiene que ver con si te pueden reclamar    │  │
│  │ la deuda o no.                             │  │
│  └────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────┐  │
│  │ Lo del informe de crédito                  │  │
│  │ (caducidad del dato)                       │  │
│  │ Tiene que ver con si la deuda puede        │  │
│  │ seguir apareciendo en los informes.        │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  Las dos cosas van por caminos separados:        │
│                                                  │
│  • Que un dato salga de los informes de          │
│    crédito **no borra la deuda**. Te la pueden   │
│    seguir reclamando.                            │
│  • Que una deuda sea vieja **no la saca sola**   │
│    de los informes: puede seguir figurando ahí   │
│    con todo derecho.                             │
│                                                  │
│  Ninguna de las dos se arregla sola: hay que     │
│  reclamarlas, y cada una por su lado.            │
└──────────────────────────────────────────────────┘
```

**Web** — las mismas dos cajas en dos columnas, con la lista debajo ocupando el
ancho completo.

La jerga entre paréntesis ("prescripción", "caducidad del dato") aparece **después**
de la explicación llana, no antes, y sólo una vez: el cliente va a escuchar esas
palabras de boca del acreedor o del abogado y tiene que poder reconocerlas.

#### Los cinco estados de C-7

| Estado | Qué se ve |
| --- | --- |
| **Vacío** | No se renderiza si no coexisten los dos hallazgos |
| **Cargando** | Sin estado propio: aparece con los bloques que compara |
| **Error** | Contenido estático de plantilla; se muestra mientras existan los dos bloques |
| **Parcial** | Si uno de los dos está en revisión y el otro confirmado, **se muestra igual**: la confusión existe aunque uno esté pendiente |
| **Éxito** | El bloque completo |

**Caso crítico:** mientras el hallazgo de prescripción está pendiente (CA-54), el
cliente **no lo ve**, así que no hay coexistencia visible y este bloque **no se
muestra**. Mostrarlo revelaría el hallazgo por implicación. Se muestra recién
cuando el de prescripción se confirma.

---

## 4. Pantallas del abogado

Otro producto. Densidad alta, teclado, `texto.sm`, sin contención emocional.

### A-1 · Bandeja de revisión

**Propósito.** Que el abogado vea la cola entera, priorice por vencimiento de
plazo (CA-55) y entre al detalle sin sacar la mano del teclado.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Revisión de hallazgos            [Filtros ▾]  [Sólo vencidos]      ? atajos │
├────────────────────────────────────────────────────────────────┬────────────┤
│ ⚑ 3 hallazgos pasaron el plazo de 10 días hábiles. Escalados.  │            │
├──┬──────────┬───────────┬──────────────┬─────────┬─────────────┤            │
│  │ Caso     │ Análisis  │ Estado       │ En cola │ Vence       │  (panel    │
├──┼──────────┼───────────┼──────────────┼─────────┼─────────────┤   de       │
│▍ │ d-8f2a11 │ A prescr. │ Pendiente    │  11 d   │ VENCIDO −1d │   detalle  │
│  │ d-4c9e02 │ A prescr. │ Pendiente    │   9 d   │ 20/09       │   A-2)     │
│  │ d-7b1d55 │ B tarjeta │ Pendiente    │   4 d   │ 25/09       │            │
│  │ d-2a6f30 │ E honor.  │ INDET. mat.  │   2 d   │ 27/09       │            │
│  │ d-9e0c14 │ C archivo │ INDET. param │   2 d   │ —           │            │
│  │ d-1f8b76 │ D embargo │ Corregido    │   —     │ —           │            │
├──┴──────────┴───────────┴──────────────┴─────────┴─────────────┤            │
│ 47 hallazgos · 12 pendientes · 3 vencidos                       │            │
└─────────────────────────────────────────────────────────────────┴───────────┘
```

- **Fila seleccionada:** barra izquierda 3px `color.primario` + fondo
  `color.fondo.sutil`. Nunca sólo color de fondo.
- **"VENCIDO":** texto en `color.problema.borde` **y** el ícono `aviso` **y** la
  palabra. Nunca sólo color (principio 6).
- **Ordenamiento por defecto:** vencidos primero, luego por fecha de vencimiento.
- **El identificador es opaco** (`d-8f2a11`), nunca el nombre del deudor (CA-60).

#### Cinco estados de A-1

| Estado | Qué se ve |
| --- | --- |
| **Vacío** | "No hay hallazgos para revisar." + "Cuando el motor emita uno, aparece acá." Sin ilustración |
| **Cargando** | 8 filas de esqueleto con la altura real de fila (40px) |
| **Error** | Banda `problema` sobre la tabla: "No se pudo cargar la cola. [Reintentar]" + si hay datos cacheados, se muestran con la banda "Datos de las 14:32" |
| **Parcial** | Tabla cargada, columna "Vence" sin datos: celda con "—" y tooltip "No se pudo calcular el vencimiento". No se oculta la fila |
| **Éxito** | La tabla |

### A-2 · Detalle del hallazgo y decisión profesional

**Propósito.** Todo lo necesario para decidir, en una pantalla, sin scroll
horizontal. Implementa CA-47, CA-51 y las salvaguardas S-03 y S-07.

```
┌───────────────────────────────────────────────────────────────────────────┐
│ d-8f2a11 · Análisis A — prescripción liberatoria     [Pendiente] VENCIDO  │
├───────────────────────────────────────────────────────────────────────────┤
│ RESULTADO DEL MOTOR                                                       │
│ Estado          PRESUNTAMENTE_PRESCRIPTA                                  │
│ Fecha estimada  14/03/2024                                                │
│ Régimen         Genérico CCyC art. 2560 · 5 años                          │
│ Desempate       No aplica — un solo régimen candidato          (CA-33)    │
├───────────────────────────────────────────────────────────────────────────┤
│ ENTRADAS USADAS                          SUPUESTOS                        │
│ Exigibilidad      12/03/2019             · No hay pagos posteriores       │
│ Tipo obligación   tarjeta_credito          registrados                    │
│ Hechos interrup.  ninguno                · No hay demanda notificada      │
│ Hechos suspens.   ninguno                · El tipo de obligación es el    │
│ Fecha evaluación  20/09/2026               declarado por el cliente       │
├───────────────────────────────────────────────────────────────────────────┤
│ CÓMPUTO                                                                   │
│ 12/03/2019 exigible  +5a → 12/03/2024  ·  sin interrupciones              │
│ ├────────────────────────────────────────────────────────────┤            │
│ 2019            2021            2023      ▲2024        2026 ▲hoy          │
├───────────────────────────────────────────────────────────────────────────┤
│ FUNDAMENTO                                                                │
│ CCyC art. 2560  [P]  plazo genérico                                       │
│ CCyC art. 2554  [P]  comienzo del cómputo                                 │
│ CCyC art. 2552  [P]  no opera de oficio                                   │
│ CCyC art. 2553  [P]  oportunidad procesal                                 │
│ Parámetros      v2026.09.1 · prescripcion.plazoGenerico = 5a  ⚑ sin       │
│                 ratificar                                                 │
├───────────────────────────────────────────────────────────────────────────┤
│ LO QUE VE EL CLIENTE HOY                                                  │
│ ┌───────────────────────────────────────────────────────────────────────┐ │
│ │ Aviso preventivo activo desde 14/09/2026. El hallazgo NO se muestra.  │ │
│ │ [Ver exactamente lo que ve]                                  (CA-54)  │ │
│ └───────────────────────────────────────────────────────────────────────┘ │
├───────────────────────────────────────────────────────────────────────────┤
│ [ Confirmar (c) ]   [ Corregir (e) ]   [ Rechazar (r) ]                   │
└───────────────────────────────────────────────────────────────────────────┘
```

**El bloque "LO QUE VE EL CLIENTE HOY" es obligatorio** y es la pieza que hace
operable la decisión 004-B: el abogado tiene que poder ver, literal, qué está
leyendo el cliente en ese momento, antes de decidir.

#### Diálogo de confirmación (CA-47, S-03)

```
┌──────────────────────────────────────────────────┐
│ Confirmar hallazgo d-8f2a11                      │
│                                                  │
│ Al confirmar, este hallazgo se le muestra al     │
│ cliente con el texto obligatorio §3.1 y la       │
│ acción recomendada. El aviso preventivo se       │
│ reemplaza.                                       │
│                                                  │
│ Matrícula *        [ T° 105 F° 442        ]      │
│ Colegio / jurisd.* [ CPACF  ▾             ]      │
│ Firma como *       [ Dra. M. Iglesias  ▾  ]      │
│                                                  │
│ ⚑ Este cálculo usa 1 parámetro sin ratificar     │
│   (prescripcion.plazoGenerico). Confirmar no     │
│   lo ratifica.                                   │
│                                                  │
│ [ Confirmar ]  [ Cancelar ]                      │
└──────────────────────────────────────────────────┘
```

- **Sin matrícula no se confirma.** El botón queda deshabilitado **con el motivo
  escrito al lado**: "Falta la matrícula. Sin ella no se puede confirmar."
- **Rechazar exige motivo** de un catálogo + campo libre. El motivo no se le
  muestra al cliente textualmente; alimenta el texto de C-3 caso rechazado.
- **Corregir** abre los campos de entrada del motor con los valores actuales,
  marca cuáles se cambiaron, y reevalúa mostrando el antes y el después.
- **Deshacer 10s** después de confirmar, con `aria-live`. Pasados los 10s se
  puede revertir igual, pero queda como una segunda decisión registrada.

#### Cinco estados de A-2

| Estado | Qué se ve |
| --- | --- |
| **Vacío** | Sin hallazgo seleccionado: "Elegí un hallazgo de la lista." + recordatorio de atajos |
| **Cargando** | Esqueleto por bloque; los botones de decisión deshabilitados con el motivo "Cargando el hallazgo" |
| **Error** | `problema`: "No se pudo cargar el hallazgo d-8f2a11. [Reintentar]". **Los botones de decisión no se muestran**: no se decide sobre lo que no se pudo leer |
| **Parcial** | Falta un bloque (p. ej. el cómputo): el bloque dice "No disponible" y **los botones siguen habilitados**, con la advertencia "Estás decidiendo sin ver el cómputo" |
| **Éxito** | La pantalla completa |

---

## 5. Pantallas del administrador

### D-1 · Catálogo de parámetros normativos

**Propósito.** Ver el estado de ratificación de todo el catálogo y demostrar
quién cargó qué, cuándo y con qué cita. Implementa CA-27, CA-28, CA-29, CA-58.

```
┌───────────────────────────────────────────────────────────────────────────┐
│ Parámetros normativos            Conjunto vigente: v2026.09.1             │
├───────────────────────────────────────────────────────────────────────────┤
│ ⚑ 12 de 58 parámetros sin ratificar.                                      │
│   El entorno productivo rechaza toda evaluación que los use (CA-58).      │
│   No hay forma de desactivar ese bloqueo por configuración.               │
├──────────────┬──────────────────────────┬──────────┬───────────┬──────────┤
│ Filtros      │ Clave                    │ Valor    │ Vigencia  │ Estado   │
│              ├──────────────────────────┼──────────┼───────────┼──────────┤
│ Análisis     │ prescripcion.            │ 5 años   │ 01/08/15  │ ⚑ Sin    │
│ [x] A        │  plazoGenerico           │          │ → —       │ ratificar│
│ [ ] B        │ prescripcion.            │ 3 años   │ 01/08/15  │ ⚑ Sin    │
│ [ ] C        │  plazoTarjeta            │          │ → —       │ ratificar│
│ [ ] D        │ archivoCrediticio.       │ 5 años   │ 02/11/00  │ ✓ Ratif. │
│ [ ] E        │  plazoGeneralBureau      │          │ → —       │          │
│              │ archivoCrediticio.       │ —        │ —         │ ✕ A      │
│ Estado       │  diesAQuo                │          │           │  determ. │
│ [x] Sin rat. │ intereses.topeTarjeta    │ —        │ 29/12/23  │ ! Contra-│
│ [x] A determ.│  Punitorio.postDNU       │          │ → —       │  dicción │
│ [x] Contrad. │ honorarios.cuotaLitis.   │ 30 %     │ 22/12/17  │ ⚑ Sin    │
│ [ ] Ratific. │  maximoGeneral           │          │ → —       │ ratificar│
│              │ honorarios.cuotaLitis.   │ —        │ —         │ ✕ Materia│
│ Confiabilidad│  materiasProtegidas      │          │           │  excluida│
│ [ ] V  [x] C │ lct.art277.regimen       │ —        │ 06/03/26  │ ! Régimen│
│ [x] P  [x] D │  Transicion              │          │ → —       │  disputa │
│ [x] !        │                          │          │           │          │
└──────────────┴──────────────────────────┴──────────┴───────────┴──────────┘
```

**Estados de un parámetro y su tratamiento visual:**

| Estado | Marca | Tratamiento | Consecuencia declarada en la fila |
| --- | --- | --- | --- |
| Ratificado | `✓` `confirmado` | Fila normal | Usable en producción |
| Sin ratificar | `⚑` `atencion` | Fila con barra izquierda ámbar | "Producción rechaza la evaluación" |
| A determinar `[D]` | `✕` `pendiente` | Fila con barra índigo, valor en blanco | "El análisis devuelve INDETERMINABLE" |
| Contradicción `[!]` | `!` `atencion` | Barra ámbar + ícono `bifurcacion` | "El motor no evalúa sobre este parámetro" |
| Materia excluida | `✕` `pendiente` | Barra índigo | "El análisis E no se evalúa en estas materias (CA-63)" |
| Régimen en disputa | `!` `atencion` | Barra ámbar + `bifurcacion` | "Se devuelve INDETERMINABLE (CA-64)" |

**Nunca se muestra un valor propuesto como si fuera vigente.** Un `[D]` tiene la
celda de valor **vacía**, no un número gris.

**Panel de detalle** (al seleccionar una fila): clave completa en `fuente.mono`,
valor, unidad, vigencia desde/hasta, cita normativa literal, marcador de
confiabilidad `[V]/[C]/[P]/[D]/[!]` con su significado desplegado, historial de
versiones con quién y cuándo, y **en qué evaluaciones se usó** (trazabilidad
hacia adelante). Botón "Ratificar" deshabilitado con el motivo escrito si el
usuario no tiene el rol.

#### Cinco estados de D-1

| Estado | Qué se ve |
| --- | --- |
| **Vacío** | Catálogo sin cargar: "El catálogo de parámetros está vacío. Sin parámetros, el motor devuelve INDETERMINABLE en los cinco análisis." + "Importar conjunto inicial" |
| **Cargando** | 12 filas de esqueleto. **La banda de "sin ratificar" no se muestra hasta tener el número real**: un "0" transitorio sería peligroso |
| **Error** | `problema` sobre la tabla + "No se pudo cargar el catálogo. **No asumas que está todo bien.** [Reintentar]" |
| **Parcial** | Filas cargadas sin historial: columna de estado con "—" y aviso "Falta el historial de 4 parámetros. La tabla se puede leer, pero no auditar todavía" |
| **Éxito** | La tabla con el conteo real |

### D-2 · Valores de referencia pendientes de activación (CA-59)

> **Alcance.** La spec 004 §8 pone **fuera de alcance** el adaptador que obtiene
> los valores y la pantalla de activación: son de la spec **022** y de
> `dev-integraciones`. Se especifica acá **sólo para que el sistema de diseño sea
> coherente** y para que la 004 tenga dónde mostrar el estado "obtenido pero no
> activado", que sí es suyo (CA-59). **No forma parte del alcance de
> implementación de la 004.**

```
┌───────────────────────────────────────────────────────────────────────────┐
│ Valores de referencia                                                     │
├───────────────────────────────────────────────────────────────────────────┤
│ ⚑ 2 valores obtenidos automáticamente esperan activación de una persona.  │
│   Hasta que se activen, el motor NO los usa en ninguna evaluación.        │
├───────────────────────────────────────────────────────────────────────────┤
│ SMVM · Salario mínimo vital y móvil                                       │
│  En uso     $ 322.200   vigente desde 01/08/2026                          │
│             activado por J. Pérez el 03/08/2026                           │
│  Obtenido   $ 341.400   vigente desde 01/09/2026   (+5,96 %)              │
│             fuente: Resolución CNEPySMVM · obtenido el 19/09/2026 09:12   │
│                                                                           │
│  Activar este valor cambia el cálculo de 1.284 evaluaciones futuras.      │
│  Las evaluaciones ya hechas no se modifican (CA-31).                      │
│                                                                           │
│  [ Revisar y activar ]   [ Rechazar el valor obtenido ]                   │
└───────────────────────────────────────────────────────────────────────────┘
```

La activación es una decisión con consecuencias sobre toda la cartera: pantalla
de confirmación aparte, con el delta, el conteo de impacto y **escritura del
valor a mano** para confirmar (no un simple "Sí"). Sin deshacer silencioso: la
reversión es una segunda activación registrada.

#### Cinco estados de D-2

| Estado | Qué se ve |
| --- | --- |
| **Vacío** | "No hay valores nuevos para activar." + el valor en uso con su fecha |
| **Cargando** | Esqueleto de dos tarjetas |
| **Error** | "No se pudo consultar la fuente desde el 19/09. **El valor en uso sigue siendo el de agosto.** El motor no usa un valor no activado ni un valor vencido en silencio (CA-59)." |
| **Parcial** | Valor obtenido sin fecha de vigencia: **no se ofrece activarlo.** "Falta la fecha de vigencia del valor obtenido. No se puede activar sin ella" |
| **Éxito** | La tarjeta con ambos valores |

---

## 6. Conexión pobre, offline y diferencias web / móvil

### 6.1 Presupuesto

| Recurso | Tope |
| --- | --- |
| Pantalla de diagnóstico, primera carga | ≤ 60 KB de datos (sin imágenes, sin fuentes) |
| Íconos | inline, ≤ 8 KB total |
| Fuentes web | **cero** (`tokens.md` §3.1) |
| Ilustraciones | cero en la app del cliente |
| Tiempo a primer contenido útil en gama baja con 3G | ≤ 3 s |

### 6.2 Los cuatro modos de conexión

| Modo | `BandaConexion` | Qué se ve | Qué se puede hacer |
| --- | --- | --- | --- |
| **Con red** | oculta | Todo | Todo |
| **Red lenta** | oculta hasta 5 s; después "Está tardando más de lo normal" | Lo cacheado primero, se actualiza al llegar | Todo, con cola |
| **Sin red, con caché** | "Sin conexión. Estás viendo lo último que guardamos." | **Aviso preventivo completo**, último diagnóstico con su fecha, textos obligatorios | Leer todo. Completar formularios (se encolan). No se ve el estado de la cola del abogado |
| **Sin red, sin caché** | "Sin conexión." | `EstadoVacio` honesto | Reintentar. Nada más |

**Sin red y sin caché:**

> **Sin conexión**
> Todavía no guardamos nada de esta deuda en el teléfono, así que no tenemos qué
> mostrarte. En cuanto haya señal lo traemos.
> [ Volver a intentar ]

### 6.3 Diferencias web / móvil, por audiencia

| | Móvil (cliente) | Web (cliente) | Web (abogado / admin) |
| --- | --- | --- | --- |
| Ancho de contenido | Fluido, margen 16 | **720px máx.** | Fluido |
| Aviso preventivo | Bloque fijo en el tope del scroll de la pantalla de la deuda | Ídem + **repetido en el panel lateral de la lista de deudas**, porque la lista y el detalle conviven | No aplica (el abogado ve A-2 "lo que ve el cliente") |
| Densidad | 1 columna, 1 tarjeta por bloque | 1 columna | Tabla + panel |
| Texto obligatorio §3 | `texto.base`, ancho 60 caracteres | ídem | `texto.base`, nunca `texto.sm` |
| C-7 no confusión | 2 filas apiladas | 2 columnas | No aplica |
| Sin resultado | Acordeones cerrados, se abren de a uno | Todos abiertos (hay espacio) | Fila de tabla + panel |
| Notificaciones | Push + correo | Correo + campana en la app | Campana + correo para vencimientos (CA-55) |
| Teclado | No | `Tab` y `Enter` completos | **Atajos obligatorios** (sistema §4.4) |
| Offline | Caché completa, cola de acciones | Caché de lectura del último diagnóstico | Sin soporte offline: se declara y se muestra la banda |
| Impresión / PDF | No | **Sí**: el diagnóstico se puede guardar como PDF, con los textos obligatorios completos y el pie de procedencia desplegado | Sí |

**Por qué en web el cliente no usa todo el ancho.** El contenido central son
párrafos legales. A 1400px de ancho, una línea de 180 caracteres es ilegible y el
ojo pierde el renglón. 720px con 60 caracteres por línea es la misma legibilidad
que en el teléfono.

**Por qué en móvil los "sin resultado" están plegados y en web no.** En una
pantalla de 5,5" tres bloques de "no pudimos" abiertos ocupan dos scrolls enteros
y dan la sensación de que el sistema no sirvió. Plegados con su chip visible, el
cliente ve **cuántos** son y **de qué tipo** cada uno, y abre el que le interesa.
El chip nunca se pliega.

### 6.4 El aviso preventivo cacheado — sin vencimiento

Referenciado desde `tokens.md` §9 (`cache.avisoPreventivo`).

**Regla.** El aviso preventivo de CA-54 se guarda en el dispositivo y **no
expira por tiempo**. Se borra únicamente cuando el servidor confirma
explícitamente que ya no aplica (el hallazgo fue confirmado o rechazado).

**Por qué es distinto de todo el resto de la caché:**

1. El diagnóstico cacheado vence a los 30 días (`cache.diagnostico`) porque un
   dato viejo mostrado como actual desinforma. **El aviso preventivo no
   desinforma con el tiempo**: "no firmes ni pagues hasta que lo revisemos" sigue
   siendo correcto al día 40.
2. El daño de que falte es asimétrico y grave. Si el diagnóstico no está, el
   cliente no se entera de algo. Si el aviso no está, el cliente **firma un plan
   de pago** y pierde una defensa. No son comparables.
3. El momento de mayor riesgo —el llamado del estudio de cobranzas— es
   justamente cuando la persona está en la calle, con el teléfono, quizá sin
   datos. Es cuando el aviso tiene que estar.

**Reglas de implementación del caché:**

| Regla | |
| --- | --- |
| Se guarda | Apenas se recibe, antes de renderizar el resto |
| Se muestra offline | Íntegro, con el texto completo y el acordeón "¿Por qué?" |
| Se marca | Con "Guardado el {fecha}" en el pie del bloque, **no** con la banda genérica de datos viejos: el aviso no es un dato viejo |
| Se borra | Sólo con confirmación explícita del servidor de que el hallazgo se resolvió |
| No se borra | Al cerrar sesión, al limpiar la caché de la app, ni al pasar los 30 días del diagnóstico |
| Si la app se desinstala | Se pierde. Por eso el aviso también va por correo (§3, C-2) |

### 6.5 Cola de acciones sin red

Todo lo que el cliente hace sin red se encola y se le dice:

> **Lo guardamos en el teléfono.** Lo vamos a mandar en cuanto vuelva la
> conexión. No hace falta que lo hagas de nuevo.

La cola es visible (no un ícono escondido) y muestra qué hay pendiente. Al
enviarse: "Listo, se envió." con `aria-live="polite"`, sin *toast* efímero.

---

## 7. Accesibilidad

Piso: `sistema-de-diseno.md` §8. Específico de esta feature:

### 7.1 Contrastes usados en estas pantallas

Todos verificados en `tokens.md` §1.4. Los que cargan la feature:

| Elemento | Par | Ratio | Umbral |
| --- | --- | --- | --- |
| Cuerpo del aviso preventivo | `#1B2A33` sobre `#FBF1DF` | **13.16:1** | 7.0 |
| Encabezado obligatorio §3.0 y textos §3.x | `#1B2A33` sobre `#FFFFFF` | **14.73:1** | 7.0 |
| Chip "Aviso importante" | `#6B4708` sobre `#FBF1DF` | **7.41:1** | 4.5 |
| Chip "En revisión" / "Lo ve un abogado primero" | `#3E4A7A` sobre `#ECEEF8` | **7.36:1** | 4.5 |
| Chip "Revisado por un abogado" | `#14603C` sobre `#E7F2EC` | **6.61:1** | 4.5 |
| Chip "Falta un dato" / "Ley en discusión" | `#0F5468` sobre `#E6F1F4` | **7.34:1** | 4.5 |
| Enlace dentro del aviso | `#0F5468` sobre `#FBF1DF` | **7.54:1** | 4.5 |
| Barra 4px del aviso | `#B87D10` sobre `#FBF1DF` | **3.14:1** | 3.0 |
| Barra 4px de C-6 sobre blanco | `#0F5468` sobre `#FFFFFF` | **8.44:1** | 3.0 |
| Borde 1px del panel de C-6 | `#6B7B86` sobre `#FFFFFF` | **4.37:1** | 3.0 |
| Texto de error del sistema | `#8C3A22` sobre `#FBEDE8` | **6.70:1** | 4.5 |
| Botón primario | `#FFFFFF` sobre `#0F5468` | **8.44:1** | 4.5 |
| Tabla del abogado, fila normal | `#1B2A33` sobre `#FFFFFF` | **14.73:1** | 4.5 |
| Tabla del abogado, fila alterna | `#1B2A33` sobre `#F5F6F7` | **13.62:1** | 4.5 |
| Metadato de tabla | `#5E6E79` sobre `#F5F6F7` | **4.87:1** | 4.5 |

Ningún par de estas pantallas queda por debajo de su umbral.

### 7.2 Los tres "sin resultado" sin depender del color

Cada variante se distingue por **cuatro** señales independientes, de las cuales
tres sobreviven en escala de grises y dos en lector de pantalla:

| | Chip (texto) | Ícono (forma) | Título (palabras) | Acción |
| --- | --- | --- | --- | --- |
| A | `Falta un dato` | recuadro punteado con `+` | "necesitamos saber…" | botón primario |
| B | `Lo ve un abogado primero` | flecha saliendo hacia busto | "lo mira un abogado antes…" | sin acción primaria |
| C | `Ley en discusión` | línea que se bifurca | "hay una discusión abierta…" | sin acción |

En escala de grises los tres siguen siendo distinguibles por chip, ícono y
título. Con lector de pantalla, por chip y título. **Ninguno depende del color.**

### 7.3 Orden de foco en C-1

```
1. Volver
2. h1 (título de la deuda)
3. Región "Aviso importante" (role=region, aria-label)
4.   Botón "Hablar con el equipo"
5.   Acordeón "¿Por qué me dicen esto?"
6. Región del encabezado obligatorio §3.0 (role=region, no focusable su texto)
7. Resumen de la deuda → botón "Corregir"
8. Cada tarjeta de análisis, en orden visual
9. Bloque "No son lo mismo"
10. Cada bloque de "sin resultado", en orden A, B, C
11. PieProcedencia (botón de desplegar)
```

El aviso preventivo es el **tercer** elemento enfocable y el primero con
contenido. No se puede saltear por skip-link.

### 7.4 Lector de pantalla

| Situación | Anuncio |
| --- | --- |
| Aviso preventivo aparece por primera vez | `aria-live="assertive"` una sola vez: "Aviso importante sobre tu deuda con {acreedor}." Luego la región se lee en el flujo normal |
| Aviso preventivo en visitas siguientes | Sin `assertive`. Se lee en el flujo |
| Chip de estado | Se lee la palabra completa: "Estado: en revisión". Nunca el color |
| Cifra estimada | "Estimado: ciento veintiocho mil cuatrocientos pesos. Es una estimación con los datos que cargaste." — la aclaración está en el mismo nodo accesible, no puede leerse la cifra sin ella |
| Carga | `aria-busy="true"` + `aria-live="polite"` una vez: "Cargando el diagnóstico" |
| Error | `role="alert"` con el texto completo del error |
| Guardado offline | `aria-live="polite"`: "Guardado en el teléfono. Se envía cuando vuelva la conexión" |
| Tabla del abogado | `<table>` real con `scope` en encabezados; fila seleccionada con `aria-selected` |

### 7.5 Límites conocidos

| # | Límite | Plan |
| --- | --- | --- |
| L-1 | Los textos obligatorios del dictamen §3 son largos (hasta 180 palabras). Con lector de pantalla son ~70 segundos | No se pueden acortar sin autorización legal. Cada bloque lleva encabezado propio para poder navegar por encabezados. Ver propuesta en §9 |
| L-2 | No hay versión en lengua de señas ni lectura fácil | Fuera de alcance de esta feature. Se propone para el backlog |
| L-3 | La línea de tiempo del cómputo (A-2) es gráfica | Tiene equivalente textual completo arriba ("12/03/2019 exigible +5a → 12/03/2024"). El gráfico es `aria-hidden` |

---

## 8. Microcopy — consolidado de errores y estados

Todo texto visible que no está ya escrito en las pantallas de §3 a §5.

### 8.1 Errores (cliente)

| Situación | Texto |
| --- | --- |
| Falla de red al cargar | `No pudimos traer el diagnóstico. Es un problema nuestro, no tuyo. Tus datos están guardados.` + `[Volver a intentar]` |
| Timeout (20 s) | `Está tardando demasiado. Probá de nuevo en un rato; no perdiste nada.` |
| Falla al guardar un dato | `No pudimos guardar el dato. Lo tenemos anotado en este teléfono y lo vamos a mandar cuando vuelva la conexión.` |
| Sesión vencida | `Se cerró tu sesión por seguridad. Entrá de nuevo y volvés justo acá.` |
| Deuda no encontrada | `No encontramos esta deuda. Puede que se haya borrado desde otro dispositivo.` + `[Ver mis deudas]` |
| El motor falló en un análisis | `No pudimos completar esta parte del análisis. El resto sigue valiendo. Ya lo estamos mirando.` |
| Dato inválido: fecha futura | `Esa fecha es posterior a hoy. Revisala: puede ser un error de tipeo.` |
| Dato inválido: fecha anterior a la exigibilidad | `Esa fecha es anterior a cuando empezó la deuda. Revisala.` |
| Sin permisos (plan) | **No existe.** Ninguna salida de esta feature está detrás de un plan (CA-56) |

### 8.2 Estados vacíos (cliente)

| Pantalla | Título | Cuerpo | Acción |
| --- | --- | --- | --- |
| Sin deudas cargadas | `Todavía no cargaste ninguna deuda.` | `Cuando cargues una, la revisamos y te contamos qué encontramos.` | `Cargar una deuda` (de la 007) |
| Deuda sin evaluar | `Todavía no revisamos esta deuda.` | `En cuanto la revisemos, vas a ver acá qué encontramos y qué no.` | `Avisarme cuando esté` |
| Sin hallazgos y sin faltantes | `Miramos esta deuda y no encontramos nada para reclamar.` | `Eso no significa que la deuda esté bien calculada: significa que con los datos que tenemos no vimos nada. Si conseguís el resumen completo o el contrato, lo volvemos a mirar.` | `Agregar documentación` |

El tercer caso es importante: **"no encontramos nada" no se presenta como buena
noticia ni como fracaso**, y se dice explícitamente qué alcance tiene esa
afirmación.

### 8.3 Errores (abogado / administrador)

| Situación | Texto |
| --- | --- |
| Confirmar sin matrícula | `Falta la matrícula. Sin ella no se puede confirmar (CA-47).` |
| Rechazar sin motivo | `Elegí un motivo. Queda registrado con tu decisión.` |
| Conflicto de edición | `Otro usuario decidió sobre este hallazgo hace {n} minutos. Recargá antes de seguir.` |
| Ratificar sin rol | `No tenés permiso para ratificar parámetros. Pedíselo a un administrador.` |
| Activar valor sin fecha de vigencia | `Falta la fecha de vigencia del valor obtenido. No se puede activar sin ella (CA-59).` |
| Evaluación bloqueada en producción | `La evaluación se rechazó: usa {n} parámetros sin ratificar. El bloqueo no se puede desactivar (CA-58).` |

### 8.4 Palabras que usamos y las que no

| No decimos | Decimos |
| --- | --- |
| Saldo deudor consolidado | Lo que te reclaman hoy |
| Prescripción liberatoria | Si te la pueden reclamar o no |
| Caducidad del dato / plazo de archivo | Cuánto tiempo puede figurar en los informes |
| Capitalización de intereses / anatocismo | Intereses sobre intereses |
| Morigeración judicial | Pedirle a un juez que los baje |
| Hecho interruptivo | Algo que hace que el reloj vuelva a cero |
| Inembargable | No te lo pueden descontar |
| Cuota litis | Un porcentaje de lo que se consiga |
| INDETERMINABLE | Falta un dato / Lo ve un abogado primero / Ley en discusión |
| Pendiente de validación profesional | En revisión |
| Su caso, usted, se requiere | Tu caso, vos, necesitamos |

En los portales de abogado y administrador se usa el término técnico, siempre.

---

## 9. Textos obligatorios: observaciones y escalamientos

Los textos del dictamen §3 son **vinculantes y no los reescribo**. Lo que sigue
son observaciones y propuestas para que `compliance-legal` y el estudio decidan.

### 9.1 `[ESCALAMIENTO-A]` — §3.5 contradice la decisión sobre CA-23. **Bloqueante.**

El texto obligatorio §3.5 dice:

> "Sumando el honorario del abogado y nuestra comisión, no se puede pasar de
> {porcentaje} de lo que se obtenga."

La decisión de G1 sobre CA-23 fue **topes separados**: el límite arancelario
alcanza sólo al honorario, y la comisión se valida contra su propio tope
contractual (R-11, constitución #10). **El texto obligatorio afirma exactamente
lo contrario de lo que la spec aprobada manda calcular.** El propio dictamen lo
anticipa (`[I]` al pie de §3.5: "si el límite no es conjunto, este texto hay que
reescribirlo por completo").

No puedo mostrarle al cliente un texto que describe mal la regla. **Propuesta de
reemplazo, sujeta a ratificación:**

> **Lo que se te puede cobrar por este caso tiene dos máximos, no uno.**
> Uno es el máximo que puede cobrar el abogado: lo fija la ley y depende de la
> provincia y del tipo de caso. El otro es el máximo que podemos cobrarte
> nosotros por gestionarlo: lo fija nuestro contrato con vos.
> Son dos cosas separadas y cada una tiene su tope. Te mostramos los dos.
> Si además la suma de los dos se lleva una parte grande de lo que vos ganarías,
> te lo decimos y no seguimos sin tu autorización expresa.
> Si la propuesta que tenés supera cualquiera de los dos máximos, no la firmes.

(La última oración de la propuesta cubre CA-44 sin prometer un resultado.)

### 9.2 `[ESCALAMIENTO-B]` — falta el texto obligatorio de la materia excluida (CA-63)

§3.6 cubre sólo el INDETERMINABLE por falta de dato ("Nos falta: {dato
faltante}"). **No hay texto obligatorio para CA-63.** Usar §3.6 acá sería decir
"nos falta un dato" cuando no falta ninguno, y es falso.

**Propuesta de §3.6.b**, para ratificar — el texto de C-5:

> **Este tema lo mira un abogado antes que el sistema.**
> Tu caso es de materia {previsional / alimentaria / con personas menores de edad
> involucradas}. En esos temas la ley es más estricta con cuánto se puede cobrar
> por llevar el caso, y en algunos casos directamente no se puede pactar un
> porcentaje sobre lo que se consiga.
> Como esa regla es más protectora que la general, acá no hacemos la cuenta:
> primero un abogado matriculado define qué regla se aplica a tu caso y recién
> después se calcula. No tenés que hacer nada.

### 9.3 `[ESCALAMIENTO-C]` — falta el texto obligatorio del régimen en disputa (CA-64)

Misma situación. **Propuesta de §3.6.c** — el texto de C-6:

> **Hay una discusión abierta sobre qué ley se aplica a este punto.**
> Una ley reciente cambió la regla que se usa para este cálculo, y todavía no
> está resuelto qué regla rige para los casos del período en el que cae el tuyo.
> No es una duda nuestra: es una discusión legal en curso.
> Mientras no se defina, no ponemos un número: una cuenta que después hay que dar
> vuelta te perjudica a vos. **Esto afecta sólo a este punto; el resto de tu
> diagnóstico no cambia.**

### 9.4 `[ESCALAMIENTO-D]` — el cierre de §3.1 está escrito para el escenario que la decisión 004-B descartó

El texto §3.1 cierra con:

> "**Qué hacer ahora:** no firmes ni pagues nada de esta deuda y esperá a que un
> abogado la revise. Te avisamos cuando esté revisada."

Pero bajo la decisión 004-B, §3.1 **sólo se le muestra al cliente cuando el
abogado ya revisó y confirmó** (CA-54). El cierre le dice que espere una revisión
que ya ocurrió: es incoherente y le resta credibilidad a todo el bloque. Además
CA-57 exige que el hallazgo confirmado vaya "siempre con la acción recomendada
concreta", y "esperá a que lo revisen" no es una acción concreta post-revisión.

**Propuesta de cierre alternativo para §3.1**, sólo para el caso confirmado:

> **Qué hacer ahora:** no reconozcas esta deuda, no firmes planes de pago y no
> hagas pagos parciales. Un abogado ya revisó este análisis y tiene tu caso:
> hablá con él antes de responderle a quien te reclama.

(Los puntos 1, 2 y 3 del §3.1 quedan intactos.)

### 9.5 `[ESCALAMIENTO-E]` — no hay texto obligatorio para la inembargabilidad previsional (CA-41)

§3.4 cubre el embargo de sueldo y la cuenta sueldo. CA-41 introdujo un resultado
nuevo —**INEMBARGABLE por regla** para haberes previsionales— y no tiene texto
obligatorio. Es un resultado de alto impacto para el cliente (le están
descontando de una jubilación) y no puede salir sin texto ratificado.

### 9.6 `[ESCALAMIENTO-F]` — legibilidad del §3.1

Es el texto obligatorio más largo (≈180 palabras, tres puntos numerados). Es el
correcto en contenido y **no propongo recortarlo**. Propongo dos cosas que no
tocan el texto:

1. Que los tres puntos numerados lleven **subtítulo propio** en `peso.fuerte`
   (ya vienen resaltados en el original), para poder navegarlos por encabezado
   con lector de pantalla.
2. Que se autorice una **frase de resumen encima, no en reemplazo**, con el mismo
   peso visual: `Tres cosas importantes antes de hacer nada con esta deuda.`

### 9.7 Otros escalamientos

| # | Qué | Por qué no lo resuelvo yo |
| --- | --- | --- |
| `[ESCALAMIENTO-1]` | El párrafo "¿Y si me llaman del estudio de cobranzas?" del acordeón de C-2 | Orienta conducta frente a un tercero. Creo que queda del lado permitido de S-04, pero lo decide `compliance-legal` |
| `[ESCALAMIENTO-2]` | El texto de CA-13 dice "lo anotamos para que el equipo se lo pida al acreedor" | Depende de que la gestión de intimación (specs 014/015) exista al salir esta feature. Es una decisión de secuencia del orquestador |
| `[ESCALAMIENTO-3]` | No hay acción "Avisarme cuando se defina" en C-6 | La spec no define quién dispara la reevaluación de un caso cuando se ratifica un parámetro en disputa, ni si se notifica al cliente. Es regla de negocio, no diseño |
| `[ESCALAMIENTO-4]` | Qué pasa con el aviso preventivo si el cliente se da de baja o borra la deuda | CA-54 a CA-57 no lo contemplan. Mi criterio sería que el aviso se muestre en la confirmación de baja, pero es una regla |
| `[ESCALAMIENTO-5]` | Si hay más de un hallazgo de prescripción pendiente sobre deudas distintas, ¿un aviso o varios? | Diseñé **uno solo** que las nombra a todas (menos angustia, mismo efecto). Si legal prefiere uno por deuda, se cambia |

### 9.8 Confirmación de que no hay pantallas contra el interés del cliente

Revisé la spec 004 contra el principio 1 de la constitución. **No encontré ningún
flujo que empuje al cliente a una decisión contraria a su interés.** Dos puntos
que miré con atención y por qué los considero limpios:

- **El diferimiento del hallazgo de prescripción (CA-54)** podría parecer que
  guarda información en perjuicio del cliente. No lo es, porque CA-56 lo hace
  gratuito e incondicional y CA-55 le pone plazo con escalamiento, y porque la
  advertencia preventiva le entrega **la parte accionable** de la información
  desde el minuto cero. El diseño refuerza eso prohibiendo cualquier módulo
  comercial en la pantalla del aviso.
- **CA-44** (alerta cuando honorario + comisión se llevan una parte grande del
  beneficio) es lo contrario: una pantalla que protege al cliente contra el
  ingreso de la plataforma. Está diseñada para que la alerta sea visible al
  cliente y no sólo interna.

---

## 10. Componentes usados

### 10.1 Del sistema de diseño

`PanelSemantico` (5 variantes) · `BloqueAvisoLegal` · `ChipEstado` · `Boton` ·
`Campo` · `Tarjeta` · `Acordeon` · `Esqueleto` · `EstadoVacio` ·
`BandaConexion` · `TablaDensa` · `PieProcedencia`

### 10.2 Nuevos, definidos por esta feature

| Componente | Descripción | Dónde queda |
| --- | --- | --- |
| `BloqueAvisoPreventivo` | Variante fija de `PanelSemantico atencion` con estructura obligatoria de 6 partes, no plegable, con acordeón "¿Por qué?" y prohibición de módulo comercial adyacente | `sistema-de-diseno.md` §7.3 |
| `BloqueSinResultado` | Tres variantes (A / B / C) con chip, ícono, título, cuerpo y acción propios | `sistema-de-diseno.md` §7.2 |
| `BloqueNoConfusion` | Dos cajas contrastadas + lista de diferencias. Se inserta entre los dos bloques que compara | `sistema-de-diseno.md` §7.4 |
| `CifraEstimada` | Rótulo "Estimado" antepuesto + cifra + aclaración en el mismo nodo accesible | `sistema-de-diseno.md` §7.6 |
| `VistaPreviaCliente` | Panel del portal del abogado que muestra, literal, lo que el cliente está viendo en ese momento | Sólo A-2 |
| `FilaParametro` | Fila de `TablaDensa` con estado de ratificación, marcador de confiabilidad y consecuencia declarada | Sólo D-1 |

### 10.3 Cambios a `tokens.md`

**Ninguno.** Todas las pantallas de esta feature se resuelven con los tokens
existentes. Las tres variantes de "sin resultado" reutilizan `informativo`,
`pendiente` y `informativo sin fondo` (fondo `color.fondo` + `borde.1` +
`borde.acento` con `color.primario`), todos ya verificados en `tokens.md` §1.4.

Único cambio hecho en `tokens.md`: la fila **T-01** de §10, que remitía a una
sección inexistente. Ahora `sistema-de-diseno.md` §6.3 existe y T-01 queda
acotado a "dibujar los 24 trazos".

---

## 11. Trazabilidad: criterio de aceptación → correlato visible

Sólo los criterios con consecuencia en la interfaz.

| CA | Dónde se ve |
| --- | --- |
| CA-07, CA-10, CA-13 | **C-4** variante A, con el dato faltante nombrado |
| CA-08 | Texto §3.1 íntegro en **C-3**; punto 2 cubre el efecto interruptivo |
| CA-26, CA-52 | **C-4** (jurisdicción cubierta, dato faltante) o **C-6** (sin parámetros) |
| CA-27 | `PieProcedencia` en **C-3**, **A-2** y **D-1** |
| CA-28 | Chip `Dato legal sin confirmar` + texto §3.7 + franja de pantalla. Patrón §7.5 del sistema |
| CA-31 | **D-2**: "Las evaluaciones ya hechas no se modifican" |
| CA-32 | `CifraEstimada`, redondeo a peso en cliente, centavos exactos en abogado |
| CA-33 | **A-2**, bloque "Régimen / Desempate". Nunca se elige en silencio |
| CA-35, CA-39 | **C-6** (régimen en disputa) y **D-1** (parámetro `[!]`) |
| CA-41 | Resultado INEMBARGABLE — **sin texto obligatorio**, ver `[ESCALAMIENTO-E]` |
| CA-44 | Alerta visible al cliente en el hallazgo E + "no seguimos sin tu autorización expresa" |
| CA-45 | §8.4 (palabras que no usamos) + revisión de todo el microcopy de este documento |
| CA-46 | Chip `En revisión` en todo hallazgo no confirmado |
| CA-47 | **A-2**, diálogo de confirmación con matrícula obligatoria |
| CA-48 | **C-3**, bloque "Qué sigue": sólo *no innovar* y *consultar al abogado* |
| CA-49 | `BloqueAvisoLegal` con identificador de plantilla en el pie (abogado/admin) |
| **CA-50** | **C-1**: encabezado §3.0 literal, no plegable, antes de todo resultado; §3.x por hallazgo en **C-3** |
| CA-51 | **C-3** caso rechazado: "Lo revisó un abogado y no corresponde" |
| **CA-54** | **C-2**: aviso preventivo sin el hallazgo. **C-7** no se muestra mientras el hallazgo esté pendiente |
| **CA-55** | Fecha "En revisión desde el {fecha}" + plazo declarado en C-2; columna "Vence" y banda de escalados en **A-1** |
| **CA-56** | Declaración de gratuidad en el cuerpo del aviso + prohibición de módulo comercial en la pantalla (regla 4 de C-2) |
| **CA-57** | **C-3**, bloque "Qué sigue" obligatorio y nunca vacío |
| CA-58 | **D-1**, banda superior + mensaje de evaluación rechazada en §8.3 |
| **CA-59** | `PieProcedencia` declara valor, fuente, vigencia y fecha de activación humana; **D-2** muestra el valor obtenido y no activado |
| CA-60 | Identificadores opacos en **A-1** y **A-2**; regla 5 de C-4 (nunca se pide dato identificatorio) |
| CA-61 | No hay ninguna pantalla que muestre comisión calculada sobre el impacto estimado. R6 de §1.2 prohíbe el total agregado |
| **CA-62** | **C-7**, `BloqueNoConfusion`, entre los dos hallazgos |
| **CA-63** | **C-5**, variante B de "sin resultado" |
| **CA-64** | **C-6**, variante C de "sin resultado" |

---

## 12. Qué falta para dar esto por terminado

| # | Pendiente | Quién |
| --- | --- | --- |
| P-1 | Ratificar o corregir los seis escalamientos de §9 (A a F). **A es bloqueante**: el texto §3.5 contradice la spec aprobada | `compliance-legal` + estudio |
| P-2 | Dibujar los 24 trazos del set de íconos (§6.3.3 del sistema) | `ux-expert` |
| P-3 | Decidir los escalamientos 1 a 5 de §9.7 | Orquestador |
| P-4 | Prueba de comprensión del aviso preventivo con 5 usuarios reales antes de G5: se mide si entienden **qué no hacer** y si sienten que se les oculta algo | `tester` + `ux-expert` |
| P-5 | Validación con lector de pantalla y con baja visión (T-03 de `tokens.md`) | `tester` + `ux-expert` |
| P-6 | Confirmar con `arquitecto` que el contrato de salida del motor transporta lo que estas pantallas necesitan: tipo de "sin resultado" (tres valores distintos, no uno), identificador de plantilla, marcadores de confiabilidad de cada parámetro usado, y datos de activación de los valores de referencia | `arquitecto` |
