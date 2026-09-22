#!/usr/bin/env bash
#
# Actualización mensual de la base local IP→ubicación — ADR-029, T-13 de la 002.
#
# POR QUÉ ES UN JOB Y NO UNA LLAMADA A UNA API
# ADR-029 prohíbe resolver la IP contra un servicio externo: mandarle la IP de
# cada titular a un tercero lo convierte en encargado de tratamiento, con
# probable transferencia internacional (arts. 12 y 25 de la Ley 25.326). La
# alternativa es una base descargada y empaquetada en la imagen, y el precio de
# esa decisión es este mantenimiento: un archivo que envejece. Un archivo viejo
# degrada la precisión, no la disponibilidad.
#
# FUENTE: DB-IP Lite, nivel país. Licencia Creative Commons con atribución,
# archivo mensual, sin cuenta ni clave de licencia (ADR-029 §1). La atribución
# en la interfaz es la obligación F-13, de `ux-expert`.
#
# DEPENDENCIA DE T-02 (`dev-integraciones`)
# Este guion no inventa dónde va el archivo. Lee un manifiesto que escribe
# `dev-integraciones` junto al adaptador:
#
#   packages/integrations/src/identidad/ubicacion/base-ip.manifiesto.json
#   {
#     "rutaDelArchivo": "packages/integrations/src/identidad/ubicacion/base/dbip-country-lite.csv.gz",
#     "versionDeLaBase": "2026-09",
#     "fuente": "DB-IP Lite country",
#     "licencia": "CC-BY-4.0"
#   }
#
# Mientras el manifiesto no exista, el guion informa la dependencia y termina
# bien. No adivina rutas: un archivo de datos puesto en el lugar equivocado es
# peor que no tenerlo.
#
# El guion **no hace commit**: deja el archivo y el manifiesto actualizados en
# el árbol de trabajo. El workflow abre un PR y lo revisa una persona
# (`dev-integraciones` es el dueño de ese árbol, no `cicd`).

set -euo pipefail

MANIFIESTO="${MANIFIESTO_BASE_IP:-packages/integrations/src/identidad/ubicacion/base-ip.manifiesto.json}"
MES="${MES_BASE_IP:-$(date -u +%Y-%m)}"
URL_BASE_DBIP="${URL_BASE_DBIP:-https://download.db-ip.com/free}"
# Tamaño mínimo plausible del archivo comprimido. Si baja de acá, lo que se
# descargó es una página de error, no una base.
MINIMO_BYTES="${MINIMO_BYTES:-1000000}"

resumen() {
  echo "$1"
  if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
    echo "$1" >> "$GITHUB_STEP_SUMMARY"
  fi
}

emitir() {
  if [ -n "${GITHUB_OUTPUT:-}" ]; then
    echo "$1=$2" >> "$GITHUB_OUTPUT"
  fi
}

resumen "## Base local de geolocalización (ADR-029)"
resumen ""

if [ ! -f "$MANIFIESTO" ]; then
  echo "::notice::No existe ${MANIFIESTO}: la base local todavía no fue incorporada (T-02, dev-integraciones). Actualización diferida."
  resumen "Pendiente: todavía no existe \`${MANIFIESTO}\`."
  resumen ""
  resumen "La actualización mensual está escrita y programada; espera a que \`dev-integraciones\` incorpore la base"
  resumen "local de DB-IP Lite y declare su ruta en el manifiesto (T-02). En cuanto exista, este job empieza a"
  resumen "abrir el PR mensual sin tocar nada más."
  emitir "actualizado" "no"
  emitir "motivo" "sin-manifiesto"
  exit 0
fi

leer_del_manifiesto() {
  node -e "const m=require('./${MANIFIESTO}');process.stdout.write(String(m['$1']??''))"
}

RUTA_ARCHIVO="$(leer_del_manifiesto rutaDelArchivo)"
VERSION_ACTUAL="$(leer_del_manifiesto versionDeLaBase)"

if [ -z "$RUTA_ARCHIVO" ]; then
  echo "::error file=${MANIFIESTO}::El manifiesto no declara \`rutaDelArchivo\`. Sin eso no se sabe qué archivo actualizar."
  resumen "**Error**: \`${MANIFIESTO}\` no declara \`rutaDelArchivo\`."
  exit 1
fi

if [ "$VERSION_ACTUAL" = "$MES" ]; then
  resumen "La base ya está en la versión \`${MES}\`. Nada que hacer."
  emitir "actualizado" "no"
  emitir "motivo" "ya-al-dia"
  exit 0
fi

URL="${URL_BASE_DBIP}/dbip-country-lite-${MES}.csv.gz"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

echo "Descargando ${URL}"
if ! curl -fsSL --retry 3 --retry-delay 5 -o "$tmp/base.csv.gz" "$URL"; then
  # DB-IP publica a principios de mes; si el job corre antes, se intenta el mes
  # anterior en vez de fallar: una base de un mes atrás es exactamente lo que
  # ya está en uso.
  MES_ANTERIOR="$(date -u -d "${MES}-01 -1 month" +%Y-%m 2>/dev/null || echo '')"
  if [ -n "$MES_ANTERIOR" ] && [ "$MES_ANTERIOR" != "$VERSION_ACTUAL" ] &&
     curl -fsSL --retry 2 -o "$tmp/base.csv.gz" "${URL_BASE_DBIP}/dbip-country-lite-${MES_ANTERIOR}.csv.gz"; then
    echo "::notice::La publicación de ${MES} todavía no estaba disponible; se tomó la de ${MES_ANTERIOR}."
    MES="$MES_ANTERIOR"
  else
    echo "::warning::No se pudo descargar la base de DB-IP (${URL}). La base en uso sigue siendo la ${VERSION_ACTUAL}: se degrada la precisión, no la disponibilidad."
    resumen "No se pudo descargar la publicación de \`${MES}\`. Sigue en uso la \`${VERSION_ACTUAL}\`."
    emitir "actualizado" "no"
    emitir "motivo" "descarga-fallida"
    exit 0
  fi
fi

# ── Validaciones antes de reemplazar nada ───────────────────────────────────
bytes="$(wc -c < "$tmp/base.csv.gz")"
if [ "$bytes" -lt "$MINIMO_BYTES" ]; then
  echo "::error::El archivo descargado pesa ${bytes} bytes, por debajo del mínimo plausible de ${MINIMO_BYTES}. Probablemente sea una página de error."
  resumen "**Descarga inválida**: ${bytes} bytes."
  exit 1
fi

if ! gzip -t "$tmp/base.csv.gz"; then
  echo "::error::El archivo descargado no es un gzip válido."
  exit 1
fi

lineas="$(gzip -dc "$tmp/base.csv.gz" | wc -l)"
if [ "$lineas" -lt 100000 ]; then
  echo "::error::La base tiene sólo ${lineas} filas; una base de rangos por país tiene cientos de miles. No se reemplaza."
  resumen "**Contenido sospechoso**: ${lineas} filas."
  exit 1
fi

# Forma esperada: inicio de rango, fin de rango, código de país ISO de 2 letras.
# `|| true` porque `head` cierra la tubería y con `pipefail` eso sería un fallo
# del pipeline, no del contenido.
primera_fila="$(gzip -dc "$tmp/base.csv.gz" 2>/dev/null | head -n 1 || true)"
if ! printf '%s' "$primera_fila" | grep -qE '^"?[0-9a-fA-F:.]+"?,"?[0-9a-fA-F:.]+"?,"?[A-Z]{2}"?'; then
  echo "::error::La primera fila no tiene la forma esperada (inicio,fin,país). Cambió el formato de la fuente: hay que revisar el adaptador antes de actualizar."
  resumen "**Formato inesperado** en la primera fila. Se detiene: cambiar el archivo bajo el adaptador sin revisarlo rompería la resolución en silencio."
  exit 1
fi

mkdir -p "$(dirname "$RUTA_ARCHIVO")"
cp "$tmp/base.csv.gz" "$RUTA_ARCHIVO"

node -e "
const fs = require('node:fs');
const ruta = '${MANIFIESTO}';
const m = JSON.parse(fs.readFileSync(ruta, 'utf8'));
m.versionDeLaBase = '${MES}';
m.actualizadoEn = new Date().toISOString().slice(0, 10);
fs.writeFileSync(ruta, JSON.stringify(m, null, 2) + '\n');
"

resumen "Base actualizada de \`${VERSION_ACTUAL}\` a \`${MES}\` (${lineas} filas, $((bytes / 1024)) KiB comprimidos)."
resumen ""
resumen "Fuente: DB-IP Lite, licencia CC-BY. La atribución en la interfaz es la obligación F-13."
emitir "actualizado" "si"
emitir "version" "$MES"
emitir "version_anterior" "$VERSION_ACTUAL"
emitir "filas" "$lineas"
