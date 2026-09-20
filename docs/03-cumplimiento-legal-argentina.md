# 03 — Cumplimiento legal (Argentina)

> **Advertencia.** Este documento y el catálogo normativo del código
> (`packages/shared/src/legal/normativa.ts`) son una **base de trabajo para el
> equipo legal**, no asesoramiento jurídico. Cada parámetro está marcado con su
> cita y con un campo `requiereValidacionProfesional`. Antes de salir a producción,
> un estudio jurídico matriculado debe ratificar cada valor, revisar la normativa
> provincial aplicable y confirmar la vigencia de las resoluciones citadas. Los
> plazos y topes están implementados como **configuración**, no como constantes
> incrustadas, precisamente para que puedan corregirse sin tocar la lógica.

## 1. Marco que atraviesa todo el producto

### Ley 25.326 — Protección de Datos Personales (Habeas Data)

Es la norma central: el producto vive de tratar datos patrimoniales de personas.

| Artículo | Qué obliga | Cómo se implementa |
| --- | --- | --- |
| Art. 5 | Consentimiento libre, expreso e informado. | Módulo `consentimientos`: consentimientos versionados por finalidad, con IP, fecha y texto exacto aceptado. Sin consentimiento vigente para la finalidad "consulta de informes crediticios", el adaptador de bureau **lanza excepción antes de salir a la red**. |
| Art. 6 | Información previa al titular sobre finalidad, destinatarios y derechos. | Texto de consentimiento almacenado íntegro y mostrado en la app. |
| Art. 14/15 | Derecho de acceso, gratuito cada 6 meses, respuesta en 10 días corridos. | Exportación de datos personales desde el portal del cliente. |
| Art. 16 | Rectificación, actualización o supresión: 5 días hábiles. | `habeas-data.ts` calcula los vencimientos y el back-office alerta antes de que se cumplan. |
| Art. 26 | Régimen de los servicios de información crediticia, incluidos los plazos máximos de archivo de datos de incumplimiento. | `habeas-data.ts` modela los plazos como parámetros y calcula la fecha en la que un dato deja de poder informarse; el sistema genera la intimación de supresión automáticamente. |
| Art. 33 y ss. | Acción de habeas data. | Flujo de documento `HABEAS_DATA` en el módulo `documentos`. |

**Importante:** los plazos concretos del art. 26 (archivo de datos de
incumplimiento, y plazo abreviado cuando la obligación se cancela o extingue) están
en `LEY_25326.plazosArchivo` como parámetros configurables. El equipo legal debe
ratificar los valores vigentes al momento del lanzamiento, incluida la
jurisprudencia sobre el cómputo del plazo.

### Ley 24.240 (t.o. Ley 26.361) — Defensa del Consumidor

| Artículo | Relevancia para el producto |
| --- | --- |
| Art. 4 | Deber de información. Aplica a **nosotros**: precio total del plan, alcance real del servicio, qué no incluye. |
| Art. 8 bis | Trato digno. Prohíbe conductas vergonzantes, vejatorias o intimidatorias en el cobro. Es la base de la mayoría de las denuncias que la plataforma gestiona contra estudios de cobranza (llamados a horarios indebidos, contacto con el empleador o vecinos, amenazas de embargo inexistentes). El módulo `documentos` incluye una plantilla de denuncia específica y el cliente puede cargar evidencia (audios, capturas) desde la app. |
| Art. 36 | Operaciones de crédito para consumo: exige informar TNA, TEA, costo financiero total, cantidad de cuotas. Su incumplimiento habilita planteos de nulidad. Además fija la competencia del domicilio real del consumidor, lo que permite oponer **incompetencia territorial** cuando el acreedor demanda en otra jurisdicción. |
| Art. 37 | Cláusulas abusivas: se tienen por no convenidas. |
| Art. 52 bis | Daño punitivo. |
| Res. SCI 424/2020 y concordantes | Botón de arrepentimiento y baja por el mismo medio que el alta: implementado en el portal y en la app. |

### Ley 25.065 — Tarjetas de Crédito

Fija límites a los intereses y reglas de prescripción específicas para la relación
emisor–titular. En el código, `legal/intereses.ts` valida el saldo informado por el
acreedor contra los topes de interés compensatorio y punitorio, y
`legal/prescripcion.ts` contempla el régimen especial de esta ley separado del
régimen general del Código Civil y Comercial. Ambos con sus parámetros marcados
para validación profesional.

### Código Civil y Comercial — prescripción liberatoria

`legal/prescripcion.ts` implementa un motor que, dado el tipo de obligación y la
fecha de exigibilidad, calcula la fecha estimada de prescripción y el estado
(`VIGENTE`, `PROXIMA_A_PRESCRIBIR`, `PRESCRIPTA`), junto con las causales de
suspensión e interrupción cargadas en el caso (reconocimiento de deuda, pago
parcial, demanda, mediación). **El motor nunca afirma que una deuda "está
prescripta": devuelve una estimación con su fundamento y la marca como sujeta a
confirmación por abogado.** Un pago parcial mal informado cambia el resultado, y la
prescripción debe oponerse como defensa, no opera sola.

### Anatocismo e intereses

El Código Civil y Comercial limita la capitalización de intereses y la normativa
del BCRA fija relaciones máximas entre interés compensatorio y punitorio.
`legal/intereses.ts` recibe el detalle de composición del saldo que informa el
acreedor y devuelve los **excesos detectados** con su cita, que alimentan tanto la
estrategia de negociación como la denuncia administrativa.

### Decreto 484/87 y art. 147 LCT — embargo de haberes

Las remuneraciones son embargables sólo por encima del Salario Mínimo Vital y Móvil
y con topes porcentuales escalonados. `legal/embargos.ts` calcula el monto máximo
legalmente embargable de un salario dado el SMVM vigente, lo que se usa para:

1. detectar embargos trabados por encima del tope y pedir su readecuación;
2. calcular la **capacidad de pago real** del cliente sin comprometer el mínimo
   inembargable.

La normativa del BCRA sobre cuentas sueldo (intangibilidad y prohibición de
compensación por parte del banco) se refleja en las alertas del diagnóstico.

### Ley 27.423 — Honorarios profesionales

Relevante por el límite al pacto de cuota litis. `legal/honorarios.ts` valida que
la suma de honorarios pactados por el abogado más la comisión de éxito de la
plataforma no exceda el límite aplicable sobre el resultado económico del pleito, y
contempla el límite diferenciado en materia laboral. Los porcentajes son
parámetros; las jurisdicciones provinciales tienen sus propias leyes arancelarias y
deben cargarse en la tabla por jurisdicción.

### Ética profesional — prohibición de partición de honorarios

Los códigos de ética de los colegios de abogados prohíben compartir honorarios con
quien no es abogado. Consecuencia de diseño, verificada por test:
`negocio/abogados.ts` **no admite** tarifas del tipo "porcentaje de honorarios".
Sólo abono de plataforma, fee por lead y fee por caso gestionado, todos de monto
fijo o escalonado por volumen, independientes del honorario que el abogado perciba.

### Publicidad

La Ley 24.240 (arts. 4, 7 y 8) y la Ley 22.802 de Lealtad Comercial impiden
prometer resultados. Regla de producto: ninguna pieza de comunicación puede decir
"borramos tu Veraz" o "eliminamos tu deuda". El copy de la app usa "gestionamos",
"negociamos", "estimado".

### Prevención de lavado de activos

La decisión de **no custodiar fondos de terceros** (el cliente paga directo al
acreedor) mantiene a la plataforma fuera de la operatoria que caracteriza a los
sujetos obligados por movimiento de fondos. Igualmente se aplican controles de
identidad (KYC liviano: validación de CUIL contra padrón) y se conserva la
trazabilidad de los cobros propios. Si en el futuro se decide administrar fondos,
**se requiere análisis específico de encuadre ante la UIF antes de implementarlo**.

### Defensa de la competencia

La negociación colectiva se hace del lado de la demanda (deudores), con
participación voluntaria, sin fijar precios de mercado ni intercambiar información
sensible entre acreedores. Aun así, el módulo `colectivos` registra la finalidad y
el alcance de cada negociación para poder acreditar que no hay coordinación entre
competidores. Requiere opinión de un especialista en competencia antes de escalar.

## 2. Controles implementados en código

| Control | Archivo |
| --- | --- |
| Validación de CUIT/CUIL (dígito verificador) | `shared/src/identidad/cuit.ts` |
| Catálogo de normas citadas con vigencia | `shared/src/legal/normativa.ts` |
| Motor de prescripción | `shared/src/legal/prescripcion.ts` |
| Topes de interés compensatorio/punitorio | `shared/src/legal/intereses.ts` |
| Plazos de permanencia de información crediticia | `shared/src/legal/habeas-data.ts` |
| Topes de embargabilidad de haberes | `shared/src/legal/embargos.ts` |
| Límite de cuota litis y honorarios | `shared/src/legal/honorarios.ts` |
| Tope y devengamiento de comisión de éxito | `shared/src/negocio/comisiones.ts` |
| Prohibición de fee como % de honorarios | `shared/src/negocio/abogados.ts` |
| Bloqueo de plan por encima de capacidad de pago | `shared/src/negocio/planes.ts` |
| Consentimiento previo obligatorio para bureaus | `integrations/src/core/consentimiento.ts` |
| Bitácora inmutable de accesos | `api/src/modulos/auditoria` |

## 3. Pendientes para el equipo legal antes de producción

1. Ratificar todos los parámetros marcados con `requiereValidacionProfesional`.
2. Redactar los textos definitivos de: términos y condiciones, política de
   privacidad, consentimiento para consulta de informes crediticios, poder para
   gestión extrajudicial, y convenio de honorarios del abogado.
3. Definir el encuadre societario y fiscal, y el circuito de facturación
   electrónica (condición frente al IVA, tipo de comprobante por concepto).
4. Inscribir las bases de datos ante la autoridad de aplicación de la Ley 25.326 y
   designar responsable de datos personales.
5. Analizar el régimen de cada jurisdicción provincial donde se opere (defensa del
   consumidor local y ley arancelaria).
6. Revisar el modelo de negociación colectiva con un especialista en defensa de la
   competencia.
