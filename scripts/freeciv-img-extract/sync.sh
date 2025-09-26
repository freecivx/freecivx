#!/bin/bash

resolve() { echo "$(cd "$1" >/dev/null && pwd)"; }
while [[ $# -gt 0 ]]; do
  case $1 in
    -f) FREECIV_DIR=$(resolve "$2"); shift; shift;;
    -o) WEBAPP_DIR=$(resolve "$2"); shift; shift;;
    *) echo "Unrecognized argument: $1"; shift;;
  esac
done
: ${FREECIV_DIR:?Must specify (original) freeciv project dir with -f}
: ${WEBAPP_DIR:?Must specify existing freeciv-web (webapp) dir with -o}

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null && pwd)"

TILESET_DEST="${WEBAPP_DIR}/tileset"
SPEC_DEST="${WEBAPP_DIR}/javascript/2dcanvas"
FLAG_DEST="${WEBAPP_DIR}/images/flags"

TEMP_DIR=$(mktemp -d -t 'freeciv-img-extract.XXX')

echo "running Freeciv-img-extract..."
echo "  extracting to ${TEMP_DIR}"
mkdir -p "${TILESET_DEST}" "${SPEC_DEST}" "${FLAG_DEST}" &&
python3 "${DIR}"/img-extract.py -f "${FREECIV_DIR}" -o "${TILESET_DEST}" &&
cp "${TILESET_DEST}"/tileset_spec_*.js "${SPEC_DEST}" &&
#echo "converting flag .svg files to .png ..." &&
echo "copying flag .svg files ..." &&
(for svgfile in $(find "${FREECIV_DIR}"/data/flags/*.svg); do
  name="$(basename "$svgfile")"
  pngfile="${FLAG_DEST}/${name/%.svg/-web.png}"
  #timeout -k 3 8 convert -density 80 -resize 200 "$svgfile" "${pngfile}" ||
  #  >&2 echo "  ERROR converting ${svgfile} to ${pngfile}"
  cp "$svgfile" "$FLAG_DEST"
done) &&
echo "Freeciv-img-extract done." || (>&2 echo "Freeciv-img-extract failed!" && exit 1)
