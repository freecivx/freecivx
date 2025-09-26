Freecivx.net 3D web application 
=======================

This is the Freecivx.net 3D web application, which consists of the Java servlets 
and filters for running the web client, JSP templates, javascript code
and other web content. 

This will use MySQL for production database, and H2 for local development (Docker using install.sh --mode=TEST).

Derived Sources
===============

Freeciv-web uses packet definitions, tilesets, and other resources
derived from the original freeciv project, keeping these up to date by
generating them during install from freeciv source.

Scripts to generate these files are in `$freeciv-web/scripts` and they
are generated to `$freeciv-web/freeciv-web/src/derived`. See the
README.md in those directories for more info.

Tomcat + nginx setup
================================
Freeciv-web supports the Tomcat  application server for hosting the Java web application.

The build scripts are updated to build Freeciv-web for Tomcat by default,
so setting up Freeciv-web with Vagrant will configure this automatically.
Also see the suggested nginx.conf file in publite2/nginx.conf

  https://tomcat.apache.org/  
  http://nginx.org/  

Build script
============
Use maven to build and deploy, by running this build script: 
sh build.sh

There is also a build-js.sh script to build just JavaScript quickly for development work.

The build script will also create a data webapp directory where savegames and scorelogs are stored.

Flyway migrations of the database is supported. Remember to set the mysql password in flyway.properties.dist and rename the file to flyway.properties.
To migrate the database to the latest version, run this Maven command:
mvn flyway:migrate

License
=======
Freeciv-web has the GNU Affero General Public License.
https://github.com/freecivx/freecivx/blob/main/freeciv-web/src/main/webapp/gltf/LICENSE-AGPL.txt

The 3d models have Creative Commons Attribution-ShareAlike (CC BY-SA) license.
https://github.com/freecivx/freecivx/blob/main/freeciv-web/src/main/webapp/gltf/LICENSE-CC-BY-SA.txt


See LICENSE-AGPL.txt and LICENSE-CC-BY-SA.txt for the license of these models.


Copyright (C) 2007-2024 Andreas Røsdal. 
Released under the GNU AFFERO GENERAL PUBLIC LICENSE.

Source code, 3D models and all files part of Freeciv 3D / FreecivX.net are covered by the GNU AFFERO GENERAL PUBLIC LICENSE.
See LICENSE.txt for the AGPL license of Freeciv 3D / FreecivX.net. This license means that these 3D models
are free and open source, and that any modifications and redistributions must also be
free and open source, with the AGPL license.
