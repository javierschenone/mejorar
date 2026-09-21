-- ─────────────────────────────────────────────────────────────────────────────
-- Reversión de la migración 0001 — extensiones_y_esquemas
--
-- Prisma NO ejecuta este archivo (ADR-007 §3: no hay migraciones de reversión
-- automáticas). Está versionado para que la vuelta atrás sea una decisión
-- escrita y revisada, no una improvisación en una consola de producción, y para
-- que la reversibilidad exigida por modelo-datos §6.2 sea verificable: el test
-- `prisma/tests/migracion.test.ts` aplica las migraciones y después estos
-- archivos, y comprueba que la base vuelva a quedar como estaba.
--
-- Sólo es segura mientras los esquemas estén vacíos. Con datos adentro, la
-- vuelta atrás se escribe como una migración nueva (ADR-007 §3).
-- ─────────────────────────────────────────────────────────────────────────────

DROP SCHEMA IF EXISTS "identidad" RESTRICT;
DROP SCHEMA IF EXISTS "motor" RESTRICT;

-- Las extensiones y los roles NO se eliminan: son recursos de la base y del
-- clúster que pueden estar en uso por otra cosa. Quitarlos es una decisión
-- aparte y explícita.
