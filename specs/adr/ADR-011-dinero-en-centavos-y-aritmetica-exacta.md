# ADR-011 — Dinero en centavos enteros (`bigint`), aritmética racional exacta y redondeo por rol

| Campo | Valor |
| --- | --- |
| Estado | PROPUESTO |
| Fecha | 2026-09-20 |
| Autor | arquitecto |
| Aprobado por | pendiente — G2, feature 004 |
| Spec de origen | `specs/004-motor-reglas-legales/spec.md` v3 (CA-12, CA-19, CA-20, CA-32, R-07) |
| Contrato | `specs/contratos/motor-reglas-legales.ts` §2 |
| Relación | Resuelve la **decisión abierta** que ADR-003 §4 dejó marcada y difirió a este rango |

## Contexto

ADR-003 dejó escrito: *"la aritmética de dinero afecta a `shared` y es un riesgo
real en cálculos de quita, intereses y comisiones. No se decide en 001; su ADR
sale del rango 010-019. Hasta que exista ese ADR, `shared` no implementa ningún
cálculo monetario."* Este ADR levanta ese bloqueo.

Las fuerzas concretas:

- Los cálculos del motor son **encadenados**: normalizar una tasa, aplicarla a
  un saldo, prorratear por días, comparar contra un tope, restar del reclamado.
  El error de punto flotante no se queda quieto: se acumula.
- El resultado se compara contra un **umbral legal**. Un hallazgo de "exceso"
  que aparece o desaparece según el último centavo es un hallazgo que el
  acreedor va a impugnar y va a tener razón.
- CA-31 exige **determinismo exacto**: dos corridas de la misma entrada dan el
  mismo número, bit a bit, hoy y en cuatro años, en Node de la API y en el
  motor JavaScript del teléfono (ADR-003 obliga a que sea el mismo código en los
  tres clientes).
- CA-32 exige que el redondeo **favorezca al cliente cuando la norma no dispone
  otra cosa**, lo que implica que hay que saber, para cada monto, en qué
  dirección está "a favor".
- Hay montos en ARS, USD y EUR y el §7 de la spec prohíbe convertir.

## Decisión

### 1. Los montos son enteros de centavos en `bigint`, con moneda explícita

`Centavos = bigint` con marca nominal; `Monto = { centavos, moneda }`. Nunca
`number`, nunca punto flotante, nunca un monto sin moneda. No se suman ni se
comparan montos de monedas distintas: es error de entrada.

`bigint` y no `number` aunque los importes de esta cartera entren holgados en el
entero seguro de IEEE-754: lo que no entra son los **productos intermedios** de
una tasa aplicada a un saldo con precisión suficiente, y un `number` que
silenciosamente pierde precisión es peor que un `bigint` incómodo.

### 2. La aritmética intermedia es racional exacta, no decimal

`Racional = { n: bigint, d: bigint }`. Tasas, prorrateos, proporciones y tramos
se calculan como fracciones exactas. Un 25% es `{n:1n, d:4n}`, no `0.25`.
Un tercio es `{n:1n, d:3n}`, no `0.3333`.

**El redondeo ocurre exactamente una vez**: al construir el `Monto` final que
sale en el resultado. No hay redondeos intermedios y por lo tanto no hay
acumulación de error. Esta es la razón por la que se eligió racional y no
decimal de precisión fija: con decimal hay que decidir cuántos dígitos, y esa
decisión reaparece en cada operación.

### 3. El redondeo se decide por el **rol** del monto, no por el sitio de llamada

`redondear(valor, moneda, rol, reglaNormativa)` con
`RolDelMonto ∈ {PISO_DE_PROTECCION, TECHO_DE_AFECTACION,
TECHO_DE_COBRO_AL_CLIENTE, RECLAMO_ESTIMADO, SEGUN_NORMA}`.

"Favorecer al cliente" no es una dirección: depende de qué representa el número.
Un piso de protección del ingreso se redondea **hacia arriba**; el máximo que un
tercero puede retenerle, **hacia abajo**; el máximo que se le puede cobrar,
**hacia abajo**. Si cada análisis decidiera su sentido, CA-32 sería una
convención que se olvida una vez y nadie nota.

`SEGUN_NORMA` gana sobre todo lo anterior cuando la norma fija criterio, y
entonces `ReglaRedondeoNormativa` viene con su cita.

El redondeo aplicado **viaja en el resultado** (`RedondeoAplicado`): rol,
sentido, unidad y fundamento. Un abogado tiene que poder ver por qué el número
terminó en ese centavo.

### 4. `RECLAMO_ESTIMADO` redondea hacia abajo

Es la decisión menos obvia del ADR y hay dos razones convergentes: sobreestimar
un reclamo destruye la credibilidad del caso (riesgo RL-07 del dictamen) e infla
la base de comisión (RL-09, CA-61). Queda **escalado** como E-1 en el plan por
si el product owner prefiere el criterio contrario.

### 5. Las tasas llevan su base y se normalizan explícitamente

`Tasa = { valor: Racional, base: 'TNA'|'TEA'|'MENSUAL'|'DIARIA' }`. Comparar una
TNA contra un tope expresado en TEA produce hallazgos falsos (§7 de la spec y
dictamen §5.B). La convención de conversión (`ACTUAL_365`, `ACTUAL_360`,
`TREINTA_360`) es **parámetro del catálogo**, no una constante, y queda
registrada como supuesto en el hallazgo.

El dictamen marca que esto no es una cuestión jurídica sino actuarial y que
requiere criterio de un contador. Queda escalado como **E-2** en el plan.

## Alternativas consideradas

| Alternativa | A favor | En contra | Por qué no |
| --- | --- | --- | --- |
| `number` (punto flotante) | Nativo, rápido, cero fricción | `0.1 + 0.2 !== 0.3`; el error se acumula en cadenas largas; comparar contra un umbral legal se vuelve inestable | Es el defecto clásico de todo sistema financiero mal hecho. No se discute |
| `decimal.js` / `big.js` / `dinero.js` | Maduras, API cómoda, decimal exacto | Una dependencia más en el dominio, que ADR-003 restringe a `zod`; precisión configurable global que es un estado compartido; la división sigue necesitando una decisión de precisión | `bigint` es estándar del lenguaje y no agrega dependencia. Si la aritmética racional propia resultara pesada de escribir, se reconsidera con ADR de reemplazo |
| Centavos en `number` entero | Sin dependencias, suficiente para los importes de esta cartera | Los productos intermedios (saldo × tasa × días) desbordan el entero seguro sin aviso | El modo de falla es silencioso, que es el peor |
| Decimal de precisión fija propio (escala 6, por ejemplo) | Más simple de leer que un racional | Hay que elegir la escala y defenderla; la división introduce error donde el racional no lo tiene | El racional no obliga a elegir nada hasta el final |
| Redondeo global "siempre a favor del cliente" sin rol | Una sola regla, fácil de enunciar | No es implementable: "a favor" tiene sentido opuesto según el monto sea un piso o un techo | Suena bien y no significa nada |
| Redondeo decidido en cada análisis | Máxima libertad | CA-32 pasa a depender de que cinco análisis recuerden la misma regla | Es exactamente la clase de regla que se rompe en la sexta feature |

## Consecuencias

**Positivas**

- Determinismo exacto y reproducible en los tres clientes, sin depender de la
  implementación de punto flotante del dispositivo.
- CA-32 queda verificable con un test por rol, no por análisis.
- El redondeo es auditable: viaja en la salida con su fundamento.

**Negativas**

- `bigint` no serializa a JSON de forma nativa. El borde HTTP tiene que
  serializar `Centavos` como **cadena decimal**, nunca como número: obligación
  de frontera F-06 del plan, y test de ida y vuelta a cargo de `tester`.
- Hay que escribir la aritmética racional (suma, producto, comparación,
  simplificación). Son unas pocas funciones puras y muy testeables, pero son
  código propio que alguien mantiene.
- `bigint` es más lento que `number`. Irrelevante para el volumen de este motor
  (presupuesto de 50 ms por evaluación, §6 del plan).
- El racional sin simplificar crece: hay que normalizar por máximo común
  divisor en cada operación o los denominadores explotan en cadenas largas.

**Qué cierra**

- Cualquier monto expresado como `number` en el contrato, en la API o en la base
  de datos.
- Conversión de moneda dentro del motor (§7 de la spec).

## Cómo se revierte

- **Cambiar `bigint` por una librería decimal**: costo medio (2-3 días). El tipo
  `Centavos` y el `Monto` son nominales y aparecen en toda la superficie, pero
  el cambio es mecánico y el compilador lo guía. La serialización del borde HTTP
  ya es cadena, así que los consumidores no se enteran.
- **Cambiar el sentido de redondeo de un rol**: trivial, es una tabla en una
  función. Un test por rol lo fija.
- **Volver a `number`**: no se revierte. Sería un defecto, no un cambio de
  opinión.
