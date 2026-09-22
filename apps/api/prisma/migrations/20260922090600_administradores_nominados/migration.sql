-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 0017 — administradores_nominados
-- Feature 002, tarea T-03. Fila `0017` de modelo-datos.md §6.2.
-- Bloque F: F.1 `DesignacionDeAdministrador`, más D.8 `CorreoDeRolProhibido`,
-- que es parte del mismo mecanismo.
--
-- Condición C-002-09, recaudos C-1 a C-3, criterios CA-33 y CA-34.
--
-- Cinco mecanismos, ninguno suficiente por sí solo, que juntos hacen imposible
-- una cuenta `ADMINISTRADOR` sin persona identificada. Tres de los cinco están
-- en este archivo; los otros dos son disparadores diferidos y viven en la 0021,
-- porque necesitan `auditoria.EventoAuditoria`, que crea la 0018:
--
--   1. Clave foránea COMPUESTA `(usuarioId, esAdministrador) →
--      Usuario(id, esAdministrador)` con `ON UPDATE RESTRICT`, más
--      `CHECK (esAdministrador)`.                                    ← acá
--   2. Participación total en el otro sentido: disparador diferido
--      sobre `Usuario`.                                              ← 0021
--   3. Auditoría en la misma transacción (CA-34).                    ← 0021
--   4. Buzones genéricos (R-002-04), contra D.8 por índice ciego.    ← 0021 (usa D.8 de acá)
--   5. Una sola siembra, para siempre: índice único parcial.         ← acá
--
-- Reversión: reversion.sql de este mismo directorio.
-- ─────────────────────────────────────────────────────────────────────────────

-- ═════════════════════════════════════════════════════════════════════════════
-- D.8 — `acceso.CorreoDeRolProhibido` (R-002-04)
--
-- Es lo que permite que el rechazo de buzones genéricos sea una restricción de
-- la base y no sólo una validación, A PESAR DE QUE EL CORREO ESTÁ CIFRADO: como
-- el índice ciego es determinista, se precalculan los buzones de rol conocidos
-- de nuestros dominios y quedan prohibidos aunque la base no pueda leer el
-- correo. Su límite —sólo cubre la lista enumerada— está declarado en §7.3 y se
-- cubre con validación de dominio en `packages/shared`.
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE "acceso"."CorreoDeRolProhibido" (
    "indiceCiego" BYTEA NOT NULL,
    "etiqueta" TEXT NOT NULL,
    "agregadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CorreoDeRolProhibido_pkey" PRIMARY KEY ("indiceCiego")
);

COMMENT ON TABLE "acceso"."CorreoDeRolProhibido" IS
  'D.8 — buzones de rol prohibidos como cuenta administradora (R-002-04, CA-33). Catalogo, no dato personal: son direcciones genericas de nuestros propios dominios, precalculadas como indice ciego. Retencion: INDEFINIDA.';

COMMENT ON COLUMN "acceso"."CorreoDeRolProhibido"."indiceCiego" IS 'INT — HMAC-SHA-256 del buzon generico, con la misma clave k_indice que Usuario.indiceCiegoCorreo. Es lo que permite comparar sin leer.';
COMMENT ON COLUMN "acceso"."CorreoDeRolProhibido"."etiqueta" IS 'INT — nombre legible del buzon (admin@, soporte@, info@, ...). No es la direccion completa.';
COMMENT ON COLUMN "acceso"."CorreoDeRolProhibido"."agregadoEn" IS 'INT — alta en el catalogo.';

-- ═════════════════════════════════════════════════════════════════════════════
-- F.1 — `acceso.DesignacionDeAdministrador`
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE "acceso"."DesignacionDeAdministrador" (
    "usuarioId" TEXT NOT NULL,
    "esAdministrador" BOOLEAN NOT NULL,
    "nombreCompletoCifrado" BYTEA NOT NULL,
    "nombreCompletoNonce" BYTEA NOT NULL,
    "nombreCompletoTag" BYTEA NOT NULL,
    "nombreCompletoIdClave" TEXT NOT NULL,
    "documentoDeDesignacionReferencia" TEXT NOT NULL,
    "huellaDocumentoDesignacion" TEXT NOT NULL,
    "creadoPor" TEXT,
    "esSiembra" BOOLEAN NOT NULL DEFAULT false,
    "creadaEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nominalizadaEn" TIMESTAMPTZ(6),
    "deshabilitadaEn" TIMESTAMPTZ(6),
    "claveIdempotencia" TEXT NOT NULL,

    CONSTRAINT "DesignacionDeAdministrador_pkey" PRIMARY KEY ("usuarioId")
);

COMMENT ON TABLE "acceso"."DesignacionDeAdministrador" IS
  'F.1 — designacion de administrador (CA-33, CA-34, recaudos C-1 a C-3). Unico lugar de la feature donde se guarda el nombre legal de una persona. Base legal: ejecucion del contrato laboral o de servicios y responsabilidad identificable frente a un habeas data. Retencion: vida de la designacion + la del vinculo; sin purga automatica.';

COMMENT ON COLUMN "acceso"."DesignacionDeAdministrador"."usuarioId" IS 'PERS — la cuenta designada.';
COMMENT ON COLUMN "acceso"."DesignacionDeAdministrador"."esAdministrador" IS 'INT — replica; destino de la clave foranea compuesta contra la columna GENERADA de A.1. CHECK (esAdministrador).';
COMMENT ON COLUMN "acceso"."DesignacionDeAdministrador"."nombreCompletoCifrado" IS 'PERS↑ — AES-256-GCM k_acceso. El nombre REAL de la persona, no el nombre para mostrar. Va cifrado porque la lista de administradores de la plataforma es un objetivo de ingenieria social.';
COMMENT ON COLUMN "acceso"."DesignacionDeAdministrador"."nombreCompletoNonce" IS 'INT — nonce del cifrado del nombre completo.';
COMMENT ON COLUMN "acceso"."DesignacionDeAdministrador"."nombreCompletoTag" IS 'INT — etiqueta GCM del nombre completo.';
COMMENT ON COLUMN "acceso"."DesignacionDeAdministrador"."nombreCompletoIdClave" IS 'INT — identificador de la clave usada.';
COMMENT ON COLUMN "acceso"."DesignacionDeAdministrador"."documentoDeDesignacionReferencia" IS 'INT — el acto por el cual esta persona es administradora.';
COMMENT ON COLUMN "acceso"."DesignacionDeAdministrador"."huellaDocumentoDesignacion" IS 'INT — SHA-256 del documento de designacion.';
COMMENT ON COLUMN "acceso"."DesignacionDeAdministrador"."creadoPor" IS 'PERS — quien la creo. NULL SOLO si esSiembra.';
COMMENT ON COLUMN "acceso"."DesignacionDeAdministrador"."esSiembra" IS 'INT — cuenta de arranque. A lo sumo UNA en toda la vida de la base.';
COMMENT ON COLUMN "acceso"."DesignacionDeAdministrador"."creadaEn" IS 'INT — alta de la designacion.';
COMMENT ON COLUMN "acceso"."DesignacionDeAdministrador"."nominalizadaEn" IS 'INT — recaudo C-2: la siembra deja de ser generica.';
COMMENT ON COLUMN "acceso"."DesignacionDeAdministrador"."deshabilitadaEn" IS 'INT — recaudo C-2: la siembra no queda viva "por las dudas".';
COMMENT ON COLUMN "acceso"."DesignacionDeAdministrador"."claveIdempotencia" IS 'INT — constitucion #12.';

CREATE UNIQUE INDEX "uq_designacion_idempotencia" ON "acceso"."DesignacionDeAdministrador" ("claveIdempotencia");
CREATE UNIQUE INDEX "uq_designacion_usuario_admin" ON "acceso"."DesignacionDeAdministrador" ("usuarioId", "esAdministrador");
CREATE INDEX "idx_designacion_creador" ON "acceso"."DesignacionDeAdministrador" ("creadoPor");

-- Mecanismo 5, primera mitad — **R-002-05, recaudo C-2.** A lo sumo UNA fila de
-- siembra puede existir en toda la vida de la base. El índice es sobre la
-- EXPRESIÓN constante `(esSiembra)` con predicado `WHERE esSiembra`: eso hace
-- que las filas de siembra colisionen entre sí y las demás ni entren al índice.
DROP INDEX IF EXISTS "acceso"."uq_designacion_siembra";
CREATE UNIQUE INDEX "uq_designacion_siembra"
  ON "acceso"."DesignacionDeAdministrador" (("esSiembra"))
  WHERE "esSiembra";

-- Mecanismo 1 — una designación sólo puede apuntar a un administrador.
ALTER TABLE "acceso"."DesignacionDeAdministrador" ADD CONSTRAINT "ck_designacion_es_administrador"
  CHECK ("esAdministrador");

-- La siembra es la única sin creador, y toda designación nominal tiene uno.
ALTER TABLE "acceso"."DesignacionDeAdministrador" ADD CONSTRAINT "ck_designacion_creador_si_no_siembra"
  CHECK (("creadoPor" IS NULL) = "esSiembra");

-- Nadie se designa administrador a sí mismo.
ALTER TABLE "acceso"."DesignacionDeAdministrador" ADD CONSTRAINT "ck_designacion_no_autodesignacion"
  CHECK ("creadoPor" IS NULL OR "creadoPor" <> "usuarioId");

-- Recaudo C-1: una designación sin documento y sin huella es una afirmación sin
-- respaldo, que es exactamente lo que el recaudo viene a impedir ("una bitácora
-- que dice que 'admin' accedió a un expediente no prueba nada").
ALTER TABLE "acceso"."DesignacionDeAdministrador" ADD CONSTRAINT "ck_designacion_documento_no_vacio"
  CHECK (
    length(btrim("documentoDeDesignacionReferencia")) > 0 AND
    length(btrim("huellaDocumentoDesignacion")) > 0
  );

-- Mecanismo 1, la clave foránea compuesta contra la columna GENERADA. Como
-- `Usuario.esAdministrador` se deriva de `rol`, un `UPDATE rol` la mueve y este
-- `ON UPDATE RESTRICT` lo rechaza: **un usuario con designación no puede dejar
-- de ser administrador sin borrar antes la designación.**
ALTER TABLE "acceso"."DesignacionDeAdministrador" ADD CONSTRAINT "fk_designacion_usuario_admin"
  FOREIGN KEY ("usuarioId", "esAdministrador") REFERENCES "acceso"."Usuario"("id", "esAdministrador")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "acceso"."DesignacionDeAdministrador" ADD CONSTRAINT "DesignacionDeAdministrador_creadoPor_fkey"
  FOREIGN KEY ("creadoPor") REFERENCES "acceso"."Usuario"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
