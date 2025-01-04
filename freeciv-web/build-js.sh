#!/bin/bash
# builds javascript files Freeciv-web and copies the resulting file to tomcat.

FCW_DEST=/var/lib/tomcat11/webapps/freeciv-web

mvn compile && \
echo "Copying target/freeciv-web/javascript/webclient.* to ${FCW_DEST}/javascript" && \
  cp target/freeciv-web/javascript/webclient.* "${FCW_DEST}"/javascript/ 

# update timestamp to clear browser cache.
sed -i.bak -e "s/ts=\"/ts=\"1/" -e "s/\?ts=/\?ts=1/" "${FCW_DEST}"/webclient/index.jsp

cp src/main/webapp/javascript/webgl/shaders_square/*.* "${FCW_DEST}"/javascript/webgl/shaders_square/
cp src/main/webapp/javascript/webgl/libs/*.* "${FCW_DEST}"/javascript/webgl/libs/
