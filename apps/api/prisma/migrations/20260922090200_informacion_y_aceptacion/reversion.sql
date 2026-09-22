-- ─────────────────────────────────────────────────────────────────────────────
-- Reversión de la migración 0013 — informacion_y_aceptacion
--
-- Advertencia con nombre propio: revertir esto DESTRUYE LA PRUEBA de qué texto
-- aceptó cada persona y de qué información del art. 6 se le mostró. Es
-- exactamente lo que el dictamen §9 llama "no se puede reparar después". En un
-- entorno con datos reales esta reversión no se aplica: se corrige hacia
-- adelante. Existe para la vuelta atrás de un despliegue sin datos.
-- ─────────────────────────────────────────────────────────────────────────────

DROP TABLE IF EXISTS "acceso"."AceptacionRegistrada" CASCADE;
DROP TABLE IF EXISTS "acceso"."CampoDeclaradoEnElAlta" CASCADE;
DROP TABLE IF EXISTS "acceso"."VersionInformacionArt6" CASCADE;
DROP TABLE IF EXISTS "acceso"."VersionDocumentoAceptable" CASCADE;
