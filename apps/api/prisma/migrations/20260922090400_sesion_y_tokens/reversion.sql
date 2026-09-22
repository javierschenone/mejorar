-- ─────────────────────────────────────────────────────────────────────────────
-- Reversión de la migración 0015 — sesion_y_tokens
--
-- Primero la clave foránea que esta migración le agregó a C.3, que es de la
-- 0014 y tiene que quedar como estaba.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE IF EXISTS "acceso"."HitoDeVigenciaNotificado"
  DROP CONSTRAINT IF EXISTS "HitoDeVigenciaNotificado_envioId_fkey";

DROP TABLE IF EXISTS "acceso"."EnlaceDeUnSoloUso" CASCADE;
DROP TABLE IF EXISTS "acceso"."BloqueoDeTrafico" CASCADE;
DROP TABLE IF EXISTS "acceso"."IntentoDeAutenticacion" CASCADE;
DROP TABLE IF EXISTS "acceso"."DesafioDeIngreso" CASCADE;
DROP TABLE IF EXISTS "acceso"."TokenDeRefresco" CASCADE;
DROP TABLE IF EXISTS "acceso"."FamiliaDeRefresco" CASCADE;
DROP TABLE IF EXISTS "acceso"."Sesion" CASCADE;
DROP TABLE IF EXISTS "acceso"."EnvioTransaccional" CASCADE;
