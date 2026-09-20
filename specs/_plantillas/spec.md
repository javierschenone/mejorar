# Spec NNN — <Título de la feature>

| Campo | Valor |
| --- | --- |
| Estado | BORRADOR \| EN REVISIÓN \| APROBADA (G1) \| EN IMPLEMENTACIÓN \| VALIDADA \| OBSOLETA |
| Autor | orquestador |
| Revisor legal | compliance-legal |
| Compuerta | G1 |
| Principios de la constitución involucrados | #N, #N |

## 1. Problema

Qué le pasa hoy a la persona. En su idioma, no en el nuestro. Con evidencia si la
hay.

## 2. Audiencia

Cliente deudor / Abogado / Administrador / Operador. Si son varias, el impacto en
cada una por separado.

## 3. Resultado esperado

Una frase. Qué es verdad en el mundo cuando esto esté hecho.

## 4. Recorrido del usuario

Paso a paso del camino principal, en lenguaje de negocio. Sin pantallas, sin
endpoints, sin tablas.

## 5. Criterios de aceptación

Formato Gherkin. Cada criterio debe poder verificarse con un sí o un no.

```gherkin
CA-01  Dado <contexto>
       Cuando <acción>
       Entonces <resultado observable>
```

## 6. Reglas de negocio

Reglas explícitas, numeradas, cada una con su fundamento (comercial o
normativo).

| # | Regla | Fundamento |
| --- | --- | --- |

## 7. Casos límite y errores

Qué pasa cuando el dato no está, el tercero no responde, el monto es cero, la
fecha es futura, el usuario abandona a la mitad.

## 8. Fuera de alcance

Obligatorio. Lo que explícitamente **no** hace esta feature y en qué spec futura
se resuelve.

## 9. Decisiones pendientes

Marcar todo lo ambiguo. Una spec con marcas abiertas no pasa G1.

- `[NECESITA DECISIÓN: <pregunta concreta>]` — Opciones: A) … B) … Recomendación: …

## 10. Métricas de éxito

Cómo sabremos, con datos, si esto sirvió.
