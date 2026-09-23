import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Configuración de tests de `@mejorar/api` (feature 004, tarea T-03).
 *
 * Acá no hay tests de aplicación: `apps/api/src/` está vacío y la API NestJS la
 * escribe `dev-backend` en la feature 007. Lo único que se prueba hoy es el
 * **esquema de base de datos**: las invariantes que `modelo-datos.md` §7.1
 * declara garantizadas por el motor de base y no por el código.
 *
 * Por eso `include` apunta a `prisma/tests/**` y no a `src/**`, que es la única
 * diferencia con la convención de `packages/shared/vitest.config.ts`.
 *
 * ── Cómo se corre ────────────────────────────────────────────────────────────
 * Estos tests necesitan un PostgreSQL 16 real con `btree_gist`: se prueban
 * `EXCLUDE USING gist`, `daterange`, claves foráneas compuestas e índices
 * parciales, o sea justamente lo que ningún doble en memoria reproduce.
 *
 *   DATABASE_URL_TEST=postgresql://mejorar:mejorar@localhost:5432/postgres \
 *     pnpm --filter @mejorar/api test
 *
 * Sin `DATABASE_URL_TEST` los tests que tocan la base quedan **omitidos** (no
 * fallan): `pnpm -r run test` del pipeline tiene que poder correr en un job sin
 * servicio de base. Los tests que sólo leen los archivos de migración corren
 * siempre, para que la suite nunca quede vacía en verde.
 *
 * Es una variable propia y no `DATABASE_URL` a propósito: estos tests **crean y
 * borran bases de datos**. Reusar la variable del entorno de desarrollo haría
 * que un `pnpm test` distraído apunte a una base con datos.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@mejorar/shared': path.resolve(__dirname, '../../packages/shared/dist'),
    },
  },
  test: {
    environment: 'node',
    include: ['prisma/tests/**/*.test.ts', 'src/**/*.test.ts'],
    reporters: ['default'],
    // Cada archivo crea su propia base descartable. Serializados para no abrir
    // N conexiones simultáneas contra el Postgres chico de un job de CI.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
