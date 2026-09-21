-- ─────────────────────────────────────────────────────────────────────────────
-- Reversión de la migración 0002 — catalogo_normativo
--
-- Prisma NO ejecuta este archivo (ADR-007 §3). Se versiona para que la vuelta
-- atrás esté escrita y revisada, y para que el test de migración pueda
-- demostrar la reversibilidad que exige modelo-datos §6.2.
--
-- ADVERTENCIA: esto borra el catálogo normativo entero. Es seguro mientras las
-- tablas estén vacías —el caso de la primera entrega—. Con datos adentro, la
-- vuelta atrás se escribe como una migración nueva, porque un catálogo borrado
-- es la pérdida de la capacidad de reproducir resultados pasados (CA-31).
-- ─────────────────────────────────────────────────────────────────────────────

-- Orden inverso al de creación: primero lo que depende, después lo referenciado.
DROP TABLE IF EXISTS "motor"."CatalogoTramo";
DROP TABLE IF EXISTS "motor"."CatalogoNormativo";
DROP TABLE IF EXISTS "motor"."TramoParametroCita";
DROP TABLE IF EXISTS "motor"."CitaNormativa";
DROP TABLE IF EXISTS "motor"."TramoParametro";
DROP TABLE IF EXISTS "motor"."Ratificacion";
DROP TABLE IF EXISTS "motor"."MatriculaProfesional";
DROP TABLE IF EXISTS "motor"."ParametroNormativo";

DROP TYPE IF EXISTS "motor"."EstadoCatalogo";
DROP TYPE IF EXISTS "motor"."EstadoMatricula";
DROP TYPE IF EXISTS "motor"."MotivoRevocacion";
DROP TYPE IF EXISTS "motor"."TipoNorma";
DROP TYPE IF EXISTS "motor"."ClaveNotaDeAlcance";
DROP TYPE IF EXISTS "motor"."EstadoRatificacion";
DROP TYPE IF EXISTS "motor"."Confiabilidad";
DROP TYPE IF EXISTS "motor"."DisponibilidadParametro";
DROP TYPE IF EXISTS "motor"."Jurisdiccion";
DROP TYPE IF EXISTS "motor"."TipoValorParametro";
DROP TYPE IF EXISTS "motor"."AnalisisMotor";
