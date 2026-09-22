-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 0011 — esquemas_acceso_y_auditoria
-- Feature 002, tarea T-03. Fila `0011` de
-- specs/002-identidad-y-acceso/modelo-datos.md §6.2.
--
-- Es la primera migración de la feature 002 y la que declara su frontera:
-- DOS ESQUEMAS PROPIOS, y ni una tabla dentro de `motor`.
--
-- Por qué (decisión D-1 del modelo de datos): la migración 0001 dejó escrito
-- que `motor` NO tiene datos identificatorios del deudor (CA-60 de la 004,
-- condición C-10). La 002 es exactamente lo contrario: es donde vive el correo
-- y el nombre. Mezclarlas destruiría la garantía que la 004 compró con esa
-- separación. Y no se toca `identidad`, que es de la feature 007 y que Prisma
-- no administra.
--
-- Base sin datos de esta feature: bloqueo nulo (modelo-datos §6.3).
-- Reversión: reversion.sql de este mismo directorio.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE SCHEMA IF NOT EXISTS "acceso";
CREATE SCHEMA IF NOT EXISTS "auditoria";

COMMENT ON SCHEMA "acceso" IS
  'Identidad y acceso (feature 002). Cuentas, credenciales, sesiones, segundo factor, aceptaciones y verificacion profesional. ACA SI hay datos personales: correo y nombre van cifrados en reposo con indice ciego (D-4). Rol rol_acceso, clave k_acceso.';
COMMENT ON SCHEMA "auditoria" IS
  'Bitacora inmutable de accesos y acciones (feature 002, bloque G). Particionada por rango mensual. Sin UPDATE ni DELETE desde ningun rol de aplicacion; sellada con raiz de Merkle firmada. Constitucion #5, Ley 25.326.';

-- ─────────────────────────────────────────────────────────────────────────────
-- Rol de aplicación propio
--
-- Mismo criterio y mismo manejo de error que la migración 0001: si el rol que
-- aplica la migración no puede crear roles (entorno gestionado), se avisa y se
-- sigue. Los privilegios concretos son de la migración 0020.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rol_acceso') THEN
    BEGIN
      EXECUTE 'CREATE ROLE rol_acceso NOLOGIN';
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE NOTICE 'No se pudo crear el rol rol_acceso: privilegios insuficientes. Aprovisionarlo fuera de la migración (modelo-datos §7.4).';
    END;
  END IF;
END
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Dependencia declarada con la feature 004: `motor.DiaNoHabil`
--
-- CA-31 habla de DÍAS HÁBILES. El calendario ya está diseñado en el Bloque E de
-- la 004 y este modelo NO lo duplica (modelo-datos C.4): duplicarlo garantizaría
-- que los dos se desincronicen. El `GRANT` se otorga en cuanto la tabla exista.
-- Hoy el Bloque E todavía no está implementado (tareas T-06/T-09 de la 004), así
-- que la concesión es CONDICIONAL: la migración no puede fallar por una tabla
-- que otra feature todavía no creó, y tampoco puede olvidarse el permiso.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'motor' AND c.relname = 'DiaNoHabil'
  ) THEN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rol_acceso') THEN
      EXECUTE 'GRANT USAGE ON SCHEMA "motor" TO rol_acceso';
      EXECUTE 'GRANT SELECT ON "motor"."DiaNoHabil" TO rol_acceso';
    END IF;
  ELSE
    RAISE NOTICE 'motor."DiaNoHabil" todavía no existe (Bloque E de la 004, tareas T-06/T-09). El GRANT SELECT para rol_acceso que exige CA-31 queda pendiente y lo otorga la migración que cree esa tabla.';
  END IF;
END
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Enumeraciones de `acceso`
--
-- Todas juntas y en la primera migración, como dice modelo-datos §6.2: son
-- catálogos cerrados compartidos por varios bloques, y agregar un valor a
-- cualquiera de ellos es una revisión aditiva que se decide en compuerta.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TYPE "acceso"."Rol" AS ENUM ('CLIENTE', 'ABOGADO', 'ADMINISTRADOR');

-- `BLOQUEADA_TEMPORALMENTE` del contrato NO es un valor de este tipo, y su
-- ausencia es el diseño (escalamiento E-002-7): el bloqueo por intentos
-- fallidos se aplica también a cuentas que NO existen, y una cuenta inexistente
-- no tiene fila donde guardarlo. Almacenarlo sería un oráculo de enumeración.
-- Vive en D.6, indexado por `claveDeTrafico`, y se DERIVA al armar el perfil.
CREATE TYPE "acceso"."EstadoCuenta" AS ENUM ('NO_VERIFICADA', 'ACTIVA', 'PENDIENTE_DE_INSCRIPCION_MFA', 'RESTITUCION_MFA_EN_CURSO', 'SUSPENDIDA', 'PURGADA');

CREATE TYPE "acceso"."EstadoMfa" AS ENUM ('NO_CONFIGURADO', 'INSCRIPCION_PENDIENTE_DE_CONFIRMACION', 'ACTIVO', 'BLOQUEADO_POR_RESTITUCION');

CREATE TYPE "acceso"."MotivoPurga" AS ENUM ('NUNCA_CONFIRMADA', 'PEDIDO_DEL_TITULAR', 'BAJA_DE_CUENTA');

-- Las 24 jurisdicciones del contrato más `FEDERAL`. NO es `motor.Jurisdiccion`,
-- que tiene 7 valores y otro alcance: son dos tipos distintos en dos esquemas
-- distintos, y tiene que seguir siendo así.
CREATE TYPE "acceso"."Jurisdiccion" AS ENUM ('CABA', 'BUENOS_AIRES', 'CATAMARCA', 'CHACO', 'CHUBUT', 'CORDOBA', 'CORRIENTES', 'ENTRE_RIOS', 'FORMOSA', 'JUJUY', 'LA_PAMPA', 'LA_RIOJA', 'MENDOZA', 'MISIONES', 'NEUQUEN', 'RIO_NEGRO', 'SALTA', 'SAN_JUAN', 'SAN_LUIS', 'SANTA_CRUZ', 'SANTA_FE', 'SANTIAGO_DEL_ESTERO', 'TIERRA_DEL_FUEGO', 'TUCUMAN', 'FEDERAL');

CREATE TYPE "acceso"."Especialidad" AS ENUM ('EJECUCIONES', 'DEFENSA_DEL_CONSUMIDOR', 'CONCURSOS_Y_QUIEBRAS');

-- Los 25 permisos del contrato §2, con su literal exacto (con puntos).
CREATE TYPE "acceso"."Permiso" AS ENUM ('perfil.leer.propio', 'perfil.editar.propio', 'perfil.exportar.propio', 'perfil.declararEspecialidades.propio', 'contrasena.cambiar.propia', 'mfa.inscribir.propio', 'mfa.desactivar.propio', 'mfa.regenerarCodigosDeRespaldo.propio', 'sesion.listar.propia', 'sesion.cerrar.propia', 'auditoria.leer.propia', 'auditoria.leer.total', 'usuario.listar', 'usuario.leer', 'usuario.crearAdministrador', 'usuario.suspender', 'matricula.leer', 'matricula.verificar', 'matricula.suspender', 'restitucionMfa.solicitar.propia', 'restitucionMfa.instruir', 'restitucionMfa.aprobar', 'caso.leer.asignado', 'caso.actuar.asignado', 'caso.recibirAsignacion');

CREATE TYPE "acceso"."EfectoAjuste" AS ENUM ('CONCEDE', 'RETIRA');

CREATE TYPE "acceso"."MotivoAjustePermiso" AS ENUM ('DELEGACION_TEMPORAL', 'INCIDENTE_DE_SEGURIDAD', 'PEDIDO_DEL_TITULAR', 'SANCION_INTERNA', 'CORRECCION_DE_ALTA', 'DECISION_DE_LA_PLATAFORMA');

CREATE TYPE "acceso"."ClaseDeDuplicado" AS ENUM ('CORREO', 'CUIT_CUIL');

CREATE TYPE "acceso"."ResultadoDeDuplicado" AS ENUM ('PENDIENTE', 'DESCARTADA', 'CONFIRMADA_POR_EL_TITULAR');

CREATE TYPE "acceso"."ClaseDocumentoAceptable" AS ENUM ('TERMINOS_Y_CONDICIONES', 'POLITICA_DE_PRIVACIDAD');

CREATE TYPE "acceso"."CampoDelAlta" AS ENUM ('CORREO', 'CONTRASENA', 'NOMBRE_PARA_MOSTRAR', 'CUIT_CUIL', 'MATRICULA', 'JURISDICCION');

CREATE TYPE "acceso"."CaracterDelCampo" AS ENUM ('OBLIGATORIO', 'FACULTATIVO');

CREATE TYPE "acceso"."CanalDeAceptacion" AS ENUM ('WEB', 'MOVIL');

CREATE TYPE "acceso"."ResultadoDecisionVerificacion" AS ENUM ('APROBADA', 'RECHAZADA');

CREATE TYPE "acceso"."ClaseDeConstancia" AS ENUM ('CONSTANCIA_EMITIDA_POR_EL_COLEGIO', 'CONSULTA_AL_PADRON_PUBLICO', 'CREDENCIAL_PROFESIONAL', 'OTRA');

CREATE TYPE "acceso"."MotivoRechazoVerificacion" AS ENUM ('CONSTANCIA_ILEGIBLE', 'CONSTANCIA_VENCIDA', 'MATRICULA_NO_FIGURA_EN_EL_PADRON', 'DATOS_NO_COINCIDEN_CON_LO_DECLARADO', 'MATRICULA_SUSPENDIDA_O_CANCELADA', 'JURISDICCION_NO_COINCIDE', 'DOCUMENTACION_INSUFICIENTE');

CREATE TYPE "acceso"."MotivoDeSuspensionDeMatricula" AS ENUM ('NOTIFICACION_DEL_COLEGIO', 'DENUNCIA_RECIBIDA', 'PEDIDO_DEL_PROFESIONAL', 'DECISION_DE_LA_PLATAFORMA');

CREATE TYPE "acceso"."MotivoLevantamientoSuspension" AS ENUM ('RESUELTA_POR_EL_COLEGIO', 'DENUNCIA_DESESTIMADA', 'PEDIDO_DEL_PROFESIONAL', 'ERROR_DE_LA_PLATAFORMA');

CREATE TYPE "acceso"."HitoDeVigencia" AS ENUM ('POR_VENCER_30D', 'POR_VENCER_7D', 'VENCIDA');

CREATE TYPE "acceso"."NivelAutenticacion" AS ENUM ('CONTRASENA', 'CONTRASENA_Y_SEGUNDO_FACTOR');

CREATE TYPE "acceso"."DispositivoClase" AS ENUM ('ESCRITORIO', 'TELEFONO', 'TABLETA', 'APLICACION_MOVIL', 'DESCONOCIDO');

CREATE TYPE "acceso"."MotivoCierreSesion" AS ENUM ('CIERRE_DEL_TITULAR', 'CIERRE_A_DISTANCIA', 'REUTILIZACION_DE_REFRESCO', 'CAMBIO_DE_CONTRASENA', 'VENCIMIENTO', 'SUSPENSION_DE_CUENTA');

CREATE TYPE "acceso"."MotivoInvalidacionFamilia" AS ENUM ('CIERRE_DE_SESION', 'REUTILIZACION_DETECTADA', 'CAMBIO_DE_CONTRASENA', 'VENCIMIENTO');

CREATE TYPE "acceso"."SiguientePasoDesafio" AS ENUM ('SEGUNDO_FACTOR', 'CONFIRMAR');

CREATE TYPE "acceso"."ResultadoIntento" AS ENUM ('EXITO', 'CREDENCIAL_INVALIDA', 'SEGUNDO_FACTOR_INVALIDO', 'CUENTA_INEXISTENTE');

CREATE TYPE "acceso"."PropositoEnlace" AS ENUM ('CONFIRMACION_DE_CORREO', 'RECUPERACION_DE_CONTRASENA');

CREATE TYPE "acceso"."ClavePlantillaCorreo" AS ENUM ('CONFIRMACION_DE_CORREO', 'INTENTO_DE_ALTA_CON_CORREO_YA_REGISTRADO', 'INTENTO_DE_ALTA_CON_CUIT_YA_REGISTRADO', 'RECUPERACION_DE_CONTRASENA', 'CONTRASENA_CAMBIADA', 'CUENTA_BLOQUEADA_TEMPORALMENTE', 'REUTILIZACION_DE_REFRESCO', 'SESION_CERRADA_A_DISTANCIA', 'SEGUNDO_FACTOR_ACTIVADO', 'SEGUNDO_FACTOR_DESACTIVADO', 'RESTITUCION_MFA_EN_CURSO', 'RESTITUCION_MFA_RESUELTA', 'MATRICULA_POR_VENCER', 'MATRICULA_VENCIDA', 'MATRICULA_SUSPENDIDA', 'CUENTA_ADMINISTRADORA_CREADA');

CREATE TYPE "acceso"."ModoEnvio" AS ENUM ('MOCK', 'SMTP_LOCAL', 'PROVEEDOR');

CREATE TYPE "acceso"."ResultadoEnvio" AS ENUM ('ENCOLADO', 'ENVIADO', 'RECHAZADO', 'FALLIDO');

CREATE TYPE "acceso"."EstadoSolicitudRestitucion" AS ENUM ('RECIBIDA', 'ESPERANDO_VERIFICACION_DE_IDENTIDAD', 'EN_ESPERA_OBLIGATORIA', 'APROBADA', 'RECHAZADA', 'CANCELADA_POR_EL_TITULAR');

-- `A_DEFINIR_EN_G2` sigue en la lista a propósito: el catálogo concreto de
-- comprobaciones admisibles y su base legal los define `compliance-legal` con
-- el product owner (escalamiento E-002-2). Por eso E.4 no se crea.
CREATE TYPE "acceso"."ClaseDeComprobacionDeIdentidad" AS ENUM ('A_DEFINIR_EN_G2', 'CANAL_ALTERNATIVO_YA_REGISTRADO', 'VIDEOLLAMADA_CON_OPERADOR', 'DOCUMENTO_DE_IDENTIDAD');

CREATE TYPE "acceso"."ResultadoVerificacionIdentidad" AS ENUM ('COINCIDE', 'NO_COINCIDE', 'INSUFICIENTE');

-- `A_DETERMINAR` es un estado de primera clase, no una fila ausente ni un cero.
CREATE TYPE "acceso"."AccionDeRetencion" AS ENUM ('PURGA_FISICA', 'ANONIMIZACION', 'A_DETERMINAR');

CREATE TYPE "acceso"."ClaveDeRetencion" AS ENUM ('cuentaNoVerificada', 'enlaceConfirmacion', 'enlaceRecuperacion', 'tokenRefrescoUsado', 'intentosFallidos', 'sesionCerrada', 'desafioDeIngreso', 'documentacionRestitucionMfa', 'bitacoraAuditoria', 'envioTransaccional', 'aceptacion', 'verificacionProfesional', 'cuentaDadaDeBaja');

-- ─────────────────────────────────────────────────────────────────────────────
-- Enumeraciones de `auditoria`
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TYPE "auditoria"."ClasificacionDato" AS ENUM ('PUBLICO', 'INTERNO', 'PERSONAL', 'PATRIMONIAL_SENSIBLE');

CREATE TYPE "auditoria"."AccionAuditada" AS ENUM ('CUENTA_CREADA', 'CUENTA_CONFIRMADA', 'CUENTA_PURGADA', 'ADMINISTRADOR_CREADO', 'ADMINISTRADOR_SEMBRADO', 'ADMINISTRADOR_NOMINALIZADO', 'INGRESO_EXITOSO', 'INGRESO_FALLIDO', 'BLOQUEO_APLICADO', 'SEGUNDO_FACTOR_INSCRIPTO', 'SEGUNDO_FACTOR_DESACTIVADO', 'CODIGOS_DE_RESPALDO_REGENERADOS', 'CODIGO_DE_RESPALDO_CONSUMIDO', 'REFRESCO_ROTADO', 'REUTILIZACION_DE_REFRESCO_DETECTADA', 'SESION_CERRADA', 'TODAS_LAS_SESIONES_CERRADAS', 'CONTRASENA_CAMBIADA', 'RECUPERACION_SOLICITADA', 'RECUPERACION_COMPLETADA', 'ACEPTACION_REGISTRADA', 'MATRICULA_VERIFICADA', 'MATRICULA_RECHAZADA', 'MATRICULA_SUSPENDIDA', 'MATRICULA_VENCIDA', 'RESTITUCION_MFA_SOLICITADA', 'RESTITUCION_MFA_INSTRUIDA', 'RESTITUCION_MFA_RESUELTA', 'DOCUMENTACION_DE_RESTITUCION_DESTRUIDA', 'DATOS_PROPIOS_EXPORTADOS', 'RECURSO_LEIDO', 'RECURSO_MODIFICADO', 'ACCESO_DENEGADO');

CREATE TYPE "auditoria"."TipoRecurso" AS ENUM ('USUARIO', 'PERFIL', 'SESION', 'VERIFICACION_PROFESIONAL', 'EVENTO_AUDITORIA', 'SOLICITUD_RESTITUCION_MFA', 'CREDENCIAL', 'CASO');

CREATE TYPE "auditoria"."ResultadoEvento" AS ENUM ('PERMITIDO', 'DENEGADO', 'EJECUTADO', 'FALLIDO');

CREATE TYPE "auditoria"."MotivoDenegacion" AS ENUM ('PERMISO_AUSENTE', 'FUERA_DE_ALCANCE', 'CUENTA_NO_OPERATIVA', 'MATRICULA_NO_VIGENTE', 'SEGUNDO_FACTOR_REQUERIDO', 'REAUTENTICACION_REQUERIDA', 'CLASIFICACION_AUSENTE');

CREATE TYPE "auditoria"."CanalDeOrigen" AS ENUM ('WEB', 'MOVIL', 'API', 'PROCESO_INTERNO', 'SIEMBRA');
