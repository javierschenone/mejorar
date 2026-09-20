# Spec 004 — Motor de reglas legales argentinas

| Campo | Valor |
| --- | --- |
| Estado | EN REVISIÓN (G1) |
| Autor | orquestador |
| Revisor legal | `compliance-legal` → `specs/004-motor-reglas-legales/cumplimiento.md` |
| Compuerta | G1 |
| Principios de la constitución involucrados | #1, #6, #8, #11, #14 |

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

CA-08  Dado cualquier resultado del análisis de prescripción
       Entonces nunca afirma que la deuda "está prescripta": usa
       "presuntamente", incluye la advertencia de que la prescripción debe
       oponerse como defensa y no opera de oficio, y marca el resultado como
       sujeto a confirmación de abogado matriculado
```

### Análisis B — Topes de intereses y capitalización

```gherkin
CA-09  Dada una deuda cuya tasa de interés punitorio supera el tope configurado
       respecto de la tasa compensatoria
       Cuando se la evalúa
       Entonces devuelve un hallazgo de exceso, con el tope aplicable, la tasa
       reclamada, la norma citada y el monto estimado reclamado de más

CA-10  Dada una deuda de tarjeta de crédito cuya tasa compensatoria supera el
       tope del régimen especial de tarjetas
       Entonces devuelve el hallazgo correspondiente a ese régimen, distinto del
       régimen general

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
CA-14  Dado un incumplimiento informado desde una fecha determinada
       Cuando se lo evalúa después de vencido el plazo máximo de archivo
       configurado
       Entonces devuelve estado CADUCADO, la fecha en que caducó, la norma
       citada, y el fundamento listo para reclamar la supresión del dato

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
CA-18  Dada una remuneración neta menor o igual al salario mínimo vigente
       Cuando se calcula el monto embargable
       Entonces devuelve cero, con la cita de la norma de inembargabilidad

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
```

### Análisis E — Límites de honorarios y comisión

```gherkin
CA-23  Dado un pacto de cuota litis propuesto y una comisión de éxito de la
       plataforma sobre el mismo resultado económico
       Cuando la suma de ambos supera el límite aplicable
       Entonces el motor rechaza la combinación e informa el máximo admisible
       para cada componente

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
| R-08 | El abogado puede confirmar, rechazar o corregir un hallazgo, y esa decisión queda registrada con su matrícula y fecha. | Responsabilidad profesional identificable. |

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
- **Actualización automática de valores de referencia** (salario mínimo, tasas
  del BCRA) desde una fuente externa → se evalúa en la decisión 004-C.
- **Régimen concursal y de quiebra de personas humanas** → spec futura.

## 9. Decisiones pendientes

> Una spec con decisiones abiertas no pasa G1. Estas cuatro requieren definición
> humana.

**`[NECESITA DECISIÓN 004-A: carga inicial de los valores normativos]`**
Los parámetros (plazos de prescripción, topes de interés, plazos de archivo,
tramos de embargabilidad, límites de cuota litis) todavía no fueron ratificados
por un estudio jurídico.
- **A)** Cargar la mejor estimación del equipo, marcada
  `requiereValidacionProfesional: true`, y bloquear el pasaje a producción hasta
  la ratificación. Permite implementar y testear ya.
- **B)** Dejar los parámetros vacíos y que el motor devuelva INDETERMINABLE hasta
  que el estudio los cargue. Más prolijo, pero no se puede validar nada.
- *Recomendación: **A**, con un test que verifique que ningún parámetro sin
  ratificar puede usarse cuando el entorno es producción.*

**`[NECESITA DECISIÓN 004-B: a quién se le muestra el análisis de prescripción]`**
Es el hallazgo de mayor impacto y el de mayor riesgo. Si el cliente lee
"presuntamente prescripta" y deja de pagar por su cuenta sin oponer la defensa en
tiempo y forma, puede terminar peor: un reconocimiento de deuda o un pago parcial
interrumpe el plazo, y la prescripción no opera de oficio.
- **A)** Visible para todos desde el primer momento, con advertencias fuertes.
- **B)** Visible para abogado y operador; al cliente se le muestra recién cuando
  un abogado lo confirmó, y siempre acompañado de la acción recomendada.
- **C)** Visible para el cliente como "hay algo para revisar en esta deuda", sin
  detalle, hasta la confirmación profesional.
- *Recomendación: **B**. Es coherente con la constitución #1 y #6, y evita que el
  producto induzca al usuario a una conducta que lo perjudique.*

**`[NECESITA DECISIÓN 004-C: origen de los valores de referencia variables]`**
El salario mínimo y las tasas de referencia cambian varias veces al año y el
resultado del motor depende de ellos.
- **A)** Carga manual desde el back-office, con historial de vigencias.
- **B)** Integración automática con la fuente oficial, con validación humana
  antes de activar el nuevo valor.
- **C)** Sólo automática.
- *Recomendación: **B**. Automatizar la obtención pero nunca activar un valor sin
  aprobación humana: un salario mínimo mal cargado cambia todos los cálculos de
  embargabilidad de la cartera.*

**`[NECESITA DECISIÓN 004-D: alcance jurisdiccional del análisis de honorarios]`**
Cada provincia tiene su propia ley arancelaria.
- **A)** Sólo jurisdicción nacional y federal en la primera versión; el resto
  devuelve INDETERMINABLE (CA-26).
- **B)** Nacional/federal + las tres o cuatro provincias de mayor volumen
  esperado, a definir cuáles.
- **C)** Todas las jurisdicciones desde el inicio.
- *Recomendación: **A**. Es la opción honesta: INDETERMINABLE explícito es mejor
  que aplicar un límite equivocado, y la estructura de parámetros permite sumar
  provincias sin tocar la lógica.*

## 10. Métricas de éxito

| Métrica | Objetivo |
| --- | --- |
| Deudas diagnosticadas con al menos un hallazgo accionable | referencia a establecer con el piloto |
| Hallazgos confirmados por abogado / hallazgos emitidos | mayor a 0,7 — mide si el motor acierta |
| Hallazgos rechazados por abogado por error del motor | menor a 0,05 — mide si el motor miente |
| Impacto económico de los hallazgos confirmados sobre el saldo reclamado | referencia a establecer |
| Cobertura de tests de los casos límite del motor | 100% de los criterios de aceptación |
| Parámetros normativos sin ratificación profesional al salir a producción | 0 |
