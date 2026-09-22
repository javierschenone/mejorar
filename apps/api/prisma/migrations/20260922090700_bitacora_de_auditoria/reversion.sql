-- ─────────────────────────────────────────────────────────────────────────────
-- Reversión de la migración 0018 — bitacora_de_auditoria
--
-- Advertencia con nombre propio: esto BORRA LA BITÁCORA, que es el registro de
-- la licitud del tratamiento y la prueba del titular en un habeas data
-- (constitución #5). En un entorno con datos no se aplica: se corrige hacia
-- adelante. Existe para la vuelta atrás de un despliegue sin datos.
--
-- `DROP TABLE` sobre la tabla particionada arrastra todas las particiones,
-- incluida la de fuera de rango.
-- ─────────────────────────────────────────────────────────────────────────────

DROP TABLE IF EXISTS "auditoria"."SelloDeBitacora" CASCADE;
DROP TABLE IF EXISTS "auditoria"."EventoAuditoria" CASCADE;

DROP FUNCTION IF EXISTS "auditoria"."asegurar_particiones_de_bitacora"(INTEGER);
DROP FUNCTION IF EXISTS "auditoria"."forma_de_datos_valida"(JSONB);
