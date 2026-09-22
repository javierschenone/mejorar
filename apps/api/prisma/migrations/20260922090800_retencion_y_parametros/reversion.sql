-- ─────────────────────────────────────────────────────────────────────────────
-- Reversión de la migración 0019 — retencion_y_parametros
--
-- Revertir esto borra la constancia de las purgas ya ejecutadas (H.2), que es
-- la prueba de qué se destruyó y bajo qué regla. No se aplica a un entorno que
-- ya haya corrido una purga.
-- ─────────────────────────────────────────────────────────────────────────────

DROP TABLE IF EXISTS "acceso"."ParametroDeAcceso" CASCADE;
DROP TABLE IF EXISTS "acceso"."EjecucionDePurga" CASCADE;
DROP TABLE IF EXISTS "acceso"."ReglaDeRetencion" CASCADE;
