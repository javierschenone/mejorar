-- ─────────────────────────────────────────────────────────────────────────────
-- Reversión de la migración 0021 — disparadores_de_integridad
--
-- Igual que la 0020: no destruye datos, **afloja invariantes**. Después de
-- aplicar esto, una cuenta puede quedar ACTIVA sin aceptación (CA-27), un
-- administrador puede existir sin designación (CA-33) y la bitácora se puede
-- editar (R-002-12). Sólo tiene sentido en una vuelta atrás completa.
--
-- Los disparadores caen solos con las tablas, pero se sueltan de forma
-- explícita para que esta reversión se pueda aplicar sola, sin las demás.
-- ─────────────────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS "tg_familia_revoca_tokens" ON "acceso"."FamiliaDeRefresco";
DROP TRIGGER IF EXISTS "tg_art6_exige_campos" ON "acceso"."VersionInformacionArt6";
DROP TRIGGER IF EXISTS "tg_designacion_cierra_siembra" ON "acceso"."DesignacionDeAdministrador";
DROP TRIGGER IF EXISTS "tg_usuario_admin_exige_designacion" ON "acceso"."Usuario";
DROP TRIGGER IF EXISTS "tg_usuario_activa_exige_aceptaciones" ON "acceso"."Usuario";
DROP TRIGGER IF EXISTS "tg_usuario_buzon_de_rol" ON "acceso"."Usuario";
DROP TRIGGER IF EXISTS "tg_perfil_mutabilidad" ON "acceso"."PerfilProfesional";
DROP TRIGGER IF EXISTS "tg_decision_proyecta_perfil" ON "acceso"."DecisionDeVerificacion";

DROP TRIGGER IF EXISTS "tg_retencion_mutabilidad" ON "acceso"."ReglaDeRetencion";
DROP TRIGGER IF EXISTS "tg_designacion_mutabilidad" ON "acceso"."DesignacionDeAdministrador";
DROP TRIGGER IF EXISTS "tg_restitucion_mutabilidad" ON "acceso"."SolicitudDeRestitucionMfa";
DROP TRIGGER IF EXISTS "tg_codigo_mutabilidad" ON "acceso"."CodigoDeRespaldo";
DROP TRIGGER IF EXISTS "tg_totp_mutabilidad" ON "acceso"."SecretoTotp";
DROP TRIGGER IF EXISTS "tg_envio_mutabilidad" ON "acceso"."EnvioTransaccional";
DROP TRIGGER IF EXISTS "tg_enlace_mutabilidad" ON "acceso"."EnlaceDeUnSoloUso";
DROP TRIGGER IF EXISTS "tg_bloqueo_mutabilidad" ON "acceso"."BloqueoDeTrafico";
DROP TRIGGER IF EXISTS "tg_desafio_mutabilidad" ON "acceso"."DesafioDeIngreso";
DROP TRIGGER IF EXISTS "tg_refresco_mutabilidad" ON "acceso"."TokenDeRefresco";
DROP TRIGGER IF EXISTS "tg_familia_mutabilidad" ON "acceso"."FamiliaDeRefresco";
DROP TRIGGER IF EXISTS "tg_sesion_mutabilidad" ON "acceso"."Sesion";
DROP TRIGGER IF EXISTS "tg_escalamiento_mutabilidad" ON "acceso"."EscalamientoDeVerificacion";
DROP TRIGGER IF EXISTS "tg_suspension_mutabilidad" ON "acceso"."SuspensionDeMatricula";
DROP TRIGGER IF EXISTS "tg_aceptacion_mutabilidad" ON "acceso"."AceptacionRegistrada";
DROP TRIGGER IF EXISTS "tg_duplicado_mutabilidad" ON "acceso"."ResolucionDeDuplicado";
DROP TRIGGER IF EXISTS "tg_ajuste_mutabilidad" ON "acceso"."AjustePermiso";
DROP TRIGGER IF EXISTS "tg_especialidad_mutabilidad" ON "acceso"."EspecialidadDeclarada";
DROP TRIGGER IF EXISTS "tg_usuario_mutabilidad" ON "acceso"."Usuario";

DROP TRIGGER IF EXISTS "tg_intento_inmutable" ON "acceso"."IntentoDeAutenticacion";
DROP TRIGGER IF EXISTS "tg_sello_inmutable" ON "auditoria"."SelloDeBitacora";
DROP TRIGGER IF EXISTS "tg_evento_inmutable" ON "auditoria"."EventoAuditoria";
DROP TRIGGER IF EXISTS "tg_purga_inmutable" ON "acceso"."EjecucionDePurga";
DROP TRIGGER IF EXISTS "tg_hito_inmutable" ON "acceso"."HitoDeVigenciaNotificado";
DROP TRIGGER IF EXISTS "tg_decision_inmutable" ON "acceso"."DecisionDeVerificacion";
DROP TRIGGER IF EXISTS "tg_campo_alta_inmutable" ON "acceso"."CampoDeclaradoEnElAlta";
DROP TRIGGER IF EXISTS "tg_art6_sin_borrado" ON "acceso"."VersionInformacionArt6";
DROP TRIGGER IF EXISTS "tg_art6_inmutable" ON "acceso"."VersionInformacionArt6";
DROP TRIGGER IF EXISTS "tg_documento_sin_borrado" ON "acceso"."VersionDocumentoAceptable";
DROP TRIGGER IF EXISTS "tg_documento_inmutable" ON "acceso"."VersionDocumentoAceptable";

DROP FUNCTION IF EXISTS "acceso"."revocar_tokens_de_la_familia"();
DROP FUNCTION IF EXISTS "acceso"."exigir_campos_declarados_del_alta"();
DROP FUNCTION IF EXISTS "acceso"."exigir_siembra_cerrada"();
DROP FUNCTION IF EXISTS "acceso"."exigir_designacion_y_auditoria"();
DROP FUNCTION IF EXISTS "acceso"."exigir_aceptaciones_para_activar"();
DROP FUNCTION IF EXISTS "acceso"."rechazar_buzon_de_rol"();
DROP FUNCTION IF EXISTS "acceso"."perfil_mutabilidad"();
DROP FUNCTION IF EXISTS "acceso"."proyectar_ultima_decision"();
DROP FUNCTION IF EXISTS "acceso"."solo_mutan_las_columnas_declaradas"();
DROP FUNCTION IF EXISTS "acceso"."prohibir_modificacion"();
