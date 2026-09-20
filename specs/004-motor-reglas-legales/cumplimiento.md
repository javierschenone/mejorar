# Revisión de cumplimiento 004 — Motor de reglas legales argentinas

| Campo | Valor |
| --- | --- |
| Autor | `compliance-legal` |
| Spec de origen | `specs/004-motor-reglas-legales/spec.md` |
| Compuerta | G1 |
| Fecha de la revisión | 2026-09-20 |
| Ronda de verificación documental | 2026-09-20 — registro en `specs/legal/verificacion-documental.md` |
| Estado | BORRADOR — pendiente de aprobación humana en G1 |
| **Veredicto** | **APTO CON CONDICIONES** (12 condiciones verificables, §6) — **sin cambios tras la ronda de verificación** |

---

> ## Advertencia principal — leer antes que cualquier otra cosa
>
> **Quien escribe este documento no es abogado y esto no es asesoramiento
> jurídico.** Es material de trabajo preparado por un agente revisor para que un
> **abogado matriculado** lo lea, lo corrija y lo firme.
>
> Ninguna afirmación normativa de este documento debe tomarse como cierta.
> Ningún valor de la tabla del §5 debe cargarse en el sistema como definitivo.
> Todo parámetro que acá se propone sale con `requiereValidacionProfesional: true`
> y **no puede usarse en producción** hasta que una persona matriculada lo ratifique
> por escrito, con nombre, matrícula, jurisdicción y fecha.
>
> Varias de las normas citadas no pudieron verificarse contra su texto oficial
> durante esta revisión (el sitio de InfoLeg estuvo inaccesible desde este entorno).
> Esos puntos están marcados y **hay que verificarlos en el boletín oficial antes de
> usarlos**. Ver §8.
>
> **Ronda de verificación documental del 2026-09-20.** Se intentó verificar los doce
> puntos del §8 en fuentes oficiales alternativas. **Ninguna fuente oficial pudo
> abrirse**: en esta sesión la política de egreso de red bloqueó todos los destinos
> web, incluidos SAIJ, Boletín Oficial, argentina.gob.ar, bcra.gob.ar y cij.gov.ar.
> El único canal disponible fue un **buscador**, que devuelve transcripciones
> atribuidas a fuentes oficiales pero no permite confirmar su fidelidad ni su
> vigencia. Por eso **ningún punto pasó a `[V]`** y se incorporó el marcador `[C]`.
> El registro completo —qué se buscó, con qué resultado, qué falló y por qué— está
> en **`specs/legal/verificacion-documental.md`**, que es el documento que debe
> recibir el estudio jurídico.

### Leyenda de confiabilidad

Cada afirmación normativa de este documento lleva uno de estos marcadores. Si una
afirmación no lo lleva, es un defecto de este documento y hay que reclamarlo.

| Marca | Significado |
| --- | --- |
| `[V]` | Verificada durante esta revisión contra una fuente oficial en línea (argentina.gob.ar / SAIJ). Igual **requiere ratificación profesional**: verificar el texto no equivale a interpretarlo. |
| `[C]` | **Corroborada por buscador, sin lectura de la fuente oficial** (ronda del 2026-09-20). Transcripción coincidente entre dos o más fuentes independientes. **Vale para orientar al estudio; no vale para citar en un documento que salga al cliente o a un juzgado, ni para evaluar en producción.** A los efectos del bloqueo de la condición C-02, `[C]` se trata **igual que `[P]`**. |
| `[P]` | **Pendiente de verificación documental.** Proviene del conocimiento del revisor y **no** pudo contrastarse con el texto oficial. Tratar como hipótesis, no como dato. |
| `[D]` | **A DETERMINAR POR EL ESTUDIO.** El revisor no propone valor porque no tiene base suficiente y un número equivocado acá se propaga a toda la cartera. |
| `[!]` | **Contradicción abierta.** Dos fuentes dicen cosas distintas y el revisor no eligió entre ellas. **El motor no debe evaluar sobre este parámetro** hasta que el estudio lo resuelva. |
| `[I]` | Interpretación o criterio, no texto legal. Opinión del revisor sujeta a corrección. |

> **`[C]` no es un ascenso de `[P]`.** Es la misma incertidumbre jurídica con mejor
> punto de partida documental. La distinción importa: **verificar el texto de una
> norma no equivale a la ratificación profesional que exige la condición C-03**, y
> corroborarlo por buscador está todavía un escalón por debajo de verificarlo.

---

## 1. Normativa aplicable

Una fila por cada uno de los cinco análisis del motor. La columna "Cómo lo cumple
la feature" describe lo que la spec **dice que va a hacer**; no es una constatación
de cumplimiento, que sólo puede hacerse sobre la implementación en G5.

### 1.A — Análisis A: prescripción liberatoria

| Norma | Artículo | Qué exige | Cómo lo cumple la feature |
| --- | --- | --- | --- |
| CCyC | Art. 2560 — plazo genérico de prescripción `[P]` | Plazo general aplicable cuando ninguna norma especial fija otro. | Parámetro `prescripcion.plazoGenerico`, versionado por vigencia (CA-29), nunca constante (R-02). |
| CCyC | Art. 2562 — plazos de dos años `[P]` | Plazo abreviado para ciertos reclamos, entre ellos lo que se devenga por años o plazos periódicos más cortos. | Parámetro por tipo de obligación; la clasificación de la deuda es entrada del motor, no inferencia silenciosa (R-05). |
| CCyC | Art. 2554 — comienzo del cómputo `[P]` | El plazo corre desde que la prestación es exigible. | CA-01 exige fecha de exigibilidad; CA-07 devuelve INDETERMINABLE si falta. Correcto en principio. |
| CCyC | Arts. 2539, 2541, 2542, 2543 — suspensión `[P]` | La suspensión detiene el cómputo sin borrar el tiempo ya corrido; la interpelación fehaciente suspende por un plazo acotado y por una sola vez; el pedido de mediación tiene su propia regla. | CA-05: el plazo se extiende por la duración de la suspensión, sin reiniciarse, y el resultado lo explicita. Coherente. **Falta** que el motor limite la interpelación a una sola vez (§7.3, defecto D-11). |
| CCyC | Arts. 2544, 2545, 2546, 2547, 2548 — interrupción `[P]` | El reconocimiento del deudor, la petición judicial y la solicitud de arbitraje interrumpen; la interrupción hace correr un nuevo plazo íntegro. | CA-04 y CA-06: reinicio desde el hecho más reciente, nombrando el hecho. Coherente. |
| CCyC | Art. 2552 — facultades judiciales `[P]` | El juez no puede declarar de oficio la prescripción. | CA-08 obliga a incluir la advertencia de que la prescripción debe oponerse como defensa. Es el núcleo del riesgo del §4.1. |
| CCyC | Art. 2553 — oportunidad procesal `[P]` | La prescripción debe oponerse dentro de una oportunidad procesal determinada; vencida, se pierde la defensa. | **No cubierto por ninguna CA.** El hallazgo debe decir que la defensa tiene un momento para oponerse. Condición C-07. |
| CCyC | Art. 2537 — transición de plazos `[P]` | Regla para obligaciones nacidas bajo el Código Civil derogado, cuyos plazos eran distintos. | CA-29 (parámetro vigente a la fecha del hecho) da la mecánica, pero el criterio de transición es propio y debe parametrizarse aparte. Ver `prescripcion.reglaTransicionCCyC` en §5. |
| Ley 25.065 | Art. 47 — prescripción de las acciones de la ley `[P]` | Régimen especial para la relación emisor–titular de tarjeta de crédito, distinto del general. | CA-10 y el parámetro por tipo de obligación separan el régimen de tarjetas. **El texto del art. 47 no pudo verificarse** (§8). |
| Ley 24.240 | Art. 3 — integración normativa y regla *in dubio pro consumidor* `[P]` | En la duda, la interpretación más favorable al consumidor. | No aparece en la spec. `[I]` Debería informar el criterio de desempate cuando concurren dos regímenes de prescripción posibles. Defecto D-12. |

### 1.B — Análisis B: topes de intereses y capitalización

| Norma | Artículo | Qué exige | Cómo lo cumple la feature |
| --- | --- | --- | --- |
| Ley 25.065 | Art. 16 — límite del interés compensatorio o financiero `[V]` | Para emisores bancarios, el interés no puede superar en más del 25% la tasa que el emisor aplica a préstamos personales en moneda corriente para clientes. Para **emisores no bancarios**, no puede superar en más del 25% el promedio de tasas del sistema para préstamos personales publicado por el BCRA del día 1 al 5 de cada mes. | CA-10: hallazgo propio del régimen de tarjetas, distinto del general. **La spec no distingue emisor bancario de no bancario y son dos topes con base de cálculo diferente.** Defecto D-13. |
| Ley 25.065 | Art. 18 — interés punitorio `[V]` | **Texto vigente (sustituido por el art. 20 del DNU 70/2023):** los intereses punitorios no serán capitalizables. **Texto anterior `[P]`:** el punitorio no podía superar en más del 50% al efectivamente aplicado conforme al art. 16. | **Riesgo alto.** CA-09/CA-10 presuponen un tope de punitorios que, para hechos posteriores al DNU, puede ya no existir. Condición C-05. Ver §4.4. |
| Ley 25.065 | Art. 19 — improcedencia de punitorios `[V]` | No procede aplicar punitorios si se hicieron los pagos mínimos del resumen en fecha. | **No cubierto por ninguna CA.** Es un hallazgo de alto valor y fácil de detectar. Defecto D-14. |
| CCyC | Art. 770 — anatocismo `[P]` | Prohibición de capitalizar intereses, con excepciones taxativas; una de ellas admite la cláusula que prevea la acumulación al capital con una periodicidad mínima determinada. | CA-11: hallazgo de capitalización indebida cuando la frecuencia supera la permitida. El valor de esa frecuencia es parámetro (§5), no constante. |
| CCyC | Art. 771 — facultades judiciales sobre intereses `[P]` | Los jueces pueden reducir los intereses cuando la tasa o el resultado exceden, sin justificación, el costo medio del dinero. | **Esta es la única base general para el análisis B fuera de tarjetas, y es un control judicial, no un tope legal automático.** Obliga a cambiar el lenguaje del hallazgo. Condición C-04, §4.5. |
| CCyC | Arts. 279, 10, 1004, 1119, 988 — objeto ilícito, abuso del derecho, cláusulas abusivas `[P]` | Permiten atacar la tasa desmedida como abusiva. | No citado en la spec. Es el fundamento que sostiene el hallazgo en el régimen general. Debe integrarse al catálogo de citas (CA-27). |
| Ley 24.240 | Art. 36 — operaciones de crédito para consumo `[P]` | Exige informar TNA, TEA, costo financiero total, cantidad y periodicidad de cuotas; su incumplimiento habilita planteos de nulidad. Fija además la competencia del domicilio real del consumidor. | No hay CA que lo cubra. Es un hallazgo distinto de los cinco análisis (defecto de información, no exceso de tasa) y de mucho valor negociador. Defecto D-15. |
| Ley 24.240 | Art. 37 — cláusulas abusivas `[P]` | Se tienen por no convenidas. | Fundamento del hallazgo de capitalización pactada. Debe integrarse a las citas. |
| Normativa BCRA | Texto ordenado sobre tasas de interés en las operaciones de crédito `[D]` | Fija reglas sobre punitorios y su relación con el compensatorio para entidades financieras. **No se pudo identificar la comunicación vigente ni su número.** | Parámetro `intereses.relacionMaxPunitorioSobreCompensatorio.general` queda en `[D]`. |

### 1.C — Análisis C: plazos de archivo de información crediticia

| Norma | Artículo | Qué exige | Cómo lo cumple la feature |
| --- | --- | --- | --- |
| Ley 25.326 | Art. 26 inc. 4 `[V]` | Los datos relativos a la solvencia económica y financiera sólo pueden archivarse, registrarse o cederse **durante los últimos cinco años**. Ese plazo **se reduce a dos años** cuando el deudor cancela o de otro modo extingue la obligación, debiendo hacerse constar dicho hecho. | CA-14 (plazo general) y CA-15 (plazo abreviado desde la extinción). Estructura correcta. Los valores van como parámetros (§5). |
| Ley 25.326 | Art. 26 incs. 1 a 3 y 5 `[P]` | Condiciones bajo las cuales se pueden tratar datos de solvencia, origen de los datos y deber de informar al titular. | No aparece en la spec. `[I]` Relevante para el hallazgo: un dato puede ser ilegítimo por su origen, no sólo por su antigüedad. |
| Ley 25.326 | Art. 16 `[P]` | Rectificación, actualización o supresión: el responsable debe proceder en un plazo breve (el proyecto asume 5 días hábiles, `docs/03`). | El motor produce el fundamento del reclamo (CA-14). El cómputo del plazo de respuesta pertenece a las features 014/015, no a ésta. |
| Ley 25.326 | Art. 14 `[P]` | Derecho de acceso, gratuito con periodicidad semestral; respuesta en 10 días corridos. | Fuera de alcance del motor; se documenta para que 007 lo contemple. |
| Ley 25.326 | Arts. 33 y ss. `[P]` | Acción de habeas data. | El hallazgo CADUCADO es el insumo del documento de habeas data (specs 014/015). |
| Régimen BCRA — Central de Deudores del Sistema Financiero | Comunicación y texto ordenado aplicables `[D]` | **Es un registro distinto de los bureaus privados y tiene su propio régimen de permanencia.** No se pudo identificar la norma vigente ni el plazo. | **La spec trata el análisis C como un único plazo sobre un único registro.** Eso es un defecto: un dato puede haber caducado en el bureau privado y seguir legítimamente en la Central de Deudores, o al revés. Defecto D-16, condición C-06. |
| Jurisprudencia CSJN sobre el cómputo del plazo del art. 26 | Fallos sobre el *dies a quo* del plazo de archivo `[D]` | Existe doctrina de la Corte sobre desde cuándo se cuentan los cinco años (fecha de mora, fecha de la última información adversa, u otra). **No se pudo verificar cuál es la regla vigente.** | **Este es el parámetro más peligroso del análisis C** (§4.6). Sin él, el motor puede afirmar que un dato caducó cuando no caducó. Queda en `[D]`. |

### 1.D — Análisis D: embargabilidad de haberes

| Norma | Artículo | Qué exige | Cómo lo cumple la feature |
| --- | --- | --- | --- |
| Decreto 484/87 | Art. 1 `[C]` (texto corroborado el 2026-09-20 por buscador; **fuente oficial no leída**) | Las remuneraciones de cada período mensual **y cada cuota del aguinaldo** son inembargables hasta el importe mensual del SMVM. Por encima, los incisos 1 y 2 fijan 10% y 20% **"del importe que excediere de este último"** — misma fórmula en ambos. | CA-18 (cero bajo el mínimo), CA-19 (primer tramo sobre el excedente), CA-20 (tramo superior sobre el excedente). **La spec acierta en lo que más se equivoca en la práctica: el porcentaje se aplica sobre el excedente, no sobre el total.** `[!]` **Pero la base del excedente del inciso 2 quedó en disputa tras la verificación: la ambigüedad está en la norma, no en nuestro acceso a ella.** Ver §5.D y §8.3. |
| Decreto 484/87 | Excepción por cuota alimentaria y litisexpensas `[P]` | `[I]` Los topes no rigen del mismo modo frente a embargos por alimentos, que fija el juez. | **No hay ninguna CA que lo contemple.** Si el motor dice "el embargo excede el tope" frente a un embargo alimentario, el hallazgo es falso y potencialmente dañoso. Defecto D-17. |
| LCT | Art. 120 — inembargabilidad del SMVM `[P]` | El SMVM es inembargable salvo por deudas alimentarias. | Base del CA-18. |
| LCT | Art. 147 — cuota de embargabilidad `[P]` | Remuneraciones embargables sólo en la proporción que fije la reglamentación (el Decreto 484/87). | Cita obligatoria junto al decreto (CA-27). |
| LCT | Art. 133 — límite a deducciones `[P]` | Determina qué es la remuneración neta sobre la que se calcula. | `[I]` La spec no define la base de cálculo. `embargo.baseDeCalculo` queda como parámetro y en `[D]` en cuanto a su definición precisa. |
| LCT | Art. 149 — inembargabilidad de indemnizaciones `[P]` | `[I]` Régimen propio para indemnizaciones por despido y accidente. | No cubierto. Defecto D-18. |
| Ley 24.241 | Régimen de inembargabilidad de prestaciones previsionales `[D]` | `[I]` Las jubilaciones y pensiones tienen su propio régimen, distinto del salarial. | **Parte de la audiencia del producto cobra haberes previsionales, no salario.** Aplicar el Decreto 484/87 a un jubilado sería un error de encuadre. Defecto D-19. |
| Normativa BCRA sobre cuenta sueldo | Comunicación aplicable `[D]` | Intangibilidad de los fondos acreditados en cuenta sueldo y prohibición de compensación o débito por parte del banco. **No se pudo identificar la comunicación vigente ni su número.** | CA-22 devuelve un hallazgo de intangibilidad. El fundamento normativo concreto queda en `[D]`; sin él, CA-27 (cita con artículo) no puede cumplirse. |
| Resoluciones del Consejo Nacional del Empleo, la Productividad y el SMVM | Valor del SMVM y su vigencia `[D]` | El SMVM cambia varias veces al año por resolución. | Serie histórica con vigencia desde/hasta (CA-29). El caso límite de la spec §7 ("SMVM sin valor cargado → INDETERMINABLE, nunca el último valor conocido en silencio") es correcto y debe testearse. |

### 1.E — Análisis E: honorarios y cuota litis

| Norma | Artículo | Qué exige | Cómo lo cumple la feature |
| --- | --- | --- | --- |
| Ley 27.423 | Pacto de cuota litis — **art. 6** `[C]` (numeración resuelta en la ronda del 2026-09-20) | El pacto no puede exceder el **30%** del resultado del pleito, cualquiera sea el número de pactos y de profesionales intervinientes `[V]`; puede llegar al **40%** sólo si el profesional asume expresamente las costas de la defensa del cliente `[V]`; se exige **forma escrita, con tantos ejemplares como partes** `[C]`. En asuntos **previsionales, alimentarios y con menores** con representación legal: `[!]` **este documento decía "hasta el 20%"; la verificación indica que el inc. c) podría ser una PROHIBICIÓN de pactar cuota litis, con nulidad absoluta.** | CA-23 (límite conjunto) y CA-24 (límite diferenciado). Los porcentajes van como parámetros. **CA-24 no puede implementarse hasta resolver si en materias protegidas hay tope o prohibición** (§5.E, §8.2.5). La spec además **no modela el requisito de forma escrita**, y un pacto sin él es atacable. |
| Ley 27.423 | Nulidad de la renuncia anticipada de honorarios `[V]` | Es nula toda renuncia anticipada de honorarios o convenio que tienda a reducir las proporciones arancelarias, salvo con parientes cercanos del profesional. | `[I]` **Relevante para el modelo de negocio**: un convenio con la plataforma que obligue al abogado a resignar honorarios podría caer bajo esta nulidad. No es del motor, pero hay que mirarlo en la feature 018. |
| LCT | Art. 277 — pacto de cuota litis en materia laboral `[P]` | `[I]` Tope diferenciado del 20% en asuntos laborales. **Hay que verificar si el texto ordenado vigente lo mantiene y si fue alcanzado por el DNU 70/2023 o por la Ley 27.742.** | CA-24. El valor queda propuesto pero marcado como pendiente de verificación documental. |
| Leyes arancelarias provinciales | Según jurisdicción `[D]` | Cada provincia tiene su propia ley arancelaria y su propio régimen de cuota litis. | CA-25 y CA-26. **CA-26 es correcto y hay que defenderlo**: sin parámetros cargados, INDETERMINABLE, y **no** aplicar el límite nacional por defecto. |
| Códigos de ética de los colegios de abogados | Prohibición de partición de honorarios con quien no es abogado `[P]` | Un no abogado no puede participar de los honorarios profesionales. | **CA-23 suma la comisión de la plataforma al pacto de cuota litis bajo un mismo límite.** Esa suma presupone que ambos conceptos son de la misma naturaleza, lo que roza la constitución #10. Defecto D-20, condición C-09, §4.8. |

---

## 2. Datos personales (Ley 25.326)

El motor, según el §8 de la spec, es una **librería pura sin persistencia**. Eso
reduce mucho la superficie, pero no la elimina: la librería **recibe** datos
patrimoniales identificables y **produce** hallazgos que son a su vez datos
patrimoniales.

### 2.1 Inventario dato por dato

| Dato | Finalidad en el motor | Base legal `[P]` | Cuánto se guarda | Quién accede |
| --- | --- | --- | --- | --- |
| Fecha de exigibilidad, tipo de obligación, moneda | Análisis A | Ejecución del contrato de servicio (art. 5 inc. 2) + consentimiento informado para la finalidad "diagnóstico de deuda" | El motor no persiste. Retención definida por la feature 007. | Cliente, abogado, operador, auditoría |
| Hechos interruptivos y suspensivos (reconocimiento, pago parcial, demanda notificada, mediación) | Análisis A | Ídem | Ídem | Ídem |
| Composición del saldo (capital, compensatorios, punitorios, gastos) y tasas | Análisis B | Ídem | Ídem | Ídem |
| Fecha de informe del incumplimiento y fecha de extinción de la obligación | Análisis C | Ídem. **Dato de solvencia bajo el art. 26** | Ídem | Ídem |
| Remuneración neta mensual | Análisis D | Ídem. **Dato patrimonial sensible en la práctica**: revela empleo e ingreso | Ídem | Ídem |
| Identificación de la cuenta como cuenta sueldo | Análisis D | Ídem | Ídem | Ídem |
| Jurisdicción, materia y resultado económico esperado | Análisis E | Ídem | Ídem | Ídem |
| Matrícula y jurisdicción del abogado que confirma un hallazgo (R-08) | Responsabilidad profesional identificable | Ejecución del contrato con el abogado | Persistente por el plazo de prescripción de la responsabilidad profesional `[D]` | Auditoría, administrador |

### 2.2 Minimización — hallazgo concreto

`[I]` **Ninguno de los cinco análisis necesita el nombre, el DNI, el CUIL ni el
domicilio del deudor para producir su resultado.** El motor puede operar
íntegramente sobre un identificador opaco de deuda y de persona.

Si el contrato de entrada del motor admite datos identificatorios, la
minimización del art. 4 de la Ley 25.326 `[P]` se debilita sin ninguna
contrapartida funcional. **Condición C-10.**

### 2.3 Lo que esta feature no resuelve y hay que resolver en 007

- Consentimiento versionado por finalidad antes de cualquier consulta a bureau
  (constitución #5). El motor no consulta bureaus; 007 sí.
- Bitácora inmutable de accesos a los hallazgos. Un hallazgo de embargabilidad
  contiene la remuneración de la persona.
- Cifrado en reposo de los hallazgos persistidos.
- Retención y supresión de los hallazgos cuando el cliente se da de baja o
  revoca el consentimiento.

`[I]` Estos cuatro puntos deben quedar registrados como dependencias explícitas
de la spec 007. No bloquean el G1 de la 004 porque están correctamente fuera de
alcance, pero sí bloquean el G1 de la 007.

---

## 3. Deber de información al consumidor (Ley 24.240)

El art. 4 de la Ley 24.240 `[P]` obliga a informar de forma cierta, clara y
detallada. El art. 8 bis `[P]` exige trato digno. La constitución #6 prohíbe
prometer resultados y la #13 exige lenguaje llano. Los textos que siguen intentan
satisfacer las cuatro cosas a la vez.

**Regla de forma (constitución #13):** las advertencias van **junto al hallazgo**,
en el mismo bloque visual, con el mismo tamaño de cuerpo que el hallazgo. No en
una nota al pie, no en un modal que se cierra, no en los términos y condiciones.
Un aviso que el cliente no lee no cumple el deber de información.

**Condición C-07: estos textos se incorporan como criterios de aceptación de la
spec y se cubren con test, por constitución #14.** El texto exacto es propuesta
del revisor y debe ser reescrito o ratificado por el abogado y pasado por
`ux-expert` para revisión de legibilidad; lo que no es negociable es que exista un
texto obligatorio por tipo de hallazgo y que esté cubierto por test.

### 3.0 Encabezado global del diagnóstico (siempre, arriba de todo)

> **Esto es una estimación, no un dictamen legal.**
> Lo que sigue lo calculó un sistema automático con los datos que cargaste. Sirve
> para saber qué revisar y qué preguntar. **No reemplaza el consejo de un abogado
> ni de un contador.** Antes de pagar, de firmar o de dejar de pagar algo,
> hablá con un profesional. Si un dato que cargaste está mal, el resultado va a
> estar mal.

### 3.1 Hallazgo del análisis A — prescripción

Texto obligatorio, en el mismo bloque que el hallazgo:

> **Esta deuda podría estar prescripta. Eso no quiere decir que se borró.**
>
> Que una deuda esté prescripta significa que pasó tanto tiempo que **podés
> defenderte** si te la reclaman. Tres cosas que importan mucho:
>
> 1. **La prescripción no funciona sola.** Nadie la aplica de oficio: hay que
>    **plantearla como defensa**, y hay un momento del juicio para hacerlo. Si
>    pasa ese momento, se pierde.
> 2. **Si reconocés la deuda o pagás aunque sea una parte, el reloj vuelve a
>    cero.** Un pago chico "para sacárselos de encima", firmar un plan o aceptar
>    un acuerdo puede hacerte perder la defensa.
> 3. **No dejes de pagar por tu cuenta basándote en esto.** Esta estimación se
>    hizo con los datos que tenemos. Si el acreedor tiene registrado un pago o un
>    reclamo que nosotros no tenemos, el cálculo cambia.
>
> **Qué hacer ahora:** no firmes ni pagues nada de esta deuda y esperá a que un
> abogado la revise. Te avisamos cuando esté revisada.

`[I]` Los puntos 2 y 3 no son decorativos: son la mitigación del riesgo del §4.1.
Si la decisión 004-B termina siendo la opción A, estos textos son lo único que se
interpone entre el hallazgo y el daño.

### 3.2 Hallazgo del análisis B — intereses y capitalización

Régimen general (sin tope legal automático):

> **Los intereses que te están cobrando parecen altos.**
> En la mayoría de los créditos **no hay un tope fijo por ley**: lo que hay es la
> posibilidad de pedirle a un juez que los reduzca si son desproporcionados. Lo
> que calculamos es **cuánto se apartan de una referencia razonable**, para que
> tengas con qué discutir. No es un monto que el acreedor esté obligado a
> devolverte: es un argumento para negociar o para reclamar.

Régimen de tarjetas de crédito (con tope legal):

> **La tasa que te cobraron podría superar el máximo que fija la ley de tarjetas
> de crédito.** Calculamos la diferencia con los datos del resumen que cargaste.
> El número es estimado: depende de la tasa de referencia del período y de cómo
> el emisor liquidó el saldo. **Un abogado tiene que confirmarlo antes de
> reclamarlo.**

Capitalización:

> **Puede que te estén cobrando intereses sobre intereses.**
> La ley limita cuándo y cada cuánto se puede hacer eso. Detectamos que en tu
> resumen podría estar pasando con más frecuencia de la permitida. El efecto
> estimado es de {monto}. **Es una estimación sobre lo que informó el acreedor;
> si la composición del saldo está incompleta, el número cambia.**

### 3.3 Hallazgo del análisis C — información crediticia

> **Este dato podría tener que salir de los informes de crédito.**
> La ley pone un plazo máximo para que una deuda impaga figure en los informes
> comerciales. Según nuestra cuenta, ese plazo ya se cumplió el {fecha}.
>
> Dos aclaraciones importantes:
> - **Que el dato salga del informe no borra la deuda.** El acreedor te la puede
>   seguir reclamando. Son dos cosas distintas.
> - **No sale solo.** Hay que reclamarlo, y el que tiene que sacarlo es quien
>   informa el dato.
>
> Además, podés aparecer en **más de un registro** (el de tu banco, el del Banco
> Central y los informes comerciales privados), y **cada uno tiene sus propias
> reglas**. Que hayas salido de uno no significa que hayas salido de todos.

### 3.4 Hallazgo del análisis D — embargabilidad

> **El embargo sobre tu sueldo podría estar por encima del máximo legal.**
> La ley protege una parte de tu sueldo: hasta cierto monto no se puede embargar
> nada, y por encima de eso sólo se puede embargar un porcentaje **de lo que
> sobra**, no del total. Con los datos que cargaste, el máximo embargable sería
> {monto} y te están descontando {monto}.
>
> **Esto no se corrige solo: hay que pedirlo en el expediente.** Un abogado tiene
> que presentar el pedido de readecuación.
>
> **Ojo:** si el embargo es por una cuota de alimentos, las reglas son otras y
> este cálculo no se aplica.

Cuenta sueldo:

> **Tu cuenta sueldo tiene una protección especial.** El banco no puede
> descontarte de ahí para cobrarse una deuda que le tenés. Si te pasó, se puede
> reclamar. **Esto no impide todos los embargos judiciales**, sólo que el banco
> se cobre por su cuenta.

### 3.5 Hallazgo del análisis E — honorarios y comisión

> **Lo que se te puede cobrar por este caso tiene un máximo.**
> Sumando el honorario del abogado y nuestra comisión, no se puede pasar de
> {porcentaje} de lo que se obtenga. Si la propuesta que tenés supera ese máximo,
> no la firmes. Te mostramos cuál es el máximo para cada parte.

`[I]` Si la decisión sobre C-09 concluye que el límite **no** es conjunto, este
texto hay que reescribirlo por completo.

### 3.6 Resultado INDETERMINABLE

> **No podemos analizar esto todavía.** Nos falta: {dato faltante}.
> Preferimos decírtelo antes que darte un número inventado. {Acción para
> conseguir el dato}.

### 3.7 Marca de parámetro sin ratificación profesional (CA-28)

> **Este cálculo usa un valor legal que nuestro equipo jurídico todavía no
> terminó de confirmar.** Tomalo como orientativo.

`[I]` Si al salir a producción se cumple la métrica de la spec ("parámetros
normativos sin ratificación profesional al salir a producción: 0"), este texto no
debería verse nunca en la app del cliente. Debe existir igual: es la red de
seguridad de CA-28.

### 3.8 Prohibiciones de copy, derivadas de la constitución #6 y de la Ley 22.802 `[P]`

Ninguna salida del motor, ni ningún texto que la envuelva, puede contener:
"tu deuda está prescripta", "no tenés que pagar", "te sacamos del Veraz",
"recuperás {monto}", "ganás {monto}", "esta deuda ya no existe", "eliminamos",
"garantizamos", "seguro que". **Verificable por test sobre la lista de términos
prohibidos.**

---

## 4. Riesgos legales

| # | Riesgo | Prob. | Impacto | Mitigación en la feature |
| --- | --- | --- | --- | --- |
| RL-01 | El cliente lee "presuntamente prescripta", deja de pagar o reconoce la deuda por su cuenta, y termina peor. | Alta | **Crítico** | Decisión 004-B por opción B (§4.1 y §7.1) + textos §3.1 + regla de no-confusión C-12. |
| RL-02 | El sistema ejerce de hecho la abogacía sin matrícula: dictamina, recomienda estrategia procesal y el cliente actúa en consecuencia. | Media | **Crítico** | Salvaguardas del §4.2, todas verificables por test. Condición C-08. |
| RL-03 | Un parámetro sin ratificar se usa en un cálculo que llega al cliente o a una presentación judicial. | Media | **Crítico** | CA-28 + decisión 004-A opción A + gate por entorno con test. Condición C-02. |
| RL-04 | El tope de punitorios de tarjetas se apoya en un texto sustituido por el DNU 70/2023, cuya validez está controvertida. El motor emite un hallazgo sin sustento vigente. | Alta | Alto | Parámetro con doble vigencia y `[D]` para el período posterior. Condición C-05. §4.4. |
| RL-05 | El *dies a quo* del plazo de archivo crediticio está mal fijado y el motor declara CADUCADO un dato que no caducó. Se reclama una supresión improcedente. | Alta | Alto | `archivoCrediticio.diesAQuo` en `[D]`; sin ratificación, el análisis C no emite CADUCADO. Condición C-06. §4.6. |
| RL-06 | Se confunde el registro del BCRA con los bureaus privados y se reclama al destinatario equivocado o con el plazo equivocado. | Media | Medio | Parámetros separados por registro. Condición C-06. Texto §3.3. |
| RL-07 | El "impacto económico estimado" de los hallazgos opera de hecho como promesa de resultado. | Media | Alto | Rotulado obligatorio como estimación (§3), lista de términos prohibidos (§3.8), y **prohibición de agregar los impactos en un número único tipo "recuperá $X"**. Condición C-07. |
| RL-08 | CA-23 trata la comisión de la plataforma como componente del tope de cuota litis, lo que sugiere que participa de honorarios profesionales. | Media | Alto | Decisión humana previa a G2. Condición C-09. §4.8. |
| RL-09 | Conflicto de interés estructural: la comisión de éxito se calcula sobre el resultado económico, y el motor es quien estima ese resultado. Hay incentivo a inflar el hallazgo. | Media | Alto | R-03 de la spec cubre el caso inverso (hallazgo que reduce la comisión). Falta el directo: el impacto estimado que alimenta la comisión debe ser el **confirmado por el abogado**, nunca el estimado por el motor. Condición C-11. §4.7. |
| RL-10 | El hallazgo de embargabilidad se usa como guía para eludir un embargo judicial legítimo (mover el sueldo de cuenta, por ejemplo). | Baja | Alto | El hallazgo debe formularse siempre como "pedir la readecuación ante el juez", nunca como acción del deudor sobre sus fondos. Texto §3.4. |
| RL-11 | Se aplica el Decreto 484/87 a un haber previsional, que tiene régimen propio. | Media | Alto | Tipo de ingreso como entrada obligatoria; INDETERMINABLE si es previsional y no hay parámetros. Defecto D-19. |
| RL-12 | Un embargo alimentario se reporta como "exceso del tope". | Media | Alto | Causa del embargo como entrada obligatoria. Defecto D-17. |
| RL-13 | El SMVM o la tasa de referencia quedan desactualizados y todos los cálculos de la cartera salen mal. | Media | Alto | Decisión 004-C opción B. El caso límite de la spec §7 (nunca el último valor conocido en silencio) es la mitigación correcta. |
| RL-14 | Se aplica el límite de cuota litis nacional a una jurisdicción provincial con ley propia. | Media | Medio | CA-26 + decisión 004-D opción A. Bien resuelto en la spec. |
| RL-15 | El marco normativo cambia (reforma de la Ley 25.326, suerte del DNU 70/2023, leyes arancelarias provinciales) y los parámetros quedan viejos. | Alta | Medio | R-02 + CA-29 + CA-30. La arquitectura de parámetros es la mitigación. Falta un **proceso** de revisión periódica: condición C-03 incluye fecha de próxima revisión. |
| RL-16 | Datos patrimoniales identificables entran al motor sin necesidad funcional. | Baja | Medio | Condición C-10. §2.2. |

### 4.1 El riesgo del análisis de prescripción (punto c del encargo)

Este es el riesgo central de la spec y merece tratamiento aparte.

**Por qué es distinto de los otros cuatro análisis.** Los hallazgos de intereses,
archivo crediticio, embargabilidad y honorarios producen, en el peor de los casos,
un reclamo que no prospera. El hallazgo de prescripción puede producir algo peor:
**una conducta del propio cliente que destruye la defensa que el hallazgo le
anunciaba**. El sistema no sólo se equivocaría; habría causado el daño.

**La mecánica del daño, paso a paso.**

1. El motor informa "presuntamente prescripta".
2. El cliente entiende, razonablemente, "no tengo que pagar".
3. Deja de pagar y se lo comunica al acreedor, o el acreedor lo llama.
4. En la conversación, el cliente dice algo como "sí, la debo, pero ya prescribió",
   o acepta pagar una parte para cortar los llamados.
5. Ese reconocimiento o ese pago parcial **interrumpe la prescripción** `[P]` (CCyC
   art. 2545 `[P]`) y hace correr un plazo nuevo e íntegro (art. 2544 `[P]`).
6. El cliente perdió la defensa **por haber sido informado**.

Hay una segunda vía, independiente de la anterior: la prescripción **no opera de
oficio** (CCyC art. 2552 `[P]`) y debe oponerse **en una oportunidad procesal
determinada** (art. 2553 `[P]`). Un cliente que cree que la deuda "se borró" no se
presenta al juicio, no contesta la demanda, y la prescripción nunca se plantea. La
deuda prescripta termina en sentencia ejecutable.

**Por qué CA-08 no alcanza.** CA-08 exige la palabra "presuntamente", la
advertencia de que debe oponerse como defensa, y la marca de confirmación
profesional. Es necesario pero no suficiente, por tres razones:

- `[I]` **Asimetría de atención.** El cliente está bajo estrés financiero
  (constitución #13). Lee el titular, no la advertencia. Una advertencia
  perfectamente redactada no cambia esa asimetría.
- `[I]` **La advertencia no cubre el hecho interruptivo.** CA-08 obliga a decir
  que hay que oponerla como defensa. **No obliga a decir que un pago parcial o un
  reconocimiento la interrumpen.** Ése es el mecanismo concreto del daño y no está
  exigido por ninguna CA. Es un defecto de la spec (D-21) y el §3.1 lo repara.
- `[I]` **Sesgo de certeza del cálculo.** Una fecha exacta ("prescribió el
  14/03/2024") transmite mucha más certeza que el adverbio "presuntamente" que la
  acompaña. Es un problema de diseño de la información, no de redacción.

**Riesgo residual del lado de la empresa** `[I]`: si un cliente pierde una defensa
por haber seguido lo que le dijo la app, tiene un reclamo por daños plausible, con
el agravante del deber de información del art. 4 y del trato digno del art. 8 bis
de la Ley 24.240 `[P]`, y el agravante adicional de que la plataforma se presenta
como especialista.

**Conclusión.** El riesgo es real, alto y no se mitiga sólo con texto. Se mitiga
con **control de a quién se le muestra y cuándo**, que es exactamente lo que
plantea la decisión 004-B. El dictamen está en §7.1.

### 4.2 Riesgo de ejercicio profesional del derecho (punto d del encargo)

**Marco** `[I]`. El ejercicio de la abogacía está reservado a personas humanas
matriculadas ante el colegio de la jurisdicción correspondiente (Ley 23.187 para
la Capital Federal y las leyes de colegiación provinciales) `[P]`. **No se pudo
verificar el texto de esas normas durante esta revisión** (§8), y no existe en
Argentina, hasta donde llega este revisor, norma específica sobre sistemas
automatizados de análisis jurídico. Lo que sigue es **criterio del revisor**, no
derecho establecido, y necesita dictamen propio del estudio.

`[I]` La línea que propongo no es "el sistema no puede hablar de derecho". Es
**otra**: el sistema puede describir el estado del mundo y las normas; **no puede
sustituir el juicio profesional sobre un caso concreto ni dirigir la conducta
procesal de una persona determinada.**

| Lo que el motor **puede** hacer `[I]` | Lo que el motor **no puede** hacer `[I]` |
| --- | --- |
| Calcular fechas, plazos y montos a partir de datos y parámetros. | Concluir que una deuda "está prescripta" o que un embargo "es ilegal". |
| Citar la norma aplicable con su artículo. | Elegir la estrategia procesal del caso. |
| Señalar que hay una posible defensa y que existe un profesional que puede evaluarla. | Decirle al cliente que no pague, que no conteste, o que no se presente. |
| Explicar en general cómo funciona un instituto jurídico. | Decirle qué debe hacer **él**, en **su** caso, **ahora**. |
| Preparar el insumo técnico para que un abogado decida. | Firmar, presentar o dirigir una actuación. |
| Decir que no sabe (INDETERMINABLE). | Completar con supuestos para parecer útil. |

**Salvaguardas concretas que el motor debe tener.** Todas verificables por test, y
todas propuestas de este revisor sujetas a ratificación:

| # | Salvaguarda | Cómo se verifica |
| --- | --- | --- |
| S-01 | Ninguna salida del motor contiene una conclusión jurídica en modo asertivo. Los estados del enum son `PRESUNTAMENTE_PRESCRIPTA`, nunca `PRESCRIPTA`. | Test sobre el enum y sobre la lista de términos prohibidos (§3.8). **Nota: `docs/03-cumplimiento-legal-argentina.md` describe hoy un estado `PRESCRIPTA`. Es una inconsistencia con la spec. Defecto D-22.** |
| S-02 | Todo hallazgo lleva `requiereConfirmacionProfesional: true` hasta que un abogado matriculado lo confirme, y la marca se propaga a la interfaz (CA-28). | Test de propagación de la marca hasta el contrato de salida. |
| S-03 | La confirmación registra matrícula, jurisdicción, identidad y fecha del profesional (R-08). Un hallazgo no puede figurar como confirmado sin matrícula registrada. | Test: confirmación sin matrícula → rechazo. |
| S-04 | El motor **no emite recomendaciones de conducta dirigidas al cliente**. Emite hallazgos y, a lo sumo, "acciones sugeridas" dirigidas **al profesional**. La única acción que puede sugerirle al cliente es consultar al abogado y no innovar sobre la deuda. | Test sobre el catálogo cerrado de acciones y su destinatario. |
| S-05 | Catálogo cerrado de textos: el motor no genera lenguaje libre sobre el caso. Cada hallazgo referencia una plantilla identificada y versionada. | Test: toda salida corresponde a una plantilla del catálogo. |
| S-06 | Toda salida que llega al cliente lleva el encabezado del §3.0. | Test de presencia obligatoria. |
| S-07 | El abogado puede **rechazar o corregir** el hallazgo, y su decisión **prevalece** sobre la del motor en todo lo que se muestre después (R-08). | Test: hallazgo rechazado no se muestra como vigente al cliente. |
| S-08 | Trazabilidad completa: normas citadas con artículo, versión del conjunto de parámetros y fecha de evaluación (CA-27), con determinismo (CA-31). Sin esto no hay forma de que un profesional audite lo que el sistema dijo. | CA-27 y CA-31 ya lo exigen. |
| S-09 | El motor no evalúa jurisdicciones para las que no tiene parámetros cargados (CA-26). Silencio antes que error. | CA-26 ya lo exige; extender el criterio a los cinco análisis, no sólo al E. |
| S-10 | Ningún documento dirigido a un tercero (acreedor, bureau, juzgado) se genera ni se envía sin confirmación profesional previa registrada. | Corresponde a las specs 014/015; debe quedar como dependencia declarada. |

`[I]` **Observación de encuadre.** La opción B de la decisión 004-B no es sólo una
mitigación del riesgo de prescripción: es también **la principal salvaguarda
contra RL-02**, porque interpone a un profesional matriculado entre el análisis
automatizado y la conducta del cliente. Las dos decisiones están acopladas.

### 4.3 Conflicto entre el hallazgo de prescripción y el de archivo crediticio

`[I]` Son dos institutos distintos que el cliente va a confundir con certeza:

- Una deuda **prescripta** puede seguir figurando legítimamente en un informe si
  no venció el plazo de archivo.
- Un dato cuyo **plazo de archivo venció** corresponde a una deuda que puede estar
  perfectamente vigente y ser exigible.

Si el motor emite ambos hallazgos sobre la misma deuda sin una regla explícita de
no-confusión, el cliente concluye que "la deuda se borró". **Condición C-12.**

### 4.4 El problema del DNU 70/2023 (afecta al análisis B)

Verificado durante esta revisión `[V]`:

- El art. 20 del DNU 70/2023 sustituyó el art. 18 de la Ley 25.065, que ahora
  dispone únicamente que los intereses punitorios no serán capitalizables.
- El texto anterior del art. 18 contenía el tope del 50% sobre lo efectivamente
  aplicado conforme al art. 16 `[P]`.
- El DNU 70/2023 fue **rechazado por el Senado**; a la fecha de las fuentes
  consultadas **no fue tratado por la Cámara de Diputados**, por lo que **sigue
  vigente** (se requiere el rechazo de ambas cámaras para que caiga) `[V]`.
- Está judicializado, con partes suspendidas: la Cámara Nacional de Apelaciones
  del Trabajo declaró la invalidez constitucional de su Título IV `[V]`.

`[I]` Consecuencias para el motor:

1. Para hechos **anteriores** a la entrada en vigor del DNU, el tope del 50%
   `[P]` sería el aplicable. CA-29 (parámetro vigente a la fecha del hecho) es
   exactamente el mecanismo necesario. **La spec acertó acá.**
2. Para hechos **posteriores**, `[D]`: hay que determinar si subsiste algún tope
   de punitorios en tarjetas y con qué fundamento.
3. **El estado del DNU puede cambiar durante la vida del producto.** Si Diputados
   lo rechaza o la justicia invalida el art. 20, el tope revive, con efectos hacia
   el pasado que hay que determinar `[D]`.
4. `[I]` Emitir hoy un hallazgo de exceso de punitorios en tarjeta, para un hecho
   posterior al DNU, con fundamento en un artículo sustituido, es el error más
   caro que puede cometer el motor: destruye la credibilidad del caso completo.

**Condición C-05.**

> **Actualización de la ronda del 2026-09-20** (`specs/legal/verificacion-documental.md` §3.2).
>
> - Se obtuvo el **texto anterior** del art. 18 `[C]` y trae un dato que cambia el
>   modelo de parámetros: **la cláusula de no capitalización ya estaba ahí**. El
>   DNU suprimió el primer párrafo (el tope del 50%) y conservó el segundo. Por lo
>   tanto `intereses.punitorioNoCapitalizable.tarjeta` **no necesita doble
>   vigencia**; sólo la necesita el tope.
> - El **estado del DNU se confirma** `[C]`: rechazado por el Senado, **no tratado
>   por Diputados** y por eso vigente; la CSJN rechazó los planteos por ausencia de
>   caso concreto; hay capítulos suspendidos por tribunales inferiores, entre ellos
>   el Título IV laboral.
> - **Lo que sigue sin resolverse es la fecha de corte**, que es justamente lo que
>   el motor necesita para decidir deuda por deuda. La fecha del 29/12/2023 que
>   circula es una inferencia del art. 5 del CCyC, **no un texto**. Ver el
>   parámetro `intereses.fechaCorteDNU70_2023` en §5.B.
> - `[I]` **El estado del DNU es un dato vivo.** Todo esto vale al 2026-09-20 y
>   debe reconsultarse antes de cada puesta en producción.

### 4.5 El análisis B no tiene, en el régimen general, un tope legal automático

`[I]` La spec, en CA-09, habla de "exceso" respecto de un "tope configurado". Fuera
del régimen de tarjetas, **no se identificó una norma que fije un tope legal
general de intereses cuya superación sea automáticamente ilícita**. Lo que existe
es la facultad judicial de reducir intereses desproporcionados (CCyC art. 771
`[P]`) y el control de abusividad (arts. 279, 10, 1004 CCyC y art. 37 Ley 24.240
`[P]`).

La diferencia no es semántica. "Excede el tope legal" es una afirmación de
ilicitud; "se aparta de la referencia y podría ser reducido por un juez" es una
hipótesis de trabajo. La primera, puesta en una carta documento, es un error
técnico que el acreedor va a explotar. **Condición C-04.**

### 4.6 El *dies a quo* del plazo de archivo crediticio

`[V]` El art. 26 inc. 4 de la Ley 25.326 fija cinco años y dos años. `[D]` **No
dice, con la claridad que el motor necesita, desde qué fecha exacta se cuentan.**
Las alternativas que un cálculo automático tiene que distinguir son al menos:
la fecha de mora original, la fecha de la última información adversa registrada,
la fecha del último movimiento de la cuenta, o la fecha en que el dato se informó
por primera vez. Existe jurisprudencia de la Corte Suprema sobre este punto que
**no pudo verificarse durante esta revisión**.

`[I]` La diferencia entre dos de esas fechas puede ser de años. Es el parámetro
con mayor relación entre impacto y grado de incertidumbre de toda la tabla del §5.
Hasta que el estudio lo ratifique **por escrito y con la cita del fallo**, el
análisis C no debe emitir el estado CADUCADO. **Condición C-06.**

> **Actualización de la ronda del 2026-09-20** (`specs/legal/verificacion-documental.md` §3.4).
>
> El punto **no se resolvió, pero dejó de estar a ciegas**. Hay dos fuentes
> nominadas y **dicen cosas distintas**:
>
> 1. **Decreto 1558/2001, art. 26** `[C]` —reglamentario de la Ley 25.326, que este
>    documento no había identificado—: los cinco años *"se contarán a partir de la
>    fecha de la última información adversa archivada que revele que dicha deuda
>    era exigible"*.
> 2. **CSJN, "Catania, Américo Marcial c/ BCRA s/ habeas data", 08/11/2011**,
>    citado como **Fallos 334:1276** `[C]`: según las reseñas consultadas, el plazo
>    **no se posterga** mientras la deuda siga siendo exigible y no esté
>    prescripta. El texto de la sentencia no pudo leerse.
>
> `[I]` La tensión es sustantiva: el criterio del decreto permitiría al acreedor
> **estirar el plazo indefinidamente reinformando la deuda**, que es exactamente
> lo que el "derecho al olvido" quiso impedir. **La pregunta para el estudio ya no
> es si existe jurisprudencia, sino cuál criterio prevalece y cómo se traduce en
> una fecha calculable con los datos que el cliente puede aportar.**
>
> Dato adicional corroborado, no contemplado en la spec: para los **datos de
> cumplimiento sin mora no opera plazo alguno** de eliminación, y la reducción a
> dos años estaría condicionada a que **el deudor acredite** que la última
> información disponible coincide con la extinción — una carga probatoria que el
> motor debería anticipar en vez de sorprender al cliente con ella.
>
> **C-06 sigue vigente sin cambios.**

### 4.7 Conflicto de interés en el impacto económico estimado

`[I]` La constitución #1 prohíbe funciones donde el ingreso de la plataforma sube
mientras la posición del cliente empeora. Acá hay una variante más sutil: la
comisión de éxito se calcula sobre el resultado económico, y **el mismo motor que
estima ese resultado alimenta el cálculo de la comisión**.

La spec cubre bien el caso obvio (R-03: se informa el hallazgo aunque reduzca la
comisión). No cubre el inverso: **un hallazgo sobreestimado infla la base de
comisión**. La mitigación: la base de la comisión debe ser el **resultado
efectivamente obtenido y confirmado**, nunca el impacto estimado por el motor.
Pertenece a la spec 018, pero se origina acá. **Condición C-11.**

### 4.8 CA-23 y la constitución #10

`[I]` CA-23 dice: si la suma del pacto de cuota litis más la comisión de éxito de
la plataforma supera el límite aplicable, se rechaza la combinación.

Ese diseño es **protector del cliente** y desde la constitución #1 es correcto:
el cliente no puede quedar expuesto a que entre los dos se lleven más de lo que la
ley admite para uno solo. Pero tiene una lectura incómoda: si la comisión de la
plataforma se computa **dentro** del tope arancelario, se la está tratando como
parte del honorario profesional, y la constitución #10 y los códigos de ética
`[P]` van en la dirección contraria.

`[I]` Hay al menos tres encuadres posibles y **no es una decisión de un agente**:

- **A)** Límite conjunto, como dice CA-23. Máxima protección al cliente, riesgo
  deontológico de asimilar la comisión a honorario.
- **B)** Límites separados: el pacto de cuota litis contra su tope arancelario, y
  la comisión de la plataforma contra un tope propio de política de producto,
  fundado en la capacidad de pago y no en el arancel. Deontológicamente más
  limpio, protege menos al cliente.
- **C)** Límites separados **más** un tope agregado de política interna que no se
  presenta como límite legal sino como compromiso de la plataforma. Protege al
  cliente y no asimila conceptos.

`[I]` La preferencia del revisor es **C**, porque satisface la constitución #1 sin
tensionar la #10. Pero es una decisión humana y hay que tomarla **antes de G2**,
porque cambia el contrato del análisis E. **Condición C-09.**

---

## 5. Parámetros que requieren validación profesional

**Todas las filas de esta tabla salen con `requiereValidacionProfesional: true`.**
Las columnas "Validado por" y "Fecha" están vacías **en todas** y deben quedar
vacías hasta que una persona matriculada las complete.

**Cómo leer la columna "Valor propuesto":** un número acá **no es un dato, es una
hipótesis de trabajo para que el estudio la confirme o la corrija**. Donde dice
`A DETERMINAR POR EL ESTUDIO` es porque el revisor considera que arriesgar un
número sería peor que no darlo: un valor mal puesto se propaga a toda la cartera y
nadie lo vuelve a mirar.

Todos los parámetros llevan además `vigenciaDesde` / `vigenciaHasta` y la cita
normativa, conforme R-02 y CA-29.

> **Sobre los valores marcados `[C]` (ronda del 2026-09-20).** Se completaron a
> partir de transcripciones obtenidas por buscador, con la URL y la fecha de
> consulta. **Las columnas "Validado por" y "Fecha" siguen vacías en el 100% de las
> filas, y así deben quedar.** Corroborar un texto **no es** ratificarlo: la
> condición **C-03 sigue íntegramente incumplida** y ningún valor `[C]` habilita una
> evaluación en producción. Trazabilidad completa en
> `specs/legal/verificacion-documental.md`.

### 5.A — Prescripción liberatoria

| Parámetro | Qué representa | Norma que lo funda | Valor propuesto | Validado por | Fecha |
| --- | --- | --- | --- | --- | --- |
| `prescripcion.plazoGenerico` | Plazo de prescripción aplicable cuando ninguna norma especial fija otro. | CCyC art. 2560 `[C]` | **5 años** `[C]` — texto corroborado 2026-09-20: *"El plazo de la prescripción es de cinco años, excepto que esté previsto uno diferente en la legislación local."* `[I]` La salvedad final ("legislación local") **no estaba contemplada en la spec** y es relevante para la decisión 004-D. | | |
| `prescripcion.plazoPeriodico` | Plazo para el reclamo de lo que se devenga por años o plazos periódicos más cortos. | CCyC art. 2562 inc. c `[C]` | **2 años** `[C]` — corroborado 2026-09-20 el inc. c: *"el reclamo de todo lo que se devenga por años o plazos periódicos más cortos"*. **Sigue `[D]` si aplica a las cuotas de un préstamo personal**: ninguna fuente consultada resolvió si el reintegro de un capital fraccionado en cuotas queda dentro o fuera. Esta distinción decide el resultado en la mayoría de los préstamos personales de la cartera. | | |
| `prescripcion.plazoTarjetaEjecutiva` | Plazo de la acción ejecutiva emergente de la relación emisor–titular. | Ley 25.065 art. 47 inc. a `[C]` | **1 año** `[C]` — corroborado 2026-09-20: *"Las acciones de esta ley prescriben: a) Al año, la acción ejecutiva."* `[D]` **Desde cuándo corre: sin determinar.** | | |
| `prescripcion.plazoTarjetaOrdinaria` | Plazo de las acciones ordinarias de la ley de tarjetas. | Ley 25.065 art. 47 inc. b `[C]` | **3 años** `[C]` — corroborado 2026-09-20: *"b) A los tres (3) años, las acciones ordinarias."* `[D]` **Desde cuándo corre: sin determinar.** | | |
| `prescripcion.plazoAccionCambiaria` | Plazo de la acción cambiaria directa (pagaré, letra), muy frecuente en cobranzas. | Dto. Ley 5965/63 `[P]` | `A DETERMINAR POR EL ESTUDIO` | | |
| `prescripcion.plazoSaldoCuentaCorriente` | Plazo del saldo deudor de cuenta corriente bancaria. | `[D]` | `A DETERMINAR POR EL ESTUDIO` | | |
| `prescripcion.plazoRelacionConsumo` | Si existe un plazo propio para la relación de consumo que desplace al general. | Ley 24.240 y su articulación con el CCyC `[P]` | `A DETERMINAR POR EL ESTUDIO` — punto **doctrinariamente discutido**; el motor necesita una regla de desempate escrita, no un criterio implícito | | |
| `prescripcion.reglaDiesAQuo` | Desde qué hecho exacto empieza a correr el plazo: exigibilidad de cada cuota, caducidad de plazos, mora automática, o interpelación. | CCyC art. 2554 `[P]` | `A DETERMINAR POR EL ESTUDIO` — **crítico**: en una deuda con caducidad de plazos anticipada la fecha cambia por años | | |
| `prescripcion.reglaTransicionCCyC` | Cómo se computan las obligaciones nacidas bajo el Código Civil derogado, con plazos distintos. | CCyC art. 2537; Ley 26.994 `[P]` | `A DETERMINAR POR EL ESTUDIO` — afecta a toda deuda anterior a agosto de 2015, que es buena parte de las "deudas viejas" del producto | | |
| `prescripcion.hechosInterruptivos` | Catálogo cerrado de hechos que reinician el cómputo. | CCyC arts. 2544 a 2548 `[P]` | **Reconocimiento expreso o tácito del deudor** (incluido el pago parcial) `[P]`; **petición judicial notificada** `[P]`; **solicitud de arbitraje** `[P]`. **Efecto: nuevo plazo íntegro desde el hecho** `[P]`. La spec (CA-04) además menciona "demanda judicial notificada", coherente. | | |
| `prescripcion.hechosSuspensivos` | Catálogo cerrado de hechos que detienen el cómputo sin borrar lo corrido. | CCyC arts. 2539 a 2543; art. 2541 `[C]`; art. 2542 `[C]` | **Interpelación fehaciente** (art. 2541) `[C]`, texto corroborado 2026-09-20: *"El curso de la prescripción se suspende, **por una sola vez**, por la interpelación fehaciente hecha por el titular del derecho contra el deudor o el poseedor. Esta suspensión sólo tiene efecto durante **seis meses o el plazo menor que corresponda a la prescripción de la acción**."* `[I]` **Dos reglas, no una**: el límite de una sola vez (defecto D-11) **y** el tope alternativo "el plazo menor que corresponda", que la spec no contempla y el motor tiene que calcular. **Pedido de mediación** (art. 2542) `[C]`: suspende *"desde la expedición por medio fehaciente de la comunicación de la fecha de la audiencia de mediación o desde su celebración, lo que ocurra primero"*; **la reanudación y su cómputo siguen `[D]`**. Casos especiales del art. 2543 `[D]`. | | |
| `prescripcion.duracionEfectoPeticionJudicial` | Cuánto dura el efecto interruptivo de la petición judicial. | CCyC art. 2547 `[P]` | `A DETERMINAR POR EL ESTUDIO` — depende de desistimiento, caducidad de instancia y sentencia | | |
| `prescripcion.oportunidadProcesalOposicion` | Hasta cuándo puede oponerse la defensa en el proceso. | CCyC art. 2553 `[P]` y códigos procesales locales | `A DETERMINAR POR EL ESTUDIO` — **varía por jurisdicción y por tipo de proceso** | | |
| `prescripcion.umbralAlertaDias` | Antelación con que se avisa PROXIMA_A_PRESCRIBIR (CA-03). | Parámetro de producto, no normativo `[I]` | **180 días** `[I]` — propuesta del revisor; requiere criterio profesional sobre si 6 meses alcanzan para articular la defensa | | |

### 5.B — Intereses y capitalización

| Parámetro | Qué representa | Norma que lo funda | Valor propuesto | Validado por | Fecha |
| --- | --- | --- | --- | --- | --- |
| `intereses.relacionMaxPunitorioSobreCompensatorio.general` | Relación máxima admitida entre la tasa punitoria y la compensatoria, fuera del régimen de tarjetas. | **No se identificó tope legal general.** Control judicial: CCyC art. 771 `[C]` — texto corroborado 2026-09-20: *"Los jueces **pueden reducir** los intereses cuando la tasa fijada o el resultado que provoque la capitalización de intereses excede, **sin justificación y desproporcionadamente**, el costo medio del dinero para deudores y operaciones similares en el lugar donde se contrajo la obligación. Los intereses pagados en exceso se imputan al capital y, una vez extinguido éste, pueden ser repetidos."* `[I]` **Confirma la condición C-04**: es una facultad judicial de reducción, no un tope automático. Normativa BCRA para entidades financieras `[D]`. | `A DETERMINAR POR EL ESTUDIO`. `[I]` El revisor **se niega a proponer un número**: el 50% del régimen de tarjetas es tentador por analogía, pero **una analogía no es un tope legal** y cargarla equivaldría a inventar una norma. Si el estudio decide usar un umbral, debe quedar rotulado como **umbral de alerta interno**, no como tope legal. | | |
| `intereses.topeCompensatorio.tarjeta.emisorBancario` | Tope del interés compensatorio o financiero cuando el emisor es una entidad bancaria. | Ley 25.065 art. 16, 1er párrafo `[V]` | **25% por encima de la tasa que el propio emisor aplica a préstamos personales en moneda corriente para clientes** `[V]`. `[I]` **Obliga a obtener la tasa del emisor**, dato que el motor probablemente no tenga: prever INDETERMINABLE. | | |
| `intereses.topeCompensatorio.tarjeta.emisorNoBancario` | Tope del compensatorio cuando el emisor no es banco. | Ley 25.065 art. 16, 2do párrafo `[V]` | **25% por encima del promedio de tasas del sistema para préstamos personales publicado por el BCRA del día 1 al 5 de cada mes** `[V]`. Requiere la **serie histórica** de ese promedio como parámetro con vigencia. | | |
| `intereses.topePunitorio.tarjeta.hasta_DNU70_2023` | Tope del punitorio en tarjetas, para hechos anteriores al DNU 70/2023. | Ley 25.065 art. 18, texto anterior `[C]` | **50%** `[C]` — texto anterior corroborado 2026-09-20: *"El límite de los intereses punitorios que el emisor aplique al titular no podrá superar en más del cincuenta por ciento (50%) a la efectivamente aplicada por la institución financiera en concepto de interés compensatorio o financiero. Independientemente de lo dispuesto por las leyes de fondo, los intereses punitorios no serán capitalizables."* `[I]` **Hallazgo de la ronda: la no capitalización ya estaba en el texto original.** El DNU suprimió el primer párrafo y conservó el segundo. **La fecha de corte sigue `[D]`**: ver la fila siguiente. | | |
| `intereses.topePunitorio.tarjeta.desde_DNU70_2023` | Ídem, para hechos posteriores. | Ley 25.065 art. 18 según art. 20 del DNU 70/2023 `[V]` | `A DETERMINAR POR EL ESTUDIO` — el texto vigente sólo dispone la no capitalización; **hay que dictaminar si subsiste algún tope y con qué fundamento**. Ver §4.4 y C-05. | | |
| `intereses.punitorioNoCapitalizable.tarjeta` | Prohibición de capitalizar punitorios en tarjetas. | Ley 25.065 art. 18 vigente `[V]` | **true** `[V]`. `[C]` **Corrección de la ronda 2026-09-20: rige desde la sanción original de la Ley 25.065, no desde el DNU.** La cláusula figuraba ya en el texto anterior del art. 18. Eso **simplifica el parámetro**: no necesita doble vigencia. | | |
| `intereses.fechaCorteDNU70_2023` | Fecha a partir de la cual deja de regir el tope del 50% de punitorios en tarjeta. Decide, deuda por deuda, si hay tope o no lo hay. | DNU 70/2023, disposiciones de vigencia `[D]`; CCyC art. 5 `[P]` | `A DETERMINAR POR EL ESTUDIO`. Corroborado 2026-09-20 sólo lo siguiente: **publicación en el Boletín Oficial el 21/12/2023** `[C]`. Las fuentes consultadas infieren la vigencia el **29/12/2023** aplicando el art. 5 del CCyC (octavo día) por no haber fijado el DNU fecha propia, pero **esa fecha es un razonamiento doctrinario, no un texto normativo, y el artículo de vigencia del DNU no pudo leerse**. **No cargar sobre esta base.** | | |
| `intereses.improcedenciaPunitorios.tarjeta.pagoMinimo` | No corresponde punitorio si se hizo el pago mínimo del resumen en fecha. | Ley 25.065 art. 19 `[V]` | **true** `[V]`. **No hay CA que lo cubra**: defecto D-14. | | |
| `intereses.capitalizacion.periodicidadMinimaPactable` | Periodicidad mínima con que una cláusula puede prever la acumulación de intereses al capital. | CCyC art. 770 inc. a `[C]` | **6 meses** `[C]` — corroborado 2026-09-20: *"una cláusula expresa autorice la acumulación de los intereses al capital con una periodicidad **no inferior a seis meses**"*. **Sigue sin verificar** si el DNU 70/2023 alcanzó el capítulo de obligaciones dinerarias del CCyC; ninguna consulta lo aclaró. | | |
| `intereses.capitalizacion.supuestosAdmitidos` | Catálogo cerrado de casos en que la capitalización es admisible. | CCyC art. 770 `[C]` | **Cuatro supuestos** `[C]`, texto corroborado 2026-09-20: **a)** cláusula expresa con periodicidad no inferior a seis meses; **b)** obligación demandada judicialmente — la acumulación opera **desde la notificación de la demanda**; **c)** obligación liquidada judicialmente — la capitalización se produce **desde que el juez manda pagar la suma resultante y el deudor es moroso en hacerlo**; **d)** otras disposiciones legales que prevean la acumulación. `[I]` Los incisos b) y c) fijan **fechas de inicio distintas** que el motor debe modelar por separado; la spec los trata como un único supuesto. | | |
| `intereses.normalizacion.basesDeTasa` | Reglas de conversión entre TNA, TEA y tasa mensual antes de comparar contra un tope. | No normativo; criterio financiero `[I]` | `A DETERMINAR` — **no es un problema legal sino actuarial, y la spec lo identifica bien en §7.** Requiere criterio de un contador o actuario, no del estudio jurídico. Comparar una TNA contra un tope expresado en TEA produce hallazgos falsos. | | |
| `intereses.art36LDC.datosObligatorios` | Datos que el acreedor debió informar en la operación de crédito para consumo. | Ley 24.240 art. 36 `[P]` | **TNA, TEA, costo financiero total, cantidad y periodicidad de cuotas, monto total financiado** `[P]` — verificar la enumeración exacta. Habilita un hallazgo que la spec no contempla (D-15). | | |
| `intereses.moraAutomatica` | Si la mora es automática o requiere interpelación en la deuda evaluada. | CCyC arts. 886/887 `[P]` | `A DETERMINAR POR EL ESTUDIO` — determina desde cuándo se devengan punitorios | | |

### 5.C — Plazos de archivo de información crediticia

| Parámetro | Qué representa | Norma que lo funda | Valor propuesto | Validado por | Fecha |
| --- | --- | --- | --- | --- | --- |
| `archivoCrediticio.plazoGeneral` | Plazo máximo durante el cual un dato de solvencia puede archivarse, registrarse o cederse. | Ley 25.326 art. 26 inc. 4 `[V]` | **5 años** `[V]` | | |
| `archivoCrediticio.plazoAbreviadoPorExtincion` | Plazo reducido cuando el deudor cancela o de otro modo extingue la obligación. | Ley 25.326 art. 26 inc. 4 `[V]` | **2 años** `[V]`, computados desde la extinción `[P]` | | |
| `archivoCrediticio.diesAQuo.plazoGeneral` | Desde qué hecho exacto se cuentan los 5 años. | **Decreto 1558/2001, art. 26** `[C]` (reglamentario de la Ley 25.326) **en tensión con** CSJN, *"Catania, Américo Marcial c/ BCRA s/ habeas data"*, 08/11/2011, citado como **Fallos 334:1276** `[C]` | `A DETERMINAR POR EL ESTUDIO` — **sigue siendo el parámetro más peligroso del análisis C**, pero la ronda del 2026-09-20 **nominó las dos fuentes**. **(a)** Decreto 1558/2001 art. 26, texto corroborado: *"…se tendrá en cuenta toda la información disponible desde el nacimiento de cada obligación hasta su extinción. En el cómputo de CINCO (5) años, éstos se contarán a partir de la fecha de la **última información adversa archivada que revele que dicha deuda era exigible**."* **(b)** Según las reseñas consultadas, en *Catania* la Corte sostuvo que **el plazo de cinco años no se posterga mientras la deuda siga siendo exigible y no esté prescripta**. `[I]` **Los dos criterios apuntan en direcciones opuestas**: el del decreto permite al acreedor extender el plazo indefinidamente reinformando la deuda. **Pregunta concreta para el estudio: cuál prevalece, y cómo se traduce en una fecha calculable.** El texto de la sentencia no pudo leerse (SAIJ bloqueado). | | |
| `archivoCrediticio.diesAQuo.plazoAbreviado` | Desde qué hecho se cuentan los 2 años. | Decreto 1558/2001 art. 26 `[C]` | `A DETERMINAR POR EL ESTUDIO`. Corroborado 2026-09-20 que el decreto condiciona la reducción a que **el deudor acredite que la última información disponible coincide con la extinción de la deuda** `[C]`. `[I]` Eso agrega una **carga probatoria sobre el deudor** que la spec no modela. Sigue abierto qué es "extinción" cuando hubo acuerdo, refinanciación o pago parcial. | | |
| `archivoCrediticio.datosDeCumplimiento.sinPlazo` | Si los datos de cumplimiento sin mora tienen plazo de eliminación. | Decreto 1558/2001 art. 26 `[C]` | **No opera plazo alguno de eliminación** para los datos de cumplimiento sin mora `[C]` — corroborado 2026-09-20. `[I]` **No está contemplado en la spec** y es información que el cliente va a pedir: no todo dato del informe es suprimible por antigüedad. | | |
| `archivoCrediticio.registro.bureauPrivado` | Régimen aplicable a los bureaus privados. | Ley 25.326 art. 26 `[V]` | Los dos plazos anteriores | | |
| `archivoCrediticio.registro.centralDeudoresBCRA` | Plazo de permanencia en la Central de Deudores del Sistema Financiero del BCRA, que **es un registro distinto con régimen propio**. | Comunicación del BCRA aplicable `[D]` | `A DETERMINAR POR EL ESTUDIO`. Ronda 2026-09-20: se **identificó la fuente pero no se leyó**. La norma sería el **"Régimen Informativo de Deudores del Sistema Financiero (R.I.–D.S.F.)"**, articulado con el texto ordenado de "Clasificación de deudores"; aparecieron asociadas las Comunicaciones **"A" 3119, 4765 y 8045**, **ninguna verificada como vigente**. La cifra de **24 meses** que circula proviene de una publicación institucional del BCRA en redes, **no de una norma**, y `[I]` podría ser la **ventana de consulta del informe público** y no el plazo de permanencia del dato: son cosas distintas y confundirlas produce el riesgo RL-06. `www.bcra.gob.ar` bloqueado. Defecto D-16, condición C-06. | | |
| `archivoCrediticio.plazoRespuestaSupresion` | Plazo del responsable para rectificar, actualizar o suprimir. | Ley 25.326 art. 16 `[C]` | **5 días hábiles** `[C]` — corroborado 2026-09-20, coincide con el valor que ya asume `docs/03`. Plazo contado desde la recepción del reclamo o desde que se advierte el error o falsedad. | | |
| `archivoCrediticio.plazoRespuestaAcceso` | Plazo para responder el pedido de acceso. | Ley 25.326 art. 14 `[C]` | **10 días corridos** `[C]` — corroborado 2026-09-20. `[!]` **Discrepancia menor entre fuentes**: un resultado habla de "diez días hábiles". Se mantiene "corridos" por ser lo que dicen la mayoría de las fuentes y `docs/03`, **pero el estudio debe confirmarlo**. Gratuidad con periodicidad semestral: sigue `[P]`, no se corroboró. | | |
| `archivoCrediticio.umbralAlertaDias` | Antelación del estado PROXIMO_A_CADUCAR (CA-17). | Producto, no normativo `[I]` | **90 días** `[I]` — propuesta del revisor | | |

### 5.D — Embargabilidad de haberes

| Parámetro | Qué representa | Norma que lo funda | Valor propuesto | Validado por | Fecha |
| --- | --- | --- | --- | --- | --- |
| `embargo.montoInembargable` | Porción de la remuneración absolutamente inembargable. | Decreto 484/87 art. 1 `[V]`/`[C]`; LCT art. 120 `[P]` | **El importe mensual del SMVM vigente a la fecha del hecho** `[V]`. Texto corroborado 2026-09-20: *"Las remuneraciones devengadas por los trabajadores en cada período mensual, **así como cada cuota del sueldo anual complementario**, son inembargables hasta una suma equivalente al importe mensual del SALARIO MINIMO VITAL…"* `[I]` **Hallazgo: el decreto trata expresamente el aguinaldo**, aplicándole el mismo piso por cuota. Eso da una base para `embargo.tratamientoSAC`, que hoy está en `[D]`. | | |
| `embargo.tramo1.limiteSuperior` | Techo del primer tramo. | Decreto 484/87 art. 1 inc. 1 `[C]` | **2 veces el SMVM** `[V]` — corroborado 2026-09-20 | | |
| `embargo.tramo1.porcentaje` | Porcentaje embargable en el primer tramo, **aplicado sobre el excedente del SMVM, no sobre el total**. | Decreto 484/87 art. 1 inc. 1 `[C]` | **10% del importe que exceda el SMVM** `[V]` — corroborado 2026-09-20. `[I]` En el inciso 1 la base **no** está en disputa: la lectura alternativa daría cero embargable entre 1 y 2 SMVM, lo que es absurdo. La disputa es sólo en el inciso 2: ver la fila siguiente. | | |
| `embargo.tramo2.porcentaje` | Porcentaje embargable por encima de 2 SMVM. La base del excedente está **en disputa**. | Decreto 484/87 art. 1 inc. 2 `[C]` | **20%** `[V]`. **Base del excedente: `[!]` CONTRADICCIÓN ABIERTA — NO CARGAR.** La ronda del 2026-09-20 obtuvo el texto y **el resultado no es el esperado: el problema no es que no se conozca el texto, es que el texto es ambiguo.** Los dos incisos usan la **misma fórmula**: inc. 1 *"…hasta el diez por ciento (10%) del importe que excediere de **este último**"*; inc. 2 *"…hasta el veinte por ciento (20%) del importe que excediere de **este último**"*. La pregunta se traslada a qué remite "este último" en el inc. 2: **(L1)** el SMVM → 20% de (remuneración − 1 SMVM); **(L2)** el doble del SMVM → 20% de (remuneración − 2 SMVM). `[I]` En el inc. 1 L2 sería absurda (nada embargable entre 1 y 2 SMVM), lo que fuerza L1 **ahí**; en el inc. 2 L2 **no** es absurda. A favor de L1: el paralelismo y el encabezado *"Las remuneraciones superiores **a ese importe**"*, donde "ese importe" es inequívocamente el SMVM. A favor de L2: la regla del antecedente más próximo. **Es una cuestión de interpretación, no de transcripción, y por definición está fuera de lo que este agente puede resolver.** Lo que hay que pedirle al estudio cambia: ya no "confirmar el texto" sino **"dictaminar cuál lectura rige, con la jurisprudencia que la sostenga"**. Ver `specs/legal/verificacion-documental.md` §3.1. | | |
| `embargo.baseDeCalculo` | Qué se entiende por remuneración sobre la que se calcula (bruta, neta, qué deducciones). | LCT arts. 133 y 147 `[P]`; Decreto 484/87 `[P]` | `A DETERMINAR POR EL ESTUDIO` — la spec dice "remuneración neta" sin definirla | | |
| `embargo.tratamientoSAC` | Cómo se computa el aguinaldo. | `[D]` | `A DETERMINAR POR EL ESTUDIO` | | |
| `embargo.excepcionAlimentos` | Los topes no rigen del mismo modo frente a embargos por alimentos o litisexpensas. | Decreto 484/87 `[P]`; LCT art. 120 `[P]` | `A DETERMINAR POR EL ESTUDIO` — **mientras no esté cargado, el motor no debe evaluar embargos de causa alimentaria**. Defecto D-17. | | |
| `embargo.haberesPrevisionales` | Régimen de embargabilidad de jubilaciones y pensiones, distinto del salarial. | **Ley 24.241, art. 14 inc. c** `[C]` | `A DETERMINAR POR EL ESTUDIO`, pero **la ronda del 2026-09-20 confirmó que el régimen es de otra naturaleza, no una variante de la escala salarial** `[C]`: las prestaciones previsionales **son inembargables**, con la salvedad de las **cuotas por alimentos y litisexpensas**. No hay escala de 10%/20%: hay inembargabilidad. `[I]` **El defecto D-19 y el riesgo RL-11 quedan confirmados y, a criterio de este revisor, subestimados en su calificación original.** Aplicar el Decreto 484/87 a un jubilado no le inventaría un derecho: **se lo ocultaría**, diciéndole que un descuento está "dentro del tope" cuando podría no corresponder en absoluto. **Alcance práctico `[D]`**: aparecieron casos de aplicación analógica del Decreto 484/87 a haberes de empleados públicos y algún embargo sobre jubilaciones; no se verificó el alcance de esas excepciones. **Mientras no esté ratificado, INDETERMINABLE; nunca aplicar el Decreto 484/87 por defecto.** | | |
| `embargo.indemnizacionesLaborales` | Inembargabilidad de indemnizaciones por despido o accidente. | LCT art. 149 `[P]` | `A DETERMINAR POR EL ESTUDIO`. Defecto D-18. | | |
| `embargo.cuentaSueldo.intangibilidad` | Protección de los fondos acreditados en cuenta sueldo y prohibición de que el banco compense o debite para cobrarse. | Comunicación del BCRA sobre cuenta sueldo `[D]` | `A DETERMINAR POR EL ESTUDIO`. Ronda 2026-09-20: **fuente identificada, texto no leído** (`www.bcra.gob.ar` bloqueado). La norma estaría en el texto ordenado **"Depósitos de ahorro, cuenta sueldo y especiales"** (`bcra.gob.ar/archivos/Pdfs/texord/t-depaho.pdf`); aparecieron asociadas las Comunicaciones **"A" 6042, 6610, 6909, 7062, 8027, 8106 y 8343**, **ninguna verificada como la vigente en la materia**. **No se obtuvo el punto normativo concreto**, por lo que CA-22 sigue sin poder citar la norma que exige CA-27. `[I]` Además apareció una pista **sin verificar** que la revisión anterior no tenía: un régimen por el cual el **saldo** de la cuenta sueldo sería inembargable hasta **tres veces el salario promedio de los últimos seis meses**. Si fuera correcto, el análisis D tendría una regla propia del saldo en cuenta, distinta de la escala salarial. Sigue pendiente precisar que la intangibilidad frente al banco **no** equivale a inembargabilidad frente a un juez. | | |
| `embargo.smvm.serieHistorica` | Valor del SMVM con vigencia desde/hasta. | Resoluciones del Consejo Nacional del Empleo, la Productividad y el SMVM `[D]` | `A DETERMINAR` — no es un valor sino una **serie**. Debe cargarse con su resolución y su fecha (decisión 004-C). Sin valor para la fecha evaluada: INDETERMINABLE. | | |

### 5.E — Honorarios y cuota litis

| Parámetro | Qué representa | Norma que lo funda | Valor propuesto | Validado por | Fecha |
| --- | --- | --- | --- | --- | --- |
| `cuotaLitis.topeGeneral.nacionalFederal` | Máximo del pacto de cuota litis sobre el resultado económico del pleito, cualquiera sea el número de pactos y de profesionales. | **Ley 27.423, art. 6** `[C]` — **numeración resuelta en la ronda del 2026-09-20**; contenido `[V]` | **30% del resultado del pleito** `[V]` — texto corroborado: *"…no podrá exceder del treinta por ciento (30%) del resultado del pleito, cualquiera fuese el número de pactos celebrados e independientemente del número de profesionales intervinientes."* Requisito de forma corroborado: **por escrito, antes o después de iniciado el juicio, con tantos ejemplares como partes hubiera** `[C]` — `[I]` **la spec no modela el requisito de forma**, y un pacto sin él es atacable. | | |
| `cuotaLitis.topeAmpliado.conAsuncionDeCostas` | Máximo cuando el profesional asume expresamente las costas de la defensa del cliente y la obligación de responder por ellas. | Ley 27.423 art. 6 `[C]` | **40%** `[V]` — corroborado 2026-09-20 | | |
| `cuotaLitis.topeMateriasProtegidas` | Régimen en asuntos previsionales, alimentarios y en los que actúan menores con representación legal. | Ley 27.423 art. 6 inc. c `[!]` | `[!]` **CONTRADICCIÓN ABIERTA — NO CARGAR. El valor `20%` que traía este documento marcado `[V]` queda degradado.** La ronda del 2026-09-20 obtuvo fuentes que atribuyen al **art. 6 inc. c)** una **prohibición**, no un tope: en esas materias los honorarios **"no podrán ser objeto de pacto de cuota litis"**. Lo refuerza un comunicado de una fiscalía federal sobre la **declaración de nulidad absoluta** de un pacto de cuota litis cobrado en una **causa previsional** (`fiscales.gob.ar`, Caleta Olivia). `[I]` **La diferencia no es de grado, es de naturaleza.** Si es prohibición, un motor que devuelva "hasta el 20%" estaría avalando un pacto **nulo**, sobre el grupo que la norma quiso proteger: sería el peor error posible del análisis E. **Este revisor no leyó el texto oficial y no elige entre las dos versiones.** Mientras tanto: **el análisis E no debe evaluar materias previsionales, alimentarias ni con menores.** | | |
| `cuotaLitis.topeLaboral` | Máximo en materia laboral. | **LCT art. 277, según Ley 27.802 (BO 06/03/2026)** `[C]` | **20%** `[C]`, con **ratificación personal y homologación judicial**, y nulidad de pleno derecho del pacto no homologado — texto reseñado corroborado 2026-09-20. **Sigue sin poder cargarse**, por dos motivos nuevos: **(1)** la norma que hay que mirar **no es el DNU 70/2023 ni la Ley 27.742** como suponía este documento, sino la **Ley 27.802 de Modernización Laboral, publicada hace seis meses**, cuyo texto **no se leyó** (`boletinoficial.gob.ar` bloqueado); **(2)** hay **derecho transitorio en disputa** sobre su aplicación a juicios en trámite anteriores a marzo de 2026, por lo que `[I]` **la regla de vigencia por fecha del hecho (CA-29) no alcanza para este parámetro**. | | |
| `cuotaLitis.baseDeCalculo` | Qué es el "resultado económico obtenido": bruto o neto, sobre la quita obtenida o sobre el monto efectivamente pagado, con o sin costas. | Ley 27.423 `[D]` | `A DETERMINAR POR EL ESTUDIO` — **crítico**, porque la comisión de éxito de la plataforma se calcula sobre una base análoga y la definición decide si CA-23 rechaza o no una combinación | | |
| `cuotaLitis.nulidadRenunciaAnticipada` | Nulidad de la renuncia anticipada de honorarios o del convenio que reduzca las proporciones arancelarias. | Ley 27.423 `[V]` | **Aplicable** `[V]`. `[I]` Impacta en el convenio plataforma–abogado (spec 018), no en el motor. | | |
| `comision.tratamientoFrenteAlTopeArancelario` | Si la comisión de éxito de la plataforma computa dentro del tope de cuota litis o se mide aparte. | Constitución #10; códigos de ética `[P]` | `A DETERMINAR POR DECISIÓN HUMANA` — no es un parámetro que el estudio pueda fijar solo: es encuadre de producto **y** deontología. Ver §4.8 y condición C-09. | | |
| `honorarios.jurisdiccionesHabilitadas` | Jurisdicciones con parámetros arancelarios cargados. | Leyes arancelarias provinciales `[D]` | **Sólo Nacional y Federal en la primera versión** `[I]` (decisión 004-D, opción A). El resto: INDETERMINABLE (CA-26). | | |
| `honorarios.prohibicionParticion` | Imposibilidad de que un no abogado participe de honorarios profesionales. | Códigos de ética de los colegios `[P]` | **true**, sin excepción configurable `[I]` — no debe ser un parámetro apagable. Constitución #10. | | |

### 5.F — Transversales

| Parámetro | Qué representa | Norma que lo funda | Valor propuesto | Validado por | Fecha |
| --- | --- | --- | --- | --- | --- |
| `motor.versionConjuntoParametros` | Identificador del conjunto de parámetros usado en cada evaluación. | CA-27 | Obligatorio en toda salida | | |
| `motor.redondeo.criterio` | Sentido del redondeo cuando la norma no dispone otra cosa. | CA-32 + constitución #1 | **A favor del cliente** `[I]` — coherente con CA-32. `[I]` Documentar que si la norma dispone otro criterio, prevalece la norma. | | |
| `motor.bloqueoProduccionSinRatificacion` | Impide usar en producción un parámetro sin ratificar. | Decisión 004-A opción A; métrica de la spec §10 | **true en producción, sin override** `[I]` — condición C-02 | | |

---

## 6. Veredicto

> ## Veredicto: **APTO CON CONDICIONES**

### Fundamento

`[I]` La spec 004 es, en lo esencial, una spec **defendible desde el cumplimiento**,
y conviene decir por qué antes de listar lo que hay que corregir:

- Trata el derecho como parámetro y no como constante (R-02, CA-29, CA-30), que es
  la única arquitectura que sobrevive a un cambio normativo.
- Prefiere el silencio al invento: CA-07, CA-13, CA-26 y R-05 devuelven
  INDETERMINABLE nombrando el dato faltante. En un dominio donde el incentivo es
  siempre mostrar un número, esto es lo correcto.
- CA-08 ya identifica, por sí sola, el riesgo más grave de la feature.
- R-03 resuelve el conflicto de interés en el sentido correcto (se informa aunque
  baje la comisión), alineado con la constitución #8.
- CA-31 (determinismo, fecha como entrada) hace auditable lo que el sistema dijo
  en una fecha pasada, que es lo que un abogado va a necesitar si algo sale mal.
- CA-28 propaga la marca de validación pendiente hasta la interfaz.

**No corresponde NO APTO** porque no se detectó: tratamiento de datos sin base
legal declarada, promesa de resultado en el texto de la spec, ni un cobro de
encuadre dudoso. Los problemas encontrados son corregibles sin rediseñar la
feature.

**No corresponde APTO liso** por cuatro motivos, en orden de gravedad:

1. **El riesgo del análisis de prescripción no está resuelto por la spec**, está
   abierto en la decisión 004-B, y la mitigación textual de CA-08 es insuficiente
   (§4.1). Es un riesgo de daño directo al cliente.
2. **Un parámetro central del análisis B se apoya en un artículo sustituido** por
   un DNU cuya validez está controvertida (§4.4), y la spec lo trata como si el
   tope existiera sin más.
3. **El parámetro que decide todo el análisis C —el *dies a quo* del plazo de
   archivo— está indeterminado** (§4.6), y sin él el motor puede afirmar
   caducidades falsas.
4. **CA-23 tensiona la constitución #10** al computar la comisión de la plataforma
   dentro del tope arancelario (§4.8), y eso es una decisión humana pendiente.

### Condiciones

Verificables una por una. **Ninguna admite "se resuelve después".** La columna
"Compuerta" indica el momento límite para cumplirla.

| # | Condición | Cómo se verifica | Compuerta |
| --- | --- | --- | --- |
| **C-01** | Resolver la decisión **004-B por la opción B**, con los cinco recaudos del dictamen §7.1. | Decisión registrada en `REGISTRO-COMPUERTAS.md` con fecha y motivo. | **G1** |
| **C-02** | Resolver **004-A por la opción A** e implementar el bloqueo: en entorno productivo, un parámetro con `requiereValidacionProfesional: true` **no puede usarse**, sin override. | Test que falla si un parámetro sin ratificar se evalúa con entorno = producción. Métrica de la spec §10 en 0. | G1 / verificado en G5 |
| **C-03** | Un abogado matriculado **firma la tabla del §5 completa**, completando toda celda `A DETERMINAR POR EL ESTUDIO` y toda marca `[P]`, con nombre, matrícula, jurisdicción, fecha y **fecha de próxima revisión**. | Tabla con las columnas "Validado por" y "Fecha" completas en el 100% de las filas. | **Antes de G4** |
| **C-04** | Reformular el hallazgo del análisis B en el régimen general: **no "exceso del tope legal"** sino "posible exceso sujeto a control judicial" (CCyC art. 771). Reservar el lenguaje de exceso legal para tarjetas con tope vigente a la fecha del hecho. | Cambio en la spec (vuelve a G1) + test sobre los términos de la plantilla del hallazgo. | **G1** |
| **C-05** | Desdoblar `intereses.topePunitorio.tarjeta` en dos vigencias (anterior y posterior al DNU 70/2023). **Ningún hallazgo de exceso de punitorio en tarjeta para hechos posteriores** hasta que el estudio dictamine si subsiste un tope. | Test: hecho posterior a la fecha de corte + parámetro no ratificado → INDETERMINABLE, no hallazgo. | G1 / G4 |
| **C-06** | Análisis C: **parámetros separados por registro** (bureau privado art. 26 vs. Central de Deudores del BCRA) y **`diesAQuo` ratificado por escrito con cita de jurisprudencia**. Sin ratificación, el análisis C **no emite CADUCADO**. | Test: `diesAQuo` no ratificado → INDETERMINABLE. Parámetros distintos por registro en el modelo. | G1 / G4 |
| **C-07** | Los textos obligatorios del §3 se incorporan como **criterios de aceptación de la spec** y se cubren con test, incluida la lista de términos prohibidos del §3.8. | CAs nuevas en la spec (vuelve a G1) + tests en G5. | **G1** |
| **C-08** | Las diez salvaguardas S-01 a S-10 del §4.2 se implementan y se cubren con test. | Un test por salvaguarda, nombrado por su identificador. | G1 (aceptación) / G5 (verificación) |
| **C-09** | Decisión humana sobre **CA-23**: si el tope es conjunto, separado, o separado con compromiso interno (§4.8). Si se opta por conjunto, dictamen específico del estudio sobre la constitución #10 **antes de G2**. | Decisión registrada + dictamen adjunto si corresponde. | **Antes de G2** |
| **C-10** | El contrato de entrada del motor **no admite** nombre, DNI, CUIL ni domicilio del deudor: sólo identificadores opacos y los datos funcionalmente necesarios (§2.2). | Revisión del contrato en G2 + test de tipo. | G2 |
| **C-11** | La base de la comisión de éxito es el **resultado confirmado**, nunca el impacto estimado por el motor (§4.7). Además, ningún hallazgo favorable al cliente queda detrás de un plan pago (constitución #8). | Dependencia declarada hacia la spec 018 + test de que el impacto estimado no alimenta el cálculo de comisión. | G2 (declarada) / G5 |
| **C-12** | Regla explícita de **no-confusión entre prescripción y caducidad del archivo crediticio** (§4.3), con el texto del §3.3 cuando coexisten ambos hallazgos sobre la misma deuda. | CA nueva + test sobre el caso de hallazgos coexistentes. | **G1** |

### Lo que este veredicto **no** dice

`[I]` Este veredicto dice que la spec puede avanzar a G2 si se cumplen las doce
condiciones. **No dice que la feature sea legalmente segura**, y no puede decirlo:
quien lo escribe no es abogado y una parte sustancial de los parámetros está sin
determinar. La seguridad legal de esta feature depende íntegramente de que se
cumpla **C-03** antes de que una sola evaluación llegue a un cliente real.

---

## 7. Dictamen sobre las decisiones pendientes

### 7.1 Decisión 004-B — a quién se le muestra el análisis de prescripción

> **Dictamen: opción B, con cinco recaudos.** Coincide con la recomendación de la
> spec, pero la opción B **por sí sola no alcanza**.

**Por qué B y no A.** La opción A (visible para todos desde el primer momento, con
advertencias fuertes) confía la mitigación de un riesgo de conducta a un texto.
El §4.1 explica por qué eso falla: la asimetría de atención de una persona bajo
estrés financiero, el sesgo de certeza que transmite una fecha exacta, y el hecho
de que el daño se produce **fuera de la app**, en una llamada con el acreedor
donde ninguna advertencia está presente. `[I]` Además, A maximiza la exposición a
RL-02: un análisis jurídico entregado directamente al destinatario final, sin
intervención profesional, es lo más parecido a un dictamen que puede emitir un
sistema.

**Por qué B y no C.** La opción C ("hay algo para revisar en esta deuda", sin
detalle) parece prudente, pero tiene dos problemas:

- `[I]` **Roza el deber de información del art. 4 de la Ley 24.240** `[P]`: el
  sistema sabe algo relevante sobre la situación del consumidor y no se lo dice.
  La información incompleta y expectante también puede ser cuestionable.
- `[I]` **Es el diseño que más fácilmente se convierte en una palanca comercial.**
  "Hay algo para revisar, contratá el plan para verlo" sería una violación
  frontal de la constitución #8. La opción C no obliga a eso, pero lo facilita.

`[I]` B es mejor que C porque el diferimiento tiene una razón **profesional**
(que un matriculado lo revise) y no **comercial** (que el cliente pague). Esa
distinción es la que hace que B sea defendible y C, frágil.

**Por qué B tampoco alcanza sola.** B difiere la información, pero no dice **por
cuánto tiempo**, ni **qué ve el cliente mientras tanto**, ni **qué pasa si el
abogado nunca lo revisa**. Un hallazgo diferido indefinidamente es, en los hechos,
un hallazgo ocultado, y eso sí contradice la constitución #8.

**Los cinco recaudos, todos verificables:**

| # | Recaudo | Verificación |
| --- | --- | --- |
| B-1 | **Advertencia preventiva inmediata y sin condiciones.** Desde el primer momento, y **sin esperar la revisión profesional**, el cliente ve sobre esa deuda: *"Estamos revisando esta deuda con un abogado. Mientras tanto, **no reconozcas la deuda, no firmes planes de pago y no hagas pagos parciales** sin consultarnos: eso puede hacerte perder defensas."* `[I]` Esto es lo que evita el daño concreto y **no requiere revelar el hallazgo**. Sin este recaudo, B protege a la empresa pero no al cliente. | Test: hallazgo de prescripción en estado pendiente ⇒ advertencia visible al cliente. |
| B-2 | **Plazo máximo de revisión profesional, con escalamiento.** El diferimiento tiene un tope (propuesta del revisor: **10 días hábiles** `[I]`). Vencido, se escala y queda registrado. El diferimiento nunca es indefinido. | Test + alerta de back-office sobre hallazgos pendientes vencidos. |
| B-3 | **El diferimiento es profesional, nunca comercial.** Prohibido condicionar la visibilidad del hallazgo —o su revisión— a la contratación de un plan pago. Constitución #8. | Test: el hallazgo confirmado se muestra igual en el plan gratuito. |
| B-4 | **Confirmación trazable.** El abogado que confirma, rechaza o corrige queda registrado con matrícula, jurisdicción y fecha (R-08, S-03). El hallazgo rechazado no se muestra al cliente como vigente. | Test S-03 y S-07. |
| B-5 | **Acompañado siempre de la acción recomendada**, como pide la propia opción B, con los textos del §3.1. Nunca el hallazgo solo. | Test de plantilla obligatoria. |

`[I]` **Sobre la constitución #8.** Alguien puede objetar que diferir el hallazgo
contradice el principio 8 ("si el diagnóstico detecta que una deuda está
presumiblemente prescripta, se le informa al cliente aunque eso reduzca la base de
comisión"). No lo contradice, y conviene dejarlo escrito: el principio 8 prohíbe
**callar por conveniencia económica**. Acá no se calla por conveniencia: se
verifica antes de informar, con plazo máximo, con advertencia preventiva desde el
minuto cero, y sin cobrar por el acceso. El recaudo B-3 es precisamente lo que
mantiene a B del lado correcto del principio 8, y el B-1 lo que impide que el
diferimiento se convierta en desprotección. **Si alguno de esos dos recaudos se
cae, el dictamen cambia y la opción correcta pasa a ser A con advertencias
reforzadas.**

### 7.2 Dictamen sobre las otras tres decisiones

| Decisión | Dictamen del revisor | Fundamento |
| --- | --- | --- |
| **004-A** — carga inicial de valores normativos | **Opción A**, con el test de bloqueo. Coincide con la spec. | `[I]` B (parámetros vacíos) impide testear y, peor, genera presión para "cargar algo rápido" cerca del lanzamiento, que es cuando peor se decide. A con bloqueo por entorno es auditable: la métrica "parámetros sin ratificar en producción = 0" es verificable. **Condición C-02.** |
| **004-C** — origen de los valores de referencia | **Opción B**. Coincide con la spec. | `[I]` Un SMVM mal cargado cambia el cálculo de embargabilidad **de toda la cartera** y, por la constitución #7, también la validación de capacidad de pago de las suscripciones. La aprobación humana antes de activar un valor es proporcional al daño. C (sólo automática) es inaceptable. |
| **004-D** — alcance jurisdiccional de honorarios | **Opción A**. Coincide con la spec. | `[I]` Aplicar el límite nacional a una provincia con ley arancelaria propia produce un hallazgo falso sobre un contrato que el cliente va a firmar. CA-26 (INDETERMINABLE, sin default nacional) es la respuesta correcta y hay que defenderla frente a la tentación de "poner el nacional mientras tanto". |

---

## 8. Defectos detectados en la spec y escalamiento

**Este agente no modifica la spec.** Lo que sigue se escala al orquestador para
que lo lleve al humano. Los defectos marcados **(G1)** requieren corregir la spec
y volver a pasar la compuerta.

| # | Defecto | Dónde | Gravedad |
| --- | --- | --- | --- |
| D-11 | No se limita la interpelación fehaciente a una sola vez como hecho suspensivo. | CA-05 | Media |
| D-12 | No hay regla de desempate cuando concurren dos regímenes de prescripción posibles. | Análisis A | Media |
| D-13 | El tope de compensatorio en tarjetas no distingue emisor bancario de no bancario, que tienen **base de cálculo distinta**. | CA-10 | **Alta (G1)** |
| D-14 | No se contempla la improcedencia de punitorios cuando se hizo el pago mínimo (Ley 25.065 art. 19). Hallazgo de alto valor, omitido. | Análisis B | Media |
| D-15 | No se contempla el incumplimiento del deber de información del art. 36 de la Ley 24.240 como hallazgo. | Análisis B | Media |
| D-16 | El análisis C trata un único registro; la Central de Deudores del BCRA y los bureaus privados tienen regímenes distintos. | CA-14 a CA-17 | **Alta (G1)** |
| D-17 | No se contempla el embargo de causa alimentaria, cuyo régimen es distinto. El motor reportaría un exceso falso. | CA-21 | **Alta (G1)** |
| D-18 | No se contempla la inembargabilidad de indemnizaciones laborales. | Análisis D | Media |
| D-19 | No se distingue haber previsional de remuneración. Parte de la audiencia cobra jubilación. | CA-18 a CA-20 | **Alta (G1)** |
| D-20 | CA-23 computa la comisión de la plataforma dentro del tope arancelario, tensionando la constitución #10. | CA-23 | **Alta (G2)** |
| D-21 | CA-08 exige advertir que la prescripción debe oponerse como defensa, pero **no** exige advertir que un pago parcial o un reconocimiento la interrumpen, que es el mecanismo concreto del daño. | CA-08 | **Alta (G1)** |
| D-22 | Inconsistencia entre documentos: `docs/03-cumplimiento-legal-argentina.md` describe un estado `PRESCRIPTA` en `prescripcion.ts`, mientras la spec exige `PRESUNTAMENTE_PRESCRIPTA` (CA-01, CA-08). **Este agente tiene permiso para editar `docs/03` pero el encargo lo limitó a un entregable único; queda escalado.** | `docs/03` vs. spec | Media |
| D-23 | Ninguna CA exige registrar matrícula y jurisdicción del abogado que confirma, pese a que R-08 lo enuncia. | Transversales | Media |
| D-24 | CA-18 dice "salario mínimo vigente" sin decir "a la fecha del hecho", lo que contradice CA-29. | CA-18 | Baja |
| D-25 | La spec no exige que el motor declare la **fuente y la fecha** del valor de referencia usado (SMVM, promedio BCRA) dentro del hallazgo. CA-27 cubre las normas, no los valores de mercado. | CA-27 | Media |

### Puntos que requieren verificación documental antes de producción

**Actualizado el 2026-09-20 tras la ronda de verificación.** Registro completo en
`specs/legal/verificacion-documental.md`.

**Qué pasó en esa ronda, en una línea:** no se pudo abrir **ninguna** fuente
oficial —la política de egreso de red de la sesión bloqueó SAIJ, Boletín Oficial,
argentina.gob.ar, InfoLeg, bcra.gob.ar, cij.gov.ar y hasta un sitio de control—,
así que **ningún punto pasó a `[V]`**. El único canal disponible fue un buscador;
lo que produjo se marcó `[C]` y **se trata igual que `[P]` a los efectos del
bloqueo de producción de la condición C-02**.

#### 8.1 Cerrados por la ronda (quedan en `[C]`, siguen exigiendo C-03)

Ya no hace falta **buscarlos**; hace falta que el estudio los **lea y los firme**.

| Punto original | Resultado |
| --- | --- |
| 2 — art. 47 Ley 25.065 | 1 año la acción ejecutiva, 3 años las ordinarias. |
| 3 — art. 770 CCyC | Cuatro supuestos y periodicidad mínima de 6 meses. **Queda abierto** si el DNU 70/2023 alcanzó el capítulo de obligaciones dinerarias. |
| 4 — art. 18 Ley 25.065 anterior | Texto obtenido. **Hallazgo: la no capitalización ya estaba antes del DNU**; el DNU sólo suprimió el tope del 50%. **La fecha de vigencia sigue abierta** (punto 8.2.1). |
| 5 — numeración Ley 27.423 | Es el **art. 6**. Resuelto. **Pero abrió una contradicción** (punto 8.2.5). |
| 10 — estado del DNU 70/2023 | Rechazado por el Senado, **no tratado por Diputados**, por lo tanto vigente; CSJN rechazó los planteos por falta de caso; Título IV suspendido judicialmente. **Dato con fecha de vencimiento: reconsultar antes de cada puesta en producción.** |
| 12 — haberes previsionales | Ley 24.241 art. 14 inc. c: **inembargables**, salvo cuotas por alimentos y litisexpensas. **No es una escala distinta: es otra naturaleza de protección.** Agrava D-19 y RL-11. |

#### 8.2 Siguen abiertos, con el motivo

| # | Punto | Estado y motivo |
| --- | --- | --- |
| 8.2.1 | **Fecha exacta de entrada en vigencia del DNU 70/2023** | **NO VERIFICADO.** Se corroboró la publicación (BO 21/12/2023). La fecha del 29/12/2023 que circula es una **inferencia doctrinaria** (art. 5 CCyC, octavo día) y no el texto del decreto; el artículo de vigencia no pudo leerse. Decide, deuda por deuda, si hay tope de punitorios. |
| 8.2.2 | **Incidencia del DNU 70/2023 sobre el capítulo de obligaciones dinerarias del CCyC** | **NO VERIFICADO.** Ninguna consulta lo aclaró. Afecta a los arts. 770 y 771. |
| 8.2.3 | **Arts. 2537 y 2553 del CCyC** (derecho transitorio y oportunidad procesal de la defensa) | **NO VERIFICADO.** Aparecieron mencionados, ninguna fuente transcribió el texto. Sostienen la condición C-07 y el parámetro de transición. |
| 8.2.4 | **Alcance del art. 2562 inc. c del CCyC**: si los 2 años alcanzan a las cuotas de un préstamo personal | **NO VERIFICADO y reclasificado como cuestión interpretativa.** Decide el resultado en la mayoría de la cartera. |
| 8.2.5 | **Art. 6 inc. c de la Ley 27.423** — materias previsionales, alimentarias y con menores | `[!]` **CONTRADICCIÓN ABIERTA.** Este documento traía "20% `[V]`"; las fuentes de la ronda indican **prohibición** de pactar cuota litis, con nulidad absoluta declarada en un caso previsional. **Hasta que se resuelva, el análisis E no debe evaluar esas materias.** |
| 8.2.6 | **Art. 277 LCT** | **CORROBORADO PARCIAL, pregunta reformulada.** La norma a mirar **no es el DNU 70/2023 ni la Ley 27.742**, sino la **Ley 27.802 de Modernización Laboral, BO 06/03/2026**, cuyo texto no se leyó. Además hay **derecho transitorio en disputa** para juicios anteriores a marzo de 2026. |
| 8.2.7 | **Comunicación del BCRA sobre intangibilidad de cuenta sueldo** | **NO VERIFICADO.** Fuente identificada (texto ordenado "Depósitos de ahorro, cuenta sueldo y especiales"; candidatas "A" 6042/6610/6909/7062/8027/8106/8343), **ninguna confirmada**. `bcra.gob.ar` bloqueado. Sin esto, CA-22 no puede cumplir CA-27. |
| 8.2.8 | **Permanencia en la Central de Deudores del BCRA** | **NO VERIFICADO.** Fuente identificada (R.I.–D.S.F.; candidatas "A" 3119/4765/8045). La cifra de 24 meses proviene de una publicación institucional en redes, no de una norma, y podría ser la ventana de consulta del informe y no el plazo de permanencia del dato. |
| 8.2.9 | ***Dies a quo* del art. 26 inc. 4 de la Ley 25.326** | **NO RESUELTO, pero con las fuentes nominadas.** Hallazgo nuevo: el **Decreto 1558/2001 art. 26** fija el cómputo desde la "última información adversa archivada que revele que dicha deuda era exigible", criterio **en tensión** con lo que las reseñas atribuyen a **CSJN, "Catania", 08/11/2011, Fallos 334:1276**. El texto de la sentencia no pudo leerse. La pregunta al estudio ya no es "si existe jurisprudencia" sino **cuál criterio prevalece y cómo se traduce en una fecha calculable**. |
| 8.2.10 | **Leyes de colegiación provinciales y códigos de ética** | **NO VERIFICADO.** De la Ley 23.187 se corroboró el art. 1 y la exigencia de matrícula en el CPACF, **pero no el artículo que tipifica el ejercicio ilegal**, que es lo que importa para el §4.2 y RL-02. Las 24 jurisdicciones no se intentaron: con el canal disponible no producirían material citable. `[I]` **RL-02 no es jurisdiccional: la app se usa desde todo el país.** |
| 8.2.11 | **Jurisprudencia sobre el inc. 2 del Decreto 484/87** | **INACCESIBLE.** Las sentencias pertinentes están en `cij.gov.ar` y `jus.mendoza.gov.ar`, ambos bloqueados. |

#### 8.3 Reclasificado: el punto 1 dejó de ser un problema de búsqueda

`[I]` El punto más urgente del §8 anterior era el texto del **art. 1 del Decreto
484/87**. **Se obtuvo, y la respuesta reencuadra el problema:** los dos incisos
usan la **misma fórmula** —"del importe que excediere de este último"—, de modo que
**la ambigüedad está en la norma, no en nuestro acceso a ella**. No hay texto
adicional que buscar.

Consecuencia para el plan de trabajo: lo que hay que encargarle al estudio sobre
este punto **no es una verificación sino un dictamen interpretativo**, con la
jurisprudencia que lo sostenga. Lo mismo vale para 8.2.4 y 8.2.9. `[I]` Son las
tres preguntas más caras de la tabla del §5 y conviene encargarlas primero, porque
**ninguna se resuelve con más búsqueda**.

#### 8.4 Bloqueo de red — se escala

`[I]` Ningún agente de este repositorio puede hoy producir una cita normativa
citable: la política de egreso bloquea todos los destinos. Para que una próxima
ronda produzca `[V]` de verdad habría que habilitar, como mínimo,
`servicios.infoleg.gob.ar`, `www.saij.gob.ar`, `www.argentina.gob.ar`,
`www.boletinoficial.gob.ar`, `www.bcra.gob.ar`, `sj.csjn.gov.ar` y `www.cij.gov.ar`.
**Mientras eso no ocurra, toda verificación documental depende de que una persona
abra los sitios a mano.** Se escala al orquestador.

### Escalamiento al orquestador

`[I]` Tres puntos que, a criterio de este revisor, **el humano tiene que ver y
decidir personalmente**, no el equipo:

1. **La decisión 004-B** (§7.1). Es la decisión con mayor potencial de daño
   directo a un cliente de toda la feature.
2. **El encuadre de CA-23** frente a la constitución #10 (§4.8). Es una decisión
   de encuadre legal del modelo de negocio, no de diseño de una feature.
3. **La contratación efectiva del estudio jurídico** que firme la tabla del §5.
   Sin eso, la condición C-03 no se puede cumplir y la feature no puede llegar a
   producción, por más que el código esté terminado y testeado. **Es una
   dependencia externa y conviene arrancarla ahora, no en G4.**

---

## 9. Fuentes consultadas durante esta revisión

Consultadas en línea el 2026-09-20. No se usaron fuentes de pago ni credenciales.

- [Ley 25.326 — Habeas Data (texto actualizado, argentina.gob.ar)](https://www.argentina.gob.ar/normativa/nacional/64790/actualizacion)
- [Ley 25.065 — Tarjetas de Crédito (texto actualizado, argentina.gob.ar)](https://www.argentina.gob.ar/normativa/nacional/ley-25065-55556/actualizacion)
- [Decreto 1077/2017 y Ley 27.423 — Honorarios profesionales (argentina.gob.ar)](https://www.argentina.gob.ar/normativa/nacional/ley-27423-305057/texto)
- [Decreto Reglamentario 484/1987 (argentina.gob.ar)](https://www.argentina.gob.ar/normativa/nacional/decreto-484-1987-77255)
- [Decreto DNU 70/2023 (argentina.gob.ar)](https://www.argentina.gob.ar/normativa/nacional/decreto-70-2023-395521/texto)
- [Código Civil y Comercial de la Nación Comentado, Tomo VI (SAIJ)](https://www.saij.gob.ar/docs-f/codigo-comentado/CCyC_Nacion_Comentado_Tomo_VI.pdf)
- [El DNU 70/2023 no obtuvo la aprobación del Senado (Senado de la Nación)](https://www.senado.gob.ar/prensa/21509/noticias)
- [Estado del DNU 70/2023 tras el rechazo del Senado (Chequeado)](https://chequeado.com/el-explicador/el-senado-trata-el-dnu-presidencial-de-javier-milei-que-puede-pasar-si-lo-rechaza/)

**No accesible desde este entorno:** `servicios.infoleg.gob.ar` (bloqueado por el
proxy de egreso). Por eso el §8 lista doce puntos como "requiere verificación
documental" en lugar de afirmarlos.

### 9.1 Ronda de verificación documental — 2026-09-20

Registro completo, con las consultas una por una y los intentos fallidos:
**`specs/legal/verificacion-documental.md`**.

**Accesos directos intentados y bloqueados** (`EGRESS_BLOCKED`, política de egreso
de la sesión, no de los sitios): `www.argentina.gob.ar`, `www.saij.gob.ar`,
`servicios.infoleg.gob.ar`, `www.boletinoficial.gob.ar`, `www.bcra.gob.ar`,
`www.cij.gov.ar`, `www.trabajo.gba.gov.ar` y `es.wikipedia.org` (este último como
prueba de control, que confirmó que el bloqueo es del entorno).

**Canal efectivamente usado:** buscador web. Devuelve transcripciones atribuidas a
fuentes oficiales, **sin posibilidad de confirmar fidelidad ni vigencia**. De ahí
el marcador `[C]`.

**Fuentes oficiales y para-oficiales identificadas para que el estudio abra
primero** (aparecieron en los resultados; **ninguna fue leída**):

- Decreto 484/87 — `trabajo.gba.gov.ar/delegaciones/biblioteca_deles/DN484_1987.pdf` · `argentina.gob.ar/normativa/nacional/decreto-484-1987-77255`
- Ley 27.423 — `boletinoficial.gob.ar/detalleAviso/primera/176541/20171222` · `consejo.org.ar` (PDF de la ley)
- Ley 27.802, Modernización Laboral — `boletinoficial.gob.ar/detalleAviso/primera/339128/20260306`
- Decreto 1558/2001, reglamentario de la Ley 25.326 — `argentina.gob.ar/normativa/nacional/decreto-1558-2001-70368/actualizacion`
- CSJN, "Catania, Américo Marcial c/ BCRA s/ habeas data", 08/11/2011 — ficha en `saij.gob.ar`; Dossier "Habeas Data" de SAIJ
- BCRA, texto ordenado "Depósitos de ahorro, cuenta sueldo y especiales" — `bcra.gob.ar/archivos/Pdfs/texord/t-depaho.pdf`
- BCRA, Régimen Informativo de Deudores del Sistema Financiero — `bcra.gob.ar` (Comunicaciones "A" 3119, 4765, 8045)
- Ley 25.326, texto actualizado — `hcdn.gob.ar` (PDF de la Dirección de Información Parlamentaria) · `argentina.gob.ar/normativa/nacional/64790/actualizacion`
- Ley 23.187 — `argentina.gob.ar/normativa/nacional/ley-23187-26188` · `cpacf.org.ar/noticia/5140/ley-23187`

`[I]` **Nada de esta ronda descarga la condición C-03.** Transcribir, interpretar y
ratificar son tres operaciones distintas; sólo se intentó la primera, y con un
canal que no alcanza para citar.

---

*Documento producido por el agente `compliance-legal`. No es asesoramiento
jurídico. Requiere ratificación de abogado matriculado antes de que cualquiera de
sus parámetros se use en producción.*
