# Plan técnico 004 — Motor de reglas legales argentinas

| Campo | Valor |
| --- | --- |
| Autor | arquitecto |
| Spec de origen | `specs/004-motor-reglas-legales/spec.md` **v3** (64 criterios de aceptación) |
| Dictamen | `specs/004-motor-reglas-legales/cumplimiento.md` — APTO CON CONDICIONES (12) |
| Verificación documental | `specs/legal/verificacion-documental.md` (ronda 2026-09-20) |
| Estado | BORRADOR — para aprobación humana en G2 |
| Contrato | `specs/contratos/motor-reglas-legales.ts` (v1, revisión 2) |
| ADRs | ADR-010 a ADR-019 |
| Modelo de datos | `specs/004-motor-reglas-legales/modelo-datos.md` — lo produce `database-engineer` en paralelo. Este plan **no lo define**: declara qué necesita de él (§5) |
| Diseño | `specs/004-motor-reglas-legales/ux.md` — lo produce `ux-expert` |

---

## 1. Enfoque

El motor es una **función pura**. Recibe una deuda despersonalizada, un catálogo
normativo con vigencias, una tabla de valores de referencia y un catálogo de
textos; devuelve hallazgos con su fundamento, o dice que no puede determinar el
resultado. No lee el reloj, ni la red, ni la base, ni el entorno. Esa pureza no
es elegancia: es el único modo de cumplir CA-31 —reproducir en 2030 lo que el
sistema dijo en 2026— y de que un abogado pueda auditar una regla legal sin
levantar infraestructura (ADR-016).

Todo lo que el derecho argentino aporta entra como **dato con vigencia, cita y
estado de ratificación**, nunca como constante. El tope de punitorios de tarjeta
antes y después del DNU 70/2023 no son dos ramas de un `if`: son dos tramos de
la misma clave del catálogo, y ninguna función del motor sabe que ese parámetro
está desdoblado (ADR-010). Cambiar una ley es cargar un tramo; no es desplegar.
Y como hoy el 100% de la tabla del dictamen §5 está sin ratificar, hay un
bloqueo **sin perilla** que impide evaluar en producción con un parámetro sin
firma profesional (ADR-013).

Lo más difícil de esta feature no es calcular: es **no afirmar de más**. Por eso
hay tres formas distintas de decir "no te puedo dar un resultado" —falta un
dato, la materia está excluida, el régimen aplicable está en disputa— y cada una
lleva su propio texto y su propia acción, dirigidas a quien efectivamente puede
destrabarla (ADR-019). Por eso el dinero es exacto y el redondeo se decide por
el rol del monto, no por el gusto de quien programa (ADR-011). Por eso ningún
texto que llegue a una persona lo escribe el motor: todos salen de un catálogo
cerrado, versionado y ratificado, con vocabulario controlado (ADR-014). Y por
eso el contrato de entrada **no puede compilar** si alguien le mete un nombre,
un CUIL o un domicilio (ADR-015).

---

## 2. Alcance técnico por componente

| Componente | Cambios | Agente responsable |
| --- | --- | --- |
| `packages/shared/src/motor-legal/**` | **Todo el motor.** Tipos del contrato (copia verificada), aritmética exacta y redondeo, resolución de catálogo y de valores de referencia, los cinco análisis, composición de la salida, reglas de conjunto (CA-62, no acumulación de impactos). | `dev-dominio` |
| `packages/shared/src/motor-legal/contrato/v1.ts` | Copia byte a byte de `specs/contratos/motor-reglas-legales.ts` (ADR-017). | `dev-dominio` |
| `packages/integrations` | **Nada en esta feature.** El adaptador de valores de referencia es spec 022. Queda declarado el puerto y la exigencia de mock determinista. | `dev-integraciones` (spec 022) |
| `apps/api` | Fuera de alcance de 004. Lo que 004 le impone queda en §5 como obligaciones de frontera (F-05 a F-10): provisión del `entorno`, guarda de minimización en ejecución, serialización de `Centavos` como cadena, INDETERMINABLE como 200. | `dev-backend` (spec 007) |
| `apps/api/prisma` | Persistencia del catálogo, de la tabla de valores y de los hallazgos. **La define `database-engineer`** en `modelo-datos.md`; este plan sólo declara invariantes (§5). | `database-engineer` |
| `apps/web`, `apps/mobile` | Fuera de alcance. Consumen los hallazgos vía 007. Dependencias declaradas: INDETERMINABLE como estado de primera clase, advertencias en el mismo bloque visual. | `dev-web`, `dev-mobile` (spec 007) |
| Tests | Un test nombrado por cada uno de los 64 criterios, más los casos límite del §7 de la spec, más los tests de forma que protegen ADR-013, ADR-014 y ADR-015. | `tester` |
| Pipeline | Verificación de identidad del contrato (ADR-017); *benchmark* de rendimiento; regla de lint contra `new Date()` en `packages/shared`. | `cicd` |
| Plantillas de texto | Redacción y revisión de legibilidad de las plantillas del catálogo (dictamen §3). | `ux-expert` + ratificación del estudio |

**Orden de ejecución sugerido para G3**: (1) tipos y aritmética exacta;
(2) catálogo, resolución y valores de referencia; (3) análisis A y C, que son de
fechas y son los que más valor dan; (4) análisis D; (5) análisis B, que depende
de la normalización de tasas y del escalamiento E-2; (6) análisis E; (7) reglas
de conjunto y composición de salida.

---

## 3. Contratos

**`specs/contratos/motor-reglas-legales.ts`** — versión `motor-reglas-legales/v1`,
revisión 2 del documento (alineada a la spec v3). 1500 líneas de declaraciones,
sin una sola implementación. Secciones:

| § | Contenido | Criterios que sostiene |
| --- | --- | --- |
| 0-1 | Versión, identificadores opacos, fechas civiles con marca nominal | CA-31, CA-60 |
| 2 | Dinero en centavos `bigint`, racionales exactos, redondeo por rol | CA-12, CA-19, CA-20, CA-32 |
| 3 | `Resultado`, `ErrorMotor`, **`Indeterminable` con tres clases de causa** | CA-07, CA-13, CA-26, CA-35, CA-39 a CA-41, CA-52, **CA-63**, **CA-64** |
| 4 | Minimización por tipo | CA-60 |
| 5 | Citas, catálogo de parámetros con tramos de vigencia, ratificación | CA-14, CA-27 a CA-30, CA-35, CA-38, CA-39, CA-43, CA-52 |
| 6 | Valores de referencia con activación humana | CA-18, CA-59 |
| 7 | Catálogo cerrado de plantillas, vocabulario y acciones | CA-45, CA-48 a CA-50 |
| 8 | Entrada del motor | CA-60 y entradas de los cinco análisis |
| 9 | Contexto de ejecución y bloqueo de producción | CA-58 |
| 10 | Hallazgo, impacto, visibilidad, trazabilidad | CA-27, CA-28, CA-32, CA-46, CA-54 a CA-57, CA-61 |
| 11 | Resultados por análisis | CA-01 a CA-26, CA-33 a CA-44, CA-63, CA-64 |
| 12 | Salida, advertencias de conjunto, grupos de impacto no acumulables | CA-62, §7 de la spec |
| 13 | Punto de entrada `evaluar` | CA-31 |
| 14 | Frontera con persistencia y revisión profesional | CA-47, CA-51, CA-53, CA-61 |

### Cambios de la revisión 2 del contrato (por la spec v3)

El identificador de versión **no cambia**: el contrato nunca pasó G2, así que no
hay consumidor con compatibilidad que romper.

1. `Indeterminable` pasa de `faltantes: DatoFaltante[]` a
   `clase` + `causas: CausaDeIndeterminacion[]`, con tres brazos:
   `FALTA_DE_DATO`, `MATERIA_EXCLUIDA` (CA-63), `REGIMEN_EN_DISPUTA` (CA-64).
2. `ClaveParametro`: se agregan `cuotaLitis.materiasExcluidas`,
   `cuotaLitis.transicionArt277LCT`, `embargo.excepcionLitisexpensas`; se
   **retira** `cuotaLitis.topeMateriasProtegidas`, que la v3 degradó de tope a
   posible prohibición.
3. `ValorParametro`: tres clases nuevas —`REGIMEN_DE_PROTECCION_DEL_INGRESO`
   (CA-41), `MATERIAS_EXCLUIDAS` (CA-63), `REGLA_DE_TRANSICION` (CA-64).
4. `ResultadoAnalisisD`: estado `INEMBARGABLE_POR_REGLA` (CA-41).
5. `CausaAfectacion`: se agrega `LITISEXPENSAS` como causa propia (CA-41).
6. `PropuestaHonorarios`: se agrega `fechaDelHechoGenerador`, sin la cual no se
   puede resolver el tope aplicable (CA-29) ni la ventana de transición (CA-64).
7. Plantillas, acciones, términos controlados y notas de alcance nuevas para los
   tres casos.

### Contratos que esta feature **declara** y otra implementa

- `PuertoReproduccion` → infraestructura, spec 007.
- `ConfirmacionProfesional`, `HallazgoRevisado` → feature 007 (CA-47, CA-51).
- `BaseDeComision` → feature 018 (CA-61). El tipo existe acá para que el impacto
  estimado del motor **no satisfaga** el tipo que exige el cálculo de comisión.

---

## 4. Decisiones de arquitectura

| ADR | Decisión, en una línea |
| --- | --- |
| **ADR-010** | El catálogo normativo es un conjunto inmutable de tramos con vigencia, cita y ratificación, versionado y **inyectado** al motor; la resolución exige fecha del hecho y no tiene fallback. |
| **ADR-011** | El dinero son centavos enteros en `bigint`; la aritmética intermedia es racional exacta y el redondeo ocurre una sola vez, con sentido determinado por el **rol** del monto. |
| **ADR-012** | El motor devuelve `Resultado` y no lanza; `ErrorMotor` es siempre un defecto e **INDETERMINABLE es un resultado de primera clase** que nombra por qué. |
| **ADR-013** | El bloqueo de parámetros sin ratificar en producción **no es configurable porque no hay dónde configurarlo**: no hay opciones en el contexto ni lectura de entorno. |
| **ADR-014** | Todo texto sale de un **catálogo cerrado y versionado** con variables tipadas y vocabulario controlado; no hay generación de lenguaje natural en el producto. |
| **ADR-015** | La minimización del contrato de entrada es una **restricción de compilación** (`Minimizada<E>`) más una guarda equivalente en el borde HTTP. |
| **ADR-016** | El motor es una librería **pura y total** en `packages/shared`, sin reloj, red, disco ni entorno; el tiempo entra por parámetro con tipos que no se confunden. |
| **ADR-017** | El contrato es un **artefacto único**: fuente normativa en `specs/`, copia byte a byte en el paquete, identidad verificada por el pipeline. |
| **ADR-018** | Los valores de referencia variables son **serie histórica con activación humana estructuralmente obligatoria**; sin valor para la fecha, INDETERMINABLE. |
| **ADR-019** | **Materia excluida** y **régimen transitorio en disputa** son clases de indeterminación distintas de la falta de dato; la exclusión es *fail-safe* y opera sin ratificación previa. |

---

## 5. Frontera con el modelo de datos y con los demás componentes

`database-engineer` está diseñando `modelo-datos.md` en paralelo. **Este plan no
toca ese archivo.** Lo que el motor necesita de él, y de los demás componentes,
son estas obligaciones de frontera:

| # | Obligación | Responsable | Criterio |
| --- | --- | --- | --- |
| **F-01** | Persistir el catálogo normativo como **tramos inmutables**: nunca se actualiza un tramo, se cierra su `vigenciaHasta` y se inserta otro. Invariante: no puede haber dos tramos solapados para la misma `(clave, jurisdicción)`. | `database-engineer` | CA-29, CA-35 |
| **F-02** | El estado de ratificación se guarda con matrícula, jurisdicción, fecha, `fechaProximaRevision` y referencia al documento firmado. No es un booleano. Modificarlo queda en bitácora inmutable. | `database-engineer` | CA-28, C-03 |
| **F-03** | Toda versión de catálogo, de tabla de valores y de catálogo de plantillas que **alguna vez se usó en una evaluación** se retiene indefinidamente y es recuperable por versión (`PuertoReproduccion`). Sin esto, CA-27 y CA-31 no son verificables sobre el pasado. | `database-engineer` | CA-27, CA-31 |
| **F-04** | La tabla de valores de referencia guarda serie histórica con fuente y **activación humana identificada**; la cola de valores obtenidos y no activados es una entidad **distinta**, que nunca se lee para evaluar. | `database-engineer` | CA-59, R-13 |
| **F-05** | Los hallazgos persistidos se **versionan, no se pisan**, y la revisión profesional (confirmar / rechazar / corregir) queda registrada con matrícula. Todo acceso a un hallazgo —contiene remuneración y saldos— va a bitácora inmutable. | `database-engineer` + `dev-backend` (007) | CA-46, CA-47, CA-51, constitución #5 |
| **F-06** | En el borde HTTP y en la base, `Centavos` se serializa como **cadena decimal**, nunca como número JSON. Test de ida y vuelta obligatorio. | `dev-backend` + `database-engineer` | CA-32, ADR-011 |
| **F-07** | `ContextoEvaluacion.entorno` lo provee `apps/api` desde una **constante de despliegue**, no desde una variable de entorno mutable en caliente. | `dev-backend` + `cicd` | CA-58, ADR-013 |
| **F-08** | `verificarMinimizacion` se invoca en el borde HTTP sobre el cuerpo deserializado, **antes** de llamar al motor. | `dev-backend` | CA-60 |
| **F-09** | La correspondencia identificador opaco ↔ persona vive fuera del motor, cifrada en reposo y con bitácora inmutable de accesos. Los identificadores son UUIDv4/ULID, nunca derivados de un dato de la persona. | `database-engineer` | CA-60, constitución #5 |
| **F-10** | La memoria del catálogo por versión se hace en la **capa de aplicación**, nunca dentro del motor. Es seguro porque una versión de catálogo es inmutable. | `dev-backend` | CA-31, ADR-016 |
| **F-11** | Las plantillas del dictamen §3 se redactan y revisan por legibilidad; toda plantilla con destinatario `CLIENTE` lleva `revisadaPorUx: true`. INDETERMINABLE se diseña como estado de primera clase, no como error. | `ux-expert` (spec 007) | CA-49, CA-50, constitución #13 |
| **F-12** | Ningún documento a un tercero se genera sin confirmación profesional registrada. | specs 014 y 015 | CA-53, S-10 |

---

## 6. Atributos de calidad

| Atributo | Objetivo | Cómo se verifica |
| --- | --- | --- |
| **Determinismo** | 100%. La misma entrada con la misma fecha de evaluación y el mismo contexto produce una salida idéntica byte a byte. | Test de propiedad: 1000 corridas de un corpus de 50 entradas; se compara el hash de la salida canonicalizada. Más una regla de lint que prohíbe `new Date()`, `Math.random()` y `process.env` en `packages/shared`. |
| **Reproducibilidad histórica** | 100% de las salidas incluyen versión de contrato, de motor, de catálogo, huella del catálogo, versión de tabla de valores, de plantillas y fecha de evaluación. | Test: recuperar una salida guardada, reconstruir el contexto por `PuertoReproduccion`, reevaluar y comparar. |
| **Rendimiento** | Los cinco análisis sobre una deuda: **p95 ≤ 50 ms** en Node 22, con catálogo de hasta 500 tramos y tabla de valores de hasta 2000 tramos. | *Benchmark* en el pipeline con umbral que falla la construcción. |
| **Memoria** | `ContextoEvaluacion` serializado **≤ 3 MB**. | Medición en el mismo *benchmark*. Si se supera, se pasa a resolución por clave (ADR-010, "cómo se revierte"). |
| **Cobertura de criterios** | **1 test nombrado por cada uno de los 64 criterios** (`CA-07`, `CA-63`…), más los 7 casos límite del §7 y las 10 salvaguardas nombradas `S-01`…`S-10`. Cobertura de ramas ≥ 95% en `motor-legal`. | Informe de QA de `tester` con la matriz criterio → test. Métrica de la spec §10: 100%. |
| **Privacidad / minimización** | **0** campos identificatorios admitidos por el contrato de entrada. | Test de tipo negativo: un caso que incluye `dni` debe fallar la compilación (`tsd` o equivalente). Más test de ejecución de `verificarMinimizacion`. |
| **Parámetros sin ratificar en producción** | **0**, por construcción. | Test: parámetro sin ratificar + `PRODUCCION` → `ErrorMotor`. Más test de **forma** de la API pública que falla si aparece una opción en `ContextoEvaluacion`. |
| **Términos prohibidos en salidas** | **0**. | Test sobre el catálogo de plantillas contra la lista del dictamen §3.8, y sobre los literales de todos los enumerados de estado (no debe existir `PRESCRIPTA` sin `PRESUNTAMENTE_`). |
| **Acciones dirigidas al cliente** | Exactamente **2** (`CONSULTAR_AL_ABOGADO`, `NO_INNOVAR_SOBRE_LA_DEUDA`). | Test de forma sobre `IdAccionCliente`. |
| **Auditabilidad del cálculo** | 100% de los hallazgos declaran supuestos, parámetros usados con su cita y vigencia, valores de referencia con fuente y activación, y el redondeo aplicado. | Test de completitud sobre cada tipo de hallazgo. |
| **Tiempo de compilación** | `packages/shared` compila en **≤ 20 s** pese al tipo recursivo `ContieneClaveProhibida`. | Medición en el pipeline; si se supera, ver ADR-015 "cómo se revierte". |
| **Accesibilidad** | WCAG 2.2 AA — **no aplica al motor**, que no tiene interfaz. Se declara como dependencia hacia la spec 007 y `ux-expert`. | Fuera de esta feature. |

---

## 7. Riesgos técnicos

| # | Riesgo | Impacto | Mitigación |
| --- | --- | --- | --- |
| R-01 | **El catálogo no se puede completar**: C-03 depende de un estudio jurídico externo y hoy el 100% de las filas está sin ratificar. El motor quedaría terminado y sin poder evaluar en producción. | Crítico | Es una dependencia externa que hay que iniciar ya, no en G4. **Escalamiento E-4.** Mientras tanto, el motor se desarrolla y se valida con el catálogo estimado en entornos no productivos. |
| R-02 | **La fecha de corte del DNU 70/2023 es `[D]`.** CA-35 supone dos tramos contiguos, pero el límite entre ellos es justamente lo que no se sabe. Sin esa fecha no se puede construir ninguno de los dos tramos. | Alto | Consecuencia correcta: **todo** hallazgo de punitorio de tarjeta es INDETERMINABLE, no sólo los posteriores. Es más restrictivo que la letra de CA-35 y por eso se escala (**E-7**). |
| R-03 | **Normalización de tasas mal hecha** produce hallazgos falsos en el análisis B (comparar TNA contra TEA). El dictamen dice que es un problema actuarial, no jurídico, y no hay agente con ese criterio en el roster. | Alto | Convención financiera como parámetro del catálogo y registrada como supuesto. **Escalamiento E-2.** El análisis B se implementa último. |
| R-04 | **Inflación de INDETERMINABLE**: con el catálogo a medio llenar, buena parte de las evaluaciones no devuelve hallazgos y el producto parece roto. | Alto | Es el comportamiento correcto y no se relaja. Se mitiga con producto: métrica de INDETERMINABLE **desagregada por clase** (ADR-019), que dice si la traba se destraba con datos o con dictamen. |
| R-05 | **Deriva entre el contrato aprobado y el implementado.** | Medio | ADR-017: verificación de identidad byte a byte en el pipeline. |
| R-06 | **`bigint` se serializa mal** y un monto llega al cliente redondeado o como `null`. | Medio | F-06 y test de ida y vuelta obligatorio en el borde. |
| R-07 | **El tipo recursivo de minimización encarece la compilación** de todo el workspace. | Bajo | Presupuesto medido (§6) y camino de salida documentado en ADR-015. |
| R-08 | **Aritmética de fechas civiles propia**: un error de un día decide si una deuda prescribió. | Alto | Sin `Date` (ADR-016), funciones puras, y batería de casos límite: años bisiestos, fin de mes, plazos en años sobre 29 de febrero, cambio de régimen del CCyC en agosto de 2015. |
| R-09 | **Racionales sin simplificar** desbordan en cadenas largas de operaciones. | Bajo | Normalización por máximo común divisor en cada operación; test con cadena de 100 operaciones encadenadas. |
| R-10 | **El catálogo de plantillas queda desalineado** con los tipos de hallazgo: se agrega un hallazgo y falta su plantilla. | Medio | `PLANTILLA_INEXISTENTE` es `ErrorMotor`, y `validarCatalogoPlantillas` verifica cobertura de todos los `IdPlantilla` referenciados. |
| R-11 | **`PROHIBICION_EN_DISPUTA` se vuelve permanente**: nadie dictamina y el análisis E queda mudo para materias protegidas por años. | Medio | Tiene que aparecer en el tablero del administrador como deuda pendiente con antigüedad, no enterrado en una tabla (dependencia hacia 007/022). **Escalamiento E-5.** |

---

## 8. Plan de despliegue

El motor es una librería: **no se despliega, se publica dentro de los
artefactos que lo consumen**. No hay migraciones propias de esta feature; las
del catálogo son del `database-engineer` y de la spec 007.

1. **Compatibilidad**: `VersionContrato` viaja en la entrada y en la salida.
   Mientras exista un solo contrato, nada que coordinar. Cuando exista v2,
   conviven ambos archivos y ambos módulos, y un resultado guardado siempre dice
   con cuál se produjo (ADR-017).
2. **Puesta en producción**: bloqueada por construcción hasta que el catálogo
   esté ratificado (ADR-013). No hay bandera de activación gradual que pueda
   sortearlo, y no debe haberla.
3. **Activación gradual posible y recomendada**: por **análisis**. El catálogo
   del análisis C puede estar ratificado y el del E no; cada análisis resuelve
   sus propios parámetros, así que el sistema entra en producción con los
   análisis cuyos parámetros estén firmados y devuelve INDETERMINABLE en el
   resto. No requiere código nuevo: es un estado del catálogo.
4. **Vuelta atrás**: revertir la versión del paquete. Los hallazgos ya
   persistidos conservan su versión de motor y de catálogo, así que siguen
   siendo interpretables y reproducibles después del retroceso.
5. **Observabilidad mínima** (a cargo de `cicd`, spec 007): tasa de
   INDETERMINABLE **por clase y por análisis**; conteo de
   `PARAMETRO_SIN_RATIFICAR_EN_PRODUCCION`, que debe ser cero y si no lo es hay
   que despertar a alguien; antigüedad de los parámetros con
   `fechaProximaRevision` vencida; antigüedad de los valores de referencia sin
   activar.

---

## 9. Alternativas descartadas (transversales)

Las alternativas de cada decisión están en su ADR. Acá sólo las que afectan a la
feature entera.

| Alternativa | Por qué no |
| --- | --- |
| Motor de reglas de terceros (DMN, json-rules-engine, Drools) | El problema difícil no es la lógica de las reglas —que es poca y estable— sino la trazabilidad normativa, las vigencias y la ratificación profesional. Ningún motor genérico las resuelve, y todos agregan una semántica propia que hay que aprender y auditar. "Aburrido gana." |
| Un microservicio del motor detrás de HTTP | La app móvil perdería el diagnóstico sin conexión y la web dependería de la red para validar. ADR-003 ya decidió que el mismo código compilado corre en los tres clientes. |
| Implementar los cinco análisis en un solo módulo | Cada análisis tiene su propia forma de resultado y su propio conjunto de parámetros. Separarlos permite ponerlos en producción de a uno según qué esté ratificado (§8.3). |
| Un tipo de hallazgo por análisis, con formas distintas | La forma única de `Hallazgo` es lo que hace que las salvaguardas S-02, S-04, S-05 y S-06 se verifiquen una vez y valgan para los cinco análisis. |
| Calcular un "total recuperable" agregando todos los impactos | Prohibido por el dictamen (RL-07): operaría como promesa de resultado. Por eso la salida expone `GrupoDeImpacto` con el máximo **no acumulable** por clave de superposición, y nunca un total general. |
| Dejar la persistencia de hallazgos en esta feature | El §8 de la spec la asigna a 007 y la separación permite que el motor sea puro y auditable. |

---

## 10. Escalamientos — decisiones que no son del arquitecto

**Ninguna está resuelta en este plan.** Cada una tiene la recomendación del
arquitecto, pero la decisión es humana.

| # | Qué hay que decidir | Recomendación | Por qué se escala |
| --- | --- | --- | --- |
| **E-1** | **Sentido de redondeo de `RECLAMO_ESTIMADO`.** CA-32 dice "el redondeo favorece al cliente"; para un monto que el cliente reclamaría, "favorecer" podría leerse como redondear hacia arriba. | **Hacia abajo.** Sobreestimar un reclamo destruye la credibilidad del caso (RL-07) e infla la base de comisión (RL-09, CA-61). Ser conservador acá favorece al cliente de verdad. | Es una interpretación de un criterio aprobado, no una decisión técnica. |
| **E-2** | **Convención de normalización de tasas** (TNA↔TEA↔mensual, base 365/360/30). El dictamen dice que es criterio actuarial o contable, **no jurídico**, y no hay ningún agente del roster con ese criterio. | Cargarla como parámetro del catálogo y **no implementar el análisis B** hasta tener el criterio de un contador o actuario. | Requiere una competencia que el equipo no tiene. Comparar una TNA contra un tope en TEA produce hallazgos falsos. |
| **E-3** | **CA-37, deber de información.** Dice "en la que **no consta** que se haya informado la TEA…". Leído literal, la ausencia de dato bastaría para emitir un hallazgo. El contrato modela un estado triple y sólo emite hallazgo con `ACREDITADO_QUE_NO_SE_INFORMO`. | Confirmar la lectura del contrato: **"no tenemos el dato" no puede fundar un hallazgo**, sería violar R-05. Si se quiere el hallazgo con la sola ausencia, hay que reescribir CA-37 en G1. | **El arquitecto no puede reinterpretar un criterio aprobado.** Si la lectura literal es la correcta, hay que cambiar el diseño. |
| **E-4** | **Impacto de cronograma de CA-58 + C-03.** El bloqueo sin perilla implica que **nada sale a producción** hasta que el estudio jurídico firme la tabla del §5, hoy vacía en el 100%. | Iniciar la contratación del estudio **ahora**, y planificar la salida por análisis (§8.3). | Cambia el cronograma y el costo. Es decisión del product owner, no del arquitecto. |
| **E-5** | **Alcance comercial de CA-63.** El análisis E queda inoperante para materias previsionales, alimentarias y con menores por tiempo indeterminado. Una parte relevante de la audiencia del producto cobra haber previsional. | Mantener la exclusión (no hay alternativa: CA-63 es explícito) y priorizar ese punto en el encargo al estudio. | Tiene impacto comercial que el arquitecto no puede evaluar. |
| **E-6** | **Tres huecos que el dictamen señala y ningún criterio de aceptación cubre**: (a) el requisito de **forma escrita** del pacto de cuota litis, sin el cual el pacto es atacable (§5.E); (b) la segunda regla del art. 2541 CCyC —la interpelación suspende por seis meses **o el plazo menor que corresponda**—, que CA-34 no contempla (§5.A); (c) que los **datos de cumplimiento sin mora no tienen plazo de eliminación** y que el plazo abreviado de dos años estaría condicionado a una **carga probatoria del deudor** (§5.C). | Incorporarlos como criterios nuevos en una v4 de la spec **o** dejarlos explícitamente fuera de alcance con registro. | Son alcance funcional (el QUÉ). Vuelven a **G1**, no se resuelven en G2. |
| **E-7** | **Alcance real de CA-35.** La fecha de corte del DNU 70/2023 es `[D]`: es un razonamiento doctrinario, no un texto. Sin ella no se pueden construir los tramos, así que **todo** hallazgo de punitorio de tarjeta queda INDETERMINABLE, también para hechos anteriores. CA-35 sólo prevé el caso posterior. | Aceptar el comportamiento más restrictivo y dejarlo registrado. | Es más restrictivo que la letra del criterio aprobado; hay que confirmarlo, no asumirlo. |

---

## 11. Verificación de las condiciones del dictamen en G2

| Condición | Estado en este plan |
| --- | --- |
| C-01 (004-B por opción B) | Implementada en el contrato: `PoliticaVisibilidad` con advertencia preventiva **no anulable** y literales `true` para gratuidad y acción recomendada (CA-54 a CA-57). |
| C-02 (bloqueo de producción) | **ADR-013.** Verificable en G5 con dos tests de comportamiento y uno de forma. |
| C-03 (firma del estudio) | **Abierta — dependencia externa.** Escalamiento E-4. El plan no puede cerrarla. |
| C-04 (lenguaje del análisis B) | Tipos de hallazgo y plantillas separan `B_POSIBLE_EXCESO_SUJETO_A_CONTROL_JUDICIAL` de los del régimen de tarjetas. |
| C-05 (desdoblar punitorios) | **ADR-010**, tramos de vigencia. Con la salvedad del escalamiento E-7. |
| C-06 (registros separados y `diesAQuo` ratificado) | `ResultadoRegistroCrediticio` por registro, y `TramoRatificado` **exigido en la firma** del estado `CADUCADO`: CA-39 es una garantía de tipos. |
| C-07 (textos como criterios) | **ADR-014.** Plantillas literales, versionadas, con revisión de UX y ratificación profesional por plantilla. |
| C-08 (salvaguardas S-01 a S-10) | S-01 a S-09 en el contrato y en ADR-012/014/015; S-10 declarada hacia 014/015 (F-12). |
| C-09 (decisión sobre CA-23) | Resuelta en G1 por el product owner (topes separados + compromiso interno). Implementada: `ResultadoAnalisisE` lleva **siempre los dos límites diferenciados** y una alerta de compromiso interno aparte. |
| **C-10** (minimización) | **ADR-015. Es la condición que se verifica en esta compuerta.** Restricción de compilación más guarda de ejecución. |
| C-11 (comisión sobre resultado confirmado) | `ImpactoEconomico.aptoComoBaseDeComision` es el literal `false` y `BaseDeComision` exige `true` más confirmación profesional: el impacto del motor **no satisface el tipo** que la spec 018 exigirá. |
| C-12 (no-confusión) | `AdvertenciaDeConjunto` con clase `NO_CONFUSION_PRESCRIPCION_Y_ARCHIVO`, emitida cuando coexisten ambos hallazgos. |

---

## 12. Decisiones pendientes

Ninguna decisión de arquitectura queda abierta en este plan. Las siete que
quedan abiertas son **humanas o de otra disciplina** y están en §10 (E-1 a E-7).
De ellas, **E-3, E-6 y E-7 vuelven a G1** porque tocan el QUÉ; E-2 requiere una
competencia que el roster no tiene; E-1, E-4 y E-5 son del product owner.
