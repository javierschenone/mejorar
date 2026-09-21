# ADR-026 — El estado de la matrícula es un valor derivado de hechos registrados, nunca un campo almacenado

| Campo | Valor |
| --- | --- |
| Estado | PROPUESTO |
| Fecha | 2026-09-21 |
| Autor | arquitecto |
| Aprobado por | pendiente — G2, feature 002 |
| Spec de origen | `specs/002-identidad-y-acceso/spec.md` v3 (CA-05, CA-22, CA-24, CA-29, CA-30, CA-31, R-04) |
| Dictamen | §4.4, condición **C-002-07**, salvaguardas M-1 a M-4, M-6, M-7 |
| Contrato | `specs/contratos/identidad-y-acceso.ts` §5 |

## Contexto

El dictamen es preciso sobre dónde está el defecto: *"El defecto no es 'manual',
es 'puntual'."* La verificación manual de R-04 se sostiene —no hay API
unificada de colegios y una integración mal hecha produciría verificaciones
falsamente positivas—, pero modelar la verificación como un **evento** deja al
sistema afirmando "verificado" sobre un hecho que puede haber dejado de ser
cierto: la matrícula se suspende, se cancela, caduca por falta de pago o se
pierde por sanción, y todo eso ocurre en el colegio provincial sin que la
plataforma se entere.

Y hay una segunda cara, de consumo: si la interfaz muestra "abogado verificado",
eso es una **afirmación de la plataforma al consumidor** sobre una
característica esencial del servicio (arts. 4 y 8 de la Ley 24.240), con la
plataforma dentro de la cadena de prestación (art. 40). "Matrícula verificada el
{fecha} contra {constancia}" es una afirmación sostenible; "verificado", a
secas, no lo es.

La tentación técnica es obvia: un campo `estadoVerificacion` y una tarea
programada que lo actualice. El problema de eso es conocido: **la tarea que no
corre**. Un proceso caído un fin de semana deja al sistema afirmando vigencia
sobre matrículas vencidas, y nadie se entera hasta que alguien reclama.

## Decisión

**Se registran hechos; el estado se calcula. `derivarEstadoMatricula(historia,
momento, plazoMaximoDeRevision)` es pura, total y sin reloj: el vencimiento
ocurre por el paso del tiempo, no porque una tarea lo marque.**

1. **`HistoriaDeVerificacion` sólo crece.** Guarda `solicitadaEn`, la lista de
   `DecisionDeVerificacion` (aprobada o rechazada, con evidencia y
   `vigenciaHasta`) y la lista de `SuspensionDeMatricula`. Nada se pisa. Es la
   misma regla que la constitución impone para los hallazgos: son prueba, y hay
   que poder reconstruir qué sabía el sistema en cada fecha.
2. **El estado es un valor derivado** con cinco brazos: `PENDIENTE` (con
   `plazoVencido` calculado), `RECHAZADA`, `VIGENTE`, `VENCIDA`, `SUSPENDIDA`.
   No existe ninguna columna que lo almacene, así que **no puede quedar
   desactualizado**: no hay dos fuentes de verdad que puedan discrepar.
3. **La evidencia es estructuralmente obligatoria (M-1).** El brazo `VIGENTE`
   exige `EvidenciaDeMatricula` completa: colegio, jurisdicción, número, clase
   de constancia, fecha de la constancia, referencia del documento y quién
   verificó. Una aprobación sin evidencia **no se puede construir**. El
   conflicto de interés que el dictamen marca —la organización gana con cada
   abogado incorporado— queda neutralizado: aprobar sin mirar deja rastro.
4. **Vencimiento gradual (CA-29, M-2).** `VENCIDA` retira
   `caso.recibirAsignacion` y conserva `caso.leer.asignado` y
   `caso.actuar.asignado`: se bloquean casos nuevos sin romper los en curso. Un
   corte abrupto perjudicaría al cliente que ya tiene a ese abogado
   (constitución #1).
5. **Suspensión inmediata (CA-30, M-3).** `SUSPENDIDA` la aplica un
   administrador con motivo tipado y retira los tres permisos en la petición
   siguiente, vía la invalidación por versión de ADR-022. La revocación es tan
   rápida como el daño.
6. **La tarea programada existe, pero sólo avisa.** Un proceso diario emite
   `MATRICULA_POR_VENCER` (30 y 7 días antes), `MATRICULA_VENCIDA` y el
   escalamiento al back-office de los pendientes que superaron el plazo
   (CA-31). **No cambia ningún estado.** Si no corre, no se pierde ninguna
   garantía de seguridad: sólo se pierden avisos, y eso se detecta con una
   alerta de ejecución.
7. **Nunca "verificado" a secas (M-6).** `claveDeExhibicionDeMatricula` devuelve
   una clave de plantilla y variables; el texto lo escribe `ux-expert` en el
   catálogo. Ninguna función de este módulo produce texto, y ninguna plantilla
   de estado profesional puede carecer de la variable de fecha: un test de
   catálogo lo verifica.
8. **La jurisdicción queda disponible (M-7, D-002-07).** `Jurisdiccion` es un
   enumerado cerrado y viaja en la evidencia y en el perfil. El control de que
   la jurisdicción limite la asignación de casos es de las specs 008/012/013
   (obligación F-09); esta feature deja el dato para que ese control sea posible.
9. **Parámetros.** `matricula.vigenciaVerificacion` (propuesta: 12 meses) y
   `matricula.plazoMaximoRevision` (propuesta: 5 días hábiles) son parámetros
   con `requiereValidacionProfesional`, no constantes. Sobre la **unidad** del
   segundo, ver escalamiento E-5 del plan: "días hábiles" exige un calendario de
   feriados que el sistema no tiene, y la recomendación del arquitecto es
   expresarlo en días corridos.

### Verificación

Un test por CA-05, CA-22, CA-24, CA-29, CA-30 y CA-31. Como la función es pura,
la batería de vencimientos se escribe como tabla, sin base de datos: verificada
hace 11 meses, hace 12 meses y un día, suspendida después de vencida, rechazada
y vuelta a solicitar, pendiente dentro y fuera de plazo. Más un test de que no
existe ninguna columna de estado en el esquema (revisión conjunta con
`database-engineer`, F-03) y un test de que la suspensión tiene efecto en la
petición siguiente.

## Alternativas consideradas

| Alternativa | A favor | En contra | Por qué no |
| --- | --- | --- | --- |
| Campo `estadoVerificacion` actualizado por tarea programada | Consulta trivial, filtrable e indexable | La tarea que no corre deja al sistema afirmando algo falso; y quedan dos fuentes de verdad que pueden discrepar | Es el defecto que C-002-07 manda corregir, con otra forma |
| Campo almacenado **más** derivación como verificación cruzada | Lo mejor de los dos mundos | Dos fuentes de verdad y una alarma que alguien tiene que mirar | Si la derivación es la que manda, el campo es una caché. Ver el punto siguiente |
| Columna calculada o vista materializada en PostgreSQL | Consultable e indexable, sin tarea programada | La regla legal se muda a SQL, donde el dominio no la puede auditar ni probar sin infraestructura; y hay dos implementaciones de la misma regla | Se descarta como fuente. **Se admite una vista de conveniencia para el back-office**, derivada de los mismos hechos y nunca consultada para autorizar |
| Verificación permanente, sin vigencia (spec v1) | Simple | Afirma un hecho que deja de ser cierto | Cerrado por C-002-07 |
| Integración automática con los colegios | Elimina el trabajo manual | No hay API unificada por jurisdicción; y una consulta de una sola vez tendría exactamente el mismo defecto de puntualidad | R-04 lo deja fuera de alcance. Cuando exista, entra como un `ClaseDeConstancia` más y **no cambia este diseño**: sería otra forma de producir evidencia |
| Bloquear todo al vencer, incluidos los casos en curso | Más estricto | Perjudica al cliente que ya tiene a ese abogado | CA-29 lo resuelve al revés, y tiene razón (constitución #1) |
| Dejar que el abogado declare su propia vigencia | Sin trabajo de back-office | Autodeclaración sin evidencia; el dictamen pide registrar el fundamento | M-5 (obligación contractual de notificar, spec 018) **complementa**, no reemplaza |

## Consecuencias

**Positivas**

- El sistema no puede afirmar una vigencia que no tiene: la afirmación se
  recalcula con cada lectura, contra el instante de la lectura.
- La historia completa queda disponible como prueba: quién verificó qué, contra
  qué constancia y cuándo. Es lo que hace falta ante un reclamo del art. 40.
- Si el proceso diario se cae, no se degrada ninguna garantía.

**Negativas**

- **No se puede filtrar por estado en SQL directamente.** Listar "abogados con
  matrícula vencida" exige traer la historia y derivar, o apoyarse en la vista
  de conveniencia. Para el back-office (decenas o cientos de abogados) es
  irrelevante; con miles habría que revisar el índice, y la salida está prevista
  (`vigenciaHasta` sí es columna indexable, y alcanza para prefiltrar).
- La derivación corre en cada resolución de permisos del abogado. Es una función
  pura sobre pocos registros, dentro del presupuesto de 8 ms de ADR-022.
- La historia crece sin borrarse; su retención entra en la tabla de F-07.

**Qué cierra**

- Guardar el estado de la matrícula como dato.
- Mostrar "verificado" sin fecha y sin constancia.

## Cómo se revierte

- **Agregar un campo materializado como caché de lectura**: medio día, siempre
  que la derivación siga siendo la fuente y el campo se recalcule en cada
  escritura de la historia. Es la salida si el volumen de abogados lo exige.
- **Volver a un estado almacenado como fuente**: exigiría revertir C-002-07 con
  dictamen nuevo. No es una reversión técnica sino de cumplimiento.
- **Incorporar verificación automática** el día que exista: aditivo, una clase
  más de constancia. Este diseño no la estorba.
