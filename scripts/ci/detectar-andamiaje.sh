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

# ── Feature 002 — identidad y acceso ─────────────────────────────────────────
# Cada salida habilita un paso del pipeline que hoy no tiene qué verificar.
# Mismo trinquete: en cuanto el árbol aparece, el paso deja de ser opcional.

# Servicio de contraseñas (`ServicioDeContrasenas` del contrato §6, ADR-024).
# El benchmark de `argon2id` mide la implementación real del proyecto, no una
# reimplementación del pipeline: si no hay implementación, no hay medición.
if [ -d packages/integrations/src/identidad ] || [ -d apps/api/src/identidad ]; then
  contrasenas="si"
else
  contrasenas="no"
  echo "::notice::Todavía no hay adaptador de contraseñas (packages/integrations/src/identidad ni apps/api/src/identidad): el benchmark de argon2id no tiene qué medir (T-02 / T-05)."
fi
emitir "contrasenas" "$contrasenas"

# API de identidad levantable: sin ella no hay caminos de no-revelación que
# cronometrar (ADR-025, prueba estadística de temporización).
if [ -d apps/api/src/identidad ]; then
  identidad_api="si"
else
  identidad_api="no"
  echo "::notice::Todavía no existe apps/api/src/identidad: la prueba de temporización de la no-revelación (ADR-025) queda diferida (T-05, T-06)."
fi
emitir "identidad_api" "$identidad_api"

# Base local IP→ubicación de ADR-029. La ruta la fija `dev-integraciones` en
# T-02; acá sólo se detecta el directorio que la contiene.
if [ -d packages/integrations/src/identidad/ubicacion ] && \
   [ -n "$(find packages/integrations/src/identidad/ubicacion -maxdepth 2 -type f -print -quit 2>/dev/null)" ]; then
  base_geo="si"
else
  base_geo="no"
  echo "::notice::Todavía no hay base local de geolocalización en packages/integrations/src/identidad/ubicacion (ADR-029, T-02): la actualización mensual queda preparada y en espera."
fi
emitir "base_geo" "$base_geo"
