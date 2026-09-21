#!/usr/bin/env bash
#
# Verificación de identidad del contrato — ADR-017.
#
# `specs/contratos/<contrato>.ts` es la fuente normativa: es lo que el humano
# aprueba en G2 y sólo lo modifica el `arquitecto`.
# `packages/<paquete>/src/<dominio>/contrato/<version>.ts` es una copia exacta,
# byte a byte, que mantiene el agente dueño del paquete.
#
# Este script falla la construcción si divergen. Sin él, la copia deriva y el
# contrato aprobado deja de significar algo (ADR-017, "cómo se revierte";
# riesgo R-05 del plan de la feature 004, riesgo R-11 del plan de la 002).
#
# Uso: ./scripts/ci/verificar-identidad-contrato.sh   (desde la raíz del repo)

set -euo pipefail

# Tríos "fuente normativa|copia en el paquete|directorio que vuelve obligatoria
# la copia".
#
# El tercer campo es el trinquete: mientras ese directorio no exista, el agente
# dueño todavía no empezó y la verificación queda **pendiente** en vez de
# fallar; en cuanto existe, la copia es obligatoria y su ausencia rompe la
# construcción. Es lo que permite que este paso viva en el pipeline desde antes
# de que el código se escriba, sin bloquear a nadie por lo que todavía no hay.
#
# Cuando exista una v2 de un contrato (ADR-017 punto 6) se agrega una línea
# más; los dos archivos conviven mientras haya consumidores.
PARES=(
  # Feature 004 — motor de reglas legales (ADR-017).
  "specs/contratos/motor-reglas-legales.ts|packages/shared/src/motor-legal/contrato/v1.ts|packages/shared/src/motor-legal"
  # Feature 002 — identidad y acceso (ADR-017 aplicado a esta feature;
  # obligación de frontera F-11 de `specs/002-identidad-y-acceso/plan.md` §5).
  # La copia del dominio la mantiene `dev-dominio` (T-01).
  "specs/contratos/identidad-y-acceso.ts|packages/shared/src/identidad/contrato/v1.ts|packages/shared/src/identidad"
  # `packages/integrations` mantiene su propia copia del mismo contrato porque
  # declara los puertos de ADR-029 (`package.json`, export `./identidad/contrato`).
  # La mantiene `dev-integraciones` (T-02) y vale la misma regla: manda la
  # fuente. Dos copias del mismo contrato son dos oportunidades de deriva.
  "specs/contratos/identidad-y-acceso.ts|packages/integrations/src/identidad/contrato/v1.ts|packages/integrations/src/identidad"
)

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
  IFS='|' read -r fuente copia guardia <<< "$par"

  if [ ! -f "$fuente" ]; then
    echo "::error file=${fuente}::No existe la fuente normativa del contrato. Es el archivo que aprueba el humano en G2 y no puede faltar."
    resumen "| \`${fuente}\` | \`${copia}\` | FALTA LA FUENTE |"
    fallas=$((fallas + 1))
    continue
  fi

  if [ ! -f "$copia" ]; then
    if [ -d "$guardia" ]; then
      echo "::error file=${copia}::Falta la copia del contrato. ${guardia} ya existe, así que la copia byte a byte de ${fuente} es obligatoria (ADR-017 punto 2)."
      resumen "| \`${fuente}\` | \`${copia}\` | FALTA LA COPIA |"
      fallas=$((fallas + 1))
    else
      echo "::notice::Todavía no existe ${guardia}: la copia del contrato está pendiente. Verificación diferida."
      resumen "| \`${fuente}\` | \`${copia}\` | pendiente — \`${guardia}\` todavía no existe |"
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
