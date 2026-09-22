-- ─────────────────────────────────────────────────────────────────────────────
-- Reversión de la migración 0012 — cuenta_y_perfil
--
-- Prisma no la ejecuta nunca (ADR-007 §3). `CASCADE` acá es correcto y no
-- peligroso: sólo arrastra índices y restricciones de estas cinco tablas, y las
-- migraciones posteriores ya fueron revertidas cuando se llega a este archivo.
-- Sobre una base con datos reales esta reversión DESTRUYE CUENTAS: no se aplica
-- a un entorno sin G6 y sin respaldo, como dice modelo-datos §6.3.
-- ─────────────────────────────────────────────────────────────────────────────

DROP TABLE IF EXISTS "acceso"."ResolucionDeDuplicado" CASCADE;
DROP TABLE IF EXISTS "acceso"."AjustePermiso" CASCADE;
DROP TABLE IF EXISTS "acceso"."EspecialidadDeclarada" CASCADE;
DROP TABLE IF EXISTS "acceso"."PerfilProfesional" CASCADE;
DROP TABLE IF EXISTS "acceso"."Usuario" CASCADE;
