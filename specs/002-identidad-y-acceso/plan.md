# Plan técnico 002 — Identidad y acceso

| Campo | Valor |
| --- | --- |
| Autor | arquitecto |
| Spec de origen | `specs/002-identidad-y-acceso/spec.md` **v3** (39 criterios de aceptación, aprobada en G1 — `REGISTRO-COMPUERTAS.md` entrada 046) |
| Dictamen | `specs/002-identidad-y-acceso/cumplimiento.md` — APTO CON CONDICIONES (12 condiciones, 14 defectos) |
| Estado | BORRADOR — para aprobación humana en G2 |
| Contrato | `specs/contratos/identidad-y-acceso.ts` (`identidad-y-acceso/v1`, revisión 1) |
| ADRs | ADR-020 a ADR-029 |
| Modelo de datos | `specs/002-identidad-y-acceso/modelo-datos.md` — lo produce `database-engineer` en paralelo. Este plan **no lo define**: declara qué necesita de él (§5) |
| Diseño | `specs/002-identidad-y-acceso/ux.md` — producido por `ux-expert`. Este plan lo respeta y no redefine ninguna pantalla |

---

## 1. Enfoque

Esta feature construye el control de acceso de todo lo que viene después. El
dictamen lo dice en una línea que conviene tener presente durante toda la
implementación: *"Un fallo de RBAC en la 002 expone los datos patrimoniales de
las features 007 en adelante."* Por eso la decisión central de este plan no es
qué algoritmo de hash ni qué formato de token, sino **cómo se vuelve imposible
saltearse el control**. La respuesta es la misma en las cinco piezas críticas:
la garantía no puede depender de que alguien se acuerde. Autorizar produce una
prueba tipada, y la capa de datos no acepta trabajar sin esa prueba (ADR-022);
la auditoría es un efecto de autorizar, no una línea que hay que escribir
(ADR-028); el MFA del administrador no se apaga porque no existe la clave que lo
apagaría (ADR-023); la recuperación de contraseña no se puede inhabilitar porque
el tipo sólo admite el literal `true` (ADR-025). Todo lo que en el código
parezca ceremonia de más, está pagando una de esas garantías.

La segunda idea que atraviesa el diseño es que **el sistema no debe afirmar lo
que no puede sostener**. Un token no lleva permisos, porque un permiso grabado
sobrevive a su revocación y CA-14 y CA-30 exigen efecto inmediato (ADR-020). Un
estado de matrícula no se guarda, porque un campo almacenado sigue diciendo
"vigente" cuando la tarea que debía actualizarlo no corrió (ADR-026). Una
aceptación de términos no es un booleano, porque un booleano no prueba nada
frente a la Ley 25.506 (contrato §10). Y ninguna respuesta de autenticación
revela si una persona tiene cuenta —ni por texto, ni por código, ni por tiempo,
ni por bloqueo—, porque en este producto eso es una inferencia sobre la
situación patrimonial de alguien (ADR-025).

La tercera es de proporción. Esta feature podría haber sido una integración con
un proveedor de identidad y no lo es, por razones que están en §9. Pero dentro
de lo que construimos, se elige lo aburrido: JWT y JOSE con `jose`, TOTP de RFC
6238, `argon2id` con los parámetros que recomienda OWASP, PostgreSQL y Redis que
ya están decididos. **No se agrega ninguna biblioteca de identidad, de permisos
ni de análisis de agente de usuario**: las tres cosas se resuelven con el
sistema de tipos y con código propio corto, y eso está justificado en ADR-022 y
ADR-029. De los cuatro terceros que la feature podía haber traído, tres se
resuelven localmente y queda uno solo por contratar (ADR-029), que es el mejor
resultado posible frente a los arts. 12 y 25 de la Ley 25.326.

---

## 2. Alcance técnico por componente

| Componente | Cambios | Agente responsable |
| --- | --- | --- |
| `packages/shared/src/identidad/**` | **Dominio puro.** Copia verificada del contrato; `derivarPermisos` y `mapaRolPermisos`; `decidirAcceso`; `derivarEstadoMatricula` y `claveDeExhibicionDeMatricula`; `evaluarPoliticaDeContrasena` y `normalizarContrasena`; `decidirBloqueo`; `exigeSegundoFactor`; `crearIdOpaco`; `verificarDigitoVerificadorCuit`. Sin framework, sin reloj, sin red. | `dev-dominio` |
| `packages/shared/src/identidad/contrato/v1.ts` | Copia byte a byte de `specs/contratos/identidad-y-acceso.ts` (ADR-017 aplicado a esta feature). | `dev-dominio` |
| `packages/integrations/src/identidad/**` | Puertos y adaptadores de ADR-029: correo transaccional (mock, SMTP local, proveedor), ubicación por IP con base local, descripción de dispositivo, lista local de contraseñas filtradas, reloj. **Mock determinista obligatorio en todos.** | `dev-integraciones` |
| `apps/api/src/autorizacion/**` | `autorizar`, `autorizarColeccion`, registro de tipos de recurso con validación de arranque, resolvedores de alcance, guarda que construye el `ContextoDeAcceso`, caché de perfil con versión. **Es el módulo más sensible de la feature.** | `dev-backend` |
| `apps/api/src/identidad/**` | Alta, confirmación, ingreso en dos pasos, refresco con rotación, recuperación, sesiones, perfil, exportación, segundo factor, restitución, back-office de usuarios y matrículas, guion de siembra de administrador. | `dev-backend` |
| `apps/api/src/auditoria/**` | Emisión del `EventoAuditoria` extendido, consulta por titular y por sujeto, sellado periódico y comando de verificación de sellos. Reemplaza el andamiaje de la 001. | `dev-backend` |
| `apps/api/prisma/**` | Todo el modelo de datos de la feature. **Lo define `database-engineer`** en `modelo-datos.md`; este plan sólo declara las obligaciones de frontera (§5). | `database-engineer` |
| `apps/web/**` | Los tres portales: pantallas de `ux.md` (AL, IN, RE, CL, AB, AD), cliente HTTP con renovación *single-flight*, manejo de `403` según CA-20. | `dev-web` |
| `apps/mobile/**` | **Fuera de alcance de esta feature.** Consume el mismo backend; el almacenamiento seguro del token y la biometría son de `dev-mobile` en su propia feature (spec §8). Queda declarada la obligación F-10. | `dev-mobile` (feature propia) |
| Tests | Un test nombrado por cada uno de los 39 criterios; los tests de forma que protegen ADR-020, ADR-022, ADR-023 y ADR-025; la prueba estadística de temporización; los tests de acceso cruzado entre roles. | cada `dev-*` los unitarios de su paquete; `tester` los de extremo a extremo y el veredicto de G5 |
| Pipeline | Verificación de identidad del contrato; *benchmark* de `argon2id` con umbrales que rompen la construcción; prueba de temporización; generación y custodia de claves Ed25519, pimienta y clave de sellado; actualización mensual de la base de geolocalización; suite completa sin ninguna credencial. | `cicd` |
| Textos | Microcopy, plantillas de correo y el bloque del art. 6, ya producidos en `ux.md`; falta la ratificación del abogado y los huecos de `ux.md` §11.1. | `ux-expert` + `compliance-legal` + estudio |

**Orden de ejecución sugerido para G3.** (1) dominio puro completo, que no
depende de nada y habilita todo lo demás; (2) modelo de datos y migraciones;
(3) módulo de autorización con su registro de recursos y la auditoría —antes que
cualquier endpoint, para que ningún endpoint nazca sin control—; (4) alta,
confirmación y recuperación con la respuesta uniforme; (5) ingreso, tokens y
sesiones; (6) segundo factor; (7) verificación de matrícula y back-office;
(8) restitución de segundo factor; (9) portales web; (10) retiro del andamiaje
de ingreso de la 001. Las corrientes (9) y (2)–(8) pueden avanzar en paralelo en
cuanto el contrato esté congelado.

---

## 3. Contratos

### 3.1 `specs/contratos/identidad-y-acceso.ts`

Versión `identidad-y-acceso/v1`, revisión 1 del documento. Unas 1436 líneas de
declaraciones, sin una sola implementación. Se revisó completo contra la spec v3
al escribir este plan: **no se encontró ninguna divergencia** con los 39
criterios ni con las 12 condiciones del dictamen, y la única corrección
aplicada fue una referencia cruzada equivocada en la regla de lectura 1, que
atribuía a ADR-022 la verificación de identidad del contrato en vez de a
`plan.md` §2 y a la obligación F-11. Ningún tipo cambió.

| § | Contenido | Criterios que sostiene |
| --- | --- | --- |
| 0-1 | Versión, identificadores opacos con guarda, instantes con marca nominal, `Resultado`, `ErrorIdentidad` | R-03, D-002-11, CA-12 |
| 2 | Roles, catálogo cerrado de 25 permisos, `mapaRolPermisos`, ajustes individuales, `derivarPermisos` | CA-18, CA-29, CA-30, CA-32, CA-38, R-07 |
| 3 | Autorización como capacidad: contexto sin rol, `Autorizacion`, `FiltroDeAlcance`, `decidirAcceso`, registro de recursos | CA-19, CA-20, CA-21, D-002-10 |
| 4 | Clasificación de datos, taxonomía cerrada de 33 acciones, `EventoAuditoria` extendido, sello de bitácora | CA-21, CA-22, CA-34 |
| 5 | Estados de cuenta y de verificación profesional, evidencia, jurisdicción, `derivarEstadoMatricula` | CA-01, CA-05, CA-24, CA-28 a CA-31 |
| 6 | Política de contraseñas, `argon2id`, puerto de lista de filtradas | CA-03, CA-16, R-02 |
| 7 | Tokens, familias de refresco, sesiones visibles, índice de revocación | CA-07, CA-10 a CA-14, R-03, R-06 |
| 8 | TOTP, códigos de respaldo, desafío de ingreso, restitución | CA-08, CA-32, CA-35, CA-38, CA-39 |
| 9 | Respuesta uniforme, clave de tráfico, política de bloqueo, enlaces de un solo uso, resolución de duplicados | CA-02, CA-04, CA-06, CA-09, CA-15 a CA-17, CA-36, CA-37, R-05 |
| 10 | Información del art. 6 y aceptación versionada | CA-26, CA-27 |
| 11 | Reglas de retención y purga | CA-28 |
| 12 | Exportación de datos propios con exclusión de secretos verificada por tipos | CA-25 |
| 13 | Puertos de terceros con mock obligatorio | CA-13, R-09 |
| 14 | Borde HTTP: peticiones, códigos admitidos, presupuesto de latencia | CA-12, CA-20 |
| 15 | Frontera con persistencia: índice ciego, consultas que exigen prueba | CA-04, CA-19, CA-33 |

### 3.2 Rutas HTTP

Prefijo `{API_PREFIX}`. **Ninguna ruta decide por rol**: cada una nombra su
permiso y su recurso, y el rechazo lo produce `autorizar` (ADR-022).

**Sin autenticación** — todas responden `202` con `RespuestaUniforme` salvo donde
se indique:

| Método y ruta | Criterio |
| --- | --- |
| `POST /identidad/altas` | CA-01 a CA-05, CA-26, CA-27 |
| `POST /identidad/confirmaciones` | CA-06 |
| `POST /identidad/confirmaciones/reenvios` | CA-06 |
| `POST /identidad/ingresos` → `202` con `DesafioDeIngreso` | CA-08, CA-09 |
| `POST /identidad/ingresos/{desafio}/segundo-factor` → `200` con `ParDeTokens`, o `401` | CA-07, CA-08 |
| `POST /identidad/refrescos` → `200` o `401` | CA-10, CA-11 |
| `POST /identidad/recuperaciones` | CA-15 |
| `POST /identidad/recuperaciones/cierre` | CA-16, CA-17 |
| `POST /identidad/restituciones-de-segundo-factor` | CA-35 |
| `POST /identidad/restituciones-de-segundo-factor/{id}/cancelacion` | CA-35 |

**Autenticadas, sobre datos propios:**

| Método y ruta | Permiso |
| --- | --- |
| `GET /identidad/yo` | `perfil.leer.propio` |
| `PATCH /identidad/yo` | `perfil.editar.propio` |
| `PUT /identidad/yo/especialidades` | `perfil.declararEspecialidades.propio` |
| `POST /identidad/yo/exportaciones` | `perfil.exportar.propio` |
| `GET /identidad/yo/sesiones` | `sesion.listar.propia` |
| `DELETE /identidad/yo/sesiones/{id}` · `DELETE /identidad/yo/sesiones` | `sesion.cerrar.propia` |
| `POST /identidad/yo/contrasena` | `contrasena.cambiar.propia` |
| `POST /identidad/yo/segundo-factor` · `/confirmacion` | `mfa.inscribir.propio` |
| `DELETE /identidad/yo/segundo-factor` | `mfa.desactivar.propio` — **no existe para `ABOGADO` ni `ADMINISTRADOR`** (CA-32) |
| `POST /identidad/yo/segundo-factor/codigos-de-respaldo` | `mfa.regenerarCodigosDeRespaldo.propio` |
| `GET /identidad/yo/bitacora` | `auditoria.leer.propia` |

**Back-office:**

| Método y ruta | Permiso |
| --- | --- |
| `GET /administracion/usuarios` · `GET /administracion/usuarios/{id}` | `usuario.listar` · `usuario.leer` |
| `POST /administracion/administradores` | `usuario.crearAdministrador` (CA-33, CA-34) |
| `GET /administracion/matriculas` | `matricula.leer` |
| `POST /administracion/matriculas/{id}/verificaciones` | `matricula.verificar` (CA-05, CA-22, M-1) |
| `POST /administracion/matriculas/{id}/suspensiones` | `matricula.suspender` (CA-30) |
| `POST /administracion/restituciones/{id}/instruccion` · `/aprobacion` | `restitucionMfa.instruir` · `restitucionMfa.aprobar` (personas distintas) |
| `GET /administracion/bitacora` | `auditoria.leer.total` |

**Reglas de transporte.** El token de refresco viaja para la web en cookie
`HttpOnly; Secure; SameSite=Strict` con `Path` acotado a
`/identidad/refrescos`, con token anti-CSRF de doble envío; para la app móvil va
en el cuerpo. Por eso `PeticionDeRefresco.refresco` es anulable en el contrato.
El token de acceso viaja en `Authorization: Bearer` y **nunca** en la URL.

### 3.3 Contratos que esta feature declara y otra implementa

- `TipoRecurso.CASO` y su resolvedor de alcance → specs **008/012/013** (F-09).
  Se declaran acá para que la vigencia de la matrícula gobierne los permisos de
  trabajo profesional (CA-29, CA-30).
- Extensión del catálogo de permisos → cada feature posterior agrega los suyos
  como **revisión aditiva** de este contrato. Quitar un permiso es incompatible
  y vuelve a G2.
- `ClaseDeComprobacionDeIdentidad` → el catálogo definitivo lo cierra
  `compliance-legal` (escalamiento **E-4**).
- Aceptación versionada (`AceptacionRegistrada`) → la feature **003** la
  extiende a consentimientos por finalidad. La 002 deja la forma probatoria
  puesta para que ninguna cuenta creada en el interín quede sin prueba
  (C-002-02).

---

## 4. Decisiones de arquitectura

| ADR | Decisión, en una línea |
| --- | --- |
| **ADR-020** | El token de acceso es un JWT de 10 minutos firmado con EdDSA que lleva identificador opaco, sesión y nivel de autenticación; **ni rol, ni permisos, ni ningún dato de la persona**. |
| **ADR-021** | El refresco es una cadena opaca por familia, se rota en cada uso, el segundo uso es incidente **sin ventana de gracia**, y la revocación se consulta por petición contra un índice negativo que **falla cerrado**. |
| **ADR-022** | Autorizar produce una **prueba tipada** por permiso y recurso; la capa de datos no acepta otra cosa, el contexto no tiene rol y un recurso sin clasificar impide el arranque. |
| **ADR-023** | TOTP como único segundo factor, y la exigencia por rol es una **función de tipos** con cuatro cerrojos: no hay configuración que apague el MFA del administrador. |
| **ADR-024** | `argon2id` con parámetros medidos por *benchmark*, precedido de **pimienta** fuera de la base; política por longitud y lista **local** de contraseñas filtradas, sin reglas de composición. |
| **ADR-025** | Misma respuesta, mismo trabajo, mismo piso de latencia y mismo bloqueo, exista o no la cuenta; el duplicado se resuelve por el canal del titular real. |
| **ADR-026** | El estado de la matrícula se **deriva** de hechos registrados en cada lectura; no hay campo almacenado y la tarea programada sólo avisa. |
| **ADR-027** | La restitución del segundo factor es humana, con **espera obligatoria cancelable por el titular**, doble control para roles profesionales y destrucción de la documentación al cerrar. |
| **ADR-028** | El evento de auditoría lo emite `autorizar`; la bitácora guarda **titular afectado** además del sujeto y se sella con raíz de Merkle firmada. |
| **ADR-029** | La resolución IP→ubicación y el análisis de dispositivo son **locales y obligatoriamente locales**; el único encargado de tratamiento de la feature es el correo transaccional. |

---

## 5. Frontera con el modelo de datos y con los demás componentes

`database-engineer` está escribiendo `modelo-datos.md` en paralelo. **Este plan
no toca ese archivo.** Lo que la feature necesita de él, y de los demás
componentes, son estas obligaciones de frontera:

| # | Obligación | Responsable | Criterio |
| --- | --- | --- | --- |
| **F-01** | `Usuario` con identificador **opaco** (ULID, no derivado de ningún dato de la persona). Correo y CUIT/CUIL cifrados en reposo, con **índice ciego** (HMAC, clave fuera de la base) para búsqueda por igualdad y detección de duplicado. Nunca un índice único sobre el valor en claro. | `database-engineer` | CA-04, R-03, constitución #5 |
| **F-02** | **No existe ningún campo booleano de aceptación de términos en ningún modelo.** La aceptación se persiste con versión de cada documento, hash del texto mostrado, fecha, hora, IP y casilla marcada. Test explícito de ausencia del booleano. | `database-engineer` | CA-27, C-002-02 |
| **F-03** | La historia de verificación profesional es **sólo-anexado** y **no existe columna de estado**: el estado se deriva (ADR-026). `vigenciaHasta` sí es columna, para prefiltrar. Una aprobación sin evidencia completa debe ser imposible por restricción, no sólo por tipo. | `database-engineer` | CA-05, CA-29 a CA-31, M-1 |
| **F-04** | Sesiones y familias de refresco: se guarda `HMAC(secreto)` y nunca el token; `generacion`, marca de usado y de revocado; índice por familia. Purga según F-07. | `database-engineer` | CA-10, CA-11, R-06 |
| **F-05** | Bitácora **sólo-anexado** (sin `UPDATE` ni `DELETE` desde el rol de la aplicación, ADR-007 §4), **particionada por fecha**, con índices por `sujeto` y por **`titularAfectado`**, y tabla de sellos aparte. | `database-engineer` | CA-21, CA-34, ADR-028 |
| **F-06** | **Clasificación `PUBLICO`/`INTERNO`/`PERSONAL`/`PATRIMONIAL_SENSIBLE` campo por campo** en `modelo-datos.md`, siguiendo el patrón de la 004, ratificada contra la clasificación **por tipo de recurso** que fija ADR-022. Cierra D-002-10, que hoy no tiene dueño. | `database-engineer` | CA-21, D-002-10 |
| **F-07** | **Tabla de retención completa**, con una fila por cada clave de `ClaveDeRetencion`, su plazo, su acción y su `requiereValidacionProfesional`. Mínimo no negociable: purga de cuentas nunca confirmadas, con test. Las filas `A_DETERMINAR` existen igual, para que el hueco sea visible. | `database-engineer` | CA-28, C-002-03 |
| **F-08** | Secreto TOTP y códigos de respaldo **cifrados en reposo** con clave fuera de la base (`DATA_ENCRYPTION_KEY`), nunca exportables ni legibles por ningún rol. | `database-engineer` + `dev-backend` | CA-25, ADR-023 |
| **F-09** | `TipoRecurso.CASO`, la relación abogado↔caso y su resolvedor de alcance los registran las specs **008/012/013**, que además implementan el control M-7 (la jurisdicción de la matrícula limita la asignación). Esta feature deja el dato disponible y declara la dependencia. | specs 008/012/013 | CA-19, M-7, D-002-07 |
| **F-10** | `dev-web` y `dev-mobile`: renovación de token con ***single-flight*** y sin reintento ante `401`; el token de acceso **nunca** en `localStorage`; la interfaz **nunca** es el límite de autorización (redirige ante `403`, no decide). | `dev-web`, `dev-mobile` | CA-20, ADR-021 |
| **F-11** | `cicd`: par Ed25519 por entorno con JWKS de dos claves y rotación a 90 días; custodia y respaldo de la **pimienta** de contraseñas y de la clave de **sellado** de bitácora; retiro de `JWT_ACCESS_SECRET` y `JWT_REFRESH_SECRET` del esquema de configuración de la 001; *benchmark* de `argon2id` y prueba de temporización en el pipeline; **verificación de identidad byte a byte entre `specs/contratos/identidad-y-acceso.ts` y `packages/shared/src/identidad/contrato/v1.ts`** (ADR-017 aplicado a esta feature); actualización mensual de la base de geolocalización. | `cicd` | ADR-017, ADR-020, ADR-024, ADR-028, ADR-029 |
| **F-12** | La correspondencia `IdUsuario` ↔ `IdPersona` del motor de la 004 vive **en `apps/api`**, cifrada y con bitácora de accesos. El motor nunca recibe un `IdUsuario`, y este contrato nunca recibe un `IdPersona`: las marcas nominales son distintas a propósito. | `dev-backend` + `database-engineer` | ADR-015, C-10 de la 004 |
| **F-13** | `ux-expert` / `dev-web`: atribución de la base de geolocalización en créditos o política de privacidad (licencia CC), y los ocho huecos legales de `ux.md` §11.1 llenados antes de G4. | `ux-expert`, `compliance-legal` | ADR-029 |
| **F-14** | El guion de siembra del primer administrador se ejecuta **fuera de toda interfaz pública**, sin credenciales en variables de entorno, emite `ADMINISTRADOR_SEMBRADO` y deja la cuenta **inoperante hasta inscribir su segundo factor**. Se nominaliza en el primer ingreso o se deshabilita al crearse la primera cuenta nominal. | `dev-backend` + `cicd` | R-10, CA-33, CA-34 |
| **F-15** | `packages/shared/src/identidad/cuit.ts` **todavía no existe**: la spec 002 lo da por existente (CA-04) pero es un entregable pendiente del plan de la 001 §2. Si no está construido cuando arranque la 002, lo construye `dev-dominio` como primera tarea de esta feature. | `dev-dominio` | CA-04 |

---

## 6. Atributos de calidad

| Atributo | Objetivo | Cómo se verifica |
| --- | --- | --- |
| **Rendimiento — autorización** | Derivar permisos + resolver alcance + decidir: **p95 ≤ 8 ms**; verificación de token **p95 ≤ 1 ms**; consulta del índice de revocación **p95 ≤ 2 ms**. | *Benchmark* en el pipeline con umbral que falla la construcción. |
| **Rendimiento — ingreso** | Ingreso completo **p95 ≤ 600 ms** (dominado por `argon2id` y por el piso de latencia de 400 ms). Refresco **p95 ≤ 40 ms**. | Medición de extremo a extremo en el pipeline. |
| **Costo de hasheo** | Tiempo de `argon2id` en el hardware de referencia dentro de **[80 ms, 350 ms]**. | *Benchmark* que rompe la construcción fuera del rango (ADR-024). |
| **No-revelación** | Respuesta **idéntica byte a byte** (normalizando correlación) entre cuenta existente e inexistente; `|Δ mediana| ≤ 15 ms` y `|Δ p95| ≤ 40 ms` con N = 1000. | Prueba de igualdad + prueba estadística de temporización en el pipeline (ADR-025). |
| **Revocación** | **≤ 1 segundo** entre el cierre a distancia (o la suspensión de matrícula) y el primer rechazo. **0** peticiones aceptadas después de ese umbral. | Test de extremo a extremo con reloj medido. |
| **Auditabilidad** | **100 %** de los accesos a recursos `PERSONAL` y `PATRIMONIAL_SENSIBLE` producen `EventoAuditoria`; la escritura agrega **≤ 5 ms al p95**; **0** eventos con texto libre o con contenido del recurso. | Test que recorre el registro de recursos; test de fallo cerrado; verificación de sellos sobre una bitácora adulterada a mano. |
| **Seguridad del token** | **0** campos fuera de la lista de diez en el contenido del token; **0** permisos y **0** roles dentro del token. | Test de forma sobre `ContenidoTokenDeAcceso`; test de rechazo de `alg: none` y de confusión de algoritmo. |
| **MFA no configurable** | **0** cuentas `ADMINISTRADOR` operativas sin segundo factor activo; **0** claves de configuración que mencionen MFA. | Test de forma sobre el esquema de configuración; test sobre `mapaRolPermisos`; test de tipos sobre `ExigeSegundoFactor`; consulta de verificación ejecutable en producción. |
| **Prueba documental** | **0** campos booleanos de aceptación en todo el esquema. | Test sobre el esquema (F-02). |
| **Acceso cruzado entre roles** | **0** incidentes. Cada combinación rol × recurso ajeno probada. | Matriz de tests de acceso cruzado; métrica de la spec §10. |
| **Reutilización de refresco** | **100 %** detectada y contenida sin intervención manual. **Falsos positivos ≤ 0,5 %** de las rotaciones. | Test de extremo a extremo; métrica en producción con umbral que reabre la decisión de ADR-021. |
| **Disponibilidad** | El ingreso funciona con Redis caído (degradación a PostgreSQL, más lento). El alta y la recuperación funcionan con el proveedor de correo caído (cola con reintentos). | Pruebas de caos acotadas: se apaga Redis y se apaga el proveedor. |
| **Correr sin credenciales** | La suite completa y el sistema levantado **sin ninguna variable de credencial definida**, con `INTEGRACIONES_MODO=mock`. | Criterio heredado de la 001 (CA-01, CA-11), verificado en el pipeline. |
| **Cobertura de criterios** | **1 test nombrado por cada uno de los 39 criterios** (`CA-07`, `CA-39`…). Cobertura de ramas **≥ 95 %** en `apps/api/src/autorizacion` y en `packages/shared/src/identidad`. | Informe de QA de `tester` con la matriz criterio → test. |
| **Accesibilidad** | WCAG 2.2 AA. Definido y verificado en `ux.md` §8; este plan no lo redefine. | `ux-expert` + `tester`, incluida la prueba con lector de pantalla de `ux.md` §13. |

---

## 7. Riesgos técnicos

| # | Riesgo | Impacto | Mitigación |
| --- | --- | --- | --- |
| R-01 | **Falsos positivos de reutilización de refresco** por redes malas: a una persona se le cierran todas las sesiones y le llega un correo de alarma sin que haya pasado nada. | Alto | *Single-flight* obligatorio en los clientes (F-10) y métrica con umbral de 0,5 % que **reabre la decisión en compuerta** (ADR-021). No se agrega ventana de gracia por las dudas. |
| R-02 | **`argon2id` como amplificador de denegación de servicio**: cada petición al ingreso cuesta 19 MiB y ~200 ms, y hay que gastarlos también para cuentas inexistentes (ADR-025). | Alto | Semáforo de concurrencia con cola acotada, `429` uniforme, límite por IP y por rango, y parámetros medidos. Es la interacción más delicada entre dos decisiones de esta feature. |
| R-03 | **La clasificación de datos de `modelo-datos.md` no llega a tiempo** y el sistema no arranca (por diseño, ADR-022). | Medio | La clasificación **por tipo de recurso** está fijada en este plan (ADR-022 §"La clasificación"): alcanza para arrancar. La de campo por campo la ratifica `database-engineer` en F-06. |
| R-04 | **Caché de perfil de autorización desincronizada**: un abogado suspendido sigue operando. | Alto | Invalidación por **versión por usuario** en toda escritura relevante, más test explícito de efecto inmediato de CA-30. Si la caché no responde, se lee PostgreSQL. |
| R-05 | **Pérdida de la pimienta o de la clave Ed25519.** Sin pimienta, nadie puede ingresar; sin clave privada, no se emiten tokens. | Crítico | Custodia y respaldo por `cicd` (F-11), con procedimiento escrito de rotación y de recuperación. Ambas versionadas para poder convivir. |
| R-06 | **Volumen de la bitácora** con un evento por lectura sensible. | Medio | Particionado por fecha, sólo `PERSONAL` y `PATRIMONIAL_SENSIBLE` generan evento, y proyección revisada en la 007. Salida prevista: agrupar por ventana **sólo** lo `INTERNO`. |
| R-07 | **Relojes desfasados** en teléfonos de gama baja rompen TOTP y generan bloqueos y llamados a soporte. | Medio | Ventana de ±1 paso (no se amplía), mensaje de error que apunta a la hora del teléfono, y códigos de respaldo bien ofrecidos. |
| R-08 | **El proveedor de correo es punto único**: si se cae, nadie confirma su cuenta ni recupera su contraseña. | Alto | Cola con reintentos y alerta; el puerto admite un segundo proveedor sin tocar nada más (ADR-029). La respuesta al usuario nunca depende del envío. |
| R-09 | **Canal lateral no temporal**: tamaño de respuesta, cabeceras, orden de campos o comportamiento del límite de tasa delatan la existencia de la cuenta. | Medio | Prueba de igualdad byte a byte además de la de temporización (ADR-025). |
| R-10 | **La cuenta de siembra queda viva** y se convierte en una cuenta genérica compartida. | Alto | Nominalización bloqueante en el primer ingreso o deshabilitación automática (F-14, CA-34), con test. |
| R-11 | **Deriva entre el contrato aprobado y el implementado.** | Medio | ADR-017 aplicado: copia byte a byte verificada en el pipeline. |
| R-12 | **El volumen de restituciones de segundo factor desborda al equipo** cuando el MFA obligatorio llegue a todos los abogados. | Medio | Escalera de comprobación que empieza por el escalón más barato, insistencia en códigos de respaldo y segundo dispositivo, y métrica de solicitudes abiertas con antigüedad. Dimensionamiento de soporte antes del piloto. |
| R-13 | **`docs/02-arquitectura.md` describe otra cosa** (*"JWT con rol y permisos"*, módulo `auth` con "MFA por OTP"). Alguien lo lee y lo implementa así. | Bajo | Divergencia declarada en §8.4 de este plan; corresponde una tarea de actualización de `docs/02` después de G2. |

---

## 8. Plan de despliegue

### 8.1 Orden

Migraciones de `database-engineer` → paquete de dominio → API → portales web.
Las migraciones son puramente aditivas respecto del andamiaje de la 001 salvo
por el retiro del ingreso de demostración (§8.3).

### 8.2 Secretos y claves nuevas

`cicd` genera y custodia, **por entorno**: par Ed25519 de firma de tokens con
JWKS de dos claves, pimienta de contraseñas (versionada), clave de cifrado de
secretos TOTP (reutiliza `DATA_ENCRYPTION_KEY`), clave de índice ciego, clave de
tráfico y clave de sellado de bitácora. Ninguna se genera en el proceso de la
aplicación y ninguna tiene valor por defecto: el arranque falla si falta alguna,
igual que en la 001 §5.1.

### 8.3 Retiro del andamiaje de la 001

El ingreso de la 001 es andamiaje declarado (`plan.md` 001 §5.3): correo y
contraseña, un solo token, sin refresco y sin MFA, habilitado por
`PERMITIR_LOGIN_DEMO` y con arranque bloqueado en producción. **La última tarea
de esta feature lo elimina**, junto con la bandera. Los usuarios de
demostración se recrean con el sembrado de la 002, incluido un secreto TOTP fijo
**sólo** en desarrollo, prohibido por la validación de arranque en producción.
Como el andamiaje nunca pudo correr en producción, no hay cuentas reales que
migrar.

### 8.4 Cambios sobre material ya aprobado — para registrar en la compuerta

1. **Plan de la 001 §5.1** (aprobado en G2 de la 001): desaparecen
   `JWT_ACCESS_SECRET` y `JWT_REFRESH_SECRET`; aparecen la clave privada Ed25519
   con su `kid`, la pimienta y la clave de sellado (ADR-020, ADR-024, ADR-028).
   Es un cambio técnico sin efecto en alcance, costo ni encuadre legal, pero
   **modifica material aprobado** y por eso se declara acá en vez de hacerse en
   silencio.
2. **Apartamiento parcial de R-03**: la regla dice que el token lleva "identidad
   y permisos"; este plan **quita los permisos** del token, porque con ellos
   adentro no se pueden cumplir CA-14 ni CA-30. Está argumentado en ADR-020 y se
   somete a la compuerta.
3. **`docs/02-arquitectura.md`** describe *"JWT con rol y permisos"*: queda
   desactualizado y necesita una tarea de corrección (R-13).

### 8.5 Activación gradual y vuelta atrás

No hay activación gradual posible: la identidad se reemplaza entera o no se
reemplaza. La vuelta atrás es por versión de la imagen y **sólo es viable antes
de la primera alta real**, porque después habría cuentas creadas contra el
modelo nuevo. Dicho de otro modo: la ventana de reversión barata se cierra en el
piloto, y eso refuerza la condición C-002-11 (inscripción de la base ante la
AAIP antes de tratar datos de una persona real), hoy pospuesta por decisión 002-E.

### 8.6 Observabilidad mínima

A cargo de `cicd`: tasa de `401` y de `403` por ruta; reutilizaciones de
refresco detectadas y **falsos positivos estimados**; bloqueos aplicados;
solicitudes de restitución abiertas con antigüedad; matrículas pendientes por
encima del plazo y matrículas por vencer; **eventos de auditoría fallidos, que
deben ser cero**; ejecución del sellado de bitácora; latencia de los caminos de
no-revelación con alerta si el trabajo real supera el piso; y cuentas
`ADMINISTRADOR` sin segundo factor activo, que también deben ser cero.

---

## 9. Alternativas descartadas (transversales)

Las alternativas de cada decisión están en su ADR. Acá sólo las que afectan a la
feature entera.

| Alternativa | Por qué no |
| --- | --- |
| **Proveedor de identidad gestionado** (Auth0, Cognito, Clerk, Supabase Auth) | Tres motivos, cualquiera de ellos suficiente: **(a)** ninguno provee el RBAC que CA-19 exige —verificación de asignación al recurso en cada consulta—, así que igual habría que construir lo más difícil; **(b)** los datos de identidad de **todos** los titulares pasarían a un encargado de tratamiento con transferencia internacional probable (arts. 12 y 25), justo cuando la 002 es la feature que crea la primera base de datos personales del producto y la inscripción ante la AAIP está pendiente; **(c)** el sistema tiene que correr de punta a punta sin credenciales de terceros, que es criterio aprobado de la 001. El costo por usuario activo es el cuarto motivo, y es el menos importante. |
| **Keycloak autohospedado** | Resuelve el punto (b) —los datos se quedan en casa— pero agrega un servicio Java con su propio modelo de datos, su propio ciclo de actualizaciones de seguridad y su propia curva, para un equipo chico; y el RBAC fino de CA-19 habría que construirlo igual, ahora repartido entre dos sistemas. Reconsiderable el día que haya federación con estudios jurídicos externos. |
| **OAuth2 / OIDC completo con servidor de autorización propio** | No hay ningún tercero que necesite autenticarse contra nosotros ni delegación entre aplicaciones. Se adopta el vocabulario (JWT, `jwks`, `at+jwt`) sin el protocolo, que hoy sería ceremonia sin consumidor. |
| **Inicio de sesión social (Google, Apple)** | Fuera de alcance por la spec §8. Además, para esta audiencia, vincular una cuenta de gestión de deudas con una identidad de un tercero tiene implicancias de privacidad que merecen su propia decisión. |
| **Biblioteca de permisos** (CASL, Casbin) | Ver ADR-022: el problema no es expresar reglas —son pocas— sino impedir que alguien no pregunte. Eso lo da el sistema de tipos, no una biblioteca. |
| **Row Level Security como mecanismo principal** | Ver ADR-022: pelea con el pool de conexiones, mueve la regla fuera del dominio auditable y no produce el evento de auditoría con permiso y motivo. Se conserva como defensa en profundidad para la bitácora. |
| **Microservicio de identidad separado** | Un backend, tres portales (criterio 4 del mandato). Separarlo agregaría una frontera de red en el camino de cada petición para resolver permisos, justo lo que ADR-020 decidió resolver por petición. |
| **Diferir el MFA a una feature posterior** | La decisión 002-B ya lo cerró, y con razón: la cuenta de administrador que se crea en esta feature es la que más puede ver. |
| **Un portal separado para el administrador** | Mismo backend, mismo modelo, distinto RBAC. Tres productos serían tres superficies de ataque y tres implementaciones del mismo control. |

---

## 10. Escalamientos — decisiones que no son del arquitecto

**Ninguna está resuelta en este plan.** Cada una lleva la recomendación del
arquitecto; la decisión es humana.

| # | Qué hay que decidir | Recomendación | Por qué se escala |
| --- | --- | --- | --- |
| **E-1** | **CUIT/CUIL: finalidad declarada o diferimiento** (D-002-01, C-002-04). La spec lo sigue pidiendo "si aplica a su rol", sin declarar para qué. **Bloquea la pantalla AL-2** (`ux.md` `[ESCALAMIENTO-A]`). | **No pedirlo en la 002.** Dentro de esta feature no hay ninguna función que lo necesite: la autenticación va por correo, el RBAC por permisos, el perfil por nombre. Pedirlo obliga a declarar una finalidad que hoy no existe y arrastra el problema de rectificación de E-7. Se pide en la feature que lo use, con su finalidad concreta. | Es alcance funcional y encuadre de datos personales: vuelve a **G1**. El arquitecto no puede inventar la finalidad. |
| **E-2** | **Qué proveedor de correo transaccional se contrata** (C-002-10, art. 25). | **Amazon SES en Irlanda (`eu-west-1`)**: aburrido, barato, acuerdo de tratamiento estándar, tratamiento en país de nivel adecuado —lo que evita las cláusulas modelo—. Los criterios completos están en ADR-029. | Compromete costo y la **firma de un contrato** con un tercero, y el encuadre lo tiene que confirmar `compliance-legal`. |
| **E-3** | **Plazo de la espera obligatoria y de resolución de la restitución de MFA** (`ux.md` `[ESCALAMIENTO-D]`). Hoy no existe el parámetro y la pantalla RE-4 no puede decir cuánto tarda. | **72 horas para `CLIENTE`, 24 horas hábiles para `ABOGADO` y `ADMINISTRADOR`**, con escalamiento automático al vencerse, igual que CA-31. La espera no es demora: es la defensa que permite al titular real cancelar. | Es un parámetro de producto con impacto operativo (dotación de soporte) y de trato digno (art. 8 bis). |
| **E-4** | **Catálogo de comprobaciones de identidad admisibles para la restitución, con su base legal, quién las ve y cómo se destruyen** (C-002-12). | La escalera de ADR-027 —canal ya registrado, videollamada sin grabación, documento como último recurso— como punto de partida. El catálogo cerrado lo define `compliance-legal` con el product owner. | Es encuadre legal y tratamiento de datos identificatorios nuevos. Por eso el contrato lleva el brazo `A_DEFINIR_EN_G2`. |
| **E-5** | **Unidad del plazo de CA-31** ("5 días hábiles"). Contar días hábiles exige un calendario de feriados argentinos que el sistema **no tiene** y que nadie tiene asignado. | **Expresarlo en días corridos (7)**, que aproxima 5 hábiles sin depender de un calendario. Si se quiere la letra "hábiles", hay que construir el calendario como parámetro del catálogo de la 004, con su propia validación profesional. | Cambia la letra de un criterio aprobado, aunque sea el valor de un parámetro. No lo reinterpreta el arquitecto. |
| **E-6** | **Edad del titular** (D-002-08). La spec no dice nada; un menor puede registrarse y celebrar un contrato de adhesión impugnable. Si se agrega, `ux.md` AL-2 cambia (`[ESCALAMIENTO-E]`). | Pedir declaración de edad en el alta, con su nota del art. 6. Pero **el arquitecto no sabe** si alcanza con la declaración ni qué pasa con el adolescente de 16/17 con deuda propia: eso es del estudio. | Vuelve a **G1**: es un criterio de aceptación que falta. |
| **E-7** | **Proceso de rectificación del CUIT/CUIL** (D-002-04, art. 16). CA-23 lo declara no editable "sin un proceso de reverificación" que ninguna CA define. | Depende de E-1: si el CUIT/CUIL no se pide en la 002, el problema desaparece de esta feature. Si se pide, hace falta un criterio que defina el proceso. | Vuelve a **G1**, condicionado a E-1. |
| **E-8** | **Falsos positivos de reutilización de refresco: ¿se acepta el costo?** (ADR-021). Implementar CA-11 literalmente, sin ventana de gracia, va a cerrarle todas las sesiones a gente que no fue atacada. | **Empezar sin ventana de gracia** y medir. Si el indicador supera 0,5 % de las rotaciones, volver a compuerta con el número medido y decidir ahí, no ahora. | Es una tensión entre un criterio aprobado y la experiencia del usuario. La decisión de aflojar el criterio no es del arquitecto. |

---

## 11. Verificación de las condiciones del dictamen en G2

| Condición | Estado en este plan |
| --- | --- |
| **C-002-01** (art. 6 en la recolección) | `InformacionArticulo6` en el contrato §10, con los cinco incisos y el carácter obligatorio o facultativo por campo; pantalla AL-2 diseñada en `ux.md` §3. **Pendiente**: razón social, domicilio y ratificación del abogado (`ux.md` §11.1, F-13). |
| **C-002-02** (aceptación versionada, alcance limitado) | `AceptacionRegistrada` con versión, hash, fecha, IP y casilla; `VersionDeDocumento.incluyeFinalidadesDeLa003` es el literal `false`, así que ampliar el alcance **no compila**. Obligación F-02: prohibido el booleano en el esquema, con test. |
| **C-002-03** (conservación y purga) | `ClaveDeRetencion` y `ReglaDeRetencion` en el contrato §11; tabla completa exigida como F-07, con la purga de cuentas nunca confirmadas como mínimo verificable. |
| **C-002-04** (CUIT/CUIL: finalidad y no-enumeración) | La no-enumeración está resuelta en ADR-025 (misma respuesta, mismo tiempo, resolución por el canal del titular) y en F-01 (índice ciego). **La finalidad sigue abierta: escalamiento E-1.** |
| **C-002-05** (baja de cuenta) | Resuelta en G1 por la decisión 002-D: diferida a la 003, con la restricción de la Res. SCI 424/2020 documentada. Este plan no la reabre; sí declara que la baja **no podrá vivir sólo detrás del login**, lo que condiciona el diseño de la 003. |
| **C-002-06** (nada termina en callejón sin salida) | `MensajeTransaccional.acciones` es una tupla **no vacía**: un correo sin acción no compila. Las 16 plantillas están enumeradas en el contrato §13 y diseñadas en `ux.md` §7.1. |
| **C-002-07** (vigencia de matrícula, M-1 a M-4, M-6) | **ADR-026** completo: evidencia estructuralmente obligatoria, estado derivado con vigencia, suspensión inmediata, escalamiento por plazo, y microcopy que nunca afirma "verificado" sin fecha. M-7 queda como F-09. |
| **C-002-08** (MFA de administrador no desactivable) | **ADR-023**, con cuatro cerrojos independientes y tests de forma para cada uno. |
| **C-002-09** (cuentas administradoras nominadas) | `AltaDeAdministrador` exige correo nominal, nombre completo y documento de designación; rechazo de buzones de rol; `ADMINISTRADOR_CREADO` y `ADMINISTRADOR_SEMBRADO` en la taxonomía (ADR-028); nominalización o deshabilitación de la siembra (F-14). |
| **C-002-10** (terceros, arts. 12 y 25) | **ADR-029**: geolocalización y análisis de dispositivo **locales por contrato**, sin encargado de tratamiento; queda un único encargado, el correo transaccional, con criterios de selección fijados y **la elección escalada (E-2)**. |
| **C-002-11** (inscripción de la base ante la AAIP) | **Abierta — dependencia externa**, pospuesta por la decisión 002-E. Este plan no puede cerrarla y agrega un dato para la decisión: §8.5, la ventana de reversión barata se cierra con la primera alta real. |
| **C-002-12** (circuito de restitución de MFA) | **ADR-027** diseña el circuito completo. El catálogo de comprobaciones y su base legal quedan en **E-4**, y el plazo en **E-3**. |

---

## 12. Decisiones pendientes

Ninguna decisión de arquitectura queda abierta en este plan. Las ocho que quedan
abiertas están en §10: **E-1, E-6 y E-7 vuelven a G1** porque tocan el QUÉ;
**E-5 y E-8** son ajustes sobre la letra de criterios aprobados; **E-2, E-3 y
E-4** son del product owner y de `compliance-legal`.

Tres cosas más que este plan deja anotadas y que no son decisiones sino trabajo
que alguien tiene que tomar:

1. **`packages/shared/src/identidad/cuit.ts` no existe** (F-15). La spec 002 lo
   da por existente en CA-04; en realidad es un entregable pendiente del plan de
   la 001.
2. **`docs/02-arquitectura.md` quedó desactualizado** en dos puntos (R-13).
3. **Los ocho huecos legales de `ux.md` §11.1** siguen abiertos; dos de ellos
   —`{PROVEEDOR DE CORREO}` y `{APP}` de segundo factor— los cierra este plan
   (ADR-029 y ADR-023 respectivamente), y los otros seis son de
   `compliance-legal`, del estudio y del product owner.

---

## 13. Trazabilidad: los 39 criterios y su lugar en la arquitectura

| CA | Dónde vive | Decisión |
| --- | --- | --- |
| CA-01 | Alta en `apps/api/src/identidad`; `EstadoCuenta.NO_VERIFICADA`; enlace de un solo uso | ADR-025 |
| CA-02 | `RespuestaUniforme` + correo accionable al titular real | ADR-025 |
| CA-03 | `evaluarPoliticaDeContrasena` (dominio puro), un solo incumplimiento devuelto | ADR-024 |
| CA-04 | Índice ciego (F-01), `ResolucionDeDuplicado`, misma respuesta y mismo tiempo | ADR-025, F-01 |
| CA-05 | `HistoriaDeVerificacion` + `derivarEstadoMatricula`; evidencia obligatoria | ADR-026 |
| CA-06 | `EnlaceDeUnSoloUso` + plantilla accionable de reenvío | ADR-025 |
| CA-07 | Emisión del par de tokens + `INGRESO_EXITOSO` en bitácora | ADR-020, ADR-028 |
| CA-08 | `DesafioDeIngreso` emitido **siempre**, segundo paso separado | ADR-023, ADR-025 |
| CA-09 | `decidirBloqueo` (puro) sobre `ClaveDeTrafico`; correo con duración y salida | ADR-025 |
| CA-10 | Rotación por familia con `generacion` | ADR-021 |
| CA-11 | `REUTILIZACION_DETECTADA` → revocación total + aviso | ADR-021 |
| CA-12 | `401` indistinto; distinción sólo en bitácora | ADR-020 |
| CA-13 | `SesionVisible` con dispositivo y ubicación locales | ADR-029 |
| CA-14 | `IndiceDeRevocacion` consultado por petición, falla cerrado | ADR-021 |
| CA-15 | Respuesta uniforme + enlace de un solo uso de vida corta | ADR-025 |
| CA-16 | Cambio de contraseña → cierre total de sesiones + aviso | ADR-021, ADR-024 |
| CA-17 | Enlace vencido o usado → rechazo accionable | ADR-025 |
| CA-18 | `mapaRolPermisos` + `derivarPermisos`, evaluación por permiso | ADR-022 |
| CA-19 | `Autorizacion<P,T>` con recurso individual y `ResolvedorDeAlcance` | ADR-022 |
| CA-20 | `403` producido por `autorizar`; la interfaz sólo redirige (F-10) | ADR-022 |
| CA-21 | Evento emitido **por** `autorizar`; clasificación obligatoria | ADR-028, ADR-022 |
| CA-22 | `matricula.verificar` + evidencia + evento | ADR-026, ADR-028 |
| CA-23 | `perfil.editar.propio`; CUIT/CUIL no editable (rectificación: **E-7**) | ADR-022 |
| CA-24 | `PerfilVisible` con matrícula no autoeditable y especialidades | ADR-026 |
| CA-25 | `SinSecretos<T>`: lo que no debe salir **no compila** | contrato §12 |
| CA-26 | `InformacionArticulo6` versionada con hash; pantalla AL-2 | contrato §10 |
| CA-27 | `AceptacionRegistrada`; prohibido el booleano (F-02) | contrato §10, F-02 |
| CA-28 | `ClaveDeRetencion` + purga verificable | F-07 |
| CA-29 | `VENCIDA` retira sólo `caso.recibirAsignacion` | ADR-026, ADR-022 |
| CA-30 | `SUSPENDIDA` de efecto inmediato vía invalidación por versión | ADR-026, ADR-022 |
| CA-31 | `plazoVencido` derivado + escalamiento; plantilla con fecha | ADR-026, **E-5** |
| CA-32 | Cuatro cerrojos: tipo, ausencia de clave, ausencia de permiso, permisos derivados | ADR-023 |
| CA-33 | `AltaDeAdministrador` sin cuentas genéricas; rechazo de buzones de rol | F-14 |
| CA-34 | `ADMINISTRADOR_CREADO` / `_SEMBRADO` / `_NOMINALIZADO` | ADR-028, F-14 |
| CA-35 | `SolicitudDeRestitucionMfa` con espera y doble control | ADR-027 |
| CA-36 | `laRecuperacionSiempreDisponible: true` — literal, no configurable | ADR-025 |
| CA-37 | `PoliticaDeBloqueo` como parámetro de producto | ADR-025 |
| CA-38 | `ExigeSegundoFactor<'ABOGADO'>` es `true`; sin MFA no hay permisos | ADR-023 |
| CA-39 | MFA opcional para cliente; desactivar exige reautenticación fuerte | ADR-023, ADR-022 |
