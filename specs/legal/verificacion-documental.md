# Registro de verificación documental — normativa del motor de reglas legales

| Campo | Valor |
| --- | --- |
| Autor | `compliance-legal` (agente revisor — **no es abogado**) |
| Encargo | Orquestador, autorizado por el product owner en `REGISTRO-COMPUERTAS.md`, entrada 006 |
| Documento de origen | `specs/004-motor-reglas-legales/cumplimiento.md`, §8 (12 puntos pendientes) |
| Fecha de la búsqueda | **2026-09-20** |
| Alcance | Verificación documental de textos normativos. **No incluye interpretación ni dictamen.** |

---

## 0. Cómo usar este documento

Este registro está pensado para que **el estudio jurídico que ratifique la tabla
del §5 de `cumplimiento.md` no tenga que empezar de cero**. Para cada uno de los
doce puntos dice: qué se buscó, dónde, qué se obtuvo, qué quedó sin obtener y por
qué.

**Tres advertencias que hay que leer antes de usar cualquier dato de acá:**

1. **Ninguna cita de este documento fue leída en el sitio oficial de la norma.**
   Ver §1: en esta sesión el acceso directo a sitios web quedó bloqueado por
   política de egreso de red. Todo lo que sigue proviene de un **buscador web**,
   que devuelve transcripciones atribuidas a fuentes oficiales pero **no permite
   confirmar que la transcripción sea fiel ni que el texto esté vigente**.
2. **Verificar un texto no es ratificarlo.** Aunque un punto figure como
   corroborado, la condición **C-03** de `cumplimiento.md` sigue incumplida: hace
   falta que una persona matriculada lea la norma, la interprete y la firme. Este
   documento **reduce el trabajo del estudio, no lo reemplaza**.
3. **Donde aparecieron contradicciones, se dejaron a la vista y no se
   resolvieron.** Hay al menos tres (§3.6, §3.7, §3.12) y una de ellas contradice
   un valor que la revisión anterior daba por verificado.

### Leyenda de estado

| Estado | Significado |
| --- | --- |
| **VERIFICADO** | Texto leído en el sitio oficial de la norma. **En esta sesión: ninguno.** |
| **CORROBORADO** `[C]` | Transcripción obtenida por buscador, coincidente entre dos o más fuentes independientes, al menos una de ellas oficial o para-oficial. **Sirve para orientar al estudio; no sirve para citar en un documento que salga al cliente ni a un juzgado.** |
| **NO VERIFICADO** | No se obtuvo transcripción utilizable, o la obtenida es de fuente única, ambigua o secundaria. |
| **INACCESIBLE** | La fuente oficial existe y está identificada, pero el entorno no permitió abrirla. Se consigna el error concreto. |

---

## 1. Condición material de la búsqueda — por qué no hay ningún VERIFICADO

El encargo pedía intentar, en este orden: SAIJ, Boletín Oficial, argentina.gob.ar
y sitios de organismos, y repositorios de jurisprudencia oficiales. **Se intentó
en ese orden. Todos fallaron por el mismo motivo.**

### 1.1 Intentos de acceso directo (herramienta de fetch)

| # | Host | URL intentada | Resultado |
| --- | --- | --- | --- |
| 1 | `www.argentina.gob.ar` | `/normativa/nacional/decreto-484-1987-77255/texto` | `EGRESS_BLOCKED` — "Access to www.argentina.gob.ar is blocked by the network egress proxy" |
| 2 | `www.saij.gob.ar` | ficha del Decreto 484/1987 | `EGRESS_BLOCKED` |
| 3 | `servicios.infoleg.gob.ar` | `/infolegInternet/anexos/20000-24999/22473/norma.htm` | `EGRESS_BLOCKED` |
| 4 | `www.trabajo.gba.gov.ar` | `/delegaciones/biblioteca_deles/DN484_1987.pdf` (PDF oficial de la Provincia de Buenos Aires) | `EGRESS_BLOCKED` |
| 5 | `www.cij.gov.ar` | sentencia en PDF del Poder Judicial de la Nación | `EGRESS_BLOCKED` |
| 6 | `www.boletinoficial.gob.ar` | `/detalleAviso/primera/1/19870401` | `EGRESS_BLOCKED` |
| 7 | `www.bcra.gob.ar` | `/archivos/Pdfs/texord/t-depaho.pdf` | `EGRESS_BLOCKED` |
| 8 | `es.wikipedia.org` | prueba de control, para descartar que el problema fuera del sitio oficial | `EGRESS_BLOCKED` |

El intento **8** es el diagnóstico: el bloqueo **no es de los sitios oficiales**,
es del entorno. La política de egreso de esta sesión no habilita **ningún**
destino para lectura directa de páginas.

Conforme `/root/.ccr/README.md`, un 403/407 o bloqueo de política **no se
reintenta ni se rodea**: se reporta. Se reporta acá.

### 1.2 Único canal que funcionó

La **búsqueda web** sí respondió. Devuelve una síntesis redactada a partir de los
resultados, más la lista de enlaces. Eso implica dos limitaciones que el estudio
tiene que tener presentes:

- La transcripción **la produjo un intermediario**, no la fuente. Puede haber
  omisiones, modernizaciones ortográficas o mezcla de texto original con texto
  actualizado.
- **No hay forma de saber, desde acá, si el texto transcripto es el vigente**
  o uno derogado. Es exactamente el error que el §4.4 de `cumplimiento.md`
  describe como "el más caro que puede cometer el motor".

Por eso **ningún punto de este registro pasa a `[V]`** en `cumplimiento.md`, y se
incorporó un marcador nuevo, `[C]`, para no confundir corroboración con
verificación.

---

## 2. Tablero de estado de los doce puntos

| # | Punto (§8 de `cumplimiento.md`) | Estado | Dónde quedó |
| --- | --- | --- | --- |
| 1 | Art. 1 Decreto 484/87 — base del excedente del 2º tramo | **CORROBORADO** `[C]` con **ambigüedad del propio texto** | §3.1 |
| 2 | Art. 47 Ley 25.065 — prescripción | **CORROBORADO** `[C]` | §3.3 |
| 3 | Art. 770 CCyC — capitalización | **CORROBORADO** `[C]`; incidencia del DNU sobre el capítulo: **NO VERIFICADO** | §3.5 |
| 4 | Art. 18 Ley 25.065 anterior + fecha de vigencia del DNU 70/2023 | **CORROBORADO** `[C]`; la fecha de vigencia es **inferencia doctrinaria**, no texto | §3.2 |
| 5 | Numeración del art. de la Ley 27.423 sobre cuota litis | **CORROBORADO** `[C]` = **art. 6**, con **contradicción** sobre materias protegidas | §3.6 |
| 6 | Art. 277 LCT vigente | **CORROBORADO parcial** `[C]`; **hallazgo nuevo: Ley 27.802 (BO 06/03/2026) lo modificó** | §3.7 |
| 7 | Comunicación BCRA sobre intangibilidad de cuenta sueldo | **NO VERIFICADO** (fuente identificada, texto no leído) | §3.8 |
| 8 | Régimen de permanencia en la Central de Deudores del BCRA | **NO VERIFICADO** (fuente identificada, texto no leído) | §3.9 |
| 9 | Jurisprudencia CSJN sobre el *dies a quo* del art. 26 inc. 4 | **CORROBORADO parcial** `[C]`; **hallazgo nuevo: Decreto 1558/2001** | §3.4 |
| 10 | Estado actualizado del DNU 70/2023 | **CORROBORADO** `[C]` | §3.2 |
| 11 | Leyes de colegiación (Ley 23.187 y provinciales) | **CORROBORADO parcial** `[C]` (nacional); provinciales **NO VERIFICADO** | §3.11 |
| 12 | Embargabilidad de haberes previsionales | **CORROBORADO** `[C]`; **hallazgo grave: régimen distinto del salarial** | §3.12 |

**Resumen numérico.** Corroborados por buscador: **8 completos + 3 parciales**.
Sin ningún avance: **1** (punto 7 y 8 quedan sin texto; cuentan como los dos no
resueltos, y uno de los parciales cubre el punto 11). Verificados en fuente
oficial: **0**. Inaccesibles por bloqueo de red: **todas las fuentes oficiales**.

---

## 3. Registro punto por punto

### 3.1 Decreto 484/87, art. 1 — la base del excedente `[C]` + AMBIGÜEDAD

> **Este era el punto más urgente del encargo. La respuesta no es la que se
> esperaba: no es que no se conozca el texto, es que el texto es ambiguo.**

**Qué se buscó.** El texto literal del art. 1, para decidir si el 20% del segundo
tramo se aplica sobre el excedente de **un** SMVM o de **dos**.

**Consultas realizadas** (2026-09-20):

- `Decreto 484/87 artículo 1 "salario mínimo vital" embargables "10%" "20%" texto`
- `decreto 484/87 inciso 2 "veinte por ciento" excedente "un salario mínimo" o "dos salarios mínimos" interpretación jurisprudencia`

**Transcripción obtenida** (coincidente entre resultados que citan el PDF oficial
del Ministerio de Trabajo de la Provincia de Buenos Aires y otras fuentes):

> Las remuneraciones devengadas por los trabajadores en cada período mensual, así
> como cada cuota del sueldo anual complementario son inembargables hasta una suma
> equivalente al importe mensual del SALARIO MINIMO VITAL fijado de conformidad
> con lo dispuesto en los artículos 116 y siguientes del Régimen de Contrato de
> Trabajo (L.C.T. - T.O. por Decreto Nro. 390/76).
>
> Las remuneraciones superiores a ese importe serán embargables en la siguiente
> proporción:
>
> 1. Remuneraciones no superiores al doble del SALARIO MINIMO VITAL mensual, hasta
>    el diez por ciento (10%) **del importe que excediere de este último**.
> 2. Retribuciones superiores al doble del SALARIO MINIMO VITAL mensual, hasta el
>    veinte por ciento (20%) **del importe que excediere de este último**.

**El hallazgo.** Los dos incisos usan **exactamente la misma fórmula**: "del
importe que excediere de este último". La pregunta del encargo se traslada
entonces a **a qué remite "este último" en el inciso 2**, y el texto no lo aclara.

Las dos lecturas posibles, sin que este revisor tome partido:

| Lectura | "Este último" remite a | Consecuencia en el inciso 2 |
| --- | --- | --- |
| **L1** | El **SMVM** (un salario mínimo) | Se embarga el 20% de (remuneración − 1 SMVM) |
| **L2** | El **doble del SMVM** | Se embarga el 20% de (remuneración − 2 SMVM) |

`[I]` Dos observaciones de lectura, que son **criterio del revisor y no
interpretación autorizada**:

- En el **inciso 1**, L2 sería absurda: para un sueldo entre 1 y 2 SMVM, el
  excedente sobre 2 SMVM es cero o negativo y nunca habría nada embargable. Eso
  fuerza a leer "este último" = SMVM **en el inciso 1**.
- En el **inciso 2**, L2 **no** es absurda, y por eso la ambigüedad es real. El
  argumento a favor de L1 es el paralelismo con el inciso 1 y la frase que
  encabeza la enumeración ("Las remuneraciones superiores **a ese importe**",
  donde "ese importe" es inequívocamente el SMVM). El argumento a favor de L2 es
  la regla gramatical del antecedente más próximo.

**Consecuencia para el motor.** El parámetro `embargo.tramo2.porcentaje` **no
puede cargarse** hasta que el estudio se pronuncie, y lo que hay que pedirle al
estudio **cambia**: ya no es "confirmar el texto" sino "**dictaminar cuál de las
dos lecturas se aplica, con la jurisprudencia que la sostenga**". Es una pregunta
de interpretación, no de transcripción, y por lo tanto **está fuera de lo que este
agente puede resolver por definición**.

**Lo que no se pudo obtener.** Jurisprudencia concreta que zanje la cuestión. La
búsqueda devolvió sentencias potencialmente pertinentes pero **sus PDF están en
`cij.gov.ar` y `jus.mendoza.gov.ar`, ambos bloqueados**.

**Fuentes que el estudio debería abrir primero** (identificadas, no leídas):

- `https://www.trabajo.gba.gov.ar/delegaciones/biblioteca_deles/DN484_1987.pdf` — PDF oficial provincial del decreto.
- `https://www.argentina.gob.ar/normativa/nacional/decreto-484-1987-77255` — ficha oficial nacional.
- `https://www.cij.gov.ar/scp/d/sentencia-SGU-f9283bf9-4497-4df6-b320-247ee629396b.pdf` — sentencia del Poder Judicial de la Nación que, según el resumen del buscador, trata la embargabilidad por superar el SMVM.

**Estado final: CORROBORADO `[C]` en cuanto al texto; el punto de fondo del
encargo queda ABIERTO y reclasificado como cuestión interpretativa.**

---

### 3.2 DNU 70/2023, art. 20, y el art. 18 de la Ley 25.065 `[C]`

**Consultas** (2026-09-20):

- `DNU 70/2023 artículo 20 sustituye artículo 18 ley 25.065 punitorios no capitalizables entrada en vigencia`
- `ley 25.065 artículo 18 texto anterior "intereses punitorios" "no podrán superar" "cincuenta por ciento" art 16`
- `DNU 70/2023 "entrará en vigencia" artículo vigencia publicación Boletín Oficial 21 diciembre 2023`
- `DNU 70/2023 estado 2026 Cámara de Diputados vigencia rechazo Corte Suprema`

**Texto anterior del art. 18 (derogado por el DNU)** `[C]`:

> El límite de los intereses punitorios que el emisor aplique al titular no podrá
> superar en más del cincuenta por ciento (50%) a la efectivamente aplicada por la
> institución financiera en concepto de interés compensatorio o financiero.
> Independientemente de lo dispuesto por las leyes de fondo, los intereses
> punitorios no serán capitalizables.

**Texto vigente según el art. 20 del DNU 70/2023** `[C]`:

> Independientemente de lo dispuesto por las leyes de fondo, los intereses
> punitorios no serán capitalizables.

`[I]` Dato relevante que la revisión anterior no tenía: **la no capitalización ya
estaba en el texto original**. Lo que el DNU hizo fue **suprimir el primer
párrafo**, es decir el tope del 50%, conservando el segundo. Eso refuerza la
lectura del §4.4 de `cumplimiento.md`: para hechos posteriores **no hay tope de
punitorios en la ley de tarjetas**, hay sólo prohibición de capitalizarlos.

**Fecha de publicación** `[C]`: Boletín Oficial del **21/12/2023**.

**Fecha de entrada en vigencia — ATENCIÓN, ESTO NO ES TEXTO NORMATIVO.** Las
fuentes consultadas son coincidentes pero todas hacen el **mismo razonamiento
doctrinario**: como el DNU no fijó fecha propia de vigencia, rige el art. 5 del
CCyC (octavo día desde la publicación oficial), lo que daría el **29/12/2023**.
Hay además publicaciones del 21/12/2023 que afirman que "ya está vigente".

> **No se pudo leer el artículo final del DNU** para confirmar si fija o no una
> fecha de vigencia propia. **La fecha de corte del parámetro
> `intereses.topePunitorio.tarjeta` no debe cargarse sobre esta base.** Es una
> fecha que decide, deuda por deuda, si hay tope o no hay tope.

**Estado del DNU a la fecha de esta búsqueda** `[C]`:

- **Senado**: rechazó el DNU (42 votos en contra, 25 a favor, 4 abstenciones).
- **Diputados**: **no lo trató**. Por eso el DNU **sigue vigente**: se requiere el
  rechazo de ambas cámaras.
- **CSJN**: rechazó por unanimidad los planteos del gobernador de La Rioja y de la
  asociación civil Gente de Derecho por ausencia de caso, causa o controversia
  concreta; también rechazó un per saltum. Consecuencia: el DNU **mantiene
  vigencia**.
- **Suspensiones parciales**: capítulos expresamente suspendidos por tribunales
  inferiores, entre ellos la **reforma laboral (Título IV)**, la Ley de Tierras y
  la del INYM.

`[I]` **Advertencia de caducidad de este dato.** El estado del DNU es un dato
**vivo**. Todo lo de arriba vale a la fecha de esta búsqueda y **debe reconsultarse
antes de cada puesta en producción**, tal como pedía el punto 10 del §8.

**Estado final: CORROBORADO `[C]`, salvo la fecha exacta de entrada en vigencia,
que queda NO VERIFICADA.**

---

### 3.3 Ley 25.065, art. 47 — prescripción `[C]`

**Consulta**: `"artículo 47" ley 25.065 tarjetas de crédito prescripción "tres años" "un año" texto`

**Transcripción obtenida** `[C]`:

> Las acciones de esta ley prescriben:
> a) Al año, la acción ejecutiva.
> b) A los tres (3) años, las acciones ordinarias.

Coincidente entre múltiples fuentes periodísticas y de estudios jurídicos; el
enlace a InfoLeg apareció en los resultados pero **no pudo abrirse**.

`[I]` Confirma provisoriamente los valores propuestos para
`prescripcion.plazoTarjetaEjecutiva` (1 año) y `prescripcion.plazoTarjetaOrdinaria`
(3 años). **No resuelve** —y ninguna fuente lo hizo— desde **cuándo** corre cada
plazo, que es lo que el motor necesita además del número.

**Estado final: CORROBORADO `[C]`.**

---

### 3.4 *Dies a quo* del art. 26 inc. 4 de la Ley 25.326 `[C]` + HALLAZGO NUEVO

> **Hallazgo relevante: el punto no dependía sólo de jurisprudencia. Hay una norma
> reglamentaria que lo trata expresamente y que la revisión anterior no había
> identificado.**

**Consultas**:

- `CSJN "Catania" Veraz artículo 26 inciso 4 ley 25.326 cómputo cinco años "última información adversa"`
- `decreto 1558/2001 reglamentario artículo 26 ley 25.326 "última información adversa" cómputo cinco años texto`
- `fallo CSJN "Catania, Américo Marcial c/ BCRA" 2011 habeas data plazo cinco años dies a quo Fallos`

**a) Decreto 1558/2001, reglamentario de la Ley 25.326, art. 26** `[C]`:

> Para apreciar la solvencia económico-financiera de una persona, conforme lo
> establecido en el artículo 26, inciso 4, de la Ley Nº 25.326, se tendrá en
> cuenta toda la información disponible desde el nacimiento de cada obligación
> hasta su extinción. En el cómputo de CINCO (5) años, éstos se contarán a partir
> de la fecha de la **última información adversa archivada que revele que dicha
> deuda era exigible**.

Y, según la misma fuente: si el deudor acredita que la última información
disponible coincide con la extinción de la deuda, el plazo se reduce a **dos
años**; para los datos de cumplimiento sin mora **no opera plazo alguno** de
eliminación.

**b) CSJN, "Catania, Américo Marcial c/ BCRA s/ habeas data", 08/11/2011** `[C]`,
citado como **Fallos 334:1276**:

Según las reseñas consultadas, la Corte sostuvo que **el plazo de cinco años no se
posterga mientras la deuda siga siendo exigible y no esté prescripta**, apoyándose
en el debate parlamentario (la propuesta original era de diez años y se bajó a
cinco). Se lo reseña como uno de los primeros pronunciamientos de la Corte sobre
el "derecho al olvido" en materia crediticia.

**Por qué esto NO cierra el punto** `[I]`:

Hay una **tensión visible** entre (a) y (b). El decreto reglamentario ancla el
cómputo en la **última información adversa archivada**, criterio que permite al
acreedor extender el plazo indefinidamente reinformando la deuda. La doctrina que
las reseñas atribuyen a Catania va en sentido contrario. **Resolver esa tensión es
exactamente la interpretación que el motor necesita y que este agente no puede
hacer.**

**Lo que cambia para el estudio.** La pregunta del punto 9 deja de ser "¿existe
jurisprudencia?" y pasa a ser concreta:

> ¿Prevalece el criterio del art. 26 del Decreto 1558/2001 ("última información
> adversa archivada que revele que la deuda era exigible") o el de la CSJN en
> Catania? ¿Y cómo se traduce eso en una **fecha calculable** a partir de los datos
> que el cliente puede aportar?

**Lo que no se pudo obtener.** El texto de la sentencia. La ficha en SAIJ
(`saij.gob.ar/corte-suprema-...-catania-americo-marcial-bcra-...`) y el Dossier de
Hábeas Data de SAIJ aparecieron en los resultados pero **el host está bloqueado**.

`[I]` **`archivoCrediticio.diesAQuo` debe seguir en `[D]` y la condición C-06
sigue plenamente vigente.** Lo que cambió es que ahora hay dos fuentes nominadas
para que el estudio arranque.

**Estado final: CORROBORADO parcial `[C]`. La regla aplicable sigue SIN
DETERMINAR.**

---

### 3.5 CCyC — arts. 770, 771, 2560, 2562, 2564, 2541 `[C]`

**Consultas**:

- `Código Civil y Comercial artículo 770 anatocismo texto "no se deben intereses de los intereses" incisos a b c d`
- `Código Civil y Comercial artículo 771 texto "facultades judiciales" intereses "costo medio del dinero"`
- `Código Civil y Comercial artículo 2560 2562 2564 texto prescripción "cinco años" "dos años" "un año"`
- `Código Civil y Comercial artículo 2541 interpelación fehaciente suspensión "seis meses" "una sola vez" artículo 2537 2553 texto`

**Art. 770 — Anatocismo** `[C]`:

> No se deben intereses de los intereses, excepto que:
> a) una cláusula expresa autorice la acumulación de los intereses al capital con
> una periodicidad **no inferior a seis meses**;
> b) la obligación se demande judicialmente; en este caso, la acumulación opera
> desde la fecha de la notificación de la demanda;
> c) la obligación se liquide judicialmente; en este caso, la capitalización se
> produce desde que el juez manda pagar la suma resultante y el deudor es moroso
> en hacerlo;
> d) otras disposiciones legales prevean la acumulación.

Corrobora `intereses.capitalizacion.periodicidadMinimaPactable = 6 meses` y el
catálogo de cuatro supuestos de `intereses.capitalizacion.supuestosAdmitidos`.

> **No se pudo verificar** si el DNU 70/2023 alcanzó el capítulo de obligaciones
> dinerarias del CCyC. Ninguna consulta lo aclaró. **Queda pendiente.**

**Art. 771 — Facultades judiciales** `[C]`:

> Los jueces pueden reducir los intereses cuando la tasa fijada o el resultado que
> provoque la capitalización de intereses excede, sin justificación y
> desproporcionadamente, el costo medio del dinero para deudores y operaciones
> similares en el lugar donde se contrajo la obligación. Los intereses pagados en
> exceso se imputan al capital y, una vez extinguido éste, pueden ser repetidos.

`[I]` **Confirma la condición C-04**: es una **facultad de reducción judicial**, no
un tope legal de aplicación automática. El lenguaje del hallazgo del análisis B en
el régimen general debe reformularse, como ya pedía `cumplimiento.md` §4.5.

**Art. 2560 — Plazo genérico** `[C]`:

> El plazo de la prescripción es de cinco años, excepto que esté previsto uno
> diferente en la legislación local.

**Art. 2562 — Plazo de dos años** `[C]`: prescriben a los dos años, entre otros,
"el reclamo de todo lo que se devenga por años o plazos periódicos más cortos"
(inc. c). Los otros incisos reseñados: nulidad relativa y revisión de actos
jurídicos; reclamo de derecho común por accidentes y enfermedades del trabajo.

> `[I]` **No resuelve** la duda que `cumplimiento.md` marcó como decisiva: si el
> inc. c) alcanza a **las cuotas de un préstamo personal** o si el reintegro de un
> capital fraccionado en cuotas queda fuera. Ninguna fuente consultada lo abordó.
> **`prescripcion.plazoPeriodico` sigue en `[D]` en cuanto a su ámbito.**

**Art. 2564 — Plazo de un año** `[C]`: vicios redhibitorios, acciones posesorias,
responsabilidad del constructor por ruina. `[I]` **Ninguno de esos supuestos es
aplicable a la cartera del producto**; el plazo de un año de tarjetas viene del
art. 47 de la Ley 25.065, no de acá.

**Art. 2541 — Suspensión por interpelación fehaciente** `[C]`:

> El curso de la prescripción se suspende, **por una sola vez**, por la
> interpelación fehaciente hecha por el titular del derecho contra el deudor o el
> poseedor. Esta suspensión sólo tiene efecto durante **seis meses** o el plazo
> menor que corresponda a la prescripción de la acción.

`[I]` **Confirma el defecto D-11**: el motor debe limitar la interpelación a una
sola vez, y el efecto máximo es de seis meses **o menos** si el plazo de
prescripción es más corto. Esa segunda parte ("o el plazo menor que corresponda")
es una regla de cálculo que la spec no contempla y que el motor tiene que
implementar.

**Art. 2542 — Suspensión por pedido de mediación** `[C]`, parcial: el curso se
suspende "desde la expedición por medio fehaciente de la comunicación de la fecha
de la audiencia de mediación o desde su celebración, lo que ocurra primero".

**Arts. 2537 (derecho transitorio) y 2553 (oportunidad procesal): NO VERIFICADOS.**
Aparecieron mencionados en los resultados pero ninguna fuente transcribió el
texto. Siguen en `[P]`/`[D]`.

**Estado final: CORROBORADO `[C]` para 770, 771, 2560, 2562, 2564, 2541 y 2542.
NO VERIFICADO para 2537 y 2553.**

---

### 3.6 Ley 27.423 — numeración del artículo de cuota litis `[C]` + CONTRADICCIÓN

**Consultas**:

- `ley 27.423 "pacto de cuota litis" artículo número "treinta por ciento" "cuarenta por ciento" "veinte por ciento"`
- `"ley 27423" "artículo 6" texto "cuota litis" previsionales alimentarios menores representación legal`
- `"ley 27.423" artículo 6 "el pacto no podrá exceder del treinta por ciento" "no podrán ser objeto de pacto de cuota litis"`

**Numeración** `[C]`: el pacto de cuota litis está regulado en el **artículo 6** de
la Ley 27.423. Coincidente entre todas las fuentes consultadas. Esto **resuelve el
punto 5 del §8**.

**Contenido corroborado** `[C]`:

> Los abogados y procuradores podrán celebrar con sus clientes pacto de cuota
> litis, por su actividad en uno o más procesos, en todo tipo de casos, con
> sujeción a las siguientes reglas: se redactará, antes o después de iniciado el
> juicio, por escrito, con tantos ejemplares como partes hubiera; y **no podrá
> exceder del treinta por ciento (30%) del resultado del pleito, cualquiera fuese
> el número de pactos celebrados e independientemente del número de profesionales
> intervinientes**.

El tope ampliado al **40%** cuando el profesional toma a su cargo las costas de la
defensa de su cliente también aparece corroborado.

> ### CONTRADICCIÓN CON LA REVISIÓN ANTERIOR — hay que resolverla
>
> `cumplimiento.md` §5.E carga `cuotaLitis.topeMateriasProtegidas = 20%` y lo marca
> `[V]`, para asuntos previsionales, alimentarios y con menores.
>
> **Las fuentes consultadas ahora dicen otra cosa.** Atribuyen al **art. 6 inc. c)**
> una **prohibición**, no un tope: en asuntos previsionales, alimentarios y en los
> que intervengan menores con representación legal, los honorarios **"no podrán
> ser objeto de pacto de cuota litis"**. Un resultado adicional refuerza esa
> lectura: una fiscalía federal informa que en Caleta Olivia **se declaró la
> nulidad absoluta** de un pacto de cuota litis cobrado en una **causa
> previsional** (`fiscales.gob.ar`).
>
> `[I]` **La diferencia no es de grado, es de naturaleza.** Si es una prohibición,
> un motor que devuelva "hasta el 20%" en una causa previsional estaría avalando un
> pacto **nulo**, sobre un cliente que además pertenece al grupo que la norma quiso
> proteger. Es, en potencia, el peor error del análisis E.
>
> **No se resuelve acá.** Este revisor no leyó el texto oficial del art. 6 inc. c)
> y no va a elegir entre dos versiones. **Se marca como discrepancia abierta, el
> valor `20%` se degrada de `[V]` a `[!]` y el análisis E no debe evaluar materias
> previsionales, alimentarias ni con menores hasta que el estudio se pronuncie.**

**Fuente que el estudio debería abrir primero**:
`https://www.consejo.org.ar/storage/attachments/Ley%20N27423.pdf-O71aJK4p6a.pdf`
(PDF de la ley publicado por el Consejo Profesional) y
`https://www.boletinoficial.gob.ar/detalleAviso/primera/176541/20171222` (aviso
original en el Boletín Oficial, 22/12/2017).

**Estado final: numeración CORROBORADA `[C]` (art. 6). Materias protegidas:
CONTRADICCIÓN ABIERTA.**

---

### 3.7 LCT art. 277 `[C]` + HALLAZGO NUEVO: Ley 27.802 (2026)

**Consultas**:

- `LCT artículo 277 texto vigente pacto cuota litis 20% modificado DNU 70/2023 ley 27.742`
- `reforma laboral 2026 Argentina modificación artículo 277 LCT honorarios cuota litis ley número`

**Texto reseñado del art. 277** `[C]`:

> Queda prohibido el pacto de cuota litis que exceda del veinte por ciento (20%),
> el que, en cada caso, requerirá ratificación personal y homologación judicial.
> Todo pago realizado sin observar lo prescripto y el pacto de cuota litis o
> desistimiento no homologados, serán nulos de pleno derecho.

Corroborado además por un **fallo plenario de la CNAT** (marzo 2024) que resolvió
que el límite del 20% del art. 277 **no puede excederse** por la condición
tributaria del letrado frente al IVA.

> ### HALLAZGO NUEVO — no estaba en la revisión anterior
>
> Las búsquedas devolvieron la **Ley 27.802, "Ley de Modernización Laboral"**,
> publicada en el **Boletín Oficial del 06/03/2026**
> (`boletinoficial.gob.ar/detalleAviso/primera/339128/20260306`), que **modificó el
> art. 277 de la LCT**.
>
> Según las reseñas consultadas, el tope del **20% subsiste**, junto con la
> exigencia de **ratificación personal y homologación judicial**, y se agregan
> reglas nuevas: pago bancarizado en la cuenta sueldo de la Ley 26.590, sentencias
> pagaderas hasta en seis cuotas (doce para MiPyME) y un tope del 25% del monto de
> condena para costas y honorarios de primera instancia.
>
> `[I]` **Dos consecuencias.**
> 1. El punto 6 del §8 preguntaba por el DNU 70/2023 y la Ley 27.742. **La norma
>    que efectivamente hay que mirar es otra y es de hace seis meses.** La
>    pregunta al estudio hay que reformularla.
> 2. Existe litigio sobre la **aplicación temporal** de la reforma a juicios en
>    trámite (apareció un modelo de escrito de marzo de 2026 planteando
>    precisamente eso). Si el motor evalúa pactos de causas anteriores a marzo de
>    2026, la regla de vigencia por fecha del hecho (CA-29) **no alcanza**: hay una
>    discusión de derecho transitorio abierta.
>
> **No se leyó el texto de la Ley 27.802.** `boletinoficial.gob.ar` está bloqueado.

**Estado final: CORROBORADO parcial `[C]`. `cuotaLitis.topeLaboral` sigue sin
poder cargarse: hay norma nueva sin leer y derecho transitorio en disputa.**

---

### 3.8 BCRA — intangibilidad de la cuenta sueldo: **NO VERIFICADO**

**Consultas**:

- `BCRA comunicación cuenta sueldo intangibilidad prohibición débito compensación "cuenta sueldo" texto ordenado "Depósitos de ahorro, cuenta sueldo"`
- `BCRA "cuenta sueldo" "no podrán" débitos compensación deudas "artículo 147" LCT comunicación A número intangibilidad`

**Qué se logró.** Identificar **dónde está la norma**, que es más de lo que había:

- Texto ordenado del BCRA **"Depósitos de ahorro, cuenta sueldo y especiales"** —
  `https://www.bcra.gob.ar/archivos/Pdfs/texord/t-depaho.pdf`
- Comunicaciones "A" que aparecen asociadas a ese texto ordenado en los
  resultados: **A 6042** (incorporación), **A 6610**, **A 6909** (19/02/2020),
  **A 7062**, **A 8027**, **A 8106**, **A 8343**. **Ninguna verificada como la
  vigente en la materia puntual.**

**Qué no se logró.** El punto normativo concreto que consagra la intangibilidad y
prohíbe al banco debitar o compensar. Los resúmenes del buscador mezclaron la
regla del BCRA con el art. 147 de la LCT y con jurisprudencia contradictoria
(un resultado titula "Autorizan embargo sobre la cuenta sueldo del trabajador").
**Nada de eso es citable.**

`[I]` Además apareció un dato que **no estaba en la revisión anterior y que hay que
mirar**: se menciona un régimen por el cual el saldo de la cuenta sueldo sería
inembargable hasta un importe equivalente a **tres veces el salario promedio de
los últimos seis meses**. Si eso es correcto y vigente, el análisis D tendría una
regla propia para el saldo en cuenta, distinta de la escala del Decreto 484/87.
**Sin verificar; se deja anotado como pista para el estudio.**

**Causa del fallo: `www.bcra.gob.ar` → `EGRESS_BLOCKED`.**

**Estado final: NO VERIFICADO (fuente identificada, texto no leído).
`embargo.cuentaSueldo.intangibilidad` sigue en `[D]` y CA-22 sigue sin poder citar
la norma que exige CA-27.**

---

### 3.9 BCRA — permanencia en la Central de Deudores: **NO VERIFICADO**

**Consultas**:

- `BCRA Central de Deudores del Sistema Financiero permanencia información "24 meses" texto ordenado comunicación`
- `BCRA texto ordenado "Central de Deudores del Sistema Financiero" comunicación "A" régimen informativo permanencia norma`

**Qué se logró.**

- La norma es el **"Régimen Informativo de Deudores del Sistema Financiero
  (R.I.–D.S.F.)"**, con una sección específica sobre la Central de Deudores, y se
  articula con el texto ordenado sobre **"Clasificación de deudores"**.
- Comunicaciones "A" que aparecieron asociadas: **A 3119**, **A 4765**, **A 8045**.
  **Ninguna verificada como la vigente.**
- Sobre el plazo: la **cuenta oficial del BCRA** publicó que la Central contiene
  "las financiaciones de cada persona de **los últimos 24 meses**". El resto de las
  fuentes (medios, blogs de fintech) repite la misma cifra.

**Por qué no alcanza** `[I]`: una publicación en una red social **no es una norma**,
y 24 meses puede ser la **ventana de consulta del informe público** y no el
**plazo normativo de permanencia del dato**. Son dos cosas distintas y el motor
necesita la segunda. Confundirlas produciría exactamente el error del riesgo
RL-06.

**Lo que sí queda confirmado como problema de diseño**: la Central de Deudores del
BCRA **es un registro distinto** de los bureaus privados, con norma propia. El
**defecto D-16 y la condición C-06 quedan reforzados**, no resueltos.

**Causa del fallo: `www.bcra.gob.ar` → `EGRESS_BLOCKED`.**

**Estado final: NO VERIFICADO.**

---

### 3.10 Estado del DNU 70/2023

Tratado en **§3.2**. **CORROBORADO `[C]`**, con la advertencia de que es un dato
con fecha de vencimiento y hay que reconsultarlo antes de producción.

---

### 3.11 Leyes de colegiación — Ley 23.187 `[C]` / provinciales NO VERIFICADO

**Consulta**: `ley 23.187 ejercicio de la abogacía Capital Federal artículo 1 matrícula CPACF texto`

**Corroborado** `[C]`:

- Ley 23.187, sancionada el **05/06/1985**, publicada en el BO del **28/06/1985**.
- Art. 1: el ejercicio de la profesión de abogado en la Capital Federal se rige por
  esta ley y subsidiariamente por los códigos procesales nacionales; la protección
  de la libertad y dignidad de la profesión integra sus fines.
- Para ejercer en la Capital Federal se requiere **título habilitante** e
  **inscripción en la matrícula** que lleva el **Colegio Público de Abogados de la
  Capital Federal**, creado por esa ley.

**Lo que NO se verificó:**

- El artículo que **tipifica el ejercicio ilegal** de la profesión y su alcance,
  que es lo que realmente importa para el §4.2 de `cumplimiento.md` (riesgo RL-02).
- **Todas** las leyes de colegiación **provinciales**. No se intentó una por una:
  con el canal disponible, veinticuatro jurisdicciones por buscador no producirían
  material citable. `[I]` Esto es coherente con la decisión 004-D (empezar sólo por
  Nacional y Federal), pero **el riesgo RL-02 no es jurisdiccional**: la app se usa
  desde todo el país.
- **Los códigos de ética** de los colegios, base de la prohibición de partición de
  honorarios con quien no es abogado (constitución #10, condición C-09). Sin
  verificar.

**Estado final: CORROBORADO parcial `[C]` para la Ley 23.187. Provinciales y
códigos de ética: NO VERIFICADO.**

---

### 3.12 Embargabilidad de haberes previsionales `[C]` — HALLAZGO GRAVE

**Consulta**: `ley 24.241 artículo 14 inciso c inembargabilidad prestaciones previsionales jubilaciones "salvo" alimentos`

**Corroborado** `[C]`, coincidente entre varias fuentes incluido un juzgado civil y
comercial de La Plata:

> **Ley 24.241, art. 14 inc. c)**: las prestaciones previsionales **son
> inembargables**, con la salvedad de las **cuotas por alimentos y litisexpensas**.

`[I]` **Esto no es un matiz del análisis D: es un régimen distinto.**

| | Remuneración (Decreto 484/87) | Haber previsional (Ley 24.241 art. 14 inc. c) |
| --- | --- | --- |
| Regla | Inembargable hasta 1 SMVM; **escala** de 10%/20% sobre el excedente | **Inembargable**, sin escala |
| Excepción | Deudas alimentarias | Cuotas por alimentos y litisexpensas |

Si el motor aplicara el Decreto 484/87 a un jubilado, **calcularía como embargable
algo que la ley declara inembargable**, y le diría a un jubilado que el descuento
que sufre está dentro del tope cuando podría no corresponder en absoluto. Es un
error que perjudica al cliente **en el sentido contrario al habitual**: no le
inventa un derecho, se lo **oculta**.

**El defecto D-19 y el riesgo RL-11 quedan confirmados y, a criterio de este
revisor, subestimados en la calificación original.** `[I]` Es el hallazgo más
accionable de toda esta ronda de verificación.

**Matiz que no se pudo resolver.** Aparecieron resultados sobre **aplicación
analógica del Decreto 484/87 a haberes de empleados públicos** y algún caso de
embargo sobre jubilaciones, lo que sugiere que la inembargabilidad no se aplica de
manera uniforme en la práctica judicial. **No se verificó el alcance de esas
excepciones.** El parámetro `embargo.haberesPrevisionales` sigue en `[D]`; lo que
cambió es que ahora hay una norma nominada para dictaminar sobre ella.

**Estado final: CORROBORADO `[C]` en cuanto a la norma. Alcance práctico: NO
VERIFICADO.**

---

## 4. Lo que esta ronda cambió, en concreto

`[I]` Lectura del revisor, para que el estudio sepa dónde poner las horas.

### 4.1 Preguntas que dejaron de ser "¿qué dice la norma?" y pasaron a ser "¿cómo se interpreta?"

Son las más caras y las que **sólo** puede responder un matriculado:

1. **Decreto 484/87 inc. 2** — el texto es ambiguo por sí mismo (§3.1). No había
   nada que "buscar mejor".
2. **Dies a quo del art. 26 inc. 4** — hay una norma reglamentaria y un fallo de la
   Corte que apuntan en direcciones distintas (§3.4).
3. **Art. 2562 inc. c) CCyC** — si alcanza a las cuotas de un préstamo personal
   (§3.5).

### 4.2 Hallazgos nuevos que la revisión anterior no tenía

| Hallazgo | Impacto |
| --- | --- |
| **Ley 27.802, BO 06/03/2026**, modificó el art. 277 LCT (§3.7) | La pregunta del punto 6 estaba desactualizada. Hay derecho transitorio en disputa. |
| **Decreto 1558/2001 art. 26** fija un criterio de *dies a quo* (§3.4) | El análisis C tiene una norma expresa que nadie había citado, en tensión con Catania. |
| **Ley 24.241 art. 14 inc. c** declara **inembargables** las prestaciones previsionales (§3.12) | El defecto D-19 es más grave de lo calificado. |
| El art. 18 de la Ley 25.065 **ya traía** la no capitalización antes del DNU (§3.2) | Refuerza que el DNU sólo suprimió el tope del 50%. |
| **Art. 6 inc. c) Ley 27.423**: posible **prohibición** —no tope del 20%— en materias protegidas (§3.6) | Contradice un valor que estaba marcado `[V]`. |
| Posible inembargabilidad del saldo de cuenta sueldo por **3 salarios promedio** (§3.8) | Regla propia del saldo en cuenta, distinta de la escala salarial. Sin verificar. |

### 4.3 Lo que sigue exactamente igual

- **El veredicto**: APTO CON CONDICIONES. No se revisó, no se cambió.
- **Las doce condiciones C-01 a C-12**: intactas.
- **La condición C-03**: **íntegramente incumplida**. Nada de esta ronda la
  satisface ni parcialmente. Ver §5.

---

## 5. Advertencia final — por qué esto no descarga la condición C-03

> **Verificar el texto de una norma no es ratificarla.**

Son tres operaciones distintas y sólo la primera se intentó acá:

| Operación | Quién puede hacerla | Estado |
| --- | --- | --- |
| **Transcribir** el texto de una norma | Cualquiera con acceso a la fuente | Intentado. Resultado: 0 verificados en fuente oficial, 11 corroborados por buscador. |
| **Interpretar** qué significa y si está vigente para un caso | **Abogado matriculado** | **No hecho. Fuera del alcance de este agente por definición.** |
| **Ratificar** un valor para que el sistema lo use y responder por él | **Abogado matriculado, con nombre, matrícula, jurisdicción y fecha** | **No hecho. Es la condición C-03.** |

Por eso, en la tabla del §5 de `cumplimiento.md`:

- Se completaron valores y se agregó la marca `[C]` con su cita.
- **Las columnas "Validado por" y "Fecha" siguen vacías en el 100% de las filas**,
  y así deben quedar.
- Ningún parámetro cambió su condición `requiereValidacionProfesional: true`.
- **Ningún valor `[C]` habilita una evaluación en producción.** El bloqueo de la
  condición C-02 se aplica a `[C]` exactamente igual que a `[P]`.

`[I]` Dicho sin vueltas: esta ronda hace que el estudio jurídico trabaje mejor y
más rápido. **No adelanta ni un día la fecha en que el motor puede evaluar una
deuda real.**

---

## 6. Pedido concreto de desbloqueo de red

`[I]` Para que una próxima ronda pueda producir `[V]` de verdad, alguien con
acceso a la política de egreso debería habilitar, como mínimo:

`servicios.infoleg.gob.ar` · `www.saij.gob.ar` · `www.argentina.gob.ar` ·
`www.boletinoficial.gob.ar` · `www.bcra.gob.ar` · `sj.csjn.gov.ar` ·
`www.csjn.gov.ar` · `www.cij.gov.ar`

Sin eso, **ningún agente de este repositorio puede producir una cita normativa
citable**, y toda verificación documental va a depender de que una persona abra
los sitios a mano. Se escala al orquestador.

---

*Registro producido por el agente `compliance-legal` el 2026-09-20. No es
asesoramiento jurídico. Material de trabajo para el estudio jurídico que deba
cumplir la condición C-03 de `specs/004-motor-reglas-legales/cumplimiento.md`.*
