-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 0002 — catalogo_normativo (Bloque A de modelo-datos §1)
-- Feature 004, tarea T-03. Corresponde a la fila `0002` de
-- specs/004-motor-reglas-legales/modelo-datos.md §6.1.
--
-- Contiene A.1 a A.6: ParametroNormativo, TramoParametro (con vigencia
-- `daterange` y exclusión sin solapamiento), CitaNormativa + TramoParametroCita,
-- Ratificacion, MatriculaProfesional, CatalogoNormativo + CatalogoTramo.
--
-- La primera mitad del archivo la generó `prisma migrate diff` a partir de
-- `schema.prisma`. La segunda mitad —desde "SQL CRUDO"— es lo que el DSL de
-- Prisma no expresa y que modelo-datos §6.4 anticipa: restricciones `CHECK`,
-- la restricción de exclusión GiST, los índices parciales y la clasificación de
-- sensibilidad de cada columna. ADR-007 §2, condición 4.
--
-- Qué NO está acá, a propósito: los disparadores de inmutabilidad y la
-- verificación diferida "todo tramo CARGADO tiene al menos una cita". Van en la
-- migración 0009 (`disparadores_de_inmutabilidad`), tal como fija el orden
-- aprobado de modelo-datos §6.1.
--
-- Reversión: prisma/migrations/20260921120100_catalogo_normativo/reversion.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- `public` en el camino de búsqueda: ahí viven la clase de operadores
-- `gist_text_ops` y las de `btree_gist` que usa la restricción de exclusión.
SET LOCAL search_path TO "motor", "public";

-- CreateEnum
CREATE TYPE "motor"."AnalisisMotor" AS ENUM ('A_PRESCRIPCION', 'B_INTERESES', 'C_ARCHIVO', 'D_EMBARGABILIDAD', 'E_HONORARIOS', 'TRANSVERSAL');

-- CreateEnum
CREATE TYPE "motor"."TipoValorParametro" AS ENUM ('PLAZO_DIAS', 'PLAZO_ANIOS', 'PORCENTAJE', 'RACIONAL', 'MONTO', 'BOOLEANO', 'ENUM_CERRADO', 'LISTA_CERRADA', 'TRAMOS');

-- CreateEnum
CREATE TYPE "motor"."Jurisdiccion" AS ENUM ('NACIONAL', 'FEDERAL', 'BUENOS_AIRES', 'CABA', 'CORDOBA', 'SANTA_FE', 'TODAS');

-- CreateEnum
CREATE TYPE "motor"."DisponibilidadParametro" AS ENUM ('CARGADO', 'A_DETERMINAR_POR_EL_ESTUDIO', 'CONTRADICCION_ABIERTA');

-- CreateEnum
CREATE TYPE "motor"."Confiabilidad" AS ENUM ('V', 'C', 'P', 'D', 'CONTRADICCION', 'I');

-- CreateEnum
CREATE TYPE "motor"."EstadoRatificacion" AS ENUM ('SIN_RATIFICAR', 'RATIFICADO');

-- CreateEnum
CREATE TYPE "motor"."ClaveNotaDeAlcance" AS ENUM ('TEXTO_SUSTITUIDO_POR_DNU_70_2023', 'PENDIENTE_VERIFICACION_DOCUMENTAL', 'CORROBORADO_POR_BUSCADOR_SIN_FUENTE_OFICIAL', 'UMBRAL_DE_ALERTA_INTERNO_NO_TOPE_LEGAL', 'PARAMETRO_DE_PRODUCTO_NO_NORMATIVO', 'CRITERIO_JURISPRUDENCIAL_NO_LEGAL', 'PROHIBICION_O_TOPE_EN_DISPUTA', 'DERECHO_TRANSITORIO_EN_DISPUTA');

-- CreateEnum
CREATE TYPE "motor"."TipoNorma" AS ENUM ('LEY', 'DECRETO', 'DNU', 'CODIGO', 'COMUNICACION_BCRA', 'RESOLUCION', 'FALLO');

-- CreateEnum
CREATE TYPE "motor"."MotivoRevocacion" AS ENUM ('CAMBIO_NORMATIVO', 'ERROR_DETECTADO', 'VENCIMIENTO_DE_REVISION', 'BAJA_DEL_PROFESIONAL');

-- CreateEnum
CREATE TYPE "motor"."EstadoMatricula" AS ENUM ('VIGENTE', 'SUSPENDIDA', 'CANCELADA', 'NO_VERIFICADA');

-- CreateEnum
CREATE TYPE "motor"."EstadoCatalogo" AS ENUM ('BORRADOR', 'PUBLICADO', 'RETIRADO');

-- CreateTable
CREATE TABLE "motor"."ParametroNormativo" (
    "clave" TEXT NOT NULL,
    "analisis" "motor"."AnalisisMotor" NOT NULL,
    "descripcion" TEXT NOT NULL,
    "tipoValor" "motor"."TipoValorParametro" NOT NULL,
    "unidad" TEXT,
    "esNormativo" BOOLEAN NOT NULL,
    "admiteJurisdiccion" BOOLEAN NOT NULL,
    "bloqueanteDeAnalisis" BOOLEAN NOT NULL,
    "creadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParametroNormativo_pkey" PRIMARY KEY ("clave")
);

-- CreateTable
CREATE TABLE "motor"."TramoParametro" (
    "id" UUID NOT NULL,
    "claveParametro" TEXT NOT NULL,
    "jurisdiccion" "motor"."Jurisdiccion" NOT NULL,
    "valor" JSONB,
    "vigencia" daterange NOT NULL,
    "disponibilidad" "motor"."DisponibilidadParametro" NOT NULL,
    "confiabilidadFuente" "motor"."Confiabilidad" NOT NULL,
    "estadoRatificacion" "motor"."EstadoRatificacion" NOT NULL DEFAULT 'SIN_RATIFICAR',
    "ratificacionId" UUID,
    "notaDeAlcance" "motor"."ClaveNotaDeAlcance",
    "reemplazaTramoId" UUID,
    "retiradoEn" TIMESTAMPTZ(6),
    "cargadoPor" TEXT NOT NULL,
    "creadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TramoParametro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "motor"."CitaNormativa" (
    "id" UUID NOT NULL,
    "tipoNorma" "motor"."TipoNorma" NOT NULL,
    "identificacion" TEXT NOT NULL,
    "articulo" TEXT NOT NULL,
    "inciso" TEXT,
    "textoTranscripto" TEXT,
    "confiabilidad" "motor"."Confiabilidad" NOT NULL,
    "fuenteUrl" TEXT,
    "fechaConsulta" DATE,
    "publicadaBO" DATE,
    "creadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CitaNormativa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "motor"."TramoParametroCita" (
    "tramoId" UUID NOT NULL,
    "citaId" UUID NOT NULL,
    "creadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TramoParametroCita_pkey" PRIMARY KEY ("tramoId","citaId")
);

-- CreateTable
CREATE TABLE "motor"."Ratificacion" (
    "id" UUID NOT NULL,
    "idProfesional" TEXT NOT NULL,
    "matricula" TEXT NOT NULL,
    "jurisdiccionMatricula" "motor"."Jurisdiccion" NOT NULL,
    "nombreProfesional" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "fechaProximaRevision" DATE,
    "referenciaDocumentoFirmado" TEXT NOT NULL,
    "huellaDocumento" TEXT NOT NULL,
    "alcanceDeclarado" TEXT NOT NULL,
    "revocadaEn" TIMESTAMPTZ(6),
    "motivoRevocacion" "motor"."MotivoRevocacion",
    "creadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ratificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "motor"."MatriculaProfesional" (
    "idProfesional" TEXT NOT NULL,
    "matricula" TEXT NOT NULL,
    "colegio" TEXT NOT NULL,
    "jurisdiccion" "motor"."Jurisdiccion" NOT NULL,
    "estado" "motor"."EstadoMatricula" NOT NULL,
    "vigenciaDesde" DATE NOT NULL,
    "vigenciaHasta" DATE,
    "verificadaEn" TIMESTAMPTZ(6),
    "fuenteVerificacion" TEXT,
    "eliminadoEn" TIMESTAMPTZ(6),
    "creadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatriculaProfesional_pkey" PRIMARY KEY ("idProfesional")
);

-- CreateTable
CREATE TABLE "motor"."CatalogoNormativo" (
    "version" TEXT NOT NULL,
    "huellaContenido" TEXT NOT NULL,
    "generadoEl" TIMESTAMPTZ(6) NOT NULL,
    "estado" "motor"."EstadoCatalogo" NOT NULL DEFAULT 'BORRADOR',
    "aptoProduccion" BOOLEAN NOT NULL DEFAULT false,
    "publicadoPor" TEXT,
    "notas" TEXT,
    "creadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CatalogoNormativo_pkey" PRIMARY KEY ("version")
);

-- CreateTable
CREATE TABLE "motor"."CatalogoTramo" (
    "catalogoVersion" TEXT NOT NULL,
    "catalogoAptoProduccion" BOOLEAN NOT NULL,
    "tramoId" UUID NOT NULL,
    "tramoEstadoRatificacion" "motor"."EstadoRatificacion" NOT NULL,
    "creadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CatalogoTramo_pkey" PRIMARY KEY ("catalogoVersion","tramoId")
);

-- CreateIndex
CREATE INDEX "idx_tramo_sin_ratificar" ON "motor"."TramoParametro"("claveParametro");

-- CreateIndex
CREATE UNIQUE INDEX "uq_tramo_id_estado_ratificacion" ON "motor"."TramoParametro"("id", "estadoRatificacion");

-- CreateIndex
CREATE INDEX "idx_tramocita_cita" ON "motor"."TramoParametroCita"("citaId");

-- CreateIndex
CREATE INDEX "idx_ratificacion_revision" ON "motor"."Ratificacion"("fechaProximaRevision");

-- CreateIndex
CREATE INDEX "idx_ratificacion_profesional" ON "motor"."Ratificacion"("idProfesional");

-- CreateIndex
CREATE UNIQUE INDEX "uq_matricula_jurisdiccion" ON "motor"."MatriculaProfesional"("jurisdiccion", "matricula");

-- CreateIndex
CREATE UNIQUE INDEX "uq_matricula_id_estado" ON "motor"."MatriculaProfesional"("idProfesional", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "uq_catalogo_version_apto" ON "motor"."CatalogoNormativo"("version", "aptoProduccion");

-- CreateIndex
CREATE INDEX "idx_catalogotramo_tramo" ON "motor"."CatalogoTramo"("tramoId");

-- AddForeignKey
ALTER TABLE "motor"."TramoParametro" ADD CONSTRAINT "TramoParametro_claveParametro_fkey" FOREIGN KEY ("claveParametro") REFERENCES "motor"."ParametroNormativo"("clave") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "motor"."TramoParametro" ADD CONSTRAINT "TramoParametro_ratificacionId_fkey" FOREIGN KEY ("ratificacionId") REFERENCES "motor"."Ratificacion"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "motor"."TramoParametro" ADD CONSTRAINT "TramoParametro_reemplazaTramoId_fkey" FOREIGN KEY ("reemplazaTramoId") REFERENCES "motor"."TramoParametro"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "motor"."TramoParametroCita" ADD CONSTRAINT "TramoParametroCita_tramoId_fkey" FOREIGN KEY ("tramoId") REFERENCES "motor"."TramoParametro"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "motor"."TramoParametroCita" ADD CONSTRAINT "TramoParametroCita_citaId_fkey" FOREIGN KEY ("citaId") REFERENCES "motor"."CitaNormativa"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "motor"."Ratificacion" ADD CONSTRAINT "Ratificacion_idProfesional_fkey" FOREIGN KEY ("idProfesional") REFERENCES "motor"."MatriculaProfesional"("idProfesional") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "motor"."CatalogoTramo" ADD CONSTRAINT "fk_catalogotramo_catalogo" FOREIGN KEY ("catalogoVersion", "catalogoAptoProduccion") REFERENCES "motor"."CatalogoNormativo"("version", "aptoProduccion") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "motor"."CatalogoTramo" ADD CONSTRAINT "fk_catalogotramo_tramo" FOREIGN KEY ("tramoId", "tramoEstadoRatificacion") REFERENCES "motor"."TramoParametro"("id", "estadoRatificacion") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ═════════════════════════════════════════════════════════════════════════════
-- SQL CRUDO — lo que Prisma no expresa (ADR-007 §2.4, modelo-datos §6.4)
-- ═════════════════════════════════════════════════════════════════════════════

-- ── A.1 ParametroNormativo ───────────────────────────────────────────────────

-- "Obligatoria si `tipoValor` no es booleano ni enum" (modelo-datos A.1).
ALTER TABLE "motor"."ParametroNormativo"
  ADD CONSTRAINT "ck_parametro_unidad_obligatoria" CHECK (
    "tipoValor" IN ('BOOLEANO', 'ENUM_CERRADO')
    OR ("unidad" IS NOT NULL AND length(btrim("unidad")) > 0)
  );

-- ── A.2 TramoParametro ───────────────────────────────────────────────────────

-- R-1 / CA-47 / condición C-03. Invariante 2 de A.2: no existe forma de
-- escribir "ratificado" sin apuntar a quién ratificó. Éste es, junto con la
-- clave foránea compuesta de A.6, el par que hace que CA-58 no se pueda anular
-- por configuración: no hay variable de entorno que apague una restricción.
ALTER TABLE "motor"."TramoParametro"
  ADD CONSTRAINT "ck_tramo_ratificado_exige_ratificacion" CHECK (
    ("estadoRatificacion" = 'RATIFICADO') = ("ratificacionId" IS NOT NULL)
  );

-- Invariante 3 de A.2, tal como está escrita: dos restricciones, una por
-- dirección. Un tramo `A_DETERMINAR_POR_EL_ESTUDIO` o `CONTRADICCION_ABIERTA`
-- no tiene valor, y uno `CARGADO` no puede no tenerlo.
ALTER TABLE "motor"."TramoParametro"
  ADD CONSTRAINT "ck_tramo_valor_nulo_si_no_cargado" CHECK (
    "disponibilidad" = 'CARGADO' OR "valor" IS NULL
  );

ALTER TABLE "motor"."TramoParametro"
  ADD CONSTRAINT "ck_tramo_valor_presente_si_cargado" CHECK (
    "disponibilidad" <> 'CARGADO' OR "valor" IS NOT NULL
  );

-- Invariante 4 de A.2: lo que no está determinado no puede figurar ratificado.
ALTER TABLE "motor"."TramoParametro"
  ADD CONSTRAINT "ck_tramo_sin_dato_no_ratificable" CHECK (
    "disponibilidad" = 'CARGADO' OR "estadoRatificacion" = 'SIN_RATIFICAR'
  );

-- Forma canónica de la vigencia: `[desde, hasta)` con inicio conocido. Sin
-- esto, un rango vacío o con inicio abierto escaparía a la exclusión y
-- convertiría "qué regía a la fecha del hecho" en una pregunta sin respuesta.
ALTER TABLE "motor"."TramoParametro"
  ADD CONSTRAINT "ck_tramo_vigencia_canonica" CHECK (
    NOT isempty("vigencia")
    AND lower_inc("vigencia")
    AND NOT upper_inc("vigencia")
  );

-- Coherencia de columnas (no es una invariante nueva de la spec): el linaje de
-- correcciones no puede apuntarse a sí mismo.
ALTER TABLE "motor"."TramoParametro"
  ADD CONSTRAINT "ck_tramo_linaje_no_reflexivo" CHECK (
    "reemplazaTramoId" IS NULL OR "reemplazaTramoId" <> "id"
  );

-- R-13 / CA-29. LA restricción de este bloque: dos tramos vigentes de la misma
-- clave y jurisdicción no pueden solaparse. Un tramo retirado queda fuera del
-- alcance (la baja lógica no debe impedir cargar el reemplazo), pero sigue
-- existiendo para reproducir resultados viejos.
-- El índice GiST que crea esta restricción es además el que sirve Q-04
-- —`claveParametro = $1 AND jurisdiccion = $2 AND vigencia @> $3::date`—, la
-- consulta más frecuente del sistema. Por eso no hay un btree adicional.
ALTER TABLE "motor"."TramoParametro"
  ADD CONSTRAINT "ix_tramo_vigencia" EXCLUDE USING gist (
    "claveParametro" WITH =,
    "jurisdiccion" WITH =,
    "vigencia" WITH &&
  ) WHERE ("retiradoEn" IS NULL);

COMMENT ON CONSTRAINT "ix_tramo_vigencia" ON "motor"."TramoParametro" IS
  'R-13 (CA-29): vigencias sin solapamiento por clave y jurisdicción. Sirve además la consulta Q-04.';

-- Q-09, tablero del administrador: qué falta ratificar. Índice PARCIAL: la cola
-- de pendientes es una fracción de la tabla. Se recrea acá porque Prisma no
-- expresa el `WHERE`; el nombre es el mismo que declara `schema.prisma` para
-- que el chequeo de deriva no proponga borrarlo.
DROP INDEX IF EXISTS "motor"."idx_tramo_sin_ratificar";
CREATE INDEX "idx_tramo_sin_ratificar"
  ON "motor"."TramoParametro" ("claveParametro")
  WHERE "estadoRatificacion" = 'SIN_RATIFICAR' AND "retiradoEn" IS NULL;

-- ── A.3 CitaNormativa ────────────────────────────────────────────────────────

-- CA-27 pide artículo, no norma a secas. La columna es NOT NULL; la cadena
-- vacía tampoco alcanza (mismo criterio que la matrícula en A.4).
ALTER TABLE "motor"."CitaNormativa"
  ADD CONSTRAINT "ck_cita_articulo_no_vacio" CHECK (
    length(btrim("articulo")) > 0
  );

-- ── A.4 Ratificacion ─────────────────────────────────────────────────────────

-- Invariante 1 de A.4 / CA-47: sin matrícula no hay ratificación posible, y la
-- cadena vacía tampoco.
ALTER TABLE "motor"."Ratificacion"
  ADD CONSTRAINT "ck_ratificacion_matricula_no_vacia" CHECK (
    length(btrim("matricula")) > 0
  );

-- Coherencia de columnas: una revocación tiene fecha y motivo, o no existe.
ALTER TABLE "motor"."Ratificacion"
  ADD CONSTRAINT "ck_ratificacion_revocacion_coherente" CHECK (
    ("revocadaEn" IS NULL) = ("motivoRevocacion" IS NULL)
  );

-- Coherencia de columnas: la próxima revisión no puede ser anterior a la firma.
ALTER TABLE "motor"."Ratificacion"
  ADD CONSTRAINT "ck_ratificacion_revision_posterior" CHECK (
    "fechaProximaRevision" IS NULL OR "fechaProximaRevision" >= "fecha"
  );

-- Q-09: ratificaciones con revisión vencida. Índice PARCIAL, mismo criterio y
-- mismo nombre declarado en `schema.prisma`.
DROP INDEX IF EXISTS "motor"."idx_ratificacion_revision";
CREATE INDEX "idx_ratificacion_revision"
  ON "motor"."Ratificacion" ("fechaProximaRevision")
  WHERE "revocadaEn" IS NULL AND "fechaProximaRevision" IS NOT NULL;

-- ── A.5 MatriculaProfesional ─────────────────────────────────────────────────

ALTER TABLE "motor"."MatriculaProfesional"
  ADD CONSTRAINT "ck_matricula_no_vacia" CHECK (
    length(btrim("matricula")) > 0
  );

-- Coherencia de columnas.
ALTER TABLE "motor"."MatriculaProfesional"
  ADD CONSTRAINT "ck_matricula_vigencia_coherente" CHECK (
    "vigenciaHasta" IS NULL OR "vigenciaHasta" >= "vigenciaDesde"
  );

-- ── A.6 CatalogoNormativo / CatalogoTramo ────────────────────────────────────

-- R-2 / CA-58 / R-12 / condición C-02. Invariante 4 de A.6. Junto con las dos
-- claves foráneas compuestas —creadas más arriba por Prisma— produce el
-- resultado que pide la spec: no existe ninguna secuencia de sentencias SQL que
-- meta un tramo sin ratificar en un catálogo apto para producción, ni que
-- degrade a SIN_RATIFICAR un tramo que ya está dentro de uno (lo impide el
-- `ON UPDATE RESTRICT` de `fk_catalogotramo_tramo`).
ALTER TABLE "motor"."CatalogoTramo"
  ADD CONSTRAINT "ck_catalogotramo_apto_exige_ratificado" CHECK (
    NOT "catalogoAptoProduccion" OR "tramoEstadoRatificacion" = 'RATIFICADO'
  );

COMMENT ON CONSTRAINT "ck_catalogotramo_apto_exige_ratificado" ON "motor"."CatalogoTramo" IS
  'R-2 (CA-58, C-02): un catálogo apto para producción no admite tramos sin ratificar. Sin bandera de configuración que lo anule.';

COMMENT ON CONSTRAINT "fk_catalogotramo_tramo" ON "motor"."CatalogoTramo" IS
  'R-2: clave foránea compuesta contra (id, estadoRatificacion). Con ON UPDATE RESTRICT impide degradar la ratificación de un tramo ya publicado.';

COMMENT ON CONSTRAINT "fk_catalogotramo_catalogo" ON "motor"."CatalogoTramo" IS
  'R-2: clave foránea compuesta contra (version, aptoProduccion). La réplica de aptoProduccion no es desnormalización: es el mecanismo.';

-- ═════════════════════════════════════════════════════════════════════════════
-- CLASIFICACIÓN DE SENSIBILIDAD (modelo-datos §1 y §4.1)
--
-- Cada columna lleva su clasificación como comentario en la propia base, para
-- que sea verificable por consulta y no sólo por lectura de un documento. El
-- test `prisma/tests/clasificacion-sensibilidad.test.ts` falla si alguna
-- columna del esquema `motor` queda sin clasificar.
--
-- En todo el Bloque A no hay un solo campo PATR: el catálogo normativo es la
-- ley y nuestra lectura de la ley. Por eso acá no hay nada cifrado ni ningún
-- hash determinista de búsqueda — eso aparece en los bloques B y C (T-06, T-09).
-- ═════════════════════════════════════════════════════════════════════════════

COMMENT ON TABLE "motor"."ParametroNormativo" IS 'A.1 — Catálogo cerrado de claves de parámetro. Carga controlada por migración/seed. Retención: indefinida (no es dato personal).';
COMMENT ON COLUMN "motor"."ParametroNormativo"."clave" IS 'PUB — clave del contrato, ej. prescripcion.plazoGenerico';
COMMENT ON COLUMN "motor"."ParametroNormativo"."analisis" IS 'PUB — análisis del motor al que pertenece';
COMMENT ON COLUMN "motor"."ParametroNormativo"."descripcion" IS 'PUB — qué representa (dictamen §5)';
COMMENT ON COLUMN "motor"."ParametroNormativo"."tipoValor" IS 'PUB — forma admitida de TramoParametro.valor';
COMMENT ON COLUMN "motor"."ParametroNormativo"."unidad" IS 'PUB — años, días corridos, % anual, veces el SMVM';
COMMENT ON COLUMN "motor"."ParametroNormativo"."esNormativo" IS 'PUB — false en umbrales de producto: no se presentan como norma';
COMMENT ON COLUMN "motor"."ParametroNormativo"."admiteJurisdiccion" IS 'PUB — true en los parámetros del análisis E (CA-43)';
COMMENT ON COLUMN "motor"."ParametroNormativo"."bloqueanteDeAnalisis" IS 'PUB — si falta o no está ratificado, el análisis entero queda sin resultado';
COMMENT ON COLUMN "motor"."ParametroNormativo"."creadoEn" IS 'INT — marca de alta';

COMMENT ON TABLE "motor"."TramoParametro" IS 'A.2 — Un valor de un parámetro, en una jurisdicción, durante un período. Sólo inserción: la única columna que admite UPDATE es retiradoEn (§7.2). Retención: indefinida.';
COMMENT ON COLUMN "motor"."TramoParametro"."id" IS 'INT — UUID v7 provisto por quien inserta';
COMMENT ON COLUMN "motor"."TramoParametro"."claveParametro" IS 'PUB — clave del parámetro';
COMMENT ON COLUMN "motor"."TramoParametro"."jurisdiccion" IS 'PUB — TODAS no es comodín de búsqueda (CA-52, S-09)';
COMMENT ON COLUMN "motor"."TramoParametro"."valor" IS 'PUB — valor canónico en JSONB, validado según tipoValor';
COMMENT ON COLUMN "motor"."TramoParametro"."vigencia" IS 'PUB — daterange [desde, hasta); hasta no acotado = vigente sin término conocido';
COMMENT ON COLUMN "motor"."TramoParametro"."disponibilidad" IS 'PUB — CARGADO / A_DETERMINAR_POR_EL_ESTUDIO / CONTRADICCION_ABIERTA';
COMMENT ON COLUMN "motor"."TramoParametro"."confiabilidadFuente" IS 'PUB — leyenda del dictamen; no gobierna el bloqueo (C-02)';
COMMENT ON COLUMN "motor"."TramoParametro"."estadoRatificacion" IS 'INT — SIN_RATIFICAR por defecto; RATIFICADO exige ratificacionId (R-1)';
COMMENT ON COLUMN "motor"."TramoParametro"."ratificacionId" IS 'INT — acto de ratificación que lo firma';
COMMENT ON COLUMN "motor"."TramoParametro"."notaDeAlcance" IS 'PUB — catálogo cerrado de notas del contrato';
COMMENT ON COLUMN "motor"."TramoParametro"."reemplazaTramoId" IS 'INT — linaje de correcciones';
COMMENT ON COLUMN "motor"."TramoParametro"."retiradoEn" IS 'INT — baja lógica; nunca se borra mientras un catálogo lo referencie';
COMMENT ON COLUMN "motor"."TramoParametro"."cargadoPor" IS 'INT — operador, MIGRACION o SEED';
COMMENT ON COLUMN "motor"."TramoParametro"."creadoEn" IS 'INT — marca de alta';

COMMENT ON TABLE "motor"."CitaNormativa" IS 'A.3 — Cita con artículo (CA-27) y trazabilidad documental. Retención: indefinida.';
COMMENT ON COLUMN "motor"."CitaNormativa"."id" IS 'PUB — identificador de la cita';
COMMENT ON COLUMN "motor"."CitaNormativa"."tipoNorma" IS 'PUB — LEY, DECRETO, DNU, CODIGO, COMUNICACION_BCRA, RESOLUCION, FALLO';
COMMENT ON COLUMN "motor"."CitaNormativa"."identificacion" IS 'PUB — Ley 25.065, CCyC, Decreto 484/87, Fallos 334:1276';
COMMENT ON COLUMN "motor"."CitaNormativa"."articulo" IS 'PUB — obligatorio: CA-27 pide artículo, no norma a secas';
COMMENT ON COLUMN "motor"."CitaNormativa"."inciso" IS 'PUB — inciso, si corresponde';
COMMENT ON COLUMN "motor"."CitaNormativa"."textoTranscripto" IS 'PUB — transcripción literal corroborada';
COMMENT ON COLUMN "motor"."CitaNormativa"."confiabilidad" IS 'PUB — leyenda del dictamen';
COMMENT ON COLUMN "motor"."CitaNormativa"."fuenteUrl" IS 'PUB — fuente consultada';
COMMENT ON COLUMN "motor"."CitaNormativa"."fechaConsulta" IS 'PUB — cuándo se leyó la fuente';
COMMENT ON COLUMN "motor"."CitaNormativa"."publicadaBO" IS 'PUB — publicación en el Boletín Oficial';
COMMENT ON COLUMN "motor"."CitaNormativa"."creadoEn" IS 'INT — marca de alta';

COMMENT ON TABLE "motor"."TramoParametroCita" IS 'A.3 — Vínculo N:M tramo/cita. Todo tramo CARGADO tiene al menos una cita: se verifica con disparador diferido en la migración 0009 (§7.3).';
COMMENT ON COLUMN "motor"."TramoParametroCita"."tramoId" IS 'INT — tramo';
COMMENT ON COLUMN "motor"."TramoParametroCita"."citaId" IS 'INT — cita';
COMMENT ON COLUMN "motor"."TramoParametroCita"."creadoEn" IS 'INT — marca de alta';

COMMENT ON TABLE "motor"."Ratificacion" IS 'A.4 — Firma del profesional sobre un conjunto de tramos (C-03). Retención: mientras exista algo que dependa de ella, más la prescripción de la responsabilidad profesional — plazo sin determinar, escalamiento E-2: NO hay purga automática.';
COMMENT ON COLUMN "motor"."Ratificacion"."id" IS 'INT — identificador del acto';
COMMENT ON COLUMN "motor"."Ratificacion"."idProfesional" IS 'PERS — identificador opaco del profesional';
COMMENT ON COLUMN "motor"."Ratificacion"."matricula" IS 'PERS — copiada del padrón: la ratificación es un hecho histórico. En claro y con índice a propósito (§4.1)';
COMMENT ON COLUMN "motor"."Ratificacion"."jurisdiccionMatricula" IS 'PERS — jurisdicción de la matrícula';
COMMENT ON COLUMN "motor"."Ratificacion"."nombreProfesional" IS 'PERS — único nombre de persona del modelo. Base legal: ejecución del contrato con el profesional y responsabilidad profesional identificable. No es dato del deudor (CA-60 no lo alcanza)';
COMMENT ON COLUMN "motor"."Ratificacion"."fecha" IS 'PERS — fecha de la firma';
COMMENT ON COLUMN "motor"."Ratificacion"."fechaProximaRevision" IS 'INT — C-03; alimenta el tablero de vencimientos (Q-09)';
COMMENT ON COLUMN "motor"."Ratificacion"."referenciaDocumentoFirmado" IS 'INT — referencia en el almacén de objetos; el archivo no vive en la base';
COMMENT ON COLUMN "motor"."Ratificacion"."huellaDocumento" IS 'INT — SHA-256 del documento firmado';
COMMENT ON COLUMN "motor"."Ratificacion"."alcanceDeclarado" IS 'PUB — qué dice el profesional que ratificó, en sus términos';
COMMENT ON COLUMN "motor"."Ratificacion"."revocadaEn" IS 'INT — revocar no cambia el pasado (A.4 inv. 2)';
COMMENT ON COLUMN "motor"."Ratificacion"."motivoRevocacion" IS 'INT — motivo de la revocación';
COMMENT ON COLUMN "motor"."Ratificacion"."creadoEn" IS 'INT — marca de alta';

COMMENT ON TABLE "motor"."MatriculaProfesional" IS 'A.5 — Matrícula verificada (CA-47). Baja lógica con eliminadoEn; las ratificaciones se conservan. Retención: escalamiento E-2, sin purga automática.';
COMMENT ON COLUMN "motor"."MatriculaProfesional"."idProfesional" IS 'PERS — identificador opaco';
COMMENT ON COLUMN "motor"."MatriculaProfesional"."matricula" IS 'PERS — número de matrícula; en claro y con índice (§4.1)';
COMMENT ON COLUMN "motor"."MatriculaProfesional"."colegio" IS 'PERS — colegio que la otorga';
COMMENT ON COLUMN "motor"."MatriculaProfesional"."jurisdiccion" IS 'PERS — jurisdicción del colegio';
COMMENT ON COLUMN "motor"."MatriculaProfesional"."estado" IS 'PERS — VIGENTE, SUSPENDIDA, CANCELADA, NO_VERIFICADA';
COMMENT ON COLUMN "motor"."MatriculaProfesional"."vigenciaDesde" IS 'PERS — desde cuándo rige';
COMMENT ON COLUMN "motor"."MatriculaProfesional"."vigenciaHasta" IS 'PERS — hasta cuándo, si hay término';
COMMENT ON COLUMN "motor"."MatriculaProfesional"."verificadaEn" IS 'INT — cuándo se verificó contra el padrón';
COMMENT ON COLUMN "motor"."MatriculaProfesional"."fuenteVerificacion" IS 'INT — padrón del colegio, constancia, etc.';
COMMENT ON COLUMN "motor"."MatriculaProfesional"."eliminadoEn" IS 'INT — baja lógica';
COMMENT ON COLUMN "motor"."MatriculaProfesional"."creadoEn" IS 'INT — marca de alta';

COMMENT ON TABLE "motor"."CatalogoNormativo" IS 'A.6 — Conjunto exacto y congelado de tramos (CA-27, CA-31). Un catálogo PUBLICADO es inmutable: el disparador llega en la migración 0009. Retención: indefinida.';
COMMENT ON COLUMN "motor"."CatalogoNormativo"."version" IS 'INT — versión monótona y legible, ej. 2026.09.20-001';
COMMENT ON COLUMN "motor"."CatalogoNormativo"."huellaContenido" IS 'INT — SHA-256 de la serialización canónica de sus tramos';
COMMENT ON COLUMN "motor"."CatalogoNormativo"."generadoEl" IS 'INT — generación del conjunto';
COMMENT ON COLUMN "motor"."CatalogoNormativo"."estado" IS 'INT — BORRADOR, PUBLICADO, RETIRADO';
COMMENT ON COLUMN "motor"."CatalogoNormativo"."aptoProduccion" IS 'INT — columna que hace cumplir CA-58 (R-2)';
COMMENT ON COLUMN "motor"."CatalogoNormativo"."publicadoPor" IS 'INT — quién publicó';
COMMENT ON COLUMN "motor"."CatalogoNormativo"."notas" IS 'INT — notas de publicación';
COMMENT ON COLUMN "motor"."CatalogoNormativo"."creadoEn" IS 'INT — marca de alta';

COMMENT ON TABLE "motor"."CatalogoTramo" IS 'A.6 — Pertenencia de un tramo a un catálogo. Las dos réplicas de estado existen para sostener las claves foráneas compuestas que hacen imposible CA-58.';
COMMENT ON COLUMN "motor"."CatalogoTramo"."catalogoVersion" IS 'INT — catálogo';
COMMENT ON COLUMN "motor"."CatalogoTramo"."catalogoAptoProduccion" IS 'INT — réplica sostenida por clave foránea compuesta (R-2)';
COMMENT ON COLUMN "motor"."CatalogoTramo"."tramoId" IS 'INT — tramo incluido';
COMMENT ON COLUMN "motor"."CatalogoTramo"."tramoEstadoRatificacion" IS 'INT — réplica sostenida por clave foránea compuesta (R-2)';
COMMENT ON COLUMN "motor"."CatalogoTramo"."creadoEn" IS 'INT — marca de alta';
