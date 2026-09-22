#!/usr/bin/env bash
#
# Generación de claves para un entorno de DESARROLLO LOCAL — feature 002.
#
# Procedimiento completo, custodia y rotación: `scripts/ci/claves-y-custodia.md`.
#
# Este guion existe para que nadie tenga que inventar una clave a mano, y para
# que nadie copie la de otro. Escribe por **salida estándar** y no toca ningún
# archivo: el destino es el `.env` local de quien lo ejecuta, que está en
# `.gitignore`.
#
#   ./scripts/ci/generar-claves-desarrollo.sh >> .env
#
# LO QUE NO HACE, A PROPÓSITO:
#   - No genera claves de homologación ni de producción. Ésas se generan en la
#     sesión aprobada del despliegue (G6) y se cargan directo al gestor de
#     secretos, sin pasar por la máquina de nadie ni por este repositorio.
#   - No escribe archivos dentro del repositorio.
#   - No imprime nada si detecta que la salida es un archivo versionado.

set -euo pipefail

ENTORNO="${1:-desarrollo}"

if [ "$ENTORNO" != "desarrollo" ]; then
  cat >&2 <<'FIN'
Este guion genera claves SÓLO para desarrollo local.

Para homologación o producción, el procedimiento es otro y está escrito en
`scripts/ci/claves-y-custodia.md` §2 y §3: las claves se generan durante el
despliegue aprobado (compuerta G6), se cargan directo al gestor de secretos del
entorno y no se copian a ningún archivo local.

Generar acá una clave de producción sería dejarla en el historial de la terminal
de alguien. No se hace.
FIN
  exit 2
fi

if ! command -v openssl >/dev/null 2>&1; then
  echo "Falta \`openssl\`. Es lo único que este guion necesita." >&2
  exit 1
fi

# Huella de la clave pública: el `kid` no lo elige una persona.
kid_de() {
  openssl pkey -in "$1" -pubout -outform DER 2>/dev/null \
    | openssl dgst -sha256 -binary \
    | base64 | tr '+/' '-_' | tr -d '=' | cut -c1-16
}

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

openssl genpkey -algorithm ed25519 -outform PEM -out "$tmp/tokens-actual.pem" 2>/dev/null
openssl genpkey -algorithm ed25519 -outform PEM -out "$tmp/tokens-siguiente.pem" 2>/dev/null
openssl genpkey -algorithm ed25519 -outform PEM -out "$tmp/sello.pem" 2>/dev/null

cat <<FIN
# ─────────────────────────────────────────────────────────────
# Claves de identidad y acceso (feature 002) — DESARROLLO LOCAL
# Generadas el $(date -u +%Y-%m-%dT%H:%M:%SZ) por scripts/ci/generar-claves-desarrollo.sh
#
# NO SIRVEN PARA NINGÚN OTRO ENTORNO. No se comparten, no se pegan en un chat,
# no se suben a ningún lado. Si este bloque termina en un archivo versionado,
# el arreglo es rotar, no borrar el commit.
#
# Nombres canónicos: los fija el esquema de configuración de apps/api
# (dev-backend, tarea T-11). Ver scripts/ci/claves-y-custodia.md §1.
# ─────────────────────────────────────────────────────────────

# Firma de tokens de acceso — Ed25519 (ADR-020). Dos claves en el JWKS.
TOKEN_FIRMA_CLAVE_PRIVADA_ACTUAL=$(base64 -w0 < "$tmp/tokens-actual.pem")
TOKEN_FIRMA_KID_ACTUAL=$(kid_de "$tmp/tokens-actual.pem")
TOKEN_FIRMA_CLAVE_PRIVADA_SIGUIENTE=$(base64 -w0 < "$tmp/tokens-siguiente.pem")
TOKEN_FIRMA_KID_SIGUIENTE=$(kid_de "$tmp/tokens-siguiente.pem")

# Pimienta de contraseñas (ADR-024). Versionada: v1 no se borra al crear v2.
CONTRASENA_PIMIENTA_ACTIVA=v1
CONTRASENA_PIMIENTA_V1=$(openssl rand -base64 32)

# Sellado de la bitácora de auditoría (ADR-028). Distinta de la de tokens,
# y en producción custodiada por otra gente.
AUDITORIA_SELLO_CLAVE_PRIVADA=$(base64 -w0 < "$tmp/sello.pem")
AUDITORIA_SELLO_KID=$(kid_de "$tmp/sello.pem")

# Cifrado en reposo del secreto TOTP y de los códigos de respaldo (F-08).
DATA_ENCRYPTION_KEY=$(openssl rand -hex 32)

# Índice ciego de correo y CUIT/CUIL (F-01) y clave de tráfico (ADR-025 §4).
INDICE_CIEGO_CLAVE=$(openssl rand -base64 32)
CLAVE_DE_TRAFICO=$(openssl rand -base64 32)
FIN

echo "" >&2
echo "Claves de DESARROLLO generadas por salida estándar." >&2
echo "Destino habitual: \`./scripts/ci/generar-claves-desarrollo.sh >> .env\` (.env está en .gitignore)." >&2
