# 01 — Visión y modelo de negocio

## Problema

En Argentina hay millones de personas con deudas en mora en el sistema financiero
(bancos, emisoras de tarjetas, fintechs, financieras no reguladas) y con sus
obligaciones cedidas a estudios de cobranza. El deudor individual negocia en una
posición estructuralmente débil:

- **Asimetría de información**: no sabe cuánto debe realmente, qué parte del saldo
  es capital y qué parte intereses punitorios, si la deuda está prescripta, ni qué
  informan de él el BCRA y los bureaus privados.
- **Asimetría de poder**: un deudor suelto vale poco para el acreedor; una cartera
  de 500 deudores del mismo acreedor vale una negociación.
- **Asimetría legal**: desconoce la Ley 24.240 (Defensa del Consumidor), la
  Ley 25.326 (Habeas Data) o los topes del Decreto 484/87 sobre embargo de haberes,
  y no puede pagar un abogado por adelantado.

## Propuesta de valor

**Mejorar** es una plataforma que capta deudores, ordena su situación, y convierte
la masa de deudores en poder de negociación real:

| Eje | Qué entrega |
| --- | --- |
| **Diagnóstico** | Consolida deudas desde BCRA, bureaus y carga asistida. Detecta intereses por encima de los topes legales, deudas prescriptas e informes vencidos. |
| **Negociación individual** | Gestión ante bancos, financieras y estudios de cobranza para obtener quitas y planes de pago sostenibles. |
| **Negociación colectiva** | Agrupa deudores por acreedor y producto para negociar quitas de cartera, que históricamente superan a las individuales. |
| **Asistencia legal** | Marketplace de abogados verificados, con el caso gestionado 100% digital: poder, carta documento, denuncia en Defensa del Consumidor, habeas data, defensa en juicios y embargos. |
| **Educación financiera** | Cursos, simuladores y presupuesto, para que el deudor no reincida. |
| **Limpieza de antecedentes** | Seguimiento de los plazos de los arts. 26 y 16 de la Ley 25.326 y gestión de la supresión/actualización de datos vencidos. |

## Fuentes de ingreso

### 1. Suscripción mensual del cliente (ingreso recurrente, principal)

Es el pago por **la gestión**: el trabajo ante bancos, estudios de cobranza y
calificadoras. Se cobra exista o no acuerdo, porque el trabajo se hace igual.

| Plan | Precio de referencia | Incluye |
| --- | --- | --- |
| **Diagnóstico** (gratuito) | $0 | Consolidación de deudas, informe BCRA, detección de prescripción, simuladores. |
| **Gestión** | mensual | Todo lo anterior + negociación con hasta 3 acreedores, cartas documento, seguimiento, educación financiera. |
| **Gestión Plena** | mensual | Acreedores ilimitados, participación en negociaciones colectivas, gestión de habeas data, prioridad. |
| **Integral** | mensual | Todo + abogado asignado, defensa en juicios y embargos, denuncias en Defensa del Consumidor. |

Reglas de producto (ver `packages/shared/src/negocio/planes.ts`):

- La cuota mensual **no puede** representar más de un porcentaje configurable de
  la capacidad de pago disponible del cliente. Si la excede, el sistema bloquea el
  alta del plan y ofrece uno inferior. Vender gestión a quien no puede comerla es
  agravar el sobreendeudamiento.
- Baja online inmediata, sin permanencia (Ley 24.240 y Res. SCI 424/2020 — "botón
  de arrepentimiento" y baja por el mismo medio que el alta).

### 2. Comisión de éxito sobre la quita (ingreso variable)

Un **x% de la quita efectivamente lograda**, donde:

```
quita = saldo reclamado por el acreedor − monto acordado
comisión = quita × porcentaje_del_plan
```

Topes aplicados por el motor de comisiones
(`packages/shared/src/negocio/comisiones.ts`):

- Se cobra **sólo sobre quita real y verificada**, nunca sobre "ahorro proyectado".
- Se devenga **contra acuerdo firmado**, y se percibe en cuotas atadas al
  cumplimiento del plan por parte del cliente: si el cliente deja de pagar el
  acuerdo, se suspende el devengamiento.
- Tope duro: la comisión no puede superar un porcentaje del **monto acordado**
  (parámetro `topeSobreMontoAcordadoPct`), para que nunca empeore el flujo de caja
  del cliente.
- En casos con patrocinio letrado y pacto de cuota litis, la suma de honorarios
  del abogado + comisión de plataforma se valida contra el límite del pacto
  (Ley 27.423, art. 5 y concordantes provinciales).

### 3. Ingresos del lado abogados

Los abogados pagan por **acceso a clientes y por la gestión digital del caso**:

- `SUSCRIPCION_PLATAFORMA`: abono mensual por el estudio digital (expediente,
  plantillas, firma, cartas documento, agenda, facturación).
- `FEE_POR_LEAD`: valor fijo por cada caso aceptado y verificado.
- `FEE_POR_CASO_GESTIONADO`: valor fijo por caso llevado hasta su cierre en la
  plataforma.

> **Restricción deontológica dura.** El fee al abogado **nunca** se define como un
> porcentaje de sus honorarios. Los códigos de ética de los colegios públicos de
> abogados (p. ej. CPACF) prohíben la participación de honorarios con quien no es
> abogado. El motor de tarifas (`packages/shared/src/negocio/abogados.ts`) rechaza
> por diseño cualquier configuración de tipo "porcentaje de honorarios" y el test
> correspondiente lo verifica.

### 4. Lo que la plataforma NO hace

Decisiones de diseño tomadas para evitar convertirse en un sujeto regulado que no
somos y para no exponer al cliente:

- **No custodia fondos de los clientes.** El cliente le paga directamente al
  acreedor. La plataforma sólo cobra su suscripción y su comisión. Esto evita caer
  en la figura de intermediación financiera y reduce drásticamente la exposición a
  normativa de prevención de lavado (UIF).
- **No compra ni vende carteras de deuda.**
- **No otorga crédito ni refinancia con capital propio.**
- **No promete "borrar el Veraz".** Promete gestionar los plazos y derechos que la
  Ley 25.326 efectivamente otorga. La promesa falsa es, además, publicidad engañosa
  (Ley 24.240, art. 4 y 8).

## Métricas del negocio

| Métrica | Definición |
| --- | --- |
| Deuda bajo gestión (DBG) | Suma de saldos reclamados de casos activos. |
| Quita promedio | Media ponderada de `quitaPct` sobre acuerdos firmados. |
| Tasa de conversión a acuerdo | Acuerdos firmados / negociaciones iniciadas. |
| Cumplimiento de acuerdos | Cuotas pagas / cuotas vencidas de acuerdos firmados. |
| Churn de suscripción | Bajas del mes / activos al inicio del mes. |
| Poder colectivo | Saldo agregado por acreedor en colectivos abiertos. |
| CAC / LTV | Por canal de captación. |

## Ética del producto

El negocio sólo es sostenible si el deudor sale mejor de lo que entró. Tres reglas
que atraviesan el código:

1. **Nunca cobrar por lo que el cliente podía conseguir gratis sin saberlo.** Si el
   diagnóstico detecta que una deuda está prescripta o que el informe crediticio ya
   venció, se le informa aunque eso reduzca la base de comisión.
2. **Nunca vender un plan que el cliente no puede pagar.** Validado en código.
3. **Nunca prometer resultados.** Toda proyección de la plataforma se rotula como
   estimación y no constituye asesoramiento legal ni financiero.
