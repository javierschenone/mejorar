-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 0001 — extensiones_y_esquemas
-- Feature 004, tarea T-03. Corresponde a la fila `0001` de
-- specs/004-motor-reglas-legales/modelo-datos.md §6.1.
--
-- Es la primera migración del proyecto. No hay datos previos: bloqueo nulo.
-- Reversión: prisma/migrations/20260921120000_extensiones_y_esquemas/reversion.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- Dos esquemas, no uno. El esquema `identidad` nace vacío y NUNCA lo administra
-- Prisma (no está en `datasource.schemas`): es el único lugar donde vive el
-- vínculo entre un seudónimo y una persona real, con otro rol y otra clave
-- (modelo-datos D-4 y §7.4). Se crea acá para que el borde quede declarado
-- desde la primera migración y nadie ponga una tabla de personas en `motor`.
CREATE SCHEMA IF NOT EXISTS "motor";
CREATE SCHEMA IF NOT EXISTS "identidad";

COMMENT ON SCHEMA "motor" IS
  'Motor de reglas legales (feature 004). Sin datos identificatorios del deudor: sólo identificadores opacos (CA-60, condición C-10).';
COMMENT ON SCHEMA "identidad" IS
  'Vínculo seudónimo <-> persona. Acceso exclusivo del rol rol_identidad. Prisma no lo administra.';

-- `btree_gist` es la que permite mezclar `=` (texto, enum) con `&&` (rango) en
-- una misma restricción de exclusión: es la condición técnica de R-13
-- (vigencias sin solapamiento). `pgcrypto` es para el cifrado en reposo y los
-- hashes de los bloques B y C. Ambas son extensiones "trusted" desde
-- PostgreSQL 13: las puede crear el dueño de la base, no hace falta superusuario.
CREATE EXTENSION IF NOT EXISTS "btree_gist";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Roles del modelo de aislamiento multi-perfil (modelo-datos §7.4). Se crean
-- vacíos y sin capacidad de conexión; los privilegios y las políticas de fila
-- son de la migración 0008, que escribe `cicd` con G6. Si el rol que aplica la
-- migración no tiene permiso para crear roles (caso típico de un entorno
-- gestionado), se avisa y se sigue: los roles se aprovisionan por fuera y la
-- migración no debe fallar por eso.
DO $$
DECLARE
  nombre_rol TEXT;
BEGIN
  FOREACH nombre_rol IN ARRAY ARRAY[
    'rol_motor', 'rol_identidad', 'rol_auditoria',
    'rol_cliente', 'rol_abogado', 'rol_operador', 'rol_admin'
  ] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = nombre_rol) THEN
      BEGIN
        EXECUTE format('CREATE ROLE %I NOLOGIN', nombre_rol);
      EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE 'No se pudo crear el rol %: privilegios insuficientes. Aprovisionarlo fuera de la migración (modelo-datos §7.4).', nombre_rol;
      END;
    END IF;
  END LOOP;
END
$$;
