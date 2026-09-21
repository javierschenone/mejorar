#!/usr/bin/env node
/**
 * Verificación de identidad del contrato — ADR-017, punto 3.
 *
 * `specs/contratos/identidad-y-acceso.ts` es la fuente normativa; sólo la
 * modifica el `arquitecto` y la aprueba un humano en G2.
 * `packages/integrations/src/identidad/contrato/v1.ts` es una copia exacta.
 *
 * Este script compara el hash SHA-256 del contenido de los dos archivos y sale
 * con código 1 si difieren, nombrando ambos archivos y diciendo cuál manda.
 * El mismo control existe como test en `src/identidad/contrato/v1.test.ts`.
 *
 * Nota para quien lea esto después de que aterrice T-01: cuando
 * `@mejorar/shared` exponga su propia copia del contrato de identidad, esta
 * copia se retira y `src/identidad/contrato/index.ts` reexporta desde el
 * paquete compartido. Ver la nota de ese archivo: hoy hay una sola copia
 * porque `packages/shared/src/identidad/` todavía no existe.
 *
 * No usa dependencias: sólo la biblioteca estándar de Node.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const aquí = dirname(fileURLToPath(import.meta.url));

const RUTA_FUENTE_NORMATIVA = resolve(
  aquí,
  '../../../specs/contratos/identidad-y-acceso.ts',
);
const RUTA_COPIA_EN_EL_PAQUETE = resolve(aquí, '../src/identidad/contrato/v1.ts');

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
      'La fuente normativa es specs/contratos/identidad-y-acceso.ts: sólo la',
      'modifica el arquitecto y se aprueba en G2. Para reparar la divergencia,',
      'volvé a copiar la fuente sobre la copia; si lo que cambió debe cambiar en',
      'el contrato, eso vuelve a compuerta.',
    ].join('\n'),
  );
  process.exit(1);
}

console.log(`Contrato verificado: las dos copias son idénticas (sha256 ${huellaFuente}).`);
