-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 0014 — verificacion_profesional
-- Feature 002, tarea T-03. Fila `0014` de modelo-datos.md §6.2.
-- Bloque C: C.1 `DecisionDeVerificacion`, C.2 `SuspensionDeMatricula`,
-- C.3 `HitoDeVigenciaNotificado`, C.4 `EscalamientoDeVerificacion`.
--
-- **Todo este bloque es de sólo inserción y no tiene ninguna columna de estado
-- de verificación.** El estado se deriva con `derivarEstadoMatricula` a partir
-- de estos hechos y del instante de evaluación (D-2). Una columna
-- `estadoVerificacion` exigiría un proceso que la mantenga, y un proceso que no
-- corre deja al sistema afirmando que un abogado está verificado cuando ya no
-- lo está.
--
-- Reversión: reversion.sql de este mismo directorio.
-- ─────────────────────────────────────────────────────────────────────────────

-- ═════════════════════════════════════════════════════════════════════════════
-- C.1 — `acceso.DecisionDeVerificacion`
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE "acceso"."DecisionDeVerificacion" (
    "id" TEXT NOT NULL,
    "perfilUsuarioId" TEXT NOT NULL,
    "momento" TIMESTAMPTZ(6) NOT NULL,
    "resultado" "acceso"."ResultadoDecisionVerificacion" NOT NULL,
    "vigenciaHasta" DATE,
    "decididaPor" TEXT NOT NULL,
    "evidenciaColegio" TEXT,
    "evidenciaJurisdiccion" "acceso"."Jurisdiccion",
    "evidenciaNumeroDeMatricula" TEXT,
    "evidenciaTomoYFolio" TEXT,
    "evidenciaClaseDeConstancia" "acceso"."ClaseDeConstancia",
    "evidenciaFechaDeLaConstancia" DATE,
    "evidenciaReferenciaDelDocumento" TEXT,
    "evidenciaHuellaDocumento" TEXT,
    "motivoRechazo" "acceso"."MotivoRechazoVerificacion",
    "claveIdempotencia" TEXT NOT NULL,
    "creadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisionDeVerificacion_pkey" PRIMARY KEY ("id")
);

COMMENT ON TABLE "acceso"."DecisionDeVerificacion" IS
  'C.1 — una decision de verificacion de matricula. SOLO INSERCION: corregir una decision equivocada es emitir otra. Retencion: verificacionProfesional = A_DETERMINAR (escalamiento E-002-3, el mismo E-2 que la 004 dejo abierto). Sin purga automatica.';

COMMENT ON COLUMN "acceso"."DecisionDeVerificacion"."id" IS 'INT — identificador opaco.';
COMMENT ON COLUMN "acceso"."DecisionDeVerificacion"."perfilUsuarioId" IS 'PERS — perfil profesional sobre el que se decide.';
COMMENT ON COLUMN "acceso"."DecisionDeVerificacion"."momento" IS 'INT — cuando se decidio.';
COMMENT ON COLUMN "acceso"."DecisionDeVerificacion"."resultado" IS 'INT — APROBADA o RECHAZADA. NO es el estado de la matricula: ese se deriva.';
COMMENT ON COLUMN "acceso"."DecisionDeVerificacion"."vigenciaHasta" IS 'INT — CA-05 y CA-29. R-002-09: una aprobada sin esta fecha no es representable.';
COMMENT ON COLUMN "acceso"."DecisionDeVerificacion"."decididaPor" IS 'PERS — quien aprobo o rechazo.';
COMMENT ON COLUMN "acceso"."DecisionDeVerificacion"."evidenciaColegio" IS 'PERS — colegio que emitio la constancia. En claro: es dato de publicidad registral.';
COMMENT ON COLUMN "acceso"."DecisionDeVerificacion"."evidenciaJurisdiccion" IS 'PERS — jurisdiccion de la constancia; el disparador de la 0021 exige que coincida con la declarada en A.3.';
COMMENT ON COLUMN "acceso"."DecisionDeVerificacion"."evidenciaNumeroDeMatricula" IS 'PERS — numero que figura en la constancia.';
COMMENT ON COLUMN "acceso"."DecisionDeVerificacion"."evidenciaTomoYFolio" IS 'PERS — anulable aun en aprobadas: no todo colegio lo usa.';
COMMENT ON COLUMN "acceso"."DecisionDeVerificacion"."evidenciaClaseDeConstancia" IS 'INT — que clase de comprobacion se vio (salvaguarda M-1).';
COMMENT ON COLUMN "acceso"."DecisionDeVerificacion"."evidenciaFechaDeLaConstancia" IS 'INT — fecha de la constancia.';
COMMENT ON COLUMN "acceso"."DecisionDeVerificacion"."evidenciaReferenciaDelDocumento" IS 'INT — identificador en el almacen de objetos; el documento no vive en la base.';
COMMENT ON COLUMN "acceso"."DecisionDeVerificacion"."evidenciaHuellaDocumento" IS 'INT — SHA-256. Sin esto, "vi la constancia" es una afirmacion sin prueba.';
COMMENT ON COLUMN "acceso"."DecisionDeVerificacion"."motivoRechazo" IS 'INT — catalogo cerrado; un rechazo sin motivo tipificado no es revisable ni reclamable por el profesional.';
COMMENT ON COLUMN "acceso"."DecisionDeVerificacion"."claveIdempotencia" IS 'INT — constitucion #12: una doble aprobacion por doble clic no crea dos decisiones.';
COMMENT ON COLUMN "acceso"."DecisionDeVerificacion"."creadoEn" IS 'INT — alta de la fila.';

CREATE UNIQUE INDEX "uq_decision_idempotencia" ON "acceso"."DecisionDeVerificacion" ("claveIdempotencia");

-- Q-11 (CA-05, CA-22, habeas data): historia completa de un perfil. Sirve
-- además el `DISTINCT ON (perfilUsuarioId) … ORDER BY momento DESC` de Q-09.
CREATE INDEX "idx_decision_perfil" ON "acceso"."DecisionDeVerificacion" ("perfilUsuarioId", "momento" DESC);

-- Q-09 (CA-29): matrículas cuya vigencia vence en N días o ya venció. PARCIAL.
CREATE INDEX "idx_decision_vigencia"
  ON "acceso"."DecisionDeVerificacion" ("vigenciaHasta")
  WHERE "resultado" = 'APROBADA';

CREATE INDEX "idx_decision_decisor" ON "acceso"."DecisionDeVerificacion" ("decididaPor");

-- **R-002-09 — CA-05, salvaguarda M-6.** Un "verificado" SIN FECHA DE
-- VENCIMIENTO no es representable. Es la traducción literal del criterio: un
-- estado VERIFICADO sin vencimiento es verdadero el día que se otorga y puede
-- ser falso al mes siguiente.
ALTER TABLE "acceso"."DecisionDeVerificacion" ADD CONSTRAINT "ck_decision_vigencia_si_aprobada"
  CHECK (("resultado" = 'APROBADA') = ("vigenciaHasta" IS NOT NULL));

-- **R-002-08 — salvaguarda M-1.** Aprobar sin registrar la evidencia no es
-- representable. Neutraliza además el conflicto de interés que el dictamen §4.4
-- marca: si hay que cargar la constancia, aprobar sin mirar deja rastro.
ALTER TABLE "acceso"."DecisionDeVerificacion" ADD CONSTRAINT "ck_decision_evidencia_obligatoria"
  CHECK (
    "resultado" <> 'APROBADA' OR (
      "evidenciaColegio" IS NOT NULL AND
      "evidenciaJurisdiccion" IS NOT NULL AND
      "evidenciaNumeroDeMatricula" IS NOT NULL AND
      "evidenciaClaseDeConstancia" IS NOT NULL AND
      "evidenciaFechaDeLaConstancia" IS NOT NULL AND
      "evidenciaReferenciaDelDocumento" IS NOT NULL AND
      "evidenciaHuellaDocumento" IS NOT NULL
    )
  );

-- Invariante 3 de C.1.
ALTER TABLE "acceso"."DecisionDeVerificacion" ADD CONSTRAINT "ck_decision_motivo_si_rechazada"
  CHECK ("resultado" <> 'RECHAZADA' OR "motivoRechazo" IS NOT NULL);

-- Una constancia fechada después de la decisión que la invoca no es evidencia
-- de nada.
ALTER TABLE "acceso"."DecisionDeVerificacion" ADD CONSTRAINT "ck_decision_constancia_no_futura"
  CHECK ("evidenciaFechaDeLaConstancia" IS NULL OR "evidenciaFechaDeLaConstancia" <= ("momento" AT TIME ZONE 'UTC')::DATE);

ALTER TABLE "acceso"."DecisionDeVerificacion" ADD CONSTRAINT "DecisionDeVerificacion_perfilUsuarioId_fkey"
  FOREIGN KEY ("perfilUsuarioId") REFERENCES "acceso"."PerfilProfesional"("usuarioId")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "acceso"."DecisionDeVerificacion" ADD CONSTRAINT "DecisionDeVerificacion_decididaPor_fkey"
  FOREIGN KEY ("decididaPor") REFERENCES "acceso"."Usuario"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

-- La clave foránea que la migración 0012 dejó pendiente: A.3 apunta a la última
-- decisión, que recién ahora existe como tabla.
ALTER TABLE "acceso"."PerfilProfesional" ADD CONSTRAINT "fk_perfil_ultima_decision"
  FOREIGN KEY ("ultimaDecisionId") REFERENCES "acceso"."DecisionDeVerificacion"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ═════════════════════════════════════════════════════════════════════════════
-- C.2 — `acceso.SuspensionDeMatricula`
--
-- El "efecto inmediato" de CA-30 no lo garantiza una tarea ni un cierre masivo
-- de sesiones: lo garantiza la AUSENCIA DE CACHÉ. El token de acceso no lleva
-- permisos, así que `derivarPermisos` corre en cada petición y lee las
-- suspensiones abiertas. El instante en que se inserta esta fila es el instante
-- en que el abogado pierde `caso.leer.asignado`, `caso.actuar.asignado` y
-- `caso.recibirAsignacion`.
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE "acceso"."SuspensionDeMatricula" (
    "id" TEXT NOT NULL,
    "perfilUsuarioId" TEXT NOT NULL,
    "desde" TIMESTAMPTZ(6) NOT NULL,
    "dispuestaPor" TEXT NOT NULL,
    "motivo" "acceso"."MotivoDeSuspensionDeMatricula" NOT NULL,
    "referenciaDocumento" TEXT,
    "levantadaEn" TIMESTAMPTZ(6),
    "levantadaPor" TEXT,
    "motivoLevantamiento" "acceso"."MotivoLevantamientoSuspension",
    "claveIdempotencia" TEXT NOT NULL,
    "creadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuspensionDeMatricula_pkey" PRIMARY KEY ("id")
);

COMMENT ON TABLE "acceso"."SuspensionDeMatricula" IS
  'C.2 — suspension de matricula (CA-30). Solo insercion salvo las tres columnas de levantamiento. Retencion: verificacionProfesional = A_DETERMINAR (E-002-3). Sin purga automatica.';

COMMENT ON COLUMN "acceso"."SuspensionDeMatricula"."id" IS 'INT — identificador opaco.';
COMMENT ON COLUMN "acceso"."SuspensionDeMatricula"."perfilUsuarioId" IS 'PERS — perfil suspendido.';
COMMENT ON COLUMN "acceso"."SuspensionDeMatricula"."desde" IS 'INT — inicio de la suspension. Efecto inmediato: no hay cache de permisos.';
COMMENT ON COLUMN "acceso"."SuspensionDeMatricula"."dispuestaPor" IS 'PERS — quien la dispuso.';
COMMENT ON COLUMN "acceso"."SuspensionDeMatricula"."motivo" IS 'INT — catalogo cerrado del contrato §5.';
COMMENT ON COLUMN "acceso"."SuspensionDeMatricula"."referenciaDocumento" IS 'INT — referencia al documento que la respalda, si lo hay.';
COMMENT ON COLUMN "acceso"."SuspensionDeMatricula"."levantadaEn" IS 'INT — cierre de la suspension.';
COMMENT ON COLUMN "acceso"."SuspensionDeMatricula"."levantadaPor" IS 'PERS — quien la levanto.';
COMMENT ON COLUMN "acceso"."SuspensionDeMatricula"."motivoLevantamiento" IS 'INT — catalogo cerrado.';
COMMENT ON COLUMN "acceso"."SuspensionDeMatricula"."claveIdempotencia" IS 'INT — constitucion #12.';
COMMENT ON COLUMN "acceso"."SuspensionDeMatricula"."creadoEn" IS 'INT — alta de la fila.';

CREATE UNIQUE INDEX "uq_suspension_idempotencia" ON "acceso"."SuspensionDeMatricula" ("claveIdempotencia");

-- Q-00. A lo sumo UNA suspensión abierta por perfil: evita el empate entre dos
-- filas abiertas con criterios distintos. UNIQUE PARCIAL; Prisma lo declara
-- total y no único, y acá se reemplaza conservando el nombre.
DROP INDEX IF EXISTS "acceso"."uq_suspension_abierta";
CREATE UNIQUE INDEX "uq_suspension_abierta"
  ON "acceso"."SuspensionDeMatricula" ("perfilUsuarioId")
  WHERE "levantadaEn" IS NULL;

-- Q-11: historia de suspensiones de un perfil.
CREATE INDEX "idx_suspension_perfil" ON "acceso"."SuspensionDeMatricula" ("perfilUsuarioId", "desde" DESC);
CREATE INDEX "idx_suspension_disponente" ON "acceso"."SuspensionDeMatricula" ("dispuestaPor");
CREATE INDEX "idx_suspension_levantante" ON "acceso"."SuspensionDeMatricula" ("levantadaPor");

-- El levantamiento es atómico: o están las tres columnas o no está ninguna. Una
-- suspensión "levantada" sin quién ni por qué es exactamente el registro que no
-- sirve cuando el profesional reclama.
ALTER TABLE "acceso"."SuspensionDeMatricula" ADD CONSTRAINT "ck_suspension_levantamiento_completo"
  CHECK (
    ("levantadaEn" IS NULL AND "levantadaPor" IS NULL AND "motivoLevantamiento" IS NULL)
    OR ("levantadaEn" IS NOT NULL AND "levantadaPor" IS NOT NULL AND "motivoLevantamiento" IS NOT NULL)
  );

ALTER TABLE "acceso"."SuspensionDeMatricula" ADD CONSTRAINT "ck_suspension_levantamiento_posterior"
  CHECK ("levantadaEn" IS NULL OR "levantadaEn" >= "desde");

ALTER TABLE "acceso"."SuspensionDeMatricula" ADD CONSTRAINT "SuspensionDeMatricula_perfilUsuarioId_fkey"
  FOREIGN KEY ("perfilUsuarioId") REFERENCES "acceso"."PerfilProfesional"("usuarioId")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "acceso"."SuspensionDeMatricula" ADD CONSTRAINT "SuspensionDeMatricula_dispuestaPor_fkey"
  FOREIGN KEY ("dispuestaPor") REFERENCES "acceso"."Usuario"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "acceso"."SuspensionDeMatricula" ADD CONSTRAINT "SuspensionDeMatricula_levantadaPor_fkey"
  FOREIGN KEY ("levantadaPor") REFERENCES "acceso"."Usuario"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ═════════════════════════════════════════════════════════════════════════════
-- C.3 — `acceso.HitoDeVigenciaNotificado`
--
-- Existe por una sola razón, y es la constitución #12: sin esta tabla el
-- proceso diario que busca matrículas por vencer le manda el mismo correo al
-- mismo abogado todos los días hasta que renueve. **La PK es la clave de
-- idempotencia.**
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE "acceso"."HitoDeVigenciaNotificado" (
    "perfilUsuarioId" TEXT NOT NULL,
    "decisionId" TEXT NOT NULL,
    "hito" "acceso"."HitoDeVigencia" NOT NULL,
    "notificadoEn" TIMESTAMPTZ(6) NOT NULL,
    "envioId" TEXT NOT NULL,
    "creadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HitoDeVigenciaNotificado_pkey" PRIMARY KEY ("decisionId","hito")
);

COMMENT ON TABLE "acceso"."HitoDeVigenciaNotificado" IS
  'C.3 — aviso de vigencia ya enviado (CA-29). Solo insercion. La PK (decisionId, hito) ES la clave de idempotencia. Retencion: la de la decision que referencia (A_DETERMINAR, E-002-3).';

COMMENT ON COLUMN "acceso"."HitoDeVigenciaNotificado"."perfilUsuarioId" IS 'PERS — perfil avisado.';
COMMENT ON COLUMN "acceso"."HitoDeVigenciaNotificado"."decisionId" IS 'INT — decision cuya vigencia se esta por vencer.';
COMMENT ON COLUMN "acceso"."HitoDeVigenciaNotificado"."hito" IS 'INT — POR_VENCER_30D, POR_VENCER_7D o VENCIDA.';
COMMENT ON COLUMN "acceso"."HitoDeVigenciaNotificado"."notificadoEn" IS 'INT — cuando se aviso.';
COMMENT ON COLUMN "acceso"."HitoDeVigenciaNotificado"."envioId" IS 'INT — referencia al envio transaccional; la clave foranea la agrega la 0015.';
COMMENT ON COLUMN "acceso"."HitoDeVigenciaNotificado"."creadoEn" IS 'INT — alta de la fila.';

CREATE INDEX "idx_hito_perfil" ON "acceso"."HitoDeVigenciaNotificado" ("perfilUsuarioId");
CREATE INDEX "idx_hito_envio" ON "acceso"."HitoDeVigenciaNotificado" ("envioId");

ALTER TABLE "acceso"."HitoDeVigenciaNotificado" ADD CONSTRAINT "HitoDeVigenciaNotificado_perfilUsuarioId_fkey"
  FOREIGN KEY ("perfilUsuarioId") REFERENCES "acceso"."PerfilProfesional"("usuarioId")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "acceso"."HitoDeVigenciaNotificado" ADD CONSTRAINT "HitoDeVigenciaNotificado_decisionId_fkey"
  FOREIGN KEY ("decisionId") REFERENCES "acceso"."DecisionDeVerificacion"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
-- `HitoDeVigenciaNotificado_envioId_fkey` la agrega la 0015: D.9 todavía no existe.

-- ═════════════════════════════════════════════════════════════════════════════
-- C.4 — `acceso.EscalamientoDeVerificacion` (CA-31)
--
-- Dependencia declarada con la feature 004: CA-31 habla de DÍAS HÁBILES, y el
-- calendario es `motor.DiaNoHabil`. Este modelo NO lo duplica; el `GRANT SELECT`
-- lo otorga la migración 0011 en cuanto esa tabla exista.
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE "acceso"."EscalamientoDeVerificacion" (
    "id" TEXT NOT NULL,
    "perfilUsuarioId" TEXT NOT NULL,
    "generadoEn" TIMESTAMPTZ(6) NOT NULL,
    "diasHabilesTranscurridos" INTEGER NOT NULL,
    "resueltoEn" TIMESTAMPTZ(6),
    "resueltoPor" TEXT,
    "claveIdempotencia" TEXT NOT NULL,
    "creadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EscalamientoDeVerificacion_pkey" PRIMARY KEY ("id")
);

COMMENT ON TABLE "acceso"."EscalamientoDeVerificacion" IS
  'C.4 — escalamiento por plazo de revision vencido (CA-31). La claveIdempotencia es perfilUsuarioId + la fecha de vencimiento del plazo: no se escala dos veces lo mismo. Retencion: verificacionProfesional = A_DETERMINAR (E-002-3).';

COMMENT ON COLUMN "acceso"."EscalamientoDeVerificacion"."id" IS 'INT — identificador opaco.';
COMMENT ON COLUMN "acceso"."EscalamientoDeVerificacion"."perfilUsuarioId" IS 'PERS — perfil cuya revision se demoro.';
COMMENT ON COLUMN "acceso"."EscalamientoDeVerificacion"."generadoEn" IS 'INT — cuando se escalo.';
COMMENT ON COLUMN "acceso"."EscalamientoDeVerificacion"."diasHabilesTranscurridos" IS 'INT — dias habiles al momento de escalar, contados contra motor.DiaNoHabil.';
COMMENT ON COLUMN "acceso"."EscalamientoDeVerificacion"."resueltoEn" IS 'INT — cierre del escalamiento.';
COMMENT ON COLUMN "acceso"."EscalamientoDeVerificacion"."resueltoPor" IS 'PERS — quien lo resolvio.';
COMMENT ON COLUMN "acceso"."EscalamientoDeVerificacion"."claveIdempotencia" IS 'INT — constitucion #12.';
COMMENT ON COLUMN "acceso"."EscalamientoDeVerificacion"."creadoEn" IS 'INT — alta de la fila.';

CREATE UNIQUE INDEX "uq_escalamiento_idempotencia" ON "acceso"."EscalamientoDeVerificacion" ("claveIdempotencia");

-- Cola de escalamientos abiertos. PARCIAL.
CREATE INDEX "idx_escalamiento_abierto"
  ON "acceso"."EscalamientoDeVerificacion" ("generadoEn")
  WHERE "resueltoEn" IS NULL;

CREATE INDEX "idx_escalamiento_perfil" ON "acceso"."EscalamientoDeVerificacion" ("perfilUsuarioId");
CREATE INDEX "idx_escalamiento_resolutor" ON "acceso"."EscalamientoDeVerificacion" ("resueltoPor");

ALTER TABLE "acceso"."EscalamientoDeVerificacion" ADD CONSTRAINT "ck_escalamiento_dias_no_negativos"
  CHECK ("diasHabilesTranscurridos" >= 0);

ALTER TABLE "acceso"."EscalamientoDeVerificacion" ADD CONSTRAINT "ck_escalamiento_cierre_completo"
  CHECK (("resueltoEn" IS NULL) = ("resueltoPor" IS NULL));

ALTER TABLE "acceso"."EscalamientoDeVerificacion" ADD CONSTRAINT "EscalamientoDeVerificacion_perfilUsuarioId_fkey"
  FOREIGN KEY ("perfilUsuarioId") REFERENCES "acceso"."PerfilProfesional"("usuarioId")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "acceso"."EscalamientoDeVerificacion" ADD CONSTRAINT "EscalamientoDeVerificacion_resueltoPor_fkey"
  FOREIGN KEY ("resueltoPor") REFERENCES "acceso"."Usuario"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
