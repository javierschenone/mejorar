# Modelo de datos 002 — Identidad y acceso

| Campo | Valor |
| --- | --- |
| Autor | `database-engineer` |
| Spec de origen | `specs/002-identidad-y-acceso/spec.md` — **versión 3, 39 criterios** |
| Dictamen de cumplimiento | `specs/002-identidad-y-acceso/cumplimiento.md` (APTO CON CONDICIONES, 12 condiciones) |
| Contrato de tipos leído | `specs/contratos/identidad-y-acceso.ts` (del `arquitecto`, revisión 1; **no modificado por este documento**) |
| Plan técnico | `specs/002-identidad-y-acceso/plan.md` — **no existía al escribir este documento.** Ver §0.4 |
| Esquema vigente leído | `apps/api/prisma/schema.prisma` (hoy: sólo Bloque A de la feature 004) |
| Estado | **BORRADOR — se aprueba en G2** |
| Motor de base | PostgreSQL 16 + Prisma 6 (ADR-007). Varias invariantes usan capacidades que sólo existen en PostgreSQL: claves foráneas compuestas contra columnas de estado, columnas generadas, índices únicos parciales, disparadores de restricción diferidos, particionado nativo y RLS. Está anotado dónde. |

> **Este documento no se implementa todavía.** No hay una línea de
> `schema.prisma` ni de migración de esta feature hasta que el product owner
> apruebe G2.

---

## Nota de implementación — 2026-09-22, tarea T-03

G2 se aprobó y el modelo está implementado en `apps/api/prisma/**`: migraciones
`0011` a `0021` y `0023`, más la `0022` escrita y **no ejecutada** en
`prisma/migraciones-en-espera/`. Verificado contra PostgreSQL 16 real.

Al transcribir el documento a SQL aparecieron **tres divergencias**. Ninguna se
resolvió en silencio; las tres quedan acá y en el hand-back al orquestador para
que se decidan en la compuerta que corresponda.

| # | Dónde | Qué dice el documento | Qué se implementó y por qué |
| --- | --- | --- | --- |
| **N-1** | §7.2, tablas B.1 `VersionDocumentoAceptable` y B.2 `VersionInformacionArt6` | Están listadas entre las que no admiten `UPDATE` **nunca**. | **Se admite `UPDATE` de `vigenteHasta`, y de ninguna otra columna.** El documento tiene ahí una inconsistencia interna: las dos tablas llevan `vigenteHasta?`, que por definición se conoce *después* —cuando se publica la versión siguiente—, y con inmutabilidad total ninguna versión podría cerrarse jamás. El resultado sería un catálogo con N versiones simultáneamente vigentes y sin forma de saber cuál mostrar en el alta, que es justo lo que C-002-02 quiere evitar. El contenido —hash, referencia, responsable, destinatarios, `incluyeFinalidadesDeLa003`— sigue siendo inmutable, y el `DELETE` sigue prohibido. Se agregaron dos índices únicos parciales (`uq_documento_vigente`, `uq_art6_vigente`) para que "la versión vigente" tenga una sola respuesta. **Decisión menor, pero es una desviación del texto aprobado.** |
| **N-2** | §H.3 y §C.4, plazo de escalamiento de CA-31 | `matricula.plazoMaximoRevision` = **5 días hábiles**, con dependencia declarada de `motor.DiaNoHabil` (Bloque E de la 004). | **La spec v4 dice "7 días corridos (parámetro de producto, no normativo, ajustable sin volver a esta compuerta)".** Este documento se escribió contra la spec v3. Por la precedencia de `CLAUDE.md` §6 (la spec aprobada está por encima del material del agente) se sembró `matricula.plazoMaximoRevisionDiasCorridos = 7`, con la divergencia escrita en `notaDeAlcance` de la propia fila. **Lo que NO se cambió, porque es decisión de compuerta:** la columna `EscalamientoDeVerificacion.diasHabilesTranscurridos` y el `GRANT SELECT` condicional sobre `motor.DiaNoHabil`. Si se confirma el criterio de días corridos, las dos cosas son vestigios y conviene retirarlas. |
| **N-3** | §6.2, fila `0023` | La migración `0023` incluye "las cuentas de demostración (§6.5)". | **Las cuentas de demostración se movieron a `prisma/seed.ts`; la `0023` sólo siembra catálogos.** Una migración se aplica en *todos* los entornos, incluido producción: cuentas de demostración con contraseña conocida creadas por una migración son una puerta abierta esperando el despliegue distraído. §6.5 ya nombraba `prisma/seed.ts` como el lugar, así que esto alinea §6.2 con §6.5. |

Dos huecos que la implementación deja **declarados y verificados por test**, no
escondidos:

1. **El texto del art. 6 sembrado es un borrador de desarrollo.** El inciso b)
   exige identidad y domicilio del responsable, y hoy no están determinados
   (condición C-002-11, inscripción ante la AAIP pendiente). La fila dice
   `SIN DETERMINAR — BORRADOR DE DESARROLLO` en el propio dato. Inventar una
   razón social sería peor que dejar el hueco visible: ese texto es prueba de
   haber informado, y una prueba con un dato inventado adentro es peor que
   ninguna.
2. **D.8 `CorreoDeRolProhibido` queda vacía después de las migraciones**, así
   que el mecanismo R-002-04 nace inerte. Su clave primaria es un HMAC con
   `k_indice`, que por §4.3 vive **fuera de la base** y una migración no la
   tiene. La siembra `prisma/seed.ts`, que sí puede leerla del entorno. Hay un
   test que afirma el cero y otro que afirma que después del seed deja de serlo.

---

## 0. Alcance, frontera y criterio de diseño

### 0.1 Qué persiste esta feature

Todo. La 004 podía decir "el motor es una librería pura sin persistencia"; la
002 **es** la persistencia. Es la feature que crea la primera base de datos
personales del producto (dictamen §0 punto 1), y por lo tanto la que hace
exigibles las obligaciones de la Ley 25.326 que hasta hoy figuraban como
genéricas.

Lo que **no** modela este documento, con su destino declarado:

| Fuera de alcance | Dónde va |
| --- | --- |
| Baja de cuenta y supresión a pedido del titular | Feature **003** (decisión 002-D). Acá se deja la columna `eliminadoEn` y el mecanismo de lápida de §5.4, que es lo que impide que la 003 se encuentre con una bitácora huérfana. |
| Consentimientos versionados por finalidad (bureaus, cesión, marketing) | Feature **003**. Acá sólo la aceptación de términos con alcance limitado (CA-27), y el modelo lo hace **imposible de ampliar sin compuerta** (R-002-07). |
| Caso, deuda, acreedor, expediente, asignación de casos | Features 008 / 012 / 013. Acá sólo el permiso `caso.recibirAsignacion` y la jurisdicción de la matrícula, para que el control M-7 sea posible después (D-002-07). |
| Vínculo seudónimo ↔ persona (`identidad.VinculoSeudonimo`) | Feature **007**. El esquema `identidad` ya existe, vacío, desde la migración `0001`. Esta feature **no lo toca**. Ver §0.5. |
| Almacenamiento del documento de identidad del circuito de restitución de MFA | **No se modela.** Escalamiento E-002-2. |

### 0.2 Seis decisiones de diseño que gobiernan todo el resto

| # | Decisión | Motivo |
| --- | --- | --- |
| **D-1** | **Esquema propio `acceso`, más `auditoria`.** No se mete una sola tabla de esta feature en `motor`, y no se toca `identidad`. Rol de aplicación propio (`rol_acceso`) y clave de cifrado propia (`k_acceso`). | La migración `0001` ya declaró el borde: `motor` no tiene datos identificatorios (CA-60 de la 004, condición C-10). La 002 es exactamente lo contrario: es donde vive el correo y el nombre. Mezclarlas destruiría la garantía que la 004 compró con esa separación. |
| **D-2** | **El estado derivable no se almacena.** El estado de la verificación profesional, el bloqueo por intentos fallidos y el vencimiento de la matrícula **se derivan en cada lectura** a partir de hechos fechados. No hay columna `estadoVerificacion`, no hay tarea programada que la actualice. | Es el defecto exacto que el dictamen §4.4 señala: *"un estado `VERIFICADO` sin fecha y sin vencimiento es verdadero el día que se otorga y puede ser falso al mes siguiente"*. Una columna exige un proceso que la mantenga, y un proceso que no corre deja al sistema afirmando algo falso. Coincide con `derivarEstadoMatricula` del contrato (§5) y con CA-30 (efecto inmediato). |
| **D-3** | **Hechos, no estados, en toda la feature.** `DecisionDeVerificacion`, `SuspensionDeMatricula`, `AceptacionRegistrada`, `IntentoDeAutenticacion`, `EventoAuditoria`, `AjustePermiso` son tablas de sólo inserción. Las columnas mutables son **siete** y están inventariadas en §7.2. | Regla 4 del mandato y constitución #11. En un habeas data hay que poder reconstruir qué sabía el sistema el 3 de marzo, incluido "quién estaba verificado ese día". |
| **D-4** | **Todo dato directamente identificatorio de la cuenta va cifrado en reposo** (`correo`, `nombreParaMostrar`, `cuitCuil`, `ip` de la aceptación) y **la búsqueda por igualdad se hace con índice ciego** (HMAC-SHA-256 con clave fuera de la base). Nunca en claro, nunca indexado en claro. | Constitución #5 y dictamen §2.2(c): en **este** producto, saber que una persona determinada tiene cuenta es una **inferencia sobre su situación patrimonial**. Un volcado de la base sin la clave no puede producir la lista de deudores. El contrato ya previó la pieza (`ServicioDeIndiceCiego`, `IndiceCiego`). **Tiene costo y se ratifica en G2: ver escalamiento E-002-6.** |
| **D-5** | **Las invariantes críticas son estructurales, no validaciones.** Cuando un criterio dice "no puede", se busca que el estado prohibido **no sea representable**: claves foráneas compuestas contra columnas de estado, `CHECK`, índices únicos parciales y disparadores de restricción diferidos. Inventario completo en §7.1. | CA-32 dice "no puede desactivarse **por configuración**"; CA-33 dice que no existen cuentas administradoras genéricas. Una validación de aplicación se apaga con una variable de entorno; una clave foránea no. Mismo criterio que la D-2 de la 004, ya aprobada en G2. |
| **D-6** | **Nada se borra físicamente salvo purga con constancia, y la cuenta purgada deja lápida.** La purga de CA-28 y cualquier supresión futura anulan las columnas personales y conservan la fila con su identificador opaco. La bitácora tiene clave foránea `ON DELETE RESTRICT` contra esa fila. | Regla 3 del mandato. Y resuelve el punto 10 del encargo: **es imposible borrar una cuenta y dejar huérfana la bitácora**, porque el motor de base lo rechaza. §5.4. |

### 0.3 Reconciliación con el `Usuario` mínimo de la feature 001

**Respuesta corta: el `Usuario` de la 001 nunca llegó a existir como código. Sólo
está en el plan. No hay nada que migrar y no hay una segunda entidad en paralelo.**

Verificación hecha sobre el repositorio, archivo por archivo:

| Dónde | Qué hay |
| --- | --- |
| `specs/001-fundaciones/plan.md` §5.3 | La tabla de "contenido mínimo" con `Usuario` (identificador opaco, correo, hash argon2id, rol, nombre para mostrar, marcas de tiempo) y `EventoAuditoria`. Es una **declaración de plan**, aprobada en G2 de la 001. |
| `apps/api/prisma/schema.prisma` | **No contiene `Usuario` ni `EventoAuditoria`.** Sus 542 líneas son exclusivamente el Bloque A de la feature 004 (catálogo normativo, A.1 a A.6), y su encabezado lo dice expresamente. `datasource.schemas = ["motor"]`. |
| `apps/api/prisma/migrations/` | Dos migraciones: `20260921120000_extensiones_y_esquemas` y `20260921120100_catalogo_normativo`. Ninguna crea una tabla de usuarios. |
| `apps/api/src/` | **No existe.** No hay código de aplicación en la API. |
| `packages/shared/src/` | `index.ts` y `motor-legal/`. **No hay tipo `EventoAuditoria` implementado**: el nombre aparece en `specs/`, `docs/02-arquitectura.md` y en el contrato del `arquitecto` de esta feature, no en código. |

Consecuencias, todas favorables:

1. **No hay reconciliación de datos, sólo de decisiones.** Cero filas, cero
   migración de compatibilidad, bloqueo nulo (§6.3).
2. **Las seis decisiones del plan de la 001 se respetan íntegras y se extienden.**
   La tabla de abajo es el contrato de continuidad; cada fila dice qué dijo la
   001, qué hace la 002 y por qué.

| Atributo del `Usuario` de la 001 | Qué hace la 002 | Justificación |
| --- | --- | --- |
| Identificador opaco | **Se conserva tal cual.** `Usuario.id TEXT PK`, ULID/UUIDv7 sin estructura derivable, producido por la aplicación. Es el `IdUsuario` del contrato. | R-03 de la spec, D-002-11, condición C-10 de la 004. |
| Correo | **Se conserva como concepto y cambia el tratamiento**: pasa de columna en claro a `correoCifrado` + `indiceCiegoCorreo`. | D-4 de §0.2. Es el único cambio de forma respecto de la 001, y es un endurecimiento, no un rediseño. |
| Hash de contraseña argon2id | **Se conserva.** Se agrega pimienta (HMAC con clave fuera de la base) según el contrato §6. | R-02 de la spec. |
| Rol (`CLIENTE`/`ABOGADO`/`ADMINISTRADOR`) | **Se conserva como columna**, y se le agrega una columna generada `esAdministrador` que es el destino de la clave foránea compuesta de F.1. | CA-18 mantiene el rol como "conjunto de permisos por defecto"; la columna sigue existiendo porque el mapa rol→permisos la necesita. |
| Nombre para mostrar | **Se conserva**, cifrado (D-4). | Ídem correo. |
| Marcas de tiempo | **Se conservan** y se agregan `confirmadoEn`, `purgadaEn`, `eliminadoEn`. | CA-01, CA-28, frontera con la 003. |
| `EventoAuditoria` (id, momento, usuario, acción, recurso, resultado, origen) con la invariante "sin `UPDATE` ni `DELETE` desde el rol de la aplicación" | **Se conserva la invariante y se extiende el esquema**, exactamente como el contrato del `arquitecto` anticipa: taxonomía cerrada de acciones, `titularAfectado`, `clasificacion`, `secuencia`, particionado y sello de Merkle. | La 001 dejó escrito que "taxonomía completa de eventos de auditoría, retención y encadenamiento de hashes" quedaba para acá. G.1 y G.2. |

**Lo que la 002 retira de la 001, y hay que decirlo en la compuerta:** el
andamiaje de ingreso `PERMITIR_LOGIN_DEMO` (plan 001 §5.1, riesgo R-07) muere
con esta feature. El modelo de datos no lo contempla en ningún lado y el seed de
§6.5 produce cuentas con contraseña real y MFA donde corresponde. Eliminar el
módulo es tarea de `dev-backend`, no mía, pero el esquema ya no lo sostiene.

**Las tres afirmaciones de CA-10 de la 001 siguen siendo verificables** contra
este modelo: el portal muestra el nombre y el rol propios (A.1), el rechazo
entre roles lo decide la API (§7.4 y el contrato §3), y "mi actividad reciente"
lista sólo los eventos propios (Q-13, índice `(sujeto, momento DESC)`).

### 0.4 Relación con el `plan.md` del `arquitecto`

Al momento de escribir, `specs/002-identidad-y-acceso/plan.md` **no existe**:
sólo está `specs/contratos/identidad-y-acceso.ts`, revisión 1. Este documento se
escribió contra la spec y contra ese contrato, que se leyó completo. Los ADR-020
a ADR-029 que el contrato cita tampoco existen todavía en `specs/adr/`.

**Todo lo que este modelo toma del contrato está marcado con su §.** Donde el
modelo se aparta del contrato o lo interpreta, hay una fila en §8
(escalamientos E-002-5 y E-002-7). Si el `plan.md` resuelve algo distinto en
esos dos puntos, el modelo lógico no cambia: cambia una columna.

### 0.5 Mapa de esquemas de la base

```
  motor        ← feature 004. Catálogo normativo, evaluaciones, hallazgos.
                 SIN datos identificatorios. Rol rol_motor. EXISTE.
  identidad    ← feature 007. Vínculo seudónimo ↔ persona. Rol rol_identidad.
                 Prisma NO lo administra. Vacío. LA 002 NO LO TOCA.
  acceso       ← feature 002. NUEVO. Cuentas, credenciales, sesiones, MFA,
                 aceptaciones, verificación profesional. Rol rol_acceso.
  auditoria    ← feature 002. NUEVO. Bitácora inmutable particionada.
                 Rol rol_auditoria (ya creado en la migración 0001).
```

Por qué `acceso` y no `identidad`: la migración `0001` dejó escrito que
`identidad` es *"el único lugar donde vive el vínculo entre un seudónimo y una
persona real, con otro rol y otra clave"* y que **Prisma no lo administra**.
Poner ahí la tabla de cuentas rompería las dos cosas. Son problemas distintos:
`identidad` responde "quién es el sujeto 01J…" para el motor; `acceso` responde
"quién se está autenticando". El puente entre ambos —`IdUsuario` ↔ `IdPersona`—
es la obligación de frontera F-12 del contrato y lo construye la 007
referenciando `acceso.Usuario.id` **por valor, sin clave foránea entre
esquemas**, igual que hace hoy con `motor.SujetoSeudonimo`.

### 0.6 Convención de clasificación

Idéntica a la de `specs/004-motor-reglas-legales/modelo-datos.md` §1, y a los
cuatro valores de `ClasificacionDato` del contrato (§4):

| Código | Contrato | Significado |
| --- | --- | --- |
| `PUB` | `PUBLICO` | Publicable sin restricción (texto de términos, catálogo de permisos). |
| `INT` | `INTERNO` | Operación de la plataforma; no es dato personal. |
| `PERS` | `PERSONAL` | Identifica o permite identificar a una persona. |
| `PATR` | `PATRIMONIAL_SENSIBLE` | Revela situación económica, ingreso, deuda o solvencia. |

**En esta feature no hay ningún campo `PATR`**, y conviene decirlo porque es
contraintuitivo: la 002 no guarda ni un peso, ni una deuda, ni un informe
crediticio. Lo que sí tiene es una franja de campos `PERS` cuya sensibilidad
**por contexto** es más alta de lo que la etiqueta sugiere —el dictamen §2.2(c)
lo dice: saber que Fulano tiene cuenta acá es una inferencia patrimonial sobre
Fulano—. Esos campos llevan **tratamiento de `PATR`** (cifrado en reposo, nunca
indexados en claro) y están marcados `PERS↑` en las tablas. La etiqueta no se
infla: se infla el tratamiento, que es lo que protege.

Convención de notación: `?` = anulable; sin marca = obligatorio. Tipos en
notación PostgreSQL. Toda tabla lleva `creadoEn TIMESTAMPTZ NOT NULL DEFAULT
now()` (`INT`) salvo indicación contraria; no se repite en cada listado.

---

## 1. Entidades

### Bloque A — Cuenta, perfil y permisos

#### A.1 `acceso.Usuario`

**Propósito.** La cuenta. Una fila por persona que puede autenticarse. Es la
extensión del `Usuario` mínimo de la 001 (§0.3).

| Campo | Tipo | Cl. | Notas |
| --- | --- | --- | --- |
| `id` | `TEXT` PK | `PERS` | Identificador opaco (ULID/UUIDv7), sin estructura derivable, producido por la aplicación. `PERS` por precaución: no dice nada por sí solo, pero es la clave de reidentificación. |
| `indiceCiegoCorreo` | `BYTEA` | `INT` | HMAC-SHA-256 del correo normalizado (NFKC + minúsculas) con clave fuera de la base. Es lo único indexable. No reversible. |
| `correoCifrado` | `BYTEA` | `PERS↑` | AES-256-GCM, clave `k_acceso`, AAD = `id`. |
| `correoNonce`, `correoTag`, `correoIdClave` | `BYTEA`,`BYTEA`,`TEXT` | `INT` | Rotación de clave sin tocar el dato (§4.3). |
| `nombreParaMostrarCifrado` (+ nonce/tag/idClave) | `BYTEA` | `PERS↑` | Ídem. No hay índice: en la 002 no hay ninguna consulta que busque por nombre (ver §3, índices descartados). |
| `hashContrasena` | `TEXT` | `PERS` | Formato PHC de `argon2id`, con los parámetros embebidos, sobre la contraseña ya pimentada con HMAC (contrato §6). **Nunca descifrable, nunca exportable** (`SinSecretos`, CA-25 advertencia 1). |
| `rol` | `enum Rol` | `INT` | `CLIENTE` \| `ABOGADO` \| `ADMINISTRADOR`. |
| `esAdministrador` | `BOOLEAN GENERATED ALWAYS AS (rol = 'ADMINISTRADOR') STORED` | `INT` | Destino de la clave foránea compuesta de F.1 (R-002-03). |
| `estadoCuenta` | `enum EstadoCuenta` | `INT` | Ver el enum y el porqué del valor ausente más abajo. |
| `estadoMfa` | `enum EstadoMfa` | `INT` | `NO_CONFIGURADO` \| `INSCRIPCION_PENDIENTE_DE_CONFIRMACION` \| `ACTIVO` \| `BLOQUEADO_POR_RESTITUCION`. Proyección de E.1 para poder expresar R-002-01 como `CHECK`. |
| `confirmadoEn` | `TIMESTAMPTZ?` | `INT` | Momento de la confirmación del correo (CA-01, CA-28). |
| `creadoEn`, `actualizadoEn` | `TIMESTAMPTZ` | `INT` | |
| `purgadaEn` | `TIMESTAMPTZ?` | `INT` | Lápida de CA-28 y de la 003. §5.4. |
| `motivoPurga` | `enum MotivoPurga?` | `INT` | `NUNCA_CONFIRMADA` \| `PEDIDO_DEL_TITULAR` \| `BAJA_DE_CUENTA`. |
| `eliminadoEn` | `TIMESTAMPTZ?` | `INT` | Baja lógica. **Ningún camino de la 002 la escribe**; existe para que la 003 no tenga que alterar la tabla. |

```
enum EstadoCuenta  -- almacenado
  NO_VERIFICADA | ACTIVA | PENDIENTE_DE_INSCRIPCION_MFA
  | RESTITUCION_MFA_EN_CURSO | SUSPENDIDA | PURGADA
```

**`BLOQUEADA_TEMPORALMENTE` del contrato NO es un valor almacenable.** Está en
el enum del contrato (§5) porque es un estado que el dominio ve, pero guardarlo
en `Usuario` sería un oráculo de enumeración: el bloqueo por intentos fallidos
se aplica también a **cuentas que no existen** (contrato §9, `ClaveDeTrafico`),
y una cuenta inexistente no tiene fila donde guardarlo. El bloqueo vive en D.6,
indexado por `claveDeTrafico`, y `BLOQUEADA_TEMPORALMENTE` se **deriva** al
armar el `PerfilDeAutorizacion`. Un `CHECK` prohíbe almacenarlo.
**Punto de coordinación con el `arquitecto`: escalamiento E-002-7.**

**Invariantes**

1. `UNIQUE (indiceCiegoCorreo) WHERE purgadaEn IS NULL` — un correo, una cuenta
   viva. Parcial para que la lápida no bloquee un alta futura con el mismo
   correo (que es un derecho del titular tras una baja).
2. `CHECK (rol = 'CLIENTE' OR estadoCuenta <> 'ACTIVA' OR estadoMfa = 'ACTIVO')`
   — **R-002-01**. Una cuenta `ADMINISTRADOR` o `ABOGADO` operativa sin segundo
   factor no es representable (CA-32, CA-38).
3. `CHECK ((estadoCuenta = 'PURGADA') = (purgadaEn IS NOT NULL))` y
   `CHECK (purgadaEn IS NULL OR (correoCifrado IS NULL AND
   nombreParaMostrarCifrado IS NULL AND hashContrasena IS NULL AND
   indiceCiegoCorreo IS NULL))` — **R-002-10**. Una lápida con datos adentro no
   es representable, y una cuenta viva sin correo tampoco.
4. `CHECK (estadoCuenta <> 'BLOQUEADA_TEMPORALMENTE')` — el enum de la base no
   incluye el valor; el `CHECK` es redundante y está a propósito, para que quede
   escrito el porqué en el esquema.
5. `CHECK (confirmadoEn IS NULL OR estadoCuenta <> 'NO_VERIFICADA')`.
6. Disparador diferido: no se puede alcanzar `estadoCuenta = 'ACTIVA'` sin una
   `AceptacionRegistrada` vigente de **cada una** de las dos clases de documento
   (**R-002-06**, CA-27) ni sin `ConstanciaInformacionArt6` (CA-26).
7. Disparador diferido: `rol = 'ADMINISTRADOR'` exige fila en F.1 y evento
   `ADMINISTRADOR_CREADO`/`ADMINISTRADOR_SEMBRADO` en la misma transacción
   (**R-002-03**, CA-33, CA-34).

#### A.2 `acceso.IdentificadorFiscal` — **CONDICIONADO, ver escalamiento E-002-1**

**Propósito.** El CUIT/CUIL declarado. Tabla **separada de `Usuario` a
propósito**: si el product owner decide diferir el dato a la feature que lo
necesita (007), diferirlo es `DROP TABLE`, no cirugía sobre la tabla de cuentas.

| Campo | Tipo | Cl. | Notas |
| --- | --- | --- | --- |
| `id` | `TEXT` PK | `INT` | |
| `usuarioId` | `TEXT` FK → A.1 | `PERS` | |
| `indiceCiegoCuit` | `BYTEA` | `INT` | HMAC con dominio `'CUIT_CUIL'` (contrato §15). **Índice NO único**: ver invariante 2. |
| `valorCifrado` (+ nonce/tag/idClave) | `BYTEA` | `PERS↑` | AES-256-GCM, `k_acceso`, AAD = `usuarioId`. |
| `digitoVerificadorValidado` | `BOOLEAN` | `INT` | CA-04. `CHECK (digitoVerificadorValidado)`: no se persiste un CUIT/CUIL que no pasó `verificarDigitoVerificadorCuit`. |
| `declaradoEn` | `TIMESTAMPTZ` | `INT` | |
| `reemplazaA` | `TEXT? FK → A.2` | `INT` | Linaje de rectificación. Un CUIL mal cargado no se edita: se reemplaza. Deja la puerta abierta a D-002-04 sin implementarlo. |
| `vigente` | `BOOLEAN` | `INT` | `UNIQUE (usuarioId) WHERE vigente`. |

**Invariantes**

1. Tabla de sólo inserción salvo `vigente` (§7.2).
2. **No hay restricción de unicidad sobre `indiceCiegoCuit`, y es deliberado.**
   Un `UNIQUE` haría fallar el segundo alta, y ese fallo **es** el oráculo de
   enumeración por CUIL que el dictamen §2.2(c) identifica como defecto
   D-002-02. CA-04 exige lo contrario: la segunda alta se crea
   `NO_VERIFICADA` como cualquier otra y el duplicado se resuelve por el canal
   del titular real (A.6). Un índice no único sirve la detección asincrónica.
   **Esto es un índice que existe para una consulta y una restricción que se
   omite por exigencia normativa; ambas cosas documentadas para que nadie
   "arregle" el faltante en un G4 futuro.**

> **BLOQUEO G2 — E-002-1.** La condición C-002-04(a) del dictamen exige
> *decidir y declarar la finalidad* del CUIT/CUIL o diferirlo. La spec v3 cerró
> la parte (b) —la no-revelación— y **no cerró la (a)**: el defecto D-002-01
> sigue abierto. Conforme al punto de escalamiento de mi mandato, **la tabla
> queda diseñada y la migración que la crea no se ejecuta, y ningún camino de
> alta la escribe, hasta que la finalidad esté declarada en el texto del art. 6
> (CA-26) con su carácter obligatorio o facultativo**. Ver §8.

#### A.3 `acceso.PerfilProfesional`

**Propósito.** Lo propio del rol `ABOGADO`. 1:1 opcional con `Usuario`.

| Campo | Tipo | Cl. | Notas |
| --- | --- | --- | --- |
| `usuarioId` | `TEXT` PK, FK → A.1 | `PERS` | |
| `rolDelTitular` | `enum Rol` | `INT` | Réplica sostenida por clave foránea compuesta `(usuarioId, rolDelTitular) → Usuario(id, rol)` con `ON UPDATE RESTRICT`, más `CHECK (rolDelTitular = 'ABOGADO')`. Un perfil profesional colgando de un cliente no es representable. |
| `matricula` | `TEXT` | `PERS` | **En claro y con índice, a propósito.** Es dato de publicidad registral del colegio y su finalidad es la identificabilidad; cifrarlo impediría verificarlo. Mismo criterio y misma justificación que `motor.MatriculaProfesional` de la 004 §4.1, ya aprobada. |
| `jurisdiccion` | `enum Jurisdiccion` | `PERS` | Las 24 del contrato + `FEDERAL`. Es el dato que la 008/012/013 necesita para M-7 (D-002-07). |
| `colegioDeclarado` | `TEXT?` | `PERS` | Lo que declaró el abogado. El colegio **verificado** vive en la evidencia de C.1, que es otra cosa. |
| `solicitadaEn` | `TIMESTAMPTZ` | `INT` | `HistoriaDeVerificacion.solicitadaEn` del contrato. Arranca el reloj de CA-31. |
| `ultimaDecisionId` | `TEXT? FK → C.1` | `INT` | **Proyección para poder indexar**, no estado. Ver invariante 3. |
| `tieneVerificacionAprobada` | `BOOLEAN` | `INT` | Ídem. Mantenida por disparador desde C.1. |

**Invariantes**

1. `UNIQUE (jurisdiccion, matricula) WHERE tieneVerificacionAprobada` — índice
   único **parcial**. Dos cuentas pueden *declarar* la misma matrícula (el §7 de
   la spec lo exige: el alta no falla en el acto), pero **sólo una puede estar
   verificada**. Es la traducción exacta del caso límite.
2. `matricula` y `jurisdiccion` son inmutables una vez que existe una decisión
   `APROBADA` (disparador). CA-24: el abogado no autoedita la matrícula
   verificada.
3. **`ultimaDecisionId` y `tieneVerificacionAprobada` son punteros al último
   hecho, no el estado derivado.** Lo prohibido por D-2 es guardar
   `VIGENTE`/`VENCIDA`/`SUSPENDIDA`: eso se calcula contra el instante de
   evaluación en cada lectura. Guardar cuál es la última decisión no puede
   quedar desactualizado respecto del tiempo, porque no depende del tiempo.
   Mismo precedente que `Hallazgo.estadoRevision` en la 004 §7.2.

#### A.4 `acceso.EspecialidadDeclarada`

`usuarioId` FK → A.3, `especialidad` (enum cerrado, catálogo de `ux-expert`),
`declaradaEn`, `retiradaEn?`. PK `(usuarioId, especialidad)`. Todo `PERS`.
CA-24. Enum cerrado y no texto libre: un campo libre en el perfil público de un
abogado es una promesa de resultado esperando a ocurrir (constitución #6).

#### A.5 `acceso.AjustePermiso`

Contrato §2, `AjusteDePermiso`. `id`, `usuarioId` FK → A.1, `permiso` (enum
cerrado = `Permiso` del contrato), `efecto` (`CONCEDE`/`RETIRA`), `otorgadoPor`
FK → A.1, `momento`, `vigenciaHasta?`, `motivo` (enum cerrado), `revocadoEn?`,
`claveIdempotencia UNIQUE`. Sólo inserción salvo `revocadoEn`. Todo `INT` salvo
`usuarioId` y `otorgadoPor` (`PERS`).

**Invariante.** `CHECK (NOT (permiso = 'mfa.desactivar.propio' AND efecto =
'CONCEDE'))` combinado con el disparador que consulta el rol: **no se le puede
conceder a un administrador el permiso de apagar su segundo factor por la
puerta de atrás de un ajuste individual** (CA-32). Es la grieta obvia del
mecanismo de ajustes y se cierra en la base.

#### A.6 `acceso.ResolucionDeDuplicado`

Contrato §9. `id`, `clase` (`CORREO`/`CUIT_CUIL`), `titularReal` FK → A.1,
`altaSecundaria` FK → A.1 (anulable: en el caso `CORREO` no se crea segunda
cuenta), `notificadoAlTitularEn`, `resultado`
(`PENDIENTE`/`DESCARTADA`/`CONFIRMADA_POR_EL_TITULAR`), `resueltaEn?`,
`claveIdempotencia UNIQUE`. `PERS` los dos identificadores, `INT` el resto.
Es lo que hace que CA-02 y CA-04 no terminen en un callejón sin salida
(C-002-06) y que el aviso no se duplique (constitución #12).

---

### Bloque B — Información del art. 6 y aceptación versionada

Implementa C-002-01 y C-002-02, las dos condiciones que el dictamen §9 marca
como *"lo único verdaderamente urgente, en el sentido de que no se puede
reparar después"*.

#### B.1 `acceso.VersionDocumentoAceptable`

| Campo | Tipo | Cl. | Notas |
| --- | --- | --- | --- |
| `clase` | `enum` | `PUB` | `TERMINOS_Y_CONDICIONES` \| `POLITICA_DE_PRIVACIDAD`. |
| `version` | `TEXT` | `PUB` | PK compuesta `(clase, version)`. |
| `hashDelTexto` | `TEXT` | `PUB` | SHA-256 del texto exacto mostrado. |
| `referenciaDelTexto` | `TEXT` | `PUB` | Ubicación del documento íntegro. |
| `vigenteDesde` / `vigenteHasta?` | `TIMESTAMPTZ` | `PUB` | |
| `incluyeFinalidadesDeLa003` | `BOOLEAN` | `PUB` | `CHECK (incluyeFinalidadesDeLa003 = false)`. |

**Invariante R-002-07.** Esa columna existe **para no poder ser verdadera**. Es
el espejo en la base del literal `false` del contrato (§10): el día que alguien
quiera meter la consulta a bureaus dentro de los términos generales, el `INSERT`
falla y el cambio tiene que pasar por compuerta. Es la defensa concreta contra
el art. 37 de la Ley 24.240 y contra desactivar de hecho el control de
consentimiento de la 003 (dictamen §4.5.3).

#### B.2 `acceso.VersionInformacionArt6` y B.3 `acceso.CampoDeclaradoEnElAlta`

`VersionInformacionArt6`: `version` PK, `hashDelTexto`, `responsableRazonSocial`,
`responsableDomicilio`, `destinatarios TEXT[]`, `canalDeEjercicioDeDerechos`,
`vigenteDesde`, `vigenteHasta?`. Todo `PUB`.

`CampoDeclaradoEnElAlta`: PK `(version, campo)`, `campo` (enum: `CORREO`,
`CONTRASENA`, `NOMBRE_PARA_MOSTRAR`, `CUIT_CUIL`, `MATRICULA`, `JURISDICCION`),
`caracter` (`OBLIGATORIO`/`FACULTATIVO`), `claveDeFinalidad`,
`consecuenciaDeNoDarlo`. Todo `PUB`.

**Invariante.** Disparador diferido: una `VersionInformacionArt6` no puede
quedar vigente sin una fila por **cada** campo que el formulario de alta
recolecte. Es el inciso c) del art. 6 —el que el dictamen §3 señala como *"el
que más se olvida"*— convertido en una restricción. Y es también el enganche
formal de E-002-1: mientras el CUIT/CUIL no tenga fila acá con su finalidad y
su carácter, A.2 no se habilita.

#### B.4 `acceso.AceptacionRegistrada`

| Campo | Tipo | Cl. | Notas |
| --- | --- | --- | --- |
| `id` | `TEXT` PK | `INT` | |
| `usuarioId` | `TEXT` FK → A.1 | `PERS` | |
| `documentoClase`, `documentoVersion` | FK → B.1 | `PUB` | Clave foránea compuesta: no se puede aceptar una versión que no existe. |
| `hashDelTextoMostrado` | `TEXT` | `INT` | Se **copia** acá además de estar en B.1. Si mañana alguien corrige una errata en el catálogo, la prueba de qué vio esta persona sigue siendo esta fila. |
| `momento` | `TIMESTAMPTZ` | `INT` | |
| `ipCifrada` (+ nonce/tag/idClave) | `BYTEA` | `PERS↑` | **Cifrada y recuperable, no hasheada.** Ver la nota de abajo. |
| `canal` | `enum` | `INT` | `WEB` \| `MOVIL`. |
| `casillaMarcada` | `TEXT` | `INT` | Identificador de la casilla concreta. |
| `versionInformacionArt6` | `TEXT` FK → B.2 | `PUB` | Qué texto del art. 6 se le mostró (CA-26). |
| `revocadaEn` | `TIMESTAMPTZ?` | `INT` | La revocación se registra; la fila nunca se borra. |

**Por qué la IP acá va cifrada y en la bitácora va hasheada.** No es una
inconsistencia: es que sirven para cosas distintas. En la bitácora la IP se usa
para **correlacionar** accesos, y para eso alcanza un HMAC (así lo resuelve la
004 con `origenIpHash`, y es más seguro). Acá la IP es **prueba de una firma
electrónica** que, por la Ley 25.506, no goza de presunción de validez: la carga
de acreditarla es nuestra (dictamen §4.5.2). Un HMAC sólo prueba una IP que ya
se conoce de antemano, lo que en un litigio es inútil. Cifrada, se puede exhibir.

**Invariante R-002-06 — la aceptación no puede ser un booleano.** Tres capas:
(a) no existe ninguna columna booleana de aceptación en todo el esquema;
(b) el disparador diferido de A.1 invariante 6 impide que una cuenta llegue a
`ACTIVA` sin una fila de cada clase; (c) una **prueba de esquema** en CI recorre
`information_schema.columns` de `acceso` y **falla** si aparece una columna
booleana cuyo nombre coincida con `acepto%`, `acepta%`, `consentimiento%`,
`%terminos%`. Es el equivalente en base de datos de la prueba de minimización de
la 004 §4.2, y es exactamente la verificación que el dictamen pide para C-002-02
(*"test de que no existe un campo booleano de aceptación"*). La corre el
`tester`.

---

### Bloque C — Verificación profesional y su vigencia

Implementa C-002-07 y las salvaguardas M-1 a M-4 y M-6. **Todo este bloque es de
sólo inserción.** No hay ninguna columna de estado de verificación: el estado se
deriva con `derivarEstadoMatricula` (contrato §5) a partir de estos hechos y del
instante de evaluación.

#### C.1 `acceso.DecisionDeVerificacion`

| Campo | Tipo | Cl. | Notas |
| --- | --- | --- | --- |
| `id` | `TEXT` PK | `INT` | |
| `perfilUsuarioId` | `TEXT` FK → A.3 | `PERS` | |
| `momento` | `TIMESTAMPTZ` | `INT` | |
| `resultado` | `enum` | `INT` | `APROBADA` \| `RECHAZADA`. |
| `vigenciaHasta` | `DATE?` | `INT` | CA-05 y CA-29. |
| `decididaPor` | `TEXT` FK → A.1 | `PERS` | Quién aprobó. |
| `evidenciaColegio` | `TEXT?` | `PERS` | En claro. |
| `evidenciaJurisdiccion` | `enum Jurisdiccion?` | `PERS` | |
| `evidenciaNumeroDeMatricula` | `TEXT?` | `PERS` | |
| `evidenciaTomoYFolio` | `TEXT?` | `PERS` | Anulable aun en aprobadas: no todo colegio lo usa. |
| `evidenciaClaseDeConstancia` | `enum?` | `INT` | `CONSTANCIA_EMITIDA_POR_EL_COLEGIO` \| `CONSULTA_AL_PADRON_PUBLICO` \| `CREDENCIAL_PROFESIONAL` \| `OTRA`. |
| `evidenciaFechaDeLaConstancia` | `DATE?` | `INT` | |
| `evidenciaReferenciaDelDocumento` | `TEXT?` | `INT` | Identificador en el almacén de objetos. |
| `evidenciaHuellaDocumento` | `TEXT?` | `INT` | SHA-256. Sin esto, "vi la constancia" es una afirmación sin prueba. Mismo criterio que `Ratificacion.huellaDocumento` de la 004. |
| `motivoRechazo` | `enum?` | `INT` | Catálogo cerrado. |
| `claveIdempotencia` | `TEXT UNIQUE` | `INT` | Constitución #12: una doble aprobación por doble clic no debe crear dos decisiones. |

**Invariantes**

1. **R-002-09** — `CHECK ((resultado = 'APROBADA') = (vigenciaHasta IS NOT
   NULL))`. *Un "verificado" sin fecha de vencimiento no es representable.*
   Es la traducción literal de CA-05 y de la salvaguarda M-6.
2. **R-002-08** — `CHECK (resultado <> 'APROBADA' OR (evidenciaColegio IS NOT
   NULL AND evidenciaJurisdiccion IS NOT NULL AND evidenciaNumeroDeMatricula IS
   NOT NULL AND evidenciaClaseDeConstancia IS NOT NULL AND
   evidenciaFechaDeLaConstancia IS NOT NULL AND evidenciaReferenciaDelDocumento
   IS NOT NULL AND evidenciaHuellaDocumento IS NOT NULL))`. *Aprobar sin
   registrar la evidencia no es representable* (salvaguarda M-1). Es además lo
   que neutraliza el conflicto de interés que el dictamen §4.4 marca: si hay que
   cargar la constancia, aprobar sin mirar deja rastro.
3. `CHECK (resultado <> 'RECHAZADA' OR motivoRechazo IS NOT NULL)`.
4. `CHECK (evidenciaJurisdiccion IS NULL OR evidenciaJurisdiccion = (SELECT …))`
   no es expresable; se resuelve con disparador: la jurisdicción de la evidencia
   debe coincidir con la declarada en A.3, o la decisión se rechaza. Verificar
   una matrícula de Córdoba contra una constancia de Salta es el error que M-7
   viene a prevenir en la asignación de casos.
5. Sólo inserción. Corregir una decisión equivocada es emitir otra.

#### C.2 `acceso.SuspensionDeMatricula`

`id`, `perfilUsuarioId` FK → A.3, `desde`, `dispuestaPor` FK → A.1, `motivo`
(`NOTIFICACION_DEL_COLEGIO` \| `DENUNCIA_RECIBIDA` \| `PEDIDO_DEL_PROFESIONAL` \|
`DECISION_DE_LA_PLATAFORMA`), `referenciaDocumento?`, `levantadaEn?`,
`levantadaPor?`, `motivoLevantamiento?`, `claveIdempotencia UNIQUE`.
Sólo inserción salvo las tres columnas de levantamiento (§7.2).

**Cómo se garantiza el "efecto inmediato" de CA-30.** No con una tarea, no con
un cierre masivo de sesiones: **con la ausencia de caché**. El token de acceso
no lleva permisos (contrato §7, R-03 de la spec), así que `derivarPermisos`
corre en cada petición contra `PerfilDeAutorizacion`, y ese perfil lee las
suspensiones abiertas. El instante en que se inserta la fila es el instante en
que el abogado pierde `caso.leer.asignado`, `caso.actuar.asignado` y
`caso.recibirAsignacion`. **Ésta es la razón concreta por la que D-2 no es una
preferencia estética**: con un estado almacenado y una tarea nocturna, CA-30
sería falso durante un promedio de doce horas.

`UNIQUE (perfilUsuarioId) WHERE levantadaEn IS NULL` — a lo sumo una suspensión
abierta por perfil; evita el empate entre dos filas abiertas con criterios
distintos.

#### C.3 `acceso.HitoDeVigenciaNotificado`

`perfilUsuarioId`, `decisionId` FK → C.1, `hito` (`POR_VENCER_30D` \|
`POR_VENCER_7D` \| `VENCIDA`), `notificadoEn`, `envioId` FK → D.9.
PK `(decisionId, hito)`.

Existe por una sola razón y es la constitución #12: sin esta tabla, el proceso
diario que busca matrículas por vencer le manda el mismo correo al mismo abogado
todos los días hasta que renueve. La PK **es** la clave de idempotencia.

#### C.4 `acceso.EscalamientoDeVerificacion`

`id`, `perfilUsuarioId` FK → A.3, `generadoEn`, `diasHabilesTranscurridos`,
`resueltoEn?`, `resueltoPor?`, `claveIdempotencia UNIQUE` (= `perfilUsuarioId` +
fecha de vencimiento del plazo). CA-31.

**Dependencia declarada con la 004.** CA-31 habla de **días hábiles**. El
calendario ya existe: `motor.DiaNoHabil` (004, E.1), con `jurisdiccion`, `fecha`
y `motivo`. Este modelo **no duplica el calendario**: el proceso de escalamiento
lee `motor.DiaNoHabil` con un `GRANT SELECT` acotado a `rol_acceso`. Duplicarlo
garantizaría que los dos se desincronicen. Queda como punto de coordinación en
§6.2 (la migración tiene que otorgar ese `GRANT`).

> **Desactualizado — ver la nota N-2 del encabezado.** La spec **v4** cambió
> CA-31 a **7 días corridos** y lo declaró parámetro de producto ajustable sin
> compuerta. Este párrafo y `diasHabilesTranscurridos` se escribieron contra la
> v3. El parámetro sembrado sigue la v4; la columna y el `GRANT` quedaron como
> estaban porque retirarlos es una decisión de compuerta, no de la migración.

---

### Bloque D — Sesión, tokens, anti-abuso y envíos

#### D.1 `acceso.Sesion`

| Campo | Tipo | Cl. | Notas |
| --- | --- | --- | --- |
| `id` | `TEXT` PK | `INT` | `IdSesion`, opaco. |
| `usuarioId` | `TEXT` FK → A.1 | `PERS` | |
| `creadaEn`, `ultimoUso` | `TIMESTAMPTZ` | `INT` | |
| `autenticadaEn` | `TIMESTAMPTZ` | `INT` | `auth_time` del token. Es lo que hace verificable el recaudo B-3 (ventana de reautenticación fuerte para apagar el MFA). |
| `nivelAutenticacion` | `enum` | `INT` | `CONTRASENA` \| `CONTRASENA_Y_SEGUNDO_FACTOR`. |
| `ipHash` | `BYTEA` | `PERS` | HMAC-SHA-256 con clave de servidor. **La IP en claro no se guarda nunca en esta tabla.** Sirve para correlacionar, no para exhibir. |
| `ubicacionPais`, `ubicacionProvincia` | `TEXT?` | `PERS` | En claro: es lo que CA-13 le muestra al titular. Resolución **local** obligatoria (contrato §13: `fuente: 'BASE_LOCAL'`); no hay tercero, no hay cesión, no hay transferencia internacional por esta vía. |
| `versionBaseGeoIp` | `TEXT` | `INT` | Para poder explicar por qué en marzo decía "Santa Fe". |
| `dispositivoClase` | `enum` | `PERS` | `ESCRITORIO` \| `TELEFONO` \| `TABLETA` \| `APLICACION_MOVIL` \| `DESCONOCIDO`. |
| `dispositivoSistema`, `dispositivoNavegador` | `TEXT?` | `PERS` | Categorías, no el agente de usuario crudo (contrato §13: *"lo analiza y lo descarta"*). Minimización del art. 4. |
| `cerradaEn` | `TIMESTAMPTZ?` | `INT` | |
| `motivoCierre` | `enum?` | `INT` | `CIERRE_DEL_TITULAR` \| `CIERRE_A_DISTANCIA` \| `REUTILIZACION_DE_REFRESCO` \| `CAMBIO_DE_CONTRASENA` \| `VENCIMIENTO` \| `SUSPENSION_DE_CUENTA`. |

**Invariante.** `CHECK ((cerradaEn IS NULL) = (motivoCierre IS NULL))`. Y
`CHECK (nivelAutenticacion = 'CONTRASENA_Y_SEGUNDO_FACTOR' OR …)`: una sesión de
`ADMINISTRADOR` o `ABOGADO` con nivel `CONTRASENA` no es representable — se
sostiene con la clave foránea compuesta `(usuarioId, rolDelTitular) →
Usuario(id, rol)` y un `CHECK` sobre el par. Es la segunda barrera de CA-32 y
CA-38: aunque alguien lograra saltear la primera, **la sesión no se puede
insertar**.

#### D.2 `acceso.FamiliaDeRefresco`

`id` (`IdFamiliaRefresco`), `sesionId` FK → D.1, `usuarioId` FK → A.1,
`creadaEn`, `generacionActual INT`, `invalidadaEn?`, `motivoInvalidacion?`
(`CIERRE_DE_SESION` \| `REUTILIZACION_DETECTADA` \| `CAMBIO_DE_CONTRASENA` \|
`VENCIMIENTO`). `INT` salvo `usuarioId`.

#### D.3 `acceso.TokenDeRefresco`

`id`, `familiaId` FK → D.2, `generacion INT`, `hashDelSecreto BYTEA`
(HMAC-SHA-256 del secreto; el token viaja como `<idFamilia>.<secreto>`, contrato
§7), `emitidoEn`, `venceEn`, `usadoEn?`, `sucesorId? FK → D.3`, `revocadoEn?`.
Todo `INT`: no hay dato personal acá, sólo material criptográfico.

**Invariantes**

1. `UNIQUE (familiaId, generacion)` y `UNIQUE (familiaId, hashDelSecreto)`.
2. `CHECK (sucesorId IS NULL OR usadoEn IS NOT NULL)` — no hay sucesor sin uso.
3. **R-002-13, CA-10 y CA-11 — la rotación es atómica en la base, no en el
   servicio.** El canje se hace con una sola sentencia:
   `UPDATE TokenDeRefresco SET usadoEn = now() WHERE familiaId = $1 AND
   hashDelSecreto = $2 AND usadoEn IS NULL AND revocadoEn IS NULL RETURNING id`.
   Si devuelve una fila, se rota. Si devuelve cero filas y la fila existe,
   **es reutilización**: dos peticiones concurrentes con el mismo token no
   pueden ganar las dos, porque el `UPDATE` condicional serializa. Que esto sea
   una comparación-e-intercambio del motor y no un `SELECT` seguido de un
   `UPDATE` es la diferencia entre CA-11 cumplido y una condición de carrera
   explotable.
4. Al marcar `FamiliaDeRefresco.invalidadaEn`, un disparador revoca todos los
   tokens vivos de la familia. El cierre de **todas** las sesiones de la cuenta
   (CA-11) es una operación sobre D.1 y queda en la aplicación: §7.3.

#### D.4 `acceso.DesafioDeIngreso`

`id`, `usuarioId?` FK → A.1, `claveDeTrafico BYTEA`, `siguientePaso`
(`SEGUNDO_FACTOR`/`CONFIRMAR`), `metodosAdmitidos`, `creadoEn`, `venceEn`,
`consumidoEn?`, `intentosDeSegundoFactor INT`. `INT` salvo `usuarioId`.

**`usuarioId` es anulable a propósito.** El contrato (§8) exige que el desafío se
emita **siempre**, exista o no la cuenta: si sólo hubiera fila para las cuentas
existentes, la ausencia de desafío sería la señal que CA-08 y R-05 prohíben dar.
Una fila con `usuarioId NULL` es un desafío señuelo, y es funcionalmente
necesaria.

#### D.5 `acceso.IntentoDeAutenticacion`

`id BIGSERIAL`, `claveDeTrafico BYTEA`, `ocurridoEn`, `resultado`
(`EXITO`/`CREDENCIAL_INVALIDA`/`SEGUNDO_FACTOR_INVALIDO`/`CUENTA_INEXISTENTE`),
`ipHash BYTEA`, `usuarioId?` FK → A.1. `PERS` la clave de tráfico y el `ipHash`.

**La clave es `claveDeTrafico`, no `usuarioId`** (contrato §9): el conteo y el
bloqueo se aplican también a identificadores que no existen, porque si sólo se
contaran los existentes el propio bloqueo sería el oráculo de enumeración.

#### D.6 `acceso.BloqueoDeTrafico`

`claveDeTrafico BYTEA` PK, `aplicadoEn`, `hasta`, `intentosContados`,
`notificadoEn?`, `envioId? FK → D.9`. `PERS` la clave.

CA-09, CA-37. El parámetro (5 intentos / 15 min / 15 min) vive en H.3, no en el
código.

**CA-36 / recaudo A-1 no tiene expresión en la base y hay que decirlo.** "El
bloqueo nunca inhabilita la recuperación de contraseña" se cumple porque el
camino de recuperación **no consulta esta tabla**. Eso es una propiedad del
código, no del esquema. Queda en §7.3 con su test obligatorio. Lo que sí hace el
modelo es no darle a nadie la tentación de acoplarlas: el bloqueo no cuelga de
`Usuario`, así que no aparece al leer la cuenta.

#### D.7 `acceso.EnlaceDeUnSoloUso`

`id`, `usuarioId` FK → A.1, `proposito` (`CONFIRMACION_DE_CORREO` \|
`RECUPERACION_DE_CONTRASENA`), `hashDelSecreto BYTEA UNIQUE`, `creadoEn`,
`venceEn`, `usadoEn?`, `invalidadoEn?`, `envioId FK → D.9`,
`claveIdempotencia UNIQUE`. `INT` salvo `usuarioId`.

Mismo canje atómico que D.3 (`UPDATE … WHERE usadoEn IS NULL AND invalidadoEn
IS NULL RETURNING`), que es lo que hace que CA-06 y CA-17 ("segunda vez") sean
verdad bajo concurrencia. Al completar una recuperación (CA-16) se invalidan en
la misma transacción todos los enlaces vivos de ese titular y se cierran todas
sus sesiones.

#### D.8 `acceso.CorreoDeRolProhibido`

`indiceCiego BYTEA` PK, `etiqueta TEXT` (`admin@`, `soporte@`, `info@`,
`contacto@`, `noreply@`, …), `agregadoEn`. Todo `INT`.

Ver F.2 y R-002-04: es lo que permite que el rechazo de buzones genéricos sea
una restricción de la base y no sólo una validación, **a pesar de que el correo
está cifrado**.

#### D.9 `acceso.EnvioTransaccional`

`claveDeIdempotencia TEXT` PK, `plantilla` (enum = `ClavePlantillaCorreo` del
contrato, 16 valores), `usuarioId? FK → A.1`, `encoladoEn`, `enviadoEn?`,
`modo` (`MOCK`/`SMTP_LOCAL`/`PROVEEDOR`), `idDelProveedor?`, `resultado`,
`intentos INT`. `PERS` el `usuarioId`, `INT` el resto.

**No guarda la dirección de destino.** Se resuelve descifrando A.1 en el momento
del envío. Un registro de envíos con las direcciones en claro sería la misma
lista de deudores que D-4 vino a proteger, con otro nombre.

La PK **es** la clave de idempotencia (constitución #12): es la última línea de
defensa contra el aviso duplicado, que en esta feature significa alarmar dos
veces a alguien diciéndole que intentaron entrar a su cuenta.

**Declaración de encargado de tratamiento (R-09, C-002-10).** `modo =
'PROVEEDOR'` significa que la dirección de correo del titular sale del sistema
hacia un tercero, que por el art. 25 de la Ley 25.326 es **encargado de
tratamiento** y exige contrato, y por el art. 12 puede configurar
**transferencia internacional**. El modelo lo deja registrado fila por fila —se
puede responder "a quién se le mandó qué y por qué vía"— pero **la
identificación del proveedor concreto y su instrumento no es mía**: es del
`arquitecto` en el `plan.md`/ADR-029 y de `compliance-legal`. Lo mismo **no**
aplica a la geolocalización, que es local por contrato.

---

### Bloque E — Segundo factor

#### E.1 `acceso.SecretoTotp`

| Campo | Tipo | Cl. | Notas |
| --- | --- | --- | --- |
| `usuarioId` | `TEXT` PK, FK → A.1 | `PERS` | |
| `rolDelTitular` | `enum Rol` | `INT` | Réplica sostenida por clave foránea compuesta `(usuarioId, rolDelTitular) → Usuario(id, rol)`, `ON UPDATE RESTRICT`. **No es desnormalización por comodidad: es el mecanismo de R-002-02.** |
| `secretoCifrado` (+ nonce/tag/idClave) | `BYTEA` | `PERS↑` | AES-256-GCM con clave **propia y distinta**, `k_mfa`, AAD = `usuarioId`. Ver §4.3. |
| `estado` | `enum EstadoMfa` | `INT` | |
| `inscriptoEn` | `TIMESTAMPTZ` | `INT` | |
| `confirmadoEn` | `TIMESTAMPTZ?` | `INT` | Inscripción en dos pasos: el secreto no vale hasta probar un código. |
| `desactivadoEn` | `TIMESTAMPTZ?` | `INT` | |
| `ultimoPasoConsumido` | `BIGINT?` | `INT` | Número de paso TOTP ya usado. Impide replay del mismo código dentro de su ventana de 30 s. |

**Invariante R-002-02 — el MFA del administrador no se puede apagar por datos.**
`CHECK (rolDelTitular NOT IN ('ADMINISTRADOR','ABOGADO') OR desactivadoEn IS
NULL)`. Combinado con la clave foránea compuesta `ON UPDATE RESTRICT`, el
resultado es que **la fila que representa "administrador con MFA desactivado" no
existe**, y además **no se puede degradar el rol para conseguirlo** (cambiar
`Usuario.rol` estando el par replicado acá hace fallar el `UPDATE`).

Es la respuesta al punto 4 del encargo. Hay cuatro capas, y la tercera y la
cuarta son las que hacen que CA-32 diga *"no configurable"* con propiedad:

| Capa | Mecanismo | Qué impide |
| --- | --- | --- |
| 1 | `ExigeSegundoFactor<'ADMINISTRADOR'>` es el literal `true` (contrato §8) | Que exista una clave de configuración para apagarlo. |
| 2 | `mapaRolPermisos.ADMINISTRADOR` no contiene `mfa.desactivar.propio` | Que el titular pida la desactivación. |
| 3 | `CHECK` de A.1 invariante 2 | Que una cuenta admin/abogado quede `ACTIVA` con `estadoMfa <> 'ACTIVO'`. |
| 4 | `CHECK` + clave foránea compuesta de E.1, y `CHECK` de A.5 | Que se desactive el secreto, que se conceda el permiso por ajuste individual, o que se esquive degradando el rol. |

Una variable de entorno no atraviesa ninguna de las dos últimas.

#### E.2 `acceso.CodigoDeRespaldo`

`id`, `usuarioId` FK → A.1, `loteId TEXT`, `hashDelCodigo BYTEA`
(HMAC-SHA-256 con **sal por código**, contrato §8), `generadoEn`, `consumidoEn?`,
`invalidadoEn?`. `UNIQUE (usuarioId, hashDelCodigo)`. `PERS` el `usuarioId`,
`INT` el resto. Regenerar crea un lote nuevo e invalida el anterior en la misma
transacción. Los códigos se muestran una sola vez y no son exportables
(`ClaveSecretaProhibidaEnExportacion`).

#### E.3 `acceso.SolicitudDeRestitucionMfa` — CA-35

| Campo | Tipo | Cl. | Notas |
| --- | --- | --- | --- |
| `id` | `TEXT` PK | `INT` | |
| `titularId` | `TEXT` FK → A.1 | `PERS` | |
| `estado` | `enum EstadoSolicitudRestitucion` | `INT` | `RECIBIDA` \| `ESPERANDO_VERIFICACION_DE_IDENTIDAD` \| `EN_ESPERA_OBLIGATORIA` \| `APROBADA` \| `RECHAZADA` \| `CANCELADA_POR_EL_TITULAR`. |
| `solicitadaEn` | `TIMESTAMPTZ` | `INT` | |
| `esperaHasta` | `TIMESTAMPTZ?` | `INT` | Demora obligatoria: le da al titular legítimo tiempo de reaccionar si la restitución la pidió un atacante. |
| `instruidaPor` | `TEXT? FK → A.1` | `PERS` | |
| `aprobadaPor` | `TEXT? FK → A.1` | `PERS` | |
| `verificacionClase` | `enum ClaseDeComprobacionDeIdentidad?` | `INT` | **Catálogo pendiente, ver abajo.** |
| `verificacionPor` | `TEXT? FK → A.1` | `PERS` | |
| `verificacionMomento` | `TIMESTAMPTZ?` | `INT` | |
| `verificacionResultado` | `enum?` | `INT` | `COINCIDE` \| `NO_COINCIDE` \| `INSUFICIENTE`. |
| `documentacionDestruidaEn` | `TIMESTAMPTZ?` | `INT` | Constancia **del hecho**, no del dato. |
| `resueltaEn` | `TIMESTAMPTZ?` | `INT` | |
| `claveIdempotencia` | `TEXT UNIQUE` | `INT` | |

**Invariantes**

1. **R-002-20, cuatro ojos.** `CHECK (instruidaPor IS NULL OR aprobadaPor IS
   NULL OR instruidaPor <> aprobadaPor)` y `CHECK (estado <> 'APROBADA' OR
   (instruidaPor IS NOT NULL AND aprobadaPor IS NOT NULL))`. Dos personas
   distintas, o la solicitud no se puede aprobar. Es el requisito del contrato
   (§8, ADR-027) hecho estructura: restituirle el segundo factor a un
   administrador es, de hecho, tomar control de la cuenta más poderosa del
   sistema, y una sola persona no debe poder hacerlo.
2. `CHECK (estado <> 'EN_ESPERA_OBLIGATORIA' OR esperaHasta IS NOT NULL)`.
3. `CHECK (estado <> 'APROBADA' OR verificacionResultado = 'COINCIDE')`.
4. `CHECK (resueltaEn IS NULL OR documentacionDestruidaEn IS NOT NULL OR
   verificacionClase IS NULL)` — no se cierra un caso dejando documentación sin
   destruir.
5. Mientras la solicitud está abierta, `Usuario.estadoCuenta =
   'RESTITUCION_MFA_EN_CURSO'` y `SecretoTotp.estado =
   'BLOQUEADO_POR_RESTITUCION'`: la cuenta no opera durante el circuito.

#### E.4 `acceso.DocumentacionDeRestitucion` — **NO SE CREA. ESCALAMIENTO E-002-2**

Punto 8 del encargo: *declará qué datos necesitaría el circuito, con su
clasificación más alta, marcando lo que quede pendiente*.

Lo que el circuito necesitaría, **si** se decidiera pedir documentación:

| Dato | Clasificación | Tratamiento que exigiría |
| --- | --- | --- |
| Imagen del documento nacional de identidad | **`PERS`, la sensibilidad más alta de toda la feature** | Fuera de la base de datos, en almacén de objetos con cifrado propio y clave distinta (`k_restitucion`), vida máxima tasada, acceso nominal y registrado evento por evento. |
| Selfie / prueba de vida | **`PERS`, ídem** | Ídem. |
| Grabación de videollamada con operador | **`PERS`, ídem** | Ídem, y con consentimiento expreso del titular para la grabación. |
| Comprobante de domicilio o de pago | `PERS` + posible `PATR` | Un comprobante de servicios revela domicilio; uno de pago revela capacidad económica. Sería el único dato `PATR` de la feature. |

En la base sólo quedaría `(solicitudId, referenciaEnAlmacen, huellaSha256,
subidaEn, subidaPor, destruidaEn, destruidaPor)`, y esa fila se anularía al
cerrar el caso, dejando únicamente `E.3.documentacionDestruidaEn`.

> **Por qué no lo modelo.** El contrato del `arquitecto` declara
> `ClaseDeComprobacionDeIdentidad = 'A_DEFINIR_EN_G2' | …` y dice expresamente
> que *"el catálogo concreto de comprobaciones admisibles y su base legal los
> define `compliance-legal` con el product owner"* (escalamiento E-4 del plan).
> La condición C-002-12 pide *"qué documentación se pide, con qué base legal,
> quién la ve, por cuánto tiempo se conserva y cómo se destruye"*, y el dictamen
> §5.B deja `retencion.documentacionRecuperacionMFA` en `A DETERMINAR`.
> **Recolectar la imagen de un DNI es el tratamiento de datos más intrusivo de
> toda la feature y no tiene base legal escrita.** Mi mandato dice que en ese
> caso no lo modelo: lo escalo. La tabla no se crea y la migración no la incluye.
>
> **Consecuencia operativa que hay que mirar en la compuerta:** hasta que esto
> se resuelva, el único camino de restitución disponible es
> `CANAL_ALTERNATIVO_YA_REGISTRADO` (un segundo canal de contacto que el titular
> haya registrado antes de perder el factor). Con MFA obligatorio para abogados
> y administradores (CA-32, CA-38), eso puede dejar cuentas irrecuperables. Es
> exactamente el escenario que el dictamen §4.2 anticipa cuando dice que este
> circuito *"deja de ser un caso raro y pasa a ser rutina"*.

---

### Bloque F — Cuentas administradoras nominadas

Punto 9 del encargo, condición C-002-09, recaudos C-1 a C-3.

#### F.1 `acceso.DesignacionDeAdministrador`

| Campo | Tipo | Cl. | Notas |
| --- | --- | --- | --- |
| `usuarioId` | `TEXT` PK, FK → A.1 | `PERS` | |
| `esAdministrador` | `BOOLEAN` | `INT` | Réplica; ver invariante 1. |
| `nombreCompletoCifrado` (+ nonce/tag/idClave) | `BYTEA` | `PERS↑` | El nombre real de la persona, no el "nombre para mostrar". |
| `documentoDeDesignacionReferencia` | `TEXT` | `INT` | El acto por el cual esta persona es administradora. |
| `huellaDocumentoDesignacion` | `TEXT` | `INT` | SHA-256. |
| `creadoPor` | `TEXT? FK → A.1` | `PERS` | `NULL` **sólo** si `esSiembra`. |
| `esSiembra` | `BOOLEAN` | `INT` | |
| `creadaEn` | `TIMESTAMPTZ` | `INT` | |
| `nominalizadaEn` | `TIMESTAMPTZ?` | `INT` | Recaudo C-2. |
| `deshabilitadaEn` | `TIMESTAMPTZ?` | `INT` | Recaudo C-2. |
| `claveIdempotencia` | `TEXT UNIQUE` | `INT` | |

**Cinco mecanismos, ninguno suficiente por sí solo, que juntos hacen imposible
una cuenta `ADMINISTRADOR` sin persona identificada:**

1. **Clave foránea compuesta.** `(usuarioId, esAdministrador) → Usuario(id,
   esAdministrador)` con `ON UPDATE RESTRICT`, más `CHECK (esAdministrador)`.
   Una designación sólo puede apuntar a un administrador, y **un usuario con
   designación no puede dejar de serlo** sin borrar la designación primero.
   (`Usuario.esAdministrador` es columna generada desde `rol`, así que un
   `UPDATE rol` la mueve y la clave foránea lo rechaza.)
2. **Participación total, en el otro sentido.** Un
   `CONSTRAINT TRIGGER … DEFERRABLE INITIALLY DEFERRED` sobre `Usuario` verifica
   **al cierre de la transacción** que todo `rol = 'ADMINISTRADOR'` tiene fila
   en F.1. Ésta es la mitad que una clave foránea no puede expresar en SQL, y
   es la que hace verdadero a CA-33.
3. **Auditoría en la misma transacción (CA-34).** El mismo disparador diferido
   exige que exista en `auditoria.EventoAuditoria` una fila con `accion IN
   ('ADMINISTRADOR_CREADO','ADMINISTRADOR_SEMBRADO')` y
   `titularAfectado = <el nuevo usuario>` dentro de la transacción. **Crear un
   administrador sin dejar rastro no es una regla que se pueda olvidar: es una
   transacción que no cierra.** Cierra el defecto D-002-06.
4. **Buzones genéricos, R-002-04.** Un disparador `BEFORE INSERT` sobre
   `Usuario` con `rol = 'ADMINISTRADOR'` rechaza si `indiceCiegoCorreo` está en
   D.8. Como el índice ciego es determinista, se precalculan los buzones de rol
   conocidos de nuestros dominios y quedan prohibidos **aunque el correo esté
   cifrado y la base no pueda leerlo**. Es la única forma de que esta
   verificación viva en la base bajo D-4; su límite —sólo cubre la lista
   enumerada— está declarado en §7.3.
5. **Una sola siembra, para siempre.** `CREATE UNIQUE INDEX ON
   DesignacionDeAdministrador ((esSiembra)) WHERE esSiembra`: a lo sumo **una**
   fila de siembra puede existir en toda la vida de la base. Y un disparador
   diferido exige que, al insertarse una segunda designación de administrador,
   la de siembra tenga `nominalizadaEn IS NOT NULL OR deshabilitadaEn IS NOT
   NULL` (recaudo C-2: no queda viva "por las dudas"). `CHECK ((creadoPor IS
   NULL) = esSiembra)`.

R-10 de la spec (sin credenciales en variables de entorno) es una propiedad del
script de siembra, no del esquema; queda en §7.3 con su revisión en G4.

#### F.2 Nota sobre el nombre real del administrador

Es el único lugar de la feature donde se guarda el nombre legal de una persona
además del nombre para mostrar. Base legal: ejecución del contrato laboral o de
servicios, y **responsabilidad identificable frente a un habeas data** — que es
literalmente el argumento del recaudo C-1 (*"una bitácora que dice que 'admin'
accedió a un expediente no prueba nada"*). Va cifrado igual, porque una lista de
los administradores de la plataforma es un objetivo de ingeniería social.

---

### Bloque G — Bitácora de auditoría (esquema `auditoria`)

#### G.1 `auditoria.EventoAuditoria`

Extiende el `EventoAuditoria` de la 001 con lo que esa feature dejó escrito para
acá: taxonomía cerrada, retención y encadenamiento de hashes (§0.3).

| Campo | Tipo | Cl. | Notas |
| --- | --- | --- | --- |
| `id` | `TEXT` | `INT` | Opaco. PK compuesta con `momento` por el particionado. |
| `secuencia` | `BIGINT` | `INT` | Monótona dentro de la partición. La asigna la base. Es lo que el sello de Merkle recorre. |
| `momento` | `TIMESTAMPTZ` | `INT` | Clave de partición (rango mensual). |
| `accion` | `enum AccionAuditada` | `INT` | Los **30 valores** del contrato §4. Catálogo cerrado; agregar uno es revisión aditiva. |
| `sujeto` | `TEXT? FK → acceso.Usuario` | `PERS` | **Quién actuó.** `NULL` en acciones del sistema. |
| `titularAfectado` | `TEXT? FK → acceso.Usuario` | `PERS` | **Sobre los datos de quién.** Indexado. Sin esta columna no se puede responder "quién miró mi información" (dictamen §4.1, advertencia 2) y agregarla después obliga a reprocesar la bitácora entera. |
| `tipoRecurso` | `enum TipoRecurso?` | `INT` | |
| `idRecurso` | `TEXT?` | `INT` | Identificador opaco. |
| `clasificacion` | `enum ClasificacionDato` | `INT` | `NOT NULL`. Cierra D-002-10. |
| `permisoEvaluado` | `enum Permiso?` | `INT` | |
| `resultado` | `enum` | `INT` | `PERMITIDO` \| `DENEGADO` \| `EJECUTADO` \| `FALLIDO`. |
| `motivo` | `enum MotivoDenegacion?` | `INT` | |
| `origenSesionId` | `TEXT?` | `INT` | **Por valor, sin clave foránea.** Ver la nota. |
| `origenIpHash` | `BYTEA?` | `PERS` | HMAC. Nunca la IP en claro. Mismo criterio que la 004. |
| `origenDispositivoClase` | `enum?` | `PERS` | |
| `origenCanal` | `enum` | `INT` | `WEB` \| `MOVIL` \| `API` \| `PROCESO_INTERNO` \| `SIEMBRA`. |
| `idCorrelacion` | `TEXT` | `INT` | |
| `datos` | `JSONB` | `INT` | Pares clave/valor **cerrados** (`DatoDeEvento`). Prohibido el texto libre: es la vía por la que un dato patrimonial se filtra a una tabla que nadie cifra. Un `CHECK` valida la forma. |

**Dos decisiones de integridad que resuelven el punto 10 del encargo:**

- **`sujeto` y `titularAfectado` SÍ tienen clave foránea, con `ON DELETE
  RESTRICT`.** Es intencional y es el mecanismo, no un detalle: **el motor de
  base impide borrar físicamente una cuenta mientras tenga un evento en la
  bitácora.** La única salida es la lápida de §5.4. La bitácora no puede quedar
  huérfana porque el `DELETE` falla.
- **`origenSesionId` NO tiene clave foránea.** Las sesiones se purgan a los 90
  días (H.1); una clave foránea contra una tabla purgable obligaría a elegir
  entre no purgar y borrar auditoría. Se guarda por valor, igual que la 004
  referencia entre esquemas.

**Inmutabilidad.** `REVOKE UPDATE, DELETE` a `rol_acceso` y a `rol_auditoria`,
más disparador `BEFORE UPDATE OR DELETE` que lanza excepción. Particionada por
rango mensual, con 12 particiones adelantadas y rutina de creación: la retención
se ejecuta **soltando particiones**, no con borrados masivos. Idéntico al
tratamiento de `motor.BitacoraAcceso` en la 004 §C.5.

#### G.2 `auditoria.SelloDeBitacora`

`particion DATE`, `desdeSecuencia BIGINT`, `hastaSecuencia BIGINT`, `raiz TEXT`,
`algoritmo` (`SHA-256/MERKLE`), `firma TEXT`, `kid TEXT`, `momento`.
PK `(particion, desdeSecuencia)`. Todo `INT`. Sólo inserción.

Existe porque `REVOKE UPDATE, DELETE` **no alcanza** contra alguien con acceso
de escritura a la base: el sello firmado periódicamente es lo que permite
detectar la alteración después del hecho. Es la pieza que convierte "bitácora
inmutable" (constitución #5) de una afirmación en algo demostrable.

#### G.3 Nota de coordinación — dos bitácoras, y no debería haber dos

`motor.BitacoraAcceso` (004, §C.5) y `auditoria.EventoAuditoria` (002) son la
misma cosa con dos formas. La 004 está aprobada en G2 pero `BitacoraAcceso`
pertenece a su Bloque C, **todavía no implementado** (tareas T-06/T-09), así que
hay tiempo. Tener dos registros inmutables de acceso significa que la respuesta a
"quién vio mis datos" se arma con dos consultas que pueden discrepar, y eso es
malo justo en el escenario donde más importa. **Escalamiento E-002-5**: no lo
decido, porque unificarlas toca un G2 ya aprobado.

---

### Bloque H — Retención, purga y parámetros

#### H.1 `acceso.ReglaDeRetencion`

`clave` PK (enum `ClaveDeRetencion` del contrato, ampliado — ver §5.1),
`plazoSegundos BIGINT?`, `accion` (`PURGA_FISICA` \| `ANONIMIZACION` \|
`A_DETERMINAR`), `fundamento TEXT`, `requiereValidacionProfesional BOOLEAN`,
`validadoPor TEXT?`, `validadoEn DATE?`, `vigenteDesde`. Todo `PUB`/`INT`.

**Invariantes**

1. `CHECK ((accion = 'A_DETERMINAR') = (plazoSegundos IS NULL))` — "no sé cuánto"
   es un estado de primera clase, no una fila ausente ni un cero. Mismo criterio
   que `DisponibilidadParametro` en la 004.
2. `UNIQUE (clave, accion)` — destino de la clave foránea compuesta de H.2.
3. `CHECK (validadoPor IS NULL OR validadoEn IS NOT NULL)`.

#### H.2 `acceso.EjecucionDePurga`

`id`, `clave` + `accionDeLaRegla` (clave foránea compuesta → H.1
`(clave, accion)`), `ejecutadaEn`, `registrosAlcanzados INT`, `eventoId`
(referencia al `EventoAuditoria`), `claveIdempotencia TEXT UNIQUE`. Todo `INT`.

**Invariante R-002-15 — no se purga bajo una regla que nadie determinó.**
`CHECK (accionDeLaRegla <> 'A_DETERMINAR')` más la clave foránea compuesta con
`ON UPDATE RESTRICT`. El efecto: mientras `retencion.bitacoraAuditoria` esté en
`A_DETERMINAR`, **la rutina de purga de la bitácora no puede registrar su
ejecución, y por lo tanto no se ejecuta**. Es el mismo patrón que R-2 de la 004
(catálogo apto para producción) aplicado al problema inverso: ahí impedía usar
algo sin ratificar, acá impide **destruir** algo bajo un plazo sin ratificar.
Destruir por error es irreversible; es la dirección correcta para el bloqueo.

Y es lo que hace **verificable** el "mecanismo de purga" que CA-28 exige: cada
corrida deja fila, con cuántos registros alcanzó y con su evento de auditoría.

#### H.3 `acceso.ParametroDeAcceso`

`clave` PK, `valor JSONB`, `unidad TEXT?`, `vigenciaDesde`, `vigenciaHasta?`,
`esNormativo BOOLEAN`, `requiereValidacionProfesional BOOLEAN`, `notaDeAlcance`,
`validadoPor?`, `validadoEn?`. Todo `PUB`.

Los umbrales de CA-37, las vidas de token, `matricula.vigenciaVerificacion` (12
meses) y `matricula.plazoMaximoRevision` (5 días hábiles). Constitución #11:
ninguno es una constante en el código.

**Por qué una tabla propia y no `motor.ParametroNormativo`.** La 004 metió sus
umbrales de producto en el catálogo normativo con un argumento explícito: *"un
umbral cambiado tiene que quedar en la trazabilidad del hallazgo"*. Acá ese
argumento no aplica —no hay hallazgo— y acoplar el inicio de sesión al catálogo
normativo del motor significaría que un problema en el catálogo legal impide
entrar al sistema. `esNormativo = false` en todas las filas de la 002, con una
excepción posible: si el estudio dictamina sobre
`matricula.vigenciaVerificacion`, esa fila pasa a `requiereValidacionProfesional
= true` sin cambiar de tabla.

---

## 2. Diagrama de relaciones

```
                        ┌──────────────────────────────┐
                        │      acceso.Usuario  A.1     │
                        │  id, correo⊕, nombre⊕, rol,  │
                        │  estadoCuenta, estadoMfa     │
                        │  (esAdministrador) generada  │
                        └──┬───────────────────────┬───┘
      1:0..1                │                       │            1:N
   ┌───────────────┬────────┼───────────┬───────────┴────────┬──────────────┐
   │               │        │           │                    │              │
┌──▼─────────┐ ┌───▼──────┐ │      ┌────▼──────────┐   ┌─────▼────────┐ ┌───▼────────┐
│A.2 Identif.│ │A.3 Perfil│ │      │E.1 SecretoTotp│   │B.4 Aceptacion│ │A.5 Ajuste  │
│   Fiscal   │ │Profesion.│ │      │  (rolTitular) │   │  Registrada  │ │  Permiso   │
│ CONDICIONADA│ │(rolTit.) │ │      └───────────────┘   └──────┬───────┘ └────────────┘
└────────────┘ └──┬───┬───┘ │      ┌───────────────┐          │ FK compuesta
                  │   │     │      │E.2 CodigoResp.│   ┌──────▼──────────────┐
      1:N         │   │ 1:N │      └───────────────┘   │B.1 VersionDocumento │
   ┌──────────────┘   └───┐ │      ┌───────────────┐   │  incluye003 = false │
   │                      │ │      │E.3 SolicRest. │   └─────────────────────┘
┌──▼──────────────┐ ┌─────▼─▼──┐   │   MFA (4 ojos)│   ┌─────────────────────┐
│C.1 DecisionDe   │ │C.2 Suspen│   └───────────────┘   │B.2 InfoArt6         │
│  Verificacion   │ │  sion    │   ╔═══════════════╗   │  └ B.3 CampoAlta    │
│ ▸ evidencia     │ │          │   ║E.4 Documenta. ║   └─────────────────────┘
│   obligatoria   │ └──────────┘   ║ NO SE CREA    ║
│ ▸ vigenciaHasta │                ║ (E-002-2)     ║
└──┬──────────────┘                ╚═══════════════╝
   │ 1:N
┌──▼──────────┐  ┌───────────────┐ ┌──────────────────────────────────┐
│C.3 HitoVig. │  │C.4 Escalam.   │ │ F.1 DesignacionDeAdministrador   │
│ Notificado  │  │  Verificacion │ │  FK compuesta (id,esAdmin)       │
└─────────────┘  └───────────────┘ │  + disparador diferido + audit   │
                                   └──────────────────────────────────┘
   sesión y tokens                            anti-abuso
┌────────────┐ 1:N ┌──────────────┐ 1:N ┌──────────────┐   ┌──────────────────┐
│ D.1 Sesion ├────►│D.2 FamiliaRef├────►│D.3 TokenRefr.│   │D.5 IntentoAutent.│
│ (rolTit.)  │     │              │     │ CAS atómico  │   │  claveDeTrafico  │
└────────────┘     └──────────────┘     └──────────────┘   └────────┬─────────┘
┌────────────┐ ┌──────────────┐ ┌──────────────┐                    │
│D.4 Desafio │ │D.7 EnlaceUno │ │D.9 EnvioTrx. │           ┌────────▼─────────┐
│ usuario?   │ │              │ │ PK = idemp.  │           │D.6 BloqueoTráfico│
└────────────┘ └──────────────┘ └──────────────┘           └──────────────────┘
                                                            D.8 CorreoRolProhib.

  ══════════════ esquema auditoria ══════════════
  ┌──────────────────────────────────┐   ┌────────────────────┐
  │ G.1 EventoAuditoria (particion.) │   │ G.2 SelloDeBitacora│
  │  sujeto ──────► acceso.Usuario   │   │  Merkle + firma    │
  │  titularAfectado ──► Usuario     │   └────────────────────┘
  │       ON DELETE RESTRICT  ◄── impide borrar y dejar huérfana
  │  origenSesionId: POR VALOR, sin FK
  └──────────────────────────────────┘

  ══════════════ retención ══════════════
  ┌────────────────────┐ FK compuesta  ┌─────────────────────┐
  │ H.1 ReglaRetencion ├──────────────►│ H.2 EjecucionDePurga│
  │  (clave, accion)   │  accion <>    └─────────────────────┘
  └────────────────────┘  A_DETERMINAR      H.3 ParametroDeAcceso

  ⊕ = cifrado en reposo con índice ciego para búsqueda por igualdad
```

**Sentido de las dependencias.** Todo cuelga de `Usuario`. `Usuario` no depende
de nada. `auditoria` depende de `acceso` (y esa dependencia es el candado de
§5.4). `acceso` depende de `motor` en un solo punto y de sólo lectura:
`motor.DiaNoHabil`, para los días hábiles de CA-31. `identidad` no aparece:
la 007 referenciará `acceso.Usuario.id` **por valor**.

---

## 3. Índices y patrones de acceso

Cada índice con la consulta que lo motiva. Un índice sin consulta se saca
(regla 8 del mandato).

| # | Consulta esperada | Origen | Frecuencia | Índice que la sirve |
| --- | --- | --- | --- | --- |
| **Q-00** | **Armar el `PerfilDeAutorizacion` de quien hace la petición**: cuenta + MFA + verificación profesional + ajustes. | Contrato §2/§3; CA-18, CA-19, CA-29, CA-30 | **Altísima — una vez por petición autenticada** | PK de A.1; PK de A.3; `idx_perfil_ultima_decision` sobre `PerfilProfesional(ultimaDecisionId)`; `idx_suspension_abierta` sobre `SuspensionDeMatricula(perfilUsuarioId) WHERE levantadaEn IS NULL`; `idx_ajuste_vivo` sobre `AjustePermiso(usuarioId) WHERE revocadoEn IS NULL`. Cuatro búsquedas por índice y ninguna exploración. **Ver la nota de rendimiento abajo.** |
| Q-01 | Buscar la cuenta por correo al ingresar o al dar de alta. | CA-01, CA-02, CA-07 | Altísima | `uq_usuario_correo` `UNIQUE` sobre `Usuario(indiceCiegoCorreo) WHERE purgadaEn IS NULL`. |
| Q-02 | Detectar CUIT/CUIL ya registrado, **fuera del camino de respuesta**. | CA-04 | Media (proceso asincrónico) | `idx_fiscal_indice` sobre `IdentificadorFiscal(indiceCiegoCuit) WHERE vigente`. **No único, a propósito**: A.2 invariante 2. |
| Q-03 | Canjear un token de refresco. | CA-10, CA-11 | Muy alta | `uq_refresco_familia_hash` `UNIQUE` sobre `TokenDeRefresco(familiaId, hashDelSecreto)`. |
| Q-04 | Sesiones activas del titular. | **CA-13** | Alta | `idx_sesion_abierta` sobre `Sesion(usuarioId, ultimoUso DESC) WHERE cerradaEn IS NULL`. Parcial: las sesiones abiertas son una fracción mínima del histórico. |
| Q-05 | Cerrar **todas** las sesiones de una cuenta. | **CA-11, CA-16** | Baja, crítica | El mismo índice de Q-04. |
| Q-06 | Intentos fallidos de una clave de tráfico dentro de la ventana. | **CA-09** | Altísima (en cada intento) | `idx_intento_trafico` sobre `IntentoDeAutenticacion(claveDeTrafico, ocurridoEn DESC)`. |
| Q-07 | ¿Hay bloqueo vigente para esta clave de tráfico? | CA-09 | Altísima | PK de `BloqueoDeTrafico(claveDeTrafico)`. |
| Q-08 | Resolver un enlace de un solo uso. | CA-06, CA-15, CA-16, CA-17 | Media | `uq_enlace_hash` `UNIQUE` sobre `EnlaceDeUnSoloUso(hashDelSecreto)`. |
| Q-09 | **Matrículas cuya vigencia vence en N días, o ya venció, sin renovación posterior.** | **CA-29** | Diaria | `idx_decision_vigencia` sobre `DecisionDeVerificacion(vigenciaHasta) WHERE resultado = 'APROBADA'`. Parcial; el `DISTINCT ON (perfilUsuarioId)` por `momento DESC` lo cubre `idx_decision_perfil`. |
| Q-10 | **Cola de verificaciones pendientes, por antigüedad, con el plazo vencido.** | **CA-31** | Diaria + tablero | `idx_perfil_pendiente` sobre `PerfilProfesional(solicitadaEn ASC) WHERE ultimaDecisionId IS NULL`. Parcial: el tamaño del índice es el de la cola, no el del padrón. |
| Q-11 | Decisiones y suspensiones de un perfil (historia completa). | CA-05, CA-22, habeas data | Media | `idx_decision_perfil` sobre `DecisionDeVerificacion(perfilUsuarioId, momento DESC)`; `idx_suspension_perfil` sobre `SuspensionDeMatricula(perfilUsuarioId, desde DESC)`. |
| Q-12 | **"¿Quién miró mi información?"** y exportación de la bitácora propia. | **CA-21, CA-25**, dictamen §4.1 adv. 2 | Media | `idx_evento_titular` sobre `EventoAuditoria(titularAfectado, momento DESC)`, local a cada partición mensual. |
| Q-13 | "Mi actividad reciente" de cada portal. | CA-10 de la 001, `auditoria.leer.propia` | Alta | `idx_evento_sujeto` sobre `EventoAuditoria(sujeto, momento DESC)`, local a cada partición. |
| Q-14 | **Todas las creaciones de cuentas administradoras.** | **CA-34** | Baja, crítica | `idx_evento_admin` sobre `EventoAuditoria(momento) WHERE accion IN ('ADMINISTRADOR_CREADO','ADMINISTRADOR_SEMBRADO','ADMINISTRADOR_NOMINALIZADO')`. Parcial y diminuto. |
| Q-15 | **Cuentas nunca confirmadas más viejas que el plazo.** | **CA-28** | Diaria | `idx_usuario_sin_confirmar` sobre `Usuario(creadoEn) WHERE estadoCuenta = 'NO_VERIFICADA'`. Parcial. |
| Q-16 | Sesiones cerradas más viejas que el plazo, para purgar. | Retención | Diaria | `idx_sesion_cerrada` sobre `Sesion(cerradaEn) WHERE cerradaEn IS NOT NULL`. |
| Q-17 | Tokens y enlaces vencidos, para purgar. | Retención | Diaria | `idx_refresco_vence` sobre `TokenDeRefresco(venceEn)`; `idx_enlace_vence` sobre `EnlaceDeUnSoloUso(venceEn)`. |
| Q-18 | Panel de gestión de usuarios, filtrado por rol y estado. | **CA-22** | Media | `idx_usuario_panel` sobre `Usuario(rol, estadoCuenta, creadoEn DESC)`. |
| Q-19 | Solicitudes de restitución de MFA abiertas. | CA-35 | Diaria | `idx_restitucion_abierta` sobre `SolicitudDeRestitucionMfa(solicitadaEn) WHERE resueltaEn IS NULL`. |
| Q-20 | Códigos de respaldo disponibles de una cuenta. | CA-08, CA-35 | Media | `idx_codigo_vivo` sobre `CodigoDeRespaldo(usuarioId) WHERE consumidoEn IS NULL AND invalidadoEn IS NULL`. |
| Q-21 | Aceptaciones de un titular (prueba y exportación). | **CA-25, CA-27** | Baja, crítica | `idx_aceptacion_titular` sobre `AceptacionRegistrada(usuarioId, momento DESC)`. |
| Q-22 | Envío transaccional ya realizado para esta clave. | Constitución #12 | Alta | PK de `EnvioTransaccional(claveDeIdempotencia)`. |

**Nota de rendimiento sobre Q-00, que es la decisión con más consecuencias.**
Derivar los permisos en cada petición, en vez de meterlos en el token, cuesta
cuatro búsquedas por índice por petición autenticada. Es el precio de CA-30
("efecto inmediato") y de la revocación real: un permiso dentro del token
sobrevive a su revocación hasta que vence. El precio se paga y se mide; el
objetivo de latencia lo fija el `arquitecto` en el `plan.md`. **Lo que este
modelo descarta explícitamente es la salida fácil**: una columna
`estadoVerificacionCacheado` en `Usuario`. Esa columna es el defecto D-2, y
reaparecería como "el abogado suspendido siguió operando doce horas".

**Índices descartados por no tener consulta.** Ninguno sobre
`nombreParaMostrar` (no hay búsqueda por nombre en los 39 criterios; si el
panel de CA-22 la necesitara, hace falta un índice ciego adicional y eso es una
decisión de G2, no un agregado silencioso). Ninguno sobre `Sesion(ipHash)`: la
investigación por IP no está entre los criterios y un índice ahí facilitaría
justo la correlación masiva que la minimización desalienta. Ninguno sobre
`EventoAuditoria(idCorrelacion)`: se usa en el registro de diagnóstico, no en
una consulta de producto.

---

## 4. Datos sensibles

### 4.1 Clasificación y tratamiento

| Campo | Entidad | Cl. | Tratamiento | Base legal |
| --- | --- | --- | --- | --- |
| `correoCifrado` | A.1 `Usuario` | `PERS↑` | AES-256-GCM, clave `k_acceso`, AAD = `id`. Búsqueda **sólo** por `indiceCiegoCorreo` (HMAC-SHA-256, clave fuera de la base). | Relación contractual, art. 5 inc. 2 ap. d `[P]` (dictamen §2.1). |
| `nombreParaMostrarCifrado` | A.1 | `PERS↑` | Ídem. Sin índice. | Ídem. |
| `hashContrasena` | A.1 | `PERS` | `argon2id` sobre la contraseña pimentada con HMAC (clave fuera de la base). No reversible, no exportable, **ningún rol lo lee**: `REVOKE SELECT` a nivel de columna para todos los roles salvo el de autenticación. | Art. 9 `[P]`; R-02. |
| `valorCifrado` (CUIT/CUIL) | A.2 | `PERS↑` | AES-256-GCM `k_acceso` + `indiceCiegoCuit`. **Tabla condicionada, E-002-1.** | `[!]` **Sin finalidad declarada no hay base legal que evaluar** (dictamen §2.2.a). |
| `matricula`, `jurisdiccion`, `colegioDeclarado`, `especialidad` | A.3, A.4 | `PERS` | **En claro y con índice, a propósito.** Es dato de publicidad registral del colegio; su finalidad es la identificabilidad y cifrarlo impediría verificarlo. Acceso limitado a `rol_admin`, `rol_auditoria` y al propio titular. | Relación contractual con el profesional; responsabilidad profesional identificable (dictamen §2.1). Mismo criterio que la 004 §4.1, ya aprobado. |
| Campos `evidencia*` | C.1 | `PERS` | En claro. El documento en sí vive en el almacén de objetos; acá su referencia y su SHA-256. | Ídem. Salvaguarda M-1. |
| `nombreCompletoCifrado` | F.1 | `PERS↑` | AES-256-GCM `k_acceso`. | Ejecución del contrato con el administrador + responsabilidad identificable (recaudo C-1). |
| `ipCifrada` | B.4 `AceptacionRegistrada` | `PERS↑` | AES-256-GCM `k_acceso`. **Cifrada y recuperable, no hasheada**: es prueba de firma electrónica y la carga de acreditarla es nuestra. | Art. 6 `[C]`; Ley 25.506 `[P]`; art. 5.2.d `[P]`. Declarada en el art. 6 (CA-26). |
| `ipHash` | D.1 `Sesion`, D.5, G.1 | `PERS` | HMAC-SHA-256 con clave de servidor. **La IP en claro no se guarda nunca** en estas tres tablas. | Art. 9 `[P]` (seguridad de la sesión) + art. 5.2.d. **R-09 de la spec: es dato personal tratado, y se declara en el art. 6.** |
| `ubicacionPais`, `ubicacionProvincia` | D.1 | `PERS` | En claro (CA-13 se los muestra al titular). **Resolución local obligatoria**: base descargada, la IP no sale del sistema. Granularidad gruesa a propósito. | Ídem. Es **dato generado**, no aportado por el titular (dictamen §2.2.b): por eso su declaración en el art. 6 es obligatoria y no opcional. |
| `dispositivoClase`, `dispositivoSistema`, `dispositivoNavegador` | D.1, G.1 | `PERS` | Categorías cerradas. **El agente de usuario crudo se analiza y se descarta**, nunca se persiste. | Ídem. Minimización, art. 4 inc. 1 `[P]`. |
| `claveDeTrafico` | D.4, D.5, D.6 | `PERS` | HMAC-SHA-256 del correo o del CUIT/CUIL normalizado. No reversible. | Art. 9 `[P]`. Su forma (derivada y no el valor) es lo que permite contar intentos de cuentas inexistentes sin guardar el identificador tecleado por un desconocido. |
| `secretoCifrado` (TOTP) | E.1 | `PERS↑` | AES-256-GCM con **clave propia y distinta**, `k_mfa`, AAD = `usuarioId`. Nunca sale de la base descifrado más allá de la verificación. No exportable. | Art. 9 `[P]`; CA-32, CA-38. |
| `hashDelCodigo` | E.2 | `INT` | HMAC-SHA-256 con **sal por código**. No exportable. | Ídem. |
| `hashDelSecreto` | D.3, D.7 | `INT` | HMAC-SHA-256. El secreto en claro sólo existe en tránsito. | Art. 9 `[P]`. |
| Documentación de identidad del circuito de restitución | **E.4 — no se crea** | **`PERS`, la más alta** | — | **`[D]` sin base legal escrita. Escalamiento E-002-2.** |
| `id`, `usuarioId`, `sesionId`, `perfilUsuarioId`, `titularAfectado`, `sujeto` | todas | `PERS` | **Identificadores opacos** (ULID/UUIDv7 aleatorios), sin estructura derivable, sin relación con documento, correo ni matrícula. En claro porque son la clave de acceso y tienen que ser indexables. | Minimización, art. 4 `[P]`; R-03, D-002-11, condición C-10 de la 004. |
| Catálogos: `Permiso`, `AccionAuditada`, B.1, B.2, B.3, H.3 | varias | `PUB` | En claro, replicables, cacheables. | No son datos personales. |
| Estados, marcas de tiempo, huellas, claves de idempotencia, `secuencia` | todas | `INT` | En claro. | — |

### 4.2 Minimización hecha explícita en el esquema

Tres defensas, las tres verificables en CI por el `tester`:

1. **Lo que no debe existir como columna.** Una prueba recorre
   `information_schema.columns` de `acceso` y `auditoria` y **falla** si aparece
   una columna cuyo nombre sugiera un dato que esta feature no necesita:
   `domicilio`, `telefono`, `fechaNacimiento`, `edad`, `cbu`, `numeroTarjeta`,
   `ingreso`, `salario`, `dni`, `agenteDeUsuario`. Equivalente a la prueba de
   minimización de la 004 §4.2.
2. **Lo que no debe existir como booleano.** La prueba de R-002-06: ninguna
   columna booleana con nombre de aceptación o consentimiento.
3. **Lo que no debe estar en claro.** La misma prueba verifica que `correo`,
   `nombre` y `cuit` no aparezcan como columnas de tipo `text`/`varchar` en
   `acceso`: si alguien "desanda" D-4 por comodidad, el pipeline lo frena.

### 4.3 Claves de cifrado

Tres claves, gestionadas fuera de la base; el almacén lo define `cicd` en G6.

| Clave | Cifra | Quién la usa | Por qué separada |
| --- | --- | --- | --- |
| `k_acceso` | Correo, nombre para mostrar, CUIT/CUIL, IP de la aceptación, nombre del administrador | Servicio de identidad de `apps/api` | Es la clave que convierte un volcado de la base en ruido. |
| `k_mfa` | `SecretoTotp.secretoCifrado` | Sólo el verificador del segundo factor | Un compromiso de `k_acceso` expone identidades; que además exponga los semilleros TOTP convertiría una fuga en una suplantación. Separarlas cuesta poco. |
| `k_indice` | No cifra: **deriva** los índices ciegos y los HMAC de IP y de clave de tráfico | Servicio de identidad | Si estuviera en la base, el índice ciego sería reversible por diccionario (el espacio de correos y de CUILes es chico y enumerable). **Fuera de la base no es negociable.** |

Rotación: `idClave` por fila, recifrado en segundo plano. Sólo cambian
`…Cifrado`, `…Nonce`, `…Tag`, `…IdClave`; la rotación es la excepción admitida
por el disparador de inmutabilidad y se registra con acción propia en la
bitácora. `k_indice` **no rota sin recálculo total** de los índices ciegos: es
una migración de datos, no una rotación, y hay que decirlo antes de prometerla.

### 4.4 Lo que no se exporta (CA-25, advertencia 1 del dictamen)

El contrato lo resuelve por tipos (`SinSecretos<T>`, §12). La base pone la
segunda barrera: `REVOKE SELECT` a nivel de columna sobre `hashContrasena`,
`SecretoTotp.secretoCifrado`, `CodigoDeRespaldo.hashDelCodigo`,
`TokenDeRefresco.hashDelSecreto` y `EnlaceDeUnSoloUso.hashDelSecreto` para todos
los roles salvo el de autenticación. Una exportación mal diseñada es una fuga
con forma de derecho, y conviene que falle en dos capas.

---

## 5. Retención y supresión

### 5.1 Plazo por entidad

**Todas las filas con fundamento normativo salen con
`requiereValidacionProfesional: true` y con la columna "Validado por" vacía.**
Ninguna purga con plazo `A_DETERMINAR` puede ejecutarse (R-002-15).

| Clave de retención | Entidades | Plazo propuesto | Acción | Fundamento | ¿Firma del estudio? |
| --- | --- | --- | --- | --- | --- |
| `cuentaNoVerificada` | A.1 y todo lo suyo | **30 días** desde `creadoEn` sin confirmar | `PURGA_FISICA` con lápida (§5.4) | **CA-28**, condición C-002-03. Art. 4 inc. 7 `[P]`. Es el caso que el dictamen §2.3 marca como el más claro: datos de alguien que nunca fue usuario y que pudo no haber tecleado el formulario. | Sí — valor `[I]` del revisor |
| `enlaceConfirmacion` | D.7 | **24 h** de vida + 7 días de registro | `PURGA_FISICA` | Producto. Sin objeción legal a otros valores. | No |
| `enlaceRecuperacion` | D.7 | **1 h** de vida + 7 días de registro | `PURGA_FISICA` | Ídem. | No |
| `desafioDeIngreso` | D.4 | **15 min** de vida + 24 h de registro | `PURGA_FISICA` | Art. 9 `[P]`. | No |
| `tokenRefrescoUsado` | D.2, D.3 | **Vida del refresco + 30 días** | `PURGA_FISICA` | Art. 9 `[P]`. El margen es lo que permite detectar la reutilización de CA-11; sin margen, un token robado y usado tarde pasaría por nuevo. | No |
| `intentosFallidos` | D.5, D.6 | **7 días** | `PURGA_FISICA` | Art. 9 `[P]`. Ventana del parámetro (15 min) más margen para ver patrones. Dictamen §5.B: "no indefinido". | No |
| `sesionCerrada` | D.1 | **90 días** desde `cerradaEn` | `PURGA_FISICA` | Art. 4 inc. 7 y art. 9 `[P]`. Es el dato más identificatorio que la feature genera de forma continua (dictamen §5.B). | Sí — valor `[I]` |
| `envioTransaccional` | D.9 | **180 días** | `PURGA_FISICA` | Producto + prueba de haber avisado (CA-02, CA-09, CA-16). No guarda direcciones. | No |
| `aceptacion` | B.4 | **`A_DETERMINAR`** | `A_DETERMINAR` | Vida de la cuenta + plazo de prescripción de la acción del consumidor `[D]` (dictamen §2.1). **Provisorio: conservación indefinida, sin purga automática.** | **Sí, bloqueante** |
| `verificacionProfesional` | A.3, C.1 a C.4 | **`A_DETERMINAR`** | `A_DETERMINAR` | Plazo de prescripción de la responsabilidad profesional `[D]`. **Es el mismo escalamiento E-2 que la 004 dejó abierto**; se resuelven juntos o no se resuelve ninguno. Provisorio: sin purga. | **Sí, bloqueante** |
| `bitacoraAuditoria` | G.1, G.2 | **`A_DETERMINAR`**; valor de trabajo **5 años** | `A_DETERMINAR` | Constitución #5; art. 9 `[P]`. Tensión real: es prueba en un habeas data y a la vez contiene datos personales. La 004 fijó 5 años para `BitacoraAcceso`; **acá no lo doy por resuelto** porque el dictamen de la 002 lo deja en `[D]`. **Sin purga automática: R-002-15 lo impide materialmente.** | **Sí, bloqueante** |
| `documentacionRestitucionMfa` | E.4 | **`A_DETERMINAR`** | `A_DETERMINAR` | No se recolecta. Escalamiento E-002-2. | **Sí, bloqueante** |
| `cuentaDadaDeBaja` | transversal | **`A_DETERMINAR`** | `A_DETERMINAR` | Art. 4 inc. 7 y art. 16 `[P]` vs. obligaciones probatorias y contables `[D]`. **Bloquea el diseño de la 003, no el G2 de la 002** (dictamen §2.3). | **Sí, bloqueante** |
| Catálogos B.1, B.2, B.3, H.3, D.8 | | **Indefinido** | — | No son datos personales. Conservarlos es lo que permite probar qué texto aceptó cada persona (CA-27). Nunca se suprimen. | No |

### 5.2 Nada se borra — y las tres excepciones

Regla general: baja lógica. En esta feature hay **tres** situaciones en que sí se
destruye, y las tres dejan constancia del hecho en H.2 y en la bitácora:

1. **Purga de cuentas nunca confirmadas** (CA-28). §5.4.
2. **Vencimiento del plazo de retención** de sesiones, tokens, enlaces, desafíos,
   intentos y envíos. Son datos operativos, no hay nada que anonimizar.
3. **Pedido de supresión del titular** (Ley 25.326 art. 16). La 002 no
   implementa el circuito —es de la 003— pero **deja el mecanismo construido**:
   es el mismo de §5.4.

### 5.3 Ejecución de la purga de CA-28, verificable

CA-28 pide "plazo y mecanismo verificable". El mecanismo:

1. Un proceso diario consulta Q-15 con el plazo leído de H.1 (`cuentaNoVerificada`).
2. Por cada cuenta alcanzada, en **una** transacción: se anulan las columnas
   personales de A.1 y se borran físicamente las filas dependientes de A.2, A.4,
   B.4, D.1 a D.7, E.1, E.2; se escribe `CUENTA_PURGADA` en la bitácora con el
   identificador opaco.
3. Al final de la corrida se inserta una fila en H.2 `EjecucionDePurga` con
   `registrosAlcanzados` y su `claveIdempotencia`.
4. Si la regla estuviera en `A_DETERMINAR`, el paso 3 falla por R-002-15 y la
   transacción se revierte: **no se destruye nada bajo un plazo que nadie fijó.**

El `tester` verifica: cuenta creada y no confirmada + reloj adelantado ⇒ los
datos personales no están, la lápida sí, el evento sí, la fila de H.2 sí.

### 5.4 La lápida — cómo la baja no deja huérfana la bitácora

Punto 10 del encargo, y el punto donde más fácil se rompe algo en la 003.

**El problema.** Si la supresión borrara la fila de `Usuario`, la bitácora
quedaría con `sujeto` y `titularAfectado` apuntando a la nada. Y la bitácora es
precisamente el registro de la **licitud** del tratamiento: destruirla o
romperla perjudica al propio titular en un eventual reclamo (es el argumento de
la 004 §5.1 y lo comparto).

**La solución, en tres piezas:**

1. **Clave foránea `ON DELETE RESTRICT`** desde `auditoria.EventoAuditoria` hacia
   `acceso.Usuario`. El `DELETE` de una cuenta con eventos **falla en el motor de
   base**. No es una convención: es imposible.
2. **La lápida.** La supresión es un `UPDATE` destructivo: anula todas las
   columnas personales, pone `estadoCuenta = 'PURGADA'`, `purgadaEn`,
   `motivoPurga`. Queda una fila con un identificador opaco y nada más. Los
   `CHECK` de A.1 invariante 3 garantizan que la lápida esté verdaderamente
   vacía: **una lápida con el correo adentro no es representable.**
3. **Qué queda y qué se va.** La bitácora conserva **qué pasó** referido a un
   identificador que ya no reidentifica a nadie: para el responsable del
   tratamiento deja de ser dato personal, porque el único puente
   —`acceso.Usuario` e `identidad.VinculoSeudonimo`— fue destruido. Es el mismo
   razonamiento del paso 2 de la 004 §5.3, ya aprobado en G2.

**Lo que la 002 deja resuelto para la 003:** el mecanismo, los `CHECK` y la
clave foránea. **Lo que no:** el corte entre qué se suprime y qué se conserva
como núcleo probatorio, que es `retencion.cuentaDadaDeBaja` y está en
`A_DETERMINAR` por dictamen del estudio.

**Advertencia hacia la 003, para que no se pierda entre features.** La Res. SCI
424/2020 `[C]` exige que el botón de baja sea accesible **desde la portada y sin
registración previa**. Eso significa que el camino de baja **no puede
autenticarse con este modelo** —no hay sesión— y necesita un circuito propio de
verificación del titular. No es un detalle de UI: es una restricción sobre el
modelo de datos de la 003.

---

## 6. Migración

### 6.1 Situación de partida

Dos migraciones aplicadas, ambas de la feature 004:

| Aplicada | Contenido |
| --- | --- |
| `20260921120000_extensiones_y_esquemas` | `CREATE SCHEMA motor, identidad`; `btree_gist`, `pgcrypto`; roles `rol_motor`, `rol_identidad`, `rol_auditoria`, `rol_cliente`, `rol_abogado`, `rol_operador`, `rol_admin`. |
| `20260921120100_catalogo_normativo` | Bloque A de la 004 (A.1 a A.6). |

**No hay una sola fila de datos personales en la base.** No hay tabla `Usuario`,
no hay `EventoAuditoria`, no hay `apps/api/src`. La feature 002 **agrega**, no
transforma. Bloqueo de escritura estimado: **cero** (ver §6.3).

Las migraciones `0003` a `0010` están reservadas por el plan de la 004 para sus
bloques restantes. La 002 arranca en `0011` para no chocar; los nombres reales
llevan marca de tiempo, el número es la referencia de este documento.

### 6.2 Orden previsto

Una migración por bloque, para poder revertir por partes.

| # | Migración | Contenido | Reversible |
| --- | --- | --- | --- |
| `0011` | `esquemas_acceso_y_auditoria` | `CREATE SCHEMA acceso, auditoria`; rol `rol_acceso`; `GRANT SELECT ON motor.DiaNoHabil TO rol_acceso` (C.4); enums compartidos. | Sí, `DROP SCHEMA` vacío. |
| `0012` | `cuenta_y_perfil` | A.1, A.3, A.4, A.5, A.6 con sus `CHECK`, la columna generada `esAdministrador` y los índices únicos parciales. | Sí. |
| `0013` | `informacion_y_aceptacion` | B.1 a B.4, con el `CHECK (incluyeFinalidadesDeLa003 = false)`. | Sí. |
| `0014` | `verificacion_profesional` | C.1 a C.4 con los `CHECK` de evidencia y de vigencia. | Sí. |
| `0015` | `sesion_y_tokens` | D.1 a D.9. | Sí. |
| `0016` | `segundo_factor` | E.1 a E.3 con la clave foránea compuesta de rol. **E.4 no se incluye** (E-002-2). | Sí. |
| `0017` | `administradores_nominados` | F.1, D.8, la clave foránea compuesta y el índice único de siembra. | Sí. |
| `0018` | `bitacora_de_auditoria` | G.1 particionada por rango mensual con 12 particiones adelantadas y rutina de creación; G.2. | Sí. |
| `0019` | `retencion_y_parametros` | H.1, H.2, H.3 con la clave foránea compuesta anti-`A_DETERMINAR`. | Sí. |
| `0020` | `privilegios_y_rls` | Políticas de §7.4, `REVOKE` a nivel de columna de §4.4, `FORCE ROW LEVEL SECURITY`. | Sí. |
| `0021` | `disparadores_de_integridad` | Inmutabilidad de las tablas de sólo inserción; los cuatro disparadores diferidos de §7.1; la proyección `PerfilProfesional.ultimaDecisionId`. | Sí. |
| `0022` | `identificador_fiscal` | **A.2. NO SE EJECUTA hasta que se resuelva E-002-1.** Migración escrita y no aplicada; su ausencia no rompe nada porque ninguna otra tabla la referencia. | Sí. |
| `0023` | `seed_acceso` | **Datos, no esquema.** Reglas de retención de §5.1 con sus marcas de validación; parámetros de H.3; versión 1 de los documentos de B.1 y del texto del art. 6 de B.2/B.3; buzones de rol de D.8; y las cuentas de demostración (§6.5). | Sí, `DELETE` por origen `SEED`. |

**Lo que Prisma no expresa y va como SQL crudo dentro de estas migraciones:**
columnas generadas, claves foráneas compuestas contra columnas de estado,
índices únicos parciales, disparadores de restricción diferidos, particionado
nativo, RLS y `REVOKE` a nivel de columna. Es la misma consecuencia que la 004
§6.4 ya registró y aceptó en G2; se repite acá porque en esta feature **la
mayoría de las invariantes que importan viven en ese SQL**, no en el DSL.
`schema.prisma` pasará a declarar `schemas = ["motor", "acceso", "auditoria"]` y
seguirá sin declarar `identidad`.

### 6.3 Reversibilidad y bloqueo

Base sin datos de esta feature: **bloqueo nulo**. Todas las migraciones son
`CREATE`. Cada una lleva su `reversion.sql`, igual que las dos ya escritas.

A partir de la primera entrega a un entorno, la regla habitual: una migración
que borra una columna con datos se parte en dos despliegues (dejar de escribir,
después borrar) y **ninguna migración destructiva se aplica sin G6**. La
migración `0018` es la única con costo futuro: agregar particiones es barato,
pero cambiar la clave de partición de una bitácora grande no lo es. Por eso se
decide ahora y no después.

**Nota de honestidad sobre mi criterio de "terminado".** Mi mandato dice que la
migración tiene que estar *probada contra datos de ejemplo*. **Todavía no lo
está, porque todavía no existe.** Se escribe y se prueba después de G2, contra
el seed de `0023`.

### 6.4 Impacto sobre el `schema.prisma` vigente

Ninguno destructivo. Se agregan dos esquemas a `datasource.schemas` y los
modelos de los bloques A a H. **No se toca una línea del Bloque A de la 004.**
El encabezado del archivo, que hoy declara "alcance de este archivo hoy: Bloque
A", se actualiza para nombrar los dos alcances.

### 6.5 Datos de demostración (`prisma/seed.ts`)

Entregable de mi mandato; se escribe después de G2. Coherente para los tres
portales y **generado, nunca real** (R-05 de la 001):

- Un `CLIENTE` confirmado, sin MFA (CA-39), con aceptaciones versionadas y dos
  sesiones, una abierta y una cerrada.
- Un `ABOGADO` verificado con evidencia completa y `vigenciaHasta` a 10 meses,
  con MFA activo (CA-38); y **un segundo abogado en
  `PENDIENTE_DE_VERIFICACION_PROFESIONAL` con el plazo vencido**, para que la
  cola de CA-31 tenga contenido el primer día.
- Un `ADMINISTRADOR` nominal con su designación, su documento y su evento
  `ADMINISTRADOR_SEMBRADO`, con MFA activo. La cuenta de siembra queda
  `nominalizadaEn` en el propio seed: el estado "siembra viva" no se distribuye.
- Una cuenta `NO_VERIFICADA` con fecha vieja, para que la purga de CA-28 tenga
  qué purgar en la primera corrida.
- Eventos de auditoría de cada uno, para que "mi actividad reciente" de CA-10 de
  la 001 muestre sólo lo propio.

Idempotente: correrlo dos veces no duplica nada.

---

## 7. Integridad

### 7.1 Invariantes de la spec que quedan garantizadas por la base

Cada fila dice qué criterio se vuelve **imposible de violar** y con qué mecanismo.

| # | Criterio | Mecanismo | Qué queda imposible |
| --- | --- | --- | --- |
| **R-002-01** | **CA-32, CA-38** | `CHECK (rol = 'CLIENTE' OR estadoCuenta <> 'ACTIVA' OR estadoMfa = 'ACTIVO')` en A.1 | Una cuenta de administrador o de abogado operativa sin segundo factor. |
| **R-002-02** | **CA-32** | Clave foránea compuesta `SecretoTotp(usuarioId, rolDelTitular) → Usuario(id, rol)` `ON UPDATE RESTRICT` + `CHECK (rolDelTitular NOT IN ('ADMINISTRADOR','ABOGADO') OR desactivadoEn IS NULL)` + `CHECK` de A.5 sobre `mfa.desactivar.propio` | Desactivar el segundo factor de un administrador —por configuración, por ajuste individual de permiso, o degradando el rol para esquivarlo. **Las tres vías, cerradas en la base.** |
| **R-002-03** | **CA-33, CA-34** | Clave foránea compuesta `(usuarioId, esAdministrador) → Usuario(id, esAdministrador)` con columna generada + `CONSTRAINT TRIGGER … DEFERRABLE` de participación total + el mismo disparador exigiendo el `EventoAuditoria` en la transacción | Una cuenta `ADMINISTRADOR` sin persona designada, y crear un administrador sin que quede auditado. Cierra D-002-06. |
| **R-002-04** | **CA-33** | Disparador `BEFORE INSERT` contra D.8 `CorreoDeRolProhibido`, por índice ciego | Crear `admin@`, `soporte@`, `info@` como cuenta administradora, **aunque el correo esté cifrado**. Límite: sólo la lista enumerada (§7.3). |
| **R-002-05** | Recaudo C-2 | `CREATE UNIQUE INDEX ON DesignacionDeAdministrador ((esSiembra)) WHERE esSiembra` + disparador diferido al insertar la segunda designación | Más de una cuenta de siembra en toda la vida de la base, y que la siembra siga viva después de la primera cuenta nominal. |
| **R-002-06** | **CA-27, C-002-02** | Ausencia total de columna booleana + clave foránea compuesta a B.1 + disparador diferido "no hay cuenta `ACTIVA` sin aceptación de cada clase" + prueba de esquema en CI | Persistir `aceptoTerminos: true`. **La aceptación sin versión, hash, fecha e IP no es representable.** |
| **R-002-07** | **C-002-02** | `CHECK (incluyeFinalidadesDeLa003 = false)` en B.1 | Que los términos de la 002 arrastren consulta a bureaus, cesión a terceros o comunicaciones comerciales. |
| **R-002-08** | **CA-05, M-1** | `CHECK` de seis columnas de evidencia en C.1 | Aprobar una matrícula sin registrar qué constancia se vio, de qué colegio, con qué número y de qué fecha. |
| **R-002-09** | **CA-05, CA-29, M-6** | `CHECK ((resultado='APROBADA') = (vigenciaHasta IS NOT NULL))` en C.1 | Un "verificado" sin fecha de vencimiento. |
| **R-002-10** | **CA-28** | Los dos `CHECK` de lápida en A.1 (invariante 3) | Una cuenta purgada que conserve datos personales, y una cuenta viva sin correo. |
| **R-002-11** | **Constitución #5**, punto 10 del encargo | Clave foránea `EventoAuditoria.sujeto` y `.titularAfectado → Usuario` `ON DELETE RESTRICT` | Borrar físicamente una cuenta y dejar huérfana la bitácora. |
| **R-002-12** | **Constitución #5** | `REVOKE UPDATE, DELETE` + disparador `BEFORE UPDATE OR DELETE` en G.1 + sello de Merkle firmado de G.2 | Alterar la bitácora, y alterarla **sin dejar rastro detectable** incluso con acceso de escritura a la base. |
| **R-002-13** | **CA-10, CA-11** | `UPDATE … WHERE usadoEn IS NULL RETURNING` (comparación e intercambio atómica) + `UNIQUE (familiaId, generacion)` + `CHECK (sucesorId IS NULL OR usadoEn IS NOT NULL)` | Que dos peticiones concurrentes canjeen el mismo refresco, o que una reutilización pase por rotación legítima. |
| **R-002-14** | CA-06, CA-16, CA-17 | Mismo mecanismo sobre D.7 | Usar dos veces un enlace de un solo uso. |
| **R-002-15** | **C-002-03**, constitución #11 | Clave foránea compuesta `EjecucionDePurga(clave, accionDeLaRegla) → ReglaDeRetencion(clave, accion)` + `CHECK (accionDeLaRegla <> 'A_DETERMINAR')` | Ejecutar una purga bajo un plazo que el estudio todavía no determinó. **Destruir por error es irreversible; el bloqueo apunta para ese lado.** |
| **R-002-16** | **CA-38, CA-32** | Clave foránea compuesta `Sesion(usuarioId, rolDelTitular) → Usuario(id, rol)` + `CHECK` sobre `nivelAutenticacion` | Una sesión de abogado o de administrador abierta con un solo factor. |
| **R-002-17** | **CA-04, D-002-02** | **Ausencia deliberada** de `UNIQUE` sobre `indiceCiegoCuit` | Que el fallo de un `INSERT` le revele a un tercero que ese CUIL ya tiene cuenta. *Una restricción que no se pone, documentada para que nadie la agregue.* |
| **R-002-18** | CA-05, §7 de la spec | `UNIQUE (jurisdiccion, matricula) WHERE tieneVerificacionAprobada` | Dos cuentas **verificadas** con la misma matrícula, sin impedir que dos la *declaren*. |
| **R-002-19** | CA-24 | Disparador de inmutabilidad sobre `matricula` y `jurisdiccion` una vez existe decisión aprobada | Que un abogado se autoedite la matrícula ya verificada. |
| **R-002-20** | **CA-35, ADR-027** | `CHECK (instruidaPor <> aprobadaPor)` + `CHECK (estado <> 'APROBADA' OR ambos NOT NULL)` en E.3 | Que una sola persona restituya por sí sola el segundo factor de un administrador. |
| **R-002-21** | **Constitución #12** | `UNIQUE (claveIdempotencia)` en C.1, C.2, C.4, A.5, A.6, D.7, E.3, F.1, H.2; PK de C.3 y de D.9 | Doble aprobación de matrícula, doble suspensión, doble escalamiento, doble aviso por correo, doble purga. |
| **R-002-22** | **D-002-10** | `clasificacion NOT NULL` en G.1 + `validarRegistroDeRecursos` que impide arrancar si falta un tipo de recurso | Un evento de auditoría sin clasificación, y un sistema que arranque degradando a permisivo. |
| **R-002-23** | R-03, D-002-11 | `crearIdOpaco` rechaza valores con forma de dato identificatorio; los `id` son `TEXT` sin estructura | Un identificador que sea el CUIL o el correo disfrazado. |

### 7.2 Mutabilidad: el inventario completo

Las **únicas** columnas que admiten `UPDATE` en todo el modelo:

| Tabla | Columnas | Por qué |
| --- | --- | --- |
| A.1 `Usuario` | `correo*`, `nombre*`, `hashContrasena`, `estadoCuenta`, `estadoMfa`, `confirmadoEn`, `actualizadoEn`, `purgadaEn`, `motivoPurga`, `eliminadoEn`, y los `…IdClave` en rotación | Es la única tabla verdaderamente mutable de la feature: la cuenta cambia. El historial de lo que le pasó está íntegro en la bitácora. |
| A.2 `IdentificadorFiscal` | `vigente` | El valor nunca se edita: se reemplaza con linaje. |
| A.3 `PerfilProfesional` | `ultimaDecisionId`, `tieneVerificacionAprobada`, `colegioDeclarado` | Proyecciones para indexar (A.3 invariante 3) y un dato declarativo. `matricula` y `jurisdiccion` **no** están acá: son inmutables tras la aprobación. |
| A.4, A.5, A.6 | `retiradaEn` / `revocadoEn` / `resultado`, `resueltaEn` | Baja lógica y cierre. |
| B.4 `AceptacionRegistrada` | `revocadaEn` | La revocación se registra; la aceptación no se borra. |
| C.2 `SuspensionDeMatricula` | `levantadaEn`, `levantadaPor`, `motivoLevantamiento` | Cierre. La suspensión en sí no se edita. |
| C.4 | `resueltoEn`, `resueltoPor` | Cierre. |
| D.1 `Sesion` | `ultimoUso`, `cerradaEn`, `motivoCierre` | Ciclo de vida. |
| D.2, D.3, D.7 | `invalidadaEn`/`motivoInvalidacion`; `usadoEn`, `sucesorId`, `revocadoEn`; `usadoEn`, `invalidadoEn` | Rotación y consumo. |
| D.4 | `consumidoEn`, `intentosDeSegundoFactor` | Ciclo de vida. |
| D.6 `BloqueoDeTrafico` | `hasta`, `intentosContados`, `notificadoEn`, `envioId` | Ventana deslizante. |
| D.9 | `enviadoEn`, `resultado`, `intentos`, `idDelProveedor` | Reintentos. |
| E.1 `SecretoTotp` | `estado`, `confirmadoEn`, `desactivadoEn`, `ultimoPasoConsumido`, y el secreto en rotación de clave | Inscripción, confirmación y anti-replay. |
| E.2 | `consumidoEn`, `invalidadoEn` | Consumo. |
| E.3 | `estado`, `esperaHasta`, `instruidaPor`, `aprobadaPor`, los cuatro de verificación, `documentacionDestruidaEn`, `resueltaEn` | Ciclo de vida del caso de soporte. |
| F.1 | `nominalizadaEn`, `deshabilitadaEn` | Recaudo C-2. |
| H.1 | `plazoSegundos`, `accion`, `validadoPor`, `validadoEn` | Es la tabla que el estudio completa cuando firme. |

**Sin `UPDATE` ni `DELETE`, nunca:** B.1, B.2, B.3, C.1, C.3, D.5, G.1, G.2,
H.2. `REVOKE UPDATE, DELETE` al rol de aplicación más disparador que lanza
excepción. Se verifica con una prueba que intenta un `UPDATE` sobre cada una y
**espera el error**.

> **Corregido en la implementación — ver la nota N-1 del encabezado.** B.1 y
> B.2 sí admiten `UPDATE` de `vigenteHasta` y de nada más: sin eso ninguna
> versión de documento podría cerrarse nunca y el catálogo quedaría con varias
> vigentes a la vez. D.5 admite `DELETE` (su retención son 7 días y no está
> particionada); el `UPDATE` le sigue estando prohibido, que es la invariante
> real.

### 7.3 Invariantes que quedan en la aplicación (y por qué)

Se listan porque son el riesgo residual del modelo. Cada una con su test
obligatorio.

| Invariante | Por qué la base no la expresa | Cómo se cubre |
| --- | --- | --- |
| **CA-36 / A-1: el bloqueo por intentos fallidos nunca inhabilita la recuperación de contraseña.** | Es la **ausencia** de una consulta. Ninguna restricción puede exigir que un camino no lea una tabla. | El bloqueo no cuelga de `Usuario`, así que no aparece al leer la cuenta. Test obligatorio: cuenta bloqueada por CA-09 + pedido de recuperación ⇒ funciona. Es el test que el dictamen pide literalmente. |
| **CA-11: la reutilización cierra TODAS las sesiones de la cuenta.** | La base corta la familia de refresco (R-002-13); "todas las sesiones de la cuenta" es una operación sobre otras filas. | Transacción única en `apps/api` + test. |
| **CA-02, CA-04, CA-15: la respuesta no revela existencia.** | Es una propiedad de la respuesta HTTP, incluidos su tamaño y su latencia. La base no la ve. | `RespuestaUniforme` y `PresupuestoDeLatencia` del contrato (§9, §14) + test de latencia comparada. |
| **Rechazo de buzones de rol fuera de la lista enumerada.** | El correo está cifrado: la base no puede inspeccionar la parte local. R-002-04 sólo cubre lo precalculado en D.8. | Validación de dominio en `packages/shared` (contrato §15) + revisión del script de siembra en G4. |
| **El decisor de una verificación tenía el permiso `matricula.verificar`.** | Requiere evaluar el conjunto de permisos derivado, que depende del instante. | `Autorizacion<'matricula.verificar', …>` del contrato: la capa de persistencia no acepta escribir sin la prueba. Queda auditado en G.1. |
| **CA-19: el abogado sólo alcanza los casos asignados.** | La tabla de asignación es de las features 008/012/013. | El modelo deja `PerfilProfesional.jurisdiccion` y el permiso `caso.recibirAsignacion` para que el control exista (M-7, D-002-07). **Dependencia declarada.** |
| **El texto del art. 6 dice lo que tiene que decir.** | La base garantiza que **existe** y que está versionado; no puede leer si es claro y completo. | Revisión de `ux-expert` + ratificación del abogado (C-002-01). |
| **R-10: la siembra no usa credenciales en variables de entorno.** | Es una propiedad del script. | Revisión en G4 (el dictamen lo asigna ahí). |

### 7.4 Aislamiento multi-perfil (regla 7 del mandato)

RLS activada con `FORCE ROW LEVEL SECURITY` —para que el dueño de la tabla
tampoco se saltee las políticas— en A.1 a A.6, B.4, C.1 a C.4, D.1 a D.7, E.1 a
E.3, F.1 y G.1.

| Rol | Política |
| --- | --- |
| `rol_acceso` | Rol de aplicación. Acceso completo sujeto a las políticas; la identidad del sujeto entra por `current_setting('app.id_usuario')`. **Sin privilegio sobre `identidad` ni sobre las tablas del Bloque B de `motor`.** |
| `rol_cliente` | `USING (usuarioId = current_setting('app.id_usuario'))` en todas sus tablas. Sin acceso a A.3, C.1 a C.4, F.1. Sin `SELECT` sobre las columnas de §4.4. |
| `rol_abogado` | Igual sobre lo propio, más `SELECT` sobre su `PerfilProfesional`, sus decisiones y sus suspensiones. **No ve a otros usuarios.** El alcance a casos es de 008/012/013. |
| `rol_admin` | `SELECT` sobre A.1 (metadatos), A.3, C.1 a C.4, F.1, y `INSERT` sobre C.1, C.2, F.1. **Sin acceso a `hashContrasena`, `SecretoTotp.secretoCifrado`, `CodigoDeRespaldo.hashDelCodigo` ni a los hashes de token** (`REVOKE` a nivel de columna). El administrador gestiona cuentas, no lee credenciales. |
| `rol_auditoria` | `SELECT` sobre todo, `INSERT` en ningún lado, y cada lectura genera su propio evento. |
| `rol_identidad` | **Sin cambios.** Sigue siendo el único con acceso al esquema `identidad`, que esta feature no toca. |

La diferencia con la 004 es que allá el aislamiento se apoyaba en
`AsignacionProfesionalCaso`; acá la relación es más simple —cada quien ve lo
suyo— y por eso la política cabe en una línea. Lo que **no** cambia es el
criterio: la restricción se escribe en la base, no sólo en el servicio.

### 7.5 Nota sobre el dinero

**No aplica.** No hay un solo importe en esta feature: ni suscripción, ni
comisión, ni honorario. La regla 1 de mi mandato y ADR-011 se aplican desde la
feature que introduzca el primer peso. Se dice explícitamente para que la
ausencia sea una decisión verificada y no un olvido.

---

## 8. Escalamientos

Conforme a mi mandato, no modelo un dato cuya base legal no está clara. Estos
ocho puntos van al orquestador; los tres primeros son para `compliance-legal` y
el humano, los demás son de coordinación.

| # | Qué | Por qué no lo resuelvo yo | Estado en el modelo |
| --- | --- | --- | --- |
| **E-002-1** | **Finalidad del CUIT/CUIL.** La condición C-002-04(a) exige declararla o diferir el dato; la spec v3 cerró la no-revelación (b) y **dejó abierta la (a)**. D-002-01 sigue vivo. | Declarar una finalidad es declarar una base legal, y el dictamen dice `[!] sin finalidad declarada no hay base legal que evaluar`. | **A.2 diseñada en tabla separada; la migración `0022` no se ejecuta y ningún camino de alta la escribe.** Diferirlo a la 007 es `DROP TABLE`; habilitarlo es cargar su fila en B.3 con carácter y finalidad, y correr `0022`. Ninguna otra tabla la referencia. |
| **E-002-2** | **Documentación del circuito de restitución de MFA** (CA-35, C-002-12). Qué se pide, con qué base legal, quién la ve, cuánto se conserva, cómo se destruye. | Es el tratamiento más intrusivo de la feature —la imagen de un DNI— y no tiene base legal escrita. El contrato mismo declara `'A_DEFINIR_EN_G2'`. | **E.4 no se crea.** E.3 registra la constancia del hecho, no el dato. **Consecuencia operativa a mirar en la compuerta:** con MFA obligatorio para dos roles y sin este circuito, hay cuentas potencialmente irrecuperables. |
| **E-002-3** | **Cuatro plazos de conservación en `A_DETERMINAR`**: aceptación, verificación profesional, bitácora y cuenta dada de baja. | El dictamen §5.B los deja `[D]`. Fijar un plazo de destrucción por mi cuenta es decidir cuándo se destruye prueba. | Filas presentes en H.1 con `accion = 'A_DETERMINAR'`, y **R-002-15 impide materialmente que se ejecute la purga**. El de verificación profesional es **el mismo escalamiento E-2 que la 004 dejó abierto**: conviene resolverlos en una sola consulta al estudio. |
| **E-002-4** | **Edad del titular** (D-002-08). La spec no dice nada. | CCyC arts. 24 a 26 `[P]`; el dictamen deja `identidad.edadMinima` en `[D]` y pregunta qué pasa con el adolescente de 16/17 con deuda propia. | **No modelo fecha de nacimiento ni booleano de mayoría de edad.** Si el product owner decide exigir una declaración, la forma correcta **no es un booleano**: es otra fila de B.4 contra una versión de documento, por la misma razón de C-002-02. Una columna, ninguna tabla nueva. |
| **E-002-5** | **Dos bitácoras.** `motor.BitacoraAcceso` (004 §C.5) y `auditoria.EventoAuditoria` (002 G.1) son lo mismo con dos formas. | Unificarlas toca un G2 ya aprobado, y eso no lo decido yo. | Las dos coexisten en el modelo. **`motor.BitacoraAcceso` todavía no está implementada** (tareas T-06/T-09 de la 004): hay tiempo de decidir antes de que existan datos. Con dos registros, "quién vio mis datos" se responde con dos consultas que pueden discrepar. |
| **E-002-6** | **Cifrado del correo y del nombre para mostrar** (decisión D-4). | Tiene costo real y es una decisión de producto además de técnica. | **Propuesto y adoptado en este modelo.** Lo que cuesta: toda búsqueda por igualdad pasa por el índice ciego; no hay búsqueda por subcadena ni por nombre en el panel de CA-22 sin agregar un índice ciego más; `k_indice` no rota sin recalcular. Lo que compra: un volcado de la base sin las claves **no produce la lista de clientes de una plataforma de gestión de deudas**, que es la inferencia patrimonial del dictamen §2.2(c). **Se ratifica o se rechaza en G2.** |
| **E-002-7** | **`BLOQUEADA_TEMPORALMENTE` es derivado, no almacenado.** El contrato lo pone en `EstadoCuenta`; este modelo lo prohíbe como valor de columna. | Es coordinación con el `arquitecto`, no un cambio de contrato: el dominio sigue viendo el estado. | `Usuario.estadoCuenta` no lo admite; se deriva de D.6 al armar el `PerfilDeAutorizacion`. Almacenarlo obligaría a tener fila para cuentas inexistentes, que es el oráculo que ADR-025 evita. |
| **E-002-8** | **Rectificación de un CUIT/CUIL mal cargado** (D-002-04). CA-23 la menciona, ninguna CA define el proceso. Art. 16, cinco días hábiles `[C]`. | Definir un proceso de rectificación es alcance, no modelo. | A.2 es append-only con `reemplazaA` y `vigente`: **el modelo deja la rectificación posible sin implementarla.** Si la 003 la diseña, no hay migración de datos. |

---

## 9. Trazabilidad criterio → modelo

| Criterio | Dónde se sostiene |
| --- | --- |
| CA-01 | A.1 (`estadoCuenta = NO_VERIFICADA`), D.7, D.9, Q-15 |
| CA-02 | A.1 `uq_usuario_correo`, A.6 `ResolucionDeDuplicado`, D.9 con su idempotencia |
| CA-03 | Sin persistencia: política pura del contrato §6. La base sólo guarda el hash |
| CA-04 | A.2 con **índice no único** (R-002-17), A.6, `indiceCiegoCuit`, `digitoVerificadorValidado`. **Condicionado por E-002-1** |
| CA-05 | C.1 con R-002-08 y R-002-09; A.3 `solicitadaEn` |
| CA-06, CA-17 | D.7 con canje atómico (R-002-14) |
| CA-07 | D.1, D.2, D.3, G.1 (`INGRESO_EXITOSO`) |
| CA-08 | D.4 con `usuarioId` anulable, E.1, E.2 |
| CA-09, CA-37 | D.5, D.6, H.3 (parámetros 5 / 15 min / 15 min) |
| CA-10 | D.3, R-002-13 |
| CA-11 | D.2 `invalidadaEn`, R-002-13, §7.3 (cierre de todas las sesiones) |
| CA-12 | Sin persistencia. La distinción vive en G.1 (`motivo`), no en la respuesta |
| CA-13 | D.1 (`ubicacion*`, `dispositivo*`), Q-04 |
| CA-14 | D.1 `cerradaEn` + `IndiceDeRevocacion` del contrato; el token no lleva permisos |
| CA-15, CA-16 | D.7, D.1 (cierre masivo), D.9 |
| CA-18 | `mapaRolPermisos` del contrato + A.5 `AjustePermiso` |
| CA-19 | **Fuera de alcance de datos de la 002.** A.3 `jurisdiccion` + permisos `caso.*` dejan el control posible (M-7, D-002-07) |
| CA-20 | §7.4 (RLS) + contrato §3 |
| CA-21 | G.1 completo, con `clasificacion NOT NULL` (R-002-22) y §4.1 como la clasificación que D-002-10 reclamaba |
| CA-22 | Q-18, C.1, §7.4 (`rol_admin` sin acceso a credenciales) |
| CA-23 | A.1 mutable; A.2 append-only con linaje (E-002-8) |
| CA-24 | A.3 invariante 2 (R-002-19), A.4 |
| CA-25 | Q-12, Q-21, §4.4 (`REVOKE` de columnas) + `SinSecretos` del contrato |
| CA-26 | B.2, B.3 con el disparador de completitud de campos |
| CA-27 | B.1, B.4, **R-002-06** y **R-002-07** |
| CA-28 | A.1 lápida (R-002-10), H.1, H.2, §5.3, Q-15 |
| CA-29 | C.1 `vigenciaHasta` + derivación en cada lectura (D-2) + C.3 + Q-09 |
| CA-30 | C.2 + ausencia de permisos en el token: el efecto es inmediato porque no hay caché |
| CA-31 | A.3 `solicitadaEn` + C.4 + Q-10 + `motor.DiaNoHabil` |
| CA-32 | **R-002-01, R-002-02, R-002-16** y el `CHECK` de A.5. Cuatro capas, §E.1 |
| CA-33, CA-34 | **R-002-03, R-002-04, R-002-05**. F.1, D.8, Q-14 |
| CA-35 | E.3 con **R-002-20** (cuatro ojos). **E.4 escalada: E-002-2** |
| CA-36 | §7.3 — no expresable en la base, con su test obligatorio |
| CA-38 | R-002-01, R-002-16 |
| CA-39 | E.1 (opcional para cliente) + D.1 `autenticadaEn` (recaudo B-3) |
| C-002-01 | B.2, B.3 |
| C-002-02 | R-002-06, R-002-07 |
| C-002-03 | H.1, H.2, R-002-15, §5 |
| C-002-04 | R-002-17 + escalamiento E-002-1 |
| C-002-06 | A.6, D.9 con idempotencia |
| C-002-07 | Bloque C completo |
| C-002-08 | R-002-01, R-002-02 |
| C-002-09 | R-002-03 a R-002-05 |
| C-002-10 | §4.1 (IP, ubicación, dispositivo), D.1, D.9 `modo` |
| C-002-12 | E.3 + escalamiento E-002-2 |
| Constitución #5 | §4 completo, G.1, G.2, §5.4, §7.4 |
| Constitución #11 | H.1 y H.3: ningún plazo ni umbral es una constante |
| Constitución #12 | R-002-21 |
| Constitución #13 | CA-36 en §7.3: nadie queda sin salida |
| Plan 001 §5.3 | §0.3 — reconciliación entidad por entidad |
