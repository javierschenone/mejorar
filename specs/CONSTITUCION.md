# Constitución del proyecto Mejorar

Principios no negociables. Toda especificación, decisión de arquitectura,
implementación y pieza de comunicación se valida contra esta lista. Un agente que
detecta un conflicto entre una tarea que le asignaron y esta constitución
**detiene la tarea y lo escala al orquestador**.

Modificar esta constitución requiere aprobación humana explícita y queda
registrado en `REGISTRO-COMPUERTAS.md`.

---

### 1. El deudor sale mejor de lo que entró

El producto existe para mejorar la situación patrimonial de una persona
sobreendeudada. Cualquier función que aumente el ingreso de la plataforma
empeorando la posición del cliente está prohibida, aunque sea legal.

### 2. Especificación antes que código

Nada se implementa sin una spec aprobada por un humano. El código es la
consecuencia de una decisión escrita, no el lugar donde la decisión se toma.

### 3. El humano decide, los agentes ejecutan

Alcance, encuadre legal, precios, arquitectura y despliegue son decisiones
humanas. Los agentes producen el material para decidir y ejecutan lo decidido.
Ningún agente amplía su propio mandato.

### 4. Separación estricta de responsabilidades

El orquestador no escribe código. El arquitecto no implementa. El desarrollador
no redefine el modelo de datos. El tester no toca código de producción. La
disciplina de roles es lo que hace auditable el resultado.

### 5. Los datos personales son del titular, no nuestros

Ley 25.326. Consentimiento expreso, informado, versionado y revocable antes de
cualquier consulta a un bureau. Minimización: no se guarda lo que no se necesita.
Cifrado en reposo de todo dato patrimonial identificable. Toda lectura de
información sensible queda en una bitácora inmutable.

### 6. Nunca se promete un resultado

Prohibido en código, en UI, en marketing y en cualquier mensaje: "borramos tu
Veraz", "eliminamos tu deuda", "garantizamos la quita". Se dice *gestionamos*,
*negociamos*, *estimado*. Toda proyección se rotula como estimación y aclara que
no es asesoramiento legal ni financiero.

### 7. No se vende lo que el cliente no puede pagar

La cuota de la suscripción se valida contra la capacidad de pago real del
cliente, calculada sin comprometer el mínimo inembargable. Si no entra, el
sistema ofrece un plan menor o el plan gratuito. Validado en código, no en la
buena intención del vendedor.

### 8. No se cobra por lo que el cliente ya tenía gratis

Si el diagnóstico detecta que una deuda está presumiblemente prescripta o que un
dato crediticio ya cumplió su plazo de archivo, se le informa al cliente aunque
eso reduzca la base de comisión.

### 9. No custodiamos fondos de terceros

El cliente le paga directamente al acreedor. La plataforma cobra su suscripción y
su comisión, nada más. Cambiar esto exige análisis regulatorio previo y
aprobación humana en compuerta específica.

### 10. Los honorarios de abogados no se reparten

El fee que paga un abogado a la plataforma nunca es un porcentaje de sus
honorarios: es abono de plataforma, fee por lead o fee por caso gestionado, de
monto fijo. Restricción deontológica implementada y cubierta por test.

### 11. El derecho argentino es un parámetro, no una constante

Plazos, topes y porcentajes normativos viven como configuración con su cita, su
vigencia y una marca de `requiereValidacionProfesional`. Nunca incrustados en la
lógica. Ninguna afirmación jurídica del sistema se presenta como definitiva sin
confirmación de un abogado matriculado.

### 12. Idempotencia en todo efecto externo

Una carta documento duplicada, una denuncia duplicada o un cobro duplicado son
daños reales. Toda operación que produce efectos fuera del sistema lleva clave de
idempotencia y queda registrada.

### 13. Accesible y claro

La audiencia está bajo estrés financiero. La interfaz usa lenguaje llano, evita
la jerga bancaria, funciona en teléfonos de gama baja y con conexión pobre, y
cumple WCAG 2.2 AA. Una pantalla que el cliente no entiende es un defecto.

### 14. Todo lo que se afirma, se prueba

"Funciona" significa que hay un test que lo demuestra y un informe de QA que lo
registra. Si algo quedó sin probar, se dice explícitamente.
