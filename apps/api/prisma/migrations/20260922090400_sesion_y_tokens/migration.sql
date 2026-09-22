-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 0015 — sesion_y_tokens
-- Feature 002, tarea T-03. Fila `0015` de modelo-datos.md §6.2.
-- Bloque D, salvo D.8: D.1 `Sesion`, D.2 `FamiliaDeRefresco`,
-- D.3 `TokenDeRefresco`, D.4 `DesafioDeIngreso`, D.5 `IntentoDeAutenticacion`,
-- D.6 `BloqueoDeTrafico`, D.7 `EnlaceDeUnSoloUso`, D.9 `EnvioTransaccional`.
--
-- D.8 `CorreoDeRolProhibido` va en la 0017, junto con F.1, porque es parte del
-- mismo mecanismo (R-002-04: no hay cuenta administradora en un buzón de rol).
--
-- Reversión: reversion.sql de este mismo directorio.
-- ─────────────────────────────────────────────────────────────────────────────

-- ═════════════════════════════════════════════════════════════════════════════
-- D.9 — `acceso.EnvioTransaccional`
--
-- Va primero porque D.6, D.7 y C.3 la referencian.
--
-- **No guarda la dirección de destino.** Se resuelve descifrando A.1 en el
-- momento del envío. Un registro de envíos con las direcciones en claro sería
-- la misma lista de deudores que D-4 vino a proteger, con otro nombre.
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE "acceso"."EnvioTransaccional" (
    "claveDeIdempotencia" TEXT NOT NULL,
    "plantilla" "acceso"."ClavePlantillaCorreo" NOT NULL,
    "usuarioId" TEXT,
    "encoladoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviadoEn" TIMESTAMPTZ(6),
    "modo" "acceso"."ModoEnvio" NOT NULL,
    "idDelProveedor" TEXT,
    "resultado" "acceso"."ResultadoEnvio" NOT NULL DEFAULT 'ENCOLADO',
    "intentos" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "EnvioTransaccional_pkey" PRIMARY KEY ("claveDeIdempotencia")
);

COMMENT ON TABLE "acceso"."EnvioTransaccional" IS
  'D.9 — envio transaccional. La PK ES la clave de idempotencia (constitucion #12): es la ultima linea de defensa contra el aviso duplicado, que aca significa alarmar dos veces a alguien diciendole que intentaron entrar a su cuenta. NO guarda la direccion de destino. Retencion: envioTransaccional = 180 dias, PURGA_FISICA.';

COMMENT ON COLUMN "acceso"."EnvioTransaccional"."claveDeIdempotencia" IS 'INT — Q-22. La PK es la clave de idempotencia.';
COMMENT ON COLUMN "acceso"."EnvioTransaccional"."plantilla" IS 'INT — los 16 valores de ClavePlantillaCorreo del contrato.';
COMMENT ON COLUMN "acceso"."EnvioTransaccional"."usuarioId" IS 'PERS — destinatario, por identificador opaco. La direccion NO se guarda.';
COMMENT ON COLUMN "acceso"."EnvioTransaccional"."encoladoEn" IS 'INT — cuando se encolo.';
COMMENT ON COLUMN "acceso"."EnvioTransaccional"."enviadoEn" IS 'INT — cuando se entrego al transporte.';
COMMENT ON COLUMN "acceso"."EnvioTransaccional"."modo" IS 'INT — PROVEEDOR significa que la direccion del titular sale hacia un tercero que por el art. 25 de la Ley 25.326 es ENCARGADO DE TRATAMIENTO y exige contrato (R-09, C-002-10).';
COMMENT ON COLUMN "acceso"."EnvioTransaccional"."idDelProveedor" IS 'INT — identificador del mensaje en el proveedor, para conciliar.';
COMMENT ON COLUMN "acceso"."EnvioTransaccional"."resultado" IS 'INT — ENCOLADO / ENVIADO / RECHAZADO / FALLIDO.';
COMMENT ON COLUMN "acceso"."EnvioTransaccional"."intentos" IS 'INT — reintentos realizados.';

CREATE INDEX "idx_envio_usuario" ON "acceso"."EnvioTransaccional" ("usuarioId");
CREATE INDEX "idx_envio_encolado" ON "acceso"."EnvioTransaccional" ("encoladoEn");

ALTER TABLE "acceso"."EnvioTransaccional" ADD CONSTRAINT "ck_envio_entregado_con_fecha"
  CHECK (("resultado" = 'ENVIADO') = ("enviadoEn" IS NOT NULL));
ALTER TABLE "acceso"."EnvioTransaccional" ADD CONSTRAINT "ck_envio_intentos_no_negativos"
  CHECK ("intentos" >= 0);
-- Sólo un envío por proveedor externo puede tener identificador del proveedor:
-- si aparece uno en modo MOCK, el registro está mintiendo sobre por dónde salió
-- el dato personal, que es justo lo que C-002-10 necesita poder auditar.
ALTER TABLE "acceso"."EnvioTransaccional" ADD CONSTRAINT "ck_envio_proveedor_coherente"
  CHECK ("idDelProveedor" IS NULL OR "modo" = 'PROVEEDOR');

ALTER TABLE "acceso"."EnvioTransaccional" ADD CONSTRAINT "EnvioTransaccional_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "acceso"."Usuario"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- La clave foránea que la 0014 dejó pendiente.
ALTER TABLE "acceso"."HitoDeVigenciaNotificado" ADD CONSTRAINT "HitoDeVigenciaNotificado_envioId_fkey"
  FOREIGN KEY ("envioId") REFERENCES "acceso"."EnvioTransaccional"("claveDeIdempotencia")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ═════════════════════════════════════════════════════════════════════════════
-- D.1 — `acceso.Sesion`
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE "acceso"."Sesion" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "rolDelTitular" "acceso"."Rol" NOT NULL,
    "creadaEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimoUso" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "autenticadaEn" TIMESTAMPTZ(6) NOT NULL,
    "nivelAutenticacion" "acceso"."NivelAutenticacion" NOT NULL,
    "ipHash" BYTEA,
    "ubicacionPais" TEXT,
    "ubicacionProvincia" TEXT,
    "versionBaseGeoIp" TEXT,
    "dispositivoClase" "acceso"."DispositivoClase" NOT NULL DEFAULT 'DESCONOCIDO',
    "dispositivoSistema" TEXT,
    "dispositivoNavegador" TEXT,
    "cerradaEn" TIMESTAMPTZ(6),
    "motivoCierre" "acceso"."MotivoCierreSesion",

    CONSTRAINT "Sesion_pkey" PRIMARY KEY ("id")
);

COMMENT ON TABLE "acceso"."Sesion" IS
  'D.1 — la sesion (CA-13, CA-14). Retencion: sesionCerrada = 90 dias desde cerradaEn, PURGA_FISICA. Es el dato mas identificatorio que la feature genera de forma continua (dictamen §5.B), y por eso su plazo requiere firma del estudio.';

COMMENT ON COLUMN "acceso"."Sesion"."id" IS 'INT — IdSesion, opaco.';
COMMENT ON COLUMN "acceso"."Sesion"."usuarioId" IS 'PERS — titular de la sesion.';
COMMENT ON COLUMN "acceso"."Sesion"."rolDelTitular" IS 'INT — replica sostenida por clave foranea compuesta, ON UPDATE RESTRICT (R-002-16).';
COMMENT ON COLUMN "acceso"."Sesion"."creadaEn" IS 'INT — apertura de la sesion.';
COMMENT ON COLUMN "acceso"."Sesion"."ultimoUso" IS 'INT — ultima actividad.';
COMMENT ON COLUMN "acceso"."Sesion"."autenticadaEn" IS 'INT — auth_time del token. Hace verificable el recaudo B-3: la ventana de reautenticacion fuerte para apagar el segundo factor.';
COMMENT ON COLUMN "acceso"."Sesion"."nivelAutenticacion" IS 'INT — CONTRASENA o CONTRASENA_Y_SEGUNDO_FACTOR.';
COMMENT ON COLUMN "acceso"."Sesion"."ipHash" IS 'PERS — HMAC-SHA-256 con clave de servidor. La IP EN CLARO NO SE GUARDA NUNCA en esta tabla. Sirve para correlacionar, no para exhibir.';
COMMENT ON COLUMN "acceso"."Sesion"."ubicacionPais" IS 'PERS — en claro: es lo que CA-13 le muestra al titular. Resolucion LOCAL obligatoria; no hay tercero ni transferencia internacional por esta via.';
COMMENT ON COLUMN "acceso"."Sesion"."ubicacionProvincia" IS 'PERS — idem, granularidad gruesa a proposito.';
COMMENT ON COLUMN "acceso"."Sesion"."versionBaseGeoIp" IS 'INT — para poder explicar por que en marzo decia "Santa Fe".';
COMMENT ON COLUMN "acceso"."Sesion"."dispositivoClase" IS 'PERS — categoria cerrada.';
COMMENT ON COLUMN "acceso"."Sesion"."dispositivoSistema" IS 'PERS — categoria, NO el agente de usuario crudo: se analiza y se descarta (minimizacion, art. 4 inc. 1).';
COMMENT ON COLUMN "acceso"."Sesion"."dispositivoNavegador" IS 'PERS — idem.';
COMMENT ON COLUMN "acceso"."Sesion"."cerradaEn" IS 'INT — cierre de la sesion.';
COMMENT ON COLUMN "acceso"."Sesion"."motivoCierre" IS 'INT — catalogo cerrado de motivos de cierre.';

-- Q-04 (CA-13) y Q-05 (CA-11, CA-16). PARCIAL: las sesiones abiertas son una
-- fracción mínima del histórico.
DROP INDEX IF EXISTS "acceso"."idx_sesion_abierta";
CREATE INDEX "idx_sesion_abierta"
  ON "acceso"."Sesion" ("usuarioId", "ultimoUso" DESC)
  WHERE "cerradaEn" IS NULL;

-- Q-16: sesiones cerradas más viejas que el plazo, para purgar. PARCIAL.
DROP INDEX IF EXISTS "acceso"."idx_sesion_cerrada";
CREATE INDEX "idx_sesion_cerrada"
  ON "acceso"."Sesion" ("cerradaEn")
  WHERE "cerradaEn" IS NOT NULL;

-- NO hay índice sobre `ipHash`, a propósito: la investigación por IP no está
-- entre los 39 criterios y un índice ahí facilitaría justo la correlación
-- masiva que la minimización desalienta (§3, índices descartados).

ALTER TABLE "acceso"."Sesion" ADD CONSTRAINT "ck_sesion_cierre_coherente"
  CHECK (("cerradaEn" IS NULL) = ("motivoCierre" IS NULL));

-- **R-002-16 — CA-32, CA-38.** Una sesión de ADMINISTRADOR o ABOGADO abierta
-- con un solo factor NO ES REPRESENTABLE. Es la segunda barrera: aunque alguien
-- lograra saltear la de A.1, la sesión no se puede insertar. Se sostiene con la
-- clave foránea compuesta de abajo, que garantiza que `rolDelTitular` es el rol
-- real de la cuenta y no una afirmación del servicio.
ALTER TABLE "acceso"."Sesion" ADD CONSTRAINT "ck_sesion_segundo_factor_por_rol"
  CHECK ("rolDelTitular" = 'CLIENTE' OR "nivelAutenticacion" = 'CONTRASENA_Y_SEGUNDO_FACTOR');

ALTER TABLE "acceso"."Sesion" ADD CONSTRAINT "fk_sesion_usuario_rol"
  FOREIGN KEY ("usuarioId", "rolDelTitular") REFERENCES "acceso"."Usuario"("id", "rol")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ═════════════════════════════════════════════════════════════════════════════
-- D.2 — `acceso.FamiliaDeRefresco`
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE "acceso"."FamiliaDeRefresco" (
    "id" TEXT NOT NULL,
    "sesionId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "creadaEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generacionActual" INTEGER NOT NULL DEFAULT 0,
    "invalidadaEn" TIMESTAMPTZ(6),
    "motivoInvalidacion" "acceso"."MotivoInvalidacionFamilia",

    CONSTRAINT "FamiliaDeRefresco_pkey" PRIMARY KEY ("id")
);

COMMENT ON TABLE "acceso"."FamiliaDeRefresco" IS
  'D.2 — familia de tokens de refresco; la rotacion avanza la generacion dentro de la familia (CA-10, CA-11). Retencion: tokenRefrescoUsado = vida del refresco + 30 dias, PURGA_FISICA.';

COMMENT ON COLUMN "acceso"."FamiliaDeRefresco"."id" IS 'INT — IdFamiliaRefresco.';
COMMENT ON COLUMN "acceso"."FamiliaDeRefresco"."sesionId" IS 'INT — sesion a la que pertenece.';
COMMENT ON COLUMN "acceso"."FamiliaDeRefresco"."usuarioId" IS 'PERS — titular.';
COMMENT ON COLUMN "acceso"."FamiliaDeRefresco"."creadaEn" IS 'INT — apertura de la familia.';
COMMENT ON COLUMN "acceso"."FamiliaDeRefresco"."generacionActual" IS 'INT — generacion vigente.';
COMMENT ON COLUMN "acceso"."FamiliaDeRefresco"."invalidadaEn" IS 'INT — al escribirla, el disparador de la 0021 revoca todos los tokens vivos de la familia.';
COMMENT ON COLUMN "acceso"."FamiliaDeRefresco"."motivoInvalidacion" IS 'INT — catalogo cerrado.';

CREATE INDEX "idx_familia_sesion" ON "acceso"."FamiliaDeRefresco" ("sesionId");
CREATE INDEX "idx_familia_usuario" ON "acceso"."FamiliaDeRefresco" ("usuarioId");

ALTER TABLE "acceso"."FamiliaDeRefresco" ADD CONSTRAINT "ck_familia_invalidacion_coherente"
  CHECK (("invalidadaEn" IS NULL) = ("motivoInvalidacion" IS NULL));
ALTER TABLE "acceso"."FamiliaDeRefresco" ADD CONSTRAINT "ck_familia_generacion_no_negativa"
  CHECK ("generacionActual" >= 0);

ALTER TABLE "acceso"."FamiliaDeRefresco" ADD CONSTRAINT "FamiliaDeRefresco_sesionId_fkey"
  FOREIGN KEY ("sesionId") REFERENCES "acceso"."Sesion"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "acceso"."FamiliaDeRefresco" ADD CONSTRAINT "FamiliaDeRefresco_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "acceso"."Usuario"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ═════════════════════════════════════════════════════════════════════════════
-- D.3 — `acceso.TokenDeRefresco`
--
-- **R-002-13, CA-10 y CA-11 — la rotación es atómica en la base, no en el
-- servicio.** El canje se hace con una sola sentencia:
--
--   UPDATE "acceso"."TokenDeRefresco" SET "usadoEn" = now()
--    WHERE "familiaId" = $1 AND "hashDelSecreto" = $2
--      AND "usadoEn" IS NULL AND "revocadoEn" IS NULL RETURNING "id";
--
-- Si devuelve una fila, se rota. Si devuelve cero y la fila existe, ES
-- REUTILIZACIÓN. Dos peticiones concurrentes con el mismo token no pueden ganar
-- las dos porque el UPDATE condicional serializa. Que esto sea una
-- comparación-e-intercambio del motor y no un SELECT seguido de un UPDATE es la
-- diferencia entre CA-11 cumplido y una condición de carrera explotable.
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE "acceso"."TokenDeRefresco" (
    "id" TEXT NOT NULL,
    "familiaId" TEXT NOT NULL,
    "generacion" INTEGER NOT NULL,
    "hashDelSecreto" BYTEA NOT NULL,
    "emitidoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "venceEn" TIMESTAMPTZ(6) NOT NULL,
    "usadoEn" TIMESTAMPTZ(6),
    "sucesorId" TEXT,
    "revocadoEn" TIMESTAMPTZ(6),

    CONSTRAINT "TokenDeRefresco_pkey" PRIMARY KEY ("id")
);

COMMENT ON TABLE "acceso"."TokenDeRefresco" IS
  'D.3 — token de refresco. Todo INT: no hay dato personal aca, solo material criptografico. Retencion: tokenRefrescoUsado = vida del refresco + 30 dias, PURGA_FISICA. El margen es lo que permite detectar la reutilizacion de CA-11: sin margen, un token robado y usado tarde pasaria por nuevo.';

COMMENT ON COLUMN "acceso"."TokenDeRefresco"."id" IS 'INT — identificador opaco.';
COMMENT ON COLUMN "acceso"."TokenDeRefresco"."familiaId" IS 'INT — familia a la que pertenece.';
COMMENT ON COLUMN "acceso"."TokenDeRefresco"."generacion" IS 'INT — posicion en la cadena de rotacion.';
COMMENT ON COLUMN "acceso"."TokenDeRefresco"."hashDelSecreto" IS 'INT — HMAC-SHA-256 del secreto. El token viaja como <idFamilia>.<secreto> y el secreto en claro solo existe en transito. No exportable: REVOKE SELECT de columna en la 0020.';
COMMENT ON COLUMN "acceso"."TokenDeRefresco"."emitidoEn" IS 'INT — emision.';
COMMENT ON COLUMN "acceso"."TokenDeRefresco"."venceEn" IS 'INT — vencimiento.';
COMMENT ON COLUMN "acceso"."TokenDeRefresco"."usadoEn" IS 'INT — consumo. Lo escribe el UPDATE condicional atomico de R-002-13.';
COMMENT ON COLUMN "acceso"."TokenDeRefresco"."sucesorId" IS 'INT — token que lo reemplazo en la rotacion.';
COMMENT ON COLUMN "acceso"."TokenDeRefresco"."revocadoEn" IS 'INT — revocacion.';

CREATE UNIQUE INDEX "uq_refresco_sucesor" ON "acceso"."TokenDeRefresco" ("sucesorId");
-- Q-03: canjear un token de refresco. La consulta más frecuente del bloque.
CREATE UNIQUE INDEX "uq_refresco_familia_hash" ON "acceso"."TokenDeRefresco" ("familiaId", "hashDelSecreto");
CREATE UNIQUE INDEX "uq_refresco_familia_generacion" ON "acceso"."TokenDeRefresco" ("familiaId", "generacion");
-- Q-17: tokens vencidos, para purgar.
CREATE INDEX "idx_refresco_vence" ON "acceso"."TokenDeRefresco" ("venceEn");

-- Invariante 2 de D.3: no hay sucesor sin uso. Un token con sucesor y sin
-- `usadoEn` sería una rotación que nadie canjeó.
ALTER TABLE "acceso"."TokenDeRefresco" ADD CONSTRAINT "ck_refresco_sucesor_exige_uso"
  CHECK ("sucesorId" IS NULL OR "usadoEn" IS NOT NULL);
ALTER TABLE "acceso"."TokenDeRefresco" ADD CONSTRAINT "ck_refresco_no_es_su_sucesor"
  CHECK ("sucesorId" IS NULL OR "sucesorId" <> "id");
ALTER TABLE "acceso"."TokenDeRefresco" ADD CONSTRAINT "ck_refresco_vence_despues"
  CHECK ("venceEn" > "emitidoEn");
ALTER TABLE "acceso"."TokenDeRefresco" ADD CONSTRAINT "ck_refresco_generacion_no_negativa"
  CHECK ("generacion" >= 0);

ALTER TABLE "acceso"."TokenDeRefresco" ADD CONSTRAINT "TokenDeRefresco_familiaId_fkey"
  FOREIGN KEY ("familiaId") REFERENCES "acceso"."FamiliaDeRefresco"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "acceso"."TokenDeRefresco" ADD CONSTRAINT "TokenDeRefresco_sucesorId_fkey"
  FOREIGN KEY ("sucesorId") REFERENCES "acceso"."TokenDeRefresco"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ═════════════════════════════════════════════════════════════════════════════
-- D.4 — `acceso.DesafioDeIngreso`
--
-- `usuarioId` es ANULABLE a propósito. El contrato exige que el desafío se
-- emita SIEMPRE, exista o no la cuenta: si sólo hubiera fila para las cuentas
-- existentes, la ausencia de desafío sería la señal que CA-08 y R-05 prohíben
-- dar. Una fila con `usuarioId NULL` es un desafío señuelo, y es funcionalmente
-- necesaria.
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE "acceso"."DesafioDeIngreso" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT,
    "claveDeTrafico" BYTEA NOT NULL,
    "siguientePaso" "acceso"."SiguientePasoDesafio" NOT NULL,
    "metodosAdmitidos" TEXT[],
    "creadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "venceEn" TIMESTAMPTZ(6) NOT NULL,
    "consumidoEn" TIMESTAMPTZ(6),
    "intentosDeSegundoFactor" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DesafioDeIngreso_pkey" PRIMARY KEY ("id")
);

COMMENT ON TABLE "acceso"."DesafioDeIngreso" IS
  'D.4 — desafio de ingreso (CA-08). Se emite SIEMPRE, exista o no la cuenta: una fila con usuarioId NULL es un desafio senuelo y es funcionalmente necesaria contra el oraculo de enumeracion. Retencion: desafioDeIngreso = 15 min de vida + 24 h de registro, PURGA_FISICA.';

COMMENT ON COLUMN "acceso"."DesafioDeIngreso"."id" IS 'INT — identificador opaco.';
COMMENT ON COLUMN "acceso"."DesafioDeIngreso"."usuarioId" IS 'PERS — anulable a proposito: el desafio senuelo no apunta a nadie.';
COMMENT ON COLUMN "acceso"."DesafioDeIngreso"."claveDeTrafico" IS 'PERS — HMAC del correo o del CUIT/CUIL normalizado. No reversible.';
COMMENT ON COLUMN "acceso"."DesafioDeIngreso"."siguientePaso" IS 'INT — que se le pide a continuacion.';
COMMENT ON COLUMN "acceso"."DesafioDeIngreso"."metodosAdmitidos" IS 'INT — metodos de segundo factor admitidos (TOTP, CODIGO_DE_RESPALDO).';
COMMENT ON COLUMN "acceso"."DesafioDeIngreso"."creadoEn" IS 'INT — emision.';
COMMENT ON COLUMN "acceso"."DesafioDeIngreso"."venceEn" IS 'INT — vencimiento.';
COMMENT ON COLUMN "acceso"."DesafioDeIngreso"."consumidoEn" IS 'INT — consumo.';
COMMENT ON COLUMN "acceso"."DesafioDeIngreso"."intentosDeSegundoFactor" IS 'INT — intentos dentro del desafio.';

CREATE INDEX "idx_desafio_trafico" ON "acceso"."DesafioDeIngreso" ("claveDeTrafico");
CREATE INDEX "idx_desafio_vence" ON "acceso"."DesafioDeIngreso" ("venceEn");
CREATE INDEX "idx_desafio_usuario" ON "acceso"."DesafioDeIngreso" ("usuarioId");

ALTER TABLE "acceso"."DesafioDeIngreso" ADD CONSTRAINT "ck_desafio_vence_despues"
  CHECK ("venceEn" > "creadoEn");
ALTER TABLE "acceso"."DesafioDeIngreso" ADD CONSTRAINT "ck_desafio_intentos_no_negativos"
  CHECK ("intentosDeSegundoFactor" >= 0);
ALTER TABLE "acceso"."DesafioDeIngreso" ADD CONSTRAINT "ck_desafio_metodos_declarados"
  CHECK ("metodosAdmitidos" IS NOT NULL);

ALTER TABLE "acceso"."DesafioDeIngreso" ADD CONSTRAINT "DesafioDeIngreso_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "acceso"."Usuario"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ═════════════════════════════════════════════════════════════════════════════
-- D.5 — `acceso.IntentoDeAutenticacion`
--
-- **La clave es `claveDeTrafico`, no `usuarioId`.** El conteo y el bloqueo se
-- aplican también a identificadores que NO existen, porque si sólo se contaran
-- los existentes el propio bloqueo sería el oráculo de enumeración que R-05
-- prohíbe. Sólo inserción.
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE "acceso"."IntentoDeAutenticacion" (
    "id" BIGSERIAL NOT NULL,
    "claveDeTrafico" BYTEA NOT NULL,
    "ocurridoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resultado" "acceso"."ResultadoIntento" NOT NULL,
    "ipHash" BYTEA,
    "usuarioId" TEXT,

    CONSTRAINT "IntentoDeAutenticacion_pkey" PRIMARY KEY ("id")
);

COMMENT ON TABLE "acceso"."IntentoDeAutenticacion" IS
  'D.5 — intento de autenticacion (CA-09). SOLO INSERCION. Retencion: intentosFallidos = 7 dias, PURGA_FISICA. La ventana del parametro es 15 min; el resto es margen para ver patrones (dictamen §5.B: "no indefinido").';

COMMENT ON COLUMN "acceso"."IntentoDeAutenticacion"."id" IS 'INT — secuencia local.';
COMMENT ON COLUMN "acceso"."IntentoDeAutenticacion"."claveDeTrafico" IS 'PERS — HMAC del identificador tecleado. Es la clave del conteo, no el usuario.';
COMMENT ON COLUMN "acceso"."IntentoDeAutenticacion"."ocurridoEn" IS 'INT — momento del intento.';
COMMENT ON COLUMN "acceso"."IntentoDeAutenticacion"."resultado" IS 'INT — CUENTA_INEXISTENTE es un resultado de primera clase.';
COMMENT ON COLUMN "acceso"."IntentoDeAutenticacion"."ipHash" IS 'PERS — HMAC. Nunca la IP en claro.';
COMMENT ON COLUMN "acceso"."IntentoDeAutenticacion"."usuarioId" IS 'PERS — anulable: el intento contra una cuenta inexistente no tiene a quien apuntar, y ese es precisamente el caso que hay que contar.';

-- Q-06 (CA-09): intentos de una clave de tráfico dentro de la ventana. Se
-- consulta en CADA intento de ingreso.
CREATE INDEX "idx_intento_trafico" ON "acceso"."IntentoDeAutenticacion" ("claveDeTrafico", "ocurridoEn" DESC);
CREATE INDEX "idx_intento_ocurrido" ON "acceso"."IntentoDeAutenticacion" ("ocurridoEn");
CREATE INDEX "idx_intento_usuario" ON "acceso"."IntentoDeAutenticacion" ("usuarioId");

-- Un intento con resultado CUENTA_INEXISTENTE no puede apuntar a una cuenta:
-- si lo hiciera, la propia tabla desmentiría el resultado que registra.
ALTER TABLE "acceso"."IntentoDeAutenticacion" ADD CONSTRAINT "ck_intento_inexistente_sin_usuario"
  CHECK ("resultado" <> 'CUENTA_INEXISTENTE' OR "usuarioId" IS NULL);

ALTER TABLE "acceso"."IntentoDeAutenticacion" ADD CONSTRAINT "IntentoDeAutenticacion_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "acceso"."Usuario"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ═════════════════════════════════════════════════════════════════════════════
-- D.6 — `acceso.BloqueoDeTrafico` (CA-09, CA-37)
--
-- **El bloqueo NO cuelga de `Usuario`, y es deliberado.** CA-36 y el recaudo
-- A-1 exigen que el bloqueo nunca inhabilite la recuperación de contraseña; eso
-- es la AUSENCIA de una consulta y ninguna restricción puede exigirlo. Lo que sí
-- hace el modelo es no darle a nadie la tentación de acoplarlas: el bloqueo no
-- aparece al leer la cuenta.
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE "acceso"."BloqueoDeTrafico" (
    "claveDeTrafico" BYTEA NOT NULL,
    "aplicadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hasta" TIMESTAMPTZ(6) NOT NULL,
    "intentosContados" INTEGER NOT NULL,
    "notificadoEn" TIMESTAMPTZ(6),
    "envioId" TEXT,

    CONSTRAINT "BloqueoDeTrafico_pkey" PRIMARY KEY ("claveDeTrafico")
);

COMMENT ON TABLE "acceso"."BloqueoDeTrafico" IS
  'D.6 — bloqueo por intentos fallidos (CA-09, CA-37). Los umbrales viven en H.3, no en el codigo (constitucion #11). De aca se DERIVA BLOQUEADA_TEMPORALMENTE, que no es un valor almacenable de EstadoCuenta (E-002-7). Retencion: intentosFallidos = 7 dias, PURGA_FISICA.';

COMMENT ON COLUMN "acceso"."BloqueoDeTrafico"."claveDeTrafico" IS 'PERS — HMAC del identificador. Q-07 la sirve la PK.';
COMMENT ON COLUMN "acceso"."BloqueoDeTrafico"."aplicadoEn" IS 'INT — inicio del bloqueo.';
COMMENT ON COLUMN "acceso"."BloqueoDeTrafico"."hasta" IS 'INT — fin del bloqueo.';
COMMENT ON COLUMN "acceso"."BloqueoDeTrafico"."intentosContados" IS 'INT — intentos que lo provocaron.';
COMMENT ON COLUMN "acceso"."BloqueoDeTrafico"."notificadoEn" IS 'INT — cuando se aviso al titular, si existia.';
COMMENT ON COLUMN "acceso"."BloqueoDeTrafico"."envioId" IS 'INT — envio del aviso.';

CREATE INDEX "idx_bloqueo_envio" ON "acceso"."BloqueoDeTrafico" ("envioId");

ALTER TABLE "acceso"."BloqueoDeTrafico" ADD CONSTRAINT "ck_bloqueo_ventana_ordenada"
  CHECK ("hasta" > "aplicadoEn");
ALTER TABLE "acceso"."BloqueoDeTrafico" ADD CONSTRAINT "ck_bloqueo_intentos_positivos"
  CHECK ("intentosContados" > 0);

ALTER TABLE "acceso"."BloqueoDeTrafico" ADD CONSTRAINT "BloqueoDeTrafico_envioId_fkey"
  FOREIGN KEY ("envioId") REFERENCES "acceso"."EnvioTransaccional"("claveDeIdempotencia")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ═════════════════════════════════════════════════════════════════════════════
-- D.7 — `acceso.EnlaceDeUnSoloUso` (CA-06, CA-15, CA-16, CA-17)
--
-- **R-002-14**: mismo canje atómico que D.3
-- (`UPDATE … WHERE "usadoEn" IS NULL AND "invalidadoEn" IS NULL RETURNING`), que
-- es lo que hace que "la segunda vez no funciona" sea verdad bajo concurrencia
-- y no sólo en el camino feliz.
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE "acceso"."EnlaceDeUnSoloUso" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "proposito" "acceso"."PropositoEnlace" NOT NULL,
    "hashDelSecreto" BYTEA NOT NULL,
    "creadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "venceEn" TIMESTAMPTZ(6) NOT NULL,
    "usadoEn" TIMESTAMPTZ(6),
    "invalidadoEn" TIMESTAMPTZ(6),
    "envioId" TEXT NOT NULL,
    "claveIdempotencia" TEXT NOT NULL,

    CONSTRAINT "EnlaceDeUnSoloUso_pkey" PRIMARY KEY ("id")
);

COMMENT ON TABLE "acceso"."EnlaceDeUnSoloUso" IS
  'D.7 — enlace de un solo uso (CA-06, CA-15, CA-16, CA-17). Retencion: enlaceConfirmacion = 24 h de vida + 7 dias de registro; enlaceRecuperacion = 1 h de vida + 7 dias. Ambas PURGA_FISICA.';

COMMENT ON COLUMN "acceso"."EnlaceDeUnSoloUso"."id" IS 'INT — identificador opaco.';
COMMENT ON COLUMN "acceso"."EnlaceDeUnSoloUso"."usuarioId" IS 'PERS — titular del enlace.';
COMMENT ON COLUMN "acceso"."EnlaceDeUnSoloUso"."proposito" IS 'INT — confirmacion de correo o recuperacion de contrasena.';
COMMENT ON COLUMN "acceso"."EnlaceDeUnSoloUso"."hashDelSecreto" IS 'INT — HMAC-SHA-256. No exportable: REVOKE SELECT de columna en la 0020.';
COMMENT ON COLUMN "acceso"."EnlaceDeUnSoloUso"."creadoEn" IS 'INT — emision.';
COMMENT ON COLUMN "acceso"."EnlaceDeUnSoloUso"."venceEn" IS 'INT — vencimiento.';
COMMENT ON COLUMN "acceso"."EnlaceDeUnSoloUso"."usadoEn" IS 'INT — consumo; lo escribe el UPDATE condicional atomico de R-002-14.';
COMMENT ON COLUMN "acceso"."EnlaceDeUnSoloUso"."invalidadoEn" IS 'INT — invalidacion masiva al completar una recuperacion (CA-16).';
COMMENT ON COLUMN "acceso"."EnlaceDeUnSoloUso"."envioId" IS 'INT — envio por el que viajo.';
COMMENT ON COLUMN "acceso"."EnlaceDeUnSoloUso"."claveIdempotencia" IS 'INT — constitucion #12.';

CREATE UNIQUE INDEX "uq_enlace_hash" ON "acceso"."EnlaceDeUnSoloUso" ("hashDelSecreto");
CREATE UNIQUE INDEX "uq_enlace_idempotencia" ON "acceso"."EnlaceDeUnSoloUso" ("claveIdempotencia");
CREATE INDEX "idx_enlace_usuario" ON "acceso"."EnlaceDeUnSoloUso" ("usuarioId");
-- Q-17: enlaces vencidos, para purgar.
CREATE INDEX "idx_enlace_vence" ON "acceso"."EnlaceDeUnSoloUso" ("venceEn");
CREATE INDEX "idx_enlace_envio" ON "acceso"."EnlaceDeUnSoloUso" ("envioId");

ALTER TABLE "acceso"."EnlaceDeUnSoloUso" ADD CONSTRAINT "ck_enlace_vence_despues"
  CHECK ("venceEn" > "creadoEn");
-- Un enlace usado no se invalida después: o se consumió o se anuló, no las dos.
ALTER TABLE "acceso"."EnlaceDeUnSoloUso" ADD CONSTRAINT "ck_enlace_uso_excluyente"
  CHECK ("usadoEn" IS NULL OR "invalidadoEn" IS NULL);

ALTER TABLE "acceso"."EnlaceDeUnSoloUso" ADD CONSTRAINT "EnlaceDeUnSoloUso_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "acceso"."Usuario"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "acceso"."EnlaceDeUnSoloUso" ADD CONSTRAINT "EnlaceDeUnSoloUso_envioId_fkey"
  FOREIGN KEY ("envioId") REFERENCES "acceso"."EnvioTransaccional"("claveDeIdempotencia")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
