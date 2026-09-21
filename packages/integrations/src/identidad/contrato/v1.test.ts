import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Verificación de identidad del contrato — ADR-017 punto 3, como test para que
 * también falle en la corrida local y no sólo en el pipeline.
 */

const aquí = dirname(fileURLToPath(import.meta.url));

const RUTA_FUENTE_NORMATIVA = resolve(
  aquí,
  '../../../../../specs/contratos/identidad-y-acceso.ts',
);
const RUTA_COPIA_EN_EL_PAQUETE = resolve(aquí, 'v1.ts');

function huella(ruta: string): string {
  return createHash('sha256').update(readFileSync(ruta)).digest('hex');
}

describe('contrato identidad-y-acceso/v1', () => {
  it('la copia del paquete es idéntica byte a byte a la fuente normativa', () => {
    expect(huella(RUTA_COPIA_EN_EL_PAQUETE)).toBe(huella(RUTA_FUENTE_NORMATIVA));
  });

  it('el contrato copiado no emite código: sólo declaraciones', () => {
    const texto = readFileSync(RUTA_COPIA_EN_EL_PAQUETE, 'utf8');
    const lineasEjecutables = texto
      .split('\n')
      .map((linea) => linea.trim())
      .filter(
        (linea) =>
          /^export (const|let|var|class|enum|function) /.test(linea) ||
          /^(const|let|var|class|enum) /.test(linea),
      );
    expect(lineasEjecutables).toEqual([]);
  });
});
