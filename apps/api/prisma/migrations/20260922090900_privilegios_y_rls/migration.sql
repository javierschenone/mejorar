-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 0020 — privilegios_y_rls
-- Feature 002, tarea T-03. Fila `0020` de modelo-datos.md §6.2.
-- Implementa §7.4 (aislamiento multi-perfil, regla 7 del mandato) y §4.4 (lo
-- que no se exporta).
--
-- Regla 7 del mandato: la restricción de alcance se expresa EN EL MODELO, no
-- sólo en el código. Acá eso significa tres cosas distintas:
--
--   1. `GRANT`/`REVOKE` a nivel de TABLA: quién puede tocar qué tabla.
--   2. `GRANT` a nivel de COLUMNA: §4.4. Ningún rol salvo el de la aplicación
--      puede leer `hashContrasena`, el secreto TOTP, los códigos de respaldo ni
--      los hashes de token. Una exportación mal diseñada es una fuga con forma
--      de derecho, y conviene que falle en dos capas.
--   3. `ROW LEVEL SECURITY` con `FORCE`: cada quien ve lo suyo. `FORCE` es lo
--      que impide que el DUEÑO de la tabla se saltee las políticas.
--
-- La identidad del sujeto entra por `current_setting('app.id_usuario')`, que
-- fija la capa de aplicación al abrir la transacción. Se lee con el segundo
-- argumento en `true` (missing_ok): si nadie la fijó, la comparación da NULL y
-- la política NO DEJA VER NADA. El modo por defecto es negar.
--
-- **Un superusuario de PostgreSQL ignora RLS siempre**, con `FORCE` o sin él.
-- Eso no es un agujero de este diseño: es una propiedad del motor, y la
-- consecuencia operativa —la aplicación nunca se conecta como superusuario— es
-- de `cicd` en G6.
--
-- Reversión: reversion.sql de este mismo directorio.
-- ─────────────────────────────────────────────────────────────────────────────

-- ═════════════════════════════════════════════════════════════════════════════
-- 1. Uso de los esquemas
-- ═════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  rol TEXT;
BEGIN
  FOREACH rol IN ARRAY ARRAY['rol_acceso', 'rol_cliente', 'rol_abogado', 'rol_admin', 'rol_auditoria'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = rol) THEN
      EXECUTE format('GRANT USAGE ON SCHEMA "acceso" TO %I', rol);
      EXECUTE format('GRANT USAGE ON SCHEMA "auditoria" TO %I', rol);
    ELSE
      RAISE NOTICE 'El rol % no existe; sus privilegios se aprovisionan fuera de la migración.', rol;
    END IF;
  END LOOP;
END
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- 2. §4.4 — lo que no se exporta, a nivel de columna
--
-- Se hace concediendo columna por columna y NO con un `REVOKE` posterior a un
-- `GRANT` de tabla: en PostgreSQL un privilegio de tabla no se puede "restar"
-- por columna, y hacerlo al revés dejaría el agujero abierto sin que se note.
-- El `GRANT SELECT` de tabla se otorga ÚNICAMENTE a `rol_acceso`.
-- ═════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION "acceso"."es_columna_secreta"("tabla" TEXT, "columna" TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ("tabla", "columna") IN (
    ('Usuario',           'hashContrasena'),
    ('SecretoTotp',       'secretoCifrado'),
    ('SecretoTotp',       'secretoNonce'),
    ('SecretoTotp',       'secretoTag'),
    ('CodigoDeRespaldo',  'hashDelCodigo'),
    ('TokenDeRefresco',   'hashDelSecreto'),
    ('EnlaceDeUnSoloUso', 'hashDelSecreto')
  );
$$;

COMMENT ON FUNCTION "acceso"."es_columna_secreta"(TEXT, TEXT) IS
  'Inventario de §4.4: las columnas que NINGUN rol salvo rol_acceso puede leer. Es una funcion y no una lista suelta para que el test la pueda consultar y para que agregar una columna secreta sea un solo cambio. Los nonce/tag del secreto TOTP se suman al inventario del documento: por si solos no descifran nada, pero tampoco le sirven a nadie que no sea el verificador del segundo factor, y dejarlos legibles seria regalar la mitad del problema.';

-- ═════════════════════════════════════════════════════════════════════════════
-- 3. Privilegios por rol
--
-- `rol_acceso` es la aplicación: acceso completo a las tablas de la feature,
-- sujeto a las políticas de fila. Nada sobre `identidad` ni sobre `motor` más
-- allá del `GRANT SELECT` puntual de `motor.DiaNoHabil` que otorga la 0011.
-- ═════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  t RECORD;
  cols TEXT;
  -- Tablas que `rol_admin` puede LEER (metadatos de gestión de cuentas).
  admin_lee TEXT[] := ARRAY[
    'Usuario', 'PerfilProfesional', 'EspecialidadDeclarada', 'AjustePermiso',
    'ResolucionDeDuplicado', 'DecisionDeVerificacion', 'SuspensionDeMatricula',
    'HitoDeVigenciaNotificado', 'EscalamientoDeVerificacion',
    'DesignacionDeAdministrador', 'SolicitudDeRestitucionMfa',
    'VersionDocumentoAceptable', 'VersionInformacionArt6',
    'CampoDeclaradoEnElAlta', 'ReglaDeRetencion', 'EjecucionDePurga',
    'ParametroDeAcceso'
  ];
  -- Y las que puede ESCRIBIR. El administrador gestiona cuentas: verifica
  -- matrículas, suspende y designa. No toca credenciales ni sesiones.
  admin_escribe TEXT[] := ARRAY[
    'DecisionDeVerificacion', 'SuspensionDeMatricula', 'DesignacionDeAdministrador'
  ];
  -- Tablas del titular, con la columna que dice de quién es la fila. Es la
  -- tabla de verdad de las políticas de §7.4: agregar una tabla con dueño y
  -- olvidarse de ponerla acá la deja sin política, y el test lo detecta.
  propias TEXT[][] := ARRAY[
    ['Usuario',                   'id'],
    ['PerfilProfesional',         'usuarioId'],
    ['EspecialidadDeclarada',     'usuarioId'],
    ['AjustePermiso',             'usuarioId'],
    ['AceptacionRegistrada',      'usuarioId'],
    ['DecisionDeVerificacion',    'perfilUsuarioId'],
    ['SuspensionDeMatricula',     'perfilUsuarioId'],
    ['HitoDeVigenciaNotificado',  'perfilUsuarioId'],
    ['EscalamientoDeVerificacion','perfilUsuarioId'],
    ['Sesion',                    'usuarioId'],
    ['FamiliaDeRefresco',         'usuarioId'],
    ['EnlaceDeUnSoloUso',         'usuarioId'],
    ['SecretoTotp',               'usuarioId'],
    ['CodigoDeRespaldo',          'usuarioId'],
    ['SolicitudDeRestitucionMfa', 'titularId'],
    ['DesignacionDeAdministrador','usuarioId']
  ];
  i INTEGER;
  tabla TEXT;
  duenio TEXT;
  hay_acceso BOOLEAN := EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rol_acceso');
  hay_cliente BOOLEAN := EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rol_cliente');
  hay_abogado BOOLEAN := EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rol_abogado');
  hay_admin BOOLEAN := EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rol_admin');
  hay_audit BOOLEAN := EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rol_auditoria');
BEGIN
  -- 3.1 `rol_acceso`: todo, sujeto a políticas.
  IF hay_acceso THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "acceso" TO rol_acceso';
    EXECUTE 'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA "acceso" TO rol_acceso';
    -- Sobre la bitácora: INSERT y SELECT, nunca UPDATE ni DELETE (R-002-12).
    EXECUTE 'GRANT SELECT, INSERT ON "auditoria"."EventoAuditoria" TO rol_acceso';
    EXECUTE 'GRANT SELECT, INSERT ON "auditoria"."SelloDeBitacora" TO rol_acceso';
    EXECUTE 'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA "auditoria" TO rol_acceso';
  END IF;

  -- 3.2 Lectura de los demás roles, COLUMNA POR COLUMNA, salteando las
  -- secretas de §4.4.
  FOR t IN
    SELECT c.relname AS tabla
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'acceso' AND c.relkind = 'r'
     ORDER BY 1
  LOOP
    SELECT string_agg(format('%I', a.attname), ', ' ORDER BY a.attnum) INTO cols
      FROM pg_attribute a
     WHERE a.attrelid = format('%I.%I', 'acceso', t.tabla)::regclass
       AND a.attnum > 0 AND NOT a.attisdropped
       AND NOT "acceso"."es_columna_secreta"(t.tabla, a.attname);

    IF hay_admin AND t.tabla = ANY (admin_lee) THEN
      EXECUTE format('GRANT SELECT (%s) ON "acceso".%I TO rol_admin', cols, t.tabla);
    END IF;
    IF hay_admin AND t.tabla = ANY (admin_escribe) THEN
      EXECUTE format('GRANT INSERT, UPDATE ON "acceso".%I TO rol_admin', t.tabla);
    END IF;
    IF hay_audit THEN
      EXECUTE format('GRANT SELECT (%s) ON "acceso".%I TO rol_auditoria', cols, t.tabla);
    END IF;
    IF hay_cliente THEN
      EXECUTE format('GRANT SELECT (%s) ON "acceso".%I TO rol_cliente', cols, t.tabla);
    END IF;
    IF hay_abogado THEN
      EXECUTE format('GRANT SELECT (%s) ON "acceso".%I TO rol_abogado', cols, t.tabla);
    END IF;
  END LOOP;

  -- El cliente no tiene nada que hacer en el back-office profesional ni en la
  -- nómina de administradores: se le quita el `SELECT` que el bucle otorgó de
  -- forma uniforme. Es más seguro conceder de más y recortar acá, en un solo
  -- lugar visible, que mantener dos listas que se desincronizan.
  IF hay_cliente THEN
    EXECUTE 'REVOKE ALL ON "acceso"."PerfilProfesional" FROM rol_cliente';
    EXECUTE 'REVOKE ALL ON "acceso"."EspecialidadDeclarada" FROM rol_cliente';
    EXECUTE 'REVOKE ALL ON "acceso"."DecisionDeVerificacion" FROM rol_cliente';
    EXECUTE 'REVOKE ALL ON "acceso"."SuspensionDeMatricula" FROM rol_cliente';
    EXECUTE 'REVOKE ALL ON "acceso"."HitoDeVigenciaNotificado" FROM rol_cliente';
    EXECUTE 'REVOKE ALL ON "acceso"."EscalamientoDeVerificacion" FROM rol_cliente';
    EXECUTE 'REVOKE ALL ON "acceso"."DesignacionDeAdministrador" FROM rol_cliente';
  END IF;
  -- El abogado ve su propio perfil y su propia verificación, pero tampoco ve
  -- quiénes son los administradores.
  IF hay_abogado THEN
    EXECUTE 'REVOKE ALL ON "acceso"."DesignacionDeAdministrador" FROM rol_abogado';
  END IF;

  -- 3.3 La bitácora: `rol_auditoria` lee todo y no escribe en ningún lado.
  IF hay_audit THEN
    EXECUTE 'GRANT SELECT ON "auditoria"."EventoAuditoria" TO rol_auditoria';
    EXECUTE 'GRANT SELECT ON "auditoria"."SelloDeBitacora" TO rol_auditoria';
  END IF;
  IF hay_admin THEN
    EXECUTE 'GRANT SELECT ON "auditoria"."EventoAuditoria" TO rol_admin';
  END IF;
  -- CA-21 y CA-25: el titular lee SU bitácora. La política de fila de abajo es
  -- la que la acota a lo propio.
  IF hay_cliente THEN
    EXECUTE 'GRANT SELECT ON "auditoria"."EventoAuditoria" TO rol_cliente';
  END IF;
  IF hay_abogado THEN
    EXECUTE 'GRANT SELECT ON "auditoria"."EventoAuditoria" TO rol_abogado';
  END IF;

  -- 3.4 Políticas de fila. `FORCE` para que el dueño tampoco se las saltee.
  FOR i IN 1..array_length(propias, 1) LOOP
    tabla := propias[i][1];
    duenio := propias[i][2];

    -- `FORCE` tiene una consecuencia operativa que hay que decir: el DUEÑO de
    -- la tabla tampoco ve filas, porque no tiene política. Es justamente el
    -- efecto buscado, y es viable porque nada de lo que corre como dueño
    -- necesita leer datos de titulares: las migraciones hacen DDL, y los
    -- catálogos sembrados por la 0023 están en tablas SIN RLS. La aplicación se
    -- conecta como `rol_acceso`, nunca como dueño ni como superusuario — eso es
    -- de `cicd` en G6.
    EXECUTE format('ALTER TABLE "acceso".%I ENABLE ROW LEVEL SECURITY', tabla);
    EXECUTE format('ALTER TABLE "acceso".%I FORCE ROW LEVEL SECURITY', tabla);

    -- La aplicación: acceso completo. El alcance fino lo decide el servicio de
    -- autorización con el perfil derivado; acá la base sólo garantiza que
    -- ningún OTRO rol vea de más.
    IF hay_acceso THEN
      EXECUTE format(
        'CREATE POLICY %I ON "acceso".%I FOR ALL TO rol_acceso USING (true) WITH CHECK (true)',
        'pol_' || tabla || '_aplicacion', tabla);
    END IF;

    -- El titular: sólo lo suyo. Sin `app.id_usuario` fijada, la comparación da
    -- NULL y no se ve NADA. Negar es el modo por defecto.
    IF hay_cliente OR hay_abogado THEN
      EXECUTE format(
        'CREATE POLICY %I ON "acceso".%I FOR ALL TO %s USING (%I = current_setting(''app.id_usuario'', true)) WITH CHECK (%I = current_setting(''app.id_usuario'', true))',
        'pol_' || tabla || '_propio', tabla,
        concat_ws(', ',
          CASE WHEN hay_cliente THEN 'rol_cliente' END,
          CASE WHEN hay_abogado THEN 'rol_abogado' END),
        duenio, duenio);
    END IF;

    -- El administrador y la auditoría: alcance total sobre las tablas a las que
    -- tienen `GRANT`. Su límite es el privilegio de columna de §4.4, no la fila:
    -- el administrador gestiona cuentas ajenas, para eso está.
    IF hay_admin THEN
      EXECUTE format(
        'CREATE POLICY %I ON "acceso".%I FOR ALL TO rol_admin USING (true) WITH CHECK (true)',
        'pol_' || tabla || '_admin', tabla);
    END IF;
    IF hay_audit THEN
      EXECUTE format(
        'CREATE POLICY %I ON "acceso".%I FOR SELECT TO rol_auditoria USING (true)',
        'pol_' || tabla || '_auditoria', tabla);
    END IF;
  END LOOP;
END
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- 4. La bitácora: alcance propio para el titular (CA-21, Q-12, Q-13)
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE "auditoria"."EventoAuditoria" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "auditoria"."EventoAuditoria" FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rol_acceso') THEN
    CREATE POLICY "pol_evento_aplicacion" ON "auditoria"."EventoAuditoria"
      FOR ALL TO rol_acceso USING (true) WITH CHECK (true);
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rol_auditoria') THEN
    CREATE POLICY "pol_evento_auditoria" ON "auditoria"."EventoAuditoria"
      FOR SELECT TO rol_auditoria USING (true);
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rol_admin') THEN
    CREATE POLICY "pol_evento_admin" ON "auditoria"."EventoAuditoria"
      FOR SELECT TO rol_admin USING (true);
  END IF;
  -- "Quién miró mi información" y "mi actividad reciente": el titular ve los
  -- eventos en los que él es el sujeto o el titular afectado. Nada más.
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rol_cliente') THEN
    CREATE POLICY "pol_evento_propio_cliente" ON "auditoria"."EventoAuditoria"
      FOR SELECT TO rol_cliente
      USING ("sujeto" = current_setting('app.id_usuario', true)
          OR "titularAfectado" = current_setting('app.id_usuario', true));
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rol_abogado') THEN
    CREATE POLICY "pol_evento_propio_abogado" ON "auditoria"."EventoAuditoria"
      FOR SELECT TO rol_abogado
      USING ("sujeto" = current_setting('app.id_usuario', true)
          OR "titularAfectado" = current_setting('app.id_usuario', true));
  END IF;
END
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- 5. R-002-12 — la bitácora no se modifica ni se borra
--
-- El `REVOKE` es la primera capa. La segunda es el disparador de la 0021, que
-- lanza excepción aunque el privilegio estuviera mal otorgado. La tercera es el
-- sello de Merkle de G.2, que es la única que sigue sirviendo contra alguien
-- con acceso de escritura directo a la base.
-- ═════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  rol TEXT;
BEGIN
  FOREACH rol IN ARRAY ARRAY['rol_acceso', 'rol_cliente', 'rol_abogado', 'rol_admin', 'rol_auditoria'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = rol) THEN
      EXECUTE format('REVOKE UPDATE, DELETE, TRUNCATE ON "auditoria"."EventoAuditoria" FROM %I', rol);
      EXECUTE format('REVOKE UPDATE, DELETE, TRUNCATE ON "auditoria"."SelloDeBitacora" FROM %I', rol);
      -- Las demás tablas de sólo inserción (§7.2): B.1, B.2, B.3, C.1, C.3,
      -- D.5, H.2. C.1 admite `UPDATE` sólo para `rol_acceso`, y ni eso: la
      -- proyección de A.3 la escribe el disparador, que corre como dueño.
      EXECUTE format('REVOKE UPDATE, DELETE ON "acceso"."VersionDocumentoAceptable" FROM %I', rol);
      EXECUTE format('REVOKE UPDATE, DELETE ON "acceso"."VersionInformacionArt6" FROM %I', rol);
      EXECUTE format('REVOKE UPDATE, DELETE ON "acceso"."CampoDeclaradoEnElAlta" FROM %I', rol);
      EXECUTE format('REVOKE UPDATE, DELETE ON "acceso"."DecisionDeVerificacion" FROM %I', rol);
      EXECUTE format('REVOKE UPDATE, DELETE ON "acceso"."HitoDeVigenciaNotificado" FROM %I', rol);
      EXECUTE format('REVOKE UPDATE, DELETE ON "acceso"."IntentoDeAutenticacion" FROM %I', rol);
      EXECUTE format('REVOKE UPDATE, DELETE ON "acceso"."EjecucionDePurga" FROM %I', rol);
    END IF;
  END LOOP;
END
$$;
