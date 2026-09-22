-- ─────────────────────────────────────────────────────────────────────────────
-- Reversión de la migración 0020 — privilegios_y_rls
--
-- Vuelve a dejar las tablas SIN políticas de fila y sin privilegios otorgados.
-- Es la reversión más peligrosa de la feature en el sentido inverso a las
-- demás: no destruye datos, **afloja el aislamiento**. Si se aplica en un
-- entorno con datos, el paso siguiente no es opcional: volver a aplicar la
-- migración o cortar el acceso de los roles.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  t RECORD;
  p RECORD;
  rol TEXT;
BEGIN
  -- Políticas y RLS de `acceso`.
  FOR t IN
    SELECT c.oid, c.relname
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'acceso' AND c.relkind = 'r' AND c.relrowsecurity
  LOOP
    FOR p IN SELECT polname FROM pg_policy WHERE polrelid = t.oid LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON "acceso".%I', p.polname, t.relname);
    END LOOP;
    EXECUTE format('ALTER TABLE "acceso".%I NO FORCE ROW LEVEL SECURITY', t.relname);
    EXECUTE format('ALTER TABLE "acceso".%I DISABLE ROW LEVEL SECURITY', t.relname);
  END LOOP;

  -- Políticas y RLS de la bitácora.
  FOR t IN
    SELECT c.oid, c.relname
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'auditoria' AND c.relkind = 'p' AND c.relrowsecurity
  LOOP
    FOR p IN SELECT polname FROM pg_policy WHERE polrelid = t.oid LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON "auditoria".%I', p.polname, t.relname);
    END LOOP;
    EXECUTE format('ALTER TABLE "auditoria".%I NO FORCE ROW LEVEL SECURITY', t.relname);
    EXECUTE format('ALTER TABLE "auditoria".%I DISABLE ROW LEVEL SECURITY', t.relname);
  END LOOP;

  -- Privilegios.
  FOREACH rol IN ARRAY ARRAY['rol_acceso', 'rol_cliente', 'rol_abogado', 'rol_admin', 'rol_auditoria'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = rol) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA "acceso" FROM %I', rol);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA "acceso" FROM %I', rol);
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA "auditoria" FROM %I', rol);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA "auditoria" FROM %I', rol);
      EXECUTE format('REVOKE USAGE ON SCHEMA "acceso" FROM %I', rol);
      EXECUTE format('REVOKE USAGE ON SCHEMA "auditoria" FROM %I', rol);
    END IF;
  END LOOP;
END
$$;

DROP FUNCTION IF EXISTS "acceso"."es_columna_secreta"(TEXT, TEXT);
