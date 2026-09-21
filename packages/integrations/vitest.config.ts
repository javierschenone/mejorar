import { defineConfig } from 'vitest/config';

/**
 * Configuración de tests de `@mejorar/integrations` (ADR-008 §3).
 *
 * Entorno `node`. **Ningún test sale a la red**: los adaptadores locales no
 * tienen red por diseño (ADR-029) y el único adaptador que la usa —Sendgrid—
 * se prueba contra un `fetch` inyectado, nunca contra el real. Tampoco se lee
 * ninguna variable de entorno de credenciales: la suite corre con
 * `INTEGRACIONES_MODO=mock` y sin una sola clave definida (criterio heredado
 * de la 001, CA-01 y CA-11).
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/identidad/contrato/v1.ts'],
    },
  },
});
