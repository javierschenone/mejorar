# Spec 001 — Fundaciones del monorepo

| Campo | Valor |
| --- | --- |
| Estado | EN REVISIÓN (G1) |
| Autor | orquestador |
| Revisor legal | no aplica (sin tratamiento de datos) |
| Compuerta | G1 |
| Principios de la constitución involucrados | #2 (spec antes que código), #4 (separación de roles), #14 (todo lo que se afirma, se prueba) |

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

CA-10  Dado el sistema levantado con datos de demostración
       Cuando se ingresa con el usuario de demostración de cada perfil
       (cliente, abogado, administrador)
       Entonces cada uno ve su portal con datos coherentes y no ve los de otro

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
