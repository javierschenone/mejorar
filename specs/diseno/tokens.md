# Tokens de diseño — Mejorar

| Campo | Valor |
| --- | --- |
| Autor | `ux-expert` |
| Estado | BORRADOR — se aprueba con G2 de la feature 004 |
| Versión | 1 |
| Origen | Primera definición. Nace con `specs/004-motor-reglas-legales/ux.md`. |
| Documento hermano | `specs/diseno/sistema-de-diseno.md` (cómo se usan) |

Este documento tiene **los valores**. El sistema de diseño tiene **las reglas de
uso**. Si hay conflicto entre los dos, manda éste para el valor y el otro para el
uso.

---

## 0. Cómo se verificaron los contrastes

Fórmula WCAG 2.2 (relative luminance + contrast ratio):

```
canal c_s = c/255
c_lin = c_s/12.92                  si c_s <= 0.03928
c_lin = ((c_s + 0.055)/1.055)^2.4  en caso contrario
L = 0.2126*R_lin + 0.7152*G_lin + 0.0722*B_lin
ratio = (L_claro + 0.05) / (L_oscuro + 0.05)
```

Luminancias calculadas y redondeadas a 6 decimales. Los ratios están redondeados
**hacia abajo** a dos decimales: si la tabla dice 4.58, el valor real es igual o
mayor.

**Umbrales que aplicamos (piso, no objetivo):**

| Caso | Mínimo WCAG 2.2 AA | Mínimo nuestro |
| --- | --- | --- |
| Texto normal (< 18.66px regular / < 24px) | 4.5:1 | **4.5:1** |
| Texto grande (≥ 24px, o ≥ 18.66px en 700) | 3:1 | **4.5:1** — no usamos la excepción |
| Bordes y estados de componentes (1.4.11) | 3:1 | **3:1** |
| Indicador de foco (2.4.11 / 2.4.13) | 3:1 contra adyacentes | **3:1 y grosor ≥ 2px** |
| Texto de advertencia legal obligatoria | — | **7:1 y tamaño ≥ 16px** |

La última fila es una decisión del producto, no una exigencia normativa: los
textos obligatorios del dictamen de cumplimiento §3 son lo último que puede
quedar en letra chica.

---

## 1. Color — tema claro (por defecto)

### 1.1 Neutrales

| Token | Hex | Luminancia | Uso |
| --- | --- | --- | --- |
| `color.fondo` | `#FFFFFF` | 1.000000 | Fondo de página y de tarjeta |
| `color.fondo.sutil` | `#F5F6F7` | 0.920406 | Fondo de sección, filas alternas, barras de herramientas |
| `color.fondo.hundido` | `#EDEFF1` | 0.860911 | Campos deshabilitados, celdas vacías, esqueletos de carga |
| `color.borde.sutil` | `#C7CFD4` | 0.615305 | Separadores **decorativos** (no delimitan controles) |
| `color.borde` | `#6B7B86` | 0.190129 | Borde de inputs, tarjetas y controles |
| `color.texto` | `#1B2A33` | 0.021260 | Texto principal |
| `color.texto.secundario` | `#4A5A66` | 0.097297 | Texto de apoyo, etiquetas |
| `color.texto.tenue` | `#5E6E79` | 0.149116 | Metadatos, texto deshabilitado. **Nunca advertencias.** |

### 1.2 Marca / primario

Azul petróleo. Se eligió un tono frío y oscuro porque tiene que convivir con el
ámbar de las advertencias sin competir, y porque el verde saturado en un producto
de deuda lee como "plata ganada" y eso es exactamente lo que no podemos sugerir
(constitución #6).

| Token | Hex | Luminancia | Uso |
| --- | --- | --- | --- |
| `color.primario` | `#0F5468` | 0.074418 | Botón primario, enlaces, foco |
| `color.primario.oscuro` | `#0A3B4A` | 0.036869 | Hover / pressed del primario |
| `color.primario.fondo` | `#E6F1F4` | 0.862808 | Fondo de panel informativo |

### 1.3 Estados semánticos

Cuatro estados. **Ninguno es rojo de alarma.** El rojo saturado queda prohibido
en todo el producto de cara al cliente (ver `sistema-de-diseno.md` §6).

| Token | Hex | Luminancia | Significado |
| --- | --- | --- | --- |
| `color.atencion.fondo` | `#FBF1DF` | 0.887633 | Fondo del bloque "Aviso importante" |
| `color.atencion.borde` | `#B87D10` | 0.248961 | Barra lateral e ícono del aviso |
| `color.atencion.texto` | `#6B4708` | 0.076498 | Etiqueta/chip sobre fondo ámbar |
| `color.pendiente.fondo` | `#ECEEF8` | 0.857620 | Fondo de "en revisión" / "pendiente de validación" |
| `color.pendiente.borde` | `#3E4A7A` | 0.073276 | Borde, ícono y texto de "en revisión" |
| `color.confirmado.fondo` | `#E7F2EC` | 0.865573 | Fondo de "revisado por un abogado" |
| `color.confirmado.borde` | `#14603C` | 0.088406 | Borde, ícono y texto de "revisado" |
| `color.problema.fondo` | `#FBEDE8` | 0.869053 | Fondo de error **del sistema** (no de la deuda) |
| `color.problema.borde` | `#8C3A22` | 0.087172 | Borde, ícono y texto de error del sistema |

`color.problema` es terracota apagado, no rojo. Se usa **sólo** para fallas de la
aplicación ("no pudimos cargar", "no se guardó"). Nunca para describir la
situación de la deuda del cliente.

### 1.4 Ratios verificados — tema claro

Cada fila es un par que efectivamente aparece en las pantallas de la 004.

| # | Primer plano | Fondo | Ratio | Uso | Umbral | ¿Pasa? |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `#1B2A33` | `#FFFFFF` | **14.73:1** | Texto principal | 4.5 | ✅ |
| 2 | `#4A5A66` | `#FFFFFF` | **7.13:1** | Texto secundario | 4.5 | ✅ |
| 3 | `#5E6E79` | `#FFFFFF` | **5.27:1** | Metadatos | 4.5 | ✅ |
| 4 | `#1B2A33` | `#F5F6F7` | **13.62:1** | Texto sobre sección | 4.5 | ✅ |
| 5 | `#4A5A66` | `#F5F6F7` | **6.59:1** | Etiquetas sobre sección | 4.5 | ✅ |
| 6 | `#5E6E79` | `#F5F6F7` | **4.87:1** | Metadatos sobre sección | 4.5 | ✅ |
| 7 | `#0F5468` | `#FFFFFF` | **8.44:1** | Enlace, botón secundario | 4.5 | ✅ |
| 8 | `#FFFFFF` | `#0F5468` | **8.44:1** | Texto del botón primario | 4.5 | ✅ |
| 9 | `#FFFFFF` | `#0A3B4A` | **12.09:1** | Botón primario en hover | 4.5 | ✅ |
| 10 | `#0F5468` | `#F5F6F7` | **7.80:1** | Enlace sobre sección | 4.5 | ✅ |
| 11 | `#0F5468` | `#E6F1F4` | **7.34:1** | Texto y enlace en panel informativo | 4.5 | ✅ |
| 12 | `#1B2A33` | `#E6F1F4` | **12.81:1** | Cuerpo en panel informativo | 4.5 | ✅ |
| 13 | `#1B2A33` | `#FBF1DF` | **13.16:1** | **Cuerpo de la advertencia preventiva** | 7.0 | ✅ |
| 14 | `#4A5A66` | `#FBF1DF` | **6.37:1** | Apoyo en bloque ámbar | 4.5 | ✅ |
| 15 | `#6B4708` | `#FBF1DF` | **7.41:1** | Chip "Aviso importante" | 4.5 | ✅ |
| 16 | `#6B4708` | `#FFFFFF` | **8.30:1** | Ícono de atención sobre blanco | 4.5 | ✅ |
| 17 | `#B87D10` | `#FFFFFF` | **3.51:1** | Barra lateral / ícono del aviso (no texto) | 3.0 | ✅ |
| 18 | `#B87D10` | `#FBF1DF` | **3.14:1** | Borde del bloque ámbar sobre su fondo | 3.0 | ✅ |
| 19 | `#3E4A7A` | `#ECEEF8` | **7.36:1** | Chip "Revisión jurídica pendiente" | 4.5 | ✅ |
| 20 | `#3E4A7A` | `#FFFFFF` | **8.52:1** | Ícono/texto "en revisión" sobre blanco | 4.5 | ✅ |
| 21 | `#1B2A33` | `#ECEEF8` | **12.74:1** | Cuerpo en panel "en revisión" | 4.5 | ✅ |
| 22 | `#14603C` | `#E7F2EC` | **6.61:1** | Chip "Revisado por un abogado" | 4.5 | ✅ |
| 23 | `#14603C` | `#FFFFFF` | **7.59:1** | Ícono de confirmado sobre blanco | 4.5 | ✅ |
| 24 | `#1B2A33` | `#E7F2EC` | **12.85:1** | Cuerpo en panel confirmado | 4.5 | ✅ |
| 25 | `#8C3A22` | `#FBEDE8` | **6.70:1** | Texto de error del sistema | 4.5 | ✅ |
| 26 | `#8C3A22` | `#FFFFFF` | **7.65:1** | Ícono/texto de error sobre blanco | 4.5 | ✅ |
| 27 | `#1B2A33` | `#FBEDE8` | **12.90:1** | Cuerpo en panel de error | 4.5 | ✅ |
| 28 | `#6B7B86` | `#FFFFFF` | **4.37:1** | Borde de input y de tarjeta | 3.0 | ✅ |
| 29 | `#5E6E79` | `#EDEFF1` | **4.58:1** | Texto de control deshabilitado | 4.5 (nos lo autoimponemos) | ✅ |
| 30 | `#0F5468` | `#FBF1DF` | **7.54:1** | Enlace dentro del bloque ámbar | 4.5 | ✅ |

**Fallos conocidos y decididos a propósito:**

| Par | Ratio | Decisión |
| --- | --- | --- |
| `#C7CFD4` sobre `#FFFFFF` | 1.58:1 | No cumple 3:1 y **no debe cumplirlo**: es un separador decorativo. Nunca delimita un control ni transmite información. Si un borde tiene que identificar un componente, se usa `color.borde` (#6B7B86, 4.37:1). |
| `#E6F1F4` sobre `#FFFFFF` | 1.15:1 | Un fondo de panel no identifica el panel por sí solo. **Todo panel lleva borde de 1px `color.borde` o barra lateral de 4px** de su color semántico. Regla obligatoria. |
| `#FBF1DF` sobre `#FFFFFF` | 1.19:1 | Ídem: el bloque ámbar se identifica por su barra lateral de 4px `#B87D10` (3.51:1) y su ícono, no por el fondo. |

---

## 2. Color — tema oscuro

Se define desde el día uno porque en un teléfono de gama baja con pantalla LCD y
batería justa, el tema oscuro es un pedido real, y porque muchos usuarios lo
tienen forzado a nivel sistema operativo.

| Token | Hex | Luminancia |
| --- | --- | --- |
| `color.fondo` | `#10191F` | 0.009043 |
| `color.fondo.sutil` | `#18242B` | — |
| `color.texto` | `#E8EDF0` | 0.840168 |
| `color.texto.secundario` | `#A9B6BE` | 0.456082 |
| `color.primario` | `#4FB3C9` | 0.381202 |
| `color.atencion.borde` | `#E5B25A` | 0.492368 |

| # | Primer plano | Fondo | Ratio | Umbral | ¿Pasa? |
| --- | --- | --- | --- | --- | --- |
| 31 | `#E8EDF0` | `#10191F` | **15.08:1** | 4.5 | ✅ |
| 32 | `#A9B6BE` | `#10191F` | **8.57:1** | 4.5 | ✅ |
| 33 | `#4FB3C9` | `#10191F` | **7.30:1** | 4.5 | ✅ |
| 34 | `#E5B25A` | `#10191F` | **9.19:1** | 7.0 (advertencia) | ✅ |
| 35 | `#10191F` | `#4FB3C9` | **7.30:1** | 4.5 | ✅ |

**Regla del tema oscuro:** los fondos de panel semánticos (ámbar, verde, azul) no
se invierten a un tono oscuro saturado. Se usa `color.fondo.sutil` + barra
lateral de 4px del color semántico claro correspondiente. Un bloque ámbar oscuro
grande a las 2 de la mañana es exactamente la dramatización que la regla 4 del
mandato prohíbe.

---

## 3. Tipografía

### 3.1 Familias

| Token | Valor |
| --- | --- |
| `fuente.texto` | `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` |
| `fuente.numeros` | igual, con `font-variant-numeric: tabular-nums` |
| `fuente.mono` | `ui-monospace, "SF Mono", "Roboto Mono", Consolas, monospace` — sólo portal de abogado y administrador (citas normativas, claves de parámetro, identificadores) |

**No se carga ninguna tipografía web.** Motivo: un archivo de fuente son entre 30
y 120 KB por variante sobre datos móviles contados, y hasta que llega, el texto
parpadea o no está. En esta feature el texto que podría no estar es la
advertencia preventiva. No es negociable.

### 3.2 Escala

Base 16px. Razón ≈ 1.2, redondeada a enteros.

| Token | px | line-height | Uso |
| --- | --- | --- | --- |
| `texto.xs` | 12 | 16 | Sólo metadatos prescindibles en portales web (número de fila, timestamp). **Prohibido en la app del cliente.** |
| `texto.sm` | 14 | 20 | Etiquetas, chips, tablas densas de abogado/admin |
| `texto.base` | 16 | 26 | **Cuerpo. Mínimo absoluto en la app del cliente.** Todo texto obligatorio del dictamen §3 va acá o más grande. |
| `texto.lg` | 18 | 28 | Cuerpo destacado, primer párrafo del aviso preventivo |
| `texto.xl` | 20 | 28 | Título de tarjeta |
| `texto.2xl` | 24 | 32 | Título de pantalla en móvil |
| `texto.3xl` | 30 | 38 | Título de pantalla en escritorio |
| `texto.4xl` | 36 | 44 | Sólo portada de portal |

### 3.3 Pesos

| Token | Valor | Uso |
| --- | --- | --- |
| `peso.normal` | 400 | Cuerpo |
| `peso.medio` | 600 | Énfasis dentro de párrafo, etiquetas, botones |
| `peso.fuerte` | 700 | Títulos, y las frases resaltadas de los textos obligatorios |

No existe peso 300 ni 200: en pantallas LCD baratas con subpíxel pobre, el texto
fino pierde legibilidad real aunque el contraste calculado dé bien.

### 3.4 Reglas de composición

| Regla | Valor |
| --- | --- |
| Ancho de línea máximo | 68 caracteres (`45rem` aprox.) en cuerpo. En bloques de advertencia, **60** |
| Alineación | Siempre a la izquierda. Nunca justificado (ríos de espacio en pantalla angosta) |
| Mayúsculas | Sólo en chips de ≤ 2 palabras, con `letter-spacing: 0.04em`. Nunca en frases |
| Escalado del usuario | Todo tamaño en unidades relativas. La interfaz debe seguir siendo usable al **200%** de zoom y con la fuente del sistema en "muy grande" (1.3×) sin scroll horizontal |

---

## 4. Espaciado

Base 4px.

| Token | px |
| --- | --- |
| `esp.0` | 0 |
| `esp.1` | 4 |
| `esp.2` | 8 |
| `esp.3` | 12 |
| `esp.4` | 16 |
| `esp.5` | 20 |
| `esp.6` | 24 |
| `esp.8` | 32 |
| `esp.10` | 40 |
| `esp.12` | 48 |
| `esp.16` | 64 |

| Constante | Valor |
| --- | --- |
| Margen lateral de pantalla, móvil | `esp.4` (16) |
| Margen lateral de pantalla, escritorio | `esp.8` (32) |
| Separación entre tarjetas | `esp.4` (16) |
| Padding interno de tarjeta | `esp.4` (16) móvil / `esp.6` (24) escritorio |
| Padding interno de bloque de advertencia | `esp.4` en los cuatro lados, + `esp.3` extra a la izquierda por la barra |
| Separación entre párrafos | `esp.3` (12) |
| Separación entre grupos de formulario | `esp.6` (24) |

---

## 5. Radios de esquina

| Token | px | Uso |
| --- | --- | --- |
| `radio.0` | 0 | Tablas densas, celdas |
| `radio.sm` | 6 | Inputs, botones, chips cuadrados |
| `radio.md` | 10 | Tarjetas, paneles, bloques de advertencia |
| `radio.lg` | 14 | Hojas modales, contenedores grandes |
| `radio.pill` | 999 | Chips de estado |

Sin radios grandes ni burbujeados: el tono del producto es serio y contenido, no
lúdico.

---

## 6. Elevación y bordes

En gama baja las sombras cuestan repintado y se ven sucias. Un solo nivel.

| Token | Valor | Uso |
| --- | --- | --- |
| `sombra.0` | ninguna | Todo, por defecto. La jerarquía se da con borde y fondo |
| `sombra.1` | `0 1px 2px rgba(27,42,51,0.10), 0 2px 8px rgba(27,42,51,0.06)` | Sólo capas flotantes reales: menú, hoja modal, barra de acción pegada |
| `borde.1` | `1px solid color.borde` | Tarjetas y controles |
| `borde.acento` | `4px solid <color semántico>` al inicio del bloque (izquierda en LTR) | Paneles semánticos |

**La sombra nunca es el único indicador de que algo es interactivo o flotante.**

---

## 7. Objetivos táctiles y foco

| Token | Valor |
| --- | --- |
| `toque.min` | **48×48 px** en móvil, **44×44 px** en web (WCAG 2.2 AA pide 24×24; subimos el piso a propósito) |
| `toque.separacion` | ≥ 8px entre dos objetivos táctiles adyacentes |
| `foco.anillo` | `3px solid color.primario` + `2px solid color.fondo` de offset (anillo doble) |
| `foco.radio` | Radio del elemento + 2px |

El anillo doble (color + halo del fondo) garantiza los 3:1 contra cualquier
superficie sobre la que caiga el foco, sin tener que calcular el contraste de
cada combinación. En tema oscuro el anillo interno pasa a `#4FB3C9`.

El foco **nunca** se elimina. Tampoco se muestra sólo con `:focus-visible` en los
controles del flujo de la advertencia preventiva: ahí se muestra siempre.

---

## 8. Movimiento

| Token | Valor | Uso |
| --- | --- | --- |
| `mov.rapido` | 120ms, `ease-out` | Cambios de estado de un control |
| `mov.normal` | 200ms, `ease-out` | Aparición de panel o de hoja |
| `mov.nada` | 0ms | Cuando `prefers-reduced-motion: reduce` |

Sin animaciones de entrada en listas, sin parallax, sin confeti, sin contadores
que suben. Un número de impacto económico que se anima hacia arriba es una
celebración, y no hay nada que celebrar hasta que un abogado lo confirme.

---

## 9. Duraciones y umbrales de interfaz

No son colores pero son tokens: se repiten y no pueden decidirse por pantalla.

| Token | Valor | Uso |
| --- | --- | --- |
| `umbral.esqueleto` | 300ms | Antes de eso no se muestra nada; evita el parpadeo |
| `umbral.mensajeLento` | 5s | "Está tardando más de lo normal." |
| `umbral.timeout` | 20s | Se corta y se muestra el estado de error con reintento |
| `cache.diagnostico` | 30 días | Vigencia del diagnóstico guardado en el teléfono |
| `cache.avisoPreventivo` | **sin vencimiento** | El aviso preventivo cacheado no expira hasta que el servidor confirme que ya no aplica. Ver `ux.md` §6.4 |

---

## 10. Pendientes

| # | Pendiente | Responsable |
| --- | --- | --- |
| T-01 | Set de íconos: hay que dibujarlos o elegir una librería de trazos que no incluya martillo de juez, esposas, cadenas, calavera ni pulgar hacia abajo. Ver la lista prohibida en `sistema-de-diseno.md` §6.3. | `ux-expert`, próxima feature con UI |
| T-02 | Tokens de gráficos (líneas de tiempo de prescripción para el portal del abogado). No se necesitan en la 004 cliente. | `ux-expert` |
| T-03 | Validar los tokens con un usuario real con baja visión y con lector de pantalla antes de G5. | `tester` + `ux-expert` |
