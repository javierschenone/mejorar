#!/usr/bin/env bash
#
# Verificación de que no hay secretos en el repositorio — feature 002, T-13.
#
# "No hay un solo secreto en el historial de git" es un criterio de terminado
# del mandato de `cicd`. Un criterio que nadie verifica es una intención, así
# que acá está verificado y rompe la construcción.
#
# Qué mira:
#   1. Archivos `.env` versionados (`.env.example` es la única excepción).
#   2. Bloques de clave privada en formato PEM.
#   3. Variables de nombre sospechoso con un valor que parece un secreto real,
#      descartando los marcadores de posición obvios.
#
# Modos:
#   ./scripts/ci/verificar-ausencia-de-secretos.sh              árbol versionado (CI de cada PR)
#   ./scripts/ci/verificar-ausencia-de-secretos.sh --historial  además, todo el historial de git
#                                                               (requiere clon completo; va en el job mensual)
#
# Un hallazgo acá no se resuelve borrando la línea: si el secreto estuvo en un
# commit, **se rota**. Ver `scripts/ci/claves-y-custodia.md` §4.

set -euo pipefail

CON_HISTORIAL="no"
if [ "${1:-}" = "--historial" ]; then
  CON_HISTORIAL="si"
fi

# Este guion y el documento de custodia hablan *sobre* secretos: nombran las
# variables y muestran los comandos que las generan. Se excluyen a propósito,
# y es la única excepción.
EXCLUIDOS='^(scripts/ci/verificar-ausencia-de-secretos\.sh|scripts/ci/claves-y-custodia\.md|scripts/ci/generar-claves-desarrollo\.sh)$'

# Marcadores de posición legítimos: `.env.example` tiene que poder mostrar la
# forma de una variable sin que esto se queje.
PLACEHOLDERS='cambiar|reemplaz|ejemplo|example|placeholder|changeme|dummy|mock|falso|prueba|test|your-|tu-|xxxx|\$\{|\$\(|<[a-z_-]+>|^0+$|^a+$'

resumen() {
  echo "$1"
  if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
    echo "$1" >> "$GITHUB_STEP_SUMMARY"
  fi
}

fallas=0

resumen "## Ausencia de secretos en el repositorio"
resumen ""

# ── 1. Archivos de entorno versionados ──────────────────────────────────────
env_versionados="$(git ls-files | grep -E '(^|/)\.env($|\.)' | grep -v '\.env\.example$' || true)"
if [ -n "$env_versionados" ]; then
  fallas=$((fallas + 1))
  resumen "- **Hay archivos de entorno versionados.** Sólo \`.env.example\` puede estarlo:"
  while IFS= read -r archivo; do
    echo "::error file=${archivo}::Archivo de entorno versionado. Los valores reales nunca entran al repositorio (mandato de \`cicd\`)."
    resumen "  - \`${archivo}\`"
  done <<< "$env_versionados"
fi

# ── 2. Claves privadas en PEM ───────────────────────────────────────────────
# El patrón está escrito con una clase de caracteres para que este archivo no
# se encuentre a sí mismo.
pem="$(git grep -n -I -E 'BEGIN[ A-Z0-9]*PRIVATE KEY' -- . 2>/dev/null | grep -vE "${EXCLUIDOS//^/}" || true)"
if [ -n "$pem" ]; then
  fallas=$((fallas + 1))
  resumen "- **Hay una clave privada en el árbol versionado:**"
  while IFS= read -r linea; do
    archivo="${linea%%:*}"
    echo "::error file=${archivo}::Clave privada en el repositorio. No alcanza con borrarla: hay que rotarla (claves-y-custodia.md §4)."
    resumen "  - \`${linea%%:*}\`"
  done <<< "$pem"
fi

# ── 3. Variables sospechosas con valor que parece real ──────────────────────
#
# La heurística es **deliberadamente angosta**: un detector que grita por cada
# constante de TypeScript que se llama `POLITICA_DE_CONTRASENA` termina
# desactivado en una semana, y entonces no detecta nada. Tres condiciones
# simultáneas:
#   (a) el nombre de la variable suena a secreto;
#   (b) el valor ocupa la línea entera después del `=` o del `:`, sin espacios
#       ni llamadas — o sea, es un valor literal y no una expresión;
#   (c) tiene 32 caracteres o más y mezcla clases de caracteres (o es
#       hexadecimal largo), que es como se ve una clave y no como se ve una
#       palabra.
# Se mira sólo en archivos de configuración y de texto, no en código fuente:
# un secreto de verdad se filtra en un `.env`, en un YAML o en un pegado de
# documentación, no en un identificador de TypeScript.

NOMBRES_SOSPECHOSOS='(SECRET|PASSWORD|PASSWD|PIMIENTA|CLAVE_PRIVADA|PRIVATE_KEY|ENCRYPTION_KEY|API_KEY|APIKEY|ACCESS_TOKEN|AUTH_TOKEN|INDICE_CIEGO|CLAVE_DE_TRAFICO)'

archivos_de_configuracion="$(git ls-files \
  '*.env' '*.env.*' '.env*' '*.yml' '*.yaml' '*.json' '*.sh' '*.ini' '*.conf' '*.cfg' \
  '*.properties' '*.tf' '*.tfvars' '*.md' 'Dockerfile*' 'docker-compose*' 2>/dev/null || true)"

for archivo in $archivos_de_configuracion; do
  if echo "$archivo" | grep -qE "$EXCLUIDOS"; then
    continue
  fi
  case "$archivo" in
    pnpm-lock.yaml|*/pnpm-lock.yaml|*.snap|*.lock|*/dist/*) continue ;;
  esac
  [ -f "$archivo" ] || continue

  while IFS= read -r linea; do
    valor="$(printf '%s' "$linea" | sed -E 's/^.*[:=][[:space:]]*["'"'"']?([A-Za-z0-9+/=_-]{32,})["'"'"']?[[:space:]]*$/\1/')"
    if echo "$valor" | grep -qiE "$PLACEHOLDERS"; then
      continue
    fi
    # Mezcla de clases (mayúscula + minúscula + dígito) o hexadecimal largo.
    if echo "$valor" | grep -qE '^[0-9a-f]{32,}$' ||
       { echo "$valor" | grep -q '[A-Z]' && echo "$valor" | grep -q '[a-z]' && echo "$valor" | grep -q '[0-9]'; }; then
      fallas=$((fallas + 1))
      echo "::error file=${archivo}::Valor que parece un secreto real. Si lo es, se rota y se saca; si es un marcador de posición, que se note que lo es (\`cambiar-...\`, \`<valor>\`)."
      resumen "- **Valor sospechoso** en \`${archivo}\`: \`$(printf '%s' "$valor" | cut -c1-6)…\` (recortado a propósito)"
    fi
  done < <(grep -I -E "${NOMBRES_SOSPECHOSOS}[A-Za-z0-9_]*[\"']?[[:space:]]*[:=][[:space:]]*[\"']?[A-Za-z0-9+/=_-]{32,}[\"']?[[:space:]]*$" "$archivo" || true)
done

# ── 4. Historial completo (job mensual) ─────────────────────────────────────
if [ "$CON_HISTORIAL" = "si" ]; then
  if [ "$(git rev-list --count HEAD 2>/dev/null || echo 0)" -le 1 ]; then
    resumen "- Historial no revisado: el clon es superficial. El job que use \`--historial\` necesita \`fetch-depth: 0\`."
  else
    historial="$(git log -p --no-color -- . | grep -nE '^\+.*BEGIN[ A-Z0-9]*PRIVATE KEY' || true)"
    if [ -n "$historial" ]; then
      fallas=$((fallas + 1))
      echo "::error::Se agregó una clave privada en algún commit del historial. Hay que rotar esa clave, esté o no en el árbol actual."
      resumen "- **Hay una clave privada en el historial de git.** Borrarla del árbol no la protege: rotar."
    else
      resumen "- Historial completo revisado: sin claves privadas agregadas en ningún commit."
    fi
  fi
fi

if [ "$fallas" -gt 0 ]; then
  resumen ""
  resumen "**Construcción detenida**: ${fallas} hallazgo(s)."
  exit 1
fi

resumen "Sin secretos en el árbol versionado."
exit 0
