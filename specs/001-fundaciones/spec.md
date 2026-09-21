# Spec 001 — Fundaciones del monorepo

| Campo | Valor |
| --- | --- |
| Versión | **2** — retira CA-10, ver §0 |
| Estado | EN REVISIÓN (G1) — reabierta parcialmente |
| Autor | orquestador |
| Revisor legal | no aplica (sin tratamiento de datos) |
| Compuerta | G1 |
| Principios de la constitución involucrados | #2 (spec antes que código), #4 (separación de roles), #14 (todo lo que se afirma, se prueba) |

## 0. Cambios de la versión 2

En G2, el `arquitecto` resolvió CA-10 acotándolo a tres afirmaciones mínimas
sobre `Usuario` y `EventoAuditoria` (escalamiento E-02, `plan.md` §5.3). El
product owner rechazó esa resolución: esperaba el mapa real de rol a permisos,
perfiles de cliente y abogado con datos propios, y autenticación real (MFA,
refresh, recuperación) — es decir, el contenido íntegro de la feature **002
(Identidad y acceso)**, ya prevista en el backlog.

**Consecuencia:** CA-10 pedía, sin saberlo, el trabajo completo de otra
feature. La corrección no es ampliar 001 hasta cubrirlo — eso duplicaría el
trabajo de 002 y volvería a 001 dependiente de una spec que todavía no existe
— sino **retirar CA-10 de 001** y trasladar esa responsabilidad, íntegra, a
002. El resto del trabajo de G2 de 001 (ADR-001 a 009, `plan.md`) **no se ve
afectado**: ninguno dependía de un modelo de identidad real, sólo de que
`Usuario` y `EventoAuditoria` existieran como andamiaje mínimo para probar el
pipeline — y ese andamiaje se conserva como lo que es, infraestructura de
prueba, no como sustituto de 002.

Registrado en `specs/REGISTRO-COMPUERTAS.md`, entradas 031 a 033.

## 1. Problema

No hay base técnica común. Sin ella, cada agente desarrollador inventaría su
propia estructura, sus propias versiones y su propia forma de correr los tests,
y el resultado sería imposible de auditar y de integrar. Además, el repositorio
ya contiene andamiaje creado **antes** de adoptar SDD, que nadie revisó.

## 2. Audiencia

El equipo de desarrollo: los ocho agentes que van a escribir código, y cualquier
persona que se sume al proyecto.

Audiencia indirecta: el product owner, que necesita poder correr el producto y
verlo funcionando sin pelearse con el entorno.

## 3. Resultado esperado

Cualquiera clona el repositorio, ejecuta una secuencia corta y documentada de
comandos, y obtiene el sistema corriendo con datos de demostración — sin una
sola credencial de terceros.

## 4. Recorrido del usuario

1. Clona el repositorio.
2. Ejecuta la instalación de dependencias.
3. Copia el archivo de variables de ejemplo.
4. Levanta los servicios de infraestructura local.
5. Prepara la base y carga datos de demostración.
6. Levanta la API, la web y la app móvil.
7. Ingresa con un usuario de demostración de cada perfil y ve datos coherentes.
8. Ejecuta los tests y obtiene un resultado verde y legible.

## 5. Criterios de aceptación

```gherkin
CA-01  Dado un repositorio recién clonado en una máquina con Node 22 y pnpm
       Cuando se ejecuta la instalación de dependencias
       Entonces termina sin errores y sin advertencias de versiones incompatibles

CA-02  Dado el repositorio instalado
       Cuando se consulta la estructura del workspace
       Entonces existen exactamente los paquetes shared, integrations, api, web
       y mobile, cada uno con su manifiesto y su configuración de TypeScript

CA-03  Dado el repositorio instalado
       Cuando se ejecuta la compilación completa
       Entonces compilan en orden las librerías compartidas y luego las
       aplicaciones, sin errores de tipos

CA-04  Dado el repositorio instalado
       Cuando se ejecuta la suite de tests
       Entonces corre y reporta resultados por paquete, con al menos un test real
       por paquete que tenga código

CA-05  Dado el archivo de variables de ejemplo copiado sin modificar
       Cuando se levanta la API
       Entonces arranca en modo de integraciones simulado y responde el chequeo
       de salud, sin requerir ninguna credencial de terceros

CA-06  Dada una variable de entorno obligatoria ausente
       Cuando se intenta arrancar la API
       Entonces falla inmediatamente con un mensaje que nombra la variable
       faltante, en lugar de arrancar en estado inconsistente

CA-07  Dado el repositorio instalado
       Cuando un agente desarrollador intenta importar código de un paquete
       fuera de su alcance declarado
       Entonces la configuración de TypeScript o de dependencias lo impide

CA-08  Dado un cambio subido a una rama
       Cuando corre el pipeline de integración continua
       Entonces ejecuta en orden verificación de formato, de tipos, tests y
       compilación, y falla de forma visible ante cualquier error

CA-09  Dado un commit que no respeta la convención de mensajes
       Cuando se intenta registrar
       Entonces el sistema lo advierte indicando el formato esperado

CA-10  Dado el sistema levantado con datos de demostración                  [v2]
       Cuando se consulta la API con el usuario de demostración
       Entonces responde con el `EventoAuditoria` correspondiente a esa
       consulta y no con los de otro usuario
       [Retirado el alcance de "los tres perfiles ven su portal": eso es
       íntegramente de la feature 002. Este criterio se limita a probar que
       el andamiaje de auditoría de 001 (R-04, ADR-007 §4) funciona end to
       end, sin simular un login ni un RBAC que no existen todavía. Ver §0]

CA-11  Dado el archivo README del repositorio
       Cuando una persona nueva lo sigue paso a paso
       Entonces llega al sistema corriendo sin necesitar información externa
```

## 6. Reglas de negocio

| # | Regla | Fundamento |
| --- | --- | --- |
| R-01 | El modo de integraciones por defecto es simulado. | Constitución #2 y #14: el sistema tiene que ser verificable sin depender de terceros. |
| R-02 | Ningún secreto real vive en el repositorio, ni siquiera de ejemplo. | Constitución #5. |
| R-03 | Las librerías compartidas se compilan antes que las aplicaciones y se consumen como paquetes del workspace. | Garantiza que web, móvil y API usen exactamente las mismas reglas de negocio. |
| R-04 | Cada paquete declara su alcance de escritura y sus dependencias permitidas. | Constitución #4: la separación de roles debe ser mecánica, no voluntaria. |
| R-05 | Los datos de demostración son generados, nunca datos reales de personas. | Constitución #5. |

## 7. Casos límite y errores

- Node o pnpm en versión distinta a la declarada: el arranque debe advertirlo
  con claridad, no fallar de forma críptica.
- Docker no disponible: debe existir un camino documentado para correr contra
  una base de datos externa.
- Puertos ocupados: mensaje claro y variable para cambiarlos.
- Instalación sin red luego de la primera vez: debe funcionar desde caché.

## 8. Fuera de alcance

- Entornos de homologación y producción, infraestructura en la nube y
  publicación en tiendas de aplicaciones → spec **025**.
- Adaptadores HTTP reales de cualquier integración → specs de cada feature.
- Modelo de datos del negocio: acá sólo lo mínimo para que el seed de
  demostración funcione → el modelo completo se define en cada feature.
- Sistema de diseño visual → spec **002** en adelante, a cargo de `ux-expert`.
- **Modelo de identidad, RBAC por permiso, perfiles de cliente/abogado, MFA,
  refresh, recuperación de contraseña, y toda experiencia real de login** →
  íntegramente spec **002 (Identidad y acceso)**. Retirado de 001 en la
  versión 2 (§0). El ingreso de 001, si existe como andamiaje de prueba, no
  simula RBAC ni perfiles: prueba únicamente que la auditoría funciona.

## 9. Decisiones pendientes

- `[NECESITA DECISIÓN 001-A: destino del andamiaje preexistente]`
  El repositorio ya tiene `package.json`, `pnpm-workspace.yaml`,
  `tsconfig.base.json`, `docker-compose.yml` y `.env.example` creados antes de
  adoptar SDD.
  Opciones: **A)** el `arquitecto` los revisa en G2 y los ratifica o corrige.
  **B)** se descartan y se rehacen desde cero desde el plan.
  Recomendación: **A** — son convencionales y rehacerlos no agrega información,
  pero quedan sujetos a su revisión formal.

## 10. Métricas de éxito

| Métrica | Objetivo |
| --- | --- |
| Tiempo desde clonar hasta ver el sistema corriendo | menos de 15 minutos en una máquina limpia |
| Pasos manuales del README | 7 o menos |
| Duración del pipeline completo | menos de 10 minutos |
| Paquetes sin test | 0 |
