# ADR-028 — La auditoría es un efecto de autorizar, y la bitácora se sella periódicamente

| Campo | Valor |
| --- | --- |
| Estado | PROPUESTO |
| Fecha | 2026-09-21 |
| Autor | arquitecto |
| Aprobado por | pendiente — G2, feature 002 |
| Spec de origen | `specs/002-identidad-y-acceso/spec.md` v3 (CA-21, CA-22, CA-33, CA-34) |
| Dictamen | §4.1 advertencia 2, D-002-06, D-002-10, C-002-09 |
| Contrato | `specs/contratos/identidad-y-acceso.ts` §4 |
| Antecedente | `EventoAuditoria` de la feature 001 (`plan.md` 001 §5.3) |

## Contexto

La feature 001 creó `EventoAuditoria` como andamiaje, con siete campos, y dejó
escrito lo que quedaba para después: *"taxonomía completa de eventos, retención
y encadenamiento de hashes"*. Ese "después" es ahora.

La constitución #5 y el art. 9 de la Ley 25.326 piden una bitácora inmutable de
toda lectura de información sensible. ADR-007 §4 ya quitó `UPDATE` y `DELETE` al
rol de la aplicación. Falta responder tres preguntas que eso no cubre:

1. **Cómo se garantiza que nadie se olvide de auditar.** Una línea
   `auditar(...)` que hay que acordarse de escribir en cada caso de uso se
   olvida; es cuestión de tiempo. El dictamen encontró un ejemplo perfecto
   (D-002-06): la creación de una cuenta de administrador —la acción más
   sensible del sistema— era la única sin criterio de auditoría.
2. **Qué pasa con quien sí puede escribir en la base.** `REVOKE` protege contra
   la aplicación, no contra un administrador de base de datos ni contra quien
   restaura una copia adulterada.
3. **Cómo se responde "¿quién miró mi información?"**. El dictamen recomienda
   que la 002 **no cierre la puerta** guardando la bitácora en una forma que
   impida filtrarla por titular. Agregar ese campo después obliga a reprocesar
   la bitácora entera, que es justamente lo que no se puede hacer con una tabla
   inmutable.

## Decisión

**El evento de auditoría lo emite `autorizar`, no el caso de uso. La bitácora
registra el titular afectado además del sujeto que actúa, y se sella
periódicamente con una raíz de Merkle firmada.**

### 1. Auditar es un efecto de autorizar, no una línea que recordar

`autorizar` (ADR-022) consulta la `ExigenciaDelRecurso`, y **si la clasificación
del recurso es `PERSONAL` o `PATRIMONIAL_SENSIBLE`, emite el evento antes de
devolver la prueba**. Como no hay forma de leer sin prueba y no hay forma de
obtener la prueba sin pasar por ahí, **no hay forma de leer sin auditar**. Es la
misma idea que sostiene todo el RBAC: lo que importa no es acordarse, es no
poder olvidarse.

Los accesos denegados también se registran (`ACCESO_DENEGADO`, con el
`MotivoDenegacion`). Un patrón de denegaciones es la señal más útil que tiene
una bitácora.

### 2. Escritura sincrónica y fallo cerrado para lo sensible

Para `PERSONAL` y `PATRIMONIAL_SENSIBLE`, el evento se escribe **antes** de
entregar el dato, en la misma conexión. Si la escritura falla, la petición falla
con `503`: un acceso no auditado a datos patrimoniales es peor que un acceso
denegado. Para `INTERNO` y `PUBLICO` no se emite evento.

Presupuesto: la escritura agrega **≤ 5 ms al p95** de la petición. Si el volumen
lo desborda, la salida prevista es agrupar por ventana **sólo para `INTERNO`**,
nunca para `PATRIMONIAL_SENSIBLE`.

### 3. Dos campos distintos y no intercambiables

`sujeto` es **quién actuó**. `titularAfectado` es **sobre los datos de quién**.
Indexado, es lo que permite responder "quién miró mi información" y sostener el
permiso `auditoria.leer.propia`. Sin él, la pregunta no tiene respuesta
posible sobre el pasado.

### 4. Taxonomía cerrada y datos cerrados

`AccionAuditada` es una unión de 33 literales; agregar uno es una revisión
aditiva del contrato. `DatoDeEvento` admite sólo pares clave/valor escalares:
**está prohibido el texto libre** y está prohibido copiar dentro del evento el
contenido del dato accedido. Una bitácora que replica los datos que protege
duplica la superficie de exposición y se vuelve, ella misma, el peor lugar del
sistema.

Se cierra D-002-06: `ADMINISTRADOR_CREADO`, `ADMINISTRADOR_SEMBRADO` y
`ADMINISTRADOR_NOMINALIZADO` son acciones de primera clase, y el guion de
siembra escribe su evento con `canal: 'SIEMBRA'` (CA-34, recaudos C-2 y C-3).

### 5. Sello periódico con raíz de Merkle firmada

Cada hora se calcula la raíz de Merkle de los eventos de la ventana
(por `secuencia`, dentro de la partición del día) y se firma con una clave
**distinta de la de los tokens**, custodiada aparte. El sello guarda partición,
rango de secuencias, raíz, algoritmo, firma y `kid`. La raíz diaria se exporta
fuera del sistema (registro de sólo-anexado del proveedor de infraestructura o
copia inmutable; lo define `cicd`).

Con eso, alterar un evento pasado exige además falsificar un sello firmado con
una clave que no está en la base, y detectarlo es recalcular una raíz. La
verificación es un comando ejecutable a demanda, y corre semanalmente en el
pipeline sobre el entorno productivo.

Se prefiere el sello por ventana a la cadena de hashes fila por fila porque la
cadena serializa las inserciones —cada fila necesita el hash de la anterior— y
eso convierte a la bitácora en un cuello de botella de escritura justo en el
camino crítico de cada lectura.

### 6. Retención

Particionado por fecha (ADR-007). `retencion.bitacoraAuditoria` está
`A DETERMINAR POR EL ESTUDIO` en el dictamen §5.B, y hay una tensión real: la
bitácora es prueba en un habeas data y a la vez contiene datos personales.
**Mientras no haya valor ratificado, no se purga nada**, y la tabla de retención
lleva la fila con `A_DETERMINAR` para que el hueco sea visible (F-07). El
particionado hace que la purga sea barata cuando el valor exista, cualquiera
sea.

### Verificación

Un test por CA-21, CA-22 y CA-34. Además: test que recorre el registro de
recursos y verifica que **todo** tipo `PERSONAL`/`PATRIMONIAL_SENSIBLE` produce
evento al autorizar; test de que una falla de escritura de bitácora produce
`503` y no entrega el dato; test de que el `EventoAuditoria` no contiene el
contenido del recurso; test de verificación de sello sobre una bitácora
adulterada a mano (debe detectarlo); test de que el guion de siembra deja su
evento.

## Alternativas consideradas

| Alternativa | A favor | En contra | Por qué no |
| --- | --- | --- | --- |
| Llamada explícita `auditar(...)` en cada caso de uso | Simple, visible en el código | Se olvida. D-002-06 es la prueba de que se olvida incluso al escribir la spec | El punto entero de esta decisión |
| Interceptor de NestJS que audita por ruta | Central, poca ceremonia | No sabe qué recurso ni qué titular se tocó, sólo la ruta; y no cubre accesos que no vengan de HTTP (procesos internos, guion de siembra) | Audita el transporte, no el acceso al dato |
| Disparadores de PostgreSQL sobre `SELECT` | Imposible de saltear desde la aplicación | PostgreSQL no tiene disparadores de lectura; habría que usar el registro de sentencias, que no conoce al usuario de la aplicación ni el permiso evaluado | Técnicamente no disponible para lo que hace falta |
| Cadena de hashes fila por fila | Detecta inserción y borrado en cualquier punto | Serializa las escrituras y agrega latencia a cada lectura auditada | El sello por ventana da casi la misma garantía sin el cuello de botella. Se puede agregar la cadena *dentro* de la ventana si hace falta |
| Servicio externo de bitácora inmutable (WORM, QLDB) | Garantía fuerte, fuera de nuestro control | Encargado de tratamiento nuevo con los datos más sensibles, costo, y dependencia externa en el camino crítico | Se conserva la idea barata: exportar la raíz diaria, que no lleva datos personales |
| Escritura asincrónica en cola | No agrega latencia | Una caída de la cola produce accesos no auditados y nadie se entera hasta después | Para datos patrimoniales, fallar cerrado es la única opción defendible |
| Guardar el valor accedido en el evento | Reconstrucción perfecta de qué se vio | Duplica los datos sensibles en una tabla que se conserva más tiempo y que más gente puede leer | Se registra **qué recurso**, nunca su contenido |
| No guardar `titularAfectado` (como en la 001) | Una columna menos | Imposible responder "quién miró mis datos" sin reprocesar toda la bitácora | El dictamen advierte exactamente esto |

## Consecuencias

**Positivas**

- CA-21 deja de depender de la memoria de quien programa y pasa a ser una
  propiedad del mecanismo de autorización.
- La plataforma puede mostrarle a un titular quién accedió a su información: es
  la transparencia más valiosa que este producto puede ofrecer, y el dictamen la
  recomienda.
- Una alteración de la bitácora por alguien con acceso de escritura a la base es
  detectable.

**Negativas**

- **Volumen.** Cada lectura de un recurso personal escribe una fila. En el
  alcance de la 002 son decenas de miles de eventos diarios con cientos de
  usuarios; el particionado y los índices están dimensionados para eso, y la
  proyección se revisa en la 007, cuando aparezcan los expedientes.
- Latencia adicional en el camino crítico de cada lectura sensible.
- Dos claves de firma más que custodiar y un trabajo de sellado que vigilar; si
  el sellado deja de correr, hay que enterarse (alerta a cargo de `cicd`).
- Sin valor de retención ratificado, la bitácora crece sin techo. Es visible y
  está escalado, no escondido.

**Qué cierra**

- Leer un dato personal sin dejar rastro.
- Texto libre y contenido del recurso dentro del evento.
- Actualizar o borrar un evento desde la aplicación.

## Cómo se revierte

- **Pasar a escritura asincrónica**: medio día, y degrada la garantía. Sólo
  aceptable para clasificación `INTERNO`; la decisión de aplicarlo a algo más es
  humana.
- **Quitar el sello de Merkle**: trivial; se pierde la detección de alteración
  por parte de quien tiene escritura. Los eventos siguen siendo inmutables desde
  la aplicación.
- **Agregar cadena de hashes dentro de la ventana**: aditivo, un día, si alguna
  vez se exige reordenamiento detectable a nivel de fila.
