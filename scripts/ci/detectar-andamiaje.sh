#!/usr/bin/env bash
#
# Detecta qué partes del workspace ya existen, para que el pipeline sea útil
# desde el primer día sin quedar rojo por lo que todavía no se escribió.
#
# La regla es un trinquete, no una excusa: en cuanto aparece el archivo de
# bloqueo de dependencias (`pnpm-lock.yaml`), el workspace es instalable y los
# pasos de calidad dejan de ser opcionales. Nada se "saltea" en silencio: cada
# salto se reporta como advertencia visible en el job.
#
# Escribe sus salidas en $GITHUB_OUTPUT cuando corre en GitHub Actions y en la
# salida estándar siempre.

set -euo pipefail

emitir() {
  echo "$1=$2"
  if [ -n "${GITHUB_OUTPUT:-}" ]; then
    echo "$1=$2" >> "$GITHUB_OUTPUT"
  fi
}

if [ -f pnpm-lock.yaml ]; then
  instalable="si"
else
  instalable="no"
  echo "::warning::No hay pnpm-lock.yaml: el workspace todavía no es instalable. Lint, typecheck, tests y build quedan diferidos hasta que exista el andamiaje (feature 001)."
fi
emitir "instalable" "$instalable"

if [ -d packages/shared/src/motor-legal ]; then
  motor="si"
else
  motor="no"
  echo "::notice::Todavía no existe packages/shared/src/motor-legal: el benchmark del motor no tiene qué medir."
fi
emitir "motor" "$motor"
