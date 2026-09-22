-- ─────────────────────────────────────────────────────────────────────────────
-- Reversión de la migración 0016 — segundo_factor
--
-- Revertir esto DESTRUYE LOS SECRETOS TOTP: quienes tenían segundo factor lo
-- pierden y hay que reinscribirlos. Para las cuentas de administrador y de
-- abogado eso las deja no operativas hasta reinscribir (CA-32, CA-38). No se
-- aplica a un entorno con cuentas reales sin G6.
-- ─────────────────────────────────────────────────────────────────────────────

DROP TABLE IF EXISTS "acceso"."SolicitudDeRestitucionMfa" CASCADE;
DROP TABLE IF EXISTS "acceso"."CodigoDeRespaldo" CASCADE;
DROP TABLE IF EXISTS "acceso"."SecretoTotp" CASCADE;
