# Modelo de datos NNN — <Título>

| Campo | Valor |
| --- | --- |
| Autor | database-engineer |
| Spec de origen | `specs/NNN-slug/spec.md` |
| Estado | BORRADOR \| APROBADO (G2) |

## 1. Entidades

Por cada entidad: propósito, atributos con tipo y obligatoriedad, invariantes.

## 2. Diagrama de relaciones

Cardinalidades y sentido de las dependencias.

## 3. Índices y patrones de acceso

| Consulta esperada | Frecuencia | Índice que la sirve |
| --- | --- | --- |

## 4. Datos sensibles

| Campo | Clasificación | Tratamiento (cifrado, hash, tokenización) | Base legal |
| --- | --- | --- | --- |

## 5. Retención y supresión

Plazo de conservación por entidad, criterio de anonimización, y cómo se ejecuta
un pedido de supresión del titular (Ley 25.326, art. 16).

## 6. Migración

Script, reversibilidad, impacto sobre datos existentes, tiempo estimado de
bloqueo.

## 7. Integridad

Constraints, unicidad, claves foráneas, y qué invariantes quedan en la
aplicación porque la base no puede expresarlas.
