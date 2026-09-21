# ADR-022 — La autorización es una capacidad tipada por permiso y recurso, no un guarda por rol

| Campo | Valor |
| --- | --- |
| Estado | PROPUESTO |
| Fecha | 2026-09-21 |
| Autor | arquitecto |
| Aprobado por | pendiente — G2, feature 002 |
| Spec de origen | `specs/002-identidad-y-acceso/spec.md` v3 (CA-18, CA-19, CA-20, CA-21, R-07) |
| Dictamen | §6 ("CA-19 y R-07 son la traducción correcta del art. 9"), D-002-10 |
| Contrato | `specs/contratos/identidad-y-acceso.ts` §2 y §3 |

## Contexto

Ésta es la decisión que sostiene todo el producto que viene después. El dictamen
lo dice sin vueltas: *"Un fallo de RBAC en la 002 expone los datos patrimoniales
de las features 007 en adelante."*

Tres criterios fijan el listón, y ninguno de los tres se cumple con un decorador
de rol en un controlador:

- **CA-18**: se evalúa por permiso concreto; el rol es sólo el conjunto de
  permisos que trae por defecto.
- **CA-19**: cuando un abogado pide un expediente, se verifica que ese caso le
  fue asignado **a ese** abogado, **en cada consulta**, no sólo en el listado.
- **CA-21**: todo acceso a un recurso clasificado como personal o patrimonial
  sensible genera un `EventoAuditoria`.

Y hay un cuarto problema, el defecto **D-002-10**: CA-21 presupone una
clasificación de datos que nadie define ni posee. Sin ella, el criterio no es
verificable.

El modo en que esto falla en la vida real no es que alguien escriba un guarda
mal. Es que dentro de un año, alguien agrega un endpoint nuevo un viernes y **se
olvida** de poner el guarda, o consulta el repositorio directamente desde un
caso de uso. Ninguna cantidad de revisión de código sostiene eso durante tres
años y ocho agentes. La decisión, entonces, no es "cómo autorizamos" sino **cómo
hacemos imposible no autorizar**.

## Decisión

**Autorizar produce una prueba. La prueba es el único argumento con el que la
capa de datos acepta trabajar. Un camino de datos sin autorización no se puede
escribir porque no se puede construir su argumento.**

Cinco capas, cada una con un mecanismo distinto y un momento de detección
distinto (mismo criterio que ADR-009).

### Capa 1 — El contexto no tiene rol

`ContextoDeAcceso` expone `sujeto`, `sesion`, `permisos`, `nivelAutenticacion`,
`autenticadoEn` e `idCorrelacion`. **No tiene `rol`.** Un guarda no puede
escribir `if (contexto.rol === 'ABOGADO')` porque el tipo no se lo ofrece. El
rol existe en un solo lugar del sistema —`PerfilDeAutorizacion`, entrada de la
función que deriva los permisos— y es el único lugar donde una decisión lo mira.

### Capa 2 — Los permisos se derivan, no se transportan

`derivarPermisos(perfil, momento)` es pura, total y determinista, vive en
`packages/shared` y se puede probar como una tabla de verdad sin levantar nada.
Implementa las reglas que hacen inmediatos a CA-29, CA-30, CA-32 y CA-38:

- Cuenta que no está `ACTIVA` ⇒ conjunto vacío, salvo los permisos explícitos de
  `permisosDeCuentaNoOperativa`, que existen para que nadie quede sin salida
  (CA-36).
- `ADMINISTRADOR` o `ABOGADO` con `estadoMfa !== 'ACTIVO'` ⇒ sólo los permisos
  de inscripción del segundo factor (ADR-023).
- Matrícula `VENCIDA` ⇒ se retira `caso.recibirAsignacion`, se conservan
  `caso.leer.asignado` y `caso.actuar.asignado` (CA-29: no se perjudica al
  cliente que ya tiene ese abogado, constitución #1).
- Matrícula `SUSPENDIDA` ⇒ se retiran los tres (CA-30).

Se deriva **por petición**. El `PerfilDeAutorizacion` se lee de una caché en
Redis con **versión por usuario**: toda escritura que cambie rol, estado de
cuenta, estado de MFA, historia de matrícula o ajustes de permiso incrementa la
versión, y la entrada vieja deja de servir. Efecto inmediato sin caché venenosa.
Si la caché no responde, se lee PostgreSQL; nunca se asume el perfil anterior.

### Capa 3 — Autorizar exige un recurso y devuelve una prueba

`Autorizacion<P, T>` lleva una marca (`unique symbol`) **que no se exporta**.
Fuera del módulo que implementa `autorizar`, el tipo es inconstruible: no hay
literal, no hay `as` honesto, no hay fábrica. La prueba queda atada al permiso,
al recurso individual, al sujeto y a la sesión; no es transferible a otro
recurso.

`autorizar` resuelve el alcance con el `ResolvedorDeAlcance` del tipo de recurso
—lo que convierte a CA-19 en estructura: el resolvedor del caso pregunta por la
asignación, siempre, no sólo en el listado—, llama a `decidirAcceso` (pura) y
**emite el evento de auditoría** antes de devolver la prueba.

### Capa 4 — La capa de datos sólo acepta pruebas

`ConsultasDeIdentidad` recibe `Autorizacion` o `FiltroDeAlcance` en **todos** sus
métodos. No hay una firma que tome un `IdUsuario` suelto. El caso de uso que
quiera leer un perfil tiene que haber autorizado la lectura de ese perfil; no
hay atajo, y el compilador lo verifica en cada compilación, no en la revisión.

Complemento mecánico: una regla de lint prohíbe el uso directo del cliente de
Prisma fuera de `apps/api/src/persistencia/**`, del mismo modo que ADR-009
aplica los límites por agente.

### Capa 5 — Las colecciones llevan su criterio al `WHERE`

`FiltroDeAlcance` no es un permiso global: lleva un `CriterioDeAlcance`
(`TODOS`, `PROPIOS`, `ASIGNADOS`, `NINGUNO`) que **la consulta está obligada a
incorporar**. Traer todas las filas y filtrar en memoria no cumple el contrato.
`NINGUNO` devuelve lista vacía, nunca `403`: tener el permiso y no tener alcance
no es un error del usuario.

### La clasificación: D-002-10 resuelto por arranque fallido

`RegistroDeRecurso` obliga a que **cada** `TipoRecurso` declare su
`ClasificacionDato`, si exige segundo factor y su ventana de reautenticación.
`validarRegistroDeRecursos` corre al arrancar: **si falta un tipo, el proceso no
levanta**. No hay degradación a "público por defecto", que es como todos los
sistemas terminan filtrando. La clasificación **campo por campo** la escribe
`database-engineer` en `modelo-datos.md` (obligación F-06); la clasificación
**por tipo de recurso** la fija este plan y se ratifica contra la suya.

| Tipo de recurso | Clasificación | Segundo factor | Ventana de reautenticación |
| --- | --- | --- | --- |
| `USUARIO` | `PERSONAL` | no | — |
| `PERFIL` | `PERSONAL` | no | — |
| `SESION` | `PERSONAL` | no | — |
| `CREDENCIAL` | `PERSONAL` | sí | 5 minutos |
| `VERIFICACION_PROFESIONAL` | `PERSONAL` | sí (para decidir) | — |
| `EVENTO_AUDITORIA` | `PERSONAL` | sí (para `auditoria.leer.total`) | — |
| `SOLICITUD_RESTITUCION_MFA` | `PERSONAL` | sí (instruir y aprobar) | 5 minutos |
| `CASO` | `PATRIMONIAL_SENSIBLE` | (lo fijan 008/012/013) | — |

Aclaración sobre `exigeSegundoFactor`, para que no produzca un callejón sin
salida: significa **reautenticación fuerte**, y `decidirAcceso` la satisface con
`CONTRASENA` cuando la cuenta **no tiene segundo factor configurado** —no se
puede exigir lo que no existe—. Para un `CLIENTE` sin MFA, cambiar la contraseña
o inscribir el segundo factor exige volver a escribir la contraseña dentro de la
ventana; para uno que ya lo activó, exige contraseña **y** segundo factor, que
es lo que pide el recaudo B-3 de CA-39.

### Verificación

Un test por CA-18, CA-19, CA-20 y CA-21. Además: **test de tipos negativo**
—una función que intenta construir un `Autorizacion` a mano debe fallar la
compilación—; test de que `mapaRolPermisos` coincide con la declaración del
contrato; test de arranque fallido con un tipo de recurso sin registrar; test de
que un abogado con un identificador de caso ajeno recibe `403` en la consulta
individual **y** lista vacía en la colección; y un test de que un cambio de
estado invalida la caché de perfil en la petición siguiente.

## Alternativas consideradas

| Alternativa | A favor | En contra | Por qué no |
| --- | --- | --- | --- |
| Guardas de NestJS por rol (`@Roles('ABOGADO')`) | Idiomático, una línea | Es autorización por nombre de rol: prohibida por CA-18 y R-07. Y no dice nada del recurso: no cubre CA-19 | Es exactamente el defecto que la spec describe |
| Guardas por permiso (`@RequierePermiso('caso.leer')`) sin recurso | Cumple CA-18 | Un permiso sin recurso no distingue el caso propio del ajeno: el abogado cambia el identificador en la URL y entra. Es el ejemplo literal de R-07 | Cumple la mitad del requisito y da la sensación de cumplirlo todo, que es peor |
| Librería de permisos (CASL, Casbin, `accesscontrol`) | Reglas declarativas, filtros para el ORM, comunidad | Ninguna impide **no preguntar**. La garantía que necesitamos no es expresividad de reglas —las nuestras son pocas— sino imposibilidad de saltear la pregunta. Además agrega un lenguaje de reglas que hay que auditar | "Aburrido gana", y acá aburrido es el sistema de tipos que ya tenemos. Sin dependencia nueva |
| Row Level Security de PostgreSQL | Garantía en el motor, imposible de saltear desde la aplicación | Exige fijar el contexto de usuario por conexión, lo que pelea con el pool de Prisma; mueve la autorización a un lugar donde el dominio no la puede auditar ni probar sin base; y no produce el `EventoAuditoria` con permiso y motivo que pide CA-21 | Descartada como mecanismo principal. Se conserva como defensa en profundidad para la bitácora (`REVOKE UPDATE, DELETE`, ADR-007 §4) |
| ABAC con motor de políticas (OPA/Rego) | Políticas fuera del código, auditables por separado | Un servicio y un lenguaje más para un equipo chico; la latencia por consulta; y las políticas quedan lejos del tipo que las exige | Desproporcionado para tres roles y veinticuatro permisos. Reconsiderable si aparecen políticas por organización |
| Permisos en el token (ADR-020) | Cero consultas | Sobreviven a su revocación | Contradice CA-14 y CA-30 |
| Rol y permisos resueltos una vez por sesión | Barato | Un abogado suspendido sigue operando hasta que cierre sesión | Contradice CA-30, que exige efecto inmediato |
| Clasificación de datos con valor por defecto "interno" | Nada se rompe al agregar un recurso | El recurso nuevo no se audita y nadie se entera. Es el modo silencioso de incumplir CA-21 | Arranque fallido: molesta una vez, en desarrollo, y nunca en producción |

## Consecuencias

**Positivas**

- CA-19 y CA-21 dejan de depender de que alguien se acuerde. Un endpoint nuevo
  sin autorización **no compila**; un recurso nuevo sin clasificar **no
  arranca**.
- La decisión de acceso es pura y se prueba como tabla de verdad: un revisor
  —incluso no programador— puede leer `derivarPermisos` y `decidirAcceso`.
- La misma estructura sirve para las features 007 a 018 sin rediseño: agregar un
  recurso es agregar una fila al registro y un resolvedor.

**Negativas**

- **Es más ceremonia por endpoint** que un decorador: hay que nombrar el permiso
  y el recurso, y pasar la prueba hacia abajo. Es la molestia deliberada que
  compra la garantía; para las consultas simples son dos líneas.
- Trabajo por petición: derivar permisos (caché con versión) más resolver el
  alcance (una consulta acotada, indexada). Presupuesto **p95 ≤ 8 ms**.
- La caché de perfil con versión es un mecanismo más para entender y para
  vigilar. Su modo de falla es leer de PostgreSQL, que es correcto y más lento.

**Qué cierra**

- Autorizar por nombre de rol, en cualquier capa.
- Consultar la base sin prueba de autorización.
- Que la interfaz sea el único límite (CA-20).

## Cómo se revierte

- **Aflojar a permisos sin recurso**: medio día quitar el argumento `objetivo`.
  Prohibido sin revisar CA-19 en compuerta; el test de tipos negativo y los
  tests de acceso cruzado lo señalarían de inmediato.
- **Pasar a una librería de permisos**: dos o tres días, conservando el
  envoltorio `autorizar`/`Autorizacion` como fachada. La prueba tipada puede
  sobrevivir a un cambio del motor de reglas; ése es el punto de desacople.
- **Agregar RLS como segunda capa**: aditivo, sin tocar nada de lo anterior.
  Recomendado el día que haya un segundo servicio escribiendo en la misma base.
