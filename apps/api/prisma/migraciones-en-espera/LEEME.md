# `prisma/migraciones-en-espera` — migraciones escritas que NO se ejecutan

Este directorio **no es** `prisma/migrations`. Prisma no lo mira, `prisma
migrate deploy` no lo aplica y los tests de esquema no lo recorren. Existe por
una razón concreta y acotada.

## Por qué existe

El mandato del `database-engineer` dice:

> Si la spec pide guardar un dato cuya base legal no está clara, **no lo
> modelás**: devolvés la pregunta al orquestador para que `compliance-legal` y
> el humano la resuelvan.

Hay un caso en la feature 002 donde el diseño está terminado y lo único que
falta es una decisión humana. Dejar la migración escrita y sin ejecutar es más
honesto que las dos alternativas: ejecutarla igual (se crea una tabla para un
dato sin finalidad declarada) o no escribirla (se pierde el trabajo y la
decisión se vuelve a discutir desde cero).

## Qué hay

| Directorio | Qué crea | Qué lo desbloquea |
| --- | --- | --- |
| `0022_identificador_fiscal` | `acceso.IdentificadorFiscal` (A.2 del modelo de datos) | **Escalamiento E-002-1.** La condición C-002-04(a) del dictamen exige *declarar la finalidad* del CUIT/CUIL o diferir el dato. La spec v3 cerró la parte (b) —la no-revelación— y dejó abierta la (a). El defecto D-002-01 sigue vivo. |

## Cómo se ejecuta, el día que se desbloquee

No se copia el directorio a `prisma/migrations` sin más. El orden es:

1. El product owner declara la finalidad del CUIT/CUIL y su carácter
   (obligatorio o facultativo), con dictamen de `compliance-legal`.
2. Se agrega la fila correspondiente a `acceso.CampoDeclaradoEnElAlta` con
   `campo = 'CUIT_CUIL'`, dentro de una **nueva versión** del texto del art. 6
   (B.2 es de sólo inserción: no se edita la versión vigente, se emite otra).
3. Recién entonces se mueve este directorio a `prisma/migrations` con una marca
   temporal nueva.

El paso 2 no es una formalidad. El disparador
`acceso.exigir_campos_declarados_del_alta` de la migración 0021 **detecta que la
tabla existe y a partir de ese momento exige la declaración de finalidad del
CUIT/CUIL en toda versión vigente del art. 6**. Es decir: si alguien ejecuta la
0022 salteándose el paso 2, la próxima versión del texto del art. 6 no va a
poder quedar vigente. El enganche es estructural, no un recordatorio.

## Qué NO se difiere

Nada más. `acceso.DocumentacionDeRestitucion` (E.4, escalamiento E-002-2) **no
tiene migración escrita ni acá ni en ningún lado**, y la diferencia es
deliberada: en el caso del CUIT/CUIL falta declarar la finalidad de un dato que
la spec ya pide recolectar; en el de la documentación de restitución falta
decidir **qué dato se recolecta**, que es un problema anterior al modelo.
Escribir esa tabla sería inventar qué documento pedirle a alguien para probar su
identidad.
