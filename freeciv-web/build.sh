#!/bin/bash
# builds Freeciv-web and copies the war file to Tomcat.

BATCH_MODE=""
SKIP_MINIFY_OPT=""

while [[ $# -gt 0 ]]; do
  case $1 in
    -B) BATCH_MODE="-B"; shift;;
    --skip-minify) SKIP_MINIFY_OPT="-Dskip-minify-js=true"; shift;;
    *) echo "Unrecognized argument: $1"; shift;;
  esac
done

# Use environment variable if set and not overridden by command line
if [ -z "${SKIP_MINIFY_OPT}" ] && [ "${SKIP_MINIFY:-}" = "true" ]; then
  SKIP_MINIFY_OPT="-Dskip-minify-js=true"
fi

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null && pwd)"

TOMCATDIR="/var/lib/tomcat11"
WEBAPP_DIR="${DIR}/target/freeciv-web"

# Creating build.txt info file
REVTMP="$(git rev-parse HEAD 2>/dev/null)"
if test "x$REVTMP" != "x" ; then
  # This is build from git repository.
  mkdir -p "${WEBAPP_DIR}"
  echo "This build is from freeciv-web commit: $REVTMP" > "${WEBAPP_DIR}/build.txt"
  if ! test $(git diff | wc -l) -eq 0 ; then
    echo "It had local modifications." >> "${WEBAPP_DIR}/build.txt"
  fi
  date >> "${WEBAPP_DIR}/build.txt"
else
  rm -f "${WEBAPP_DIR}/build.txt"
fi

echo "maven package"
mvn ${BATCH_MODE} ${SKIP_MINIFY_OPT} -Dflyway.configFiles=./flyway.properties flyway:migrate package && \
echo "Copying target/freeciv-web.war to ${TOMCATDIR}/webapps" && \
  cp target/freeciv-web.war "${TOMCATDIR}/webapps/"
