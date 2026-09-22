-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 0019 — retencion_y_parametros
-- Feature 002, tarea T-03. Fila `0019` de modelo-datos.md §6.2.
-- Bloque H: H.1 `ReglaDeRetencion`, H.2 `EjecucionDePurga`,
-- H.3 `ParametroDeAcceso`.
--
-- Constitución #11: ningún plazo ni umbral es una constante en el código.
-- Condición C-002-03 y escalamiento E-002-3.
--
-- Reversión: reversion.sql de este mismo directorio.
-- ─────────────────────────────────────────────────────────────────────────────

-- ═════════════════════════════════════════════════════════════════════════════
-- H.1 — `acceso.ReglaDeRetencion`
--
-- Es la tabla que el estudio jurídico completa cuando firme. Hasta entonces las
-- claves sin plazo determinado viven con `accion = 'A_DETERMINAR'` y
-- `plazoSegundos IS NULL`: "no sé cuánto" es un estado de primera clase, no una
-- fila ausente ni un cero. Mismo criterio que `DisponibilidadParametro` en la
-- 004.
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE "acceso"."ReglaDeRetencion" (
    "clave" "acceso"."ClaveDeRetencion" NOT NULL,
    "plazoSegundos" BIGINT,
    "accion" "acceso"."AccionDeRetencion" NOT NULL,
    "fundamento" TEXT NOT NULL,
    "requiereValidacionProfesional" BOOLEAN NOT NULL DEFAULT true,
    "validadoPor" TEXT,
    "validadoEn" DATE,
    "vigenteDesde" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReglaDeRetencion_pkey" PRIMARY KEY ("clave")
);

COMMENT ON TABLE "acceso"."ReglaDeRetencion" IS
  'H.1 — plazo y accion de retencion por clave (C-002-03, constitucion #11). Es la tabla que el estudio juridico completa cuando firme. Retencion de la propia tabla: INDEFINIDA; es catalogo, no dato personal.';

COMMENT ON COLUMN "acceso"."ReglaDeRetencion"."clave" IS 'PUB — clave de retencion del contrato, ampliada por el modelo de datos §5.1.';
COMMENT ON COLUMN "acceso"."ReglaDeRetencion"."plazoSegundos" IS 'PUB — plazo. NULL si y solo si la accion es A_DETERMINAR.';
COMMENT ON COLUMN "acceso"."ReglaDeRetencion"."accion" IS 'PUB — PURGA_FISICA / ANONIMIZACION / A_DETERMINAR.';
COMMENT ON COLUMN "acceso"."ReglaDeRetencion"."fundamento" IS 'PUB — la norma o el criterio que fija el plazo.';
COMMENT ON COLUMN "acceso"."ReglaDeRetencion"."requiereValidacionProfesional" IS 'PUB — si necesita firma del estudio (constitucion #11).';
COMMENT ON COLUMN "acceso"."ReglaDeRetencion"."validadoPor" IS 'PUB — quien la valido. Vacia hasta que el estudio firme.';
COMMENT ON COLUMN "acceso"."ReglaDeRetencion"."validadoEn" IS 'PUB — fecha de validacion.';
COMMENT ON COLUMN "acceso"."ReglaDeRetencion"."vigenteDesde" IS 'PUB — inicio de vigencia de esta regla.';

-- Invariante 1: "no sé cuánto" no se disfraza de cero ni de fila ausente.
ALTER TABLE "acceso"."ReglaDeRetencion" ADD CONSTRAINT "ck_retencion_plazo_si_determinada"
  CHECK (("accion" = 'A_DETERMINAR') = ("plazoSegundos" IS NULL));

ALTER TABLE "acceso"."ReglaDeRetencion" ADD CONSTRAINT "ck_retencion_plazo_positivo"
  CHECK ("plazoSegundos" IS NULL OR "plazoSegundos" > 0);

-- Invariante 3: una validación sin fecha no es verificable.
ALTER TABLE "acceso"."ReglaDeRetencion" ADD CONSTRAINT "ck_retencion_validacion_fechada"
  CHECK ("validadoPor" IS NULL OR "validadoEn" IS NOT NULL);

ALTER TABLE "acceso"."ReglaDeRetencion" ADD CONSTRAINT "ck_retencion_fundamento_no_vacio"
  CHECK (length(btrim("fundamento")) > 0);

-- Invariante 2: destino de la clave foránea COMPUESTA de H.2. No aporta
-- unicidad por sí misma (`clave` ya es PK): es el mecanismo de R-002-15.
CREATE UNIQUE INDEX "uq_retencion_clave_accion" ON "acceso"."ReglaDeRetencion" ("clave", "accion");

-- ═════════════════════════════════════════════════════════════════════════════
-- H.2 — `acceso.EjecucionDePurga`
--
-- **R-002-15 — no se purga bajo una regla que nadie determinó.** El efecto
-- concreto: mientras `bitacoraAuditoria` esté en `A_DETERMINAR`, la rutina de
-- purga de la bitácora no puede registrar su ejecución, y por lo tanto NO SE
-- EJECUTA. Es el patrón de R-2 de la 004 aplicado al problema inverso: allá
-- impedía USAR algo sin ratificar, acá impide DESTRUIR algo bajo un plazo sin
-- ratificar. Destruir por error es irreversible; es la dirección correcta para
-- el bloqueo.
--
-- Y es lo que hace VERIFICABLE el "mecanismo de purga" que CA-28 exige: cada
-- corrida deja fila, con cuántos registros alcanzó y con su evento de auditoría.
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE "acceso"."EjecucionDePurga" (
    "id" TEXT NOT NULL,
    "clave" "acceso"."ClaveDeRetencion" NOT NULL,
    "accionDeLaRegla" "acceso"."AccionDeRetencion" NOT NULL,
    "ejecutadaEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "registrosAlcanzados" INTEGER NOT NULL,
    "eventoId" TEXT NOT NULL,
    "claveIdempotencia" TEXT NOT NULL,

    CONSTRAINT "EjecucionDePurga_pkey" PRIMARY KEY ("id")
);

COMMENT ON TABLE "acceso"."EjecucionDePurga" IS
  'H.2 — constancia de una corrida de purga (CA-28, R-002-15). SOLO INSERCION. Retencion: INDEFINIDA; es la prueba de que se destruyo, cuanto y bajo que regla. Borrarla dejaria la destruccion sin constancia, que es lo contrario de lo que pide el art. 4 inc. 7.';

COMMENT ON COLUMN "acceso"."EjecucionDePurga"."id" IS 'INT — identificador opaco.';
COMMENT ON COLUMN "acceso"."EjecucionDePurga"."clave" IS 'INT — clave de retencion bajo la que se purgo.';
COMMENT ON COLUMN "acceso"."EjecucionDePurga"."accionDeLaRegla" IS 'INT — replica sostenida por la clave foranea compuesta. No es desnormalizacion: es el mecanismo de R-002-15.';
COMMENT ON COLUMN "acceso"."EjecucionDePurga"."ejecutadaEn" IS 'INT — cuando corrio.';
COMMENT ON COLUMN "acceso"."EjecucionDePurga"."registrosAlcanzados" IS 'INT — cuantos registros alcanzo.';
COMMENT ON COLUMN "acceso"."EjecucionDePurga"."eventoId" IS 'INT — referencia POR VALOR al auditoria.EventoAuditoria de la corrida: la bitacora esta particionada y su PK es compuesta.';
COMMENT ON COLUMN "acceso"."EjecucionDePurga"."claveIdempotencia" IS 'INT — constitucion #12: una corrida no se registra dos veces.';

CREATE UNIQUE INDEX "uq_purga_idempotencia" ON "acceso"."EjecucionDePurga" ("claveIdempotencia");
CREATE INDEX "idx_purga_clave" ON "acceso"."EjecucionDePurga" ("clave", "ejecutadaEn" DESC);

-- **R-002-15**, primera mitad.
ALTER TABLE "acceso"."EjecucionDePurga" ADD CONSTRAINT "ck_purga_accion_determinada"
  CHECK ("accionDeLaRegla" <> 'A_DETERMINAR');

ALTER TABLE "acceso"."EjecucionDePurga" ADD CONSTRAINT "ck_purga_registros_no_negativos"
  CHECK ("registrosAlcanzados" >= 0);

-- **R-002-15**, segunda mitad: la clave foránea compuesta con `ON UPDATE
-- RESTRICT`. Registrar una purga exige que la regla exista CON ESA ACCIÓN, y el
-- `CHECK` de arriba excluye `A_DETERMINAR`. Las dos piezas juntas: no hay forma
-- de dejar constancia de una purga bajo un plazo que nadie fijó, y como el
-- proceso hace las dos cosas en la misma transacción, la purga se revierte.
ALTER TABLE "acceso"."EjecucionDePurga" ADD CONSTRAINT "fk_purga_regla"
  FOREIGN KEY ("clave", "accionDeLaRegla") REFERENCES "acceso"."ReglaDeRetencion"("clave", "accion")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ═════════════════════════════════════════════════════════════════════════════
-- H.3 — `acceso.ParametroDeAcceso`
--
-- Los umbrales de CA-37, las vidas de token, `matricula.vigenciaVerificacion`
-- (12 meses) y `matricula.plazoMaximoRevision`. Constitución #11.
--
-- Por qué una tabla propia y no `motor.ParametroNormativo`: la 004 metió sus
-- umbrales de producto en el catálogo normativo con un argumento explícito —"un
-- umbral cambiado tiene que quedar en la trazabilidad del hallazgo"—. Acá ese
-- argumento no aplica, no hay hallazgo, y acoplar el inicio de sesión al
-- catálogo normativo significaría que un problema en el catálogo legal impide
-- entrar al sistema.
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE "acceso"."ParametroDeAcceso" (
    "clave" TEXT NOT NULL,
    "valor" JSONB NOT NULL,
    "unidad" TEXT,
    "vigenciaDesde" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vigenciaHasta" TIMESTAMPTZ(6),
    "esNormativo" BOOLEAN NOT NULL DEFAULT false,
    "requiereValidacionProfesional" BOOLEAN NOT NULL DEFAULT false,
    "notaDeAlcance" TEXT,
    "validadoPor" TEXT,
    "validadoEn" DATE,
    "creadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParametroDeAcceso_pkey" PRIMARY KEY ("clave")
);

COMMENT ON TABLE "acceso"."ParametroDeAcceso" IS
  'H.3 — umbrales y plazos de producto de la feature 002 (CA-37, vidas de token, vigencia de matricula). Constitucion #11: ninguno es una constante en el codigo. Retencion: INDEFINIDA; es catalogo, no dato personal.';

COMMENT ON COLUMN "acceso"."ParametroDeAcceso"."clave" IS 'PUB — clave del parametro.';
COMMENT ON COLUMN "acceso"."ParametroDeAcceso"."valor" IS 'PUB — valor escalar en JSON.';
COMMENT ON COLUMN "acceso"."ParametroDeAcceso"."unidad" IS 'PUB — unidad del valor (segundos, intentos, meses, dias habiles).';
COMMENT ON COLUMN "acceso"."ParametroDeAcceso"."vigenciaDesde" IS 'PUB — inicio de vigencia.';
COMMENT ON COLUMN "acceso"."ParametroDeAcceso"."vigenciaHasta" IS 'PUB — fin de vigencia.';
COMMENT ON COLUMN "acceso"."ParametroDeAcceso"."esNormativo" IS 'PUB — false en todas las filas de la 002: son umbrales de producto, no normas.';
COMMENT ON COLUMN "acceso"."ParametroDeAcceso"."requiereValidacionProfesional" IS 'PUB — si el estudio dictamina sobre matricula.vigenciaVerificacion, esa fila pasa a true sin cambiar de tabla.';
COMMENT ON COLUMN "acceso"."ParametroDeAcceso"."notaDeAlcance" IS 'PUB — que alcance tiene y de donde sale.';
COMMENT ON COLUMN "acceso"."ParametroDeAcceso"."validadoPor" IS 'PUB — quien lo valido.';
COMMENT ON COLUMN "acceso"."ParametroDeAcceso"."validadoEn" IS 'PUB — fecha de validacion.';
COMMENT ON COLUMN "acceso"."ParametroDeAcceso"."creadoEn" IS 'INT — alta de la fila.';

ALTER TABLE "acceso"."ParametroDeAcceso" ADD CONSTRAINT "ck_parametro_vigencia_ordenada"
  CHECK ("vigenciaHasta" IS NULL OR "vigenciaHasta" > "vigenciaDesde");
ALTER TABLE "acceso"."ParametroDeAcceso" ADD CONSTRAINT "ck_parametro_validacion_fechada"
  CHECK ("validadoPor" IS NULL OR "validadoEn" IS NOT NULL);
-- Un parámetro que dice requerir validación profesional y no la tiene es
-- legítimo (está esperando la firma); lo que no puede es decir que NO la
-- requiere y estar validado igual, porque entonces la marca no significa nada.
ALTER TABLE "acceso"."ParametroDeAcceso" ADD CONSTRAINT "ck_parametro_validado_solo_si_lo_requiere"
  CHECK ("validadoPor" IS NULL OR "requiereValidacionProfesional");
-- El valor es escalar: un objeto o un arreglo acá sería configuración
-- estructurada disfrazada de parámetro, y nadie sabría validarla.
ALTER TABLE "acceso"."ParametroDeAcceso" ADD CONSTRAINT "ck_parametro_valor_escalar"
  CHECK (jsonb_typeof("valor") IN ('number', 'string', 'boolean'));
