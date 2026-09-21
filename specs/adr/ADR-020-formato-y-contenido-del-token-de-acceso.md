# ADR-020 — Formato y contenido del token de acceso: JWT corto firmado con EdDSA, sin rol y sin permisos

| Campo | Valor |
| --- | --- |
| Estado | PROPUESTO |
| Fecha | 2026-09-21 |
| Autor | arquitecto |
| Aprobado por | pendiente — G2, feature 002 |
| Spec de origen | `specs/002-identidad-y-acceso/spec.md` v3 (CA-07, CA-12, CA-14, R-03) |
| Dictamen | `cumplimiento.md` D-002-11 (el token no lleva CUIT/CUIL ni correo) |
| Contrato | `specs/contratos/identidad-y-acceso.ts` §7 |

## Contexto

R-03 fija el techo: *"el token de acceso no lleva datos patrimoniales sensibles
en su contenido, sólo identidad (como identificador opaco) y permisos"*. El
defecto D-002-11 corrige la ambigüedad de "identidad": tiene que ser un
identificador opaco, nunca el CUIT/CUIL ni el correo, porque un token se loguea
en un proxy, se cachea en un service worker y aparece en un informe de error.

Pero hay una segunda mitad del problema que la spec no vio y que este ADR
resuelve en sentido contrario a la letra de R-03: **los permisos tampoco pueden
ir adentro**. CA-30 exige que la suspensión de una matrícula bloquee toda acción
del abogado *de inmediato*, y CA-14 exige que un cierre de sesión a distancia
deje de aceptar los tokens *sin esperar a su vencimiento natural*. Un permiso
grabado en un token firmado sobrevive a su revocación hasta que el token vence.
Con permisos adentro, "inmediato" pasa a significar "dentro de los próximos diez
minutos", y eso no es lo que dice el criterio.

El contexto heredado es otro empujón en la misma dirección: `docs/02-arquitectura.md`
—material anterior a la adopción de SDD— describe *"JWT con rol y permisos"*, y
el plan de la 001 §5.1 declara las variables `JWT_ACCESS_SECRET` y
`JWT_REFRESH_SECRET`, es decir, firma simétrica con secreto compartido. Las dos
cosas se reemplazan acá, y hay que decirlo en voz alta porque la segunda fue
aprobada en G2 de la 001.

## Decisión

**El token de acceso es un JWT compacto de diez minutos, firmado con EdDSA
(Ed25519), que contiene un identificador opaco de usuario, un identificador de
sesión y el nivel de autenticación. Nada más. Los permisos se derivan en cada
petición (ADR-022) y la vigencia de la sesión se consulta en cada petición
(ADR-021).**

1. **Contenido cerrado.** `ContenidoTokenDeAcceso` tiene exactamente diez
   campos: `iss`, `aud`, `sub`, `sid`, `jti`, `iat`, `nbf`, `exp`, `aut` y
   `auth_time`; la cabecera aparte lleva `alg`, `typ` y `kid`. `sub` es un `IdUsuario`
   (`IdOpaco<'usuario'>`, ULID sin significado); `sid` es la sesión.
2. **Lo que NO lleva, y no se agrega sin ADR de reemplazo:** correo, nombre,
   CUIT/CUIL, rol, lista de permisos, matrícula, jurisdicción, estado de
   verificación profesional, IP, ubicación, dispositivo, y cualquier dato
   patrimonial de cualquier feature futura. Un test de forma sobre la interfaz
   del contrato falla si aparece un campo nuevo en cualquiera de las dos.
3. **`typ: 'at+jwt'`** (RFC 9068) y `aud: 'mejorar-api'`: un token de acceso no
   puede confundirse con un token de otra clase ni presentarse a otro receptor.
4. **EdDSA con par de claves por entorno, no secreto compartido.** La API firma
   con la privada; cualquier componente que sólo necesite verificar usa la
   pública publicada en un JWKS interno. Con HS256, todo el que verifica puede
   emitir; con Ed25519, no. Dos claves activas en el JWKS (`kid` vigente y
   `kid` siguiente) permiten rotar sin ventana de caída. Rotación cada 90 días,
   y rotación inmediata ante sospecha.
5. **Vida corta y explícita.** Acceso: **10 minutos**, igual para los tres
   roles. Refresco: ventana de inactividad y vida absoluta **por rol**, porque
   el riesgo de los tres roles es distinto (art. 9, adecuación al riesgo):

   | Rol | Inactividad | Vida absoluta |
   | --- | --- | --- |
   | `CLIENTE` | 14 días | 90 días |
   | `ABOGADO` | 3 días | 14 días |
   | `ADMINISTRADOR` | 8 horas | 7 días |

   Son parámetros de producto, no normativos (dictamen §5.C, `token.vidaAcceso`
   / `token.vidaRefresco`). Se cambian sin revisión legal.
6. **`nbf` e `iat` obligatorios, tolerancia de reloj de 30 segundos como
   máximo.** No se acepta un token sin `exp`. No se acepta `alg: none` ni
   ningún algoritmo que no sea el declarado: la verificación fija el algoritmo
   por configuración y **no** lo lee de la cabecera del token.
7. **`auth_time` y `aut`** viajan firmados porque sostienen CA-39/recaudo B-3:
   desactivar el segundo factor exige reautenticación fuerte, y la ventana de
   reautenticación se mide contra un dato que el cliente no puede falsificar.
8. **Transporte.** Web: el token de acceso vive en memoria del cliente (nunca
   en `localStorage`), y el de refresco viaja en cookie `HttpOnly; Secure;
   SameSite=Strict` con `Path` acotado al endpoint de refresco, más token
   anti-CSRF de doble envío. Móvil: ambos en el almacenamiento seguro del
   dispositivo, responsabilidad de `dev-mobile` en su feature. Por eso
   `PeticionDeRefresco.refresco` es anulable en el contrato: en la web viene por
   la cookie y no por el cuerpo.
9. **Rechazo indistinguible (CA-12).** Vencido, inválido, firma incorrecta,
   sesión revocada y `kid` desconocido producen todos `401` con el mismo cuerpo.
   La distinción existe sólo en la bitácora interna, con `idCorrelacion`.

### Verificación

`tester`: un test por cada uno de CA-07, CA-12 y CA-14; un **test de forma** que
enumera las claves de `ContenidoTokenDeAcceso` y falla si aparece cualquiera que
no esté en la lista de diez; un test que toma un token válido, le cambia `alg` a
`none` y a `HS256` con la clave pública como secreto, y verifica que los dos se
rechazan; un test de que la suspensión de matrícula (CA-30) tiene efecto en la
**petición siguiente**, sin esperar el vencimiento.

## Alternativas consideradas

| Alternativa | A favor | En contra | Por qué no |
| --- | --- | --- | --- |
| **Token opaco + búsqueda de sesión en cada petición** (sin JWT) | Revocación trivial; nada que filtrar en el contenido; el más simple de razonar | Igual hay que verificar vigencia en cada petición, así que la diferencia real es menor de lo que parece; pierde la verificación local barata del vencimiento y de la firma, y obliga a ir al almacén incluso para rechazar basura | Es la alternativa más cercana y casi gana. Pierde por tres cosas: el rechazo de un token vencido o adulterado no toca el almacén (resistencia a inundación), el cliente puede anticipar el refresco leyendo `exp`, y `auth_time`/`aut` llegan firmados y no dependen de la integridad de una caché |
| JWT con permisos adentro (lo que dice R-03 y `docs/02`) | Cero consultas por petición para autorizar | Un permiso revocado sobrevive hasta el vencimiento: contradice CA-14 y CA-30 | Es incompatible con dos criterios aprobados. Se descarta y se documenta el apartamiento de R-03 |
| JWT con el rol adentro | Barato para enrutar la interfaz | Invita a autorizar por nombre de rol, que es exactamente lo que CA-18 y R-07 prohíben; y la interfaz ya sabe su rol por `GET /identidad/yo` | El tipo no ofrece el rol justamente para que no se pueda (ADR-022) |
| HS256 con secreto compartido (lo aprobado en el plan 001 §5.1) | Ya declarado, un solo secreto | Todo el que verifica puede emitir; rotar obliga a coordinar todos los consumidores a la vez | Reemplazado. Se declara el cambio de la tabla de configuración de la 001 (plan 002 §8.4) |
| RS256 | Ubicuo, soportado por todo | Claves y firmas más grandes, más lento, y su superficie de errores de implementación (relleno) es mayor | Ed25519 es más chico, más rápido y sin parámetros que elegir mal. `jose` lo soporta en Node 22 sin dependencias nativas |
| Tokens de una hora para bajar el tráfico de refresco | Menos peticiones | Alarga la ventana de un token robado y la de un permiso revocado | Diez minutos con refresco rotado cuesta una petición extra cada diez minutos por sesión activa. Es barato |
| Proveedor de identidad externo (Auth0, Cognito, Keycloak) que emita el token | No se escribe nada de esto | El RBAC por recurso de CA-19 no lo da ninguno; los datos de identidad de todos los titulares pasan a un encargado de tratamiento con probable transferencia internacional (arts. 12 y 25); y el sistema tiene que correr sin credenciales | Descartado para toda la feature, ver `plan.md` §9 |

## Consecuencias

**Positivas**

- Un token robado y decodificado no dice quién es la persona ni qué puede
  hacer: dice un ULID. Cumple R-03 en su lectura más estricta y cierra D-002-11.
- La revocación es inmediata de verdad, sin asteriscos, y CA-14 y CA-30 se
  cumplen con el mismo mecanismo.
- Verificar un token no requiere estado compartido: el costo por petición es una
  verificación Ed25519 (decenas de microsegundos) más la consulta de revocación
  de ADR-021.

**Negativas**

- **Cada petición autenticada resuelve permisos** (ADR-022). Es trabajo por
  petición que un token con permisos adentro no tendría. Se acota con la caché
  invalidada por versión de ADR-022 y con el presupuesto de 8 ms del plan §6.
- Hay un JWKS y una rotación de claves que administrar. Es trabajo de `cicd`
  (obligación F-11) y no existía antes.
- La configuración aprobada en G2 de la 001 cambia: desaparecen
  `JWT_ACCESS_SECRET` y `JWT_REFRESH_SECRET` y aparecen la clave privada
  Ed25519, el `kid` vigente y la pimienta de ADR-024.

**Qué cierra**

- Poner cualquier atributo de la persona dentro del token.
- Autorizar leyendo el token sin consultar el estado actual de la cuenta.

## Cómo se revierte

- **Volver a token opaco**: costo bajo (uno o dos días). El borde ya consulta el
  índice de revocación en cada petición; habría que reemplazar la verificación
  de firma por una búsqueda y quitar el JWKS. Nada del dominio cambia, porque el
  dominio no conoce el formato del token.
- **Meter permisos en el token**: técnicamente trivial y **prohibido** sin ADR
  de reemplazo y sin revisar CA-14 y CA-30 en compuerta. El test de forma lo
  detiene.
- **Cambiar de EdDSA a RS256**: un día, con las dos claves conviviendo en el
  JWKS durante la transición. Es el camino si alguna vez hay que interoperar con
  una plataforma que no soporte Ed25519.
