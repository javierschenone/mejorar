/**
 * ADR-017 — el contrato es un artefacto único, aplicado a la feature 002 por
 * `plan.md` §2 y por la obligación de frontera F-11.
 *
 * `specs/contratos/identidad-y-acceso.ts` es la fuente normativa; la copia de
 * este paquete tiene que ser idéntica byte a byte. Este test es el control que
 * corre en la suite local; el pipeline corre además su propia verificación
 * (F-11), que es el mismo control sin depender del runner.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const aquí = dirname(fileURLToPath(import.meta.url));

const RUTA_FUENTE_NORMATIVA = resolve(aquí, '../../../../../specs/contratos/identidad-y-acceso.ts');
const RUTA_COPIA_EN_EL_PAQUETE = resolve(aquí, 'v1.ts');

function huella(ruta: string): string {
  return createHash('sha256').update(readFileSync(ruta)).digest('hex');
}

describe('ADR-017 — el contrato copiado no puede divergir de su fuente normativa', () => {
  it('encuentra la fuente normativa en specs/contratos', () => {
    expect(
      existsSync(RUTA_FUENTE_NORMATIVA),
      `No se encontró la fuente normativa del contrato en ${RUTA_FUENTE_NORMATIVA}. ` +
        'Sin ella no se puede verificar la copia y el control de ADR-017 deja de existir.',
    ).toBe(true);
  });

  it('la copia del paquete es idéntica byte a byte a specs/contratos/identidad-y-acceso.ts', () => {
    const fuente = readFileSync(RUTA_FUENTE_NORMATIVA);
    const copia = readFileSync(RUTA_COPIA_EN_EL_PAQUETE);
    expect(
      copia.equals(fuente),
      [
        'El contrato copiado divergió de su fuente normativa (ADR-017).',
        `  fuente normativa (manda): ${RUTA_FUENTE_NORMATIVA}`,
        `  copia en el paquete:      ${RUTA_COPIA_EN_EL_PAQUETE}`,
        'Sólo el arquitecto modifica la fuente, y el cambio se aprueba en G2.',
      ].join('\n'),
    ).toBe(true);
  });

  it('las dos huellas SHA-256 coinciden', () => {
    expect(huella(RUTA_COPIA_EN_EL_PAQUETE)).toBe(huella(RUTA_FUENTE_NORMATIVA));
  });

  it('falla si el contenido se altera en una sola letra (demostración del control)', () => {
    const fuente = readFileSync(RUTA_FUENTE_NORMATIVA, 'utf8');
    const alterado = `${fuente} `;
    expect(createHash('sha256').update(alterado).digest('hex')).not.toBe(huella(RUTA_FUENTE_NORMATIVA));
  });

  it('el contrato copiado no contiene implementaciones: sólo declaraciones', () => {
    const copia = readFileSync(RUTA_COPIA_EN_EL_PAQUETE, 'utf8');
    // `export function` (sin `declare`) sería una implementación emitida, y la
    // copiabilidad sin consecuencias del contrato depende de que no las haya.
    expect(/^export function /m.test(copia)).toBe(false);
    expect(/^export const /m.test(copia)).toBe(false);
    expect(/^export class /m.test(copia)).toBe(false);
  });

  it('la marca de `Autorizacion` no se exporta: fuera de `autorizar` el tipo es inconstruible (ADR-022 capa 3)', () => {
    const copia = readFileSync(RUTA_COPIA_EN_EL_PAQUETE, 'utf8');
    expect(copia).toContain('declare const marcaAutorizacion: unique symbol;');
    expect(/export\s+declare\s+const\s+marcaAutorizacion/.test(copia)).toBe(false);
  });
});
