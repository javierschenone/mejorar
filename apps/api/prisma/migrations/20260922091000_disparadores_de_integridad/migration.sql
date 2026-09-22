-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 0021 — disparadores_de_integridad
-- Feature 002, tarea T-03. Fila `0021` de modelo-datos.md §6.2.
--
-- Acá vive la mitad de las invariantes que una clave foránea o un `CHECK` no
-- pueden expresar:
--
--   §7.2  inmutabilidad de las tablas de sólo inserción y de las columnas que
--         NO están en el inventario de mutabilidad;
--   R-002-03  participación total `ADMINISTRADOR` → designación, y el evento de
--         auditoría exigido EN LA MISMA TRANSACCIÓN (CA-34);
--   R-002-04  buzones de rol prohibidos, por índice ciego, con el correo cifrado;
--   R-002-05  la siembra no queda viva después de la primera cuenta nominal;
--   R-002-06  no hay cuenta `ACTIVA` sin aceptación vigente de CADA clase de
--         documento y sin el texto del art. 6 (CA-26, CA-27);
--   R-002-19  matrícula y jurisdicción inmutables una vez aprobadas (CA-24);
--   B.3   completitud de los campos declarados en el art. 6 inc. c);
--   C.1   la jurisdicción de la evidencia coincide con la declarada;
--   D.2   invalidar una familia revoca sus tokens vivos;
--   A.3   proyección `ultimaDecisionId` / `tieneVerificacionAprobada`.
--
-- Los cuatro que son `CONSTRAINT TRIGGER … DEFERRABLE INITIALLY DEFERRED` se
-- evalúan AL CIERRE DE LA TRANSACCIÓN. Es lo que permite exigir "existe la
-- designación Y el evento de auditoría" sin imponerle a la aplicación un orden
-- de inserción imposible.
--
-- Reversión: reversion.sql de este mismo directorio.
-- ─────────────────────────────────────────────────────────────────────────────

-- ═════════════════════════════════════════════════════════════════════════════
-- 1. Inmutabilidad
-- ═════════════════════════════════════════════════════════════════════════════

-- 1.a — Tablas de sólo inserción: ni `UPDATE` ni `DELETE`, nunca.
CREATE OR REPLACE FUNCTION "acceso"."prohibir_modificacion"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'La tabla %.% es de SOLO INSERCION: no admite % (modelo-datos §7.2). Corregir un hecho es registrar otro hecho, no reescribir el anterior.',
    TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;

COMMENT ON FUNCTION "acceso"."prohibir_modificacion"() IS
  'Segunda capa de §7.2 y R-002-12. La primera es el REVOKE de la 0020; esta lanza excepcion aunque el privilegio estuviera mal otorgado.';

-- 1.b — Tablas parcialmente mutables: sólo las columnas del inventario de
-- §7.2. Las columnas admitidas se pasan como argumentos del disparador, así que
-- el inventario del documento y el del esquema son literalmente el mismo texto.
CREATE OR REPLACE FUNCTION "acceso"."solo_mutan_las_columnas_declaradas"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  viejo JSONB := to_jsonb(OLD);
  nuevo JSONB := to_jsonb(NEW);
  prohibidas TEXT[];
BEGIN
  -- Las columnas GENERADAS se saltean, y no es una concesión: en un disparador
  -- `BEFORE UPDATE` PostgreSQL todavía NO las calculó, así que en `NEW` valen
  -- NULL y toda comparación las daría por modificadas. Además nadie puede
  -- escribirlas —el motor rechaza el `UPDATE` antes de llegar acá—, así que
  -- excluirlas no abre nada. Sin esto, `acceso.Usuario` sería inmutable por
  -- accidente por culpa de `esAdministrador`.
  SELECT array_agg(k ORDER BY k) INTO prohibidas
    FROM jsonb_object_keys(viejo) AS k
   WHERE (viejo -> k) IS DISTINCT FROM (nuevo -> k)
     AND NOT (k = ANY (TG_ARGV))
     AND NOT EXISTS (
       SELECT 1 FROM pg_attribute a
        WHERE a.attrelid = TG_RELID AND a.attname = k AND a.attgenerated <> ''
     );

  IF prohibidas IS NOT NULL THEN
    RAISE EXCEPTION
      'En %.% solo pueden mutar las columnas % (modelo-datos §7.2). Se intento modificar: %.',
      TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_ARGV, prohibidas
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION "acceso"."solo_mutan_las_columnas_declaradas"() IS
  'Hace exigible el inventario de mutabilidad de modelo-datos §7.2: las columnas admitidas son los argumentos del disparador. Todo lo demas es historia y no se reescribe (D-3).';

-- B.1 y B.2 — **divergencia declarada con `modelo-datos.md` §7.2**, que las
-- lista entre las tablas "sin `UPDATE` ni `DELETE`, nunca".
--
-- El documento tiene ahí una inconsistencia interna: las dos tablas llevan
-- `vigenteHasta?`, que por definición se conoce DESPUÉS —cuando se publica la
-- versión siguiente—, y con inmutabilidad total ninguna versión podría cerrarse
-- nunca. El resultado sería un catálogo con N versiones simultáneamente
-- vigentes y sin forma de saber cuál mostrarle a la persona que se está dando
-- de alta, que es exactamente lo que C-002-02 quiere evitar.
--
-- Se resuelve con el mínimo cambio que preserva lo que la inmutabilidad
-- protege: **el contenido sigue siendo inmutable** —hash, referencia,
-- responsable, destinatarios, `incluyeFinalidadesDeLa003`— y lo único que muta
-- es el cierre de la ventana de vigencia, igual que `levantadaEn` en C.2. Los
-- índices únicos parciales `uq_documento_vigente` y `uq_art6_vigente` de las
-- migraciones 0013 completan la pieza: a lo sumo una versión vigente.
-- Anotado en `modelo-datos.md` §7.2 para que se revise en compuerta.
CREATE TRIGGER "tg_documento_inmutable"
  BEFORE UPDATE ON "acceso"."VersionDocumentoAceptable"
  FOR EACH ROW EXECUTE FUNCTION "acceso"."solo_mutan_las_columnas_declaradas"('vigenteHasta');
CREATE TRIGGER "tg_documento_sin_borrado"
  BEFORE DELETE ON "acceso"."VersionDocumentoAceptable"
  FOR EACH ROW EXECUTE FUNCTION "acceso"."prohibir_modificacion"();
CREATE TRIGGER "tg_art6_inmutable"
  BEFORE UPDATE ON "acceso"."VersionInformacionArt6"
  FOR EACH ROW EXECUTE FUNCTION "acceso"."solo_mutan_las_columnas_declaradas"('vigenteHasta');
CREATE TRIGGER "tg_art6_sin_borrado"
  BEFORE DELETE ON "acceso"."VersionInformacionArt6"
  FOR EACH ROW EXECUTE FUNCTION "acceso"."prohibir_modificacion"();

-- B.3 sí queda totalmente inmutable: un campo declarado en el art. 6 no se
-- reescribe ni se cierra, porque pertenece a su versión y la versión entera es
-- la unidad que se reemplaza.
CREATE TRIGGER "tg_campo_alta_inmutable"
  BEFORE UPDATE OR DELETE ON "acceso"."CampoDeclaradoEnElAlta"
  FOR EACH ROW EXECUTE FUNCTION "acceso"."prohibir_modificacion"();
CREATE TRIGGER "tg_decision_inmutable"
  BEFORE UPDATE OR DELETE ON "acceso"."DecisionDeVerificacion"
  FOR EACH ROW EXECUTE FUNCTION "acceso"."prohibir_modificacion"();
CREATE TRIGGER "tg_hito_inmutable"
  BEFORE UPDATE OR DELETE ON "acceso"."HitoDeVigenciaNotificado"
  FOR EACH ROW EXECUTE FUNCTION "acceso"."prohibir_modificacion"();
CREATE TRIGGER "tg_purga_inmutable"
  BEFORE UPDATE OR DELETE ON "acceso"."EjecucionDePurga"
  FOR EACH ROW EXECUTE FUNCTION "acceso"."prohibir_modificacion"();

-- **R-002-12.** La bitácora, que es el caso que más importa. Su retención se
-- ejecuta SOLTANDO PARTICIONES —`DROP TABLE`, que un disparador de fila no
-- intercepta— y por eso bloquear el `DELETE` no rompe la purga.
CREATE TRIGGER "tg_evento_inmutable"
  BEFORE UPDATE OR DELETE ON "auditoria"."EventoAuditoria"
  FOR EACH ROW EXECUTE FUNCTION "acceso"."prohibir_modificacion"();
CREATE TRIGGER "tg_sello_inmutable"
  BEFORE UPDATE OR DELETE ON "auditoria"."SelloDeBitacora"
  FOR EACH ROW EXECUTE FUNCTION "acceso"."prohibir_modificacion"();

-- D.5 `IntentoDeAutenticacion` es la excepción, y conviene decir por qué: es de
-- sólo inserción como las de arriba, pero su retención es de 7 días y se
-- ejecuta BORRANDO FILAS (no hay particionado acá). Bloquearle el `DELETE`
-- haría imposible cumplir el plazo del art. 9, que es lo contrario de lo que
-- queremos. Se le prohíbe el `UPDATE`, que es la invariante real: un intento
-- fallido no se reescribe.
CREATE TRIGGER "tg_intento_inmutable"
  BEFORE UPDATE ON "acceso"."IntentoDeAutenticacion"
  FOR EACH ROW EXECUTE FUNCTION "acceso"."prohibir_modificacion"();

-- Mutabilidad acotada. La lista de cada disparador ES la fila correspondiente
-- del inventario de §7.2.
CREATE TRIGGER "tg_usuario_mutabilidad"
  BEFORE UPDATE ON "acceso"."Usuario"
  FOR EACH ROW EXECUTE FUNCTION "acceso"."solo_mutan_las_columnas_declaradas"(
    'indiceCiegoCorreo', 'correoCifrado', 'correoNonce', 'correoTag', 'correoIdClave',
    'nombreParaMostrarCifrado', 'nombreParaMostrarNonce', 'nombreParaMostrarTag',
    'nombreParaMostrarIdClave', 'hashContrasena', 'estadoCuenta', 'estadoMfa',
    'confirmadoEn', 'actualizadoEn', 'purgadaEn', 'motivoPurga', 'eliminadoEn');

CREATE TRIGGER "tg_especialidad_mutabilidad"
  BEFORE UPDATE ON "acceso"."EspecialidadDeclarada"
  FOR EACH ROW EXECUTE FUNCTION "acceso"."solo_mutan_las_columnas_declaradas"('retiradaEn');

CREATE TRIGGER "tg_ajuste_mutabilidad"
  BEFORE UPDATE ON "acceso"."AjustePermiso"
  FOR EACH ROW EXECUTE FUNCTION "acceso"."solo_mutan_las_columnas_declaradas"('revocadoEn');

CREATE TRIGGER "tg_duplicado_mutabilidad"
  BEFORE UPDATE ON "acceso"."ResolucionDeDuplicado"
  FOR EACH ROW EXECUTE FUNCTION "acceso"."solo_mutan_las_columnas_declaradas"('resultado', 'resueltaEn');

CREATE TRIGGER "tg_aceptacion_mutabilidad"
  BEFORE UPDATE ON "acceso"."AceptacionRegistrada"
  FOR EACH ROW EXECUTE FUNCTION "acceso"."solo_mutan_las_columnas_declaradas"('revocadaEn');

CREATE TRIGGER "tg_suspension_mutabilidad"
  BEFORE UPDATE ON "acceso"."SuspensionDeMatricula"
  FOR EACH ROW EXECUTE FUNCTION "acceso"."solo_mutan_las_columnas_declaradas"(
    'levantadaEn', 'levantadaPor', 'motivoLevantamiento');

CREATE TRIGGER "tg_escalamiento_mutabilidad"
  BEFORE UPDATE ON "acceso"."EscalamientoDeVerificacion"
  FOR EACH ROW EXECUTE FUNCTION "acceso"."solo_mutan_las_columnas_declaradas"('resueltoEn', 'resueltoPor');

CREATE TRIGGER "tg_sesion_mutabilidad"
  BEFORE UPDATE ON "acceso"."Sesion"
  FOR EACH ROW EXECUTE FUNCTION "acceso"."solo_mutan_las_columnas_declaradas"(
    'ultimoUso', 'cerradaEn', 'motivoCierre');

CREATE TRIGGER "tg_familia_mutabilidad"
  BEFORE UPDATE ON "acceso"."FamiliaDeRefresco"
  FOR EACH ROW EXECUTE FUNCTION "acceso"."solo_mutan_las_columnas_declaradas"(
    'generacionActual', 'invalidadaEn', 'motivoInvalidacion');

CREATE TRIGGER "tg_refresco_mutabilidad"
  BEFORE UPDATE ON "acceso"."TokenDeRefresco"
  FOR EACH ROW EXECUTE FUNCTION "acceso"."solo_mutan_las_columnas_declaradas"(
    'usadoEn', 'sucesorId', 'revocadoEn');

CREATE TRIGGER "tg_desafio_mutabilidad"
  BEFORE UPDATE ON "acceso"."DesafioDeIngreso"
  FOR EACH ROW EXECUTE FUNCTION "acceso"."solo_mutan_las_columnas_declaradas"(
    'consumidoEn', 'intentosDeSegundoFactor');

CREATE TRIGGER "tg_bloqueo_mutabilidad"
  BEFORE UPDATE ON "acceso"."BloqueoDeTrafico"
  FOR EACH ROW EXECUTE FUNCTION "acceso"."solo_mutan_las_columnas_declaradas"(
    'hasta', 'intentosContados', 'notificadoEn', 'envioId', 'aplicadoEn');

CREATE TRIGGER "tg_enlace_mutabilidad"
  BEFORE UPDATE ON "acceso"."EnlaceDeUnSoloUso"
  FOR EACH ROW EXECUTE FUNCTION "acceso"."solo_mutan_las_columnas_declaradas"('usadoEn', 'invalidadoEn');

CREATE TRIGGER "tg_envio_mutabilidad"
  BEFORE UPDATE ON "acceso"."EnvioTransaccional"
  FOR EACH ROW EXECUTE FUNCTION "acceso"."solo_mutan_las_columnas_declaradas"(
    'enviadoEn', 'resultado', 'intentos', 'idDelProveedor');

CREATE TRIGGER "tg_totp_mutabilidad"
  BEFORE UPDATE ON "acceso"."SecretoTotp"
  FOR EACH ROW EXECUTE FUNCTION "acceso"."solo_mutan_las_columnas_declaradas"(
    'estado', 'confirmadoEn', 'desactivadoEn', 'ultimoPasoConsumido',
    'secretoCifrado', 'secretoNonce', 'secretoTag', 'secretoIdClave');

CREATE TRIGGER "tg_codigo_mutabilidad"
  BEFORE UPDATE ON "acceso"."CodigoDeRespaldo"
  FOR EACH ROW EXECUTE FUNCTION "acceso"."solo_mutan_las_columnas_declaradas"(
    'consumidoEn', 'invalidadoEn');

CREATE TRIGGER "tg_restitucion_mutabilidad"
  BEFORE UPDATE ON "acceso"."SolicitudDeRestitucionMfa"
  FOR EACH ROW EXECUTE FUNCTION "acceso"."solo_mutan_las_columnas_declaradas"(
    'estado', 'esperaHasta', 'instruidaPor', 'aprobadaPor', 'verificacionClase',
    'verificacionPor', 'verificacionMomento', 'verificacionResultado',
    'documentacionDestruidaEn', 'resueltaEn');

CREATE TRIGGER "tg_designacion_mutabilidad"
  BEFORE UPDATE ON "acceso"."DesignacionDeAdministrador"
  FOR EACH ROW EXECUTE FUNCTION "acceso"."solo_mutan_las_columnas_declaradas"(
    'nominalizadaEn', 'deshabilitadaEn');

CREATE TRIGGER "tg_retencion_mutabilidad"
  BEFORE UPDATE ON "acceso"."ReglaDeRetencion"
  FOR EACH ROW EXECUTE FUNCTION "acceso"."solo_mutan_las_columnas_declaradas"(
    'plazoSegundos', 'accion', 'validadoPor', 'validadoEn', 'vigenteDesde',
    'fundamento', 'requiereValidacionProfesional');

-- ═════════════════════════════════════════════════════════════════════════════
-- 2. A.3 — proyección desde C.1, y R-002-19 (CA-24)
-- ═════════════════════════════════════════════════════════════════════════════

-- 2.a — La proyección. `ultimaDecisionId` y `tieneVerificacionAprobada` son
-- punteros al ÚLTIMO HECHO, no el estado derivado: lo prohibido por D-2 es
-- guardar VIGENTE / VENCIDA / SUSPENDIDA, que dependen del instante de
-- evaluación. Cuál fue la última decisión no depende del tiempo, así que no
-- puede quedar desactualizado respecto de él.
CREATE OR REPLACE FUNCTION "acceso"."proyectar_ultima_decision"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  jurisdiccion_declarada "acceso"."Jurisdiccion";
  mas_reciente TIMESTAMPTZ;
BEGIN
  SELECT p."jurisdiccion" INTO jurisdiccion_declarada
    FROM "acceso"."PerfilProfesional" p
   WHERE p."usuarioId" = NEW."perfilUsuarioId";

  -- C.1 invariante 4: verificar una matrícula de Córdoba contra una constancia
  -- de Salta es el error que M-7 viene a prevenir en la asignación de casos.
  IF NEW."evidenciaJurisdiccion" IS NOT NULL
     AND NEW."evidenciaJurisdiccion" <> jurisdiccion_declarada THEN
    RAISE EXCEPTION
      'La jurisdiccion de la evidencia (%) no coincide con la declarada en el perfil (%). C.1 invariante 4, salvaguarda M-7.',
      NEW."evidenciaJurisdiccion", jurisdiccion_declarada
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  -- Una decisión anterior más nueva no se pisa: la proyección apunta al hecho
  -- más reciente, se hayan insertado en el orden que se hayan insertado.
  SELECT max(d."momento") INTO mas_reciente
    FROM "acceso"."DecisionDeVerificacion" d
   WHERE d."perfilUsuarioId" = NEW."perfilUsuarioId";

  IF mas_reciente IS NULL OR NEW."momento" >= mas_reciente THEN
    UPDATE "acceso"."PerfilProfesional"
       SET "ultimaDecisionId" = NEW."id",
           "tieneVerificacionAprobada" = (NEW."resultado" = 'APROBADA')
     WHERE "usuarioId" = NEW."perfilUsuarioId";
  END IF;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION "acceso"."proyectar_ultima_decision"() IS
  'Mantiene la proyeccion de A.3 desde C.1 y verifica la invariante 4 de C.1 (la jurisdiccion de la evidencia coincide con la declarada).';

CREATE TRIGGER "tg_decision_proyecta_perfil"
  AFTER INSERT ON "acceso"."DecisionDeVerificacion"
  FOR EACH ROW EXECUTE FUNCTION "acceso"."proyectar_ultima_decision"();

-- 2.b — **R-002-19, CA-24.** Matrícula y jurisdicción son inmutables UNA VEZ
-- QUE EXISTE UNA DECISIÓN APROBADA. Antes no: corregir un dígito mal tipeado
-- mientras la verificación está pendiente es legítimo, y prohibirlo obligaría
-- a dar de baja el perfil para arreglar una errata.
CREATE OR REPLACE FUNCTION "acceso"."perfil_mutabilidad"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  hay_aprobada BOOLEAN;
BEGIN
  IF NEW."usuarioId" IS DISTINCT FROM OLD."usuarioId"
     OR NEW."rolDelTitular" IS DISTINCT FROM OLD."rolDelTitular"
     OR NEW."solicitadaEn" IS DISTINCT FROM OLD."solicitadaEn"
     OR NEW."creadoEn" IS DISTINCT FROM OLD."creadoEn" THEN
    RAISE EXCEPTION
      'En acceso.PerfilProfesional solo pueden mutar ultimaDecisionId, tieneVerificacionAprobada, colegioDeclarado y —mientras no haya decision aprobada— matricula y jurisdiccion (modelo-datos §7.2).'
      USING ERRCODE = 'restrict_violation';
  END IF;

  IF NEW."matricula" IS DISTINCT FROM OLD."matricula"
     OR NEW."jurisdiccion" IS DISTINCT FROM OLD."jurisdiccion" THEN
    SELECT EXISTS (
      SELECT 1 FROM "acceso"."DecisionDeVerificacion" d
       WHERE d."perfilUsuarioId" = OLD."usuarioId" AND d."resultado" = 'APROBADA'
    ) INTO hay_aprobada;

    IF hay_aprobada THEN
      RAISE EXCEPTION
        'R-002-19 (CA-24): la matricula y la jurisdiccion no se pueden editar una vez que existe una decision de verificacion APROBADA. El abogado no autoedita la matricula verificada.'
        USING ERRCODE = 'restrict_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "tg_perfil_mutabilidad"
  BEFORE UPDATE ON "acceso"."PerfilProfesional"
  FOR EACH ROW EXECUTE FUNCTION "acceso"."perfil_mutabilidad"();

-- ═════════════════════════════════════════════════════════════════════════════
-- 3. R-002-04 — buzones de rol prohibidos como cuenta administradora (CA-33)
--
-- Como el índice ciego es determinista, se precalculan los buzones de rol
-- conocidos y quedan prohibidos AUNQUE EL CORREO ESTÉ CIFRADO y la base no
-- pueda leerlo. Su límite —sólo cubre la lista enumerada de D.8— está declarado
-- en §7.3 y se cubre con validación de dominio en `packages/shared`.
-- ═════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION "acceso"."rechazar_buzon_de_rol"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  etiqueta_prohibida TEXT;
BEGIN
  IF NEW."rol" <> 'ADMINISTRADOR' OR NEW."indiceCiegoCorreo" IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT b."etiqueta" INTO etiqueta_prohibida
    FROM "acceso"."CorreoDeRolProhibido" b
   WHERE b."indiceCiego" = NEW."indiceCiegoCorreo";

  IF etiqueta_prohibida IS NOT NULL THEN
    RAISE EXCEPTION
      'R-002-04 (CA-33): una cuenta administradora no puede usar un buzon de rol (%). Las cuentas administradoras son nominales: detras de cada una hay una persona identificada.',
      etiqueta_prohibida
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "tg_usuario_buzon_de_rol"
  BEFORE INSERT OR UPDATE OF "rol", "indiceCiegoCorreo" ON "acceso"."Usuario"
  FOR EACH ROW EXECUTE FUNCTION "acceso"."rechazar_buzon_de_rol"();

-- ═════════════════════════════════════════════════════════════════════════════
-- 4. R-002-06 — no hay cuenta ACTIVA sin aceptación de cada clase (CA-26, CA-27)
--
-- DIFERIDO: se evalúa al cierre de la transacción, porque el alta inserta la
-- cuenta y sus aceptaciones en la misma transacción y el orden no debería
-- importar.
-- ═════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION "acceso"."exigir_aceptaciones_para_activar"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  faltantes TEXT[];
BEGIN
  SELECT array_agg(c::TEXT ORDER BY c::TEXT) INTO faltantes
    FROM unnest(enum_range(NULL::"acceso"."ClaseDocumentoAceptable")) AS c
   WHERE NOT EXISTS (
     SELECT 1 FROM "acceso"."AceptacionRegistrada" a
      WHERE a."usuarioId" = NEW."id"
        AND a."documentoClase" = c
        AND a."revocadaEn" IS NULL
   );

  IF faltantes IS NOT NULL THEN
    RAISE EXCEPTION
      'R-002-06 (CA-27): una cuenta no puede quedar ACTIVA sin una aceptacion vigente de cada clase de documento. Faltan: %. La aceptacion no es un booleano: es una fila con version, hash, fecha e IP.',
      faltantes
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  -- CA-26: y con el texto del art. 6 que se le mostró. La columna
  -- `versionInformacionArt6` de B.4 es `NOT NULL` y tiene clave foránea contra
  -- B.2, así que la existencia de la aceptación ya prueba que hubo un texto
  -- versionado del art. 6 en pantalla. Se deja dicho para que no se lea como
  -- un olvido.
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "tg_usuario_activa_exige_aceptaciones"
  AFTER INSERT OR UPDATE OF "estadoCuenta" ON "acceso"."Usuario"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  WHEN (NEW."estadoCuenta" = 'ACTIVA')
  EXECUTE FUNCTION "acceso"."exigir_aceptaciones_para_activar"();

-- ═════════════════════════════════════════════════════════════════════════════
-- 5. R-002-03 — participación total y auditoría en la misma transacción
--
-- Ésta es la mitad que una clave foránea NO PUEDE expresar: la clave foránea de
-- F.1 garantiza que toda designación apunta a un administrador; esto garantiza
-- lo inverso, que todo administrador tiene designación. Y el tercer mecanismo,
-- CA-34: **crear un administrador sin dejar rastro no es una regla que se pueda
-- olvidar; es una transacción que no cierra.** Cierra el defecto D-002-06.
-- ═════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION "acceso"."exigir_designacion_y_auditoria"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "acceso"."DesignacionDeAdministrador" d WHERE d."usuarioId" = NEW."id"
  ) THEN
    RAISE EXCEPTION
      'R-002-03 (CA-33): la cuenta % tiene rol ADMINISTRADOR y no tiene designacion en acceso.DesignacionDeAdministrador. No existen cuentas administradoras genericas: detras de cada una hay una persona identificada, con su documento de designacion.',
      NEW."id"
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM "auditoria"."EventoAuditoria" e
     WHERE e."titularAfectado" = NEW."id"
       AND e."accion" IN ('ADMINISTRADOR_CREADO', 'ADMINISTRADOR_SEMBRADO')
  ) THEN
    RAISE EXCEPTION
      'R-002-03 (CA-34): crear la cuenta administradora % exige un auditoria.EventoAuditoria con accion ADMINISTRADOR_CREADO o ADMINISTRADOR_SEMBRADO EN LA MISMA TRANSACCION. Crear un administrador sin dejar rastro no es una regla que se pueda olvidar: es una transaccion que no cierra.',
      NEW."id"
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "tg_usuario_admin_exige_designacion"
  AFTER INSERT OR UPDATE OF "rol" ON "acceso"."Usuario"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  WHEN (NEW."rol" = 'ADMINISTRADOR')
  EXECUTE FUNCTION "acceso"."exigir_designacion_y_auditoria"();

-- ═════════════════════════════════════════════════════════════════════════════
-- 6. R-002-05 — la siembra no queda viva "por las dudas" (recaudo C-2)
--
-- La primera mitad es el índice único parcial de la 0017: una sola siembra en
-- toda la vida de la base. Ésta es la segunda: al aparecer la primera
-- designación NOMINAL, la de siembra tiene que estar nominalizada o
-- deshabilitada.
-- ═════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION "acceso"."exigir_siembra_cerrada"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  siembra RECORD;
BEGIN
  SELECT * INTO siembra
    FROM "acceso"."DesignacionDeAdministrador" d
   WHERE d."esSiembra" AND d."usuarioId" <> NEW."usuarioId";

  IF FOUND AND siembra."nominalizadaEn" IS NULL AND siembra."deshabilitadaEn" IS NULL THEN
    RAISE EXCEPTION
      'R-002-05 (recaudo C-2): antes de crear otra cuenta administradora, la designacion de siembra (%) tiene que quedar nominalizada o deshabilitada. Una cuenta de arranque viva "por las dudas" es una cuenta sin persona detras.',
      siembra."usuarioId"
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "tg_designacion_cierra_siembra"
  AFTER INSERT ON "acceso"."DesignacionDeAdministrador"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  WHEN (NOT NEW."esSiembra")
  EXECUTE FUNCTION "acceso"."exigir_siembra_cerrada"();

-- ═════════════════════════════════════════════════════════════════════════════
-- 7. B.3 — completitud del art. 6 inc. c), y el enganche formal de E-002-1
--
-- Una `VersionInformacionArt6` no puede quedar vigente sin una fila por CADA
-- campo que el formulario de alta recolecta. El inciso c) es "el que más se
-- olvida" (dictamen §3), y acá deja de poder olvidarse.
--
-- **Enganche de E-002-1.** `CUIT_CUIL` entra al conjunto obligatorio EN CUANTO
-- EXISTA la tabla A.2 `IdentificadorFiscal`. Hoy no existe —su migración está
-- en `prisma/migraciones-en-espera/` y no se ejecuta hasta que la finalidad del
-- dato esté declarada—, así que hoy no se exige. El día que alguien corra esa
-- migración, este disparador empieza a exigir su declaración de finalidad y de
-- carácter sin que haya que acordarse de nada.
-- ═════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION "acceso"."exigir_campos_declarados_del_alta"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  obligatorios "acceso"."CampoDelAlta"[] := ARRAY[
    'CORREO', 'CONTRASENA', 'NOMBRE_PARA_MOSTRAR', 'MATRICULA', 'JURISDICCION'
  ]::"acceso"."CampoDelAlta"[];
  faltantes TEXT[];
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'acceso' AND c.relname = 'IdentificadorFiscal'
  ) THEN
    obligatorios := obligatorios || 'CUIT_CUIL'::"acceso"."CampoDelAlta";
  END IF;

  SELECT array_agg(c::TEXT ORDER BY c::TEXT) INTO faltantes
    FROM unnest(obligatorios) AS c
   WHERE NOT EXISTS (
     SELECT 1 FROM "acceso"."CampoDeclaradoEnElAlta" d
      WHERE d."version" = NEW."version" AND d."campo" = c
   );

  IF faltantes IS NOT NULL THEN
    RAISE EXCEPTION
      'C-002-01 (art. 6 inc. c, Ley 25.326): la version % del texto del art. 6 no puede quedar vigente sin declarar el caracter, la finalidad y la consecuencia de no darlo para cada campo del alta. Faltan: %.',
      NEW."version", faltantes
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "tg_art6_exige_campos"
  AFTER INSERT ON "acceso"."VersionInformacionArt6"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  WHEN (NEW."vigenteHasta" IS NULL)
  EXECUTE FUNCTION "acceso"."exigir_campos_declarados_del_alta"();

-- ═════════════════════════════════════════════════════════════════════════════
-- 8. D.2 — invalidar una familia revoca sus tokens vivos (CA-11)
-- ═════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION "acceso"."revocar_tokens_de_la_familia"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE "acceso"."TokenDeRefresco"
     SET "revocadoEn" = NEW."invalidadaEn"
   WHERE "familiaId" = NEW."id"
     AND "revocadoEn" IS NULL;
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION "acceso"."revocar_tokens_de_la_familia"() IS
  'D.3 invariante 4: al invalidar la familia, ningun token suyo queda vivo. El cierre de TODAS las sesiones de la cuenta (CA-11) es otra cosa y queda en la aplicacion (§7.3).';

CREATE TRIGGER "tg_familia_revoca_tokens"
  AFTER UPDATE OF "invalidadaEn" ON "acceso"."FamiliaDeRefresco"
  FOR EACH ROW
  WHEN (OLD."invalidadaEn" IS NULL AND NEW."invalidadaEn" IS NOT NULL)
  EXECUTE FUNCTION "acceso"."revocar_tokens_de_la_familia"();
