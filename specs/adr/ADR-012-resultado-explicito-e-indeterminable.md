# ADR-012 — Resultado explícito sin excepciones, e INDETERMINABLE como valor de primera clase

| Campo | Valor |
| --- | --- |
| Estado | PROPUESTO |
| Fecha | 2026-09-20 |
| Autor | arquitecto |
| Aprobado por | pendiente — G2, feature 004 |
| Spec de origen | `specs/004-motor-reglas-legales/spec.md` v3 (CA-07, CA-13, CA-26, CA-35, CA-39, CA-40, CA-41, CA-52, CA-63, CA-64, R-05) |
| Contrato | `specs/contratos/motor-reglas-legales.ts` §3 |
| Relación | ADR-019 detalla las tres clases de indeterminación |

## Contexto

En este dominio hay **tres cosas distintas** que un motor tradicional mete en la
misma bolsa:

1. **Un defecto**: la entrada es inválida, el catálogo está mal armado, se
   intentó usar un parámetro sin ratificar en producción. Alguien tiene que
   arreglar algo.
2. **Una respuesta legítima que no es un número**: no se puede determinar el
   resultado con lo que hay. Nadie se equivocó; el mundo es así.
3. **Un resultado**: el hallazgo.

Meter la segunda en la primera —tratar "falta la fecha de exigibilidad" como un
error— empuja a quien consume el motor a una de dos conductas, ambas malas:
tragarse el error y mostrar una pantalla en blanco, o inventar un valor por
defecto para que "funcione". R-05 existe precisamente para prohibir la segunda:
*un número inventado en un reclamo legal destruye la credibilidad del caso*.

Además: el motor lo consumen la API, la web y la app móvil (ADR-003). Una
excepción que cruza tres empaquetadores distintos pierde su tipo por el camino.

## Decisión

### 1. El motor no lanza excepciones como flujo de control

Devuelve `Resultado<TValor, TError> = {ok:true, valor} | {ok:false, error}`. El
compilador obliga a mirar los dos casos. Una excepción que escape del motor es
un defecto del motor, no un modo de operación.

### 2. `ErrorMotor` es, por definición, un defecto — nunca "falta un dato"

`ClaseErrorMotor` tiene siete valores y todos son cosas que alguien debe
corregir: bloqueo de producción (CA-58), minimización vulnerada (CA-60), entrada
inválida, catálogo inválido, plantilla inexistente, valor de referencia sin
activación (CA-59), inconsistencia interna.

El comentario que encabeza el tipo en el contrato es normativo: *"Nunca es
'falta un dato': eso es INDETERMINABLE, que es un resultado legítimo."*

`ErrorMotor` tampoco lleva texto libre: lleva `codigo` estable,
`referencia` a un campo o clave, y un `DetalleError` con valores de plantilla.
Un mensaje de error que se muestra a alguien pasa por el catálogo de plantillas,
igual que todo lo demás (ADR-014).

### 3. INDETERMINABLE es un **estado del resultado**, no un error ni un vacío

`Indeterminable` es uno de los brazos de la unión de resultado de cada uno de
los cinco análisis. Lleva:

- `causas`: al menos una, y **nombra exactamente** qué pasa (invariante
  verificado por test: `causas.length >= 1`);
- `clase`: la clase de la causa dominante, con precedencia
  `MATERIA_EXCLUIDA > REGIMEN_EN_DISPUTA > FALTA_DE_DATO` (ADR-019);
- `plantilla`: el texto que corresponde a esa clase, del catálogo cerrado;
- `accionesSugeridas`: qué hacer, con destinatario declarado (CA-48);
- `trazabilidad`: versión de catálogo, de motor y fecha de evaluación. Un
  INDETERMINABLE es tan auditable como un hallazgo, porque también es una
  afirmación del sistema.

### 4. Un INDETERMINABLE parcial no contamina el resto

Los cinco análisis se resuelven de forma independiente y `SalidaEvaluacion` los
lleva por separado. Que falte el tipo de emisor de la tarjeta deja el análisis B
en INDETERMINABLE y no impide que el análisis A devuelva su hallazgo. El motor
devuelve `ErrorMotor` sólo cuando no puede producir **ninguna** salida.

### 5. `NO_APLICA` no es INDETERMINABLE

Una deuda extinguida no hace INDETERMINABLE al análisis A: lo hace `NO_APLICA`
con motivo `OBLIGACION_EXTINGUIDA` (§7 de la spec). "No corresponde evaluar
porque la pregunta no tiene sentido acá" y "no puedo determinarlo" son mensajes
distintos para el cliente.

## Alternativas consideradas

| Alternativa | A favor | En contra | Por qué no |
| --- | --- | --- | --- |
| Excepciones tipadas | Idiomático en NestJS; el camino feliz queda limpio | El tipo se pierde al cruzar el borde de empaquetado; invita a un `catch` genérico que convierte "falta un dato" en error 500; el compilador no obliga a tratarlas | Lo que hay que hacer difícil es justamente ignorar el caso no-feliz |
| `null` / `undefined` como "no sé" | Cero ceremonia | No dice **por qué** no sabe, que es la mitad del valor de CA-07; se confunde con "no hay hallazgos" | R-05 exige nombrar el dato faltante. `null` no nombra nada |
| Lista de errores vacía = todo bien | Común en validadores | Mezcla validación con resultado; no distingue defecto de indeterminación | Es la bolsa única que este ADR existe para evitar |
| INDETERMINABLE como hallazgo de tipo especial | Un solo tipo de salida, más uniforme | Un hallazgo tiene impacto económico, certeza, visibilidad y confirmación profesional; un INDETERMINABLE no tiene nada de eso y quedaría con media docena de campos en `null` | Los campos en `null` obligatorios son una invitación a leer basura |
| Librería de `Result` / `fp-ts` | Combinadores listos, menos plomería | Dependencia en el dominio que ADR-003 restringe; curva de lectura para quien audita el código, que puede ser un abogado o un actuario | La unión discriminada de TypeScript alcanza y se lee sin saber teoría de categorías |
| Un único INDETERMINABLE genérico, sin clases | Más simple | No distingue "falta un dato" de "no corresponde evaluar esta materia": ver ADR-019 | Es lo que la v3 de la spec vino a corregir |

## Consecuencias

**Positivas**

- Es imposible que el motor devuelva un número inventado: no hay camino de
  código que produzca un hallazgo sin los datos que lo sostienen.
- El consumidor no puede ignorar el caso no-feliz sin que el compilador
  proteste.
- INDETERMINABLE se puede medir: "cuántas evaluaciones terminaron sin
  determinar y por qué" es una métrica de producto que sale de la propia salida
  y le dice al equipo qué dato pedirle al cliente primero.

**Negativas**

- Más ceremonia en el llamador: cada análisis devuelve una unión que hay que
  discriminar. Es la incomodidad que compra la garantía.
- El borde HTTP tiene que traducir `Resultado` a códigos de estado y
  INDETERMINABLE a **200 con cuerpo**, no a 4xx: un INDETERMINABLE es una
  respuesta exitosa. Obligación de frontera F-05 del plan.
- La UI tiene que tratar INDETERMINABLE como un estado de primera clase con su
  propio diseño, no como un error. Dependencia declarada hacia `ux-expert` y la
  spec 007.

**Qué cierra**

- Valores por defecto ante datos faltantes, en cualquier punto del motor.
- `throw` dentro de `packages/shared/src/motor-legal`.

## Cómo se revierte

- **Envolver el `Resultado` en excepciones en el borde de la API**: trivial y
  aditivo, se hace en un interceptor de NestJS sin tocar el dominio. De hecho es
  lo esperable.
- **Volver a excepciones dentro del dominio**: costo alto (reescribe todas las
  firmas) y sin beneficio identificado. Exigiría ADR de reemplazo.
- **Agregar una clase nueva de indeterminación**: aditivo sobre
  `CausaDeIndeterminacion`, con su plantilla y su regla de precedencia. Es
  cambio de contrato y vuelve a G2. Pasó una vez ya, con la v3 de la spec.
