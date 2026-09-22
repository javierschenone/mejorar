-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 0016 — segundo_factor
-- Feature 002, tarea T-03. Fila `0016` de modelo-datos.md §6.2.
-- Bloque E: E.1 `SecretoTotp`, E.2 `CodigoDeRespaldo`,
-- E.3 `SolicitudDeRestitucionMfa`.
--
-- **E.4 `DocumentacionDeRestitucion` NO SE INCLUYE. Escalamiento E-002-2.**
-- Recolectar la imagen de un DNI es el tratamiento de datos más intrusivo de
-- toda la feature y no tiene base legal escrita: el contrato mismo declara
-- `ClaseDeComprobacionDeIdentidad = 'A_DEFINIR_EN_G2'` y la condición C-002-12
-- pide definir qué se pide, con qué base legal, quién lo ve, cuánto se conserva
-- y cómo se destruye. Conforme al punto de escalamiento del mandato del
-- `database-engineer`, el dato no se modela: se escala. E.3 registra la
-- CONSTANCIA DEL HECHO —que hubo una comprobación, de qué clase, con qué
-- resultado y que la documentación se destruyó— nunca el dato.
--
-- Reversión: reversion.sql de este mismo directorio.
-- ─────────────────────────────────────────────────────────────────────────────

-- ═════════════════════════════════════════════════════════════════════════════
-- E.1 — `acceso.SecretoTotp`
--
-- **R-002-02 — el MFA del administrador no se puede apagar por datos.** La fila
-- que representa "administrador con MFA desactivado" NO EXISTE, y además no se
-- puede degradar el rol para conseguirlo: el par `(usuarioId, rolDelTitular)`
-- está replicado acá contra `Usuario(id, rol)` con `ON UPDATE RESTRICT`, así
-- que cambiar `Usuario.rol` estando esta fila presente hace fallar el `UPDATE`.
--
-- Cuatro capas, y la tercera y la cuarta son las que hacen que CA-32 diga
-- "no configurable" con propiedad:
--   1. `ExigeSegundoFactor<'ADMINISTRADOR'>` es el literal `true` (contrato).
--   2. `mapaRolPermisos.ADMINISTRADOR` no contiene `mfa.desactivar.propio`.
--   3. El `CHECK` `ck_usuario_mfa_obligatorio` de la migración 0012.
--   4. El `CHECK` + la clave foránea compuesta de acá, y el
--      `ck_ajuste_no_concede_apagar_mfa` de A.5.
-- Una variable de entorno no atraviesa ninguna de las dos últimas.
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE "acceso"."SecretoTotp" (
    "usuarioId" TEXT NOT NULL,
    "rolDelTitular" "acceso"."Rol" NOT NULL,
    "secretoCifrado" BYTEA NOT NULL,
    "secretoNonce" BYTEA NOT NULL,
    "secretoTag" BYTEA NOT NULL,
    "secretoIdClave" TEXT NOT NULL,
    "estado" "acceso"."EstadoMfa" NOT NULL,
    "inscriptoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmadoEn" TIMESTAMPTZ(6),
    "desactivadoEn" TIMESTAMPTZ(6),
    "ultimoPasoConsumido" BIGINT,

    CONSTRAINT "SecretoTotp_pkey" PRIMARY KEY ("usuarioId")
);

COMMENT ON TABLE "acceso"."SecretoTotp" IS
  'E.1 — secreto TOTP (CA-32, CA-38, CA-39). Retencion: vida de la cuenta; se destruye con la purga de A.1. El secreto va cifrado con clave PROPIA Y DISTINTA (k_mfa): un compromiso de k_acceso expone identidades, y que ademas expusiera los semilleros TOTP convertiria una fuga en una suplantacion.';

COMMENT ON COLUMN "acceso"."SecretoTotp"."usuarioId" IS 'PERS — titular del secreto.';
COMMENT ON COLUMN "acceso"."SecretoTotp"."rolDelTitular" IS 'INT — replica sostenida por clave foranea compuesta. NO es desnormalizacion por comodidad: es el mecanismo de R-002-02.';
COMMENT ON COLUMN "acceso"."SecretoTotp"."secretoCifrado" IS 'PERS↑ — AES-256-GCM con clave propia k_mfa, AAD = usuarioId. No exportable: REVOKE SELECT de columna en la 0020.';
COMMENT ON COLUMN "acceso"."SecretoTotp"."secretoNonce" IS 'INT — nonce del cifrado del secreto.';
COMMENT ON COLUMN "acceso"."SecretoTotp"."secretoTag" IS 'INT — etiqueta GCM del secreto.';
COMMENT ON COLUMN "acceso"."SecretoTotp"."secretoIdClave" IS 'INT — identificador de la clave k_mfa usada.';
COMMENT ON COLUMN "acceso"."SecretoTotp"."estado" IS 'INT — estado de la inscripcion del segundo factor.';
COMMENT ON COLUMN "acceso"."SecretoTotp"."inscriptoEn" IS 'INT — inicio de la inscripcion.';
COMMENT ON COLUMN "acceso"."SecretoTotp"."confirmadoEn" IS 'INT — inscripcion en dos pasos: el secreto no vale hasta probar un codigo.';
COMMENT ON COLUMN "acceso"."SecretoTotp"."desactivadoEn" IS 'INT — desactivacion. Prohibida para ADMINISTRADOR y ABOGADO por CHECK (R-002-02).';
COMMENT ON COLUMN "acceso"."SecretoTotp"."ultimoPasoConsumido" IS 'INT — numero de paso TOTP ya usado. Impide el replay del mismo codigo dentro de su ventana de 30 s.';

CREATE UNIQUE INDEX "uq_totp_usuario_rol" ON "acceso"."SecretoTotp" ("usuarioId", "rolDelTitular");

-- **R-002-02.** Capa 4.
ALTER TABLE "acceso"."SecretoTotp" ADD CONSTRAINT "ck_totp_no_desactivable_por_rol"
  CHECK ("rolDelTitular" NOT IN ('ADMINISTRADOR', 'ABOGADO') OR "desactivadoEn" IS NULL);

-- Un secreto ACTIVO sin confirmación es un secreto que nadie probó: la
-- inscripción en dos pasos existe justamente para que eso no ocurra.
ALTER TABLE "acceso"."SecretoTotp" ADD CONSTRAINT "ck_totp_activo_exige_confirmacion"
  CHECK ("estado" <> 'ACTIVO' OR "confirmadoEn" IS NOT NULL);

ALTER TABLE "acceso"."SecretoTotp" ADD CONSTRAINT "ck_totp_desactivado_no_activo"
  CHECK ("desactivadoEn" IS NULL OR "estado" <> 'ACTIVO');

ALTER TABLE "acceso"."SecretoTotp" ADD CONSTRAINT "fk_totp_usuario_rol"
  FOREIGN KEY ("usuarioId", "rolDelTitular") REFERENCES "acceso"."Usuario"("id", "rol")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ═════════════════════════════════════════════════════════════════════════════
-- E.2 — `acceso.CodigoDeRespaldo`
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE "acceso"."CodigoDeRespaldo" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "loteId" TEXT NOT NULL,
    "hashDelCodigo" BYTEA NOT NULL,
    "generadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumidoEn" TIMESTAMPTZ(6),
    "invalidadoEn" TIMESTAMPTZ(6),

    CONSTRAINT "CodigoDeRespaldo_pkey" PRIMARY KEY ("id")
);

COMMENT ON TABLE "acceso"."CodigoDeRespaldo" IS
  'E.2 — codigo de respaldo del segundo factor. Regenerar crea un lote nuevo e invalida el anterior en la misma transaccion. Se muestran UNA SOLA VEZ y no son exportables. Retencion: vida de la cuenta.';

COMMENT ON COLUMN "acceso"."CodigoDeRespaldo"."id" IS 'INT — identificador opaco.';
COMMENT ON COLUMN "acceso"."CodigoDeRespaldo"."usuarioId" IS 'PERS — titular.';
COMMENT ON COLUMN "acceso"."CodigoDeRespaldo"."loteId" IS 'INT — lote de generacion; regenerar invalida el lote anterior.';
COMMENT ON COLUMN "acceso"."CodigoDeRespaldo"."hashDelCodigo" IS 'INT — HMAC-SHA-256 con SAL POR CODIGO. No exportable: REVOKE SELECT de columna en la 0020.';
COMMENT ON COLUMN "acceso"."CodigoDeRespaldo"."generadoEn" IS 'INT — generacion.';
COMMENT ON COLUMN "acceso"."CodigoDeRespaldo"."consumidoEn" IS 'INT — consumo.';
COMMENT ON COLUMN "acceso"."CodigoDeRespaldo"."invalidadoEn" IS 'INT — invalidacion por regeneracion del lote.';

CREATE UNIQUE INDEX "uq_codigo_usuario_hash" ON "acceso"."CodigoDeRespaldo" ("usuarioId", "hashDelCodigo");

-- Q-20 (CA-08, CA-35): códigos DISPONIBLES de una cuenta. PARCIAL.
DROP INDEX IF EXISTS "acceso"."idx_codigo_vivo";
CREATE INDEX "idx_codigo_vivo"
  ON "acceso"."CodigoDeRespaldo" ("usuarioId")
  WHERE "consumidoEn" IS NULL AND "invalidadoEn" IS NULL;

ALTER TABLE "acceso"."CodigoDeRespaldo" ADD CONSTRAINT "ck_codigo_uso_excluyente"
  CHECK ("consumidoEn" IS NULL OR "invalidadoEn" IS NULL);

ALTER TABLE "acceso"."CodigoDeRespaldo" ADD CONSTRAINT "CodigoDeRespaldo_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "acceso"."Usuario"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ═════════════════════════════════════════════════════════════════════════════
-- E.3 — `acceso.SolicitudDeRestitucionMfa` (CA-35)
--
-- **R-002-20, cuatro ojos.** Restituirle el segundo factor a un administrador
-- es, de hecho, tomar control de la cuenta más poderosa del sistema, y una sola
-- persona no debe poder hacerlo.
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE "acceso"."SolicitudDeRestitucionMfa" (
    "id" TEXT NOT NULL,
    "titularId" TEXT NOT NULL,
    "estado" "acceso"."EstadoSolicitudRestitucion" NOT NULL,
    "solicitadaEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "esperaHasta" TIMESTAMPTZ(6),
    "instruidaPor" TEXT,
    "aprobadaPor" TEXT,
    "verificacionClase" "acceso"."ClaseDeComprobacionDeIdentidad",
    "verificacionPor" TEXT,
    "verificacionMomento" TIMESTAMPTZ(6),
    "verificacionResultado" "acceso"."ResultadoVerificacionIdentidad",
    "documentacionDestruidaEn" TIMESTAMPTZ(6),
    "resueltaEn" TIMESTAMPTZ(6),
    "claveIdempotencia" TEXT NOT NULL,

    CONSTRAINT "SolicitudDeRestitucionMfa_pkey" PRIMARY KEY ("id")
);

COMMENT ON TABLE "acceso"."SolicitudDeRestitucionMfa" IS
  'E.3 — solicitud de restitucion del segundo factor (CA-35). Registra la CONSTANCIA DEL HECHO, nunca el dato: E.4 DocumentacionDeRestitucion no se crea (escalamiento E-002-2). Retencion: documentacionRestitucionMfa = A_DETERMINAR (E-002-3, bloqueante). Sin purga automatica.';

COMMENT ON COLUMN "acceso"."SolicitudDeRestitucionMfa"."id" IS 'INT — identificador opaco.';
COMMENT ON COLUMN "acceso"."SolicitudDeRestitucionMfa"."titularId" IS 'PERS — quien perdio el segundo factor.';
COMMENT ON COLUMN "acceso"."SolicitudDeRestitucionMfa"."estado" IS 'INT — estado del caso de soporte.';
COMMENT ON COLUMN "acceso"."SolicitudDeRestitucionMfa"."solicitadaEn" IS 'INT — alta de la solicitud.';
COMMENT ON COLUMN "acceso"."SolicitudDeRestitucionMfa"."esperaHasta" IS 'INT — demora obligatoria: le da al titular legitimo tiempo de reaccionar si la restitucion la pidio un atacante.';
COMMENT ON COLUMN "acceso"."SolicitudDeRestitucionMfa"."instruidaPor" IS 'PERS — quien instruyo el caso (primer par de ojos).';
COMMENT ON COLUMN "acceso"."SolicitudDeRestitucionMfa"."aprobadaPor" IS 'PERS — quien lo aprobo (segundo par de ojos, obligatoriamente distinto).';
COMMENT ON COLUMN "acceso"."SolicitudDeRestitucionMfa"."verificacionClase" IS 'INT — catalogo con A_DEFINIR_EN_G2 todavia dentro: E-002-2.';
COMMENT ON COLUMN "acceso"."SolicitudDeRestitucionMfa"."verificacionPor" IS 'PERS — quien hizo la comprobacion de identidad.';
COMMENT ON COLUMN "acceso"."SolicitudDeRestitucionMfa"."verificacionMomento" IS 'INT — cuando.';
COMMENT ON COLUMN "acceso"."SolicitudDeRestitucionMfa"."verificacionResultado" IS 'INT — COINCIDE / NO_COINCIDE / INSUFICIENTE.';
COMMENT ON COLUMN "acceso"."SolicitudDeRestitucionMfa"."documentacionDestruidaEn" IS 'INT — constancia DEL HECHO, no del dato.';
COMMENT ON COLUMN "acceso"."SolicitudDeRestitucionMfa"."resueltaEn" IS 'INT — cierre del caso.';
COMMENT ON COLUMN "acceso"."SolicitudDeRestitucionMfa"."claveIdempotencia" IS 'INT — constitucion #12.';

CREATE UNIQUE INDEX "uq_restitucion_idempotencia" ON "acceso"."SolicitudDeRestitucionMfa" ("claveIdempotencia");

-- Q-19 (CA-35): solicitudes abiertas. PARCIAL.
DROP INDEX IF EXISTS "acceso"."idx_restitucion_abierta";
CREATE INDEX "idx_restitucion_abierta"
  ON "acceso"."SolicitudDeRestitucionMfa" ("solicitadaEn")
  WHERE "resueltaEn" IS NULL;

CREATE INDEX "idx_restitucion_titular" ON "acceso"."SolicitudDeRestitucionMfa" ("titularId");
CREATE INDEX "idx_restitucion_instructor" ON "acceso"."SolicitudDeRestitucionMfa" ("instruidaPor");
CREATE INDEX "idx_restitucion_aprobador" ON "acceso"."SolicitudDeRestitucionMfa" ("aprobadaPor");
CREATE INDEX "idx_restitucion_verificador" ON "acceso"."SolicitudDeRestitucionMfa" ("verificacionPor");

-- **R-002-20**, invariante 1: dos personas distintas.
ALTER TABLE "acceso"."SolicitudDeRestitucionMfa" ADD CONSTRAINT "ck_restitucion_cuatro_ojos_distintos"
  CHECK ("instruidaPor" IS NULL OR "aprobadaPor" IS NULL OR "instruidaPor" <> "aprobadaPor");
ALTER TABLE "acceso"."SolicitudDeRestitucionMfa" ADD CONSTRAINT "ck_restitucion_aprobada_exige_dos"
  CHECK ("estado" <> 'APROBADA' OR ("instruidaPor" IS NOT NULL AND "aprobadaPor" IS NOT NULL));

-- Invariante 2.
ALTER TABLE "acceso"."SolicitudDeRestitucionMfa" ADD CONSTRAINT "ck_restitucion_espera_con_fecha"
  CHECK ("estado" <> 'EN_ESPERA_OBLIGATORIA' OR "esperaHasta" IS NOT NULL);

-- Invariante 3: no se aprueba una restitución cuya comprobación de identidad no
-- coincidió. Es la diferencia entre un circuito de soporte y una puerta trasera.
ALTER TABLE "acceso"."SolicitudDeRestitucionMfa" ADD CONSTRAINT "ck_restitucion_aprobada_exige_coincidencia"
  CHECK ("estado" <> 'APROBADA' OR "verificacionResultado" = 'COINCIDE');

-- Invariante 4: no se cierra un caso dejando documentación sin destruir.
ALTER TABLE "acceso"."SolicitudDeRestitucionMfa" ADD CONSTRAINT "ck_restitucion_cierre_destruye_documentacion"
  CHECK ("resueltaEn" IS NULL OR "documentacionDestruidaEn" IS NOT NULL OR "verificacionClase" IS NULL);

-- El titular no se restituye a sí mismo: ni instruye ni aprueba su propio caso.
ALTER TABLE "acceso"."SolicitudDeRestitucionMfa" ADD CONSTRAINT "ck_restitucion_titular_no_interviene"
  CHECK (
    ("instruidaPor" IS NULL OR "instruidaPor" <> "titularId") AND
    ("aprobadaPor" IS NULL OR "aprobadaPor" <> "titularId") AND
    ("verificacionPor" IS NULL OR "verificacionPor" <> "titularId")
  );

ALTER TABLE "acceso"."SolicitudDeRestitucionMfa" ADD CONSTRAINT "SolicitudDeRestitucionMfa_titularId_fkey"
  FOREIGN KEY ("titularId") REFERENCES "acceso"."Usuario"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "acceso"."SolicitudDeRestitucionMfa" ADD CONSTRAINT "SolicitudDeRestitucionMfa_instruidaPor_fkey"
  FOREIGN KEY ("instruidaPor") REFERENCES "acceso"."Usuario"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "acceso"."SolicitudDeRestitucionMfa" ADD CONSTRAINT "SolicitudDeRestitucionMfa_aprobadaPor_fkey"
  FOREIGN KEY ("aprobadaPor") REFERENCES "acceso"."Usuario"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "acceso"."SolicitudDeRestitucionMfa" ADD CONSTRAINT "SolicitudDeRestitucionMfa_verificacionPor_fkey"
  FOREIGN KEY ("verificacionPor") REFERENCES "acceso"."Usuario"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
