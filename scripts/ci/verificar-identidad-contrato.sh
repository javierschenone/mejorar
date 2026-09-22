#!/usr/bin/env bash
#
# Verificación de identidad del contrato — ADR-017.
#
# `specs/contratos/<contrato>.ts` es la fuente normativa: es lo que el humano
# aprueba en G2 y sólo lo modifica el `arquitecto`. Lo que este script protege
# es una sola cosa: que ningún paquete se aparte del contrato aprobado sin que
# la construcción se entere (ADR-017, "cómo se revierte"; riesgo R-05 del plan
# de la 004, riesgo R-11 del plan de la 002).
#
# Hay dos formas legítimas de que un paquete adopte un contrato, y este script
# verifica las dos de manera distinta:
#
#   1. COPIA BYTE A BYTE (`PARES`). El paquete que **declara** los tipos del
#      contrato mantiene una copia exacta en
#      `packages/<paquete>/src/<dominio>/contrato/<version>.ts`. Se compara con
#      `cmp`: un solo byte de diferencia rompe la construcción.
#
#   2. REEXPORTACIÓN (`REEXPORTACIONES`). Un paquete que **consume** el mismo
#      contrato no vuelve a copiarlo: reexporta los tipos desde el paquete que
#      ya tiene la copia. No es una comodidad, es una obligación técnica: el
#      contrato construye sus marcas nominales sobre `unique symbol`
#      (`Instante`, `IdOpaco<…>`), y dos copias en dos paquetes producen dos
#      símbolos distintos, o sea dos tipos mutuamente inasignables. `apps/api`,
#      que consume los dos paquetes, no podría cablearlos sin un `as`, y ese
#      `as` anularía exactamente la garantía que las marcas nominales dan.
#      Exigirle una copia byte a byte a un archivo así sería un falso positivo:
#      la ausencia de la copia es la decisión correcta, no un defecto.
#
#      En ese caso la identidad de los tipos ya la garantiza el compilador (si
#      el símbolo no existe en el paquete de origen, no compila), así que lo
#      que verificamos acá es lo que el compilador NO mira: que el archivo siga
#      siendo una reexportación pura y que su superficie coincida con el
#      contrato aprobado. En concreto —
#        a. importa sólo del paquete de origen declarado, de ningún otro lado;
#        b. no declara ni un tipo propio: cada línea con contenido es o el
#           import o un `export type X = <ns>.X;`;
#        c. no renombra ni especializa: el nombre reexportado y los parámetros
#           genéricos son los mismos que los del origen;
#        d. todo lo que reexporta existe de verdad en la fuente normativa;
#        e. cubre los símbolos que la frontera está obligada a exponer (ver
#           `COBERTURA_OBLIGATORIA`), para que agregar un puerto al contrato no
#           pase inadvertido en el paquete que tiene que implementarlo.
#      Cualquiera de esas cinco cosas que se rompa es deriva real y falla.
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
  # La copia del dominio la mantiene `dev-dominio` (T-01). Es la única copia
  # del contrato de identidad que existe, a propósito: ver arriba.
  "specs/contratos/identidad-y-acceso.ts|packages/shared/src/identidad/contrato/v1.ts|packages/shared/src/identidad"
)

# Quíntuplas "fuente normativa|archivo de reexportación|trinquete|espacio de
# nombres|módulo de origen".
#
# El trinquete funciona igual que en `PARES`: mientras el directorio no exista,
# pendiente; en cuanto existe, el archivo de reexportación es obligatorio.
REEXPORTACIONES=(
  # `packages/integrations` declara los puertos de ADR-029 (`package.json`,
  # export `./identidad/contrato`) sobre los tipos del mismo contrato. Los
  # reexporta desde `@mejorar/shared` en vez de copiarlos, por las marcas
  # nominales. Lo mantiene `dev-integraciones` (T-02).
  "specs/contratos/identidad-y-acceso.ts|packages/integrations/src/identidad/contrato/index.ts|packages/integrations/src/identidad|identidad|@mejorar/shared"
)

# Qué está obligado a reexportar cada frontera, como expresión regular sobre el
# nombre del símbolo en la fuente normativa.
#
# Una frontera reexporta a propósito un subconjunto del contrato —declara qué
# parte toca, y nada más—, así que no se le puede exigir cobertura total. Pero
# los puertos sí: si el `arquitecto` agrega un `Puerto…` al contrato, el
# paquete que implementa los adaptadores tiene que enterarse, y enterarse acá y
# no seis semanas después. Si alguna vez un puerto del contrato NO corresponde
# a esta frontera, la excepción se escribe en `EXCEPCIONES_DE_COBERTURA` con su
# motivo: que sea una decisión anotada y no un olvido silencioso.
# Formato: "archivo de reexportación|expresión regular".
COBERTURA_OBLIGATORIA=(
  "packages/integrations/src/identidad/contrato/index.ts|^Puerto"
)

# Formato: "archivo de reexportación|Símbolo|motivo".
EXCEPCIONES_DE_COBERTURA=()

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

# Nombres que exporta un archivo de contrato, uno por línea.
nombres_exportados() {
  sed -nE 's/^export (declare )?(type|interface|class|enum|const|function|namespace) ([A-Za-z_][A-Za-z0-9_]*).*/\3/p' "$1"
}

# Líneas con contenido real de un archivo TypeScript: sin comentarios de bloque,
# sin comentarios de línea y sin líneas vacías. Cada línea sale como
# "<nro de línea original><TAB><contenido>", para poder anotar el error donde
# está de verdad.
lineas_con_contenido() {
  awk '
    {
      linea = $0; salida = ""
      while (length(linea) > 0) {
        if (en_bloque) {
          p = index(linea, "*/")
          if (p == 0) { linea = "" } else { linea = substr(linea, p + 2); en_bloque = 0 }
        } else {
          p = index(linea, "/*")
          if (p == 0) { salida = salida linea; linea = "" }
          else { salida = salida substr(linea, 1, p - 1); linea = substr(linea, p + 2); en_bloque = 1 }
        }
      }
      sub(/\/\/.*/, "", salida)
      gsub(/^[ \t]+|[ \t]+$/, "", salida)
      if (length(salida) > 0) { print NR "\t" salida }
    }
  ' "$1"
}

# "TValor, TError extends Error" → "TValor TError": los nombres de los
# parámetros genéricos, sin restricciones ni valores por omisión.
nombres_de_parametros() {
  # Ojo con `grep -v '^$'` acá: devuelve 1 con entrada vacía —el caso normal,
  # un tipo sin genéricos— y con `set -e` eso mata el script. Las líneas vacías
  # las borra el propio sed, que sale 0 igual.
  printf '%s' "$1" \
    | tr ',' '\n' \
    | sed -E 's/[[:space:]]+extends[[:space:]].*//; s/=.*//; s/^[[:space:]]+//; s/[[:space:]]+$//; /^$/d' \
    | tr '\n' ' '
}

# Los problemas de una reexportación se acumulan como
# "<nro de línea><US><mensaje><US><línea>" y se informan todos juntos: quien
# tenga que arreglarlo ve la lista completa de una, no de a uno por corrida.
# El separador es el carácter de control US (0x1f) y no `|`, que aparece en los
# tipos unión de TypeScript y en las expresiones regulares de este archivo.
US=$'\x1f'
anotar_error() {
  errores_archivo+=("${1}${US}${2}${US}${3:-}")
}

fallas=0
pendientes=0

resumen "## Identidad del contrato (ADR-017)"
resumen ""
resumen "| Fuente normativa | Archivo del paquete | Modo | Estado |"
resumen "| --- | --- | --- | --- |"

# ---------------------------------------------------------------------------
# Modo 1 — copia byte a byte.
# ---------------------------------------------------------------------------
for par in "${PARES[@]}"; do
  IFS='|' read -r fuente copia guardia <<< "$par"

  if [ ! -f "$fuente" ]; then
    echo "::error file=${fuente}::No existe la fuente normativa del contrato. Es el archivo que aprueba el humano en G2 y no puede faltar."
    resumen "| \`${fuente}\` | \`${copia}\` | copia | FALTA LA FUENTE |"
    fallas=$((fallas + 1))
    continue
  fi

  if [ ! -f "$copia" ]; then
    if [ -d "$guardia" ]; then
      echo "::error file=${copia}::Falta la copia del contrato. ${guardia} ya existe, así que la copia byte a byte de ${fuente} es obligatoria (ADR-017 punto 2)."
      resumen "| \`${fuente}\` | \`${copia}\` | copia | FALTA LA COPIA |"
      fallas=$((fallas + 1))
    else
      echo "::notice::Todavía no existe ${guardia}: la copia del contrato está pendiente. Verificación diferida."
      resumen "| \`${fuente}\` | \`${copia}\` | copia | pendiente — \`${guardia}\` todavía no existe |"
      pendientes=$((pendientes + 1))
    fi
    continue
  fi

  if cmp -s "$fuente" "$copia"; then
    echo "OK  ${copia} es idéntico a ${fuente}  (sha256 $(huella "$fuente"))"
    resumen "| \`${fuente}\` | \`${copia}\` | copia | idéntico — \`$(huella "$fuente" | cut -c1-12)\` |"
  else
    fallas=$((fallas + 1))
    resumen "| \`${fuente}\` | \`${copia}\` | copia | **DIVERGEN** |"
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

# ---------------------------------------------------------------------------
# Modo 2 — reexportación pura.
# ---------------------------------------------------------------------------
for entrada in "${REEXPORTACIONES[@]}"; do
  IFS='|' read -r fuente archivo guardia espacio origen <<< "$entrada"

  if [ ! -f "$fuente" ]; then
    echo "::error file=${fuente}::No existe la fuente normativa del contrato. Es el archivo que aprueba el humano en G2 y no puede faltar."
    resumen "| \`${fuente}\` | \`${archivo}\` | reexportación | FALTA LA FUENTE |"
    fallas=$((fallas + 1))
    continue
  fi

  if [ ! -f "$archivo" ]; then
    if [ -d "$guardia" ]; then
      echo "::error file=${archivo}::Falta la reexportación del contrato. ${guardia} ya existe, así que el archivo que declara qué parte de ${fuente} toca esta frontera es obligatorio (ADR-017 punto 2)."
      resumen "| \`${fuente}\` | \`${archivo}\` | reexportación | FALTA LA REEXPORTACIÓN |"
      fallas=$((fallas + 1))
    else
      echo "::notice::Todavía no existe ${guardia}: la reexportación del contrato está pendiente. Verificación diferida."
      resumen "| \`${fuente}\` | \`${archivo}\` | reexportación | pendiente — \`${guardia}\` todavía no existe |"
      pendientes=$((pendientes + 1))
    fi
    continue
  fi

  # La fuente tiene que ser parseable con las formas de `export` que este script
  # conoce. Si aparece una forma nueva, el script se queda ciego justo donde
  # tiene que mirar: mejor que lo diga en voz alta y no que apruebe de más.
  desconocidas=$(grep -nE '^export ' "$fuente" \
    | grep -vE '^[0-9]+:export (declare )?(type|interface|class|enum|const|function|namespace) [A-Za-z_]' \
    || true)
  if [ -n "$desconocidas" ]; then
    fallas=$((fallas + 1))
    resumen "| \`${fuente}\` | \`${archivo}\` | reexportación | **FUENTE NO PARSEABLE** |"
    {
      echo "::error file=${fuente}::La fuente normativa usa una forma de 'export' que este script no sabe leer, así que no puede verificar la reexportación."
      echo "  Líneas:"
      echo "$desconocidas"
      echo "  Actualizá 'nombres_exportados' en scripts/ci/verificar-identidad-contrato.sh (agente cicd)."
    } >&2
    continue
  fi

  del_contrato=$(nombres_exportados "$fuente" | sort -u)

  # Las expresiones regulares se arman en variables a propósito: dentro de
  # `[[ … =~ … ]]`, un `<` suelto lo lee bash como comparación, no como parte
  # del patrón.
  re_import="^import[[:space:]]+type[[:space:]]*\{[[:space:]]*${espacio}[[:space:]]*\}[[:space:]]+from[[:space:]]+['\"]${origen}['\"];?$"
  re_izquierda='^export[[:space:]]+type[[:space:]]+([A-Za-z_][A-Za-z0-9_]*)[[:space:]]*(<(.*)>)?$'
  re_derecha='^([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)[[:space:]]*(<(.*)>)?$'

  errores_archivo=()
  reexportados=()
  cantidad_importes=0

  while IFS=$'\t' read -r nro linea; do
    # a. Importes: sólo del paquete de origen declarado.
    if [[ "$linea" == import* ]]; then
      cantidad_importes=$((cantidad_importes + 1))
      if [[ ! "$linea" =~ $re_import ]]; then
        anotar_error "${nro}" "Importe no permitido: se espera exactamente \`import type { ${espacio} } from '${origen}';\` y nada más. Importar de otro lado rompe la cadena que hace que estos tipos sean los del contrato aprobado." "${linea}"
      fi
      continue
    fi

    # b. Todo lo demás tiene que ser una reexportación. Cualquier declaración
    #    propia (`interface`, `type X = {…}`, `const`, `class`, `enum`) es
    #    exactamente la deriva que ADR-017 quiere impedir: un tipo que dice
    #    venir del contrato y no viene.
    if [[ ! "$linea" =~ ^export[[:space:]]+type[[:space:]] ]] || [[ "$linea" != *"${espacio}."* ]]; then
      anotar_error "${nro}" "Este archivo es una reexportación pura del contrato: sólo admite el importe y líneas \`export type X = ${espacio}.X;\`. Esta línea declara algo propio." "${linea}"
      continue
    fi

    izquierda="${linea%%=*}"
    derecha="${linea#*=}"
    derecha="${derecha%;}"
    # Recorte de espacios en ambos extremos.
    izquierda="${izquierda#"${izquierda%%[![:space:]]*}"}"
    izquierda="${izquierda%"${izquierda##*[![:space:]]}"}"
    derecha="${derecha#"${derecha%%[![:space:]]*}"}"
    derecha="${derecha%"${derecha##*[![:space:]]}"}"

    if [[ ! "$izquierda" =~ $re_izquierda ]]; then
      anotar_error "${nro}" "No se entiende qué declara esta línea. La forma admitida es \`export type X = ${espacio}.X;\`." "${linea}"
      continue
    fi
    alias_nombre="${BASH_REMATCH[1]}"
    alias_params="${BASH_REMATCH[3]:-}"

    if [[ ! "$derecha" =~ $re_derecha ]]; then
      anotar_error "${nro}" "El lado derecho no es una referencia simple \`${espacio}.X\`. Componer, envolver o especializar un tipo del contrato acá lo convierte en otro tipo." "${linea}"
      continue
    fi
    ns_nombre="${BASH_REMATCH[1]}"
    origen_nombre="${BASH_REMATCH[2]}"
    origen_params="${BASH_REMATCH[4]:-}"

    if [ "$ns_nombre" != "$espacio" ]; then
      anotar_error "${nro}" "Reexporta desde el espacio de nombres \`${ns_nombre}\`, pero el contrato vive en \`${espacio}\`." "${linea}"
      continue
    fi

    # c. Ni renombres ni especializaciones: el nombre y los parámetros pasan
    #    tal cual. Un alias con otro nombre hace que la superficie declarada y
    #    el contrato dejen de ser comparables a simple vista.
    if [ "$alias_nombre" != "$origen_nombre" ]; then
      anotar_error "${nro}" "Renombra \`${origen_nombre}\` como \`${alias_nombre}\`. La reexportación tiene que conservar el nombre del contrato." "${linea}"
      continue
    fi

    p_izq=$(nombres_de_parametros "$alias_params")
    p_der=$(nombres_de_parametros "$origen_params")
    if [ "$p_izq" != "$p_der" ]; then
      anotar_error "${nro}" "Los parámetros genéricos no pasan tal cual (declara \`<${alias_params}>\`, aplica \`<${origen_params}>\`). Especializar un genérico del contrato crea un tipo nuevo." "${linea}"
      continue
    fi

    # d. Lo que reexporta tiene que existir en la fuente normativa.
    if ! grep -qxF "$origen_nombre" <<< "$del_contrato"; then
      anotar_error "${nro}" "\`${origen_nombre}\` no existe en ${fuente}. O la frontera inventó un símbolo, o el contrato lo quitó sin que esta frontera se actualizara. MANDA LA FUENTE." "${linea}"
      continue
    fi

    reexportados+=("$origen_nombre")
  done < <(lineas_con_contenido "$archivo")

  if [ "$cantidad_importes" -eq 0 ]; then
    anotar_error "1" "No importa nada de \`${origen}\`. Un archivo de reexportación sin importe no reexporta el contrato: lo perdió."
  fi

  if [ "${#reexportados[@]}" -eq 0 ]; then
    anotar_error "1" "No reexporta ni un símbolo del contrato. Si la frontera dejó de usar el contrato, se quita la entrada de este script en el mismo PR y se explica por qué."
  fi

  # e. Cobertura obligatoria.
  for regla in "${COBERTURA_OBLIGATORIA[@]}"; do
    IFS='|' read -r regla_archivo patron <<< "$regla"
    if [ "$regla_archivo" != "$archivo" ]; then
      continue
    fi
    while read -r simbolo; do
      if [ -z "$simbolo" ]; then
        continue
      fi
      exceptuado=""
      for excepcion in "${EXCEPCIONES_DE_COBERTURA[@]}"; do
        IFS='|' read -r exc_archivo exc_simbolo exc_motivo <<< "$excepcion"
        if [ "$exc_archivo" = "$archivo" ] && [ "$exc_simbolo" = "$simbolo" ]; then
          exceptuado="$exc_motivo"
        fi
      done
      if [ -n "$exceptuado" ]; then
        echo "    excepción de cobertura: ${simbolo} no se reexporta — ${exceptuado}"
        continue
      fi
      hallado=""
      for r in "${reexportados[@]}"; do
        if [ "$r" = "$simbolo" ]; then
          hallado="si"
        fi
      done
      if [ -z "$hallado" ]; then
        anotar_error "1" "El contrato declara \`${simbolo}\` (coincide con /${patron}/) y esta frontera no lo reexporta. Si el puerto es de esta frontera, agregá la línea; si no lo es, anotá la excepción con su motivo en EXCEPCIONES_DE_COBERTURA."
      fi
    done <<< "$(grep -E "$patron" <<< "$del_contrato" || true)"
  done

  if [ "${#errores_archivo[@]}" -eq 0 ]; then
    echo "OK  ${archivo} reexporta ${#reexportados[@]} símbolo(s) de ${fuente} sin declarar nada propio"
    resumen "| \`${fuente}\` | \`${archivo}\` | reexportación | verificada — ${#reexportados[@]} símbolo(s), 0 declaraciones propias |"
  else
    fallas=$((fallas + 1))
    resumen "| \`${fuente}\` | \`${archivo}\` | reexportación | **DERIVA** — ${#errores_archivo[@]} problema(s) |"
    {
      echo "::error file=${archivo}::La reexportación del contrato se apartó del contrato aprobado."
      echo ""
      echo "  Fuente normativa : ${fuente}   sha256 $(huella "$fuente")"
      echo "  Reexportación    : ${archivo}"
      echo ""
      echo "  Este archivo NO es una copia del contrato y no debe serlo: las marcas"
      echo "  nominales (\`unique symbol\`) no sobreviven a dos copias. Tiene que ser una"
      echo "  reexportación pura de \`${origen}\`, y eso es lo que falló:"
      echo ""
      for e in "${errores_archivo[@]}"; do
        IFS="$US" read -r e_nro e_msg e_linea <<< "$e"
        echo "::error file=${archivo},line=${e_nro}::${e_msg}"
        echo "    ${archivo}:${e_nro}  ${e_msg}"
        if [ -n "$e_linea" ]; then
          echo "        ${e_linea}"
        fi
      done
      echo ""
      echo "  MANDA LA FUENTE: ${fuente}."
      echo "  Si el cambio es correcto, lo escribe el 'arquitecto' en specs/contratos/, pasa"
      echo "  por compuerta, 'dev-dominio' actualiza la copia de packages/shared y recién"
      echo "  ahí 'dev-integraciones' ajusta esta reexportación, todo en el mismo PR."
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
