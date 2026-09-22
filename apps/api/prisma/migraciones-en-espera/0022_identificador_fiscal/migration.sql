-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 0022 — identificador_fiscal
-- Feature 002, tarea T-03. Fila `0022` de modelo-datos.md §6.2.
-- A.2 `acceso.IdentificadorFiscal`.
--
-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  ESTA MIGRACIÓN NO SE EJECUTA.                                            ║
-- ║                                                                           ║
-- ║  Vive fuera de `prisma/migrations` a propósito: Prisma no la ve y         ║
-- ║  `prisma migrate deploy` no la aplica. Bloqueada por el escalamiento      ║
-- ║  E-002-1.                                                                 ║
-- ║                                                                           ║
-- ║  La condición C-002-04(a) del dictamen exige DECLARAR LA FINALIDAD del    ║
-- ║  CUIT/CUIL o diferir el dato. La spec v3 cerró la parte (b) —la           ║
-- ║  no-revelación— y NO cerró la (a): el defecto D-002-01 sigue abierto.     ║
-- ║  Sin finalidad declarada no hay base legal que evaluar (dictamen §2.2.a). ║
-- ║                                                                           ║
-- ║  Ver `prisma/migraciones-en-espera/LEEME.md` para el procedimiento de     ║
-- ║  desbloqueo, que tiene tres pasos y no es "copiar el directorio".         ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
--
-- La tabla está SEPARADA de `Usuario` a propósito: si el product owner decide
-- diferir el dato a la feature que lo necesita (007), diferirlo es `DROP TABLE`
-- y no cirugía sobre la tabla de cuentas. Ninguna otra tabla la referencia, así
-- que su ausencia hoy no rompe nada.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "acceso"."IdentificadorFiscal" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "indiceCiegoCuit" BYTEA NOT NULL,
    "valorCifrado" BYTEA NOT NULL,
    "valorNonce" BYTEA NOT NULL,
    "valorTag" BYTEA NOT NULL,
    "valorIdClave" TEXT NOT NULL,
    "digitoVerificadorValidado" BOOLEAN NOT NULL,
    "declaradoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reemplazaA" TEXT,
    "vigente" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdentificadorFiscal_pkey" PRIMARY KEY ("id")
);

COMMENT ON TABLE "acceso"."IdentificadorFiscal" IS
  'A.2 — CUIT/CUIL declarado. CONDICIONADA: escalamiento E-002-1. Solo insercion salvo vigente; el valor nunca se edita, se reemplaza con linaje (reemplazaA), lo que deja la rectificacion del art. 16 posible sin implementarla (E-002-8). Retencion: la de la cuenta.';

COMMENT ON COLUMN "acceso"."IdentificadorFiscal"."id" IS 'INT — identificador opaco.';
COMMENT ON COLUMN "acceso"."IdentificadorFiscal"."usuarioId" IS 'PERS — titular del identificador fiscal.';
COMMENT ON COLUMN "acceso"."IdentificadorFiscal"."indiceCiegoCuit" IS 'INT — HMAC con dominio CUIT_CUIL. Indice NO unico: ver la invariante 2.';
COMMENT ON COLUMN "acceso"."IdentificadorFiscal"."valorCifrado" IS 'PERS↑ — AES-256-GCM, k_acceso, AAD = usuarioId.';
COMMENT ON COLUMN "acceso"."IdentificadorFiscal"."valorNonce" IS 'INT — nonce del cifrado.';
COMMENT ON COLUMN "acceso"."IdentificadorFiscal"."valorTag" IS 'INT — etiqueta GCM.';
COMMENT ON COLUMN "acceso"."IdentificadorFiscal"."valorIdClave" IS 'INT — identificador de la clave usada.';
COMMENT ON COLUMN "acceso"."IdentificadorFiscal"."digitoVerificadorValidado" IS 'INT — CA-04. CHECK: no se persiste un CUIT/CUIL que no paso verificarDigitoVerificadorCuit.';
COMMENT ON COLUMN "acceso"."IdentificadorFiscal"."declaradoEn" IS 'INT — cuando se declaro.';
COMMENT ON COLUMN "acceso"."IdentificadorFiscal"."reemplazaA" IS 'INT — linaje de rectificacion. Un CUIL mal cargado no se edita: se reemplaza.';
COMMENT ON COLUMN "acceso"."IdentificadorFiscal"."vigente" IS 'INT — unico vigente por titular.';
COMMENT ON COLUMN "acceso"."IdentificadorFiscal"."creadoEn" IS 'INT — alta de la fila.';

ALTER TABLE "acceso"."IdentificadorFiscal" ADD CONSTRAINT "ck_fiscal_digito_validado"
  CHECK ("digitoVerificadorValidado");
ALTER TABLE "acceso"."IdentificadorFiscal" ADD CONSTRAINT "ck_fiscal_no_se_reemplaza_a_si_mismo"
  CHECK ("reemplazaA" IS NULL OR "reemplazaA" <> "id");

-- Q-02 (CA-04): detectar CUIT/CUIL ya registrado, FUERA del camino de
-- respuesta. **NO es único, y es deliberado.**
--
-- **R-002-17.** Un `UNIQUE` haría fallar el segundo alta, y ese fallo ES el
-- oráculo de enumeración por CUIL que el dictamen §2.2(c) identifica como
-- defecto D-002-02. CA-04 exige lo contrario: la segunda alta se crea
-- `NO_VERIFICADA` como cualquier otra y el duplicado se resuelve por el canal
-- del titular real (A.6 `ResolucionDeDuplicado`). Un índice no único sirve la
-- detección asincrónica.
--
-- **Es una restricción que se omite por exigencia normativa, y queda escrito
-- para que nadie la "arregle" en un G4 futuro.**
CREATE INDEX "idx_fiscal_indice"
  ON "acceso"."IdentificadorFiscal" ("indiceCiegoCuit")
  WHERE "vigente";

CREATE UNIQUE INDEX "uq_fiscal_vigente_por_titular"
  ON "acceso"."IdentificadorFiscal" ("usuarioId")
  WHERE "vigente";

CREATE INDEX "idx_fiscal_usuario" ON "acceso"."IdentificadorFiscal" ("usuarioId");
CREATE UNIQUE INDEX "uq_fiscal_reemplaza" ON "acceso"."IdentificadorFiscal" ("reemplazaA");

ALTER TABLE "acceso"."IdentificadorFiscal" ADD CONSTRAINT "IdentificadorFiscal_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "acceso"."Usuario"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "acceso"."IdentificadorFiscal" ADD CONSTRAINT "IdentificadorFiscal_reemplazaA_fkey"
  FOREIGN KEY ("reemplazaA") REFERENCES "acceso"."IdentificadorFiscal"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Sólo inserción salvo `vigente` (§7.2). Reusa la función de la 0021.
CREATE TRIGGER "tg_fiscal_mutabilidad"
  BEFORE UPDATE ON "acceso"."IdentificadorFiscal"
  FOR EACH ROW EXECUTE FUNCTION "acceso"."solo_mutan_las_columnas_declaradas"('vigente');

-- Aislamiento, igual que el resto de las tablas del titular (§7.4).
ALTER TABLE "acceso"."IdentificadorFiscal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "acceso"."IdentificadorFiscal" FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rol_acceso') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON "acceso"."IdentificadorFiscal" TO rol_acceso';
    CREATE POLICY "pol_IdentificadorFiscal_aplicacion" ON "acceso"."IdentificadorFiscal"
      FOR ALL TO rol_acceso USING (true) WITH CHECK (true);
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rol_cliente') THEN
    EXECUTE 'GRANT SELECT ("id", "usuarioId", "indiceCiegoCuit", "digitoVerificadorValidado", "declaradoEn", "reemplazaA", "vigente", "creadoEn") ON "acceso"."IdentificadorFiscal" TO rol_cliente';
    CREATE POLICY "pol_IdentificadorFiscal_propio" ON "acceso"."IdentificadorFiscal"
      FOR ALL TO rol_cliente
      USING ("usuarioId" = current_setting('app.id_usuario', true))
      WITH CHECK ("usuarioId" = current_setting('app.id_usuario', true));
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rol_auditoria') THEN
    EXECUTE 'GRANT SELECT ("id", "usuarioId", "indiceCiegoCuit", "digitoVerificadorValidado", "declaradoEn", "reemplazaA", "vigente", "creadoEn") ON "acceso"."IdentificadorFiscal" TO rol_auditoria';
    CREATE POLICY "pol_IdentificadorFiscal_auditoria" ON "acceso"."IdentificadorFiscal"
      FOR SELECT TO rol_auditoria USING (true);
  END IF;
END
$$;
