import { defineConfig } from 'vitest/config';

/**
 * Configuración de tests de `@mejorar/shared` (ADR-008 §3).
 *
 * Entorno `node`, sin dobles de ningún tipo: el dominio es puro y no hay reloj
 * que congelar — la fecha entra siempre por parámetro (ADR-016, CA-31).
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/motor-legal/contrato/v1.ts'],
    },
  },
});
