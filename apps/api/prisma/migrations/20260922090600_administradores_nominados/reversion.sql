-- ─────────────────────────────────────────────────────────────────────────────
-- Reversión de la migración 0017 — administradores_nominados
--
-- Revertir esto deja cuentas con `rol = 'ADMINISTRADOR'` sin persona designada,
-- que es exactamente lo que CA-33 prohíbe. La vuelta atrás sólo tiene sentido
-- sobre una base sin cuentas administradoras nominales.
-- ─────────────────────────────────────────────────────────────────────────────

DROP TABLE IF EXISTS "acceso"."DesignacionDeAdministrador" CASCADE;
DROP TABLE IF EXISTS "acceso"."CorreoDeRolProhibido" CASCADE;
