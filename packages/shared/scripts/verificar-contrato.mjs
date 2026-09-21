#!/usr/bin/env node
/**
 * Verificación de identidad del contrato — ADR-017, punto 3.
 *
 * `specs/contratos/motor-reglas-legales.ts` es la fuente normativa; sólo la
 * modifica el `arquitecto` y la aprueba un humano en G2.
 * `packages/shared/src/motor-legal/contrato/v1.ts` es una copia exacta.
 *
 * Este script compara el hash SHA-256 del contenido de los dos archivos y sale
 * con código 1 si difieren, nombrando ambos archivos y diciendo cuál manda.
 * Lo ejecuta el pipeline (`pnpm --filter @mejorar/shared verificar:contrato`);
 * el mismo control existe como test en `src/motor-legal/contrato/v1.test.ts`,
 * para que también falle en la corrida local de `pnpm test`.
 *
 * No usa dependencias: sólo la biblioteca estándar de Node. Es una herramienta
 * de construcción, no código del dominio — el dominio no lee el disco.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const aquí = dirname(fileURLToPath(import.meta.url));

const RUTA_FUENTE_NORMATIVA = resolve(
  aquí,
  '../../../specs/contratos/motor-reglas-legales.ts',
);
const RUTA_COPIA_EN_EL_PAQUETE = resolve(
  aquí,
  '../src/motor-legal/contrato/v1.ts',
);

function huella(ruta) {
  return createHash('sha256').update(readFileSync(ruta)).digest('hex');
}

const huellaFuente = huella(RUTA_FUENTE_NORMATIVA);
const huellaCopia = huella(RUTA_COPIA_EN_EL_PAQUETE);

if (huellaFuente !== huellaCopia) {
  console.error(
    [
      'El contrato copiado divergió de su fuente normativa (ADR-017).',
      '',
      `  fuente normativa (manda): ${RUTA_FUENTE_NORMATIVA}`,
      `    sha256: ${huellaFuente}`,
      `  copia en el paquete:      ${RUTA_COPIA_EN_EL_PAQUETE}`,
      `    sha256: ${huellaCopia}`,
      '',
      'La fuente normativa es specs/contratos/motor-reglas-legales.ts: sólo la',
      'modifica el arquitecto y se aprueba en G2. Para reparar la divergencia,',
      'volvé a copiar la fuente sobre la copia; si lo que cambió debe cambiar en',
      'el contrato, eso vuelve a compuerta.',
    ].join('\n'),
  );
  process.exit(1);
}

console.log(`Contrato verificado: las dos copias son idénticas (sha256 ${huellaFuente}).`);
