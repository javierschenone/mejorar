# ADR-010 — Catálogo normativo versionado con vigencias, inyectado al motor

| Campo | Valor |
| --- | --- |
| Estado | PROPUESTO |
| Fecha | 2026-09-20 |
| Autor | arquitecto |
| Aprobado por | pendiente — G2, feature 004 |
| Spec de origen | `specs/004-motor-reglas-legales/spec.md` v3 (CA-27 a CA-30, CA-35, CA-39, CA-52, R-02) |
| Contrato | `specs/contratos/motor-reglas-legales.ts` §5 |

## Contexto

El derecho argentino que este motor aplica cambia por ley, por decreto de
necesidad y urgencia, por comunicación del BCRA y por resolución de un consejo
salarial. En los seis meses previos a esta spec cambiaron por lo menos tres
cosas que el motor necesita: el art. 18 de la Ley 25.065 (DNU 70/2023), el art.
277 de la LCT (Ley 27.802) y el valor del SMVM, varias veces.

Tres exigencias se cruzan y son las que fuerzan la decisión:

1. **CA-29**: se aplica el parámetro vigente **a la fecha del hecho**, no el de
   hoy. Un embargo de 2021 se juzga con el SMVM de 2021.
2. **CA-31 + CA-27**: hay que poder reproducir, en 2030, exactamente qué dijo el
   sistema en 2026 sobre un caso, con qué normas y con qué valores.
3. **CA-30**: cambiar el valor de un parámetro no puede exigir tocar una función
   del motor, porque quien lo cambia es el administrador de back-office, no un
   desarrollador, y porque el cambio suele ser urgente.

A eso se suma que el dictamen de cumplimiento (§5) tiene hoy **47 filas de
parámetros y la mayoría dice `A DETERMINAR POR EL ESTUDIO`**. El catálogo no es
una tabla que se completa una vez: es un artefacto que va a estar
permanentemente a medio llenar.

## Decisión

El conjunto de parámetros normativos es un **catálogo inmutable, versionado y
con huella de contenido, que el motor recibe por parámetro** y nunca busca.

Concretamente:

1. **La unidad no es el parámetro: es el tramo de vigencia.** `TramoParametro` =
   `(clave, jurisdicción, valor, vigenciaDesde, vigenciaHasta, fundamento,
   ratificación, notaDeAlcance)`. Un parámetro "desdoblado por vigencia" —el
   tope de punitorios de tarjeta antes y después del DNU 70/2023 (CA-35)— son
   **dos tramos de la misma clave**, no dos claves. Nada en el motor sabe que
   ese parámetro en particular está desdoblado.
2. **Las claves son una unión cerrada de literales** (`ClaveParametro`). Una
   clave mal escrita es un error de compilación, no un INDETERMINABLE
   silencioso. Cambiar un **valor** no toca el tipo (CA-30); **agregar una
   clave** es cambio de contrato y vuelve a G2.
3. **Los valores son una unión discriminada cerrada** (`ValorParametro`), sin
   `any` ni `unknown`. Un plazo en años y una escala de embargabilidad no son
   "un número" y "una lista": son clases distintas con forma propia.
4. **La resolución exige `FechaDelHecho`**, que es un tipo nominal distinto de
   `FechaDeEvaluacion`. Pasar una donde va la otra no compila. Ese error —
   calcular con el SMVM de hoy un embargo de 2021— es exactamente el defecto
   D-24 y acá deja de poder ocurrir.
5. **`resolverParametro` no tiene ningún fallback.** Si no hay tramo vigente a
   la fecha del hecho, o no hay tramo para la jurisdicción, devuelve
   `SIN_TRAMO_VIGENTE` / `SIN_JURISDICCION` y el análisis produce
   INDETERMINABLE. No cae al tramo más reciente, no cae a la jurisdicción
   nacional (CA-52, S-09).
6. **La ratificación profesional es parte del dato, no un campo booleano al
   costado.** `EstadoRatificacion` es una unión discriminada: no existe forma de
   representar "ratificado" sin matrícula, jurisdicción, fecha y referencia al
   documento firmado (condición C-03). Para CA-39 hay además un tipo nominal
   `TramoRatificado` que sólo produce `exigirRatificado`, y el estado `CADUCADO`
   del análisis C **exige uno en su firma**: sin ratificación del `diesAQuo` no
   hay manera de construir un CADUCADO ni siquiera por error de programación.
7. **Reproducibilidad por cuatro valores**: `versionCatalogo` +
   `huellaContenido` + `fechaDeEvaluacion` + huella canónica de la entrada. Con
   eso y el `PuertoReproduccion`, cualquier resultado pasado se recalcula
   idéntico. La huella la calcula la infraestructura, no el motor.

El catálogo **no vive en el código**. Vive donde lo ponga el `database-engineer`
(ver `plan.md` §5, obligaciones de frontera F-01 a F-04) y se le entrega al
motor como un valor en memoria.

## Alternativas consideradas

| Alternativa | A favor | En contra | Por qué no |
| --- | --- | --- | --- |
| Constantes en el código del dominio | Simple, tipado, sin infraestructura | Cambiar el SMVM exige desplegar; no hay historia; no hay ratificación; no hay cita | Viola la constitución #11 y R-02 de frente. No es una opción |
| Archivos JSON versionados en el repositorio, cargados al iniciar | Versionado con git "gratis", revisable por PR | El administrador no edita el repositorio; un cambio urgente de SMVM requiere despliegue; la ratificación profesional no es un commit | Es la opción tentadora y falla en el punto que más importa: quién puede cambiarlo y con qué evidencia. Se reconsideraría si el back-office se demorara |
| Parámetro con **un** valor vigente + tabla de historia aparte | Lectura simple del caso normal | Dos representaciones de lo mismo que se desincronizan; CA-29 pasa a ser una consulta especial en vez del camino único | El caso "a la fecha del hecho" **es** el caso normal de este motor, no la excepción |
| Clave de parámetro como `string` libre | Flexible, agregar parámetros sin tocar tipos | Una clave mal escrita devuelve INDETERMINABLE en silencio y nadie se entera hasta que un cliente ve "no podemos analizar esto" | El costo de la flexibilidad lo paga el usuario final en forma de silencio inexplicable |
| El motor consulta el catálogo por sí mismo (repositorio inyectado, `async`) | Menos plomería en el llamador | Vuelve asíncrono y con E/S al dominio; rompe ADR-016 y el determinismo de CA-31; hace imposible auditar el dominio sin levantar infraestructura | Contradice el criterio 2 del mandato del arquitecto |
| Motor de reglas de terceros (json-rules-engine, DMN, Drools) | Reglas editables sin desplegar | Dependencia grande, semántica propia que hay que aprender, y el problema real no es la lógica de las reglas —que es poca— sino la trazabilidad normativa, que ninguno resuelve | "Aburrido gana". Agrega superficie sin resolver lo difícil |

## Consecuencias

**Positivas**

- CA-29 y CA-30 son propiedades de la estructura, no disciplina del programador.
- La tabla del dictamen §5 tiene una correspondencia 1 a 1 con filas del
  catálogo: el estudio jurídico firma un documento que se carga tal cual.
- Un cambio de ley entra al sistema como un tramo nuevo con `vigenciaDesde`, sin
  tocar código y sin invalidar los resultados anteriores.
- Auditar "qué decía el sistema el 14/03/2026" es una consulta, no una
  arqueología.

**Negativas**

- Todo resultado depende de que alguien mantenga el catálogo. Un catálogo vacío
  produce un motor que sólo sabe decir INDETERMINABLE. Es el comportamiento
  correcto y es también la peor experiencia posible; lo mitiga el tablero del
  administrador (spec 007/022), no esta decisión.
- El catálogo completo viaja en memoria en cada evaluación. Con ~50 claves y sus
  tramos es despreciable; si creciera a miles de tramos por serie histórica,
  habría que resolver por clave en vez de pasar el conjunto (ver §6 del plan,
  presupuesto de 3 MB).
- Los invariantes del catálogo (sin solapamiento por clave y jurisdicción, citas
  con artículo) hay que validarlos explícitamente: `validarCatalogo`.

**Qué cierra**

- Cualquier lectura de parámetro que no pase por `resolverParametro`.
- Cualquier valor por defecto dentro del motor. No hay "si no está cargado,
  asumí 5 años".

## Cómo se revierte

- **Volver a constantes**: no se revierte, sería violar la constitución.
- **Pasar de "catálogo completo inyectado" a "resolución por clave contra un
  puerto"**: costo medio (1-2 días). Cambia la firma de `ContextoEvaluacion` y
  vuelve asíncrono el borde, pero no toca la lógica de ningún análisis. Se haría
  sólo si el tamaño del catálogo se volviera un problema medible.
- **Cambiar la forma de un `ValorParametro`**: barato mientras el motor no esté
  implementado; caro después, porque hay que migrar los datos cargados. Por eso
  el tipo se cierra ahora y en G2, no durante la implementación.
