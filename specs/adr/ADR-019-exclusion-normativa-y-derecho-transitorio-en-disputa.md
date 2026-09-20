# ADR-019 — Exclusión normativa y derecho transitorio en disputa, distintos de un dato faltante

| Campo | Valor |
| --- | --- |
| Estado | PROPUESTO |
| Fecha | 2026-09-20 |
| Autor | arquitecto |
| Aprobado por | pendiente — G2, feature 004 |
| Spec de origen | `specs/004-motor-reglas-legales/spec.md` **v3**, §0bis (CA-41, CA-63, CA-64) |
| Origen | Ronda de verificación documental del 2026-09-20 (`specs/legal/verificacion-documental.md`) |
| Contrato | `specs/contratos/motor-reglas-legales.ts` §3 |
| Relación | Refina ADR-012, que estableció INDETERMINABLE como resultado de primera clase |

## Contexto

La revisión 1 del contrato modelaba INDETERMINABLE con una sola forma: una lista
de `DatoFaltante`, con un motivo de un enumerado. Servía para los ocho casos de
la v2, que eran todos variantes de lo mismo: **algo que no tenemos**.

La v3 de la spec introduce dos casos que **no** son eso, y no se los puede
meter en la misma estructura sin mentir:

**CA-63 — materia excluida.** Fuentes corroboradas atribuyen al art. 6 inc. c)
de la Ley 27.423 una **prohibición** de pactar cuota litis en materias
previsionales, alimentarias y con intervención de personas menores de edad, y no
un tope del 20% como suponía la revisión anterior del dictamen. El dictamen
degradó ese valor a `[!] CONTRADICCIÓN ABIERTA — NO CARGAR` y dijo con todas las
letras: *"si es prohibición, un motor que devuelva 'hasta el 20%' estaría
avalando un pacto nulo, sobre el grupo que la norma quiso proteger: sería el
peor error posible del análisis E."*

**CA-64 — régimen transitorio en disputa.** La Ley 27.802 (BO 06/03/2026)
modificó el art. 277 de la LCT y hay derecho transitorio discutido sobre los
juicios en trámite anteriores a marzo de 2026. El dictamen es explícito: *"la
regla de vigencia por fecha del hecho (CA-29) no alcanza para este parámetro"*.
CA-29 resuelve **sucesión** de normas; no resuelve **controversia sobre la
sucesión**.

Y un tercer caso relacionado, **CA-41**: la Ley 24.241 art. 14 inc. c) haría
inembargables las prestaciones previsionales, salvo alimentos y litisexpensas.
Eso no es "otra escala de porcentajes": es otra naturaleza de protección.
Aplicarle el Decreto 484/87 a un jubilado, dice el dictamen, *"no le inventaría
un derecho: se lo ocultaría"* — constitución #8.

Si las tres se colapsan en "falta un dato", el sistema le dice al cliente
*"nos falta: {dato}"* cuando el problema es otro, y el equipo trata de conseguir
un dato que no va a destrabar nada.

## Decisión

### 1. Tres clases de indeterminación, no una

`CausaDeIndeterminacion` es una unión discriminada de exactamente tres brazos:

| Clase | Qué significa | Cómo se destraba | Quién actúa |
| --- | --- | --- | --- |
| `FALTA_DE_DATO` | No tenemos el dato, el parámetro o el valor de referencia. | Consiguiendo el dato o cargando el parámetro. | Cliente, operador o administrador |
| `MATERIA_EXCLUIDA` | La materia está fuera de lo que el análisis puede evaluar, porque la norma podría prohibir el acto valorado. | **Sólo** con dictamen del estudio jurídico. Más datos no cambian nada. | Estudio jurídico |
| `REGIMEN_EN_DISPUTA` | El dato está y el parámetro está, pero se discute cuál de dos regímenes rige el hecho. | Con dictamen sobre el derecho transitorio, o con jurisprudencia firme. | Estudio jurídico |

`Indeterminable` lleva `clase` (la causa dominante), `causas` (al menos una) y la
plantilla que corresponde a esa clase: `RESULTADO_INDETERMINABLE`,
`RESULTADO_INDETERMINABLE_MATERIA_EXCLUIDA` o
`RESULTADO_INDETERMINABLE_REGIMEN_EN_DISPUTA`. **Nunca se le dice a alguien "nos
falta un dato" cuando el problema no es ése.**

### 2. Orden de precedencia estricto

`MATERIA_EXCLUIDA` > `REGIMEN_EN_DISPUTA` > `FALTA_DE_DATO`.

No es estético. Si la materia está excluida, pedirle al cliente el dato que
falta sería mandarlo a juntar documentación para un acto que quizá no
corresponde celebrar. La exclusión gana y se comunica primero.

### 3. La exclusión es fail-safe: **no** requiere ratificación previa

Es el punto más delicado de este ADR y contrasta a propósito con ADR-013.

Un **tope** sin ratificar no se puede usar en producción, porque afirmar "podés
cobrar hasta el 30%" con un parámetro no verificado es afirmar de más.

Una **exclusión** sin ratificar **sí** se aplica, porque su efecto es dejar de
evaluar, y dejar de evaluar nunca daña al cliente. Por eso el valor del
parámetro `cuotaLitis.materiasExcluidas` admite
`claseExclusion: 'PROHIBICION_EN_DISPUTA'`, que se carga hoy mismo con las
materias del dictamen y **ya basta** para que el análisis E no evalúe esas
materias, sin esperar a C-03.

La regla general que se deriva: **cuando la incertidumbre jurídica se resuelve
callando, el parámetro opera sin ratificación; cuando se resuelve afirmando,
no.** El bloqueo de ADR-013 protege contra afirmaciones sin respaldo, no contra
silencios.

Misma lógica en CA-41: `embargo.haberesPrevisionales` se carga con
`REGIMEN_DE_PROTECCION_DEL_INGRESO / INEMBARGABLE_POR_REGLA` y sus causas
exceptuadas. Si ese parámetro no está cargado, el análisis D sobre un haber
previsional es INDETERMINABLE; lo que **nunca** puede pasar es que caiga por
defecto al Decreto 484/87.

### 4. La exclusión se evalúa antes que nada en el análisis

El orden dentro del análisis E es: materia excluida → régimen en disputa →
resolución de parámetros → cálculo. Como `ResultadoAnalisisE` sólo tiene dos
brazos —`EVALUADO` con los dos límites diferenciados, e `Indeterminable`— y el
brazo `EVALUADO` no existe cuando hay exclusión, **es imposible que CA-23 y
CA-44 se apliquen sobre una materia excluida**: no hay forma de construir el
valor. CA-63 no depende de que alguien recuerde la regla.

### 5. `INEMBARGABLE_POR_REGLA` es un estado propio, no un cálculo que da cero

`ResultadoAnalisisD` gana un brazo `INEMBARGABLE_POR_REGLA` sin
`CalculoEmbargabilidad`. Modelarlo como `EVALUADO` con
`montoEmbargableMaximo: 0` sería decir "te apliqué la escala salarial y dio
cero", que es una afirmación distinta y falsa, y que además se rompería sola
cuando el ingreso superara el mínimo.

### 6. La materia y el tipo de ingreso son entrada declarada, no inferencia

`PropuestaHonorarios.materia`, `PropuestaHonorarios.intervieneMenorConRepresentacion`
y `DatosIngreso.tipo` los declara quien llama. El motor no infiere que un caso
es previsional. Ambos quedan registrados como supuestos
(`MATERIA_DEL_CASO_EVALUADA`, `TIPO_DE_INGRESO_EVALUADO`) para que, si el
supuesto era falso, se reevalúe sin rehacer el análisis (R-06).

Se agrega `PropuestaHonorarios.fechaDelHechoGenerador`: sin fecha del hecho no
se puede resolver ni el tope arancelario aplicable (CA-29) ni la ventana de
transición del art. 277 (CA-64). Su ausencia es `FALTA_DE_DATO`.

## Alternativas consideradas

| Alternativa | A favor | En contra | Por qué no |
| --- | --- | --- | --- |
| Un motivo más en `MotivoIndeterminable` (`MATERIA_EXCLUIDA`, `REGIMEN_EN_DISPUTA`) | Cambio de una línea, sin tocar la estructura | Los tres casos quedarían dentro de un tipo llamado `DatoFaltante`, con `campo: null`, `parametro: null`: un registro lleno de nulos que miente sobre lo que representa. Y la plantilla seguiría siendo la de "nos falta un dato" | Es la simplificación que parece razonable y que borra justamente la distinción que la v3 vino a introducir |
| Tratar la materia excluida como `NO_APLICA` | Ya existe ese estado; "no corresponde evaluar" suena igual | `NO_APLICA` significa que la pregunta no tiene sentido (una deuda extinguida no prescribe). Acá la pregunta tiene todo el sentido y la respuesta puede ser "eso no se puede pactar", que es información valiosa que hay que escalar al estudio | Confundirlos haría desaparecer el caso del radar en vez de escalarlo |
| Tratar la materia excluida como `ErrorMotor` | Duele, se ve en la observabilidad | No es un defecto de nadie: el caso es legítimo y frecuente (una jubilada con un reclamo previsional es exactamente nuestra audiencia) | Un error por cada caso legítimo entrena al equipo a ignorar errores |
| Emitir el tope del 20% con advertencia fuerte | Da un número útil en la mayoría de los casos | Si es prohibición, el motor estaría avalando un pacto de nulidad absoluta sobre el grupo protegido. El dictamen lo llama "el peor error posible del análisis E" | Prohibido por CA-63. No hay discusión posible |
| Esperar a C-03 para cargar la exclusión | Consistente con ADR-013 | Dejaría el análisis E evaluando materias protegidas en todos los entornos hasta que el estudio firme, que es el período de mayor riesgo | Confunde el bloqueo de afirmaciones con el bloqueo de silencios. Ver punto 3 |
| Resolver CA-64 con una tercera vigencia de parámetro | Reutiliza el mecanismo de ADR-010 | Una tercera vigencia implica elegir un régimen para la ventana de transición, que es exactamente lo que está en disputa. Sería inventar la resolución de una controversia | CA-64 lo prohíbe textualmente: "el motor NO resuelve solo" |
| Que el motor infiera la materia a partir del tipo de obligación | Menos carga para el llamador | Una inferencia errada en la dirección "no es previsional" desactiva la protección del grupo más vulnerable, en silencio | Las protecciones no se activan por inferencia |

## Consecuencias

**Positivas**

- CA-63 es inviolable por estructura: no hay valor construible que aplique CA-23
  o CA-44 a una materia excluida.
- CA-64 se comunica como lo que es —una controversia jurídica abierta— y no como
  un dato faltante que el cliente podría "conseguir".
- El equipo puede medir por separado cuántas evaluaciones se traban por falta de
  datos (accionable por producto), cuántas por materia excluida y cuántas por
  régimen en disputa (accionables **sólo** por el estudio jurídico). Esas dos
  últimas métricas son el argumento para priorizar C-03.
- Cuando el estudio dictamine, el cambio es de datos:
  `PROHIBICION_EN_DISPUTA` → `PROHIBICION_NORMATIVA_VIGENTE`, o
  `REGLA_DE_TRANSICION.estado: 'RESUELTA'` con el régimen que rige. Cero código.

**Negativas**

- Es un tipo más y una regla de precedencia más que recordar. Se mitiga con el
  invariante testeado y con la correspondencia obligatoria clase ↔ plantilla.
- **El análisis E queda inoperante para materias previsionales, alimentarias y
  con menores por tiempo indeterminado**, y esa es una porción relevante de la
  audiencia del producto. Es la consecuencia correcta y tiene impacto comercial:
  queda como **escalamiento E-5** del plan.
- La `claseExclusion` `PROHIBICION_EN_DISPUTA` es un estado que el sistema puede
  arrastrar años si nadie lo dictamina. Necesita aparecer en el tablero del
  administrador como deuda pendiente, no enterrado en una tabla.

**Qué cierra**

- Cualquier camino por el que el análisis E produzca un tope en una materia
  excluida.
- Cualquier caída por defecto del régimen previsional al Decreto 484/87.
- Resolver una controversia de derecho transitorio dentro del motor.

## Cómo se revierte

- **Si el estudio dictamina que el inc. c) es un tope del 20% y no una
  prohibición**: se carga `cuotaLitis.materiasExcluidas` con lista vacía y se
  agrega la clave del tope como un parámetro normal. Cambio de datos más una
  clave de catálogo; no toca la estructura. Media jornada, y pasa por G2 por ser
  clave nueva.
- **Colapsar las tres clases en una sola**: barato de escribir y caro de
  entender; volvería a producir el defecto que la v3 corrigió. Exige ADR de
  reemplazo.
- **Agregar una cuarta clase de indeterminación**: aditivo, con su plantilla y
  su lugar en la precedencia. Es cambio de contrato y vuelve a G2.
