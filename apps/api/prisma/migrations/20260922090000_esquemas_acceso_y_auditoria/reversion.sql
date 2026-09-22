-- ─────────────────────────────────────────────────────────────────────────────
-- Reversión de la migración 0011 — esquemas_acceso_y_auditoria
--
-- Prisma NO ejecuta este archivo nunca (ADR-007 §3). Existe para que la vuelta
-- atrás esté escrita, revisada y probada, y para que modelo-datos §6.2
-- ("reversible: sí, DROP SCHEMA vacío") sea verificable en vez de declarativo.
--
-- Se revierte en el orden inverso al de aplicación: primero las migraciones
-- 0012 a 0023, que dejan los esquemas vacíos, y recién después ésta.
-- `DROP SCHEMA … RESTRICT` es deliberado: si quedara una tabla adentro, la
-- reversión FALLA en vez de destruirla en silencio.
-- ─────────────────────────────────────────────────────────────────────────────

DROP TYPE IF EXISTS "auditoria"."CanalDeOrigen";
DROP TYPE IF EXISTS "auditoria"."MotivoDenegacion";
DROP TYPE IF EXISTS "auditoria"."ResultadoEvento";
DROP TYPE IF EXISTS "auditoria"."TipoRecurso";
DROP TYPE IF EXISTS "auditoria"."AccionAuditada";
DROP TYPE IF EXISTS "auditoria"."ClasificacionDato";

DROP TYPE IF EXISTS "acceso"."ClaveDeRetencion";
DROP TYPE IF EXISTS "acceso"."AccionDeRetencion";
DROP TYPE IF EXISTS "acceso"."ResultadoVerificacionIdentidad";
DROP TYPE IF EXISTS "acceso"."ClaseDeComprobacionDeIdentidad";
DROP TYPE IF EXISTS "acceso"."EstadoSolicitudRestitucion";
DROP TYPE IF EXISTS "acceso"."ResultadoEnvio";
DROP TYPE IF EXISTS "acceso"."ModoEnvio";
DROP TYPE IF EXISTS "acceso"."ClavePlantillaCorreo";
DROP TYPE IF EXISTS "acceso"."PropositoEnlace";
DROP TYPE IF EXISTS "acceso"."ResultadoIntento";
DROP TYPE IF EXISTS "acceso"."SiguientePasoDesafio";
DROP TYPE IF EXISTS "acceso"."MotivoInvalidacionFamilia";
DROP TYPE IF EXISTS "acceso"."MotivoCierreSesion";
DROP TYPE IF EXISTS "acceso"."DispositivoClase";
DROP TYPE IF EXISTS "acceso"."NivelAutenticacion";
DROP TYPE IF EXISTS "acceso"."HitoDeVigencia";
DROP TYPE IF EXISTS "acceso"."MotivoLevantamientoSuspension";
DROP TYPE IF EXISTS "acceso"."MotivoDeSuspensionDeMatricula";
DROP TYPE IF EXISTS "acceso"."MotivoRechazoVerificacion";
DROP TYPE IF EXISTS "acceso"."ClaseDeConstancia";
DROP TYPE IF EXISTS "acceso"."ResultadoDecisionVerificacion";
DROP TYPE IF EXISTS "acceso"."CanalDeAceptacion";
DROP TYPE IF EXISTS "acceso"."CaracterDelCampo";
DROP TYPE IF EXISTS "acceso"."CampoDelAlta";
DROP TYPE IF EXISTS "acceso"."ClaseDocumentoAceptable";
DROP TYPE IF EXISTS "acceso"."ResultadoDeDuplicado";
DROP TYPE IF EXISTS "acceso"."ClaseDeDuplicado";
DROP TYPE IF EXISTS "acceso"."MotivoAjustePermiso";
DROP TYPE IF EXISTS "acceso"."EfectoAjuste";
DROP TYPE IF EXISTS "acceso"."Permiso";
DROP TYPE IF EXISTS "acceso"."Especialidad";
DROP TYPE IF EXISTS "acceso"."Jurisdiccion";
DROP TYPE IF EXISTS "acceso"."MotivoPurga";
DROP TYPE IF EXISTS "acceso"."EstadoMfa";
DROP TYPE IF EXISTS "acceso"."EstadoCuenta";
DROP TYPE IF EXISTS "acceso"."Rol";

DROP SCHEMA IF EXISTS "auditoria" RESTRICT;
DROP SCHEMA IF EXISTS "acceso" RESTRICT;

-- El rol `rol_acceso` NO se borra. Un rol puede tener privilegios otorgados
-- fuera de estas migraciones y borrarlo es una decisión de operación, no de
-- esquema. Mismo criterio que la reversión de la 0001 con los siete roles que
-- creó.
