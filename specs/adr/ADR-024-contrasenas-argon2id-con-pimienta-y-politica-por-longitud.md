# ADR-024 — Contraseñas con `argon2id` más pimienta, y política por longitud y lista local de filtradas

| Campo | Valor |
| --- | --- |
| Estado | PROPUESTO |
| Fecha | 2026-09-21 |
| Autor | arquitecto |
| Aprobado por | pendiente — G2, feature 002 |
| Spec de origen | `specs/002-identidad-y-acceso/spec.md` v3 (CA-03, CA-16, R-02) |
| Contrato | `specs/contratos/identidad-y-acceso.ts` §6 |

## Contexto

R-02 ya fija el algoritmo: `argon2id`, nunca texto plano ni hash reversible. El
encargo de G2 pide confirmarlo o justificar otra cosa. **Se confirma**, y este
ADR agrega lo que R-02 no dice y decide el resultado en la práctica: con qué
parámetros, con qué defensa adicional ante un volcado de la base, y qué
significa exactamente la política de CA-03 —"longitud, sin estar en una lista de
contraseñas filtradas conocidas"— cuando hay que implementarla sin llamar a un
servicio de terceros.

El detalle que suele arruinar esta decisión no es el algoritmo sino el costo: si
el hash tarda demasiado, el endpoint de ingreso se convierte en un amplificador
de denegación de servicio, porque cualquiera puede obligar al servidor a gastar
cientos de milisegundos de CPU y de memoria por petición **sin tener cuenta**
—y tiene que gastarlos igual, porque ADR-025 exige trabajo idéntico para cuentas
inexistentes—.

## Decisión

**`argon2id` con parámetros medidos, precedido de una pimienta HMAC con clave
fuera de la base, y política de contraseñas por longitud más lista local de
filtradas, sin reglas de composición.**

### 1. Parámetros

| Parámetro | Valor inicial |
| --- | --- |
| Memoria | **19 456 KiB** (19 MiB) |
| Iteraciones | **2** |
| Paralelismo | **1** |
| Sal | 16 bytes aleatorios por contraseña |
| Salida | 32 bytes |

Es la configuración recomendada por OWASP para `argon2id` cuando se prefiere
menor uso de memoria. Los parámetros **viajan dentro del hash en formato PHC**
(`$argon2id$v=19$m=19456,t=2,p=1$...`), de modo que subirlos más adelante no
rompe nada: `requiereRehash` detecta el hash viejo y se rehashea en el ingreso
siguiente, con la contraseña en claro que sólo existe en ese instante.

**Presupuesto medido, no adivinado.** Un *benchmark* en el pipeline mide el
tiempo de hasheo en el hardware de referencia y **falla la construcción** si
cae fuera de `[80 ms, 350 ms]`: por debajo, el costo para el atacante es
demasiado bajo; por encima, el ingreso se vuelve un vector de agotamiento. El
día que el hardware cambie, el número cambia con evidencia.

**Cota de concurrencia**: el hasheo corre con un semáforo de N operaciones
simultáneas (N = núcleos disponibles). Superado el cupo, la petición espera en
cola acotada y, si la cola se llena, se responde `429` con **las mismas
cabeceras** que cualquier otro `429` (ADR-025). 19 MiB × N acota la memoria
máxima dedicada a esto.

### 2. Pimienta

Antes de `argon2id` se aplica `HMAC-SHA-256(contraseñaNormalizada, pimienta)`,
con la pimienta **fuera de la base de datos** (gestor de secretos, inyectada al
proceso). El hash almacenado lleva el identificador de versión de pimienta.

Motivo: un volcado de la base —el incidente más probable, por copia de respaldo
mal protegida o inyección SQL— **no alcanza para atacar ninguna contraseña**,
porque falta una clave que nunca estuvo en la base. Es la diferencia entre un
incidente grave y un incidente catastrófico con notificación a todos los
titulares.

Costo asumido y declarado: **si se pierde la pimienta, nadie puede volver a
ingresar** y todo el mundo tiene que recuperar su contraseña. Su custodia y su
respaldo son obligación de `cicd` (F-11), al mismo nivel que la clave de firma.
La rotación es posible sin corte: se agrega la pimienta nueva, se rehashean las
cuentas en su ingreso siguiente, y la vieja se retira cuando no queden hashes
con esa versión.

### 3. Política de contraseñas (CA-03)

Siguiendo NIST SP 800-63B, **no hay reglas de composición** —ni mayúsculas, ni
números, ni símbolos obligatorios—: producen contraseñas peores y más fáciles de
adivinar. Hay cuatro reglas:

| Regla | Valor |
| --- | --- |
| Longitud mínima | **12 caracteres** |
| Longitud máxima | **128 caracteres** (cota contra abuso, no contra el usuario) |
| Lista de filtradas | rechaza si está en la lista local |
| Datos de la cuenta | rechaza si contiene el correo, el nombre o el dominio |

Normalización **Unicode NFKC** antes de hashear y de comparar, siempre, del
mismo modo en el alta y en el ingreso; si no, una contraseña con acentos
tipeada en otro teclado deja a la persona afuera. Se permiten espacios y
emoji. No se trunca.

`evaluarPoliticaDeContrasena` devuelve **un solo incumplimiento, el primero que
corresponda** (CA-03: el motivo exacto, no la política entera como un desafío a
resolver). Es pura: la pertenencia a la lista entra como dato.

### 4. Lista de filtradas: local, siempre

`PuertoListaDeContrasenasFiltradas` se implementa contra un archivo local con
las contraseñas más comunes conocidas (arranca con el orden del millón más
usado), guardadas como prefijos de hash ordenados y consultadas por búsqueda
binaria: ~8 MB en memoria, sin falsos positivos, sin red.

**Prohibido** consultar la API de terceros (aun con k-anonimato): enviar el
prefijo del hash de la contraseña de un titular a un tercero es una cesión de
datos que necesitaría base legal y encargado de tratamiento (arts. 12 y 25), y
pone una dependencia externa en el camino crítico del alta. El puerto lo dice
explícitamente en el contrato.

### 5. Cambio de contraseña

Cambiar la contraseña (CA-16, o desde el perfil) **cierra todas las sesiones**,
notifica por correo y queda en bitácora. Desde el perfil exige reautenticación
fuerte; desde el enlace de recuperación, el enlace es la prueba y se inutiliza.

### Verificación

Un test por CA-03 y CA-16. Además: *benchmark* con umbrales que rompen la
construcción; test de ida y vuelta de la normalización NFKC; test de que
`requiereRehash` dispara el rehash al cambiar parámetros; test de que el hash
almacenado no es verificable sin la pimienta; test de que la lista se consulta
localmente (el puerto mock no hace red y el adaptador real tampoco).

## Alternativas consideradas

| Alternativa | A favor | En contra | Por qué no |
| --- | --- | --- | --- |
| **bcrypt** | Ubicuo, bien probado, barato | Trunca en 72 bytes (silenciosamente, en varias implementaciones); sin dureza de memoria, o sea débil frente a GPU y ASIC | R-02 ya lo excluyó y con razón |
| **scrypt** | Duro en memoria, está en la librería estándar de Node | Parámetros más difíciles de elegir bien; menos resistente a compromisos entre tiempo y memoria que `argon2id` | `argon2id` es el estándar actual. Se anota que scrypt es la salida sin dependencias si `argon2` diera problemas de compilación nativa |
| **PBKDF2** | En la librería estándar, aprobado por FIPS | Sólo dureza de CPU; requiere conteos altísimos para equipararse | Sólo tendría sentido por una exigencia de certificación que no tenemos |
| Sin pimienta | Un secreto menos que custodiar y que poder perder | Un volcado de la base habilita el ataque por fuerza bruta contra cada cuenta | El riesgo de perder la pimienta se administra con respaldo; el de no tenerla, no se administra |
| Pimienta guardada en la base, en otra tabla | Simple de operar | La misma inyección SQL que saca los hashes saca la pimienta | No cumple ningún propósito |
| Consultar Pwned Passwords por HTTP con k-anonimato | Lista completa y siempre actualizada, sin guardar nada | Es una cesión a un tercero en el alta; agrega una dependencia de red en el camino crítico; y el sistema tiene que correr sin credenciales ni Internet | Descartada por privacidad y por disponibilidad |
| Reglas de composición clásicas | Lo que espera el usuario y lo que piden algunos auditores | Producen `Password1!`; NIST las desaconseja expresamente | La longitud y la lista hacen el trabajo de verdad |
| Longitud mínima de 8 | Menos fricción | Insuficiente para una cuenta que después va a contener el expediente patrimonial de la persona | 12 con frases permitidas es fricción baja y resistencia alta |
| Expiración periódica obligatoria | Práctica tradicional, la piden algunos pliegos | NIST la desaconseja: genera variaciones triviales y previsibles | No se implementa. El reemplazo se fuerza sólo ante incidente |

## Consecuencias

**Positivas**

- Un volcado de la base no compromete contraseñas.
- Los parámetros de costo son medidos y vigilados por el pipeline, no una
  constante copiada de un artículo de hace cinco años.
- La política es la que hoy recomienda el estado del arte y la que menos
  castiga al usuario.

**Negativas**

- **La pimienta es un secreto crítico nuevo**, con su custodia, su respaldo y su
  plan de rotación. Perderla es un incidente mayor.
- 19 MiB por hasheo simultáneo es memoria que el contenedor tiene que tener; el
  dimensionamiento del servicio lo contempla (F-11).
- El archivo de contraseñas filtradas agrega ~8 MB a la imagen y una tarea de
  actualización periódica (trimestral, sin urgencia).

**Qué cierra**

- Consultar cualquier servicio externo con material derivado de la contraseña.
- Truncar, transformar o limitar el juego de caracteres de la contraseña.

## Cómo se revierte

- **Quitar la pimienta**: medio día. Los hashes existentes quedan inservibles
  salvo que se los reescriba en el ingreso siguiente, así que la vuelta atrás
  real es "dejar de aplicarla a los nuevos y migrar los viejos", con convivencia
  de versiones. Está previsto por el identificador de versión en el hash.
- **Cambiar de `argon2id` a scrypt**: un día, con convivencia de formatos y
  migración en el ingreso. El formato PHC ya distingue los algoritmos.
- **Subir los parámetros de costo**: un cambio de constante; la migración es
  automática vía `requiereRehash`. Es el camino esperado, no una reversión.
