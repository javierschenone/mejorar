# ADR-018 — Valores de referencia variables: serie histórica, obtención automática y activación humana obligatoria

| Campo | Valor |
| --- | --- |
| Estado | PROPUESTO |
| Fecha | 2026-09-20 |
| Autor | arquitecto |
| Aprobado por | pendiente — G2, feature 004 |
| Spec de origen | `specs/004-motor-reglas-legales/spec.md` v3 (CA-59, CA-18, CA-29, R-13, §7) |
| Origen | Decisión humana **004-C**; defecto D-25; riesgo RL-13 del dictamen |
| Contrato | `specs/contratos/motor-reglas-legales.ts` §6 |

## Contexto

Hay valores que el motor necesita, que cambian **varias veces por año** y que no
son parámetros normativos en el sentido de ADR-010: el salario mínimo vital y
móvil, el promedio de tasas de préstamos personales que publica el BCRA, la tasa
que el propio emisor aplica a préstamos personales.

Se diferencian de los parámetros en tres cosas:

- **Cambian mucho más seguido.** Un plazo de prescripción dura décadas; el SMVM
  dura meses.
- **No se ratifican jurídicamente, se constatan.** No hay interpretación: hay una
  resolución que dice un número.
- **Un error acá afecta a toda la cartera de golpe.** Es el riesgo RL-13: un
  SMVM mal cargado desplaza el piso de inembargabilidad de cada cálculo del
  análisis D.

El product owner ya decidió (004-C): **obtención automática, activación humana
obligatoria**. Este ADR define la estructura que hace que esa decisión no se
pueda incumplir.

## Decisión

### 1. No es un valor: es una serie histórica con vigencias

`TablaValoresReferencia` = lista de `TramoValorReferencia`, cada uno con
`clave`, `valor`, `vigenciaDesde`, `vigenciaHasta`, `fuente` y `activacion`.

`resolverValorReferencia` exige `FechaDelHecho` y **no tiene fallback**: si no
hay tramo vigente a esa fecha, devuelve `SIN_TRAMO_VIGENTE` y el análisis
produce INDETERMINABLE. Nunca el último valor conocido. Es el caso límite que la
spec §7 nombra explícitamente y que el dictamen valida como la mitigación
correcta de RL-13.

### 2. La activación humana es **estructural**, no un campo que se revisa

`TramoValorReferencia.activacion` es de tipo `ActivacionHumana` —operador y
fecha— y **no es anulable**. No es `ActivacionHumana | null`.

Consecuencia: un valor obtenido automáticamente y todavía no activado **no se
puede representar con este tipo**. No es que el motor lo rechace: es que no
puede llegar al motor. CA-59 y R-13 se cumplen porque el estado prohibido no
existe en el modelo.

La cola de valores pendientes de activación es un problema de la feature 022 y
del `database-engineer`, con su propio tipo. No entra acá.

### 3. La fuente viaja con el valor y sale en el resultado

`FuenteOficial` = organismo, identificación del acto (número de resolución o de
comunicación), URL y fecha de obtención. `UsoValorReferencia` reproduce todo eso
—valor, vigencia, fuente y activación— dentro del hallazgo.

CA-59 pide que el resultado *declare el valor usado, su fuente, su fecha de
vigencia y la fecha en que fue activado por una persona*. No es un requisito de
auditoría interna: es lo que un abogado va a tener que poner en un escrito para
justificar de dónde salió el número.

### 4. Tabla separada del catálogo normativo, con versión propia

Comparten mecánica (tramos con vigencia, resolución por fecha del hecho) pero
tienen ciclos de vida distintos: el catálogo cambia cuando cambia una ley y se
ratifica profesionalmente; la tabla cambia cada pocos meses y se activa
operativamente. Mezclarlos obligaría a re-ratificar el catálogo entero cada vez
que sube el salario mínimo.

`Trazabilidad` lleva las dos versiones por separado, así que la reproducción de
un resultado pasado no se pierde nada.

### 5. El adaptador de obtención queda fuera de esta feature

El §8 de la spec lo dice: el adaptador que trae el valor de su fuente oficial y
la pantalla de activación son de `dev-integraciones` y de la spec 022. Acá sólo
queda declarado que el motor exige un valor ya activado, y —por el criterio 3
del mandato del arquitecto— que ese adaptador tendrá puerto, mock determinista y
adaptador HTTP, de modo que el sistema completo corra sin credenciales.

## Alternativas consideradas

| Alternativa | A favor | En contra | Por qué no |
| --- | --- | --- | --- |
| Meterlos en el catálogo normativo como un parámetro más | Un solo mecanismo, menos tipos | Obligaría a re-ratificar el catálogo cada vez que cambia el SMVM; confunde "constatar un número" con "interpretar una norma"; la ratificación profesional perdería significado por inflación de uso | Son dos ciclos de vida distintos y hay que separarlos |
| Obtención automática sin activación humana | Siempre al día, cero trabajo operativo | Un cambio de formato en la fuente, o una publicación preliminar, se propaga a toda la cartera sin que nadie mire | Descartada por el product owner en la decisión 004-C |
| Carga manual sin obtención automática | Control total | El operador tipea un número de una resolución: es exactamente donde se cuela el error de un dígito, y el sistema no tiene con qué contrastarlo | Peor que la anterior: el error humano sin red |
| `activacion: ActivacionHumana \| null` con validación en el motor | Permite representar la cola de pendientes con el mismo tipo | Reintroduce el estado prohibido y lo deja depender de una validación que alguien puede saltear | La cola de pendientes es otro problema y merece otro tipo |
| Último valor conocido cuando falta el del período | Nunca devuelve INDETERMINABLE; mejor experiencia | Calcularía el piso de inembargabilidad de 2021 con el SMVM de 2026: el hallazgo sería falso y perjudicial | Prohibido explícitamente por el §7 de la spec |
| Interpolar o proyectar valores faltantes | Cobertura completa de la serie | Inventar un salario mínimo que ninguna resolución fijó | Es la definición de número inventado (R-05) |

## Consecuencias

**Positivas**

- CA-59 y R-13 se cumplen por construcción: el estado "obtenido y no activado"
  no es representable en la frontera del motor.
- RL-13 acotado: un valor mal cargado exige que una persona identificada lo haya
  activado, y esa activación queda registrada y viaja en cada hallazgo que lo
  usó. Se puede hacer la lista exacta de resultados afectados.
- La serie histórica permite recalcular casos viejos correctamente.

**Negativas**

- **Hay una dependencia operativa permanente**: si nadie activa el SMVM nuevo,
  el análisis D devuelve INDETERMINABLE para los hechos del período nuevo. Es lo
  correcto y es una obligación operativa real; necesita alerta anticipada (spec
  022, `cicd`).
- La serie histórica del promedio de tasas del BCRA es larga y de granularidad
  mensual: es la parte del contexto que más puede crecer. Hay que medirla contra
  el presupuesto de memoria de §6 del plan.
- `TASA_PROPIO_EMISOR_PRESTAMOS_PERSONALES` es un dato **por emisor** que el
  sistema probablemente no tenga (dictamen §5.B). En la práctica, CA-10 va a
  devolver INDETERMINABLE seguido para emisores bancarios. Es honesto y es
  incómodo; se mitiga con la acción sugerida `VERIFICAR_TIPO_DE_EMISOR` y con la
  intimación al acreedor, no relajando la regla.

**Qué cierra**

- Valores de referencia incrustados en el código o en el catálogo normativo.
- Uso de un valor no activado por una persona.

## Cómo se revierte

- **Unificar con el catálogo normativo**: costo bajo-medio; los tipos son casi
  iguales. Se haría sólo si la separación resultara ceremonia vacía, cosa que
  hoy no parece.
- **Permitir valores no activados en entornos no productivos**: sería un brazo
  nuevo del tipo y un riesgo de que se filtre a producción. Si el equipo lo
  necesitara para probar, la salida correcta es una tabla de prueba con
  activaciones ficticias de un operador de prueba, que no requiere cambiar nada.
