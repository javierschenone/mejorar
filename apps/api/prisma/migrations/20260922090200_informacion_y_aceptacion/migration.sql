-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 0013 — informacion_y_aceptacion
-- Feature 002, tarea T-03. Fila `0013` de modelo-datos.md §6.2.
-- Bloque B: B.1 `VersionDocumentoAceptable`, B.2 `VersionInformacionArt6`,
-- B.3 `CampoDeclaradoEnElAlta`, B.4 `AceptacionRegistrada`.
--
-- Implementa C-002-01 y C-002-02, las dos condiciones que el dictamen §9 marca
-- como "lo único verdaderamente urgente, en el sentido de que no se puede
-- reparar después": si el alta corre sin registrar qué texto se mostró y qué
-- se aceptó, ese dato no se puede reconstruir más tarde.
--
-- Reversión: reversion.sql de este mismo directorio.
-- ─────────────────────────────────────────────────────────────────────────────

-- ═════════════════════════════════════════════════════════════════════════════
-- B.1 — `acceso.VersionDocumentoAceptable`
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE "acceso"."VersionDocumentoAceptable" (
    "clase" "acceso"."ClaseDocumentoAceptable" NOT NULL,
    "version" TEXT NOT NULL,
    "hashDelTexto" TEXT NOT NULL,
    "referenciaDelTexto" TEXT NOT NULL,
    "vigenteDesde" TIMESTAMPTZ(6) NOT NULL,
    "vigenteHasta" TIMESTAMPTZ(6),
    "incluyeFinalidadesDeLa003" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VersionDocumentoAceptable_pkey" PRIMARY KEY ("clase","version")
);

COMMENT ON TABLE "acceso"."VersionDocumentoAceptable" IS
  'B.1 — version de un documento aceptable (terminos y condiciones, politica de privacidad). Solo insercion. Retencion: INDEFINIDA, nunca se suprime. No son datos personales, y conservarlos es lo que permite probar que texto acepto cada persona (CA-27).';

COMMENT ON COLUMN "acceso"."VersionDocumentoAceptable"."clase" IS 'PUB — TERMINOS_Y_CONDICIONES o POLITICA_DE_PRIVACIDAD.';
COMMENT ON COLUMN "acceso"."VersionDocumentoAceptable"."version" IS 'PUB — identificador de la version.';
COMMENT ON COLUMN "acceso"."VersionDocumentoAceptable"."hashDelTexto" IS 'PUB — SHA-256 del texto exacto mostrado.';
COMMENT ON COLUMN "acceso"."VersionDocumentoAceptable"."referenciaDelTexto" IS 'PUB — ubicacion del documento integro.';
COMMENT ON COLUMN "acceso"."VersionDocumentoAceptable"."vigenteDesde" IS 'PUB — inicio de vigencia.';
COMMENT ON COLUMN "acceso"."VersionDocumentoAceptable"."vigenteHasta" IS 'PUB — fin de vigencia; NULL mientras esta vigente.';
COMMENT ON COLUMN "acceso"."VersionDocumentoAceptable"."incluyeFinalidadesDeLa003" IS 'PUB — R-002-07: existe PARA NO PODER SER VERDADERA. CHECK = false.';
COMMENT ON COLUMN "acceso"."VersionDocumentoAceptable"."creadoEn" IS 'INT — alta de la fila.';

-- **R-002-07.** Esa columna existe para no poder ser verdadera. Es el espejo en
-- la base del literal `false` del contrato (§10): el día que alguien quiera
-- meter la consulta a bureaus, la cesión a terceros o las comunicaciones
-- comerciales dentro de los términos generales, el INSERT FALLA y el cambio
-- tiene que pasar por compuerta. Es la defensa concreta contra el art. 37 de la
-- Ley 24.240 y contra desactivar de hecho el control de consentimiento de la
-- feature 003 (dictamen §4.5.3).
ALTER TABLE "acceso"."VersionDocumentoAceptable" ADD CONSTRAINT "ck_documento_sin_finalidades_003"
  CHECK ("incluyeFinalidadesDeLa003" = false);

ALTER TABLE "acceso"."VersionDocumentoAceptable" ADD CONSTRAINT "ck_documento_vigencia_ordenada"
  CHECK ("vigenteHasta" IS NULL OR "vigenteHasta" > "vigenteDesde");

-- A lo sumo una versión vigente por clase. Sin esto, "qué texto está vigente
-- hoy" tiene dos respuestas y el alta elige cualquiera.
CREATE UNIQUE INDEX "uq_documento_vigente"
  ON "acceso"."VersionDocumentoAceptable" ("clase")
  WHERE "vigenteHasta" IS NULL;

-- ═════════════════════════════════════════════════════════════════════════════
-- B.2 — `acceso.VersionInformacionArt6`
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE "acceso"."VersionInformacionArt6" (
    "version" TEXT NOT NULL,
    "hashDelTexto" TEXT NOT NULL,
    "responsableRazonSocial" TEXT NOT NULL,
    "responsableDomicilio" TEXT NOT NULL,
    "destinatarios" TEXT[],
    "canalDeEjercicioDeDerechos" TEXT NOT NULL,
    "vigenteDesde" TIMESTAMPTZ(6) NOT NULL,
    "vigenteHasta" TIMESTAMPTZ(6),
    "creadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VersionInformacionArt6_pkey" PRIMARY KEY ("version")
);

COMMENT ON TABLE "acceso"."VersionInformacionArt6" IS
  'B.2 — version del texto del art. 6 de la Ley 25.326 que se le muestra al titular en el alta (CA-26, C-002-01). Solo insercion. Retencion: INDEFINIDA; es la prueba de que se informo.';

COMMENT ON COLUMN "acceso"."VersionInformacionArt6"."version" IS 'PUB — identificador de la version.';
COMMENT ON COLUMN "acceso"."VersionInformacionArt6"."hashDelTexto" IS 'PUB — SHA-256 del texto exacto mostrado.';
COMMENT ON COLUMN "acceso"."VersionInformacionArt6"."responsableRazonSocial" IS 'PUB — art. 6 inc. b): identidad del responsable.';
COMMENT ON COLUMN "acceso"."VersionInformacionArt6"."responsableDomicilio" IS 'PUB — art. 6 inc. b): domicilio del responsable. Es el domicilio de la EMPRESA, no de una persona.';
COMMENT ON COLUMN "acceso"."VersionInformacionArt6"."destinatarios" IS 'PUB — art. 6 inc. a) y d): a quienes pueden comunicarse los datos.';
COMMENT ON COLUMN "acceso"."VersionInformacionArt6"."canalDeEjercicioDeDerechos" IS 'PUB — art. 6 inc. e): como se ejercen acceso, rectificacion y supresion.';
COMMENT ON COLUMN "acceso"."VersionInformacionArt6"."vigenteDesde" IS 'PUB — inicio de vigencia.';
COMMENT ON COLUMN "acceso"."VersionInformacionArt6"."vigenteHasta" IS 'PUB — fin de vigencia.';
COMMENT ON COLUMN "acceso"."VersionInformacionArt6"."creadoEn" IS 'INT — alta de la fila.';

ALTER TABLE "acceso"."VersionInformacionArt6" ADD CONSTRAINT "ck_art6_vigencia_ordenada"
  CHECK ("vigenteHasta" IS NULL OR "vigenteHasta" > "vigenteDesde");

-- Art. 6 inc. a) y d). Un texto del art. 6 sin destinatarios declarados no
-- informa nada: la lista puede decir "ninguno", pero no puede estar vacía por
-- omisión.
ALTER TABLE "acceso"."VersionInformacionArt6" ADD CONSTRAINT "ck_art6_destinatarios_declarados"
  CHECK ("destinatarios" IS NOT NULL AND array_length("destinatarios", 1) >= 1);

CREATE UNIQUE INDEX "uq_art6_vigente"
  ON "acceso"."VersionInformacionArt6" (("vigenteHasta" IS NULL))
  WHERE "vigenteHasta" IS NULL;

-- ═════════════════════════════════════════════════════════════════════════════
-- B.3 — `acceso.CampoDeclaradoEnElAlta`
--
-- Es el inciso c) del art. 6 —"el que más se olvida" (dictamen §3)— convertido
-- en estructura: por cada campo que el formulario recolecta hay que declarar su
-- carácter (obligatorio o facultativo), su finalidad y la consecuencia de no
-- darlo. El disparador de completitud vive en la 0021.
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE "acceso"."CampoDeclaradoEnElAlta" (
    "version" TEXT NOT NULL,
    "campo" "acceso"."CampoDelAlta" NOT NULL,
    "caracter" "acceso"."CaracterDelCampo" NOT NULL,
    "claveDeFinalidad" TEXT NOT NULL,
    "consecuenciaDeNoDarlo" TEXT NOT NULL,
    "creadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampoDeclaradoEnElAlta_pkey" PRIMARY KEY ("version","campo")
);

COMMENT ON TABLE "acceso"."CampoDeclaradoEnElAlta" IS
  'B.3 — un campo del formulario de alta, declarado en el art. 6 inc. c). Solo insercion. Enganche formal de E-002-1: mientras el CUIT/CUIL no tenga fila aca con su finalidad y su caracter, A.2 no se habilita. Retencion: INDEFINIDA.';

COMMENT ON COLUMN "acceso"."CampoDeclaradoEnElAlta"."version" IS 'PUB — version del texto del art. 6 a la que pertenece.';
COMMENT ON COLUMN "acceso"."CampoDeclaradoEnElAlta"."campo" IS 'PUB — que campo del formulario.';
COMMENT ON COLUMN "acceso"."CampoDeclaradoEnElAlta"."caracter" IS 'PUB — art. 6 inc. c): obligatorio o facultativo.';
COMMENT ON COLUMN "acceso"."CampoDeclaradoEnElAlta"."claveDeFinalidad" IS 'PUB — finalidad declarada del tratamiento de ese campo.';
COMMENT ON COLUMN "acceso"."CampoDeclaradoEnElAlta"."consecuenciaDeNoDarlo" IS 'PUB — inc. c), segunda mitad: que pasa si el titular no lo da.';
COMMENT ON COLUMN "acceso"."CampoDeclaradoEnElAlta"."creadoEn" IS 'INT — alta de la fila.';

-- Un campo declarado sin finalidad o sin consecuencia no cumple el inciso c):
-- la cadena vacía es la forma en que ese requisito se incumple en la práctica.
ALTER TABLE "acceso"."CampoDeclaradoEnElAlta" ADD CONSTRAINT "ck_campo_alta_textos_no_vacios"
  CHECK (length(btrim("claveDeFinalidad")) > 0 AND length(btrim("consecuenciaDeNoDarlo")) > 0);

ALTER TABLE "acceso"."CampoDeclaradoEnElAlta" ADD CONSTRAINT "CampoDeclaradoEnElAlta_version_fkey"
  FOREIGN KEY ("version") REFERENCES "acceso"."VersionInformacionArt6"("version")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ═════════════════════════════════════════════════════════════════════════════
-- B.4 — `acceso.AceptacionRegistrada`
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE "acceso"."AceptacionRegistrada" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "documentoClase" "acceso"."ClaseDocumentoAceptable" NOT NULL,
    "documentoVersion" TEXT NOT NULL,
    "hashDelTextoMostrado" TEXT NOT NULL,
    "momento" TIMESTAMPTZ(6) NOT NULL,
    "ipCifrada" BYTEA NOT NULL,
    "ipNonce" BYTEA NOT NULL,
    "ipTag" BYTEA NOT NULL,
    "ipIdClave" TEXT NOT NULL,
    "canal" "acceso"."CanalDeAceptacion" NOT NULL,
    "casillaMarcada" TEXT NOT NULL,
    "versionInformacionArt6" TEXT NOT NULL,
    "revocadaEn" TIMESTAMPTZ(6),
    "creadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AceptacionRegistrada_pkey" PRIMARY KEY ("id")
);

COMMENT ON TABLE "acceso"."AceptacionRegistrada" IS
  'B.4 — la aceptacion registrada (CA-27, R-002-06). Solo insercion salvo revocadaEn: la revocacion se registra, la fila nunca se borra. Retencion: A_DETERMINAR (escalamiento E-002-3, bloqueante); provisoriamente conservacion indefinida y sin purga automatica, que R-002-15 garantiza materialmente.';

COMMENT ON COLUMN "acceso"."AceptacionRegistrada"."id" IS 'INT — identificador opaco.';
COMMENT ON COLUMN "acceso"."AceptacionRegistrada"."usuarioId" IS 'PERS — quien acepto.';
COMMENT ON COLUMN "acceso"."AceptacionRegistrada"."documentoClase" IS 'PUB — clave foranea COMPUESTA contra B.1: no se puede aceptar una version que no existe.';
COMMENT ON COLUMN "acceso"."AceptacionRegistrada"."documentoVersion" IS 'PUB — version aceptada.';
COMMENT ON COLUMN "acceso"."AceptacionRegistrada"."hashDelTextoMostrado" IS 'INT — se COPIA aca ademas de estar en B.1: si manana alguien corrige una errata en el catalogo, la prueba de que vio esta persona sigue siendo esta fila.';
COMMENT ON COLUMN "acceso"."AceptacionRegistrada"."momento" IS 'INT — cuando acepto.';
COMMENT ON COLUMN "acceso"."AceptacionRegistrada"."ipCifrada" IS 'PERS↑ — AES-256-GCM k_acceso. CIFRADA Y RECUPERABLE, no hasheada: es prueba de una firma electronica que por la Ley 25.506 no goza de presuncion de validez, y la carga de acreditarla es nuestra. Un HMAC solo prueba una IP que ya se conoce, lo que en un litigio es inutil.';
COMMENT ON COLUMN "acceso"."AceptacionRegistrada"."ipNonce" IS 'INT — nonce del cifrado de la IP.';
COMMENT ON COLUMN "acceso"."AceptacionRegistrada"."ipTag" IS 'INT — etiqueta GCM de la IP.';
COMMENT ON COLUMN "acceso"."AceptacionRegistrada"."ipIdClave" IS 'INT — identificador de la clave usada.';
COMMENT ON COLUMN "acceso"."AceptacionRegistrada"."canal" IS 'INT — WEB o MOVIL.';
COMMENT ON COLUMN "acceso"."AceptacionRegistrada"."casillaMarcada" IS 'INT — identificador de la casilla concreta que se marco.';
COMMENT ON COLUMN "acceso"."AceptacionRegistrada"."versionInformacionArt6" IS 'PUB — que texto del art. 6 se le mostro (CA-26).';
COMMENT ON COLUMN "acceso"."AceptacionRegistrada"."revocadaEn" IS 'INT — la revocacion se registra; la fila nunca se borra.';
COMMENT ON COLUMN "acceso"."AceptacionRegistrada"."creadoEn" IS 'INT — alta de la fila.';

-- Q-21 (CA-25, CA-27): aceptaciones de un titular, para prueba y exportación.
CREATE INDEX "idx_aceptacion_titular" ON "acceso"."AceptacionRegistrada" ("usuarioId", "momento" DESC);
CREATE INDEX "idx_aceptacion_documento" ON "acceso"."AceptacionRegistrada" ("documentoClase", "documentoVersion");
CREATE INDEX "idx_aceptacion_art6" ON "acceso"."AceptacionRegistrada" ("versionInformacionArt6");

-- Una persona acepta una versión una vez. Sin esto, "¿aceptó?" tiene varias
-- respuestas posibles y la prueba se vuelve un conteo.
CREATE UNIQUE INDEX "uq_aceptacion_titular_documento"
  ON "acceso"."AceptacionRegistrada" ("usuarioId", "documentoClase", "documentoVersion");

ALTER TABLE "acceso"."AceptacionRegistrada" ADD CONSTRAINT "ck_aceptacion_revocacion_posterior"
  CHECK ("revocadaEn" IS NULL OR "revocadaEn" >= "momento");

ALTER TABLE "acceso"."AceptacionRegistrada" ADD CONSTRAINT "AceptacionRegistrada_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "acceso"."Usuario"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "acceso"."AceptacionRegistrada" ADD CONSTRAINT "fk_aceptacion_documento"
  FOREIGN KEY ("documentoClase", "documentoVersion")
  REFERENCES "acceso"."VersionDocumentoAceptable"("clase", "version")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "acceso"."AceptacionRegistrada" ADD CONSTRAINT "AceptacionRegistrada_versionInformacionArt6_fkey"
  FOREIGN KEY ("versionInformacionArt6") REFERENCES "acceso"."VersionInformacionArt6"("version")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
