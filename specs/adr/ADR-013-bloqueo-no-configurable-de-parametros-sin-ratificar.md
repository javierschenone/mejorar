# ADR-013 — Bloqueo no configurable de parámetros sin ratificar en producción

| Campo | Valor |
| --- | --- |
| Estado | PROPUESTO |
| Fecha | 2026-09-20 |
| Autor | arquitecto |
| Aprobado por | pendiente — G2, feature 004 |
| Spec de origen | `specs/004-motor-reglas-legales/spec.md` v3 (CA-58, CA-28, R-12) |
| Origen de la decisión | Decisión humana **004-A**, `REGISTRO-COMPUERTAS.md`; condición **C-02** del dictamen |
| Contrato | `specs/contratos/motor-reglas-legales.ts` §9 |

## Contexto

La decisión 004-A ya está tomada por el product owner: los parámetros se cargan
con estimaciones marcadas como pendientes de validación, **más un bloqueo duro
en producción**. El dictamen lo convirtió en la condición C-02 y CA-58 lo
escribió sin ambigüedad: *"la evaluación falla con un error explícito, **sin
posibilidad de anular el bloqueo por configuración**"*.

Lo que queda por decidir es arquitectónico: **dónde vive el bloqueo y cómo se
garantiza que nadie lo apague a las tres de la mañana** cuando el catálogo no
esté ratificado y haya un cliente esperando.

El contexto real que hace esto necesario: hoy, el 100% de las filas de la tabla
del dictamen §5 está sin ratificar, y C-03 —la firma del estudio jurídico— es la
única condición que el equipo no puede cumplir por sí mismo. O sea: durante un
tiempo indeterminado, el sistema va a estar completo y sin poder evaluar en
producción. La presión para poner una bandera de escape va a ser real.

## Decisión

**El bloqueo no es configurable porque no existe ningún lugar donde
configurarlo.**

1. `ContextoEvaluacion` tiene exactamente cinco campos: `entorno`,
   `fechaDeEvaluacion`, `catalogo`, `valoresReferencia`, `plantillas`. **No hay
   un sexto campo de opciones**, ni ahora ni después sin pasar por G2.
2. `politicaParametroSinRatificar(entorno)` es una **función total sobre el
   enumerado de entorno** que devuelve `'BLOQUEA'` para `'PRODUCCION'` siempre.
   No toma un segundo argumento. No hay nada que pasarle.
3. El motor **no lee `process.env`** (ADR-016). El `entorno` se lo provee
   `apps/api` desde una constante de despliegue. Consecuencia buscada: no se
   puede cambiar el comportamiento del motor con una variable de entorno en un
   contenedor.
4. El bloqueo produce `ErrorMotor` con clase
   `PARAMETRO_SIN_RATIFICAR_EN_PRODUCCION`, no INDETERMINABLE. Es deliberado:
   INDETERMINABLE es una respuesta al usuario, y esto es un **defecto
   operativo** que tiene que doler, aparecer en la observabilidad y despertar a
   alguien. Un INDETERMINABLE se confundiría con el caso normal de falta de
   datos y nadie repararía nada.
5. Fuera de producción no se bloquea, pero **no se oculta**: el hallazgo lleva
   `usaParametrosSinRatificar: true`, la salida lleva la advertencia de conjunto
   `PARAMETROS_SIN_RATIFICAR_EN_LA_EVALUACION` y la plantilla
   `PARAMETRO_SIN_RATIFICACION_PROFESIONAL` (CA-28). El desarrollador y el
   probador ven todo el tiempo lo que en producción sería imposible.
6. **La ratificación no se puede falsificar por estructura**:
   `EstadoRatificacion` es una unión discriminada y el brazo `'RATIFICADO'`
   exige `RatificacionProfesional` completa —matrícula, jurisdicción, fecha,
   referencia al documento firmado— (ADR-010). No hay booleano que poner en
   `true`.
7. La métrica de la spec §10 ("parámetros sin ratificar en producción: 0") se
   mantiene **por construcción**, no por disciplina, que es exactamente lo que
   dice el comentario de CA-58.

### Verificación

`tester` escribe, como mínimo: parámetro sin ratificar + entorno `PRODUCCION` →
`ErrorMotor` con esa clase; el mismo caso en `DESARROLLO` → evaluación con
marca; y una **prueba de la API pública del motor** que falla si aparece
cualquier parámetro nuevo en `ContextoEvaluacion` o un segundo argumento en
`politicaParametroSinRatificar` (test de forma, no de comportamiento). Esa
tercera prueba es la que protege la decisión de la erosión.

## Alternativas consideradas

| Alternativa | A favor | En contra | Por qué no |
| --- | --- | --- | --- |
| Bandera de configuración `permitirSinRatificar` con valor por defecto seguro | Escape de emergencia; flexible | CA-58 la prohíbe textualmente; una bandera de emergencia se usa y después no se saca | Es la alternativa que la decisión 004-A descartó. Está cerrada |
| Variable de entorno leída por el motor | Cero código, patrón conocido | El motor dejaría de ser puro (ADR-016); se cambia sin pasar por nadie; no queda registro | El mecanismo de cambio no deja rastro, que es lo contrario de lo que pide la constitución #11 |
| Bloqueo en la capa de API (guard de NestJS), no en el dominio | Separa política de cálculo | El dominio queda evaluable sin bloqueo desde la app móvil o desde un script; la garantía depende de que todos los llamadores pasen por el guard | El motor es la única frontera por la que pasan todos. El bloqueo va donde no se puede esquivar |
| Bloqueo en la carga del catálogo: no se permite publicar un catálogo con parámetros sin ratificar | Falla temprano, el motor queda simple | Impide el flujo real de trabajo: cargar la estimación del dictamen y ratificarla fila por fila. Y el catálogo se publica una vez; la evaluación ocurre un millón de veces | Deseable **además**, no en lugar de. Queda como validación complementaria del back-office (spec 022) |
| Bloqueo por análisis: sólo los análisis que usan el parámetro sin ratificar fallan | Máximo aprovechamiento de lo que sí está ratificado | Es lo que efectivamente ocurre —cada análisis resuelve sus propios parámetros—, pero el resultado no es INDETERMINABLE sino error, y un error parcial es difícil de comunicar | Se adopta la parte buena: el error identifica la clave del parámetro implicado en `referencia`. La evaluación completa falla |
| INDETERMINABLE en vez de error | No rompe la experiencia del usuario | Enmascara un defecto operativo como si fuera falta de datos del cliente; nadie repara lo que no duele | El usuario no debería llegar nunca a este caso: si llega, es un problema del equipo, no suyo |

## Consecuencias

**Positivas**

- C-02 y la métrica de cero se cumplen por estructura.
- La presión operativa de "destrabalo por hoy" no tiene dónde apoyarse: no hay
  perilla. La única salida es ratificar el parámetro, que es lo que queremos que
  pase.
- Fuera de producción el equipo trabaja con el catálogo estimado sin fricción.

**Negativas**

- **El producto no puede salir a producción hasta que C-03 esté cumplida**, ni
  siquiera parcialmente, ni siquiera para el análisis más inocuo. Esto es una
  consecuencia buscada, pero hay que decirla en voz alta en G2 porque tiene
  impacto de cronograma y no es una decisión del arquitecto: **escalamiento E-4
  del plan**.
- Una emergencia legítima (por ejemplo, un parámetro ratificado cuya
  ratificación vence por `fechaProximaRevision`) deja el sistema sin evaluar en
  producción hasta que un profesional actúe. Se mitiga con alerta anticipada
  sobre `fechaProximaRevision`, a cargo de `cicd` y la spec 022, no con un
  escape.

**Qué cierra**

- Cualquier parámetro de configuración en la API pública del motor.
- Lectura de entorno, banderas o configuración desde el dominio.

## Cómo se revierte

- **Agregar la bandera de escape**: técnicamente trivial (un campo y una rama),
  y por eso mismo el test de forma de la API pública existe: el cambio no puede
  entrar sin que el test lo señale. Exige decisión humana registrada, ADR de
  reemplazo y probablemente dictamen nuevo de `compliance-legal`, porque
  revierte la decisión 004-A y la condición C-02.
- **Mover el bloqueo a la carga del catálogo además del motor**: aditivo y
  barato. Recomendado para más adelante.
