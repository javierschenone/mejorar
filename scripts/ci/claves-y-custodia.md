# Claves de la feature 002: generación, custodia y rotación

| Campo | Valor |
| --- | --- |
| Autor | `cicd` (tarea T-13 de `specs/002-identidad-y-acceso/tasks.md`) |
| Obligación que cumple | F-11 de `specs/002-identidad-y-acceso/plan.md` §5, y §8.2 "Secretos y claves nuevas" |
| ADRs | ADR-020 (token Ed25519), ADR-024 (pimienta), ADR-028 (sello de bitácora) |
| Estado | Procedimiento escrito. **Ninguna clave real existe todavía**: se generan por entorno cuando ese entorno se cree, con aprobación humana puntual (G6) |

> **Este documento no contiene ninguna clave, y nunca va a contener ninguna.**
> Tampoco hay claves en `.env.example`, ni en un test, ni "temporalmente". Un
> secreto que entra al historial de git se rota, no se borra: el historial es
> público para cualquiera que clone el repositorio.

---

## 1. Las tres claves nuevas, y las tres que ya estaban

| # | Clave | Qué protege | Quién la usa | Si se pierde |
| --- | --- | --- | --- | --- |
| 1 | **Par Ed25519 de firma de tokens** (ADR-020) | La emisión de tokens de acceso. La privada firma; la pública se publica en un JWKS interno para verificar. | API | Nadie puede ingresar hasta generar un par nuevo. Recuperable: se genera otro y los tokens vivos (10 min) mueren solos. |
| 2 | **Pimienta de contraseñas** (ADR-024) | Los hashes de contraseña frente a un volcado de la base: `HMAC-SHA-256(contraseña, pimienta)` antes de `argon2id`. | API | **Nadie puede volver a ingresar, nunca.** Los hashes almacenados quedan inservibles y todas las contraseñas hay que restablecerlas. Riesgo R-05. |
| 3 | **Clave de sellado de bitácora** (ADR-028) | La firma de la raíz de Merkle que hace detectable la alteración de la bitácora de auditoría. **Distinta de la 1, y custodiada aparte.** | Trabajo de sellado | Los sellos viejos siguen verificándose con la pública; los nuevos usan un `kid` nuevo. Se documenta el corte. |
| 4 | `DATA_ENCRYPTION_KEY` (ya existía, la reutiliza F-08) | Secreto TOTP y códigos de respaldo cifrados en reposo. | API | Los segundos factores quedan ilegibles: hay que restituirlos uno por uno (ADR-027). |
| 5 | **Clave de índice ciego** (F-01) | El HMAC con el que se busca por correo y CUIT/CUIL sin guardarlos en claro. | API | No se puede buscar ni detectar duplicados; hay que recalcular el índice entero desde los valores cifrados. |
| 6 | **Clave de tráfico** (ADR-025 §4) | El HMAC del identificador presentado con el que se cuentan los intentos fallidos exista o no la cuenta. | API | Sólo se pierde el conteo en curso. Es la menos crítica. |

Las seis comparten tres reglas:

1. **Se generan fuera del proceso de la aplicación**, una vez por entorno. La
   aplicación jamás genera una clave "si no está".
2. **No tienen valor predeterminado.** El arranque falla, y falla temprano, si
   falta alguna (criterio heredado de la 001 §5.1, CA-06). Un arranque que
   "sigue sin la pimienta" es un arranque que guarda hashes que después nadie
   puede verificar.
3. **Son distintas en cada entorno.** Desarrollo, homologación y producción no
   comparten ni una. Una clave de desarrollo que sirve en producción convierte
   la laptop de cualquiera en una llave maestra.

### Nombres de las variables

Los nombres canónicos los fija el **esquema de configuración** de `apps/api`,
que es de `dev-backend` (tarea T-11, que además retira `JWT_ACCESS_SECRET` y
`JWT_REFRESH_SECRET` según el plan §8.4). Los que usa este documento y
`generar-claves-desarrollo.sh` son la propuesta de `cicd`; si `dev-backend`
elige otros, **manda el esquema de configuración** y este documento se
actualiza en el mismo PR.

```
TOKEN_FIRMA_CLAVE_PRIVADA_ACTUAL     PEM PKCS#8 de Ed25519, en base64 de una línea
TOKEN_FIRMA_KID_ACTUAL               identificador de la clave que firma hoy
TOKEN_FIRMA_CLAVE_PRIVADA_SIGUIENTE  la que va a firmar después de la rotación
TOKEN_FIRMA_KID_SIGUIENTE
CONTRASENA_PIMIENTA_ACTIVA           versión activa: `v1`, `v2`, ...
CONTRASENA_PIMIENTA_V1               32 bytes aleatorios en base64
AUDITORIA_SELLO_CLAVE_PRIVADA        Ed25519, distinta de la de tokens
AUDITORIA_SELLO_KID
DATA_ENCRYPTION_KEY                  32 bytes en hexadecimal (ya existía)
INDICE_CIEGO_CLAVE                   32 bytes aleatorios en base64
CLAVE_DE_TRAFICO                     32 bytes aleatorios en base64
```

La pimienta es **versionada y acumulativa**: `CONTRASENA_PIMIENTA_V1` no se
borra cuando aparece `v2`, porque los hashes viejos se siguen verificando con
la vieja hasta que se rehashean en el ingreso siguiente (ADR-024 §3).

---

## 2. Cómo se generan

Todas con herramientas que ya están en cualquier máquina; ninguna dependencia
nueva.

```bash
# 1 y 3 — par Ed25519 (clave de tokens y clave de sellado son dos corridas
#         distintas de lo mismo, y no se guardan en el mismo lugar).
openssl genpkey -algorithm ed25519 -outform PEM | base64 -w0

# `kid`: huella de la clave pública, no un número que alguien elija a mano.
openssl pkey -in clave.pem -pubout -outform DER | openssl dgst -sha256 -binary \
  | base64 | tr '+/' '-_' | tr -d '=' | cut -c1-16

# 2, 5, 6 — secretos simétricos de 32 bytes
openssl rand -base64 32

# 4 — DATA_ENCRYPTION_KEY, 32 bytes en hexadecimal
openssl rand -hex 32
```

Para **desarrollo local** hay un atajo que hace exactamente esto y nada más:

```bash
./scripts/ci/generar-claves-desarrollo.sh
```

Escribe por salida estándar, no toca ningún archivo del repositorio y se niega
a generar claves para homologación o producción. Las claves de esos entornos no
salen de la máquina de nadie: se generan en la sesión aprobada de G6 y se
cargan directo al gestor de secretos.

---

## 3. Dónde viven, por entorno

| Entorno | Dónde viven | Quién accede | Datos que protegen |
| --- | --- | --- | --- |
| **Desarrollo** (local) | Archivo `.env` de cada desarrollador, generado con el guion de arriba. Está en `.gitignore`. | Cada persona, la suya. | **Ninguno real.** Los datos de desarrollo se inventan o se anonimizan (mandato de `cicd`, regla 4). |
| **Integración continua** | No hay claves guardadas. Los jobs que necesitan una la **generan al vuelo** con `openssl` y la descartan al terminar el job. El pipeline no tiene ni un secreto configurado. | Nadie. | Ninguno: la suite corre con `INTEGRACIONES_MODO=mock`. |
| **Homologación** | Gestor de secretos del proveedor de infraestructura, espacio `homologacion`. Inyectadas al contenedor como variables de entorno en el arranque. | Equipo técnico, con acceso nominal y auditado. | **Ninguno real.** Datos sembrados o anonimizados. |
| **Producción** | Gestor de secretos del proveedor, espacio `produccion`, **separado del de homologación y con control de acceso propio**. | Dos custodios nominados como mínimo, acceso nominal, cada lectura auditada. Ningún acceso permanente desde CI. | Datos personales y patrimoniales de personas reales (Ley 25.326). |

**Decisión de infraestructura pendiente.** Qué proveedor y qué gestor de
secretos concreto se usa **todavía no está decidido y no lo decide `cicd`**: no
hay ADR de hospedaje. Sea cual sea, tiene que cumplir estos cinco requisitos, y
el que no los cumpla queda descartado sin discusión:

1. Fuera del repositorio y fuera de la imagen del contenedor.
2. Acceso nominal —nada de una credencial compartida por el equipo— y **registro
   de cada lectura**, con retención mínima de un año.
3. Versionado: la pimienta `v1` sigue disponible cuando entra `v2`.
4. Rotación sin reinicio manual de la aplicación.
5. Respaldo bajo custodia separada (ver §5).

Hasta que esa decisión exista, **no hay entorno de producción y no se despliega
nada**. Esto no bloquea el desarrollo: todo corre con mocks.

---

## 4. Rotación

| Clave | Cadencia | Procedimiento |
| --- | --- | --- |
| Par Ed25519 de tokens | **90 días** (ADR-020 §4), e inmediata ante sospecha | El JWKS publica siempre **dos** claves públicas: la vigente y la siguiente. Rotar es (a) promover `SIGUIENTE` a `ACTUAL`, (b) generar una nueva `SIGUIENTE`, (c) recargar la configuración. Los tokens firmados con la clave anterior siguen siendo válidos hasta 10 minutos; después, su `kid` desaparece del JWKS y producen `401`, que es el mismo `401` de todo lo demás (CA-12). **Sin ventana de caída.** |
| Pimienta | Sin cadencia fija; ante sospecha de filtración de los hashes | Se agrega `CONTRASENA_PIMIENTA_V2` y se cambia `CONTRASENA_PIMIENTA_ACTIVA=v2`. Los hashes viejos llevan su versión adentro y se siguen verificando con `v1`; cada ingreso exitoso rehashea con `v2` (ADR-024 §3). **`v1` no se borra hasta que el conteo de hashes con `v1` llegue a cero**, y ese conteo es una métrica de la observabilidad. |
| Clave de sellado | 90 días, misma cadencia que la de tokens | La pública de la clave vieja se conserva **para siempre**: sin ella no se pueden verificar los sellos históricos, que son la prueba de integridad de la bitácora. Se archiva junto con el rango de fechas que cubrió. |
| `DATA_ENCRYPTION_KEY`, índice ciego | Sólo ante sospecha | Ambas exigen recifrar o recalcular; es una migración con ventana, no una rotación en caliente. Se planifica como tal. |
| Clave de tráfico | Cuando se quiera | Rotar invalida el conteo de intentos en curso. Sin consecuencia. |

**Toda rotación de una clave en uso se detiene y pide aprobación humana
puntual** (mandato de `cicd`, escalamiento). No hay rotación automática
programada contra producción: hay un recordatorio a los 90 días y una persona
que aprueba.

---

## 5. Respaldo y pérdida

La pimienta es el caso serio: perderla deja a todos los titulares afuera de su
propia cuenta (R-05, crítico). Por eso:

- Respaldo **fuera del gestor de secretos**, bajo doble control: dos sobres
  sellados con la mitad de la clave cada uno, o el equivalente del proveedor
  con dos custodios nominados. Nunca los dos en el mismo lugar físico ni en la
  misma cuenta.
- El respaldo se verifica: una vez creado, se restaura en un entorno de prueba
  y se comprueba que un hash generado con la pimienta original se verifica con
  la restaurada. **Un respaldo que nunca se restauró no es un respaldo.**
- Misma regla para la clave de sellado y para `DATA_ENCRYPTION_KEY`.
- La clave privada de tokens **no necesita respaldo**: se regenera en minutos y
  el costo es que todo el mundo vuelva a ingresar.

---

## 6. Qué hace CI y qué no hace

- El pipeline de integración continua **no tiene ni un secreto configurado**, y
  eso es verificable: `scripts/ci/verificar-ausencia-de-secretos.sh` corre en
  cada PR y rompe la construcción si aparece material que parece una clave.
- Los jobs que necesitan una clave la generan al vuelo y la descartan
  (`benchmark-argon2id.mjs` genera su propia pimienta efímera, por ejemplo).
- El despliegue es **otro flujo**, con aprobación humana puntual por despliegue
  (G6), y es el único que ve secretos de un entorno real. Ese flujo todavía no
  existe: se escribe cuando exista la decisión de hospedaje.
- Ninguna clave de producción pasa nunca por un registro de ejecución, por una
  variable de salida de un paso, ni por el resumen de un job.

---

## 7. Pendientes declarados

| # | Pendiente | De quién |
| --- | --- | --- |
| 1 | Nombres definitivos de las variables en el esquema de configuración, y retiro de `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` de `.env.example` | `dev-backend` + `cicd`, tarea **T-11** (depende de T-06) |
| 2 | Decisión de hospedaje y de gestor de secretos, con su ADR | `arquitecto` + product owner |
| 3 | Nominación de los dos custodios de la pimienta y de la clave de sellado | product owner |
| 4 | Inscripción de la base ante la AAIP y designación de responsable de datos **antes de tratar la primera persona real** (condición C-002-11) | product owner. Bloquea producción, no desarrollo |
