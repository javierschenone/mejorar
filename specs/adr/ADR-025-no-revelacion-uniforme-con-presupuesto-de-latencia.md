# ADR-025 — No-revelación uniforme: misma respuesta, mismo trabajo y mismo piso de latencia exista o no la cuenta

| Campo | Valor |
| --- | --- |
| Estado | PROPUESTO |
| Fecha | 2026-09-21 |
| Autor | arquitecto |
| Aprobado por | pendiente — G2, feature 002 |
| Spec de origen | `specs/002-identidad-y-acceso/spec.md` v3 (CA-02, CA-04, CA-06, CA-08, CA-09, CA-12, CA-15, CA-17, CA-36, CA-37, R-05) |
| Dictamen | §2.2(c), D-002-02 (contradicción interna), C-002-04, C-002-06 |
| Contrato | `specs/contratos/identidad-y-acceso.ts` §9 y §14 |

## Contexto

R-05 es categórico: ninguna respuesta de autenticación revela si un correo
existe. El dictamen encontró que la spec v1 protegía el correo y **habilitaba la
enumeración por CUIT/CUIL** (§7 bloqueaba el segundo alta), y lo llamó por su
nombre: un oráculo. La v3 corrigió CA-04 y lo igualó al tratamiento del correo.
Lo que revela ese oráculo no es trivial: que una persona determinada es usuaria
de una plataforma de gestión de deudas, o sea, una inferencia sobre su situación
patrimonial.

Ahora bien: igualar el **texto** de las respuestas no alcanza. Un sistema que
responde lo mismo pero tarda 300 ms cuando la cuenta existe y 15 ms cuando no,
lo está diciendo igual, más fuerte y de forma automatizable. Lo mismo vale para
el tamaño del cuerpo, las cabeceras, el código de estado, el comportamiento del
límite de tasa y —el que casi siempre se escapa— **la existencia misma de un
correo enviado**.

Éste es también el punto donde chocan dos criterios: CA-09 exige bloquear por
intentos fallidos, y el bloqueo es, por naturaleza, observable. Si sólo se
bloquean las cuentas que existen, **el bloqueo es el oráculo**.

## Decisión

**Todos los caminos que no deben revelar existencia comparten una única
respuesta, un único presupuesto de latencia y un trabajo equivalente, y todo
efecto que dependa de la existencia ocurre fuera del camino de respuesta.**

### 1. Respuesta única

Alta (CA-01/CA-02/CA-04), pedido de recuperación (CA-15), uso de enlace de
confirmación o de recuperación (CA-06/CA-17) y primer paso del ingreso (CA-08)
devuelven **`202` con `RespuestaUniforme`**: misma forma, misma clave de
plantilla, mismas cabeceras, mismo tamaño salvo identificadores de correlación
de longitud fija. La distinción existe sólo en la bitácora interna.

`401` es indistinto entre credencial inválida, token vencido y token inválido
(CA-12). `429` sale con **las mismas cabeceras** exista o no la cuenta.

### 2. Trabajo equivalente

- **Hash señuelo.** Si la cuenta no existe, se verifica igual la contraseña
  contra `hashSenuelo`, un hash real con los mismos parámetros de ADR-024. El
  costo dominante del camino es el mismo en los dos casos.
- **Desafío siempre.** El primer paso del ingreso emite siempre un
  `DesafioDeIngreso`. Para una cuenta inexistente, `id` y `siguientePaso` se
  derivan **de forma determinista** del identificador presentado
  (HMAC con clave del servidor), de modo que el mismo correo inexistente produce
  siempre el mismo desafío y la misma pantalla siguiente. Si el desafío
  apareciera sólo para cuentas con MFA, el desafío sería el oráculo.
- **Índice ciego.** La búsqueda por correo y por CUIT/CUIL se hace contra un
  `IndiceCiego` —HMAC con clave fuera de la base—: costo constante,
  independiente de que exista o no, y además permite detectar el duplicado sin
  guardar el CUIT/CUIL en claro (F-01).
- **Encolado siempre.** El envío de correo se **encola en todos los casos**; el
  trabajador decide después si hay destinatario. El camino de respuesta nunca
  espera al proveedor, así que la disponibilidad o la lentitud del correo no
  filtra nada ni afecta la latencia.

### 3. Presupuesto de latencia

`PresupuestoDeLatencia` con **piso de 400 ms** y **ruido aleatorio de 0 a 80 ms
por encima del piso**. El ruido va *además* del piso, nunca en lugar del piso:
promediar muchas muestras anula el ruido, no anula el piso. Si el trabajo real
excede el piso, se registra y alerta: significa que el piso quedó chico y está
filtrando.

### 4. El bloqueo no puede ser el oráculo

La política de bloqueo (5 intentos / 15 minutos / 15 minutos de bloqueo,
decisión 002-A, CA-37) se aplica sobre una **`ClaveDeTrafico`** = HMAC del
identificador presentado (correo o CUIT/CUIL) con clave del servidor, **exista o
no la cuenta**. Un atacante que prueba mil CUILes ve exactamente el mismo
comportamiento en todos.

Segunda dimensión, acumulativa: límite por dirección IP y por rango, con
umbrales más altos, para que un solo origen no pueda barrer un padrón. Los dos
son parámetros de producto.

**CA-36 es un literal, no una opción.** `PoliticaDeBloqueo.laRecuperacionSiempre­Disponible`
es el literal `true`: el camino de recuperación de contraseña **nunca** queda
inhabilitado por el bloqueo de intentos fallidos. No se puede poner en `false`
porque el tipo no lo admite. Sin esa salida, cualquiera deja fuera de servicio
la cuenta de otro tipeando mal cinco veces (recaudo A-1, art. 8 bis).

### 5. El duplicado se resuelve por el canal del titular real

Ni el correo ni el CUIT/CUIL duplicados alteran la respuesta. La segunda alta se
crea `NO_VERIFICADA` como cualquier otra y **nunca se confirma**: se purga por
`retencion.cuentaNoVerificada` (CA-28). Al titular real se le manda el correo
accionable correspondiente (`INTENTO_DE_ALTA_CON_CORREO_YA_REGISTRADO` o
`..._CON_CUIT_YA_REGISTRADO`), con al menos una acción concreta —entrar o
recuperar contraseña— porque C-002-06 prohíbe los callejones sin salida.
`ResolucionDeDuplicado` registra el hecho para el back-office.

Dos consecuencias que hay que decir: **(a)** un tercero puede provocar que al
titular real le llegue un correo, así que ese envío lleva clave de idempotencia
y límite de frecuencia por titular (uno cada 24 h); **(b)** el segundo
registrante llega a la pantalla "revisá tu correo" y no recibe nada. Es
deliberado y es lo que `ux.md` AL-4 resuelve con la tercera viñeta: la pantalla
dice qué hacer si el correo no llega.

### Verificación

Un test por CA-02, CA-04, CA-06, CA-09, CA-12, CA-15, CA-17, CA-36 y CA-37.
Además, tres pruebas que son la verdadera defensa:

1. **Igualdad de respuesta byte a byte** entre cuenta existente e inexistente,
   normalizando los identificadores de correlación: cuerpo, código, cabeceras y
   longitud.
2. **Prueba estadística de temporización**: 1000 muestras de cada caso;
   `|Δ mediana| ≤ 15 ms` y `|Δ p95| ≤ 40 ms`. Corre en el pipeline con umbral
   que falla la construcción.
3. **Prueba de enumeración por bloqueo**: 10 identificadores inexistentes y 10
   existentes contra la política de bloqueo; las dos series producen la misma
   secuencia de respuestas.

## Alternativas consideradas

| Alternativa | A favor | En contra | Por qué no |
| --- | --- | --- | --- |
| Decir "ese correo ya está registrado" (lo habitual) | La mejor experiencia de alta posible, y la persona entiende al instante | Es una fuga de datos personales por sí sola (R-05), y en este producto es una inferencia patrimonial | Cerrado por la spec y por el dictamen |
| Uniformar sólo el texto, sin uniformar tiempos | Barato | La diferencia de tiempo es medible y automatizable; el oráculo sigue ahí | Es cumplir la letra e incumplir el propósito |
| Ruido aleatorio sin piso | Simple | Promediando N muestras, el ruido se cancela y la diferencia reaparece | El piso es lo que no se puede promediar |
| Retardo fijo al final igual para todos, sin hash señuelo | Uniforma el tiempo total | El consumo de CPU y la concurrencia siguen delatando; y ante saturación los tiempos se separan | El trabajo equivalente es la defensa; el piso es el refuerzo |
| Bloquear sólo cuentas existentes | Menos estado que guardar | El bloqueo pasa a ser el oráculo, más limpio que el original | Es el error clásico y anula todo lo demás |
| Detectar el CUIT/CUIL duplicado y bloquear el alta (spec v1) | Evita cuentas duplicadas de entrada | Oráculo de enumeración por CUIL: defecto D-002-02 | Corregido en la v3; acá se implementa la corrección |
| No pedir CUIT/CUIL en el alta | Elimina el problema de raíz y es mejor por minimización | Es una decisión de alcance funcional, no del arquitecto | **Escalamiento E-1**; es la recomendación del arquitecto y coincide con `ux.md` `[ESCALAMIENTO-A]` |
| `404` en lugar de `403` para recursos ajenos | Oculta la existencia del recurso | Con identificadores opacos (ULID) no hay enumeración posible, y CA-20 pide `403` | Se usa `403`, como manda el criterio |

## Consecuencias

**Positivas**

- No hay forma de preguntarle al sistema si una persona es usuaria, ni por
  correo, ni por CUIL, ni por tiempo, ni por bloqueo.
- El bloqueo por intentos fallidos nunca deja a nadie sin salida, y eso está
  garantizado por un tipo, no por una configuración.
- El camino de respuesta no depende del proveedor de correo: si el proveedor se
  cae, el alta sigue funcionando y el correo sale cuando vuelve.

**Negativas**

- **Todo alta y todo ingreso tarda al menos 400 ms**, aunque la respuesta sea
  trivial. Es un costo de experiencia asumido; `ux.md` lo absorbe con estados de
  espera bien diseñados.
- Una persona que ya tiene cuenta y se registra de nuevo **no recibe una
  explicación en pantalla**. Se compensa con el correo accionable y con el texto
  de AL-4, pero sigue siendo peor experiencia que decir la verdad.
- Se crean cuentas `NO_VERIFICADA` basura por cada intento duplicado; las purga
  CA-28.
- El hash señuelo consume CPU por peticiones que no corresponden a ninguna
  cuenta: interactúa con el vector de agotamiento de ADR-024 y por eso el límite
  por IP es parte de esta decisión, no un extra.

**Qué cierra**

- Cualquier respuesta, código, cabecera, tiempo o efecto observable que dependa
  de la existencia de la cuenta.

## Cómo se revierte

- **Revelar la existencia en el alta** (la experiencia habitual del mercado):
  media hora de código y una violación de R-05. Requiere cambiar la spec en G1 y
  dictamen nuevo.
- **Bajar el piso de latencia**: es un parámetro. Bajarlo sin volver a correr la
  prueba estadística reabre el canal lateral; la prueba está en el pipeline
  justamente para que eso no pase inadvertido.
- **Sacar el hash señuelo**: trivial y desaconsejado; la prueba estadística
  fallaría en el acto.
