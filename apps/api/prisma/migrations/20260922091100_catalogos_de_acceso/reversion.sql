-- ─────────────────────────────────────────────────────────────────────────────
-- Reversión de la migración 0023 — catalogos_de_acceso
--
-- Borra sólo lo que esta migración sembró, identificado por su versión o por su
-- clave. No usa `TRUNCATE` ni `DELETE` sin `WHERE`: si alguien cargó los textos
-- definitivos encima, esta reversión NO se los lleva puesto.
--
-- Las tres tablas de catálogo son de sólo inserción (§7.2) y sus disparadores
-- de la 0021 bloquean el `DELETE`. Se sueltan primero y se vuelven a poner al
-- final: la reversión es una operación de esquema, no de aplicación, y tiene
-- que poder deshacer lo que la migración hizo.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "acceso"."VersionDocumentoAceptable" DISABLE TRIGGER "tg_documento_sin_borrado";
ALTER TABLE "acceso"."VersionInformacionArt6" DISABLE TRIGGER "tg_art6_sin_borrado";
ALTER TABLE "acceso"."CampoDeclaradoEnElAlta" DISABLE TRIGGER "tg_campo_alta_inmutable";

DELETE FROM "acceso"."VersionDocumentoAceptable" WHERE "version" = '0-desarrollo';
DELETE FROM "acceso"."CampoDeclaradoEnElAlta" WHERE "version" = '0-desarrollo';
DELETE FROM "acceso"."VersionInformacionArt6" WHERE "version" = '0-desarrollo';

ALTER TABLE "acceso"."CampoDeclaradoEnElAlta" ENABLE TRIGGER "tg_campo_alta_inmutable";
ALTER TABLE "acceso"."VersionInformacionArt6" ENABLE TRIGGER "tg_art6_sin_borrado";
ALTER TABLE "acceso"."VersionDocumentoAceptable" ENABLE TRIGGER "tg_documento_sin_borrado";

DELETE FROM "acceso"."ParametroDeAcceso" WHERE "clave" IN (
  'ingreso.intentosMaximos', 'ingreso.ventanaDeConteoSegundos',
  'ingreso.duracionDelBloqueoSegundos', 'token.accesoVidaSegundos',
  'token.refrescoVidaSegundos', 'desafio.vidaSegundos',
  'enlace.confirmacionVidaSegundos', 'enlace.recuperacionVidaSegundos',
  'matricula.vigenciaVerificacionMeses', 'matricula.plazoMaximoRevisionDiasCorridos',
  'mfa.ventanaReautenticacionFuerteSegundos', 'mfa.restitucionEsperaObligatoriaSegundos',
  'mfa.codigosDeRespaldoPorLote', 'purga.cuentaNoVerificadaDiasDeGracia'
);

-- Las reglas de retención se borran al final: si hubiera una `EjecucionDePurga`
-- registrada contra alguna, la clave foránea `ON DELETE RESTRICT` hace fallar
-- esta reversión. Es lo correcto: borrar la regla dejaría una purga ejecutada
-- sin la regla que la autorizó.
DELETE FROM "acceso"."ReglaDeRetencion";
