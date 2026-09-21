#!/usr/bin/env bash
#
# Verificación de identidad del contrato — ADR-017.
#
# `specs/contratos/<contrato>.ts` es la fuente normativa: es lo que el humano
# aprueba en G2 y sólo lo modifica el `arquitecto`.
# `packages/shared/src/motor-legal/contrato/<version>.ts` es una copia exacta,
# byte a byte, que mantiene `dev-dominio`.
#
# Este script falla la construcción si divergen. Sin él, la copia deriva y el
# contrato aprobado deja de significar algo (ADR-017, "cómo se revierte";
# riesgo R-05 del plan de la feature 004).
#
# Uso: ./scripts/ci/verificar-identidad-contrato.sh   (desde la raíz del repo)

set -euo pipefail

# Pares "fuente normativa|copia en el paquete".
# Cuando exista v2 (ADR-017 punto 6) se agrega una línea más; los dos archivos
# conviven mientras haya consumidores.
PARES=(
  "specs/contratos/motor-reglas-legales.ts|packages/shared/src/motor-legal/contrato/v1.ts"
)

# Mientras este directorio no exista, la copia todavía no fue escrita (T-01 en
# curso) y la verificación queda pendiente en vez de fallar. En cuanto el
# directorio del motor existe, la copia es obligatoria.
DIR_MOTOR="packages/shared/src/motor-legal"

huella() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | cut -d' ' -f1
  else
    shasum -a 256 "$1" | cut -d' ' -f1
  fi
}

resumen() {
  # Deja constancia en el resumen del job cuando corre en GitHub Actions.
  if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
    echo "$1" >> "$GITHUB_STEP_SUMMARY"
  fi
}

fallas=0
pendientes=0

resumen "## Identidad del contrato (ADR-017)"
resumen ""
resumen "| Fuente normativa | Copia en el paquete | Estado |"
resumen "| --- | --- | --- |"

for par in "${PARES[@]}"; do
  fuente="${par%%|*}"
  copia="${par##*|}"

  if [ ! -f "$fuente" ]; then
    echo "::error file=${fuente}::No existe la fuente normativa del contrato. Es el archivo que aprueba el humano en G2 y no puede faltar."
    resumen "| \`${fuente}\` | \`${copia}\` | FALTA LA FUENTE |"
    fallas=$((fallas + 1))
    continue
  fi

  if [ ! -f "$copia" ]; then
    if [ -d "$DIR_MOTOR" ]; then
      echo "::error file=${copia}::Falta la copia del contrato. El motor ya existe en ${DIR_MOTOR}, así que la copia byte a byte de ${fuente} es obligatoria (ADR-017 punto 2)."
      resumen "| \`${fuente}\` | \`${copia}\` | FALTA LA COPIA |"
      fallas=$((fallas + 1))
    else
      echo "::notice::Todavía no existe ${DIR_MOTOR}: la copia del contrato está pendiente (T-01). Verificación diferida."
      resumen "| \`${fuente}\` | \`${copia}\` | pendiente — el motor todavía no existe |"
      pendientes=$((pendientes + 1))
    fi
    continue
  fi

  if cmp -s "$fuente" "$copia"; then
    echo "OK  ${copia} es idéntico a ${fuente}  (sha256 $(huella "$fuente"))"
    resumen "| \`${fuente}\` | \`${copia}\` | idéntico — \`$(huella "$fuente" | cut -c1-12)\` |"
  else
    fallas=$((fallas + 1))
    resumen "| \`${fuente}\` | \`${copia}\` | **DIVERGEN** |"
    {
      echo "::error file=${copia}::El contrato implementado difiere del contrato aprobado."
      echo ""
      echo "  Fuente normativa : ${fuente}   sha256 $(huella "$fuente")"
      echo "  Copia            : ${copia}   sha256 $(huella "$copia")"
      echo ""
      echo "  MANDA LA FUENTE: ${fuente}."
      echo "  Si el cambio es correcto, lo escribe el 'arquitecto' en specs/contratos/,"
      echo "  pasa por compuerta, y 'dev-dominio' vuelve a copiar el archivo en el mismo PR."
      echo "  Nunca al revés: editar la copia sin actualizar la fuente es lo que este paso existe para impedir."
      echo ""
      echo "  Diferencias (fuente = -, copia = +), primeras 80 líneas:"
      diff -u "$fuente" "$copia" | head -n 80 || true
    } >&2
  fi
done

if [ "$fallas" -gt 0 ]; then
  echo ""
  echo "Identidad del contrato: ${fallas} verificación(es) fallida(s)." >&2
  exit 1
fi

if [ "$pendientes" -gt 0 ]; then
  echo "Identidad del contrato: ${pendientes} pendiente(s), 0 divergencias."
else
  echo "Identidad del contrato: todo idéntico."
fi
