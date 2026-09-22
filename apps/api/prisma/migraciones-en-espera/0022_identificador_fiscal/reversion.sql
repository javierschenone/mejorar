-- ─────────────────────────────────────────────────────────────────────────────
-- Reversión de la migración 0022 — identificador_fiscal
--
-- Es la reversión más barata de toda la feature, y eso no es casualidad: la
-- tabla se diseñó separada de `Usuario` precisamente para que diferir el
-- CUIT/CUIL a la feature 007 sea un `DROP TABLE` y no cirugía sobre la tabla de
-- cuentas (escalamiento E-002-1). Ninguna otra tabla la referencia.
-- ─────────────────────────────────────────────────────────────────────────────

DROP TABLE IF EXISTS "acceso"."IdentificadorFiscal" CASCADE;
