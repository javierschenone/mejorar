# ADR-014 — Catálogo cerrado de plantillas y vocabulario controlado en vez de generación de texto

| Campo | Valor |
| --- | --- |
| Estado | PROPUESTO |
| Fecha | 2026-09-20 |
| Autor | arquitecto |
| Aprobado por | pendiente — G2, feature 004 |
| Spec de origen | `specs/004-motor-reglas-legales/spec.md` v3 (CA-45, CA-48, CA-49, CA-50, CA-53, R-09) |
| Origen | Salvaguardas **S-01, S-04, S-05, S-06** del dictamen §4.2; condiciones **C-07** y **C-08** |
| Contrato | `specs/contratos/motor-reglas-legales.ts` §7 |

## Contexto

El motor produce afirmaciones jurídicas sobre el caso de una persona concreta.
El dictamen de cumplimiento (§4.2, riesgo RL-02, calificado **crítico**) traza
la línea así: *el sistema puede describir el estado del mundo y las normas; no
puede sustituir el juicio profesional sobre un caso concreto ni dirigir la
conducta procesal de una persona determinada.*

Tres exigencias concretas se derivan de ahí y todas son testeables:

- **CA-49 / S-05**: cada texto proviene de una plantilla identificada y
  versionada. El motor no genera lenguaje libre sobre el caso.
- **CA-50 / S-06 / C-07**: hay textos obligatorios **literales** —el encabezado
  del dictamen §3.0 y las advertencias §3.1 a §3.7— que deben acompañar a cada
  tipo de hallazgo, en el mismo bloque visual.
- **CA-45 / S-01**: ninguna salida contiene un término de la lista prohibida del
  dictamen §3.8 ("tu deuda está prescripta", "te sacamos del Veraz",
  "garantizamos", "recuperás $X"...), y los estados usan forma presuntiva.

Y una tentación que conviene nombrar: el repositorio tiene instaladas
herramientas de IA para el desarrollo (`CLAUDE.md` §6). La frontera de OmniRoute
ya prohíbe que el producto en ejecución enrute por ahí. Este ADR cierra la
puerta por el otro lado: **no hay generación de lenguaje natural en el camino
del producto**, con ningún modelo, de ningún proveedor.

## Decisión

### 1. Todo texto sale de un catálogo cerrado, versionado y validable

`CatalogoPlantillas` = lista de `PlantillaTexto`, cada una con `id`
(`IdPlantilla`, unión cerrada de literales), `version`, `destinatarios`, `texto`
literal con marcadores `{nombre}`, `obligatoriaJuntoA`, `revisadaPorUx` y
`ratificadaPorProfesional`. Más la lista de `terminosProhibidos` del §3.8.

El motor **referencia** plantillas (`ReferenciaPlantilla`); no las renderiza. El
texto final lo arma quien presenta: la web, la app o el generador de documentos.
Consecuencia buscada: el motor no manipula cadenas dirigidas a una persona.

`validarCatalogoPlantillas` verifica que ninguna plantilla contenga un término
prohibido, que las referencias cruzadas de `obligatoriaJuntoA` existan, y que
toda plantilla con destinatario `CLIENTE` esté revisada por UX. Una plantilla
referenciada que no existe es `ErrorMotor` de clase `PLANTILLA_INEXISTENTE`, no
un texto vacío.

### 2. Las variables de plantilla son valores tipados, **nunca cadenas libres**

`ValorDePlantilla` admite `MONTO`, `FECHA`, `DIAS`, `PROPORCION`, `CITA` y
`TERMINO`. **No hay un brazo `string`.** Esa ausencia es la decisión: sin ella,
el catálogo cerrado sería decorativo, porque cualquier texto podría entrar por
una variable.

Todo sustantivo que el motor necesite nombrar —"bureau privado", "haber
previsional", "causa alimentaria", "materia laboral"— pasa por
`ClaveTerminoControlado`, un vocabulario cerrado. El texto de cada término lo
escribe `ux-expert` una vez y se traduce igual en todas partes.

### 3. Las acciones sugeridas también son un catálogo cerrado, con destinatario

`AccionSugerida` es una unión discriminada por destinatario. Al **cliente** sólo
se le pueden sugerir dos acciones —`CONSULTAR_AL_ABOGADO` y
`NO_INNOVAR_SOBRE_LA_DEUDA`— porque `IdAccionCliente` tiene exactamente dos
valores (CA-48, S-04). El resto de las acciones (`IdAccionProfesional`) sólo
puede dirigirse a abogado, operador o administrador: el tipo del brazo es
`Exclude<Destinatario, 'CLIENTE'>`.

Que el motor le indique a un cliente una conducta procesal no es un defecto que
haya que evitar: es un programa que no compila.

### 4. Las advertencias obligatorias viajan en el hallazgo

`Hallazgo.advertenciasObligatorias` y `SalidaEvaluacion.encabezadoObligatorio`
son campos **requeridos**, no opcionales. Quien presenta no puede "olvidarse" de
la advertencia del §3.1: le llega junto al hallazgo y la relación
`obligatoriaJuntoA` la hace verificable por test.

La **forma** de presentarla —mismo bloque visual, mismo cuerpo, no en una nota
al pie ni en un modal que se cierra, como exige el dictamen §3— es del
`ux-expert` y de la spec 007. El contrato garantiza que el dato esté; no
garantiza que se muestre bien.

### 5. Ninguna generación de lenguaje natural en el producto

El producto no llama a ningún modelo de lenguaje para producir texto que llegue
a un cliente, a un acreedor o a un juzgado. Si alguna vez se propusiera, vuelve
a compuerta con dictamen específico.

## Alternativas consideradas

| Alternativa | A favor | En contra | Por qué no |
| --- | --- | --- | --- |
| Generación de texto con un modelo de lenguaje | Explicaciones adaptadas al caso, lenguaje llano automático | No determinista (viola CA-31), no auditable, imposible garantizar que no aparezca un término prohibido, y el texto sería una afirmación jurídica nueva sobre un caso concreto | Viola S-05 y el núcleo de RL-02. No es una alternativa real en este dominio |
| Plantillas con interpolación de cadenas libres | Flexible, cubre casos nuevos sin tocar el catálogo | Un `string` en una variable reintroduce lenguaje libre por la puerta de atrás y el test de términos prohibidos no lo alcanza en tiempo de diseño | Es el agujero clásico del "catálogo cerrado" que no cierra nada |
| Plantillas en archivos de internacionalización (i18n) del frontend | Herramientas maduras, traductores cómodos | El texto obligatorio dejaría de ser parte del contrato: tres clientes podrían mostrar advertencias distintas, y el generador de documentos (014/015) no las tendría | Las advertencias son requisito normativo, no presentación. Viven en el contrato |
| Texto final renderizado por el motor | Un solo lugar que arma todo | El dominio pasaría a hacer presentación; y el mismo hallazgo necesita texto distinto para cliente y para abogado | La referencia a plantilla deja al motor fuera de la presentación sin perder control del contenido |
| Catálogo abierto validado sólo por test de términos prohibidos | Menos rigidez | Una lista negra no prueba que el texto sea correcto, sólo que no dice ciertas palabras. El dictamen exige textos **literales** aprobados | Lista negra y catálogo cerrado no son sustitutos: acá van los dos |
| Acciones sugeridas como texto libre para el abogado | El abogado es profesional, sabe leer | La frontera S-04 es por destinatario, y el motor no puede distinguir a quién termina llegando un texto que produjo libremente | El catálogo cerrado cuesta poco y elimina la discusión |

## Consecuencias

**Positivas**

- CA-45, CA-48, CA-49 y CA-50 se verifican con tests sobre estructura, no sobre
  redacción.
- Un cambio de redacción exigido por el estudio jurídico o por UX es una
  versión nueva de plantilla, sin tocar el motor.
- `ratificadaPorProfesional` y `revisadaPorUx` por plantilla dan la trazabilidad
  que pide C-07 al nivel del texto individual.

**Negativas**

- Cada hallazgo nuevo exige una plantilla nueva. Fricción deliberada: obliga a
  pensar qué se le dice a la persona antes de calcularlo.
- El catálogo cerrado no cubre matices del caso: los textos son necesariamente
  generales. Es el precio de no afirmar de más, y es lo que el dictamen quiere.
- Se agrega una dependencia de proceso: nada llega al cliente sin que
  `ux-expert` revise la plantilla y el estudio la ratifique.

**Qué cierra**

- Generación de lenguaje natural en el producto.
- Concatenación de cadenas sobre el caso dentro del motor.
- Acciones dirigidas al cliente más allá de las dos permitidas.

## Cómo se revierte

- **Agregar una plantilla o una versión**: aditivo, es el flujo normal.
- **Agregar un brazo `TEXTO_LIBRE` a `ValorDePlantilla`**: trivial de escribir y
  destruye la garantía completa. Exige ADR de reemplazo y dictamen nuevo de
  `compliance-legal`. Hay un test de forma sobre `ValorDePlantilla` para que el
  cambio no pase inadvertido.
- **Mover las plantillas a i18n del frontend**: costo medio y pérdida de
  garantía; no recomendado mientras el texto sea requisito normativo.
