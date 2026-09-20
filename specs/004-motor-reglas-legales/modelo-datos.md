# Modelo de datos 004 — Motor de reglas legales argentinas

| Campo | Valor |
| --- | --- |
| Autor | `database-engineer` |
| Spec de origen | `specs/004-motor-reglas-legales/spec.md` — **versión 3, 64 criterios** |
| Dictamen de cumplimiento | `specs/004-motor-reglas-legales/cumplimiento.md` (APTO CON CONDICIONES, 12 condiciones) |
| Contrato de tipos leído | `specs/contratos/motor-reglas-legales.ts` (del `arquitecto`; **no modificado por este documento**) |
| Estado | **BORRADOR — se aprueba en G2** |
| Motor de base | PostgreSQL 16 + Prisma. Varias invariantes de este modelo usan capacidades que sólo existen en PostgreSQL (restricciones de exclusión, columnas generadas, claves foráneas compuestas, RLS). Está anotado dónde. |

> **Este documento no se implementa todavía.** No hay `schema.prisma` ni migración
> hasta que el product owner apruebe G2. Hoy `apps/api/prisma/` no existe: la
> migración de esta feature es la inicial del proyecto y eso está tratado en §6.

---

## 0. Alcance, frontera y criterio de diseño

### 0.1 Qué persiste esta feature y qué no

La spec §8 dice que **el motor es una librería pura sin persistencia**. Eso es
cierto para el cálculo y **no** elimina la base de datos: hay tres cosas que sí
tienen que estar guardadas para que los 64 criterios se puedan cumplir.

| Bloque | Por qué es de la 004 y no de la 007 |
| --- | --- |
| **Catálogo normativo** (parámetros, vigencias, citas, ratificaciones) y **valores de referencia** | Es la audiencia "Administrador" de la spec §2, el objeto de R-02, R-12, R-13 y de la condición C-03, y la entrada obligatoria de todo cálculo (CA-27 a CA-31, CA-58, CA-59). Sin esta tabla el motor no corre ni en desarrollo. |
| **Catálogo de plantillas y de términos prohibidos** | CA-45, CA-49, CA-50: el motor no genera lenguaje libre; los textos son datos versionados, no literales de código. |
| **Registro de evaluaciones, hallazgos, revisión profesional y advertencias** | El contrato §14 lo dice explícitamente: *"Estos tipos los consume el motor pero no los produce: los implementa la feature 007 **sobre el modelo que diseña `database-engineer`**"*. CA-27, CA-31, CA-47, CA-51, CA-54 a CA-57 y las métricas de la spec §10 son verificables sólo contra datos guardados. |

Lo que **no** modela este documento y queda declarado como frontera de la 007:
la persona real y su titularidad, el consentimiento versionado por finalidad, el
caso, la deuda como entidad de negocio, el plan del cliente, los acreedores y las
pantallas. Acá aparecen sólo como **identificadores opacos** y, donde hace falta,
como proyección mínima para poder expresar el aislamiento por perfil (§7.4).

### 0.2 Cinco decisiones de diseño que gobiernan todo el resto

| # | Decisión | Motivo |
| --- | --- | --- |
| D-1 | **Nada se pisa.** Todas las tablas de este modelo son de sólo-inserción (*append-only*) salvo tres columnas de estado explícitamente listadas en §7.2. No hay `UPDATE` sobre un parámetro, un valor de referencia ni un hallazgo: se inserta un tramo nuevo o una versión nueva. | Constitución #11, regla del proyecto 4, CA-27/CA-31. Un `UPDATE` destruye la respuesta a "qué decía el sistema el 3 de marzo". |
| D-2 | **Las invariantes críticas son estructurales, no validaciones.** Cuando una regla de la spec dice "no puede", se busca que el estado prohibido **no sea representable** en la base: claves foráneas compuestas contra columnas de estado, columnas generadas y `CHECK`. Está detallado por regla en §7.1. | CA-58 y CA-59 dicen literalmente "sin posibilidad de anular el bloqueo por configuración". Una validación en la aplicación se anula con una variable de entorno; una clave foránea, no. |
| D-3 | **Dos niveles de retención sobre el mismo hecho**: la *entrada* de la evaluación (que contiene remuneración y composición de saldo) se guarda cifrada y con clave propia, y se puede destruir sin destruir el hallazgo. El hallazgo conserva supuestos, parámetros usados y fundamento — alcanza para **explicar** el resultado, no para **recalcularlo**. | Resuelve la tensión prueba/supresión sin falso dilema. §5.3. |
| D-4 | **Identificadores opacos en todo el esquema del motor.** Ni una columna con nombre, documento, CUIT/CUIL, domicilio, contacto, CBU o número de tarjeta. La asociación con la persona real vive en otro esquema, con otro rol y otra clave. §4.2. | CA-60, condición C-10, constitución #5. |
| D-5 | **El dinero se guarda en centavos enteros (`BIGINT`)**, con moneda obligatoria en la misma fila, y una columna **generada** `NUMERIC(18,2)` de sólo lectura para reportes. Nunca `FLOAT`, nunca redondeo implícito. | CA-32 y el contrato (`Centavos = bigint`). Ver la nota de divergencia en §7.5. |

---

## 1. Entidades

Clasificación de sensibilidad por campo, en la columna `Cl.`:

| Código | Significado |
| --- | --- |
| `PUB` | PÚBLICO — publicable sin restricción (texto de una ley, una cita). |
| `INT` | INTERNO — operación de la plataforma; no es dato personal. |
| `PERS` | PERSONAL — identifica o permite identificar a una persona (incluye al profesional y a terceros). |
| `PATR` | **PATRIMONIAL SENSIBLE** — revela situación económica, ingreso, deuda o solvencia. Cifrado en reposo obligatorio, nunca indexado en claro (§4). |

Convención: `?` = opcional; sin marca = obligatorio. Tipos en notación
PostgreSQL. Toda tabla lleva `creadoEn TIMESTAMPTZ NOT NULL DEFAULT now()`
salvo indicación contraria; no se repite en cada listado.

---

### Bloque A — Catálogo normativo

#### A.1 `ParametroNormativo` — registro maestro de claves

Propósito: catálogo **cerrado** de las claves de parámetro que el motor conoce.
Es la contraparte persistida del tipo `ClaveParametro` del contrato. Existe para
que una clave inventada no entre a la base y para que el tablero del
administrador pueda listar qué falta cargar (audiencia "Administrador", spec §2).

| Campo | Tipo | Cl. | Notas |
| --- | --- | --- | --- |
| `clave` | `TEXT` PK | PUB | Ej. `prescripcion.plazoGenerico`. Igual al literal del contrato. |
| `analisis` | `enum AnalisisMotor` (`A_PRESCRIPCION`…`E_HONORARIOS`, `TRANSVERSAL`) | PUB | |
| `descripcion` | `TEXT` | PUB | Columna "Qué representa" del dictamen §5. |
| `tipoValor` | `enum TipoValorParametro` (`PLAZO_DIAS`, `PLAZO_ANIOS`, `PORCENTAJE`, `RACIONAL`, `MONTO`, `BOOLEANO`, `ENUM_CERRADO`, `LISTA_CERRADA`, `TRAMOS`) | PUB | Determina qué forma admite `valor` en A.2. |
| `unidad` | `TEXT?` | PUB | `años`, `días corridos`, `% anual`, `veces el SMVM`. Obligatoria si `tipoValor` no es booleano ni enum. |
| `esNormativo` | `BOOLEAN` | PUB | `false` en los umbrales de producto (`prescripcion.umbralAlertaDias`, `archivoCrediticio.umbralAlertaDias`). Un umbral de producto **no** se presenta como norma: alimenta `notaDeAlcance = UMBRAL_DE_ALERTA_INTERNO_NO_TOPE_LEGAL`. |
| `admiteJurisdiccion` | `BOOLEAN` | PUB | `true` en los parámetros del análisis E (CA-43). |
| `bloqueanteDeAnalisis` | `BOOLEAN` | PUB | Si falta o no está ratificado, el análisis entero devuelve sin resultado. `true` en `archivoCrediticio.diesAQuo.*` (CA-39) y en `embargo.excepcionAlimentos` (CA-40). |

**Invariantes.** La tabla es de carga controlada: se poblará por *seed* y sólo
cambia con una migración. Ninguna vía de aplicación inserta filas acá.

---

#### A.2 `TramoParametro` — el parámetro con su vigencia

Propósito: **un valor de un parámetro, en una jurisdicción, durante un período.**
Es el corazón de CA-29 y de la constitución #11. Un parámetro desdoblado por
vigencia —el tope de punitorios de tarjeta antes y después del DNU 70/2023,
CA-35— son dos filas de la misma clave con rangos contiguos.

| Campo | Tipo | Cl. | Notas |
| --- | --- | --- | --- |
| `id` | `UUID` PK (v7) | INT | |
| `claveParametro` | `TEXT` FK → `ParametroNormativo.clave` | PUB | |
| `jurisdiccion` | `enum Jurisdiccion` (`NACIONAL`, `FEDERAL`, `BUENOS_AIRES`, `CABA`, `CORDOBA`, `SANTA_FE`, `TODAS`) | PUB | CA-43 y decisión 004-D. El valor `TODAS` no es comodín de búsqueda: un parámetro cargado como `TODAS` aplica a cualquier jurisdicción; uno cargado por jurisdicción **no** cae de vuelta a otra (CA-52, S-09). |
| `valor` | `JSONB?` | PUB | Canónico, con esquema validado según `tipoValor`. `NULL` sólo si `disponibilidad <> 'CARGADO'`. |
| `vigencia` | `DATERANGE` `[desde, hasta)` | PUB | `hasta` no acotado = vigente sin término conocido. Se guarda como rango, no como dos fechas sueltas, porque la restricción de no-solapamiento y la consulta "vigente a la fecha del hecho" se expresan sobre el rango. |
| `disponibilidad` | `enum DisponibilidadParametro` | PUB | `CARGADO`, `A_DETERMINAR_POR_EL_ESTUDIO`, `CONTRADICCION_ABIERTA`. Los dos últimos reproducen los marcadores `[D]` y `[!]` del dictamen §5: **son estados de primera clase, no ausencia de fila.** Una fila `CONTRADICCION_ABIERTA` existe, cita sus fuentes y nombra por qué no se puede evaluar (`embargo.tramo2.porcentaje`, `cuotaLitis.topeMateriasProtegidas`). |
| `confiabilidadFuente` | `enum Confiabilidad` (`V`, `C`, `P`, `D`, `CONTRADICCION`, `I`) | PUB | Leyenda del dictamen. **`C` se trata igual que `P` a efectos del bloqueo** (§0bis de la spec, condición C-02): el bloqueo no depende de esta columna sino de `estadoRatificacion`, así que la equivalencia no puede romperse por error de carga. |
| `estadoRatificacion` | `enum EstadoRatificacion` (`SIN_RATIFICAR`, `RATIFICADO`) | INT | Ver A.4 y §7.1 R-1. |
| `ratificacionId` | `UUID?` FK → `Ratificacion.id` | INT | |
| `notaDeAlcance` | `enum ClaveNotaDeAlcance?` | PUB | Catálogo cerrado del contrato. |
| `reemplazaTramoId` | `UUID?` FK → `TramoParametro.id` | INT | Linaje de correcciones. Un tramo mal cargado no se edita: se inserta el corregido apuntando al anterior. |
| `retiradoEn` | `TIMESTAMPTZ?` | INT | Baja lógica. Un tramo retirado no entra en catálogos nuevos; sigue existiendo para reproducir resultados viejos. **Nunca se borra** mientras exista un `CatalogoTramo` que lo referencie. |
| `cargadoPor` | `TEXT` | INT | Identificador de operador o `MIGRACION`/`SEED`. |

**Invariantes.**

1. `EXCLUDE USING gist (claveParametro WITH =, jurisdiccion WITH =, vigencia WITH &&) WHERE (retiradoEn IS NULL)` — dos tramos vigentes de la misma clave y jurisdicción no pueden solaparse. Es la invariante que el contrato pide en `validarCatalogo`, expresada en la base.
2. `CHECK (estadoRatificacion = 'RATIFICADO') = (ratificacionId IS NOT NULL)` — **no existe forma de escribir "ratificado" sin apuntar a quién ratificó** (condición C-03, CA-47).
3. `CHECK (disponibilidad = 'CARGADO' OR valor IS NULL)` y `CHECK (disponibilidad <> 'CARGADO' OR valor IS NOT NULL)`.
4. `CHECK (disponibilidad = 'CARGADO' OR estadoRatificacion = 'SIN_RATIFICAR')` — un parámetro `A_DETERMINAR` o en contradicción abierta no puede figurar ratificado.
5. `UNIQUE (id, estadoRatificacion)` — no aporta unicidad; existe para ser el destino de la clave foránea compuesta de A.6. Ver §7.1 R-1.
6. Al menos una cita: se verifica con la restricción de A.3.

---

#### A.3 `CitaNormativa` y `TramoParametroCita`

Propósito: la cita con artículo que CA-27 exige en toda salida, y la trazabilidad
documental del dictamen (qué se leyó, dónde, cuándo, con qué confiabilidad).

`CitaNormativa`

| Campo | Tipo | Cl. | Notas |
| --- | --- | --- | --- |
| `id` | `UUID` PK | PUB | |
| `tipoNorma` | `enum TipoNorma` (`LEY`, `DECRETO`, `DNU`, `CODIGO`, `COMUNICACION_BCRA`, `RESOLUCION`, `FALLO`) | PUB | |
| `identificacion` | `TEXT` | PUB | `Ley 25.065`, `CCyC`, `Decreto 484/87`, `Fallos 334:1276`. |
| `articulo` | `TEXT` | PUB | **Obligatorio.** CA-27 pide artículo, no norma a secas. |
| `inciso` | `TEXT?` | PUB | |
| `textoTranscripto` | `TEXT?` | PUB | Transcripción literal corroborada, con su confiabilidad. |
| `confiabilidad` | `enum Confiabilidad` | PUB | |
| `fuenteUrl` | `TEXT?` | PUB | |
| `fechaConsulta` | `DATE?` | PUB | Trazabilidad de `specs/legal/verificacion-documental.md`. |
| `publicadaBO` | `DATE?` | PUB | Ej. DNU 70/2023 → 21/12/2023. |

`TramoParametroCita(tramoId, citaId)` — N:M, PK compuesta.

**Invariante.** Todo `TramoParametro` con `disponibilidad = 'CARGADO'` tiene al
menos una cita. La base no puede expresar "al menos uno" en una N:M sin
disparador; queda como restricción diferida verificada por disparador
`AFTER INSERT ... DEFERRABLE` y, en segunda línea, por `validarCatalogo` antes de
publicar un snapshot (§7.3).

---

#### A.4 `Ratificacion` — la firma del profesional sobre los parámetros (C-03)

Propósito: la condición C-03 completa. Un acto de ratificación firma **un
conjunto** de tramos; muchos tramos apuntan a una ratificación.

| Campo | Tipo | Cl. | Notas |
| --- | --- | --- | --- |
| `id` | `UUID` PK | INT | |
| `idProfesional` | `TEXT` FK → `MatriculaProfesional.idProfesional` | PERS | Identificador opaco del profesional. |
| `matricula` | `TEXT` | PERS | Se **copia** acá además de estar en A.5: la ratificación es un hecho histórico y no puede cambiar si mañana el colegio renumera. |
| `jurisdiccionMatricula` | `enum Jurisdiccion` | PERS | |
| `nombreProfesional` | `TEXT` | PERS | **Es el único nombre de persona en todo el modelo.** Base legal: ejecución del contrato con el profesional y responsabilidad profesional identificable (dictamen §2.1). No es dato del deudor; CA-60 no lo alcanza. |
| `fecha` | `DATE` | PERS | |
| `fechaProximaRevision` | `DATE?` | INT | C-03. Alimenta el tablero de vencimientos (§3, consulta Q-09). |
| `referenciaDocumentoFirmado` | `TEXT` | INT | Identificador del documento en el almacén de objetos. |
| `huellaDocumento` | `TEXT` | INT | SHA-256 del PDF firmado. Sin esto, "está firmado" es una afirmación sin prueba. |
| `alcanceDeclarado` | `TEXT` | PUB | Qué dice el profesional que ratificó, en sus términos. |
| `revocadaEn` | `TIMESTAMPTZ?` | INT | Ver invariante 2. |
| `motivoRevocacion` | `enum MotivoRevocacion?` (`CAMBIO_NORMATIVO`, `ERROR_DETECTADO`, `VENCIMIENTO_DE_REVISION`, `BAJA_DEL_PROFESIONAL`) | INT | |

**Invariantes.**

1. `CHECK (length(trim(matricula)) > 0)` — CA-47: sin matrícula, no hay
   ratificación posible. La cadena vacía tampoco.
2. **Revocar una ratificación no cambia el pasado.** Al revocar, los tramos que
   colgaban de ella se retiran (`retiradoEn`) y, si hacía falta, se cargan
   reemplazos. Los catálogos ya publicados que los contienen **no se tocan**: un
   resultado emitido en junio se reproduce con el catálogo de junio (CA-31).
3. Una ratificación con `fechaProximaRevision` vencida **no** se auto-revoca: el
   vencimiento genera un `AlertaVencimiento` (A.9) y una decisión humana. Un
   sistema que se auto-invalida en silencio deja de evaluar sin que nadie lo
   sepa.

---

#### A.5 `MatriculaProfesional`

Propósito: la matrícula verificada. CA-47 exige matrícula registrada para
confirmar un hallazgo; sin esta tabla, "matrícula" sería una cadena que alguien
tipeó.

| Campo | Tipo | Cl. | Notas |
| --- | --- | --- | --- |
| `idProfesional` | `TEXT` PK | PERS | Identificador opaco. |
| `matricula` | `TEXT` | PERS | |
| `colegio` | `TEXT` | PERS | |
| `jurisdiccion` | `enum Jurisdiccion` | PERS | |
| `estado` | `enum EstadoMatricula` (`VIGENTE`, `SUSPENDIDA`, `CANCELADA`, `NO_VERIFICADA`) | PERS | |
| `vigenciaDesde` / `vigenciaHasta` | `DATE` / `DATE?` | PERS | |
| `verificadaEn` | `TIMESTAMPTZ?` | INT | |
| `fuenteVerificacion` | `TEXT?` | INT | Padrón del colegio, constancia, etc. |
| `eliminadoEn` | `TIMESTAMPTZ?` | INT | Baja lógica. |

**Invariantes.** `UNIQUE (jurisdiccion, matricula)`; `UNIQUE (idProfesional, estado)`
como destino de clave foránea compuesta desde D.1 (§7.1 R-4).

---

#### A.6 `CatalogoNormativo` y `CatalogoTramo` — el conjunto exacto, congelado

Propósito: CA-27 y CA-31. Un resultado no cita "los parámetros": cita **una
versión del conjunto**. Con `version` + `huellaContenido` + `fechaDeEvaluacion` +
entrada, cualquier resultado pasado se recalcula idéntico.

`CatalogoNormativo`

| Campo | Tipo | Cl. | Notas |
| --- | --- | --- | --- |
| `version` | `TEXT` PK | INT | Monótona, legible: `2026.09.20-001`. |
| `huellaContenido` | `TEXT` | INT | SHA-256 de la serialización canónica de todos sus tramos. |
| `generadoEl` | `TIMESTAMPTZ` | INT | |
| `estado` | `enum EstadoCatalogo` (`BORRADOR`, `PUBLICADO`, `RETIRADO`) | INT | |
| `aptoProduccion` | `BOOLEAN` | INT | **Columna que hace cumplir CA-58.** Ver §7.1 R-2. |
| `publicadoPor` | `TEXT?` | INT | |
| `notas` | `TEXT?` | INT | |

`CatalogoTramo`

| Campo | Tipo | Cl. | Notas |
| --- | --- | --- | --- |
| `catalogoVersion` | `TEXT` | INT | |
| `catalogoAptoProduccion` | `BOOLEAN` | INT | Réplica, sostenida por clave foránea compuesta. |
| `tramoId` | `UUID` | INT | |
| `tramoEstadoRatificacion` | `enum EstadoRatificacion` | INT | Réplica, sostenida por clave foránea compuesta. |

**Invariantes — esto es el mecanismo, no una convención.**

1. PK `(catalogoVersion, tramoId)`.
2. `FOREIGN KEY (catalogoVersion, catalogoAptoProduccion) REFERENCES CatalogoNormativo(version, aptoProduccion) ON UPDATE RESTRICT`.
3. `FOREIGN KEY (tramoId, tramoEstadoRatificacion) REFERENCES TramoParametro(id, estadoRatificacion) ON UPDATE RESTRICT`.
4. `CHECK (NOT catalogoAptoProduccion OR tramoEstadoRatificacion = 'RATIFICADO')`.

Consecuencia: **no existe ninguna secuencia de sentencias SQL que meta un tramo
sin ratificar en un catálogo apto para producción**, y tampoco que degrade a
`SIN_RATIFICAR` un tramo que ya está dentro de uno (la clave foránea con
`ON UPDATE RESTRICT` lo impide). No hay bandera de configuración que lo evite,
que es exactamente lo que pide la decisión 004-A / R-12 / condición C-02.

5. Un catálogo `PUBLICADO` es inmutable: disparador que rechaza todo `INSERT`,
   `UPDATE` o `DELETE` sobre `CatalogoTramo` cuando el catálogo no está en
   `BORRADOR`. Retirar un catálogo cambia `estado`, nunca su contenido.

---

#### A.7 `ValorReferencia` y `TramoValorReferencia` — CA-59, decisión 004-C

Propósito: SMVM, promedio BCRA de préstamos personales, tasa del propio emisor.
Se obtienen automáticamente y **no valen hasta que una persona los activa**.

`ValorReferencia` (maestro, análogo a A.1): `clave` PK (`SMVM`,
`PROMEDIO_BCRA_PRESTAMOS_PERSONALES`, `TASA_PROPIO_EMISOR_PRESTAMOS_PERSONALES`),
`descripcion`, `tipoValor` (`MONTO` | `TASA`), `organismoEmisor`. Todo `PUB`.

`TramoValorReferencia`

| Campo | Tipo | Cl. | Notas |
| --- | --- | --- | --- |
| `id` | `UUID` PK | INT | |
| `clave` | `TEXT` FK → `ValorReferencia.clave` | PUB | |
| `claveDesambiguacion` | `TEXT?` | INT | Para `TASA_PROPIO_EMISOR…`: identificador **opaco** del emisor. Nunca su razón social. |
| `montoCentavos` | `BIGINT?` | PUB | Excluyente con `tasa*`. |
| `moneda` | `enum Moneda?` | PUB | Obligatoria si hay monto. |
| `tasaValor` | `NUMERIC(12,8)?` / `tasaBase` `enum BaseTasa?` | PUB | `TNA`, `TEA`, `MENSUAL`, `DIARIA`. **La base se guarda siempre**: comparar una TNA contra un tope en TEA produce un hallazgo falso (spec §7). |
| `vigencia` | `DATERANGE` | PUB | |
| `fuenteOrganismo` | `TEXT` | PUB | |
| `fuenteActo` | `TEXT` | PUB | Nº de resolución o comunicación. |
| `fuenteUrl` | `TEXT?` | PUB | |
| `fechaDeObtencion` | `DATE` | INT | |
| `estado` | `enum EstadoValorReferencia` (`PROPUESTO`, `ACTIVO`, `DESCARTADO`, `SUPERSEDIDO`) | INT | **Nace siempre en `PROPUESTO`.** |
| `activacionId` | `UUID?` FK → `ActivacionValorReferencia.id` | INT | |

`ActivacionValorReferencia`: `id` PK, `idOperador` (`PERS`, opaco),
`fechaDeActivacion`, `justificacion` (`enum` cerrado: `COINCIDE_CON_FUENTE_OFICIAL`,
`VERIFICADO_CONTRA_BOLETIN`, `CARGA_MANUAL_CON_CONSTANCIA`),
`claveIdempotencia` `UNIQUE`.

`TablaValoresReferencia(version PK, huellaContenido, generadoEl, estado)` y
`TablaValorTramo(tablaVersion, tramoId, tramoEstado)`.

**Invariantes — cómo se impide que un valor no activado participe de un cálculo.**

1. `CHECK ((estado = 'ACTIVO') = (activacionId IS NOT NULL))` — el estado activo
   no se puede escribir sin apuntar a la persona que activó y cuándo.
2. `UNIQUE (id, estado)` en `TramoValorReferencia`.
3. En `TablaValorTramo`: `tramoEstado` es una **columna generada**
   `GENERATED ALWAYS AS ('ACTIVO') STORED`, con
   `FOREIGN KEY (tramoId, tramoEstado) REFERENCES TramoValorReferencia(id, estado) ON UPDATE RESTRICT`.
   Es decir: **la tabla de valores que recibe el motor sólo admite filas activas,
   y no por validación sino porque una fila no activa no satisface la clave
   foránea.** Un `INSERT` de un valor `PROPUESTO` falla en el motor de base.
4. `ON UPDATE RESTRICT` impide además desactivar un valor que ya está publicado
   en una tabla; para sacarlo hay que publicar una tabla nueva.
5. `EXCLUDE USING gist (clave WITH =, claveDesambiguacion WITH =, vigencia WITH &&) WHERE (estado = 'ACTIVO')` —
   no puede haber dos valores activos solapados para la misma clave.
6. **No hay fallback al último valor conocido.** Si no hay tramo activo para la
   fecha del hecho, el análisis devuelve sin resultado con motivo
   `VALOR_REFERENCIA_AUSENTE_A_LA_FECHA` (spec §7, CA-18). Se garantiza porque la
   consulta de resolución filtra por `vigencia @> fechaDelHecho` y no tiene
   `ORDER BY ... LIMIT 1` de respaldo — está documentado en §3, consulta Q-04.

El motor recibe una `TablaValoresReferencia` ya publicada, exactamente como
recibe un `CatalogoNormativo`: **no consulta estas tablas.** Sigue siendo una
librería pura.

---

#### A.8 `PlantillaTexto`, `CatalogoPlantillas`, `TerminoProhibido`

Propósito: CA-45, CA-49, CA-50. El motor no escribe lenguaje sobre el caso:
referencia una plantilla identificada y versionada.

`PlantillaTexto`

| Campo | Tipo | Cl. | Notas |
| --- | --- | --- | --- |
| `idPlantilla` | `TEXT` | PUB | Literal del catálogo cerrado del contrato (`A_ADVERTENCIA_PREVENTIVA`, `ENCABEZADO_GLOBAL_DIAGNOSTICO`, …). |
| `version` | `INTEGER` | PUB | PK compuesta `(idPlantilla, version)`. **Las versiones no se pisan**: un hallazgo de marzo referencia la versión de marzo. |
| `destinatarios` | `enum Destinatario[]` | PUB | `CLIENTE`, `ABOGADO`, `OPERADOR`, `ADMINISTRADOR`. |
| `texto` | `TEXT` | PUB | Texto literal del dictamen §3.0 a §3.7 donde corresponda. |
| `esObligatoria` | `BOOLEAN` | PUB | CA-50. |
| `ranuras` | `TEXT[]` | PUB | Nombres de los huecos admitidos. Lista cerrada: impide interpolar texto libre. |
| `aprobadaPorLegalEn` / `aprobadaPorUxEn` | `TIMESTAMPTZ?` | INT | Condición C-07: el texto lo ratifica el abogado y lo pasa `ux-expert` por legibilidad. |
| `huellaTexto` | `TEXT` | INT | SHA-256. Permite detectar una edición no versionada. |

`CatalogoPlantillas(version PK, huellaContenido, generadoEl)` +
`CatalogoPlantillaItem(catalogoVersion, idPlantilla, versionPlantilla)`, inmutable
igual que A.6.

`TerminoProhibido`: `termino` PK, `fundamento` (`CONSTITUCION_6`,
`LEY_22802`, `S_01`), `esRegex` `BOOLEAN`, `activo`. Alimenta el test de CA-45 y
el control de publicación de una plantilla. **Invariante de aplicación**: no se
publica una `PlantillaTexto` cuyo `texto` coincida con un término activo. No es
expresable en la base con razonabilidad; queda en el disparador de publicación y
cubierto por test (§7.3).

---

#### A.9 `AlertaVencimiento` — revisión de parámetros vencida

Propósito: C-03 exige `fechaProximaRevision`; sin detección, la fecha es
decorativa.

Campos: `id` PK, `tipo` (`RATIFICACION_VENCIDA`, `TRAMO_SIN_RATIFICAR_EN_CATALOGO_DE_HOMOLOGACION`,
`VALOR_REFERENCIA_PROPUESTO_SIN_ACTIVAR`), `ratificacionId?`, `tramoId?`,
`tramoValorReferenciaId?`, `fechaLimite`, `detectadaEn`, `resueltaEn?`,
`claveIdempotencia UNIQUE`. Todo `INT`.

---

### Bloque B — Evaluación y resultados

#### B.1 `Evaluacion`

Propósito: la corrida del motor. Inmutable. Es lo que hace reproducible un
resultado pasado (CA-27, CA-31).

| Campo | Tipo | Cl. | Notas |
| --- | --- | --- | --- |
| `id` | `UUID` PK (v7) | INT | |
| `idDeuda` | `TEXT` | INT | **Opaco.** Referencia por valor a la 007; sin clave foránea entre esquemas. |
| `idSujeto` | `TEXT` FK → `SujetoSeudonimo.idSujeto` | PERS | Seudónimo, ver C.1. Es PERSONAL aunque sea opaco: con la tabla de vínculo se reidentifica. |
| `fechaDeEvaluacion` | `DATE` | INT | **Entrada, no `now()`.** R-04, CA-31. Se guarda como `DATE` civil, sin huso: una fecha jurídica no tiene hora. |
| `entorno` | `enum Entorno` (`PRODUCCION`, `HOMOLOGACION`, `DESARROLLO`, `PRUEBA`) | INT | |
| `analisisSolicitados` | `enum AnalisisMotor[]` | INT | |
| `versionContrato` / `versionMotor` | `TEXT` | INT | |
| `catalogoVersion` | `TEXT` FK → `CatalogoNormativo.version` | INT | |
| `catalogoAptoProduccion` | `BOOLEAN` | INT | Réplica con clave foránea compuesta. Ver invariante 2. |
| `huellaCatalogo` | `TEXT` | INT | |
| `tablaValoresVersion` | `TEXT` FK | INT | |
| `catalogoPlantillasVersion` | `TEXT` FK | INT | |
| `huellaEntradaCanonica` | `TEXT` | INT | SHA-256 de la serialización canónica. No revela nada del caso. |
| `entradaCifradaId` | `UUID?` FK → `EntradaEvaluacionCifrada.id` | INT | Puede quedar en `NULL` tras una supresión (D-3, §5.3). |
| `claveIdempotencia` | `TEXT` | INT | `UNIQUE`. Derivada de `huellaEntradaCanonica + fechaDeEvaluacion + las cuatro versiones`. Dos pedidos idénticos no producen dos corridas ni dos advertencias. Constitución #12. |
| `solicitadaPor` | `TEXT` | INT | Actor opaco. |

**Invariantes.**

1. `CHECK (entorno <> 'PRODUCCION' OR catalogoAptoProduccion)` con
   `FOREIGN KEY (catalogoVersion, catalogoAptoProduccion) REFERENCES CatalogoNormativo(version, aptoProduccion)`.
   **Segunda barrera estructural de CA-58**, ahora del lado de la corrida: no se
   puede registrar una evaluación productiva contra un catálogo que contenga un
   parámetro sin ratificar. La primera barrera (A.6) impide armar el catálogo;
   ésta impide usarlo.
2. Sólo-inserción. Cero `UPDATE`.

---

#### B.2 `EntradaEvaluacionCifrada`

Propósito: guardar la entrada para poder **recalcular** (CA-31), separada del
hallazgo para poder **destruirla antes** (D-3).

| Campo | Tipo | Cl. | Notas |
| --- | --- | --- | --- |
| `id` | `UUID` PK | INT | |
| `contenido` | `BYTEA` | **PATR** | JSON canónico de `EntradaEvaluacion` cifrado con AES-256-GCM. Contiene remuneración neta, composición del saldo y tasas. |
| `idClave` | `TEXT` | INT | Identificador de la clave de cifrado (rotación). **Clave distinta de la del resto del esquema**, ver §4.3. |
| `nonce` / `tag` | `BYTEA` | INT | |
| `aadHuella` | `TEXT` | INT | Datos adicionales autenticados: `evaluacionId`. Impide re-adjuntar una entrada a otra evaluación. |
| `destruidaEn` | `TIMESTAMPTZ?` | INT | Se pone al borrar el contenido. |
| `motivoDestruccion` | `enum?` (`RETENCION_CUMPLIDA`, `SUPRESION_DEL_TITULAR`, `REVOCACION_DE_CONSENTIMIENTO`) | INT | Queda **constancia del hecho, no del dato** (regla 3 del mandato). |

**Invariante.** `CHECK ((destruidaEn IS NULL) = (contenido IS NOT NULL))`. Una
fila destruida conserva su `id`, su motivo y su fecha; el `BYTEA` queda en `NULL`
y la clave de esa evaluación se marca para no reponerse.

---

#### B.3 `ResultadoAnalisis` — **los tipos de "sin resultado"**

Propósito: una fila por análisis solicitado por evaluación. Acá vive la distinción
que introduce la versión 3 de la spec.

| Campo | Tipo | Cl. | Notas |
| --- | --- | --- | --- |
| `id` | `UUID` PK | INT | |
| `evaluacionId` | `UUID` FK | INT | `UNIQUE (evaluacionId, analisis)`. |
| `analisis` | `enum AnalisisMotor` | INT | |
| `clase` | `enum ClaseResultado` (`EVALUADO`, `NO_APLICA`, `SIN_RESULTADO`) | INT | `NO_APLICA`: deuda cancelada para A y B (spec §7). No es lo mismo que no poder. |
| `claseSinResultado` | `enum ClaseSinResultado?` | INT | **Ver abajo.** |
| `estadoDeclarado` | `TEXT?` | INT | `PRESUNTAMENTE_PRESCRIPTA`, `VIGENTE`, `PROXIMA_A_PRESCRIBIR`, `CADUCADO`, `PROXIMO_A_CADUCAR`, `INEMBARGABLE`… Catálogo cerrado. **Restricción `CHECK` que rechaza el literal `PRESCRIPTA`** (S-01, CA-45, defecto D-22): el estado asertivo no es representable. |
| `plantillaId` / `plantillaVersion` | `TEXT` / `INTEGER` FK | PUB | CA-49. |

`ClaseSinResultado` — **cuatro valores, no uno**:

| Valor | Criterio que lo origina | Qué significa | Quién lo destraba | Qué cambia si se resuelve |
| --- | --- | --- | --- | --- |
| `FALTA_DATO_DEL_CASO` | CA-07, CA-10, CA-13, y las inconsistencias de spec §7 | El **caso** está incompleto: falta la fecha de exigibilidad, el tipo de emisor, la composición del saldo. | El cliente, el operador o una intimación al acreedor. | Se recarga el dato y se reevalúa: misma norma, mismo catálogo. |
| `PARAMETRO_NO_DISPONIBLE` | CA-26, CA-35, CA-39, CA-40, CA-52, S-09 | El caso está completo. Lo que falta es **nuestro catálogo**: el parámetro es `A_DETERMINAR`, está sin ratificar, no tiene tramo vigente a la fecha del hecho, o la jurisdicción no está cargada. | El estudio jurídico (C-03) y el administrador. | Se ratifica o se carga el parámetro y se reevalúa con catálogo nuevo. |
| `MATERIA_EXCLUIDA_POR_PROHIBICION` | **CA-63 (v3)** | El caso está completo y el catálogo también podría estarlo, y aun así **el motor no evalúa**: la materia es previsional, alimentaria o involucra menores, y la Ley 27.423 art. 6 inc. c) podría **prohibir** el pacto de cuota litis en vez de topearlo. No es una carencia: es una abstención deliberada. | Un **dictamen** del estudio sobre la naturaleza de la norma. Cargar un número no lo destraba; cargar un número sería precisamente el error. | Puede no destrabarse nunca: si es prohibición, el análisis E queda excluido de esa materia de forma permanente. |
| `REGIMEN_EN_DISPUTA_TRANSITORIO` | **CA-64 (v3)** | El caso está completo, **los dos regímenes candidatos pueden estar ambos cargados y ratificados**, y el problema es cuál rige el hecho: hay derecho transitorio controvertido (art. 277 LCT tras la Ley 27.802). El mecanismo de CA-29 —"el parámetro vigente a la fecha del hecho"— **no alcanza**, porque la disputa es sobre la vigencia misma. | Un dictamen sobre derecho transitorio, materializado en un `TramoParametro` de transición (clave `*.reglaTransicion*`) ratificado. | Se carga el parámetro de transición y el motor vuelve a poder decidir. |

**Por qué son cuatro columnas de destino distintas y no un solo enum de motivos.**
Porque cada una tiene distinto dueño de resolución, distinto plazo, distinta
métrica y distinto efecto: `FALTA_DATO` se le pide al cliente; `PARAMETRO_NO_DISPONIBLE`
es deuda nuestra con el estudio y es la métrica "parámetros sin ratificar";
`MATERIA_EXCLUIDA` **no se le pide a nadie** y contarla como "falta un dato"
generaría una cola de trabajo falsa sobre casos que hay que dejar quietos; y
`REGIMEN_EN_DISPUTA` es el único caso donde el sistema tiene todo cargado y aun
así se abstiene — si se lo confunde con los otros tres, alguien "arregla" el
problema forzando un régimen, que es justo lo que CA-64 prohíbe.

Las tres formas tienen **tabla de detalle propia**, porque los datos que hay que
guardar no se parecen:

**`SinResultadoFaltante`** (0..n filas; sólo para `FALTA_DATO_DEL_CASO` y
`PARAMETRO_NO_DISPONIBLE`)

| Campo | Tipo | Cl. | Notas |
| --- | --- | --- | --- |
| `resultadoId` | `UUID` FK | INT | |
| `claseSinResultado` | columna generada | INT | Para la clave foránea compuesta. |
| `motivo` | `enum MotivoIndeterminable` | INT | Los ocho del contrato. |
| `rutaCampo` | `enum RutaCampoEntrada?` | INT | Ruta cerrada. **Nunca texto libre**: CA-49, S-05. |
| `claveParametro` | `TEXT?` FK | PUB | |
| `claveValorReferencia` | `TEXT?` FK | PUB | |
| `jurisdiccion` | `enum Jurisdiccion?` | PUB | |

`CHECK` de coherencia: `motivo IN ('DATO_AUSENTE','DATO_INCONSISTENTE')` ⇒
`rutaCampo IS NOT NULL`; los motivos de parámetro ⇒ `claveParametro IS NOT NULL`.
Invariante del contrato: al menos una fila. Se verifica con disparador diferido.

**`SinResultadoExclusionMateria`** (0..1; sólo `MATERIA_EXCLUIDA_POR_PROHIBICION`)

| Campo | Tipo | Cl. | Notas |
| --- | --- | --- | --- |
| `resultadoId` | `UUID` PK FK | INT | |
| `materia` | `enum MateriaDelCaso` (`PREVISIONAL`, `ALIMENTARIA`, `CIVIL_COMERCIAL`, `LABORAL`, `CONSUMO`) | PERS | Ver escalamiento E-3. |
| `motivoExclusion` | `enum` (`POSIBLE_PROHIBICION_CUOTA_LITIS`, `INTERVENCION_DE_PERSONA_MENOR_DE_EDAD`) | INT | |
| `citaId` | `UUID` FK → `CitaNormativa` | PUB | Ley 27.423 art. 6 inc. c). |
| `estadoDictamen` | `enum` (`PENDIENTE`, `RESUELTO_PROHIBICION`, `RESUELTO_TOPE`) | INT | Mientras sea `PENDIENTE`, ni CA-23 ni CA-44 se aplican a esa materia. |
| `parametroEnContradiccion` | `TEXT?` FK | PUB | `cuotaLitis.topeMateriasProtegidas`, cargado como `CONTRADICCION_ABIERTA`. |

**`SinResultadoRegimenEnDisputa`** (0..1; sólo `REGIMEN_EN_DISPUTA_TRANSITORIO`)

| Campo | Tipo | Cl. | Notas |
| --- | --- | --- | --- |
| `resultadoId` | `UUID` PK FK | INT | |
| `fechaDelHecho` | `DATE` | PATR | Ubica el hecho dentro de la ventana en disputa. Combinado con el resto, es dato patrimonial. |
| `normaModificatoriaCitaId` | `UUID` FK | PUB | Ley 27.802 (BO 06/03/2026). |
| `normaModificadaCitaId` | `UUID` FK | PUB | LCT art. 277. |
| `ventanaTransicion` | `DATERANGE?` | PUB | Puede ser desconocida: parte de la disputa es dónde empieza y termina. |
| `regimenCandidatoAnteriorTramoId` | `UUID?` FK → `TramoParametro` | INT | El tramo que regiría bajo la tesis A. |
| `regimenCandidatoPosteriorTramoId` | `UUID?` FK → `TramoParametro` | INT | El de la tesis B. **Los dos pueden estar ratificados**: eso es lo que distingue este caso de `PARAMETRO_NO_DISPONIBLE`. |
| `claveParametroTransicionEsperado` | `TEXT` FK | PUB | El parámetro que, ratificado, destrabaría el caso. |

**Invariante que hace la distinción imposible de perder** (la parte que importa
para la tabla de auditoría):

```
-- en ResultadoAnalisis
CHECK ((clase = 'SIN_RESULTADO') = (claseSinResultado IS NOT NULL))
UNIQUE (id, claseSinResultado)

-- en cada tabla de detalle, columna generada con el valor que le corresponde
claseSinResultado <clase fija> GENERATED ALWAYS AS ('MATERIA_EXCLUIDA_POR_PROHIBICION') STORED
FOREIGN KEY (resultadoId, claseSinResultado)
  REFERENCES ResultadoAnalisis(id, claseSinResultado) ON UPDATE RESTRICT
```

Con eso, un detalle de exclusión por materia **no puede colgar** de un resultado
marcado como falta de dato, y viceversa. La clasificación y su evidencia no se
pueden desincronizar, ni siquiera por un `UPDATE` posterior.

---

#### B.4 `Hallazgo`

Propósito: el hallazgo tal como lo define la spec §4.3. Versionado por
construcción: **nunca se pisa**; una reevaluación produce una fila nueva.

| Campo | Tipo | Cl. | Notas |
| --- | --- | --- | --- |
| `id` | `UUID` PK (v7) | INT | |
| `evaluacionId` | `UUID` FK | INT | |
| `resultadoAnalisisId` | `UUID` FK | INT | |
| `claveLinaje` | `TEXT` | INT | `${analisis}:${tipo}:${sujeto}`. Agrupa las versiones del mismo hallazgo a lo largo del tiempo. |
| `reemplazaHallazgoId` | `UUID?` FK | INT | Versión anterior del mismo linaje. |
| `analisis` / `tipo` | `enum` | INT | `TipoHallazgo` del contrato. |
| `idDeuda` | `TEXT` | INT | Sujeto del hallazgo. |
| `idRegistroCrediticio` | `TEXT?` | INT | CA-38: identifica **de qué registro** habla. |
| `idAfectacion` / `idCuenta` | `TEXT?` | INT | |
| `certeza` | `enum NivelCerteza` (`ALTA`,`MEDIA`,`BAJA`) | INT | |
| `impactoCentavos` | `BIGINT?` | **PATR** | Entero. Cifrado, ver §4.1. |
| `impactoMoneda` | `enum Moneda?` | INT | Obligatoria si hay impacto. Sin conversión: moneda de origen (spec §7). |
| `impactoSentidoRedondeo` | `enum SentidoRedondeo?` | PUB | CA-32. |
| `impactoRedondeoAFavorDelCliente` | `BOOLEAN?` | PUB | `false` sólo cuando una norma lo impone; en ese caso `impactoRedondeoCitaId` es obligatoria. |
| `claveSuperposicion` | `enum ClaveSuperposicion?` | INT | Spec §7: dos hallazgos con la misma clave describen el mismo peso y **no se suman**. |
| `esEstimacion` | `BOOLEAN` | INT | `CHECK (esEstimacion)`. Constitución #6. |
| `aptoComoBaseDeComision` | `BOOLEAN` | INT | `CHECK (NOT aptoComoBaseDeComision)`. **CA-61 y condición C-11 grabadas en la base**: la columna existe justamente para que sea imposible marcarla. |
| `requiereConfirmacionProfesional` | `BOOLEAN` | INT | `CHECK (requiereConfirmacionProfesional)`. S-02, CA-46. El hallazgo **nace** así y el valor nunca cambia; la confirmación vive en D.1, no acá. |
| `usaParametrosSinRatificar` | `BOOLEAN` | INT | CA-28. |
| `plantillaId` / `plantillaVersion` | FK | PUB | CA-49. |
| `visibilidadClase` | `enum PoliticaVisibilidad` (`DIFERIDA_HASTA_CONFIRMACION_PROFESIONAL`, `VISIBLE_PARA_PROFESIONAL_Y_OPERADOR`) | INT | CA-54. |
| `advertenciaPreventivaId` | `UUID?` FK → `AdvertenciaPreventiva.id` | INT | **Ver invariante 3.** |
| `plazoMaximoRevisionDiasHabiles` | `SMALLINT?` | INT | 10 por defecto (CA-55). |
| `fechaLimiteRevision` | `DATE?` | INT | Calculada con el calendario de E.1 al insertar. Se **materializa** en vez de calcularse en la consulta: sin columna no hay índice y la consulta de escalamiento recorre la tabla entera. |
| `estadoRevision` | `enum EstadoRevision` (`PENDIENTE`, `CONFIRMADO`, `RECHAZADO`, `CORREGIDO`) | INT | **Única columna mutable de la tabla.** Proyección de D.1, mantenida por disparador; existe sólo para poder indexar. La verdad está en D.1. |

**Invariantes.**

1. `CHECK ((impactoCentavos IS NULL) = (impactoMoneda IS NULL))` y
   `CHECK (impactoCentavos IS NULL OR impactoCentavos >= 0)`.
2. `CHECK (impactoRedondeoAFavorDelCliente IS NOT FALSE OR impactoRedondeoCitaId IS NOT NULL)` —
   redondear en contra del cliente exige norma citada (CA-32, constitución #1).
3. `CHECK (tipo <> 'A_POSIBLE_PRESCRIPCION' OR advertenciaPreventivaId IS NOT NULL)`
   — **un hallazgo de prescripción no puede existir sin su advertencia preventiva.**
   Es CA-54 y la métrica de 1,00 de la spec §10 hechas estructura: la advertencia
   se crea primero, en la misma transacción, y si falla no hay hallazgo. Lo que la
   base **no** puede garantizar es la *entrega* al cliente, que es un efecto
   externo: eso lo cubren C.4 y el escalamiento de E.2.
4. `CHECK (tipo <> 'A_POSIBLE_PRESCRIPCION' OR visibilidadClase = 'DIFERIDA_HASTA_CONFIRMACION_PROFESIONAL')` — decisión 004-B.
5. `UNIQUE (evaluacionId, claveLinaje)` — una evaluación no emite el mismo
   hallazgo dos veces.
6. `UNIQUE (id, estadoRevision)` y `UNIQUE (id, tipo)` como destinos de claves
   foráneas compuestas (§7.1 R-5 y R-6).
7. Sólo-inserción salvo `estadoRevision`. Sin `eliminadoEn`: un hallazgo no se da
   de baja, se supera con una versión nueva o se rechaza profesionalmente.

**Tablas satélite del hallazgo** (todas sólo-inserción, PK compuesta, borrado en
cascada sólo en el pedido de supresión):

| Tabla | Campos | Para qué |
| --- | --- | --- |
| `HallazgoParametroUsado` | `hallazgoId`, `tramoId` FK, `claveParametro`, `jurisdiccion`, `vigenciaDesde`, `vigenciaHasta`, `requiereValidacionProfesional`, `notaDeAlcance` | CA-27 y CA-28. Se guarda el **id del tramo** y además una copia de sus datos: el id permite reproducir, la copia permite explicar aunque el tramo se retire. |
| `HallazgoValorReferenciaUsado` | `hallazgoId`, `tramoValorId` FK, `clave`, valor, `vigencia`, `fuenteOrganismo`, `fuenteActo`, `idOperadorActivacion`, `fechaDeActivacion` | **CA-59 literal**: el resultado declara el valor usado, su fuente, su vigencia y **la fecha en que una persona lo activó**. |
| `HallazgoSupuesto` | `hallazgoId`, `clave` (`ClaveSupuesto`), `origen`, `valor` (`JSONB` de valores cerrados) | R-06: si un supuesto era falso, se reevalúa sin rehacer el análisis. |
| `HallazgoCita` | `hallazgoId`, `citaId` | CA-27. |
| `HallazgoAdvertenciaObligatoria` | `hallazgoId`, `plantillaId`, `plantillaVersion`, `orden` | CA-50. |
| `HallazgoAccionSugerida` | `hallazgoId`, `destinatario`, `idAccion`, `plantillaId`, `plantillaVersion` | CA-48. `CHECK (destinatario <> 'CLIENTE' OR idAccion IN ('CONSULTAR_AL_ABOGADO','NO_INNOVAR_SOBRE_LA_DEUDA'))` — S-04 en la base: **no es representable una acción dirigida al cliente fuera de esas dos.** |
| `HallazgoDetalleComputo` | `hallazgoId`, `JSONB` con el detalle por tramo (embargo) o por hecho (prescripción) | CA-20 "el resultado detalla el cálculo tramo por tramo". |

---

#### B.5 `AdvertenciaDeConjunto` y `GrupoDeImpacto`

`AdvertenciaDeConjunto`: `id`, `evaluacionId` FK, `clase`
(`NO_CONFUSION_PRESCRIPCION_Y_ARCHIVO` — CA-62/C-12,
`IMPACTOS_NO_ACUMULABLES`, `PARAMETROS_SIN_RATIFICAR_EN_LA_EVALUACION`),
`plantillaId`/`plantillaVersion`, `destinatarios`. Tabla puente
`AdvertenciaConjuntoHallazgo(advertenciaId, hallazgoId)`.

**Invariante de aplicación con respaldo en test** (§7.3): si una evaluación
produce a la vez un hallazgo `A_POSIBLE_PRESCRIPCION` y uno `C_DATO_CADUCADO`,
debe existir la advertencia `NO_CONFUSION_PRESCRIPCION_Y_ARCHIVO`. Es una regla
sobre el conjunto de filas de una evaluación; se expresa con un disparador
diferido al cierre de la transacción de la evaluación.

`GrupoDeImpacto`: `evaluacionId`, `claveSuperposicion`, `moneda`,
`montoMaximoNoAcumulableCentavos` (`PATR`). **No hay columna de total general**:
el dictamen (RL-07) prohíbe agregar todos los impactos en un número único, y la
forma de garantizarlo es que la columna no exista.

---

### Bloque C — Persona, advertencia y bitácora

#### C.1 `SujetoSeudonimo` — y dónde vive la reidentificación

Propósito: CA-60 y condición C-10. **En todo el esquema del motor no hay una sola
columna con nombre, documento, CUIT/CUIL, domicilio, contacto, CBU ni número de
tarjeta.**

`motor.SujetoSeudonimo`: `idSujeto` `TEXT` PK (ULID opaco, sin estructura
derivable), `creadoEn`, `anonimizadoEn TIMESTAMPTZ?`. Nada más. Clasificación
`PERS` por precaución, no porque el valor diga algo: es `PERS` **porque existe la
tabla de vínculo**.

La asociación con la persona real vive en **otro esquema de la misma base**,
`identidad`, propiedad de la feature 007:

```
identidad.VinculoSeudonimo
  idSujeto        TEXT PK      -- referencia por valor; sin FK entre esquemas
  idTitular       UUID         -- persona de la 007
  creadoEn        TIMESTAMPTZ
  finalidad       enum         -- 'DIAGNOSTICO_DE_DEUDA'
  consentimientoVersionId UUID -- frontera con la 007
  destruidoEn     TIMESTAMPTZ?
```

Controles de acceso, todos necesarios y ninguno suficiente por sí solo:

1. **Esquema y rol separados.** El rol de aplicación del motor
   (`rol_motor`) tiene `USAGE` sobre `motor` y **ninguna** sobre `identidad`.
   Resolver un seudónimo exige otro rol (`rol_identidad`), usado únicamente por
   el servicio de la 007 que arma las pantallas.
2. **Sin clave foránea entre esquemas.** Una clave foránea es una vía de
   inferencia y un obstáculo para destruir el vínculo. La referencia es por valor.
3. **Clave de cifrado distinta.** `identidad` se cifra con una clave que el rol
   del motor no puede usar (§4.3).
4. **Bitácora obligatoria.** Toda resolución de seudónimo escribe en C.5. La
   escritura se hace en la misma transacción mediante un disparador sobre la
   vista de resolución, no en el código de aplicación.
5. **RLS.** Ver §7.4.

#### C.2 `AsignacionProfesionalCaso` — aislamiento por perfil

Proyección mínima (la maestra es de la 007) para que el aislamiento del mandato,
regla 7, sea expresable en la base y no una convención del código.

`idProfesional`, `idDeuda`, `idSujeto`, `desde`, `hasta?`, `otorgadaPor`,
`revocadaEn?`. Índice `(idProfesional, idDeuda) WHERE revocadaEn IS NULL`.
Es la tabla que consultan las políticas RLS de §7.4.

#### C.3 `AdvertenciaPreventiva` — CA-54, CA-56, CA-57

| Campo | Tipo | Cl. | Notas |
| --- | --- | --- | --- |
| `id` | `UUID` PK | INT | |
| `idDeuda` | `TEXT` | INT | |
| `idSujeto` | `TEXT` FK | PERS | |
| `claveLinajeHallazgo` | `TEXT` | INT | Se emite una vez por linaje, no por reevaluación: una deuda no genera catorce advertencias idénticas. |
| `plantillaId` / `plantillaVersion` | FK | PUB | `CHECK (plantillaId = 'A_ADVERTENCIA_PREVENTIVA')`. |
| `generadaEn` | `TIMESTAMPTZ` | INT | |
| `gratuita` | `BOOLEAN` | INT | `CHECK (gratuita)`. |
| `condicionadaAContratacion` | `BOOLEAN` | INT | `CHECK (NOT condicionadaAContratacion)`. **CA-56 y constitución #8 en la base**: no se puede escribir una advertencia paga ni condicionada. |
| `planDelClienteAlMomento` | `TEXT` | INT | Incluido `GRATUITO`. Se guarda para poder **probar** en auditoría que se entregó en todos los planes; sin este campo, la métrica de CA-56 no se puede desagregar. |
| `claveIdempotencia` | `TEXT` | INT | `UNIQUE`, derivada de `(idDeuda, claveLinajeHallazgo)`. Constitución #12. |

#### C.4 `EntregaAdvertencia`

| Campo | Tipo | Cl. | Notas |
| --- | --- | --- | --- |
| `id` | `UUID` PK | INT | |
| `advertenciaId` | `UUID` FK | INT | |
| `canal` | `enum Canal` (`APP`, `WEB`, `EMAIL`, `PUSH`, `SMS`) | INT | |
| `destinatarioSeudonimo` | `TEXT` | PERS | **A quién**: nunca la dirección de correo ni el teléfono, que viven en la 007. |
| `estado` | `enum EstadoEntrega` (`ENCOLADA`, `ENVIADA`, `ENTREGADA`, `FALLIDA`, `LEIDA`) | INT | Única columna mutable, con historial en `EntregaAdvertenciaEvento`. |
| `encoladaEn` / `enviadaEn?` / `entregadaEn?` / `leidaEn?` | `TIMESTAMPTZ` | INT | **Cuándo**, con granularidad por hito. |
| `detalleFallo` | `enum?` | INT | Catálogo cerrado; sin texto del proveedor (puede filtrar el correo). |
| `claveIdempotencia` | `TEXT` | INT | `UNIQUE (advertenciaId, canal, intento)`. Evita el aviso duplicado. |

`EntregaAdvertenciaEvento(id, entregaId, estado, ocurridoEn, origen)`: append-only.
**Es la tabla que hace auditable "se entregó, a quién, cuándo"**, y la que
sostiene la métrica de 1,00 (consulta Q-07 en §3).

#### C.5 `BitacoraAcceso` — inmutable

Constitución #5 y Ley 25.326. Un hallazgo del análisis D contiene la remuneración
de la persona: toda lectura queda registrada.

`id` (`BIGSERIAL`), `ocurridoEn`, `idActor` (`PERS`, opaco), `rolActor`
(`CLIENTE`, `ABOGADO`, `OPERADOR`, `ADMINISTRADOR`, `SISTEMA`, `AUDITORIA`),
`accion` (`LECTURA`, `EXPORTACION`, `RESOLUCION_DE_SEUDONIMO`, `SUPRESION`),
`entidad`, `entidadId`, `idSujetoAlcanzado` (`PERS`), `proposito` (enum cerrado),
`resultado` (`PERMITIDO`, `DENEGADO`), `origenIpHash` (`PERS`, HMAC con clave de
servidor — nunca la IP en claro), `correlacionId`.

**Inmutabilidad.** Sin `UPDATE` ni `DELETE`: se revocan los privilegios al rol de
aplicación y se agrega un disparador `BEFORE UPDATE OR DELETE` que lanza
excepción. Particionada por mes para que la retención se ejecute soltando
particiones y no con borrados masivos.

#### C.6 `SolicitudSupresionTitular` y `ConstanciaDeSupresion`

Ley 25.326 art. 16. Ver §5.3 para el procedimiento.

`SolicitudSupresionTitular`: `id`, `idSujeto`, `recibidaEn`, `canal`,
`alcancePedido` (`TODO`, `SOLO_HALLAZGOS`, `SOLO_ENTRADAS`),
`fechaLimiteRespuesta` (5 días hábiles, `[C]` — parámetro, no constante:
`archivoCrediticio.plazoRespuestaSupresion`), `estado`
(`RECIBIDA`, `EN_ANALISIS`, `EJECUTADA`, `EJECUTADA_PARCIALMENTE`, `DENEGADA`),
`resueltaEn?`, `motivoDenegacionOParcialidad` (enum cerrado),
`claveIdempotencia UNIQUE`.

`ConstanciaDeSupresion` — **constancia del hecho, no del dato**:
`id`, `solicitudId`, `ejecutadaEn`, `categoriasSuprimidas` (enum array),
`cantidadRegistros` por categoría, `huellaConjuntoSuprimido` (SHA-256 del
conjunto destruido, sirve para demostrar qué se destruyó sin conservarlo),
`retenidoPorObligacionLegal` `BOOLEAN`, `fundamentoRetencionCitaId?`,
`operador`, `firmaResponsable`. **No contiene ningún dato del titular más allá de
su seudónimo.**

---

### Bloque D — Revisión profesional

#### D.1 `RevisionProfesional`

Propósito: CA-46, CA-47, CA-51, R-08, S-03 y S-07.

| Campo | Tipo | Cl. | Notas |
| --- | --- | --- | --- |
| `id` | `UUID` PK | INT | |
| `hallazgoId` | `UUID` FK | INT | |
| `hallazgoTipo` | `enum` | INT | Réplica con clave foránea compuesta, para las reglas por tipo. |
| `idProfesional` | `TEXT` FK → `MatriculaProfesional.idProfesional` | PERS | |
| `matriculaEstado` | `enum EstadoMatricula` | PERS | Réplica; ver invariante 1. |
| `matricula` | `TEXT` | PERS | Copia histórica. |
| `jurisdiccionMatricula` | `enum Jurisdiccion` | PERS | |
| `identidadVerificadaMetodo` | `enum` (`SESION_MFA`, `FIRMA_DIGITAL`, `PRESENCIAL`) | PERS | CA-47 pide "identidad": el campo registra **cómo** se acreditó, no un documento. |
| `identidadVerificadaEn` | `TIMESTAMPTZ` | PERS | |
| `fecha` | `DATE` | INT | |
| `decision` | `enum DecisionProfesional` (`CONFIRMADO`, `RECHAZADO`, `CORREGIDO`) | INT | |
| `motivoCorreccion` | `enum ClaveMotivoCorreccion?` | INT | |
| `impactoCorregidoCentavos` | `BIGINT?` | **PATR** | |
| `impactoCorregidoMoneda` | `enum Moneda?` | INT | |
| `certezaCorregida` | `enum NivelCerteza?` | INT | |
| `observacion` | `TEXT?` | **PATR** | Texto libre **del profesional**, no del motor. S-05 restringe al motor, no al abogado. Cifrado. |
| `reemplazaRevisionId` | `UUID?` FK | INT | Un profesional puede rever su decisión; no se pisa. |
| `claveIdempotencia` | `TEXT` | INT | `UNIQUE`. |

**Invariantes.**

1. `CHECK (length(trim(matricula)) > 0)` **y**
   `FOREIGN KEY (idProfesional, matriculaEstado) REFERENCES MatriculaProfesional(idProfesional, estado)`
   **y** `CHECK (matriculaEstado = 'VIGENTE')`.
   Es CA-47 al pie: *"una confirmación sin matrícula registrada es rechazada"*.
   No es validación de servicio: **una revisión de alguien sin matrícula vigente
   registrada no se puede insertar.**
2. `CHECK (decision <> 'CORREGIDO' OR motivoCorreccion IS NOT NULL)`.
3. `CHECK (decision <> 'CORREGIDO' OR impactoCorregidoCentavos IS NOT NULL OR certezaCorregida IS NOT NULL)`.
4. `UNIQUE (id, decision)` — destino de clave foránea compuesta desde D.2.
5. Sólo-inserción. La decisión vigente de un hallazgo es la revisión más reciente
   de su cadena; `Hallazgo.estadoRevision` la refleja por disparador.

#### D.2 `ExposicionAlCliente` — cómo prevalece la decisión del profesional

Propósito: CA-51 y S-07 dicen que la decisión del profesional prevalece y que un
hallazgo rechazado **no se presenta como vigente al cliente**. Si eso queda en una
consulta del código, alcanza con una consulta mal escrita para romperlo. Acá es
estructura: **el hallazgo no llega al cliente por consulta directa, llega por esta
tabla, y esta tabla exige una confirmación.**

| Campo | Tipo | Cl. | Notas |
| --- | --- | --- | --- |
| `id` | `UUID` PK | INT | |
| `hallazgoId` | `UUID` FK | INT | |
| `revisionId` | `UUID` FK | INT | |
| `revisionDecision` | `enum` columna generada `'CONFIRMADO'` | INT | |
| `accionRecomendadaPlantillaId` / `Version` | FK | PUB | `NOT NULL`. |
| `encabezadoPlantillaId` / `Version` | FK | PUB | `NOT NULL`. |
| `expuestoEn` | `TIMESTAMPTZ` | INT | |
| `revocadaEn` | `TIMESTAMPTZ?` | INT | Si una revisión posterior rechaza, se revoca la exposición y queda el rastro. |

**Invariantes.**

1. `FOREIGN KEY (revisionId, revisionDecision) REFERENCES RevisionProfesional(id, decision) ON UPDATE RESTRICT`
   con la columna generada fija en `'CONFIRMADO'`: **no se puede exponer al
   cliente un hallazgo cuya revisión no sea una confirmación.** Un hallazgo
   rechazado no tiene forma de llegar a esta tabla.
2. `accionRecomendadaPlantillaId NOT NULL` — **CA-57**: el hallazgo confirmado
   nunca se muestra solo. La ausencia de acción hace fallar el `INSERT`.
3. `encabezadoPlantillaId NOT NULL` con `CHECK (= 'ENCABEZADO_GLOBAL_DIAGNOSTICO')` — CA-50, S-06.
4. La vista `motor.hallazgo_para_cliente` se define **sobre esta tabla**, no sobre
   `Hallazgo`, y es la única a la que el rol del portal del cliente tiene
   `SELECT`. Al rol del cliente se le **revoca** el acceso a `Hallazgo` (§7.4).

#### D.3 `EscalamientoRevision` — CA-55

| Campo | Tipo | Cl. | Notas |
| --- | --- | --- | --- |
| `id` | `UUID` PK | INT | |
| `hallazgoId` | `UUID` FK | INT | |
| `fechaLimite` | `DATE` | INT | Copiada de `Hallazgo.fechaLimiteRevision`. |
| `detectadoEn` | `TIMESTAMPTZ` | INT | |
| `diasHabilesDeAtraso` | `SMALLINT` | INT | |
| `escaladoA` | `TEXT` | PERS | Actor opaco. |
| `incumplimientoRegistrado` | `BOOLEAN` | INT | `CHECK (incumplimientoRegistrado)`. CA-55 pide que **quede registrado el incumplimiento**, no sólo que se escale. |
| `resueltoEn` | `TIMESTAMPTZ?` | INT | |
| `claveIdempotencia` | `TEXT` | INT | `UNIQUE (hallazgoId, fechaLimite)`. Un vencimiento escala una vez. |

---

### Bloque E — Apoyo

#### E.1 `DiaNoHabil`

CA-55 habla de **días hábiles** y la Ley 25.326 art. 16 también (`[C]`). Sin
calendario, "10 días hábiles" es una aproximación y el escalamiento se dispara
mal. `jurisdiccion`, `fecha`, `motivo` (`FERIADO_NACIONAL`, `NO_LABORABLE`,
`ASUETO`, `FERIA_JUDICIAL`), `fuenteCitaId?`. PK `(jurisdiccion, fecha)`. Todo `PUB`.

#### E.2 `ParametroDeProducto`

Los umbrales que **no son normativos** (`prescripcion.umbralAlertaDias` = 180,
`archivoCrediticio.umbralAlertaDias` = 90, `plazoMaximoRevisionDiasHabiles` = 10,
tope interno de CA-44) viven en A.1/A.2 con `esNormativo = false` y
`notaDeAlcance = UMBRAL_DE_ALERTA_INTERNO_NO_TOPE_LEGAL`. **No se crea una tabla
aparte**: comparten la necesidad de vigencia y de reproducibilidad, y separarlos
haría que un umbral cambiado no quede en la trazabilidad del hallazgo. Lo que sí
los separa es que `requiereValidacionProfesional` se deriva de `esNormativo`: un
umbral de producto no bloquea producción por falta de firma del estudio.

---

## 2. Diagrama de relaciones

```
Bloque A — catálogo                                Bloque B — evaluación
┌───────────────────────┐                          ┌──────────────────────────┐
│ ParametroNormativo    │1                        1│ EntradaEvaluacionCifrada │
│  clave (PK)           │                          └───────────▲──────────────┘
└──────────┬────────────┘                                      │0..1
           │N                                                  │
┌──────────▼────────────┐                          ┌───────────┴──────────────┐
│ TramoParametro        │◄────┐              ┌────►│ Evaluacion               │
│  vigencia DATERANGE   │     │              │     │  fechaDeEvaluacion       │
│  disponibilidad       │     │              │     │  claveIdempotencia (U)   │
│  estadoRatificacion   │     │              │     └───────────┬──────────────┘
│  U(id,estadoRatific.) │     │              │                 │1..N
└───┬───────────┬───────┘     │              │     ┌───────────▼──────────────┐
    │N:M        │N            │FK compuesta  │     │ ResultadoAnalisis        │
┌───▼────────┐  │         ┌───┴───────────┐  │     │  clase                   │
│CitaNormativa│ │         │ CatalogoTramo │  │     │  claseSinResultado       │
└───┬─────────┘ │         │ (A.6)         │  │     │  U(id, claseSinResultado)│
    │           │0..1     └───┬───────────┘  │     └──┬────┬────┬─────────┬───┘
    │      ┌────▼───────┐     │N             │        │    │    │         │1..N
    │      │Ratificacion│  ┌──▼────────────┐ │        │    │    │    ┌────▼──────┐
    │      │ matricula  │  │CatalogoNormat.│─┘   FALTANTE EXCLUSION  │ Hallazgo  │
    │      └────┬───────┘  │ aptoProduccion│      (n)    MATERIA(0..1)│ claveLin. │
    │           │N:1       │ U(ver,apto)   │            REGIMEN_DISPUTA(0..1)     │
    │      ┌────▼────────┐ └───────────────┘   ── las tres, con FK compuesta ──   │
    │      │MatriculaProf│                                            └──┬────┬───┘
    │      │U(id,estado) │◄──────────────┐                               │N   │N
    │      └─────────────┘               │                    satélites ─┘    │
    │                                    │                 (parámetros usados,│
┌───▼──────────────┐  ┌──────────────────┴────┐            valores ref.,      │
│ PlantillaTexto   │  │ RevisionProfesional   │            supuestos, citas,  │
│ (id, version) PK │  │  U(id, decision)      │            acciones)          │
└───┬──────────────┘  └───────────┬───────────┘                              │
    │                             │1                                         │
    │                 ┌───────────▼───────────┐   FK compuesta exige         │
    │                 │ ExposicionAlCliente   │───  decision='CONFIRMADO' ────┘
    │                 │  accionRecomendada NN │
    │                 └───────────────────────┘
Bloque C — persona                          ┌────────────────────┐
┌──────────────────┐   1      0..N          │ EscalamientoRevis. │
│ SujetoSeudonimo  │──────────────────┐     └────────▲───────────┘
└────────┬─────────┘                  │              │ (Hallazgo vencido)
         │ (por valor, SIN FK)   ┌────▼────────────────────┐
┌────────▼──────────┐            │ AdvertenciaPreventiva   │1
│ identidad.Vinculo │            │  gratuita CHECK true    │
│  Seudonimo        │            └────────┬────────────────┘
│  (otro esquema,   │                     │N
│   otro rol,       │            ┌────────▼────────────────┐
│   otra clave)     │            │ EntregaAdvertencia      │──► EntregaAdvertenciaEvento
└───────────────────┘            └─────────────────────────┘
      BitacoraAcceso (particionada, inmutable) ── registra lecturas de todo lo anterior
```

Sentido de las dependencias: el catálogo **no conoce** a las evaluaciones; las
evaluaciones apuntan al catálogo. Nada del esquema `motor` apunta a `identidad`.
`Hallazgo` apunta a `AdvertenciaPreventiva` y no al revés (permite crear la
advertencia primero y hacer obligatorio el vínculo).

---

## 3. Índices y patrones de acceso

Cada índice con la consulta que lo motiva. Un índice sin consulta se saca.

| # | Consulta esperada | Origen | Frecuencia | Índice que la sirve |
| --- | --- | --- | --- | --- |
| Q-01 | Hallazgos de una deuda, última versión de cada linaje. | Portal abogado/operador; spec §4.5 | Muy alta | `idx_hallazgo_deuda_linaje` sobre `Hallazgo (idDeuda, claveLinaje, creadoEn DESC)`. Cubre el `DISTINCT ON (claveLinaje)`. |
| Q-02 | Hallazgos de una deuda visibles para el cliente. | CA-51, CA-54 | Muy alta | `idx_exposicion_hallazgo` sobre `ExposicionAlCliente (hallazgoId) WHERE revocadaEn IS NULL`, más el índice de Q-01 para el `JOIN`. |
| Q-03 | **Hallazgos pendientes de confirmación, por antigüedad, con plazo vencido.** | **CA-55** | Alta (proceso periódico + tablero) | `idx_hallazgo_pendiente_vencimiento` sobre `Hallazgo (fechaLimiteRevision ASC) WHERE estadoRevision = 'PENDIENTE' AND fechaLimiteRevision IS NOT NULL`. Índice **parcial**: la cola de pendientes es una fracción mínima de la tabla y el escaneo es del tamaño de la cola, no de la historia. |
| Q-03b | Pendientes asignados a un abogado concreto, por antigüedad. | CA-55 + aislamiento | Alta | `idx_asignacion_prof` sobre `AsignacionProfesionalCaso (idProfesional, idDeuda) WHERE revocadaEn IS NULL`. |
| Q-04 | **Parámetro vigente a la fecha del hecho**, para una clave y jurisdicción. | **CA-29, CA-18, CA-35** | Altísima (cada evaluación, varias veces) | La restricción de exclusión GiST `ix_tramo_vigencia` sobre `(claveParametro, jurisdiccion, vigencia)` sirve `WHERE claveParametro = $1 AND jurisdiccion = $2 AND vigencia @> $3::date`. **Sin `ORDER BY ... LIMIT 1` de respaldo**: si no hay fila, hay sin-resultado, nunca el último valor conocido. |
| Q-05 | Todos los tramos de un catálogo, para publicarlo o reproducirlo. | CA-27, CA-31 | Media | PK `(catalogoVersion, tramoId)` de `CatalogoTramo`. |
| Q-06 | Valor de referencia activo a la fecha del hecho. | CA-59, CA-18 | Alta | Exclusión GiST `ix_valorref_vigencia` sobre `(clave, claveDesambiguacion, vigencia) WHERE estado = 'ACTIVO'`. |
| Q-07 | **Auditoría de advertencias: para cada hallazgo de prescripción pendiente, ¿existe advertencia y fue entregada, a quién y cuándo?** Métrica 1,00. | **CA-54, CA-56, spec §10** | Diaria | `idx_advertencia_linaje` `UNIQUE` sobre `AdvertenciaPreventiva (idDeuda, claveLinajeHallazgo)`; `idx_entrega_advertencia` sobre `EntregaAdvertencia (advertenciaId, estado)`; `idx_entrega_evento` sobre `EntregaAdvertenciaEvento (entregaId, ocurridoEn DESC)`. La mitad de la métrica ya está garantizada por la invariante 3 de B.4 (no hay hallazgo sin advertencia); el índice sirve la parte de **entrega**, que sí puede fallar. |
| Q-08 | Advertencias sin entrega confirmada tras N horas. | CA-56 | Diaria | `idx_entrega_pendiente` sobre `EntregaAdvertencia (encoladaEn) WHERE estado IN ('ENCOLADA','ENVIADA','FALLIDA')`. Parcial. |
| Q-09 | Ratificaciones con revisión vencida y tramos sin ratificar. | C-03, CA-58 | Diaria + tablero admin | `idx_ratificacion_revision` sobre `Ratificacion (fechaProximaRevision) WHERE revocadaEn IS NULL AND fechaProximaRevision IS NOT NULL`; `idx_tramo_sin_ratificar` sobre `TramoParametro (claveParametro) WHERE estadoRatificacion = 'SIN_RATIFICAR' AND retiradoEn IS NULL`. |
| Q-10 | Valores de referencia propuestos sin activar. | CA-59 | Diaria | `idx_valorref_propuesto` sobre `TramoValorReferencia (fechaDeObtencion) WHERE estado = 'PROPUESTO'`. |
| Q-11 | **Por qué el sistema no dio un número: conteo por clase de sin-resultado, por análisis y por período.** | v3, CA-63, CA-64; auditoría | Semanal | `idx_resultado_sinresultado` sobre `ResultadoAnalisis (claseSinResultado, analisis, creadoEn) WHERE clase = 'SIN_RESULTADO'`. Es la consulta que separa "nos falta un dato" de "la ley nos prohíbe" de "hay disputa transitoria". |
| Q-12 | Qué parámetro bloquea más evaluaciones (cola de trabajo del estudio). | C-03 | Semanal | `idx_faltante_parametro` sobre `SinResultadoFaltante (claveParametro) WHERE claveParametro IS NOT NULL`. |
| Q-13 | Reproducir un resultado pasado: evaluación por deuda y fecha. | CA-27, CA-31 | Baja, crítica | `idx_evaluacion_deuda_fecha` sobre `Evaluacion (idDeuda, fechaDeEvaluacion DESC)`; `UNIQUE (claveIdempotencia)`. |
| Q-14 | Todos los hallazgos que usaron un tramo que resultó mal cargado (reevaluación dirigida). | Revocación de ratificación, A.4 inv. 2 | Baja, crítica | `idx_hpu_tramo` sobre `HallazgoParametroUsado (tramoId)`. |
| Q-15 | Bitácora de un sujeto en un período. | Constitución #5, habeas data | Baja | `idx_bitacora_sujeto` sobre `BitacoraAcceso (idSujetoAlcanzado, ocurridoEn DESC)`, local a cada partición mensual. |
| Q-16 | Accesos de un actor en un período (investigación de uso indebido). | Ley 25.326 | Baja | `idx_bitacora_actor` sobre `BitacoraAcceso (idActor, ocurridoEn DESC)`. |
| Q-17 | Casos excluidos por materia esperando dictamen. | CA-63 | Semanal | `idx_exclusion_pendiente` sobre `SinResultadoExclusionMateria (materia) WHERE estadoDictamen = 'PENDIENTE'`. |

Índices **descartados** por no tener consulta: ninguno sobre `huellaEntradaCanonica`
(se busca por `claveIdempotencia`), ninguno sobre `impactoCentavos` (está cifrado
y no se ordena por impacto: agregar impactos en un ranking es justo lo que RL-07
desaconseja), ninguno sobre `certeza`.

---

## 4. Datos sensibles

### 4.1 Clasificación y tratamiento

| Campo | Entidad | Clasificación | Tratamiento | Base legal |
| --- | --- | --- | --- | --- |
| `contenido` (entrada serializada: remuneración, composición de saldo, tasas) | `EntradaEvaluacionCifrada` | **PATRIMONIAL SENSIBLE** | AES-256-GCM con clave dedicada `k_entrada`, AAD = `evaluacionId`. Nunca indexado. Destruible de forma independiente (§5.3). | Ejecución del contrato (art. 5 inc. 2 Ley 25.326 `[P]`) + consentimiento informado para la finalidad "diagnóstico de deuda". |
| `impactoCentavos` | `Hallazgo` | **PATRIMONIAL SENSIBLE** | AES-256-GCM a nivel de columna con clave `k_hallazgo`. No se indexa, no se ordena, no se agrega en SQL. Los totales por grupo se calculan en la aplicación tras descifrar. | Ídem. |
| `montoMaximoNoAcumulableCentavos` | `GrupoDeImpacto` | **PATRIMONIAL SENSIBLE** | Ídem `k_hallazgo`. | Ídem. |
| `impactoCorregidoCentavos`, `observacion` | `RevisionProfesional` | **PATRIMONIAL SENSIBLE** | Ídem `k_hallazgo`. | Ejecución del contrato con el profesional; responsabilidad profesional identificable. |
| `fechaDelHecho` | `SinResultadoRegimenEnDisputa` | **PATRIMONIAL SENSIBLE** | Cifrada. Aislada, una fecha no dice nada; junto al resto ubica un despido o una mora. | Ídem. |
| `JSONB` de detalle | `HallazgoDetalleComputo` | **PATRIMONIAL SENSIBLE** | Cifrado completo. Contiene el cálculo tramo por tramo, o sea la remuneración. | Ídem. |
| `valor` del supuesto cuando su origen es `DATO_DE_ENTRADA` | `HallazgoSupuesto` | **PATRIMONIAL SENSIBLE** | Cifrado. Los supuestos de origen `PARAMETRO` o `REGLA_DEL_MOTOR` son `PUB` y quedan en claro: son la norma, no el caso. Se separan en dos columnas, `valorPublico` y `valorCifrado`, con `CHECK` de exclusión mutua según `origen`. | Ídem. |
| `idSujeto`, `idDeuda`, `idRegistroCrediticio`, `idAfectacion`, `idCuenta`, `idActor`, `destinatarioSeudonimo`, `escaladoA` | varias | PERSONAL | **Identificadores opacos (ULID v7 aleatorio), sin estructura derivable, sin relación con documento ni número de cuenta.** En claro: son la clave de acceso y tienen que ser indexables. Su reidentificación exige el esquema `identidad`. | Minimización, art. 4 Ley 25.326 `[P]`; CA-60, C-10. |
| `origenIpHash` | `BitacoraAcceso` | PERSONAL | HMAC-SHA256 con clave de servidor. La IP en claro no se guarda nunca. | Deber de registro de accesos; constitución #5. |
| `nombreProfesional`, `matricula`, `jurisdiccionMatricula`, `identidadVerificadaMetodo` | `Ratificacion`, `RevisionProfesional`, `MatriculaProfesional` | PERSONAL | **En claro y con índice.** Es dato profesional público en el padrón del colegio y su finalidad es precisamente la identificabilidad (CA-47, S-03). Cifrarlo impediría verificar la matrícula. Acceso restringido a los roles `AUDITORIA` y `ADMINISTRADOR`. | Ejecución del contrato con el abogado; responsabilidad profesional identificable (dictamen §2.1). |
| `materia` | `SinResultadoExclusionMateria` | PERSONAL | En claro (hace falta agrupar por materia, Q-17). Ver **escalamiento E-3**: cuando la materia es `ALIMENTARIA` o hay intervención de una persona menor de edad, el dato dice algo de un tercero. | **A confirmar por `compliance-legal`.** |
| `planDelClienteAlMomento` | `AdvertenciaPreventiva` | INTERNO | En claro. Es dato comercial de la plataforma, necesario para probar CA-56. | Ejecución del contrato. |
| Todo el bloque A (parámetros, citas, vigencias, plantillas, términos prohibidos) | — | PÚBLICO | En claro, replicable, cacheable. Es la ley y nuestra lectura de la ley. | No es dato personal. |
| Versiones, huellas, claves de idempotencia, entornos, estados | — | INTERNO | En claro. Ninguna revela nada del titular: `huellaEntradaCanonica` es un SHA-256 con sal por instalación, no reversible por fuerza bruta sobre un espacio chico. | — |

### 4.2 La regla de minimización, hecha explícita en el esquema

Además de no crear las columnas, se agrega una defensa contra la reincidencia
futura: una prueba de migración que recorre `information_schema.columns` del
esquema `motor` y **falla** si aparece una columna cuyo nombre coincida con la
lista `ClaveProhibidaPorMinimizacion` del contrato (`nombre`, `dni`, `cuit`,
`cuil`, `domicilio`, `email`, `telefono`, `cbu`, `numeroTarjeta`, …). Es el
equivalente en base de datos de la barrera de tipos `Minimizada<T>` que el
`arquitecto` puso en el contrato. Corre en CI, la ejecuta el `tester`.

### 4.3 Claves de cifrado

Tres claves distintas, gestionadas fuera de la base (el `cicd` define el
almacén en G6):

| Clave | Cifra | Quién la usa | Por qué separada |
| --- | --- | --- | --- |
| `k_entrada` | `EntradaEvaluacionCifrada.contenido` | Sólo el servicio de evaluación | Permite **destruir la capacidad de recalcular** sin tocar los hallazgos: se descarta la clave de un período o se anula la fila. |
| `k_hallazgo` | Importes y detalles de `Hallazgo`, `RevisionProfesional`, `GrupoDeImpacto` | Servicios de lectura con RLS | Vida más larga que `k_entrada`. |
| `k_identidad` | Esquema `identidad` | Sólo `rol_identidad` | El rol del motor no puede descifrarla aunque lea las filas. |

Rotación: `idClave` por fila, re-cifrado en segundo plano, sin `UPDATE` de datos
de negocio (sólo cambian `contenido`, `nonce`, `tag`, `idClave`). El disparador de
inmutabilidad admite esa excepción y la registra en `BitacoraAcceso` con acción
`ROTACION_DE_CLAVE`.

---

## 5. Retención y supresión

### 5.1 Plazo por entidad

| Entidad | Plazo de conservación | Criterio de supresión / anonimización |
| --- | --- | --- |
| `ParametroNormativo`, `TramoParametro`, `CitaNormativa`, `CatalogoNormativo`, `CatalogoTramo`, `PlantillaTexto`, `TerminoProhibido`, `DiaNoHabil` | **Indefinido.** | No son datos personales. Conservarlos es lo que hace reproducible un resultado pasado (CA-31) y es prueba en un habeas data. No se suprimen nunca, ni siquiera a pedido del titular: no hay nada suyo adentro. |
| `Ratificacion`, `MatriculaProfesional` | **Mientras exista algún hallazgo o catálogo que dependa de ellas, más el plazo de prescripción de la responsabilidad profesional.** Ese plazo es **`[D]` — escalamiento E-2**: el dictamen §2.1 lo deja sin determinar. Valor provisorio de trabajo hasta que el estudio responda: 10 años; **no se implementa ninguna purga automática hasta tener el dictamen**. | Anonimización no aplicable: sin la identidad del profesional, la ratificación pierde todo su sentido (C-03, CA-47). Ante baja del profesional se marca `eliminadoEn` en la matrícula y se conservan las ratificaciones. |
| `EntradaEvaluacionCifrada` | **12 meses desde la evaluación, o hasta el cierre del caso, lo que ocurra primero.** Es el plazo más corto del modelo y es deliberado. | Destrucción del `contenido` (`NULL`) conservando `id`, `destruidaEn` y `motivoDestruccion`. Tras esto el resultado **se explica pero no se recalcula**. |
| `Evaluacion`, `ResultadoAnalisis` y sus tres tablas de detalle | Igual que el hallazgo al que pertenecen. Una evaluación sin hallazgos (todo `SIN_RESULTADO`): **24 meses**, salvo `MATERIA_EXCLUIDA` y `REGIMEN_EN_DISPUTA`, que se conservan mientras el dictamen esté pendiente porque son la lista de trabajo del estudio. | Anonimización: se conserva la fila con `idSujeto` reemplazado por un marcador y se destruyen los campos `PATR`. Las estadísticas de Q-11 sobreviven. |
| `Hallazgo` y satélites | **Hasta el cierre del caso más el plazo de conservación probatoria.** Ver §5.3: el plazo depende de si el hallazgo sustenta un reclamo activo. | Anonimización por destrucción del vínculo (§5.3, paso 2) o destrucción completa (paso 4). |
| `RevisionProfesional`, `ExposicionAlCliente`, `EscalamientoRevision` | Igual que el hallazgo, **con un piso**: mientras corra la responsabilidad profesional del abogado que firmó (E-2). | Se conserva la decisión profesional y su matrícula; se destruyen los campos `PATR` (`observacion`, `impactoCorregidoCentavos`). |
| `AdvertenciaPreventiva`, `EntregaAdvertencia`, `EntregaAdvertenciaEvento` | **5 años desde la entrega.** Es la prueba de cumplimiento de CA-54/CA-56, cuya métrica es 1,00 sin excepción: destruirla nos deja sin poder demostrar que cumplimos. | Se conserva; tras la supresión del titular queda sólo con seudónimo (deja de ser dato personal para el responsable, §5.3 paso 2). |
| `BitacoraAcceso` | **5 años**, particionada por mes. | Se ejecuta soltando particiones. **No se suprime a pedido del titular**: es el registro de la licitud del tratamiento y su destrucción perjudicaría al propio titular en un eventual reclamo. Tras la desvinculación sólo contiene seudónimos. |
| `SolicitudSupresionTitular`, `ConstanciaDeSupresion` | **10 años.** | Nunca se suprimen: son la constancia del hecho. No contienen dato del titular más allá del seudónimo. |
| `AlertaVencimiento` | 3 años. | No hay dato personal. |

### 5.2 Nada se borra — y las dos excepciones

Regla general del proyecto: baja lógica. En este modelo casi no hay `eliminadoEn`
porque casi nada admite baja: un parámetro se **retira** (`retiradoEn`) y un
hallazgo se **supera**. Sólo `MatriculaProfesional` y `AsignacionProfesionalCaso`
tienen baja lógica clásica.

Hay **dos** situaciones en que sí se destruye:

1. Vencimiento del plazo de retención de `EntradaEvaluacionCifrada` (borrado
   programado, con constancia).
2. Pedido de supresión del titular (Ley 25.326 art. 16) — a continuación.

### 5.3 Supresión del titular: cómo se resuelve la tensión entre prueba y derecho

**El conflicto es real y no se resuelve eligiendo un bando.** El hallazgo es a la
vez (a) dato patrimonial del titular, sobre el que tiene derecho de supresión, y
(b) la prueba que sostiene *su propio* reclamo de prescripción, de caducidad del
archivo o de readecuación del embargo. Destruirlo mientras el reclamo está en
curso lo perjudica a él. Conservarlo indefinidamente porque "algún día puede
servir" es exactamente lo que el art. 4 prohíbe.

El procedimiento tiene cuatro pasos y está diseñado para que el caso frecuente se
resuelva **sin** invocar ninguna excepción:

**Paso 1 — Registro y plazo.** Se crea `SolicitudSupresionTitular` con
`fechaLimiteRespuesta` calculada con el parámetro
`archivoCrediticio.plazoRespuestaSupresion` (5 días hábiles `[C]`) y el calendario
E.1. El plazo es un parámetro, no una constante.

**Paso 2 — Desvinculación primero, borrado después.** Se destruye la fila de
`identidad.VinculoSeudonimo` y la clave de derivación asociada. A partir de ahí
**el responsable pierde la capacidad de asociar el seudónimo con la persona**, y
lo que queda en el esquema `motor` es un conjunto de registros seudonimizados.
Este es el paso que resuelve el 90% de la tensión: se satisface el derecho
—nosotros ya no sabemos que es él— sin destruir la cadena de trazabilidad que
puede necesitarse en un reclamo.

> **Salvedad honesta, no cosmética.** La desvinculación no es anonimización
> perfecta: un hallazgo del análisis D contiene una remuneración y unas fechas, y
> con datos externos alguien podría reidentificar. Por eso el paso 2 **no alcanza
> por sí solo** y va siempre acompañado del paso 3 o del 4.

**Paso 3 — Sólo si hay un reclamo activo que se apoya en el hallazgo.** El
hallazgo pasa a estado de **conservación probatoria**: se mueve a un espacio con
acceso restringido al abogado asignado y a auditoría, se le quita toda exposición
(`ExposicionAlCliente.revocadaEn`), no participa de ningún proceso comercial ni
analítico, y se le fija fecha de revisión. Al titular se le informa qué se
conservó, por qué y hasta cuándo. Cumplido el término, se ejecuta el paso 4.

> **Este paso invoca una excepción al derecho de supresión y ésa es una
> afirmación jurídica que yo no puedo hacer.** El art. 16 de la Ley 25.326 `[P]`
> y su reglamentación admitirían no suprimir cuando media una obligación legal de
> conservar o cuando la supresión perjudicaría derechos de terceros, pero **eso
> no está verificado en fuente oficial en este proyecto** (el dictamen §8 y la
> ronda del 2026-09-20 lo dejan sin verificar) y el plazo concreto de
> conservación probatoria tampoco está determinado. **Escalamiento E-1: el paso 3
> no se implementa hasta que `compliance-legal` y el humano dictaminen la base
> legal y el plazo.** Mientras tanto, el comportamiento por defecto es el paso 4:
> se suprime.

**Paso 4 — Destrucción y constancia.** Se destruyen: `EntradaEvaluacionCifrada.contenido`,
todos los campos `PATR` de `Hallazgo` y satélites, `HallazgoDetalleComputo`,
`RevisionProfesional.observacion` e `impactoCorregidoCentavos`, y
`SinResultadoRegimenEnDisputa.fechaDelHecho`. Se conservan, sin dato personal:
la existencia de la evaluación, las versiones de catálogo, la clase de resultado
(Q-11 sigue funcionando), las plantillas usadas, la revisión profesional con su
matrícula y su decisión, la advertencia preventiva y su entrega, y la bitácora.
Se escribe `ConstanciaDeSupresion` con las categorías suprimidas, el conteo y la
huella del conjunto destruido: **constancia del hecho, no del dato.**

**Qué no se suprime nunca, y por qué.** La bitácora de accesos (es la prueba de
la licitud del tratamiento y, tras el paso 2, contiene sólo seudónimos); el
catálogo normativo (no tiene nada del titular); la constancia de supresión
(destruirla haría irrefutable la acusación de que nunca suprimimos); y el
registro de entrega de la advertencia preventiva (es la prueba de que se cumplió
una obligación cuya métrica es 1,00). Los cuatro quedan seudonimizados tras el
paso 2, lo que es precisamente el argumento por el que se pueden conservar —
**sujeto a confirmación de `compliance-legal`.**

---

## 6. Migración

### 6.1 Situación de partida

**`apps/api/prisma/` no existe.** La migración de esta feature es la inicial del
proyecto, lo que simplifica una cosa (no hay datos que migrar) y complica otra
(hay que decidir de entrada cosas que después cuestan caro).

Orden previsto, una migración por bloque para poder revertir por partes:

| # | Migración | Contenido | Reversible |
| --- | --- | --- | --- |
| `0001` | `extensiones_y_esquemas` | `CREATE SCHEMA motor; CREATE SCHEMA identidad;` + `btree_gist` (necesaria para las restricciones de exclusión que mezclan `=` con `&&`) + `pgcrypto`. Roles `rol_motor`, `rol_identidad`, `rol_auditoria`, `rol_cliente`, `rol_abogado`, `rol_operador`, `rol_admin`. | Sí, `DROP SCHEMA` (vacío). |
| `0002` | `catalogo_normativo` | Bloque A completo, incluidas exclusiones GiST y las claves foráneas compuestas de A.6. | Sí. |
| `0003` | `valores_de_referencia` | A.7 con la columna generada y la clave foránea de activación. | Sí. |
| `0004` | `plantillas` | A.8. | Sí. |
| `0005` | `evaluacion_y_hallazgos` | Bloque B, incluidas las tres tablas de detalle de sin-resultado con sus claves foráneas compuestas. | Sí. |
| `0006` | `persona_advertencia_bitacora` | Bloque C; `BitacoraAcceso` particionada por rango mensual con 12 particiones adelantadas y rutina de creación. | Sí. |
| `0007` | `revision_profesional` | Bloque D. | Sí. |
| `0008` | `rls_y_privilegios` | Políticas de §7.4, `REVOKE` al rol del cliente sobre `Hallazgo`, vistas `hallazgo_para_cliente` y `hallazgo_vigente`. | Sí. |
| `0009` | `disparadores_de_inmutabilidad` | Rechazo de `UPDATE`/`DELETE` en tablas append-only; cálculo de `fechaLimiteRevision`; proyección de `estadoRevision`; verificaciones diferidas de §7.3. | Sí. |
| `0010` | `seed_catalogo` | **Datos, no esquema.** Las 60+ filas del dictamen §5 como `TramoParametro`, **todas con `estadoRatificacion = 'SIN_RATIFICAR'`**, con su `disponibilidad` (`A_DETERMINAR_POR_EL_ESTUDIO` o `CONTRADICCION_ABIERTA` donde corresponde) y su `confiabilidad` (`V`/`C`/`P`/`D`/`I`). Plantillas con los textos literales del dictamen §3.0 a §3.7. Términos prohibidos de §3.8. Calendario de días no hábiles. | Sí, `DELETE` por origen `SEED`. |

### 6.2 Reversibilidad

Cada migración lleva su `down`. Las de esquema son reversibles sin pérdida porque
no hay datos previos. A partir de la segunda entrega, la regla es la habitual: una
migración que borra una columna con datos se parte en dos despliegues (dejar de
escribir, después borrar), y ninguna migración destructiva se aplica sin G6.

**Nota de honestidad sobre el criterio de "terminado" de mi mandato:** dice que la
migración tiene que estar *probada contra datos de ejemplo*. Todavía no lo está,
porque todavía no existe. Se prueba cuando se escriba, después de G2, contra el
`seed` del punto `0010` y los tres portales.

### 6.3 Bloqueo esperado

Base vacía: bloqueo nulo. La única operación que en el futuro puede ser cara es
agregar una restricción de exclusión sobre `TramoParametro` con muchas filas;
se hace con `NOT VALID` + `VALIDATE CONSTRAINT` fuera de hora pico. El resto son
`CREATE TABLE`. Los índices futuros, `CREATE INDEX CONCURRENTLY`.

### 6.4 Consecuencia de esta decisión para el `arquitecto`

El modelo usa restricciones de exclusión GiST, columnas generadas, claves
foráneas compuestas contra columnas de estado, particionado nativo y RLS.
**Prisma no expresa ninguna de esas cosas en su DSL.** La consecuencia práctica:
`schema.prisma` describe las tablas y las relaciones, y todas las invariantes
estructurales de §7.1 se agregan con SQL crudo dentro de las migraciones
versionadas. Es la práctica normal con Prisma y hay que decidirla en G2, no
descubrirla en G4. Queda anotado como punto de coordinación con el `arquitecto`;
si el plan resuelve otro acceso a datos, el modelo lógico no cambia.

---

## 7. Integridad

### 7.1 Invariantes de la spec que quedan garantizadas por la base

Éste es el corazón del documento. Cada fila dice qué criterio se vuelve
**imposible de violar** y con qué mecanismo.

| # | Criterio | Mecanismo | Qué queda imposible |
| --- | --- | --- | --- |
| R-1 | CA-47, C-03 | `CHECK ((estadoRatificacion='RATIFICADO') = (ratificacionId IS NOT NULL))` + `CHECK (length(trim(matricula))>0)` en `Ratificacion` | Escribir "ratificado" sin quién, con qué matrícula y cuándo. |
| R-2 | **CA-58, R-12, C-02** | Clave foránea compuesta `CatalogoTramo(tramoId, tramoEstadoRatificacion) → TramoParametro(id, estadoRatificacion)` + `CHECK (NOT catalogoAptoProduccion OR tramoEstadoRatificacion='RATIFICADO')` + `Evaluacion CHECK (entorno<>'PRODUCCION' OR catalogoAptoProduccion)` con su propia clave foránea compuesta | Armar un catálogo productivo con un parámetro sin ratificar, degradar un tramo ya incluido, o correr una evaluación productiva contra un catálogo no apto. **Sin bandera de configuración que lo anule.** |
| R-3 | **CA-59, R-13** | `CHECK ((estado='ACTIVO') = (activacionId IS NOT NULL))` + columna generada `tramoEstado='ACTIVO'` en `TablaValorTramo` con clave foránea compuesta | Publicar en la tabla que recibe el motor un valor de referencia que nadie activó. El `INSERT` falla en el motor de base, no en un servicio. |
| R-4 | **CA-47** | Clave foránea compuesta `RevisionProfesional(idProfesional, matriculaEstado) → MatriculaProfesional(idProfesional, estado)` + `CHECK (matriculaEstado='VIGENTE')` | Registrar una confirmación de alguien sin matrícula vigente registrada. |
| R-5 | **CA-51, S-07** | Clave foránea compuesta `ExposicionAlCliente(revisionId, revisionDecision) → RevisionProfesional(id, decision)` con columna generada `'CONFIRMADO'` + `REVOKE SELECT ON Hallazgo FROM rol_cliente` | Mostrarle al cliente un hallazgo rechazado o no revisado. |
| R-6 | **CA-54, métrica 1,00** | `CHECK (tipo<>'A_POSIBLE_PRESCRIPCION' OR advertenciaPreventivaId IS NOT NULL)` | Que exista un hallazgo de prescripción sin advertencia preventiva asociada. |
| R-7 | **CA-56** | `CHECK (gratuita)` + `CHECK (NOT condicionadaAContratacion)` | Una advertencia preventiva paga o condicionada a contratar. |
| R-8 | **CA-57** | `accionRecomendadaPlantillaId NOT NULL` en `ExposicionAlCliente` | Exponer un hallazgo confirmado "a secas". |
| R-9 | **CA-61, C-11** | `CHECK (NOT aptoComoBaseDeComision)` en `Hallazgo` | Marcar un impacto estimado como base de comisión. |
| R-10 | **CA-46, S-02** | `CHECK (requiereConfirmacionProfesional)` | Emitir un hallazgo ya confirmado desde el motor. |
| R-11 | **CA-45, S-01, D-22** | `CHECK (estadoDeclarado <> 'PRESCRIPTA')` y enum cerrado | Persistir el estado asertivo. |
| R-12 | **CA-48, S-04** | `CHECK (destinatario<>'CLIENTE' OR idAccion IN ('CONSULTAR_AL_ABOGADO','NO_INNOVAR_SOBRE_LA_DEUDA'))` | Dirigirle al cliente una acción fuera de las dos permitidas. |
| R-13 | **CA-29** | `EXCLUDE USING gist` sobre `(clave, jurisdiccion, vigencia)` | Dos parámetros vigentes solapados: la pregunta "cuál regía a la fecha del hecho" tiene siempre a lo sumo una respuesta. |
| R-14 | **CA-52, S-09** | La consulta de resolución filtra por jurisdicción exacta o `TODAS`; no hay fila comodín ni valor por defecto | Caer silenciosamente en los parámetros de otra jurisdicción. |
| R-15 | **v3 — los tres sin-resultado** | `UNIQUE (id, claseSinResultado)` + columna generada fija + clave foránea compuesta en cada tabla de detalle | Que un detalle de exclusión por materia cuelgue de un resultado clasificado como falta de dato, o que la clasificación se desincronice de su evidencia. |
| R-16 | **CA-32** | `CHECK (impactoRedondeoAFavorDelCliente IS NOT FALSE OR impactoRedondeoCitaId IS NOT NULL)` | Redondear en contra del cliente sin norma citada. |
| R-17 | Constitución #12 | `UNIQUE (claveIdempotencia)` en `Evaluacion`, `AdvertenciaPreventiva`, `EntregaAdvertencia`, `RevisionProfesional`, `EscalamientoRevision`, `ActivacionValorReferencia`, `SolicitudSupresionTitular` | Advertencia duplicada, escalamiento duplicado, doble activación. |
| R-18 | Constitución #5 | Revocación de `UPDATE`/`DELETE` + disparador en `BitacoraAcceso` | Alterar el registro de accesos. |
| R-19 | RL-07 del dictamen | La columna de total general **no existe** en `GrupoDeImpacto` | Agregar todos los impactos en un número único. |
| R-20 | CA-60, C-10 | Ausencia de columnas + prueba de esquema de §4.2 | Introducir un dato identificatorio del deudor en el esquema `motor`. |

### 7.2 Mutabilidad: el inventario completo

Las **únicas** columnas que admiten `UPDATE` en todo el modelo:

| Tabla | Columna | Por qué |
| --- | --- | --- |
| `TramoParametro` | `retiradoEn` | Baja lógica; nunca se toca el valor. |
| `Ratificacion` | `revocadaEn`, `motivoRevocacion` | Ídem. |
| `TramoValorReferencia` | `estado`, `activacionId` | Transición `PROPUESTO → ACTIVO/DESCARTADO`, bloqueada si ya está publicado. |
| `CatalogoNormativo` | `estado`, `aptoProduccion`, `publicadoPor` | Sólo `BORRADOR → PUBLICADO → RETIRADO`, con disparador que impide retroceder y que impide subir `aptoProduccion` si algún tramo no está ratificado. |
| `Hallazgo` | `estadoRevision` | Proyección de D.1 para poder indexar. |
| `EntregaAdvertencia` | `estado` y sus marcas de tiempo | Con historial completo en `EntregaAdvertenciaEvento`. |
| `EntradaEvaluacionCifrada` | `contenido`, `destruidaEn`, `motivoDestruccion`, y `nonce`/`tag`/`idClave` en rotación | Destrucción y rotación de clave. |
| `MatriculaProfesional`, `AsignacionProfesionalCaso` | `estado`, `eliminadoEn`, `revocadaEn` | Baja lógica. |
| `SolicitudSupresionTitular` | `estado`, `resueltaEn` | Ciclo de vida del pedido. |
| `AlertaVencimiento`, `EscalamientoRevision` | `resueltaEn` / `resueltoEn` | Cierre. |

Todo el resto: `REVOKE UPDATE, DELETE` al rol de aplicación y disparador que
lanza excepción. La regla se verifica con una prueba que intenta un `UPDATE`
sobre cada tabla append-only y espera el error.

### 7.3 Invariantes que quedan en la aplicación (y por qué)

Se listan explícitamente porque son el riesgo residual del modelo.

| Invariante | Por qué la base no la expresa | Cómo se cubre |
| --- | --- | --- |
| Todo tramo `CARGADO` tiene al menos una cita con artículo. | "Al menos una fila en una N:M" no es una restricción declarativa. | Disparador diferido al cierre de transacción + `validarCatalogo` antes de publicar + test. |
| Todo `SIN_RESULTADO` de clase `FALTA_DATO` o `PARAMETRO_NO_DISPONIBLE` nombra al menos un faltante (invariante del contrato). | Ídem. | Ídem. |
| Si coexisten hallazgo de prescripción y de caducidad, existe la advertencia de no-confusión (CA-62, C-12). | Regla sobre el conjunto de filas de una evaluación. | Disparador diferido + test. |
| Ninguna plantilla publicada contiene un término prohibido (CA-45). | Requiere evaluación de texto contra una lista. | Disparador en la publicación + test del `tester` sobre el catálogo entero. |
| El impacto de dos hallazgos con la misma `claveSuperposicion` no se suma (spec §7). | Es una regla de cálculo, no de almacenamiento. | El modelo la **habilita** (guarda la clave y prohíbe el total general, R-19); el cumplimiento es del motor y del `dev-dominio`. |
| La advertencia preventiva **efectivamente llegó** al cliente. | Es un efecto externo; la base no puede garantizarlo. | La base garantiza que **existe** (R-6) y registra cada hito de entrega (C.4); la métrica de 1,00 se mide con Q-07 y los fallos se escalan con Q-08. **Éste es el riesgo residual más importante del modelo y conviene decirlo en G2 en vez de dejarlo implícito.** |
| Determinismo del motor (CA-31). | Propiedad del código, no del esquema. | El esquema guarda todo lo necesario para verificarlo (versiones, huellas, entrada cifrada) y el `tester` lo prueba recalculando. |

### 7.4 Aislamiento multi-perfil (regla 7 del mandato)

RLS activada en `Hallazgo`, `Evaluacion`, `ResultadoAnalisis`, satélites,
`RevisionProfesional`, `AdvertenciaPreventiva` y `EntradaEvaluacionCifrada`.

| Rol | Política |
| --- | --- |
| `rol_cliente` | Sin acceso a `Hallazgo`. `SELECT` sólo sobre la vista `hallazgo_para_cliente`, y allí `USING (idSujeto = current_setting('app.id_sujeto'))`. Un cliente sólo ve lo suyo y sólo lo confirmado. |
| `rol_abogado` | `USING (EXISTS (SELECT 1 FROM AsignacionProfesionalCaso a WHERE a.idProfesional = current_setting('app.id_profesional') AND a.idDeuda = Hallazgo.idDeuda AND a.revocadaEn IS NULL))`. **Un abogado sólo alcanza los casos que le fueron asignados**, expresado en la base y no sólo en el servicio. |
| `rol_operador` | Igual criterio sobre asignación de operación; sin acceso a `RevisionProfesional.observacion`. |
| `rol_admin` | Acceso completo al bloque A y a los metadatos del bloque B; **sin acceso a las columnas `PATR`** (se implementa con vistas que las excluyen y `REVOKE` a nivel de columna). El administrador mantiene parámetros, no lee ingresos. |
| `rol_auditoria` | `SELECT` sobre todo, `INSERT` en ningún lado; cada lectura queda en `BitacoraAcceso`. |
| `rol_identidad` | Único con acceso al esquema `identidad`. |

`FORCE ROW LEVEL SECURITY` en todas ellas, para que el dueño de la tabla tampoco
se saltee las políticas.

### 7.5 Nota sobre el tipo del dinero

La regla 1 de mi mandato dice `Decimal(18,2)`; el contrato del `arquitecto` y
CA-32 dicen **centavos enteros**. Resolución propuesta: el valor **autoritativo**
se guarda en `BIGINT` de centavos —idéntico al `Centavos = bigint` del contrato,
sin conversión ni redondeo en la frontera— y se expone una columna **generada**
`NUMERIC(18,2)` de sólo lectura para reportería SQL. Se cumple el espíritu de la
regla (enteros, nunca `FLOAT`, nunca redondeo implícito) sin introducir una
conversión entre el dominio y la base, que es justo donde se pierden los pesos.
Los importes cifrados no tienen columna generada: se descifran y se agregan en la
aplicación. **Punto a ratificar en G2.**

---

## 8. Escalamientos

Conforme a mi mandato, no modelo un dato cuya base legal no está clara. Estos
cuatro puntos van al orquestador para `compliance-legal` y el humano.

| # | Qué | Por qué no lo resuelvo yo | Estado en el modelo |
| --- | --- | --- | --- |
| **E-1** | **Base legal y plazo de la conservación probatoria del hallazgo frente a un pedido de supresión** (§5.3, paso 3). | Afirmar que existe una excepción al art. 16 de la Ley 25.326 es una afirmación jurídica. El dictamen no la verificó en fuente oficial y el plazo no está determinado. | El paso 3 **queda diseñado pero no habilitado**. Por defecto se ejecuta el paso 4 (se suprime). Las columnas `retenidoPorObligacionLegal` y `fundamentoRetencionCitaId` existen en `ConstanciaDeSupresion` para el día que haya dictamen. |
| **E-2** | **Plazo de conservación de la identidad y matrícula del profesional que ratifica o confirma.** | El dictamen §2.1 lo marca `[D]`: *"plazo de prescripción de la responsabilidad profesional"*, sin determinar. | Conservación indefinida provisoria, **sin purga automática**. No se implementa ninguna rutina de borrado hasta tener el número. |
| **E-3** | **Guardar que un caso "involucra personas menores de edad"** (CA-63) y que su materia es `ALIMENTARIA`. | Es un dato de un tercero que no es nuestro cliente y que no prestó consentimiento. La finalidad es legítima (excluir el caso del análisis), pero la base legal para registrarlo no está dictaminada y el dictamen de cumplimiento no lo trata. | Modelado como **booleano y enum de materia, sin ningún dato de la persona menor** (ni edad, ni parentesco, ni nada). Clasificado `PERSONAL`. **Si `compliance-legal` dice que ni siquiera el booleano corresponde**, la alternativa es que el análisis E no se solicite para esos casos desde la 007 y que acá no quede rastro; eso hay que decidirlo antes de G2 porque cambia la tabla. |
| **E-4** | **Contradicción entre CA-64 y el contrato del `arquitecto`.** No es un tema legal sino de coordinación, pero bloquea. | El `MotivoIndeterminable` del contrato (`specs/contratos/motor-reglas-legales.ts`, líneas ~241-250) tiene ocho valores y **ninguno distingue la exclusión por materia de CA-63 ni el régimen en disputa de CA-64**: caerían en `REGIMEN_NO_PARAMETRIZADO` o `PARAMETRO_A_DETERMINAR`, que es exactamente la confusión que la v3 vino a corregir. | Mi modelo **sí** los distingue (B.3). Si el contrato no agrega los dos motivos, el motor no podrá emitir la información que el modelo necesita guardar y la distinción se perderá en la frontera. **No toqué el contrato** (es del `arquitecto`): lo reporto para que se resuelva en G2. |

---

## 9. Trazabilidad criterio → modelo

| Criterio | Dónde se sostiene |
| --- | --- |
| CA-01 a CA-08, CA-33, CA-34 | `ResultadoAnalisis.estadoDeclarado` (con `CHECK` anti-`PRESCRIPTA`), `HallazgoDetalleComputo`, `HallazgoSupuesto`, `SinResultadoFaltante`, `HallazgoAdvertenciaObligatoria` |
| CA-09 a CA-13, CA-35 a CA-37 | `TramoParametro` con vigencias desdobladas por el DNU 70/2023, `TipoHallazgo`, `SinResultadoFaltante` |
| CA-14 a CA-17, CA-38, CA-39 | `Hallazgo.idRegistroCrediticio`, `ParametroNormativo.bloqueanteDeAnalisis` sobre `archivoCrediticio.diesAQuo.*`, `SinResultadoFaltante` con motivo `PARAMETRO_SIN_RATIFICAR` |
| CA-18 a CA-22, CA-40 a CA-42 | `TramoValorReferencia` (SMVM a la fecha del hecho), `HallazgoDetalleComputo`, `SinResultadoFaltante` con `REGIMEN_NO_PARAMETRIZADO` |
| CA-23, CA-24, CA-25, CA-26, CA-43, CA-44 | `TramoParametro.jurisdiccion`, `TipoHallazgo` con `E_EXCESO_HONORARIO_ABOGADO` y `E_EXCESO_COMISION_PLATAFORMA` **separados**, `E_COMPROMISO_INTERNO_SUPERADO` |
| **CA-63** | `SinResultadoExclusionMateria` (§B.3), escalamiento E-3 |
| **CA-64** | `SinResultadoRegimenEnDisputa` (§B.3), escalamiento E-4 |
| CA-27, CA-30, CA-31 | `Evaluacion` con las cuatro versiones y las huellas; `CatalogoTramo` inmutable; `HallazgoParametroUsado` |
| CA-28 | `Hallazgo.usaParametrosSinRatificar`, `HallazgoParametroUsado.requiereValidacionProfesional` |
| CA-29 | `TramoParametro.vigencia` + exclusión GiST + Q-04 |
| CA-32 | `impactoCentavos` `BIGINT` + moneda + `CHECK` de redondeo (R-16) |
| CA-45 a CA-53 | R-10, R-11, R-12 de §7.1; `PlantillaTexto`; `TerminoProhibido`; `ExposicionAlCliente`; `RevisionProfesional` |
| CA-54 a CA-57 | `AdvertenciaPreventiva`, `EntregaAdvertencia`, `EscalamientoRevision`, R-6/R-7/R-8 de §7.1, Q-03 y Q-07 |
| CA-58 | R-2 de §7.1 (doble barrera) |
| CA-59 | R-3 de §7.1, `HallazgoValorReferenciaUsado` |
| CA-60 | D-4, §4.2, R-20 |
| CA-61 | R-9 de §7.1 |
| CA-62 | `AdvertenciaDeConjunto` + disparador diferido de §7.3 |
| C-03 | `Ratificacion` completa + Q-09 |
| C-10 | §C.1 y §4.2 |
| Constitución #5 | `BitacoraAcceso`, §4.3, §7.4 |
| Constitución #8 | R-7 de §7.1 (advertencia gratuita e incondicional) |
| Constitución #11 | Bloque A completo |
| Constitución #12 | R-17 de §7.1 |
