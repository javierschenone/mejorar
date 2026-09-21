# Spec 002 — Identidad y acceso

| Campo | Valor |
| --- | --- |
| Estado | EN REVISIÓN (G1) |
| Autor | orquestador |
| Revisor legal | `compliance-legal` → `specs/002-identidad-y-acceso/cumplimiento.md` |
| Compuerta | G1 |
| Principios de la constitución involucrados | #3, #4, #5, #13, #14 |
| Origen | Adelantada en el orden del backlog: la feature 001 (escalamiento E-02, `REGISTRO-COMPUERTAS.md` entrada 031) pedía, sin saberlo, el contenido íntegro de esta feature. Se especifica ahora, en paralelo al cierre de G2 de la 004. |

## 1. Problema

Sin identidad ni permisos reales, no hay producto: un cliente, un abogado y un
administrador no pueden coexistir en el mismo sistema sin que cada uno vea
exactamente lo que le corresponde y nada más. Y en este dominio en particular
—expedientes de deuda, informes crediticios, honorarios— una fuga de acceso no
es un bug de UX: es un dato patrimonial de una persona en manos de quien no
debía verlo.

## 2. Audiencia

Las tres audiencias del producto por igual: cliente deudor, abogado,
administrador de la plataforma. Cada una se registra, inicia sesión y opera
dentro de los límites de su rol.

## 3. Resultado esperado

Cualquiera de las tres audiencias puede registrarse, verificar su identidad de
forma proporcional a su rol, iniciar sesión de forma segura, recuperar el
acceso si lo pierde, y en todo momento el sistema le muestra exactamente lo que
su rol permite — nunca más, nunca con una comprobación que dependa sólo del
cliente.

## 4. Recorrido del usuario

### Alta

1. La persona elige su tipo de cuenta (cliente, abogado; el administrador no se
   autorregistra, ver §6).
2. Completa datos mínimos: correo, contraseña, nombre para mostrar, y CUIT/CUIL
   si aplica a su rol.
3. Si es abogado, además ingresa su número de matrícula y jurisdicción — sujeto
   a verificación (ver casos límite, §7).
4. Confirma su correo antes de poder operar.
5. Acepta los términos y la política de privacidad — el registro de esa
   aceptación es un consentimiento en el sentido de la feature 003, pero **el
   texto y el circuito de consentimientos informados propiamente dichos son de
   la 003**; acá sólo se deja el enganche.

### Ingreso

1. La persona ingresa correo y contraseña.
2. Si tiene MFA activado, completa el segundo factor.
3. Recibe un token de acceso de vida corta y uno de refresco.
4. Ve su portal según su rol, con lo que ese rol permite y nada más.

### Recuperación

1. La persona pide recuperar el acceso con su correo.
2. Recibe un enlace de un solo uso y de vida corta.
3. Define una contraseña nueva; todas las sesiones anteriores se cierran.

### Gestión de la sesión

1. La persona puede ver sus sesiones activas y cerrar cualquiera a distancia.
2. Un token de refresco usado dos veces (reutilización) cierra todas las
   sesiones de esa cuenta y la alerta.

## 5. Criterios de aceptación

### Registro e identidad

```gherkin
CA-01  Dada una persona sin cuenta
       Cuando se registra con correo, contraseña y nombre
       Entonces la cuenta se crea en estado NO_VERIFICADA y recibe un correo
       de confirmación con un enlace de un solo uso

CA-02  Dado un correo ya registrado
       Cuando alguien intenta registrarse con el mismo correo
       Entonces el sistema no revela si el correo existe: responde igual que
       a un registro exitoso y, si existía, notifica al dueño real de la
       cuenta el intento

CA-03  Dada una contraseña que no cumple la política mínima (longitud, sin
       estar en una lista de contraseñas filtradas conocidas)
       Cuando se intenta registrar
       Entonces se rechaza con el motivo exacto, sin exponer la política
       completa como si fuera un desafío a resolver

CA-04  Dado un CUIT/CUIL ingresado
       Cuando se valida
       Entonces se verifica el dígito verificador antes de aceptarlo
       (`shared/src/identidad/cuit.ts`, ya existe en el dominio)

CA-05  Dado un registro como abogado con número de matrícula y jurisdicción
       Cuando se completa el alta
       Entonces la cuenta queda en estado PENDIENTE_DE_VERIFICACION_PROFESIONAL
       y no puede operar como abogado hasta que un administrador la verifique
       [Ver casos límite §7: el sistema no tiene integración automática con
       los colegios profesionales en esta feature]

CA-06  Dado un enlace de confirmación de correo
       Cuando se usa una segunda vez, o después de su vencimiento
       Entonces se rechaza con un mensaje que permite pedir uno nuevo, sin
       revelar si el primero era válido
```

### Ingreso y sesión

```gherkin
CA-07  Dado un correo y una contraseña correctos, sin MFA activado
       Cuando se envían al iniciar sesión
       Entonces se emite un token de acceso de vida corta y un token de
       refresco de vida más larga, y se registra el inicio de sesión en
       auditoría

CA-08  Dada una cuenta con MFA activado
       Cuando el correo y la contraseña son correctos
       Entonces el sistema exige el segundo factor antes de emitir cualquier
       token, y no revela si el primer factor fue correcto por sí solo

CA-09  Dada una contraseña incorrecta
       Cuando se reintenta más de N veces en una ventana de tiempo
       Entonces la cuenta aplica una demora creciente y, superado un umbral,
       un bloqueo temporal notificado al dueño de la cuenta

CA-10  Dado un token de refresco válido
       Cuando se usa para renovar el token de acceso
       Entonces se invalida y se emite uno nuevo (rotación), y el anterior
       queda registrado como usado

CA-11  Dado un token de refresco ya usado
       Cuando se intenta usar de nuevo
       Entonces el sistema interpreta reutilización, invalida TODAS las
       sesiones activas de esa cuenta y notifica al dueño

CA-12  Dado un token de acceso vencido
       Cuando se usa contra cualquier endpoint
       Entonces se rechaza sin distinguir "vencido" de "inválido" en el
       mensaje que ve el cliente, aunque el registro interno sí distinga

CA-13  Dada una persona con sesión iniciada
       Cuando consulta sus sesiones activas
       Entonces ve dispositivo aproximado, ubicación aproximada por IP y
       fecha de cada una, y puede cerrar cualquiera individualmente

CA-14  Dado un cierre de sesión a distancia (CA-13) o una detección de
       reutilización (CA-11)
       Cuando se ejecuta
       Entonces los tokens de esa sesión dejan de aceptarse de inmediato, sin
       esperar a su vencimiento natural
```

### Recuperación de contraseña

```gherkin
CA-15  Dado un pedido de recuperación con un correo
       Cuando se procesa
       Entonces se responde igual exista o no el correo (CA-02), y si existe
       se envía un enlace de un solo uso con vida corta

CA-16  Dado un enlace de recuperación válido
       Cuando se define una contraseña nueva
       Entonces se cierran TODAS las sesiones activas de la cuenta, se
       notifica el cambio al correo, y el enlace queda inutilizado

CA-17  Dado un enlace de recuperación vencido o ya usado
       Cuando se intenta usar
       Entonces se rechaza con opción de pedir uno nuevo
```

### RBAC por permiso

```gherkin
CA-18  Dado un mapa de permisos por rol (`CLIENTE`, `ABOGADO`,
       `ADMINISTRADOR`)
       Cuando se evalúa el acceso a una acción
       Entonces la evaluación es por PERMISO concreto, no por el nombre del
       rol — el rol es sólo el conjunto de permisos que trae por defecto

CA-19  Dado un abogado autenticado
       Cuando solicita el expediente de un caso
       Entonces la API verifica que el caso le fue asignado a ESE abogado
       específico, no sólo que su rol sea ABOGADO — la verificación ocurre en
       cada consulta, no sólo en el listado inicial

CA-20  Dado un usuario con un rol determinado
       Cuando intenta acceder a una ruta o a un dato de otro rol
       Entonces la API responde 403 y la interfaz lo redirige — el rechazo lo
       decide siempre la API; la interfaz nunca es el único límite

CA-21  Dado cualquier acceso a un recurso clasificado como dato personal o
       patrimonial sensible
       Cuando ocurre
       Entonces genera un `EventoAuditoria` con quién, cuándo, qué recurso y
       con qué resultado — reutilizando la entidad ya construida en la
       feature 001

CA-22  Dado un administrador autenticado
       Cuando consulta el panel de gestión de usuarios
       Entonces puede ver el estado de verificación profesional de un
       abogado y aprobarla o rechazarla, con su decisión auditada (CA-05,
       CA-21)
```

### Perfil y datos propios de cada rol

```gherkin
CA-23  Dado un cliente autenticado
       Cuando consulta su perfil
       Entonces ve y puede editar sus datos de contacto propios; el CUIT/CUIL
       verificado no es editable sin un proceso de reverificación

CA-24  Dado un abogado autenticado y verificado
       Cuando consulta su perfil
       Entonces ve su matrícula, jurisdicción y estado de verificación, y
       puede declarar sus especialidades — sin poder autoeditar la matrícula
       ya verificada

CA-25  Dado cualquier usuario
       Cuando pide exportar sus propios datos personales
       Entonces recibe sus datos de identidad y de sesión (no los de otros)
       en un formato legible — encaje mínimo con el derecho de acceso de la
       Ley 25.326, que la feature 003 desarrolla en profundidad
```

## 6. Reglas de negocio

| # | Regla | Fundamento |
| --- | --- | --- |
| R-01 | El administrador nunca se autorregistra: se crea por otro administrador o por una siembra inicial fuera de la interfaz pública. | Superficie de ataque. Un panel de administración con alta pública es una puerta de entrada. |
| R-02 | Las contraseñas se almacenan con `argon2id`, nunca en texto plano ni con un hash reversible. | Constitución #5. Estándar de la industria para contraseñas. |
| R-03 | El token de acceso no lleva datos patrimoniales sensibles en su contenido, sólo identidad y permisos. | Un token se loguea y se cachea en tránsito; no debe filtrar de más si se compromete. |
| R-04 | La verificación de matrícula de un abogado es, en esta feature, manual por un administrador. La integración automática con colegios profesionales es una integración futura (ver `docs/04-integraciones.md`, fuera de alcance acá). | No hay API pública unificada de colegios de abogados por jurisdicción; automatizarlo mal generaría verificaciones falsas. |
| R-05 | Ninguna respuesta de autenticación revela si un correo existe en el sistema. | Enumeración de usuarios es una fuga de datos personales por sí sola. |
| R-06 | Rotación de refresco con detección de reutilización es obligatoria, no opcional. | Es el mecanismo estándar para detectar un token robado sin esperar a que el daño ya esté hecho. |
| R-07 | RBAC se evalúa por permiso concreto en cada consulta, nunca sólo por rol en el punto de entrada. | Constitución #4 y #5: un abogado no debe poder alcanzar el caso de otro cambiando un identificador en la URL. |

## 7. Casos límite y errores

- Un abogado se registra con una matrícula que no corresponde a ninguna
  persona real o que ya está en uso por otra cuenta: el alta no falla en el
  acto (no hay verificación automática, R-04), pero el estado
  `PENDIENTE_DE_VERIFICACION_PROFESIONAL` bloquea toda acción de abogado hasta
  que un administrador decida.
- Doble registro con el mismo CUIT/CUIL y distinto correo: se detecta y se
  bloquea el segundo alta con un mensaje que no expone datos del primero.
- Pérdida del segundo factor de MFA sin códigos de respaldo: requiere proceso
  de soporte humano, no un camino automático (que sería una puerta trasera del
  MFA).
- Intento de recuperación de contraseña en una cuenta ya eliminada: responde
  igual que si no existiera (CA-02, CA-15).
- Reutilización de refresco detectada mientras el usuario tiene una operación
  en curso: la operación en curso también se corta; no hay excepción por
  estar "a mitad de algo".

## 8. Fuera de alcance

- **Consentimientos informados** propiamente dichos, versionados por
  finalidad, y los derechos de acceso/rectificación/supresión en profundidad
  → feature **003**. Acá sólo el enganche del checkbox de alta.
- **Verificación automática de matrícula** contra colegios profesionales →
  integración futura, ver `docs/04-integraciones.md`.
- **Perfiles de negocio completos** (historial de casos del cliente, cartera
  del abogado) → features de cada dominio (008, 012, 013).
- **Inicio de sesión social** (Google, etc.) → no evaluado en este ciclo.
- **Aplicación móvil**: el mismo backend de identidad, pero el almacenamiento
  seguro del token en el dispositivo y la biometría son de `dev-mobile` en su
  propia feature, no acá.

## 9. Decisiones pendientes

- `[NECESITA DECISIÓN 002-A: umbral y ventana de bloqueo por intentos fallidos]`
  CA-09 exige demora creciente y bloqueo temporal, sin fijar los números.
  Recomendación: 5 intentos, ventana de 15 minutos, bloqueo de 15 minutos con
  demora exponencial antes de eso. Parámetro configurable, no constante.

- `[NECESITA DECISIÓN 002-B: MFA obligatorio u opcional por rol]`
  Opciones: **A)** opcional para todos. **B)** obligatorio para abogado y
  administrador, opcional para cliente. **C)** obligatorio para todos.
  Recomendación: **B** — el abogado y el administrador acceden a más
  expedientes por sesión; el cliente es la audiencia con menos alfabetización
  digital y exigirle MFA desde el día uno puede ser una barrera de adopción
  real, sin que eso baje la vara para los otros dos roles.

- `[NECESITA DECISIÓN 002-C: quién crea la primera cuenta de administrador]`
  Opciones: **A)** script de siembra ejecutado manualmente en el despliegue,
  fuera de cualquier interfaz. **B)** variable de entorno con credenciales
  iniciales que se fuerza a cambiar en el primer ingreso.
  Recomendación: **A** — una variable de entorno con una contraseña, aunque se
  fuerce el cambio, es una ventana de tiempo con una credencial conocida.

## 10. Métricas de éxito

| Métrica | Objetivo |
| --- | --- |
| Tiempo de alta hasta cuenta verificada (cliente) | referencia a establecer con el piloto |
| Abogados en estado pendiente de verificación por más de 48 h | monitoreado, sin objetivo numérico aún — depende de disponibilidad del administrador |
| Incidentes de acceso cruzado entre roles detectados en producción | 0 |
| Reutilización de refresco detectada y contenida sin intervención manual | 100% |
