-- ─────────────────────────────────────────────────────────────────────────────
-- Reversión de la migración 0014 — verificacion_profesional
--
-- Se suelta primero la clave foránea que esta migración le agregó a una tabla
-- de la 0012: si no, el `DROP TABLE` de las decisiones no puede volver a un
-- estado idéntico al previo y la reversión deja residuo.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE IF EXISTS "acceso"."PerfilProfesional" DROP CONSTRAINT IF EXISTS "fk_perfil_ultima_decision";

DROP TABLE IF EXISTS "acceso"."EscalamientoDeVerificacion" CASCADE;
DROP TABLE IF EXISTS "acceso"."HitoDeVigenciaNotificado" CASCADE;
DROP TABLE IF EXISTS "acceso"."SuspensionDeMatricula" CASCADE;
DROP TABLE IF EXISTS "acceso"."DecisionDeVerificacion" CASCADE;
