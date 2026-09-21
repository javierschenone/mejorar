# ADR-029 — Terceros de esta feature: resolución de IP local y obligatoria, y un solo encargado de tratamiento (el correo)

| Campo | Valor |
| --- | --- |
| Estado | PROPUESTO |
| Fecha | 2026-09-21 |
| Autor | arquitecto |
| Aprobado por | pendiente — G2, feature 002 |
| Spec de origen | `specs/002-identidad-y-acceso/spec.md` v3 (CA-13, R-09) |
| Dictamen | §2.2(b), condición **C-002-10** (arts. 12 y 25 de la Ley 25.326) |
| Contrato | `specs/contratos/identidad-y-acceso.ts` §13 |
| Cierra | `ux.md` §13 punto 5 y los huecos `{PROVEEDOR DE CORREO}` de §11.1 |

## Contexto

C-002-10 obliga a identificar en G2, uno por uno, a los terceros que tratan IP,
ubicación, dispositivo y correo, con contrato de encargado de tratamiento
(art. 25) y evaluación de transferencia internacional (art. 12). El dictamen
agrega una recomendación de minimización que vale más que cualquier cláusula:
*"que la resolución IP→ubicación se haga con una base de datos local, no
enviando la IP del cliente a un servicio externo. Es la diferencia entre un
tratamiento interno y una cesión."*

Además está la regla de arquitectura del proyecto: el sistema completo tiene que
correr de punta a punta **sin una sola credencial de terceros**, y eso ya es
criterio de aceptación de la 001 (CA-01, CA-11) y configuración validada
(`INTEGRACIONES_MODO=mock`).

Esta feature toca tres terceros potenciales. La decisión los reduce a uno.

## Decisión

**Dos de los tres se resuelven localmente y dejan de ser terceros. Queda un
único encargado de tratamiento —el correo transaccional—, y su elección concreta
se escala al product owner con recomendación.**

### 1. IP → ubicación: base local descargada, sin excepciones

`PuertoUbicacionPorIp` se implementa **sólo** contra una base de datos
descargada e incorporada a la imagen en tiempo de construcción. **Está prohibido
un adaptador que consulte una API externa**, y por eso `UbicacionAproximada`
declara `fuente: 'BASE_LOCAL'` como literal: un adaptador que consultara a un
tercero no podría construir el tipo de retorno sin mentir en el campo.

Consecuencias directas: **no hay encargado de tratamiento, no hay transferencia
internacional y no hay dependencia de red** para este dato. Se cierra la parte
más molesta de C-002-10 sin firmar nada.

- **Base recomendada: DB-IP Lite (nivel país, y nivel ciudad sólo si se confirma
  que hace falta la provincia).** Licencia Creative Commons con atribución,
  archivo mensual, sin cuenta ni clave. La alternativa habitual, GeoLite2 de
  MaxMind, exige cuenta, clave de licencia y obliga contractualmente a
  actualizar o borrar la copia dentro de un plazo desde cada publicación: es una
  obligación operativa permanente a cambio de una precisión que no necesitamos.
- **Precisión declarada y deliberadamente gruesa**: país y provincia. Objetivo
  país correcto ≥ 95 %; la provincia se rotula siempre como *aproximada* en la
  interfaz (`ux.md` CL-5 ya lo hace). No se guarda ciudad, ni coordenadas, ni
  código postal.
- `versionDeLaBase` se expone en el puerto y se registra junto a la sesión: si
  alguien pregunta por qué el sistema dijo "Córdoba", hay con qué responder.
- **Atribución**: la licencia obliga a acreditar la fuente. Es una línea en la
  página de créditos o en la política de privacidad (obligación F-13).
- La actualización mensual del archivo es tarea de `cicd`; un archivo viejo
  degrada la precisión, no la disponibilidad.

### 2. Dispositivo: análisis local, y el agente de usuario se descarta

`PuertoDescripcionDeDispositivo` analiza la cadena de agente de usuario **en el
proceso** y devuelve categorías cerradas (escritorio / teléfono / tableta /
aplicación móvil / desconocido, más familia de sistema y de navegador). **La
cadena cruda no se guarda**: es una huella con más entropía de la que este
producto necesita, y guardarla contradice la minimización del art. 4.

Se implementa **sin dependencia**: unas pocas decenas de líneas de coincidencia
de patrones bastan para cinco categorías, con una batería de 200 agentes de
usuario reales como fijación. Se descarta usar `ua-parser-js` —la biblioteca
obvia— porque cambió su licencia a una forma dual restrictiva para uso
comercial: no es una dependencia que convenga heredar para resolver algo de
cincuenta líneas.

### 3. Correo transaccional: un encargado de tratamiento, tres modos

`PuertoCorreoTransaccional` con tres implementaciones:

| Modo | Dónde | Qué hace |
| --- | --- | --- |
| `MOCK` | tests y `INTEGRACIONES_MODO=mock` | Determinista: guarda el mensaje en memoria y lo expone para verificar. Ningún test depende de red |
| `SMTP_LOCAL` | desarrollo | Servidor de captura local (Mailpit o equivalente, contenedor del entorno de 001); la persona que desarrolla ve el correo en un navegador |
| `PROVEEDOR` | preproducción y producción | Adaptador del proveedor elegido |

Reglas que valen para los tres:

- **Cola con reintentos y clave de idempotencia** (constitución #12): el envío
  nunca ocurre en el camino de respuesta (ADR-025), y dos avisos iguales por el
  mismo hecho no salen dos veces.
- **Minimización del contenido**: al proveedor viaja la dirección de correo, la
  plantilla y variables de valores cerrados. **Nunca** un dato patrimonial, ni
  el CUIT/CUIL, ni el estado del expediente. Lo garantiza el tipo
  `MensajeTransaccional`, cuyas variables son `DatoDeEvento`.
- **Todo correo es accionable** (C-002-06): `acciones` es una tupla no vacía en
  el tipo, así que un correo sin salida no compila.
- El proveedor **es** un encargado de tratamiento (art. 25) y trata direcciones
  de correo de titulares: requiere acuerdo de tratamiento firmado y evaluación
  del art. 12.

**Criterios de selección del proveedor** (los fija el arquitecto; la elección la
hace el product owner):

1. País de tratamiento con **nivel adecuado de protección** reconocido por la
   autoridad argentina —el listado incluye a los estados de la Unión Europea y
   del Espacio Económico Europeo, entre otros— o, en su defecto, **cláusulas
   modelo** de la Disposición 60-E/2016 firmadas. *Confirmación del encuadre y
   del listado vigente: `compliance-legal` y el estudio; el arquitecto sólo fija
   el criterio técnico de preferir la primera opción.*
2. Acuerdo de encargado de tratamiento disponible sin negociación caso por caso.
3. Compromiso de no usar el contenido para perfilado ni entrenamiento.
4. Retención de registros configurable y corta.
5. Dominio propio con SPF, DKIM y DMARC; sin enlaces de rastreo ni píxeles de
   apertura (son tratamiento adicional y no los necesitamos).
6. Costo previsible en el volumen del piloto.

**Recomendación del arquitecto: Amazon SES en la región de Irlanda
(`eu-west-1`).** Es aburrido, es barato, el acuerdo de tratamiento es estándar y
el tratamiento ocurre en un país de nivel adecuado, lo que evita las cláusulas
modelo. Alternativa si se prioriza la facilidad de operación: Postmark o
Mailgun con región europea; si el tratamiento quedara en los Estados Unidos, hay
que firmar cláusulas modelo y decirlo en la política de privacidad. **La
elección es del product owner: escalamiento E-2 del plan**, porque compromete
costo y la firma de un contrato.

Hasta que se decida, `ux.md` puede escribir `{PROVEEDOR DE CORREO}` con la
recomendación entre paréntesis; el nombre concreto aparece en la política de
privacidad, no en la pantalla de alta.

### 4. Reloj

`PuertoReloj` existe porque el dominio no lee el reloj (ADR-016). No es un
tercero; se declara acá para que la lista de puertos de la feature esté completa.

### Verificación

`tester`: la suite completa corre con `INTEGRACIONES_MODO=mock` y **sin ninguna
variable de credencial definida** (criterio heredado de la 001); test de que el
adaptador de ubicación no abre ninguna conexión de red; test de que la cadena de
agente de usuario cruda no aparece en ninguna tabla ni en ningún evento; test de
que dos envíos con la misma clave de idempotencia producen un solo correo; test
de plantilla que verifica que **cada** `ClavePlantillaCorreo` tiene al menos una
acción.

## Alternativas consideradas

| Alternativa | A favor | En contra | Por qué no |
| --- | --- | --- | --- |
| **Geolocalización por API externa** (ipinfo, ipapi, MaxMind en línea) | Precisión mucho mayor, cero mantenimiento de archivos | Envía la IP de cada titular a un tercero: encargado de tratamiento, probable transferencia internacional, y una dependencia de red en cada ingreso | El dictamen recomienda expresamente lo contrario, y la precisión fina no aporta nada: el usuario sólo necesita reconocer "no fui yo" |
| GeoLite2 de MaxMind local | Más preciso que las alternativas libres | Cuenta, clave y obligación contractual de actualizar o borrar en plazo | Obligación operativa permanente por precisión que no usamos |
| No mostrar ubicación en absoluto | Minimización máxima, cero trabajo | CA-13 la exige, y es la señal que le permite al usuario reconocer un acceso ajeno | Cerrado por la spec |
| Guardar el agente de usuario crudo "por si sirve" | Depuración más fácil | Huella de alta entropía, conservada sin finalidad declarada | Es el ejemplo de manual del art. 4. Se guardan categorías |
| `ua-parser-js` u otra biblioteca de análisis | Mantenida, exhaustiva | Licencia dual restrictiva para uso comercial en las versiones actuales; y resuelve mucho más de lo que necesitamos | Cincuenta líneas propias con fijaciones. "Aburrido gana" también significa "no heredar un problema de licencia" |
| **Servidor SMTP propio** para el correo | Cero encargados de tratamiento, control total | La entregabilidad es un oficio: reputación de IP, listas negras, DMARC. Un correo de confirmación que cae en no deseado deja a la persona afuera del servicio | Se descarta como camino principal. Queda como plan de contingencia del proveedor |
| Mercado Pago, WhatsApp u otro canal en vez del correo | Donde la audiencia ya está | La 002 no los tiene integrados, exigen un teléfono que hoy no pedimos y el canal de confirmación de una cuenta debe ser el que la identifica | Fuera de alcance; el correo es el identificador de la cuenta |
| Elegir el proveedor de correo en este ADR | Cierra el tema hoy | Compromete costo y la firma de un contrato con un tercero | No es decisión del arquitecto. Recomendación + **escalamiento E-2** |
| Dos proveedores de correo con conmutación | Disponibilidad | Dos contratos, dos encargados, dos configuraciones de DNS | Desproporcionado hoy. El puerto lo permite el día que haga falta |

## Consecuencias

**Positivas**

- **Un solo encargado de tratamiento en toda la feature.** De los cuatro
  terceros que C-002-10 podía haber traído, quedan tres resueltos localmente y
  uno solo por contratar. Es el mejor resultado posible frente a los arts. 12 y
  25.
- El sistema completo sigue corriendo sin credenciales: alta, ingreso,
  recuperación y sesiones funcionan en modo mock de punta a punta.
- Ningún tercero está en el camino crítico de una respuesta al usuario.

**Negativas**

- La ubicación va a ser a veces incorrecta (red móvil, proveedor con
  direcciones centralizadas). Se mitiga rotulándola como aproximada y no
  usándola **nunca** para decidir nada: es informativa para el titular, jamás
  entrada de una regla de seguridad.
- Hay un archivo de geolocalización y una lista de contraseñas filtradas
  (ADR-024) que mantener actualizados y que pesan en la imagen.
- El análisis de agente de usuario propio va a quedar desactualizado con
  navegadores nuevos; el modo de falla es `DESCONOCIDO`, que es inofensivo.

**Qué cierra**

- Cualquier adaptador de geolocalización que use la red.
- Guardar la cadena de agente de usuario.
- Enviar datos patrimoniales al proveedor de correo.

## Cómo se revierte

- **Pasar a geolocalización por API**: medio día de código y un encargado de
  tratamiento nuevo, con contrato, evaluación del art. 12 y actualización de la
  información del art. 6 en la pantalla de alta. El literal `'BASE_LOCAL'`
  obliga a tocar el contrato, o sea a pasar por G2. Es caro a propósito.
- **Cambiar de proveedor de correo**: es el puerto mejor aislado de todos. Un
  día de adaptador, más el cambio de registros DNS y el contrato. La cola y las
  plantillas no se tocan.
- **Volver a SMTP propio**: dos o tres días de código y un problema de
  entregabilidad que no se resuelve con código.

---

**Fuentes consultadas para el criterio de transferencia internacional** (no son
verificación legal; el encuadre lo confirma `compliance-legal`):
[AAIP — Transferencias internacionales](https://www.argentina.gob.ar/aaip/datospersonales/transferencias-internacionales),
[Disposición 60-E/2016, texto](https://www.argentina.gob.ar/normativa/nacional/267922/texto).
