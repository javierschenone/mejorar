# Sistema de diseño — Mejorar

| Campo | Valor |
| --- | --- |
| Autor | `ux-expert` |
| Estado | BORRADOR — se aprueba con G2 de la feature 004 |
| Versión | 1 |
| Documento hermano | `specs/diseno/tokens.md` (los valores) |
| Primer consumidor | `specs/004-motor-reglas-legales/ux.md` |

`tokens.md` tiene **los valores**. Este documento tiene **las reglas de uso**: qué
componente existe, cuándo se usa cada color, qué tono lleva cada audiencia y qué
está prohibido. Si hay conflicto, para el valor manda `tokens.md` y para el uso
manda éste.

Documento vivo. Cada feature con interfaz lo puede extender; ninguna lo puede
contradecir sin pasar por compuerta.

---

## 1. Los siete principios de uso

Derivados de la constitución (#1, #6, #8, #13) y del mandato de `ux-expert`. Todo
lo que sigue en este documento es la aplicación mecánica de estos siete.

1. **Una pantalla, una decisión.** Si hay dos decisiones, hay dos pantallas.
2. **El estado vacío y el error son el caso principal**, no el borde. Se diseñan
   antes que el estado de éxito.
3. **Nada promete un resultado.** Ni un botón, ni un título, ni una notificación,
   ni un ícono. Toda cifra proyectada lleva su aclaración en el mismo bloque
   visual y con el mismo cuerpo de texto.
4. **Nada humilla.** Sin rojo de alarma, sin contadores de atraso, sin
   iconografía de castigo, sin sellos de morosidad. Ver §5.2 y §6.3.
5. **Lo obligatorio no es letra chica.** Los textos del dictamen de cumplimiento
   §3 van a 16px como mínimo y a 7:1 de contraste como mínimo.
6. **Nada depende sólo del color.** Todo estado se comunica con al menos dos de
   estas tres cosas: color, ícono, texto. Siempre con texto.
7. **Funciona sin red, en gama baja y al 200% de zoom**, o no está terminado.

---

## 2. Tres audiencias, tres interfaces

No es la misma pantalla con otro color. Cambian la densidad, el tono, la unidad
de trabajo y el objetivo.

| | **Cliente** | **Abogado** | **Administrador** |
| --- | --- | --- | --- |
| Qué necesita | Contención y claridad | Densidad y velocidad | Control y trazabilidad |
| Estado emocional | Miedo, vergüenza, urgencia | Carga de trabajo, cola pendiente | Responsabilidad sobre la cartera |
| Unidad de trabajo | Una deuda | Una cola de hallazgos | Un catálogo de parámetros |
| Dispositivo principal | Teléfono de gama baja | Escritorio 1440px+ | Escritorio |
| Densidad | Baja. Una tarjeta por bloque, `esp.4` entre tarjetas | Alta. Tabla, `texto.sm`, filas de 40px | Alta. Tabla + panel de detalle |
| Cuerpo mínimo | `texto.base` (16px) | `texto.sm` (14px) | `texto.sm` (14px) |
| Jerga permitida | Ninguna sin explicación en línea | Toda. Citas normativas literales, `fuente.mono` | Toda. Claves de parámetro en `fuente.mono` |
| Cifras | Redondeadas a peso, con etiqueta "estimado" | Centavos exactos, moneda explícita | Valor crudo + metadatos |
| Acción principal | Entender y esperar / consultar | Confirmar, rechazar, corregir | Ratificar, activar, versionar |
| Atajos de teclado | No | **Sí, obligatorios** (§4.4) | Sí |
| Deshacer | No aplica | Sí, 10s, sobre decisiones de hallazgo | Sí, sobre borradores; **no** sobre ratificaciones |

### 2.1 Tono de voz

**Cliente.** Segunda persona del singular, voseo rioplatense. Frases cortas.
Verbos concretos. El sujeto de la frase es el cliente o el sistema, nunca una
abstracción.

- Sí: "Nos falta un dato para poder seguir." / "Lo está revisando un abogado." /
  "Esto es una estimación."
- No: "Se requiere completar la información faltante." / "Saldo deudor
  consolidado." / "Su caso se encuentra en instancia de análisis."
- Nunca: "tu deuda está prescripta", "no tenés que pagar", "te sacamos del
  Veraz", "recuperás $X", "garantizamos", "seguro que". Lista completa y
  vinculante en el dictamen §3.8.

**Abogado.** Impersonal, técnico, telegráfico. La etiqueta es un sustantivo, no
una oración. Las citas normativas van literales y completas.

- Sí: "Dies a quo sin ratificar. Análisis C bloqueado." / "CCyC art. 2545."
- No: "¡Atención! Parece que falta un dato importante para poder continuar."

**Administrador.** Descriptivo y preciso. Nombra el objeto, su estado y su
consecuencia.

- Sí: "12 parámetros sin ratificar. El entorno productivo los rechaza (CA-58)."
- No: "Todo en orden" cuando no lo está.

---

## 3. Jerarquía tipográfica en uso

Mapa de token a rol. No se inventan tamaños fuera de la escala de `tokens.md` §3.2.

| Rol | Móvil cliente | Web cliente | Web abogado / admin |
| --- | --- | --- | --- |
| Título de pantalla | `texto.2xl`/700 | `texto.3xl`/700 | `texto.2xl`/700 |
| Título de tarjeta | `texto.xl`/700 | `texto.xl`/700 | `texto.base`/600 |
| Primer párrafo de aviso legal | `texto.lg`/400 | `texto.lg`/400 | `texto.base`/400 |
| Cuerpo | `texto.base`/400 | `texto.base`/400 | `texto.sm`/400 |
| Etiqueta de campo | `texto.sm`/600 | `texto.sm`/600 | `texto.sm`/600 |
| Chip de estado | `texto.sm`/600 | `texto.sm`/600 | `texto.xs`/600 |
| Metadato | `texto.sm`/400 | `texto.sm`/400 | `texto.xs`/400 |
| Cita normativa | `texto.base`/400 | `texto.base`/400 | `fuente.mono` `texto.sm` |

Reglas duras:

- `texto.xs` **está prohibido en la app del cliente**, sin excepción.
- Un título nunca contiene una cifra proyectada. La cifra vive en el cuerpo,
  pegada a su aclaración.
- Un título nunca es una conclusión jurídica. "Intereses" sí; "Te cobraron de
  más" no.
- El resaltado dentro de un texto obligatorio usa `peso.fuerte` (700), nunca
  color, nunca subrayado (se confunde con enlace), nunca fondo amarillo.

---

## 4. Estructura y navegación

### 4.1 Grilla

| Contexto | Ancho | Columnas | Canal |
| --- | --- | --- | --- |
| Móvil (320–599) | fluido, margen `esp.4` | 1 | — |
| Móvil grande / tablet (600–1023) | fluido, margen `esp.6` | 1 (contenido máx. 560px centrado) | — |
| Web cliente (≥1024) | contenido máx. **720px** centrado | 1 | — |
| Web abogado (≥1280) | fluido, margen `esp.8` | lista 380px fija + detalle fluido | `esp.6` |
| Web admin (≥1280) | fluido, margen `esp.8` | filtros 260px + tabla fluida + panel 420px | `esp.6` |

El portal del cliente en escritorio **no usa el ancho disponible**: 720px. Un
texto obligatorio a 1400px de ancho no se lee.

### 4.2 Orden de la pantalla del cliente

Fijo, en este orden, siempre:

```
1. Encabezado de navegación (volver + título)
2. AVISO PREVENTIVO, si aplica          ← nunca se baja de acá
3. Encabezado obligatorio del dictamen §3.0
4. Resumen de la deuda (datos neutros)
5. Bloques de resultado, uno por análisis
6. Bloques "sin resultado", agrupados al final
7. Qué sigue / a quién consultar
8. Pie: versión de parámetros y fecha de evaluación
```

El aviso preventivo va **antes** del encabezado obligatorio porque es lo único
accionable de la pantalla y porque su función es evitar una conducta inmediata.
El encabezado §3.0 va inmediatamente después y antes de cualquier resultado, con
lo que CA-50 se cumple igual.

### 4.3 Navegación

- Móvil: pila de navegación, botón "Volver" siempre visible en la barra
  superior, gesto de retroceso nativo respetado. **Sin barra de pestañas dentro
  del diagnóstico**: es un flujo lineal.
- Web: migas de pan sólo en portales de abogado y administrador.
- **Ningún flujo del cliente es modal obligatorio.** Un modal que hay que cerrar
  para seguir es donde se esconde la letra chica; en este producto la letra chica
  no existe.

### 4.4 Teclado (portales de abogado y administrador)

| Tecla | Acción |
| --- | --- |
| `j` / `k` o ↓ / ↑ | Siguiente / anterior en la lista |
| `Enter` | Abrir el detalle del ítem enfocado |
| `c` | Confirmar hallazgo (abre el diálogo de matrícula) |
| `r` | Rechazar hallazgo (exige motivo) |
| `e` | Corregir hallazgo |
| `Esc` | Cerrar panel / cancelar |
| `?` | Hoja de atajos |

Todo atajo tiene su equivalente en botón visible. Ningún atajo es destructivo sin
confirmación.

---

## 5. Componentes

Nomenclatura: nombre en español, como todo el dominio.

### 5.1 Inventario

| Componente | Estado | Dónde |
| --- | --- | --- |
| `Boton` (primario, secundario, terciario, texto) | nuevo | Todos |
| `Campo` (texto, número, fecha, selección) | nuevo | Todos |
| `Tarjeta` | nuevo | Todos |
| `ChipEstado` | nuevo | Todos |
| `PanelSemantico` | nuevo | Todos |
| `BloqueAvisoLegal` | nuevo | Cliente |
| `BloqueSinResultado` (3 variantes) | nuevo | Cliente, abogado |
| `BloqueNoConfusion` | nuevo | Cliente |
| `Acordeon` ("¿Por qué?") | nuevo | Cliente |
| `Esqueleto` | nuevo | Todos |
| `EstadoVacio` | nuevo | Todos |
| `BandaConexion` | nuevo | Móvil |
| `TablaDensa` | nuevo | Abogado, admin |
| `LineaTiempo` | diferido (T-02 de `tokens.md`) | Abogado |
| `PieProcedencia` | nuevo | Todos |

### 5.2 `PanelSemantico` — la pieza central

Un bloque con barra lateral de 4px (`borde.acento`), fondo tenue, ícono y título.
**Cinco variantes y sólo cinco.** No se crean más sin pasar por compuerta.

| Variante | Fondo | Barra / ícono / texto de chip | Qué significa | Qué NO significa |
| --- | --- | --- | --- | --- |
| `informativo` | `color.primario.fondo` | `color.primario` | Dato neutro, explicación, resultado sin carga | — |
| `atencion` | `color.atencion.fondo` | `color.atencion.borde` / texto `color.atencion.texto` | **Hay algo que hacer o que no hacer ahora.** Aviso preventivo. | No significa "malas noticias" |
| `pendiente` | `color.pendiente.fondo` | `color.pendiente.borde` | Lo está mirando una persona. En revisión, sin ratificar. | No significa error |
| `confirmado` | `color.confirmado.fondo` | `color.confirmado.borde` | Un abogado matriculado lo revisó. | **No significa plata ganada** |
| `problema` | `color.problema.fondo` | `color.problema.borde` | **Falla de la aplicación.** No cargó, no guardó, se cayó. | Nunca describe la deuda del cliente |

Reglas duras:

1. **El rojo saturado no existe en este producto.** `color.problema` es terracota
   apagado y se reserva a fallas del software. Una deuda vencida, un embargo
   excesivo o un dato caducado **nunca** se pintan de `problema`.
2. Un panel **nunca se identifica sólo por su fondo** (1.19:1 contra blanco).
   Siempre barra de 4px + ícono + título textual.
3. `confirmado` (verde) nunca envuelve una cifra de impacto económico como
   elemento principal. El verde alrededor de un número es una promesa visual.
4. Como máximo **un** panel `atencion` por pantalla. Si hay dos avisos
   preventivos, se funden en uno que nombra ambas deudas.
5. El panel no es plegable cuando contiene texto obligatorio del dictamen §3.

```
┌─┬──────────────────────────────────────────┐
│▍│ ⚑  Título del panel                      │   ▍ = barra 4px, color semántico
│▍│                                          │   ⚑ = ícono del set, 20px
│▍│ Cuerpo a texto.base. Nunca menos.        │
│▍│                                          │
│▍│ [ Acción primaria ]  Acción secundaria   │
└─┴──────────────────────────────────────────┘
```

### 5.3 `BloqueAvisoLegal`

Envoltorio de los textos obligatorios del dictamen §3. Se diferencia de
`PanelSemantico` en que **su contenido no se puede editar, resumir, truncar,
plegar ni traducir por pantalla**: viene de una plantilla versionada del catálogo
(CA-49) y se renderiza completo.

| Propiedad | Valor |
| --- | --- |
| Cuerpo | `texto.base` mínimo; primer párrafo `texto.lg` |
| Contraste | **7:1 mínimo** (`tokens.md` §0) |
| Ancho de línea | máx. 60 caracteres |
| Plegable | **No** |
| Truncable | **No.** Sin "ver más" |
| Identificador visible | Sí, en el pie: `plantilla §3.1 v1` (sólo abogado/admin) |
| Lector de pantalla | `role="region"` con `aria-label` = título del bloque |

### 5.4 `ChipEstado`

`radio.pill`, `texto.sm`/600, alto 24px, padding `esp.2` horizontal. **Siempre
ícono + palabra.** Nunca sólo un punto de color.

| Chip | Variante | Texto cliente | Texto abogado/admin |
| --- | --- | --- | --- |
| En revisión | `pendiente` | `En revisión` | `Pendiente de confirmación` |
| Revisado | `confirmado` | `Revisado por un abogado` | `Confirmado · MP 12345 CABA` |
| Falta un dato | `informativo` | `Falta un dato` | `INDETERMINABLE · dato faltante` |
| Lo ve un abogado primero | `pendiente` | `Lo ve un abogado primero` | `INDETERMINABLE · materia excluida` |
| Ley en discusión | `informativo` | `Ley en discusión` | `INDETERMINABLE · régimen en disputa` |
| Orientativo | `atencion` | `Dato legal sin confirmar` | `Parámetro sin ratificar` |
| Sin resultado del sistema | `problema` | `No pudimos calcular` | `ERROR_EVALUACION` |

El chip **no es un botón**. Si hay que actuar, hay un botón aparte.

### 5.5 `Boton`

| Tipo | Uso | Aspecto |
| --- | --- | --- |
| Primario | Una sola por pantalla | Fondo `color.primario`, texto `#FFFFFF` (8.44:1) |
| Secundario | Alternativa real | Borde 1px `color.primario`, texto `color.primario` |
| Terciario | Acción de bajo peso | Sólo texto `color.primario`, subrayado en hover |
| Destructivo | Sólo abogado/admin | Borde `color.problema.borde`, texto `color.problema.borde`. **Nunca relleno** |

Reglas:

- Alto mínimo 48px móvil / 44px web (`toque.min`).
- El texto del botón es un **verbo en infinitivo o imperativo en primera persona
  del plural desde el punto de vista del usuario**: "Agregar la fecha", "Hablar
  con el equipo", "Confirmar el hallazgo".
- **Prohibido en el texto de un botón**: cualquier promesa de resultado, cualquier
  cifra proyectada, cualquier signo de exclamación. Nada de "Reclamá tus $X",
  "Sacate del Veraz", "Liberá tu sueldo".
- Un botón deshabilitado siempre explica por qué, en texto adyacente. Nunca queda
  gris y mudo.
- Sin botón primario en un estado de carga: se reemplaza por el mismo botón con
  `aria-busy` y texto "Guardando…", no desaparece (evita el salto de layout).

### 5.6 `Esqueleto`

Bloques `color.fondo.hundido`, `radio.sm`, sin animación de brillo (cuesta
repintado en gama baja y marea con `prefers-reduced-motion`). Aparece recién a
los 300ms (`umbral.esqueleto`). Reproduce la forma real del contenido, no barras
genéricas. `aria-busy="true"` en el contenedor y un `aria-live="polite"` que
anuncia una sola vez "Cargando el diagnóstico".

### 5.7 `EstadoVacio`

Título + una línea de explicación + una acción. **Sin ilustración decorativa**
(peso de descarga) y sin tono jocoso. El estado vacío de este producto no es
divertido.

### 5.8 `BandaConexion`

Banda fija de 32px bajo la barra superior, sólo en móvil. Tres modos:

| Modo | Fondo | Texto |
| --- | --- | --- |
| Sin conexión | `color.fondo.sutil` + borde inferior `color.borde` | `Sin conexión. Estás viendo lo último que guardamos.` |
| Reconectando | ídem | `Reconectando…` |
| Datos viejos | ídem | `Actualizado el {fecha}. Puede haber cambiado.` |

**Nunca en `problema`.** No tener señal no es un error del usuario.

### 5.9 `PieProcedencia`

Bloque de cierre obligatorio en toda salida del motor (CA-27, CA-59). Cliente:
`texto.sm`, `color.texto.secundario`, plegado por defecto bajo el rótulo "Con qué
datos se calculó esto". Abogado/admin: desplegado siempre.

Contiene: fecha de evaluación · versión del conjunto de parámetros · normas
citadas con artículo · valores de referencia usados con fuente, vigencia y fecha
de activación humana · supuestos.

---

## 6. Color e iconografía en uso

### 6.1 Cuándo se usa cada color

El color **nunca** codifica "bueno / malo" sobre la situación patrimonial del
cliente. Codifica **quién tiene que hacer algo y cuándo**:

| Color | Quién actúa | Cuándo |
| --- | --- | --- |
| Ámbar (`atencion`) | El cliente | Ahora, absteniéndose de algo |
| Índigo (`pendiente`) | Una persona de nuestro equipo o un abogado | Ya está en curso |
| Verde (`confirmado`) | Nadie por ahora: está revisado | Ya pasó |
| Azul (`informativo`) | Nadie: es contexto | — |
| Terracota (`problema`) | El sistema | Falló, hay que reintentar |

### 6.2 Prohibiciones de color

1. **Rojo saturado (`#D00`, `#E53935` y equivalentes): prohibido en todo el
   producto.** No existe token para él.
2. Prohibido pintar de rojo, naranja o terracota un saldo, una mora, una fecha
   de vencimiento o un número de días de atraso.
3. Prohibido el semáforo verde/amarillo/rojo como escala de "salud" de la deuda.
4. Prohibido el degradado en cualquier superficie con texto.
5. Prohibido el verde en cualquier cifra que no esté confirmada por un abogado.
6. Prohibido diferenciar dos estados **sólo** por color (principio 6).

### 6.3 Iconografía

Cierra el pendiente **T-01** de `tokens.md`.

#### 6.3.1 Especificación del set

| Propiedad | Valor |
| --- | --- |
| Estilo | Trazo (outline), nunca relleno sólido |
| Grilla | 24×24, área viva 20×20 |
| Grosor | 1.75px a 24px; 2px a 20px; 2.25px a 16px (peso óptico constante) |
| Terminaciones | Redondeadas (`round` cap y join) |
| Color | Hereda `currentColor`. Sin color propio, jamás multicolor |
| Tamaños permitidos | 16 (inline en `texto.sm`), 20 (títulos de panel), 24 (navegación y acciones) |
| Origen | **Set propio, dibujado.** Ver §6.3.5 sobre por qué no una librería |
| Peso total | ≤ 8 KB inline en el bundle, sin fuente de íconos ni sprite remoto |

#### 6.3.2 Reglas de uso

1. **Ningún ícono transmite información por sí solo.** Siempre acompañado de
   texto visible. Un ícono sin texto es, como mucho, redundancia.
2. Ícono decorativo: `aria-hidden="true"` y `focusable="false"`. Ícono que es el
   único contenido de un control (sólo abogado/admin): `aria-label` obligatorio y
   `title` en hover.
3. Un ícono = un significado, en todo el producto. No se reutiliza el mismo trazo
   para dos cosas distintas ni en portales distintos.
4. Sin animación de íconos, salvo el indicador de carga.
5. Un ícono nunca se agranda para hacer de ilustración. Tamaño máximo 24px.
6. **Ningún ícono representa a una persona en situación de deuda.** Ni siluetas
   agobiadas, ni cabezas con signos de interrogación, ni manos vacías.

#### 6.3.3 Set inicial

| Nombre | Trazo | Uso | Variante |
| --- | --- | --- | --- |
| `aviso` | Círculo con signo de exclamación centrado | Aviso preventivo. **Círculo, nunca triángulo** | `atencion` |
| `revision` | Lupa sobre hoja de papel | "Lo está revisando un abogado" | `pendiente` |
| `revisado` | Hoja de papel con tilde | "Revisado por un abogado" | `confirmado` |
| `dato-faltante` | Recuadro con línea de puntos y un `+` | "Falta un dato" | `informativo` |
| `derivacion` | Flecha que sale de un recuadro hacia una silueta neutra de busto | "Lo ve un abogado primero" (materia excluida) | `pendiente` |
| `bifurcacion` | Una línea que se abre en dos, ambas continuas | "Ley en discusión" (régimen en disputa) | `informativo` |
| `informacion` | Círculo con `i` | Explicaciones, "¿Por qué?" | `informativo` |
| `reintentar` | Flecha circular abierta | Error del sistema, reintento | `problema` |
| `sin-conexion` | Nube con línea diagonal | Banda de conexión | neutro |
| `guardado` | Flecha hacia abajo sobre línea base | "Guardado en el teléfono" | neutro |
| `calendario` | Recuadro con dos marcas superiores | Fechas, plazos | neutro |
| `documento` | Hoja con esquina plegada | Resumen, contrato, expediente | neutro |
| `norma` | Hoja con tres renglones y una marca de párrafo `§` | Cita normativa | neutro |
| `moneda` | Círculo con `$` | Importes | neutro |
| `registro` | Tres tarjetas apiladas | Registros crediticios (§3.3: son varios) | neutro |
| `haber` | Recibo con línea de corte | Sueldo / haber previsional | neutro |
| `parametro` | Deslizador de dos posiciones | Catálogo de parámetros (admin) | neutro |
| `historial` | Reloj con flecha antihoraria | Versiones, bitácora | neutro |
| `expandir` / `contraer` | Chevron abajo / arriba | Acordeón | neutro |
| `volver` | Flecha a la izquierda | Navegación | neutro |
| `cerrar` | Aspa | Cerrar panel | neutro |
| `menu` | Tres líneas | Menú (sólo portales web) | neutro |
| `filtro` | Embudo | Filtros de tabla (abogado/admin) | neutro |
| `cargando` | Arco de 270° girando | Único ícono animado | neutro |

#### 6.3.4 Iconografía prohibida

**Lista vinculante.** Ninguna de estas figuras entra al producto, en ningún
portal, en ningún tamaño, en ninguna ilustración, en ningún correo, en ninguna
notificación push, en ningún material de marketing.

| Prohibido | Por qué |
| --- | --- |
| **Martillo de juez / mazo / maza** | Iconografía de condena. Además es falsa: el 95% de estos casos no llega a sentencia |
| **Esposas** | Criminaliza una deuda civil. La deuda no es delito |
| **Cadenas, grilletes, bola de presidiario** | Ídem |
| **Calavera, tibias cruzadas, fantasma** | Dramatización del riesgo |
| **Pulgar hacia abajo** | Juicio moral sobre la persona |
| **Rejas, celda, candado sobre una persona** | Criminalización |
| **Balanza de la justicia** | Lee como "juicio en tu contra". Para "norma" se usa `norma` (§) |
| **Triángulo de peligro** | Señal de riesgo de seguridad. Para avisos se usa `aviso` (círculo) |
| **Bomba, mecha, explosión, fuego** | Dramatización |
| **Reloj de arena vaciándose, cuenta regresiva** | Presión artificial. Los plazos se dicen con fecha y con `calendario` |
| **Caras (emoji, sonrisas, ceños)** | Ni felicita ni compadece. El producto no opina sobre el ánimo del usuario |
| **Pulgar arriba, confeti, estrellas, trofeos, medallas** | Celebración. No hay nada que celebrar hasta que un abogado confirme |
| **Alcancía rota, billetes volando, monedas cayendo** | Frivoliza la pérdida patrimonial |
| **Tarjeta de crédito cortada por una tijera** | Promete un desenlace que el producto no produce |
| **Sellos tipo "MOROSO", "DEUDOR", "VENCIDO", "RECHAZADO"** | Estigma. El producto nombra hechos, no etiqueta personas |
| **Semáforo** | Escala moral de la deuda (§6.2.3) |
| **Cohete, gráfico de barras ascendente, flecha al alza** | Promesa de resultado (constitución #6) |
| **Escudo, casco, superhéroe, capa** | La plataforma no es protectora ni garante |
| **Dedo índice señalando al usuario** | Acusatorio |
| **Sirena, luz policial, altavoz/megáfono** | Alarma |
| **Lápiz rojo tachando, cruz roja grande** | Castigo visual |
| **Banderas de país, símbolos patrios, escudo nacional** | Sugiere carácter oficial o estatal del producto |
| **Logos de bancos, bureaus u organismos** | Sugiere aval o vínculo que no existe |

Regla de cierre: **ante la duda, se usa texto.** Una palabra siempre es más
precisa que un pictograma, y no ofende.

#### 6.3.5 Por qué set propio y no una librería

Las librerías de trazo más comunes (Material Symbols, Lucide, Heroicons, Font
Awesome) traen `gavel`, `handcuffs`, `balance-scale`, `skull`, `thumbs-down` y
`warning-triangle` en el mismo paquete. El riesgo no es estético: es que
cualquier desarrollador los tenga a un `import` de distancia y alguno entre sin
que nadie lo note. Con set propio, meter un martillo de juez exige dibujarlo, y
eso no pasa por accidente.

Si en una revisión posterior se decide adoptar una librería, la condición es un
**subconjunto explícito y verificado por test de lint** contra la lista de §6.3.4,
no la librería completa.

---

## 7. Patrones transversales

### 7.1 Los cinco estados

Toda vista define los cinco. Si alguno no aplica, se escribe "no aplica" y por
qué; no se omite.

| Estado | Qué se ve | Regla |
| --- | --- | --- |
| **Vacío** | `EstadoVacio`: qué falta, por qué importa, una acción | Nunca una pantalla en blanco ni un spinner eterno |
| **Cargando** | Nada hasta 300ms → `Esqueleto` → a los 5s se agrega "Está tardando más de lo normal" → a los 20s pasa a error | La estructura de la página no salta |
| **Error** | `PanelSemantico problema`: qué pasó, si se perdió algo, qué hacer, botón de reintento | Nunca un código de error solo. Nunca "Error 500" |
| **Parcial** | El contenido disponible + un bloque que nombra exactamente qué falta | **El estado parcial es el estado normal de este producto.** Nunca se oculta el todo porque falta una parte |
| **Éxito** | El contenido, con sus aclaraciones y su procedencia | Sin celebración, sin animación, sin verde en las cifras |

### 7.2 Patrón "sin resultado" — tres variantes

El producto distingue **tres razones distintas** por las que no hay un resultado,
y las trata visualmente distinto. Colapsarlas en un único "INDETERMINABLE" hace
que el sistema parezca poco confiable y le impide al cliente saber si él puede
hacer algo.

| | **A. Falta un dato** | **B. Lo ve un abogado primero** | **C. Ley en discusión** |
| --- | --- | --- | --- |
| Origen | CA-07, CA-10, CA-13, CA-26, CA-52 | CA-63 | CA-64, CA-35, CA-39 |
| Variante de panel | `informativo` | `pendiente` | `informativo`, **sin fondo** (sólo borde 1px + barra) |
| Ícono | `dato-faltante` | `derivacion` | `bifurcacion` |
| Chip | `Falta un dato` | `Lo ve un abogado primero` | `Ley en discusión` |
| Quién destraba | **El cliente** | Un abogado matriculado | Nadie por ahora: un tribunal o el legislador |
| Acción primaria | Cargar el dato (formulario de un campo) | Ninguna del cliente. "Pedir que lo miren" si no está ya en cola | Ninguna. "Avisarme cuando se defina" |
| Frecuencia esperada | **Alta — es el caso principal** | Baja | Muy baja |
| Prominencia | En línea, junto al análisis afectado | Agrupado al final | Agrupado al final, el último |
| Riesgo de tono | Sonar a interrogatorio | Sonar a "el sistema no sabe" | Sonar a "nada de esto es confiable" |
| Antídoto de tono | Un solo campo por vez, con por qué sirve | Nombrar que el tema tiene **reglas propias más protectoras** | Acotar el alcance: "esto afecta a este punto, no al resto" |

Regla común a las tres: **nunca se presentan con `problema`** (terracota). Que
falte un dato no es una falla; que un abogado tenga que mirar algo, tampoco.

### 7.3 Patrón "advertencia preventiva"

Se usa cuando el sistema tiene que evitar una conducta del cliente **sin poder
revelar todavía el motivo**. Estructura fija:

```
1. Qué está pasando, en una línea, sin misterio
2. Qué NO hacer, en lista, cada ítem con verbo en negativo
3. Por cuánto tiempo y qué pasa después
4. Que no cuesta nada
5. Acordeón "¿Por qué me dicen esto?" — respuesta completa y honesta
6. Una sola acción: hablar con el equipo
```

Prohibido en este patrón: el condicional evasivo ("podría haber algo"), el
suspenso ("tenemos novedades"), la urgencia falsa (cuenta regresiva), y
cualquier vínculo con un plan pago.

### 7.4 Patrón "no confundir" (CA-62)

Cuando dos resultados sobre el mismo objeto se confunden habitualmente entre sí,
se muestra un bloque de contraste **entre los dos**, no debajo de ambos, con
estructura de dos columnas en web y dos filas etiquetadas en móvil. Nunca se
resuelve con una nota al pie.

### 7.5 Patrón "pendiente de validación profesional" (CA-28)

Propagación en tres niveles, para que el cliente entienda el alcance:

| Nivel | Marca |
| --- | --- |
| Pantalla | Franja `atencion` bajo el encabezado, si **algún** bloque la tiene |
| Bloque | Chip `Dato legal sin confirmar` en el encabezado del bloque |
| Cifra | La cifra lleva el rótulo "estimado" adosado, en la misma línea |

El texto literal es el del dictamen §3.7. No se abrevia.

### 7.6 Patrón "cifra estimada"

```
Estimado: $ 128.400
└ Es una estimación con los datos que cargaste. No es un monto
  que el acreedor esté obligado a devolverte.
```

- La palabra "Estimado" precede al número, no lo sigue.
- La aclaración va inmediatamente debajo, mismo cuerpo, nunca `texto.xs`.
- **Prohibido sumar impactos de varios hallazgos en un número único** (dictamen
  RL-07). No existe la pantalla "total que podrías recuperar".
- Sin animación de conteo. Sin verde. Sin tamaño de display.

---

## 8. Accesibilidad — piso transversal

Lo específico de cada feature va en su `ux.md`; esto rige siempre.

| Requisito | Regla |
| --- | --- |
| Contraste | `tokens.md` §0. Texto obligatorio a 7:1 |
| Objetivo táctil | 48×48 móvil / 44×44 web, separación ≥ 8px |
| Foco | Anillo doble, nunca suprimido, orden de foco = orden visual |
| Encabezados | Un solo `h1` por pantalla; jerarquía sin saltos |
| Zoom | Usable al 200% y con fuente del sistema a 1.3× sin scroll horizontal |
| Orientación | Funciona en vertical y en horizontal; no se bloquea |
| Color | Nunca único portador de significado |
| Animación | Todo respeta `prefers-reduced-motion` |
| Formularios | Etiqueta visible siempre (no sólo *placeholder*), error asociado por `aria-describedby`, error también en texto |
| Regiones vivas | `aria-live="polite"` para carga y guardado; `assertive` **sólo** para el aviso preventivo cuando aparece por primera vez |
| Lector de pantalla | Todo chip de estado se anuncia con su palabra, no con su color |
| Tiempo | Ningún contenido desaparece solo. Sin *toasts* que se van con información necesaria |
| Idioma | `lang="es-AR"` |

---

## 9. Conexión pobre y offline — reglas generales

1. **Nada se descarga que no se vaya a leer.** Sin fuentes web, sin
   ilustraciones, sin íconos remotos.
2. **Todo lo que se mostró una vez, se guarda.** El cliente vuelve a entrar en el
   subte y ve lo mismo, con su fecha.
3. **Lo guardado siempre dice cuándo se guardó.** `BandaConexion` modo "Datos
   viejos".
4. **Las advertencias legales y preventivas se guardan sin vencimiento** y se
   muestran offline. Son lo único que no puede faltar.
5. **Ninguna acción con efecto externo se encola offline sin decirlo.** Si el
   cliente pide algo sin red, se le dice "Lo vamos a enviar cuando vuelva la
   conexión" y queda visible en la pantalla hasta que se envíe.
6. **Sin red, los formularios se pueden completar igual.** El borrador es local.

---

## 10. Gobernanza

| Regla | |
| --- | --- |
| Quién edita | `ux-expert` |
| Cuándo | En G2 de cada feature con interfaz |
| Cómo se extiende | Se agrega componente o patrón nuevo, con su fila en §5.1 |
| Cómo se contradice | No se contradice fuera de compuerta. Un conflicto se reporta al orquestador |
| Qué pasa si un `ux.md` necesita algo que no está acá | Se define acá primero, no en el `ux.md` |
| Relación con `tokens.md` | Este documento **no inventa valores**. Si necesita uno que no existe, se agrega a `tokens.md` y se declara en el reporte de la feature |

### 10.1 Pendientes abiertos

| # | Pendiente | Dónde |
| --- | --- | --- |
| T-01 | **Cerrado** por §6.3 en cuanto a la especificación y a la lista prohibida. Queda el dibujo de los 24 trazos | `ux-expert`, próxima feature con UI |
| T-02 | Tokens y componente `LineaTiempo` para el portal del abogado | `ux-expert` |
| T-03 | Validación con usuario real con baja visión y lector de pantalla | `tester` + `ux-expert` |
| T-04 | Ratificación por el estudio jurídico de los textos propuestos en `004/ux.md` §9 | `compliance-legal` + estudio |
