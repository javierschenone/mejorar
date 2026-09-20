# Spec 004 — Motor de reglas legales argentinas

| Campo | Valor |
| --- | --- |
| Versión | **2** — incorpora el dictamen de cumplimiento y las seis decisiones de G1 |
| Estado | EN REVISIÓN (G1) |
| Autor | orquestador |
| Revisor legal | `compliance-legal` → `specs/004-motor-reglas-legales/cumplimiento.md` (APTO CON CONDICIONES, 12 condiciones) |
| Compuerta | G1 |
| Principios de la constitución involucrados | #1, #6, #8, #10, #11, #14 |

## 0. Cambios de la versión 2

Esta versión corrige la v1 a partir del dictamen de `compliance-legal` y de las
decisiones humanas registradas en `REGISTRO-COMPUERTAS.md` (entradas 004 a 008).

| Origen | Cambio |
| --- | --- |
| Decisión 004-B | El hallazgo de prescripción no llega al cliente sin confirmación profesional, pero sí una advertencia preventiva inmediata (CA-54 a CA-57). |
| Decisión CA-23 | Topes de honorarios y de comisión **separados**, con compromiso interno de suma (CA-23 amendada, CA-44). |
| Decisión 004-A | Parámetros estimados con bloqueo duro en producción (CA-58). |
| Decisión 004-C | Valores de referencia de obtención automática y activación humana (CA-59). |
| Decisión 004-D | Cobertura ampliada a Buenos Aires, CABA, Córdoba y Santa Fe (CA-43). |
| Condición C-04 | El análisis B no habla de "exceso del tope legal" en el régimen general (CA-09 amendada). |
| Condición C-05 | El tope de punitorios en tarjetas se desdobla por vigencia del DNU 70/2023 (CA-35). |
| Condición C-06 | El análisis C separa registros y exige `diesAQuo` ratificado (CA-14 amendada, CA-38, CA-39). |
| Condición C-07 | Los textos de advertencia al consumidor son criterios de aceptación testeables (CA-45 a CA-50). |
| Condición C-08 | Las diez salvaguardas S-01 a S-10 son criterios de aceptación (CA-45 a CA-53). |
| Condición C-10 | El contrato de entrada no admite datos identificatorios del deudor (CA-60). |
| Condición C-11 | El impacto estimado por el motor nunca alimenta el cálculo de comisión (CA-61). |
| Condición C-12 | Regla de no-confusión entre prescripción y caducidad del archivo (CA-62). |
| Defectos D-11 a D-25 | Corregidos en los criterios indicados en cada caso. |

## 1. Problema

Una persona con deudas en mora no sabe qué le están reclamando de más. En la
práctica, cuatro cosas pasan todo el tiempo y el deudor no tiene cómo
detectarlas:

1. Le reclaman una deuda **tan vieja que probablemente ya prescribió**, y él paga
   o reconoce la deuda sin saber que tenía una defensa.
2. El saldo que le reclaman incluye **intereses por encima de los topes legales**
   o intereses capitalizados sobre intereses. El capital original era una
   fracción del número que ve hoy.
3. Sigue figurando como deudor en informes crediticios **después de que venció el
   plazo legal de archivo** de ese dato, y eso le cierra el acceso al crédito, al
   alquiler y a veces al empleo.
4. Le trabaron un **embargo de sueldo por encima del tope legal**, o le tocaron
   una cuenta sueldo que es intangible, y se quedó sin con qué vivir.

Detectar esto hoy requiere un abogado que revise papel por papel. Eso cuesta más
que la deuda de la mayoría de nuestros usuarios.

## 2. Audiencia

| Audiencia | Qué obtiene |
| --- | --- |
| **Cliente deudor** | El diagnóstico traducido a lenguaje llano: qué le reclaman de más y qué se puede hacer. |
| **Abogado** | El fundamento técnico con citas normativas y supuestos, para decidir la estrategia y redactar la presentación. |
| **Operador de negociación** | Los argumentos concretos para sentarse a negociar con el acreedor. |
| **Administrador** | El tablero de parámetros normativos, para mantenerlos al día cuando cambia una ley o un valor de referencia. |

## 3. Resultado esperado

Dada la información de una deuda, el sistema devuelve —de forma determinista,
auditable y citada— qué le están reclamando de más al deudor y con qué
fundamento normativo, marcando explícitamente qué requiere confirmación de un
abogado matriculado.

## 4. Recorrido del usuario

1. La deuda ya está cargada en el sistema (por la feature 007 o a mano).
2. El sistema evalúa esa deuda contra los cinco análisis del motor.
3. Devuelve un conjunto de **hallazgos**. Cada hallazgo tiene: qué se detectó, el
   impacto económico estimado, el fundamento normativo con su cita, los supuestos
   que se usaron para llegar ahí, y su nivel de certeza.
4. El cliente ve los hallazgos traducidos, con la aclaración de que son
   estimaciones sujetas a confirmación profesional.
5. El abogado ve los mismos hallazgos con el detalle técnico y puede confirmar,
   rechazar o corregir cada uno. Su decisión queda registrada.
6. Los hallazgos confirmados alimentan la estrategia de negociación y los
   documentos legales.

## 5. Criterios de aceptación

### Análisis A — Prescripción liberatoria

```gherkin
CA-01  Dada una deuda con fecha de exigibilidad conocida y un plazo de
       prescripción aplicable según su tipo de obligación
       Cuando se la evalúa en una fecha posterior al vencimiento de ese plazo
       Y no hay hechos interruptivos ni suspensivos registrados
       Entonces el motor devuelve estado PRESUNTAMENTE_PRESCRIPTA, la fecha
       estimada de prescripción, la norma citada y la lista de supuestos usados

CA-02  Dada la misma deuda evaluada antes del vencimiento del plazo
       Cuando faltan más días que el umbral de alerta configurado
       Entonces devuelve estado VIGENTE con los días restantes

CA-03  Dada la misma deuda evaluada dentro del umbral de alerta
       Entonces devuelve estado PROXIMA_A_PRESCRIBIR con los días restantes

CA-04  Dada una deuda con un hecho interruptivo registrado (reconocimiento de
       deuda, pago parcial o demanda judicial notificada)
       Cuando se la evalúa
       Entonces el cómputo del plazo se reinicia desde la fecha de ese hecho,
       y el resultado nombra el hecho que produjo la interrupción

CA-05  Dada una deuda con un hecho suspensivo registrado
       Cuando se la evalúa
       Entonces el plazo se extiende por la duración de la suspensión, sin
       reiniciarse, y el resultado lo explicita

CA-06  Dada una deuda con varios hechos interruptivos
       Cuando se la evalúa
       Entonces se computa desde el más reciente

CA-07  Dada una deuda sin fecha de exigibilidad conocida
       Cuando se la evalúa
       Entonces devuelve estado INDETERMINABLE nombrando exactamente qué dato
       falta, y NO devuelve una estimación

CA-08  Dado cualquier resultado del análisis de prescripción            [v2]
       Entonces nunca afirma que la deuda "está prescripta": usa
       "presuntamente", y marca el resultado como sujeto a confirmación de
       abogado matriculado
       Y advierte que la prescripción debe oponerse como defensa y no opera
       de oficio
       Y advierte explícitamente que un pago parcial, un reconocimiento de
       deuda o la firma de un plan INTERRUMPEN el plazo y hacen perder la
       defensa
       [Defecto D-21: la v1 omitía el efecto interruptivo, que es el
        mecanismo concreto por el que el cliente se hace daño]

CA-33  Dada una deuda a la que podrían aplicarse dos regímenes de
       prescripción distintos
       Cuando se la evalúa
       Entonces devuelve ambos, indica cuál aplica según la regla de
       desempate configurada y su fundamento, y NO elige en silencio
       [Defecto D-12]

CA-34  Dada una interpelación fehaciente ya computada como hecho suspensivo
       Cuando se registra una segunda interpelación por la misma obligación
       Entonces no vuelve a suspender el plazo, y el resultado lo explicita
       [Defecto D-11]
```

### Análisis B — Topes de intereses y capitalización

```gherkin
CA-09  Dada una deuda del régimen general cuya tasa de interés punitorio      [v2]
       resulta desproporcionada respecto de la compensatoria
       Cuando se la evalúa
       Entonces devuelve un hallazgo rotulado "posible exceso sujeto a
       control judicial", NUNCA "exceso del tope legal", porque en el régimen
       general no hay tope automático sino facultad de morigeración judicial
       Y cita la norma que habilita esa morigeración
       [Condición C-04: el lenguaje de exceso legal queda reservado a los
        regímenes que efectivamente tienen tope vigente a la fecha del hecho]

CA-10  Dada una deuda de tarjeta de crédito cuya tasa compensatoria supera    [v2]
       el tope del régimen especial de tarjetas vigente a la fecha del hecho
       Entonces devuelve el hallazgo de ese régimen, distinto del general
       Y aplica la base de cálculo que corresponde según el emisor sea
       entidad bancaria o no bancaria, porque el tope se mide contra bases
       distintas en cada caso
       Y si el tipo de emisor no está informado, devuelve INDETERMINABLE
       nombrando ese dato
       [Defecto D-13]

CA-35  Dada una deuda de tarjeta con hecho posterior a la entrada en vigor
       del DNU 70/2023, que sustituyó el artículo de la Ley 25.065 que
       contenía el tope de punitorios
       Cuando se la evalúa
       Entonces NO emite hallazgo de exceso de punitorios, sino
       INDETERMINABLE con el fundamento, hasta que el parámetro de ese
       período esté ratificado por un profesional
       Y para hechos anteriores a esa fecha aplica el tope que estaba vigente
       entonces, conforme CA-29
       [Condición C-05. El estado del DNU puede cambiar durante la vida del
        producto; el parámetro tiene vigencia desde/hasta precisamente por eso]

CA-36  Dada una deuda de tarjeta en la que el titular efectuó el pago mínimo
       en los períodos correspondientes
       Cuando se la evalúa
       Entonces devuelve un hallazgo de improcedencia de los intereses
       punitorios sobre esos períodos, con su fundamento
       [Defecto D-14]

CA-37  Dada una operación de crédito para consumo en la que no consta que se
       haya informado la tasa efectiva anual, el costo financiero total o la
       cantidad de cuotas
       Cuando se la evalúa
       Entonces devuelve un hallazgo de posible incumplimiento del deber de
       información en operaciones de crédito, con su fundamento
       [Defecto D-15]

CA-11  Dada una deuda cuyo detalle de composición evidencia capitalización de
       intereses con una frecuencia mayor a la permitida
       Entonces devuelve un hallazgo de capitalización indebida con el monto
       estimado del efecto

CA-12  Dada una deuda con su composición informada (capital, intereses
       compensatorios, punitorios, gastos)
       Cuando se solicita la recomposición
       Entonces devuelve el saldo recalculado aplicando los topes, la diferencia
       contra el saldo reclamado, y el detalle de cada ajuste aplicado

CA-13  Dada una deuda sin detalle de composición
       Cuando se la evalúa
       Entonces devuelve INDETERMINABLE y genera la recomendación de intimar al
       acreedor a informar la composición, en lugar de estimar a ciegas
```

### Análisis C — Plazos de archivo de información crediticia

```gherkin
CA-14  Dado un incumplimiento informado en un registro determinado desde     [v2]
       una fecha determinada
       Cuando se lo evalúa después de vencido el plazo máximo de archivo
       configurado PARA ESE REGISTRO
       Y el parámetro de fecha de inicio del cómputo está ratificado por un
       profesional
       Entonces devuelve estado CADUCADO, la fecha en que caducó, la norma
       citada, y el fundamento listo para reclamar la supresión del dato

CA-38  Dado un dato informado en la Central de Deudores del BCRA y el mismo
       dato informado en un bureau privado
       Cuando se los evalúa
       Entonces se aplican parámetros y fundamentos distintos a cada
       registro, porque sus regímenes de permanencia son distintos, y el
       resultado identifica de qué registro habla
       [Defecto D-16]

CA-39  Dado que el parámetro de fecha de inicio del cómputo del plazo de
       archivo NO está ratificado por un profesional
       Cuando se evalúa cualquier dato
       Entonces el análisis C devuelve INDETERMINABLE y NO emite CADUCADO,
       cualquiera sea la antigüedad del dato
       [Condición C-06: la ley fija el plazo pero no desde qué fecha se
        cuenta, y la diferencia entre criterios es de años]

CA-15  Dada una obligación que fue cancelada o extinguida en una fecha
       Cuando se la evalúa
       Entonces aplica el plazo abreviado computado desde esa fecha, y no el
       plazo general

CA-16  Dado un dato aún dentro del plazo de archivo
       Entonces devuelve estado VIGENTE con la fecha exacta en que caducará

CA-17  Dado un dato cuya caducidad ocurrirá dentro del umbral de alerta
       Entonces devuelve PROXIMO_A_CADUCAR, para poder anticipar la gestión
```

### Análisis D — Embargabilidad de haberes

```gherkin
CA-18  Dada una remuneración neta menor o igual al salario mínimo vigente   [v2]
       A LA FECHA DEL HECHO evaluado, no a la fecha de hoy
       Cuando se calcula el monto embargable
       Entonces devuelve cero, con la cita de la norma de inembargabilidad
       [Defecto D-24, para ser consistente con CA-29]

CA-19  Dada una remuneración neta dentro del primer tramo por encima del salario
       mínimo
       Entonces devuelve el porcentaje del tramo aplicado sobre el excedente del
       mínimo, no sobre el total

CA-20  Dada una remuneración neta en el tramo superior
       Entonces aplica el porcentaje mayor sobre el excedente, y el resultado
       detalla el cálculo tramo por tramo

CA-21  Dado un embargo trabado cuyo monto mensual supera el máximo calculado
       Entonces devuelve un hallazgo con el exceso mensual, el exceso acumulado
       y el fundamento para pedir la readecuación

CA-22  Dada una cuenta bancaria identificada como cuenta sueldo
       Cuando se evalúa una afectación sobre ella
       Entonces devuelve un hallazgo de intangibilidad con su fundamento

CA-40  Dado un embargo cuya causa es una obligación alimentaria
       Cuando se evalúa su procedencia
       Entonces aplica el régimen propio de esa causa y NO los topes
       generales, y si ese régimen no está parametrizado devuelve
       INDETERMINABLE
       [Defecto D-17: con los topes generales el motor reportaría un exceso
        falso sobre un embargo legítimo]

CA-41  Dado un ingreso que es haber previsional y no remuneración
       Cuando se calcula el monto embargable
       Entonces aplica el régimen de embargabilidad propio de los haberes
       previsionales, y si no está parametrizado devuelve INDETERMINABLE
       [Defecto D-19: parte sustancial de la audiencia cobra jubilación]

CA-42  Dada una indemnización de origen laboral
       Cuando se evalúa una afectación sobre ella
       Entonces devuelve el hallazgo de inembargabilidad que corresponda a su
       régimen
       [Defecto D-18]
```

### Análisis E — Límites de honorarios y comisión

```gherkin
CA-23  Dado un pacto de cuota litis propuesto y una comisión de éxito de   [v2]
       la plataforma sobre el mismo resultado económico
       Cuando se los evalúa
       Entonces el límite arancelario se aplica ÚNICAMENTE al honorario del
       abogado, y la comisión de plataforma se valida contra su propio tope
       contractual, por separado
       Y el motor informa ambos máximos admisibles de forma diferenciada
       [Decisión de G1: topes separados. Computar la comisión dentro del tope
        arancelario la trataría como si fuera honorario, tensionando la
        prohibición de partición de honorarios — constitución #10]

CA-43  Dado un caso en jurisdicción nacional, federal, Buenos Aires, Ciudad
       Autónoma de Buenos Aires, Córdoba o Santa Fe
       Entonces aplica el límite arancelario de esa jurisdicción
       [Decisión 004-D: cobertura ampliada. Cada jurisdicción agregada suma
        un juego de parámetros a ratificar antes de G4]

CA-44  Dada la combinación de honorario del abogado y comisión de plataforma
       Cuando su suma supera el porcentaje configurado del beneficio neto
       estimado del cliente
       Entonces el motor emite una alerta de compromiso interno y la
       operación requiere autorización expresa, aunque cada componente
       respete su tope individual
       [Regla de protección del cliente acordada junto con la decisión de
        topes separados — constitución #1]

CA-24  Dado un caso de materia laboral
       Entonces se aplica el límite diferenciado de esa materia, no el general

CA-25  Dado un caso en una jurisdicción provincial con ley arancelaria propia
       cargada en los parámetros
       Entonces se aplica el límite de esa jurisdicción

CA-26  Dado un caso en una jurisdicción sin parámetros cargados
       Entonces devuelve INDETERMINABLE y no aplica el límite nacional por
       defecto
```

### Transversales — Parámetros, citas y trazabilidad

```gherkin
CA-27  Dado cualquier resultado del motor
       Entonces incluye las normas citadas con artículo, la versión del conjunto
       de parámetros usado, y la fecha de evaluación

CA-28  Dado un parámetro normativo que aún no fue ratificado por un profesional
       Cuando se usa en una evaluación
       Entonces el resultado queda marcado como "pendiente de validación
       profesional" y esa marca se propaga a la interfaz

CA-29  Dado un parámetro normativo con vigencia desde una fecha
       Cuando se evalúa un hecho anterior a esa fecha
       Entonces se aplica el parámetro que estaba vigente a la fecha del hecho,
       no el actual

CA-30  Dado un cambio en el valor de un parámetro normativo
       Cuando se actualiza
       Entonces no requiere modificar ninguna función del motor

CA-31  Dada una misma entrada evaluada dos veces con la misma fecha de
       evaluación
       Entonces el resultado es idéntico (el motor es determinista y recibe la
       fecha como entrada, no la lee del reloj)

CA-32  Dado un hallazgo con impacto económico
       Entonces el monto se expresa en centavos enteros, con su moneda, y el
       redondeo favorece al cliente cuando la norma no dispone otra cosa

CA-58  Dado un parámetro con requiereValidacionProfesional en verdadero
       Cuando se lo intenta usar en una evaluación con entorno productivo
       Entonces la evaluación falla con un error explícito, sin posibilidad
       de anular el bloqueo por configuración
       [Decisión 004-A. La métrica "parámetros sin ratificar en producción"
        se mantiene en cero por construcción, no por disciplina]

CA-59  Dado un hallazgo que usó un valor de referencia variable (salario
       mínimo, tasa promedio)
       Entonces el resultado declara el valor usado, su fuente, su fecha de
       vigencia y la fecha en que fue activado por una persona
       Y un valor obtenido automáticamente que todavía no fue activado por
       una persona NO se usa en ninguna evaluación
       [Decisión 004-C y defecto D-25]

CA-60  Dado el contrato de entrada del motor
       Entonces no admite nombre, documento de identidad, clave tributaria ni
       domicilio del deudor: sólo identificadores opacos y los datos
       funcionalmente necesarios para el cálculo
       [Condición C-10, minimización — Ley 25.326 y constitución #5]

CA-61  Dado el impacto económico estimado que devuelve el motor
       Entonces nunca se usa como base del cálculo de la comisión de éxito,
       que se computa exclusivamente sobre resultado confirmado
       [Condición C-11 — constitución #1 y #8]

CA-62  Dada una deuda con hallazgo de prescripción y hallazgo de caducidad
       del archivo crediticio a la vez
       Entonces el resultado explicita que son cosas distintas: que un dato
       deje de poder informarse no extingue la deuda, y que una deuda
       presuntamente prescripta puede seguir informada legítimamente
       [Condición C-12: confundirlas lleva al cliente a decisiones erróneas]
```

### Salvaguardas frente al ejercicio profesional del derecho

Implementan las salvaguardas S-01 a S-10 del dictamen de cumplimiento, §4.2
(condición C-08). El criterio que las ordena: **el motor puede describir el
estado del mundo y las normas; no puede sustituir el juicio profesional sobre un
caso concreto ni dirigir la conducta procesal de una persona determinada.**

```gherkin
CA-45  Dada cualquier salida del motor
       Entonces no contiene ningún término de la lista de términos prohibidos
       del dictamen §3.8, y los estados del enumerado usan la forma
       presuntiva (PRESUNTAMENTE_PRESCRIPTA, nunca PRESCRIPTA)
       [S-01. Incluye corregir la inconsistencia de docs/03 — defecto D-22]

CA-46  Dado cualquier hallazgo emitido
       Entonces lleva requiereConfirmacionProfesional en verdadero hasta que
       un abogado matriculado lo confirme, y la marca se propaga hasta el
       contrato de salida
       [S-02]

CA-47  Dada la confirmación de un hallazgo por un abogado
       Entonces se registran matrícula, jurisdicción, identidad y fecha
       Y una confirmación sin matrícula registrada es rechazada
       [S-03 y defecto D-23, que la regla R-08 enunciaba sin criterio que lo
        verificara]

CA-48  Dadas las acciones sugeridas por el motor
       Entonces provienen de un catálogo cerrado y cada una declara su
       destinatario
       Y las únicas acciones dirigidas al cliente son consultar al abogado y
       no innovar sobre la deuda
       [S-04]

CA-49  Dado el texto de cualquier hallazgo
       Entonces corresponde a una plantilla identificada y versionada del
       catálogo; el motor no genera lenguaje libre sobre el caso
       [S-05]

CA-50  Dada cualquier salida que llega al cliente
       Entonces incluye el encabezado obligatorio del dictamen §3.0 y las
       advertencias específicas del §3.1 a §3.7 según el tipo de hallazgo,
       con los textos literales allí definidos
       [S-06 y condición C-07]

CA-51  Dado un hallazgo rechazado o corregido por un abogado
       Entonces la decisión del profesional prevalece sobre la del motor en
       todo lo que se muestre después, y el hallazgo rechazado no se presenta
       como vigente al cliente
       [S-07]

CA-52  Dado cualquiera de los cinco análisis, en una jurisdicción para la que
       no hay parámetros cargados
       Entonces devuelve INDETERMINABLE, sin aplicar por defecto los
       parámetros de otra jurisdicción
       [S-09, extendido a los cinco análisis y no sólo al análisis E]

CA-53  Dado un documento dirigido a un tercero que se apoya en un hallazgo
       Entonces no se genera ni se envía sin confirmación profesional previa
       registrada
       [S-10. Se implementa en las specs 014 y 015; acá queda como
        dependencia declarada]
```

### Visibilidad del hallazgo de prescripción

Implementan la decisión 004-B, opción B con sus cinco recaudos (condición
C-01). El riesgo que mitigan no es un cálculo errado: es la conducta que el
hallazgo induce en el cliente.

```gherkin
CA-54  Dada una deuda con hallazgo de prescripción todavía no confirmado por
       un abogado
       Entonces al cliente NO se le muestra el hallazgo
       Pero SÍ se le muestra, de inmediato y sin condición alguna, una
       advertencia preventiva sobre esa deuda: no reconocer la deuda, no
       firmar planes de pago y no hacer pagos parciales hasta hablar con el
       equipo
       [Recaudo B-1. Evita el daño sin revelar el hallazgo, que es
        exactamente lo que hay que lograr]

CA-55  Dado un hallazgo de prescripción pendiente de revisión profesional
       Cuando transcurre el plazo máximo configurado de revisión
       Entonces se escala automáticamente y queda registrado el
       incumplimiento del plazo
       [Recaudo B-2. Plazo propuesto: 10 días hábiles]

CA-56  Dada la advertencia preventiva de CA-54
       Entonces se entrega siempre, cualquiera sea el plan del cliente,
       incluido el plan gratuito, y no puede condicionarse a la contratación
       de ningún servicio
       [Recaudo B-3 y constitución #8. El diferimiento del hallazgo es
        profesional, nunca comercial]

CA-57  Dado un hallazgo de prescripción confirmado que se muestra al cliente
       Entonces se acompaña siempre de la acción recomendada concreta, nunca
       del hallazgo a secas
       [Recaudo B-5]
```

## 6. Reglas de negocio

| # | Regla | Fundamento |
| --- | --- | --- |
| R-01 | El motor nunca emite una conclusión jurídica definitiva. Todo resultado es una estimación fundada, sujeta a confirmación de abogado matriculado. | Constitución #6 y #11. Ejercicio profesional del derecho. |
| R-02 | Todo plazo, tope y porcentaje normativo es un parámetro con cita, vigencia desde/hasta y marca de validación profesional. Nunca una constante en el código. | Constitución #11. Las leyes cambian; el código no debería. |
| R-03 | El motor se aplica y se informa al cliente **aunque el hallazgo reduzca la base de comisión** de la plataforma. | Constitución #8. |
| R-04 | El tiempo es una entrada, no un efecto: la fecha de evaluación se pasa por parámetro. | Determinismo y auditabilidad: hay que poder reproducir qué dijo el sistema en una fecha pasada. |
| R-05 | Ante falta de datos, el motor devuelve INDETERMINABLE nombrando el dato faltante. Nunca completa con supuestos silenciosos. | Un número inventado en un reclamo legal destruye la credibilidad del caso. |
| R-06 | Cada hallazgo registra los supuestos que usó, de modo que si un supuesto era falso se puede reevaluar sin rehacer el análisis. | Auditabilidad. |
| R-07 | Los importes se manejan en centavos enteros con moneda explícita. | Constitución #14 y prácticas del proyecto. |
| R-08 | El abogado puede confirmar, rechazar o corregir un hallazgo, y esa decisión queda registrada con su matrícula y fecha. Su decisión prevalece sobre la del motor. | Responsabilidad profesional identificable. |
| R-09 | El motor describe el estado del mundo y cita normas. No sustituye el juicio profesional sobre un caso concreto ni dirige la conducta procesal de una persona determinada. | Ejercicio de la abogacía reservado a matriculados. Dictamen de cumplimiento §4.2. |
| R-10 | La advertencia preventiva sobre una deuda con posible prescripción es gratuita, inmediata e incondicional. Nunca puede quedar detrás de un plan pago. | Constitución #8. Recaudo B-3 de la decisión 004-B. |
| R-11 | El límite arancelario alcanza sólo al honorario del abogado. La comisión de plataforma tiene su propio tope contractual y se valida por separado. | Constitución #10: prohibición de partición de honorarios. Decisión de G1 sobre CA-23. |
| R-12 | Un parámetro sin ratificación profesional no puede usarse en producción, y el bloqueo no admite anulación por configuración. | Constitución #11. Condición C-02 y decisión 004-A. |
| R-13 | Un valor de referencia variable obtenido automáticamente no entra en vigor hasta que una persona lo activa. | Decisión 004-C. Un salario mínimo mal cargado altera el cálculo de toda la cartera. |
| R-14 | El motor no recibe datos identificatorios del deudor: opera sobre identificadores opacos. | Minimización, Ley 25.326. Condición C-10. |

## 7. Casos límite y errores

- Deuda en moneda extranjera: el motor debe operar sobre la moneda de origen y
  no convertir por su cuenta.
- Fecha de exigibilidad futura (dato mal cargado): error de validación, no
  cálculo.
- Fecha de hecho interruptivo anterior a la exigibilidad: se ignora y se informa
  la inconsistencia.
- Salario mínimo sin valor cargado para la fecha evaluada: INDETERMINABLE,
  nunca el último valor conocido en silencio.
- Tasas expresadas en distintas bases (nominal anual, efectiva anual, mensual):
  normalización explícita y documentada antes de comparar contra un tope.
- Deuda ya cancelada: los análisis A y B no aplican; C sí, con plazo abreviado.
- Múltiples hallazgos sobre la misma deuda: no se suman impactos que se
  superponen (un mismo peso reclamado de más no se cuenta dos veces).

## 8. Fuera de alcance

- **Persistencia**: el motor es una librería pura. Guardar hallazgos, versionar
  y exponerlos por API es de la feature **007** y del `dev-backend`.
- **Interfaz de usuario**: la traducción a lenguaje llano y las pantallas son de
  **007** y de `ux-expert`. Esta spec define el **contenido** del hallazgo, no
  su presentación.
- **Obtención de los datos**: BCRA, bureaus y carga asistida son **007**.
- **Redacción de los documentos legales** que usan estos hallazgos (carta
  documento, habeas data, denuncia) → **014** y **015**.
- **Cálculo de la comisión de éxito** propiamente dicho → **018**. Acá sólo el
  límite que interactúa con los honorarios del abogado.
- **El adaptador que obtiene** los valores de referencia de su fuente oficial y
  la pantalla de activación en el back-office → `dev-integraciones` y spec 022.
  Acá sólo se define que el motor exige un valor activado por una persona
  (CA-59).
- **Régimen concursal y de quiebra de personas humanas** → spec futura.

## 9. Decisiones — resueltas en G1

Las cuatro decisiones abiertas de la v1, más la que planteó el dictamen de
cumplimiento, fueron resueltas por el product owner. Quedan registradas en
`specs/REGISTRO-COMPUERTAS.md`, entradas 004 a 008.

| Decisión | Resolución | Dónde se implementa |
| --- | --- | --- |
| **004-A** — carga inicial de valores normativos | Estimaciones cargadas con marca de validación pendiente, más bloqueo duro por entorno. | CA-58, R-12 |
| **004-B** — visibilidad del hallazgo de prescripción | Opción B con los cinco recaudos: visible para abogado y operador; al cliente sólo tras confirmación profesional, pero con advertencia preventiva inmediata, gratuita e incondicional. | CA-54 a CA-57, R-10 |
| **004-C** — origen de los valores de referencia | Obtención automática, activación humana obligatoria. | CA-59, R-13 |
| **004-D** — alcance jurisdiccional de honorarios | Nacional y federal más Buenos Aires, CABA, Córdoba y Santa Fe. El resto, INDETERMINABLE. | CA-43, CA-52 |
| **CA-23** — cuota litis y comisión de plataforma | Topes separados, con compromiso interno sobre la suma. | CA-23, CA-44, R-11 |

### Condiciones del dictamen de cumplimiento

| Condición | Estado | Dónde |
| --- | --- | --- |
| C-01 resolver 004-B por B | **cumplida en G1** | CA-54 a CA-57 |
| C-02 bloqueo de producción para parámetros sin ratificar | **cumplida en G1**, se verifica en G5 | CA-58 |
| C-03 firma del estudio jurídico sobre la tabla de parámetros | **abierta — dependencia externa, límite G4** | fuera del alcance del equipo |
| C-04 reformular "exceso" en el régimen general | **cumplida en G1** | CA-09 |
| C-05 desdoblar el tope de punitorios por vigencia del DNU | **cumplida en G1** | CA-35 |
| C-06 separar registros y ratificar el inicio del cómputo | **cumplida en G1** | CA-14, CA-38, CA-39 |
| C-07 textos de advertencia como criterios testeados | **cumplida en G1** | CA-50 |
| C-08 salvaguardas S-01 a S-10 | **cumplida en G1** | CA-45 a CA-53 |
| C-09 decisión sobre CA-23 | **cumplida en G1** | CA-23, CA-44 |
| C-10 minimización del contrato de entrada | **cumplida en G1**, se verifica en G2 | CA-60 |
| C-11 comisión sobre resultado confirmado | **cumplida en G1** | CA-61 |
| C-12 regla de no-confusión | **cumplida en G1** | CA-62 |

**C-03 es la única condición que el equipo no puede cumplir por sí mismo.** Sin la
firma de un abogado matriculado sobre la tabla de parámetros del dictamen §5, el
motor no puede evaluar en producción aunque el código esté terminado y validado.
Es una dependencia externa y conviene iniciarla ahora, no en G4.

### Verificación documental

Doce textos normativos no pudieron leerse en fuente oficial durante la revisión.
Está en curso un encargo de verificación por fuentes alternativas, autorizado en
la entrada 006 del registro de compuertas. Su resultado se incorpora al dictamen
y al registro `specs/legal/verificacion-documental.md`. **Verificar el texto de
una norma no equivale a la ratificación profesional que exige C-03.**

## 10. Métricas de éxito

| Métrica | Objetivo |
| --- | --- |
| Deudas diagnosticadas con al menos un hallazgo accionable | referencia a establecer con el piloto |
| Hallazgos confirmados por abogado / hallazgos emitidos | mayor a 0,7 — mide si el motor acierta |
| Hallazgos rechazados por abogado por error del motor | menor a 0,05 — mide si el motor miente |
| Impacto económico de los hallazgos confirmados sobre el saldo reclamado | referencia a establecer |
| Cobertura de tests de los casos límite del motor | 100% de los criterios de aceptación |
| Parámetros normativos sin ratificación profesional al salir a producción | 0 |
| Hallazgos de prescripción revisados dentro del plazo máximo (CA-55) | mayor a 0,95 |
| Clientes con advertencia preventiva entregada sobre el total con hallazgo de prescripción pendiente | 1,00 — no admite excepción |
| Términos prohibidos detectados en salidas del motor (CA-45) | 0 |
