-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 0018 — bitacora_de_auditoria
-- Feature 002, tarea T-03. Fila `0018` de modelo-datos.md §6.2.
-- Bloque G: G.1 `auditoria.EventoAuditoria` (particionada), G.2
-- `auditoria.SelloDeBitacora`.
--
-- **Es la única migración de la feature con costo futuro** (modelo-datos §6.3):
-- agregar particiones es barato, pero cambiar la clave de partición de una
-- bitácora grande no lo es. Por eso se decide ahora y no después.
--
-- Extiende el `EventoAuditoria` que el plan de la 001 §5.3 dejó escrito, con lo
-- que esa feature difirió expresamente a ésta: taxonomía cerrada de acciones,
-- `titularAfectado`, clasificación, retención y encadenamiento de hashes.
--
-- Reversión: reversion.sql de este mismo directorio.
-- ─────────────────────────────────────────────────────────────────────────────

-- ═════════════════════════════════════════════════════════════════════════════
-- La forma cerrada de `datos`
--
-- `datos` son pares clave/valor CERRADOS (`DatoDeEvento` del contrato).
-- Prohibido el texto libre: es la vía por la que un dato patrimonial se filtra
-- a una tabla que nadie cifra. Un `CHECK` no admite subconsultas, así que la
-- validación va en una función inmutable y el `CHECK` la invoca.
-- ═════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION "auditoria"."forma_de_datos_valida"("datos" JSONB)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT jsonb_typeof("datos") = 'array'
     AND NOT EXISTS (
       SELECT 1
         FROM jsonb_array_elements("datos") AS par
        WHERE jsonb_typeof(par) <> 'object'
           OR NOT (par ? 'clave')
           OR NOT (par ? 'valor')
           OR (SELECT count(*) FROM jsonb_object_keys(par)) <> 2
           OR jsonb_typeof(par -> 'clave') <> 'string'
           -- El valor es escalar o nulo. Un objeto o un arreglo anidado es la
           -- puerta por la que entra el volcado entero de una entidad.
           OR jsonb_typeof(par -> 'valor') IN ('object', 'array')
     );
$$;

COMMENT ON FUNCTION "auditoria"."forma_de_datos_valida"(JSONB) IS
  'Valida la forma de EventoAuditoria.datos: arreglo de objetos {clave, valor} con clave de texto y valor escalar o nulo. Prohibe el texto libre anidado, que es la via por la que un dato patrimonial se filtra a una tabla que nadie cifra.';

-- ═════════════════════════════════════════════════════════════════════════════
-- G.1 — `auditoria.EventoAuditoria`
--
-- PARTICIONADA POR RANGO MENSUAL sobre `momento`. La retención se ejecuta
-- SOLTANDO PARTICIONES, no con borrados masivos. Idéntico tratamiento al de
-- `motor.BitacoraAcceso` en la 004 §C.5 —y son la misma cosa con dos formas:
-- ver la nota de coordinación G.3 y el escalamiento E-002-5.
--
-- Dos decisiones de integridad, que son EL mecanismo y no un detalle:
--
--  - `sujeto` y `titularAfectado` SÍ tienen clave foránea, con `ON DELETE
--    RESTRICT`: el motor de base IMPIDE borrar físicamente una cuenta mientras
--    tenga un evento en la bitácora. La única salida es la lápida de §5.4. La
--    bitácora no puede quedar huérfana porque el `DELETE` falla (R-002-11).
--  - `origenSesionId` NO tiene clave foránea. Las sesiones se purgan a los 90
--    días; una clave foránea contra una tabla purgable obligaría a elegir entre
--    no purgar y borrar auditoría. Se guarda por valor.
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE "auditoria"."EventoAuditoria" (
    "id" TEXT NOT NULL,
    "secuencia" BIGSERIAL NOT NULL,
    "momento" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accion" "auditoria"."AccionAuditada" NOT NULL,
    "sujeto" TEXT,
    "titularAfectado" TEXT,
    "tipoRecurso" "auditoria"."TipoRecurso",
    "idRecurso" TEXT,
    "clasificacion" "auditoria"."ClasificacionDato" NOT NULL,
    "permisoEvaluado" "acceso"."Permiso",
    "resultado" "auditoria"."ResultadoEvento" NOT NULL,
    "motivo" "auditoria"."MotivoDenegacion",
    "origenSesionId" TEXT,
    "origenIpHash" BYTEA,
    "origenDispositivoClase" "acceso"."DispositivoClase",
    "origenCanal" "auditoria"."CanalDeOrigen" NOT NULL,
    "idCorrelacion" TEXT NOT NULL,
    "datos" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "EventoAuditoria_pkey" PRIMARY KEY ("momento","id")
) PARTITION BY RANGE ("momento");

COMMENT ON TABLE "auditoria"."EventoAuditoria" IS
  'G.1 — bitacora inmutable de accesos y acciones (constitucion #5, CA-21, CA-34). Particionada por rango mensual sobre momento. Sin UPDATE ni DELETE: REVOKE en la 0020 y disparador en la 0021. Retencion: bitacoraAuditoria = A_DETERMINAR (escalamiento E-002-3, bloqueante; valor de trabajo 5 anios). R-002-15 impide MATERIALMENTE que la purga se ejecute mientras el plazo no este determinado: soltar una particion sin poder registrar la corrida en H.2 no es una opcion.';

COMMENT ON COLUMN "auditoria"."EventoAuditoria"."id" IS 'INT — identificador opaco. PK compuesta con momento porque la tabla esta particionada por momento.';
COMMENT ON COLUMN "auditoria"."EventoAuditoria"."secuencia" IS 'INT — monotona. Es lo que el sello de Merkle de G.2 recorre.';
COMMENT ON COLUMN "auditoria"."EventoAuditoria"."momento" IS 'INT — clave de particion (rango mensual).';
COMMENT ON COLUMN "auditoria"."EventoAuditoria"."accion" IS 'INT — taxonomia cerrada; agregar un valor es revision aditiva en compuerta.';
COMMENT ON COLUMN "auditoria"."EventoAuditoria"."sujeto" IS 'PERS — QUIEN ACTUO. NULL en acciones del sistema. FK ON DELETE RESTRICT: impide borrar la cuenta y dejar huerfana la bitacora (R-002-11).';
COMMENT ON COLUMN "auditoria"."EventoAuditoria"."titularAfectado" IS 'PERS — SOBRE LOS DATOS DE QUIEN. Sin esta columna no se puede responder "quien miro mi informacion" (dictamen §4.1), y agregarla despues obliga a reprocesar la bitacora entera.';
COMMENT ON COLUMN "auditoria"."EventoAuditoria"."tipoRecurso" IS 'INT — tipo de recurso alcanzado.';
COMMENT ON COLUMN "auditoria"."EventoAuditoria"."idRecurso" IS 'INT — identificador opaco del recurso.';
COMMENT ON COLUMN "auditoria"."EventoAuditoria"."clasificacion" IS 'INT — NOT NULL. Cierra el defecto D-002-10 (R-002-22): no hay evento sin clasificacion del dato alcanzado.';
COMMENT ON COLUMN "auditoria"."EventoAuditoria"."permisoEvaluado" IS 'INT — que permiso se evaluo.';
COMMENT ON COLUMN "auditoria"."EventoAuditoria"."resultado" IS 'INT — PERMITIDO / DENEGADO / EJECUTADO / FALLIDO.';
COMMENT ON COLUMN "auditoria"."EventoAuditoria"."motivo" IS 'INT — motivo de la denegacion, cuando la hay.';
COMMENT ON COLUMN "auditoria"."EventoAuditoria"."origenSesionId" IS 'INT — POR VALOR, SIN clave foranea: las sesiones se purgan a los 90 dias y una FK obligaria a elegir entre no purgar y borrar auditoria.';
COMMENT ON COLUMN "auditoria"."EventoAuditoria"."origenIpHash" IS 'PERS — HMAC. Nunca la IP en claro. Mismo criterio que la 004.';
COMMENT ON COLUMN "auditoria"."EventoAuditoria"."origenDispositivoClase" IS 'PERS — categoria cerrada del dispositivo.';
COMMENT ON COLUMN "auditoria"."EventoAuditoria"."origenCanal" IS 'INT — WEB / MOVIL / API / PROCESO_INTERNO / SIEMBRA.';
COMMENT ON COLUMN "auditoria"."EventoAuditoria"."idCorrelacion" IS 'INT — correlacion de la peticion. SIN indice: se usa en el registro de diagnostico, no en una consulta de producto.';
COMMENT ON COLUMN "auditoria"."EventoAuditoria"."datos" IS 'INT — pares clave/valor CERRADOS. Prohibido el texto libre anidado; la forma la valida auditoria.forma_de_datos_valida.';

-- **R-002-22.** Un evento denegado sin motivo no explica nada; un evento con
-- motivo y resultado permitido se contradice.
ALTER TABLE "auditoria"."EventoAuditoria" ADD CONSTRAINT "ck_evento_motivo_si_denegado"
  CHECK (("resultado" = 'DENEGADO') OR "motivo" IS NULL);

-- Un recurso identificado sin tipo, o un tipo sin identificador, deja el evento
-- sin poder responder "sobre qué".
ALTER TABLE "auditoria"."EventoAuditoria" ADD CONSTRAINT "ck_evento_recurso_coherente"
  CHECK (("tipoRecurso" IS NULL) = ("idRecurso" IS NULL));

ALTER TABLE "auditoria"."EventoAuditoria" ADD CONSTRAINT "ck_evento_datos_cerrados"
  CHECK ("auditoria"."forma_de_datos_valida"("datos"));

ALTER TABLE "auditoria"."EventoAuditoria" ADD CONSTRAINT "ck_evento_correlacion_no_vacia"
  CHECK (length(btrim("idCorrelacion")) > 0);

-- Q-12 (CA-21, CA-25): "¿quién miró mi información?" y exportación de la
-- bitácora propia. Local a cada partición mensual.
CREATE INDEX "idx_evento_titular" ON "auditoria"."EventoAuditoria" ("titularAfectado", "momento" DESC);

-- Q-13 (CA-10 de la 001, `auditoria.leer.propia`): "mi actividad reciente".
CREATE INDEX "idx_evento_sujeto" ON "auditoria"."EventoAuditoria" ("sujeto", "momento" DESC);

-- Q-14 (CA-34): todas las creaciones de cuentas administradoras. PARCIAL y
-- diminuto. Lo usa además el disparador diferido de R-002-03 en la 0021.
DROP INDEX IF EXISTS "auditoria"."idx_evento_admin";
CREATE INDEX "idx_evento_admin"
  ON "auditoria"."EventoAuditoria" ("momento")
  WHERE "accion" IN ('ADMINISTRADOR_CREADO', 'ADMINISTRADOR_SEMBRADO', 'ADMINISTRADOR_NOMINALIZADO');

-- Recorrido del sello de Merkle por ventana de secuencia (G.2).
CREATE INDEX "idx_evento_secuencia" ON "auditoria"."EventoAuditoria" ("secuencia");

-- El índice que hace barato al disparador diferido de CA-34: buscar el evento
-- de creación de administrador por titular afectado, dentro de la transacción.
CREATE INDEX "idx_evento_admin_titular"
  ON "auditoria"."EventoAuditoria" ("titularAfectado")
  WHERE "accion" IN ('ADMINISTRADOR_CREADO', 'ADMINISTRADOR_SEMBRADO');

-- **R-002-11.** Las dos claves foráneas que hacen imposible dejar huérfana la
-- bitácora. Son claves foráneas DESDE una tabla particionada: PostgreSQL las
-- admite desde la versión 12 y las propaga a cada partición.
ALTER TABLE "auditoria"."EventoAuditoria" ADD CONSTRAINT "EventoAuditoria_sujeto_fkey"
  FOREIGN KEY ("sujeto") REFERENCES "acceso"."Usuario"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "auditoria"."EventoAuditoria" ADD CONSTRAINT "EventoAuditoria_titularAfectado_fkey"
  FOREIGN KEY ("titularAfectado") REFERENCES "acceso"."Usuario"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ═════════════════════════════════════════════════════════════════════════════
-- Rutina de creación de particiones
--
-- Crea las que falten desde el mes en curso hacia adelante. Es idempotente: se
-- la puede correr todos los días sin efecto si ya están. La llama `cicd` desde
-- una tarea programada; la migración la ejecuta una vez con 12 meses.
-- ═════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION "auditoria"."asegurar_particiones_de_bitacora"("meses_adelante" INTEGER DEFAULT 12)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  mes_base DATE := date_trunc('month', now())::DATE;
  i INTEGER;
  desde DATE;
  hasta DATE;
  nombre TEXT;
  creadas INTEGER := 0;
BEGIN
  IF "meses_adelante" < 0 THEN
    RAISE EXCEPTION 'meses_adelante no puede ser negativo (recibido: %)', "meses_adelante";
  END IF;

  FOR i IN 0.."meses_adelante" LOOP
    desde := (mes_base + (i || ' months')::INTERVAL)::DATE;
    hasta := (desde + INTERVAL '1 month')::DATE;
    nombre := 'EventoAuditoria_' || to_char(desde, 'YYYY"m"MM');

    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'auditoria' AND c.relname = nombre
    ) THEN
      EXECUTE format(
        'CREATE TABLE "auditoria".%I PARTITION OF "auditoria"."EventoAuditoria" FOR VALUES FROM (%L) TO (%L)',
        nombre, desde, hasta
      );
      creadas := creadas + 1;
    END IF;
  END LOOP;

  RETURN creadas;
END;
$$;

COMMENT ON FUNCTION "auditoria"."asegurar_particiones_de_bitacora"(INTEGER) IS
  'Crea las particiones mensuales que falten, desde el mes en curso hacia adelante. Idempotente. La corre cicd desde una tarea programada; sin ella la bitacora caeria en la particion por defecto.';

-- Partición por defecto, y conviene decir por qué existe.
--
-- Sin ella, un evento con `momento` fuera del rango cubierto haría fallar el
-- `INSERT`, y como la bitácora se escribe en la misma transacción que la acción
-- auditada, **la acción también fallaría**. Eso convierte "se dejó de correr la
-- rutina de particiones" en una caída del sistema. Con partición por defecto el
-- evento se registra igual y la operación sigue: perder el registro de lo que
-- pasó es peor que tener una partición incómoda de soltar (constitución #5).
-- El costo conocido: crear una partición nueva que solape con la por defecto
-- exige revisarla, y por eso la rutina de arriba corre con anticipación.
CREATE TABLE "auditoria"."EventoAuditoria_fuera_de_rango"
  PARTITION OF "auditoria"."EventoAuditoria" DEFAULT;

COMMENT ON TABLE "auditoria"."EventoAuditoria_fuera_de_rango" IS
  'Particion por defecto de la bitacora. En operacion normal esta VACIA: si tiene filas, la rutina asegurar_particiones_de_bitacora dejo de correr. Es una alarma, no un destino.';

SELECT "auditoria"."asegurar_particiones_de_bitacora"(12);

-- ═════════════════════════════════════════════════════════════════════════════
-- G.2 — `auditoria.SelloDeBitacora`
--
-- Existe porque `REVOKE UPDATE, DELETE` NO ALCANZA contra alguien con acceso de
-- escritura a la base: el sello firmado periódicamente es lo que permite
-- detectar la alteración después del hecho. Es la pieza que convierte "bitácora
-- inmutable" (constitución #5) de una afirmación en algo demostrable.
-- Sólo inserción.
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE "auditoria"."SelloDeBitacora" (
    "particion" DATE NOT NULL,
    "desdeSecuencia" BIGINT NOT NULL,
    "hastaSecuencia" BIGINT NOT NULL,
    "raiz" TEXT NOT NULL,
    "algoritmo" TEXT NOT NULL DEFAULT 'SHA-256/MERKLE',
    "firma" TEXT NOT NULL,
    "kid" TEXT NOT NULL,
    "momento" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SelloDeBitacora_pkey" PRIMARY KEY ("particion","desdeSecuencia")
);

COMMENT ON TABLE "auditoria"."SelloDeBitacora" IS
  'G.2 — sello firmado de una ventana de la bitacora (raiz de Merkle). Solo insercion. Retencion: INDEFINIDA; sin el sello, la inmutabilidad de G.1 no es demostrable. Se conserva aunque se suelte la particion sellada.';

COMMENT ON COLUMN "auditoria"."SelloDeBitacora"."particion" IS 'INT — mes de la particion sellada.';
COMMENT ON COLUMN "auditoria"."SelloDeBitacora"."desdeSecuencia" IS 'INT — primera secuencia de la ventana.';
COMMENT ON COLUMN "auditoria"."SelloDeBitacora"."hastaSecuencia" IS 'INT — ultima secuencia de la ventana.';
COMMENT ON COLUMN "auditoria"."SelloDeBitacora"."raiz" IS 'INT — raiz de Merkle de la ventana.';
COMMENT ON COLUMN "auditoria"."SelloDeBitacora"."algoritmo" IS 'INT — algoritmo del arbol y del resumen.';
COMMENT ON COLUMN "auditoria"."SelloDeBitacora"."firma" IS 'INT — firma de la raiz.';
COMMENT ON COLUMN "auditoria"."SelloDeBitacora"."kid" IS 'INT — identificador de la clave de firma.';
COMMENT ON COLUMN "auditoria"."SelloDeBitacora"."momento" IS 'INT — cuando se sello.';

ALTER TABLE "auditoria"."SelloDeBitacora" ADD CONSTRAINT "ck_sello_ventana_ordenada"
  CHECK ("hastaSecuencia" >= "desdeSecuencia");
ALTER TABLE "auditoria"."SelloDeBitacora" ADD CONSTRAINT "ck_sello_particion_es_mes"
  CHECK ("particion" = date_trunc('month', "particion"::TIMESTAMP)::DATE);
ALTER TABLE "auditoria"."SelloDeBitacora" ADD CONSTRAINT "ck_sello_firma_no_vacia"
  CHECK (length(btrim("raiz")) > 0 AND length(btrim("firma")) > 0 AND length(btrim("kid")) > 0);
