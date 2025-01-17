FREECIVX.NET - Freeciv in 3D for the web!
-----------------------------------------

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Build Status](https://github.com/freecivx/freecivx/workflows/continuous%20integration/badge.svg)](https://github.com/freecivx/freecivx/actions?query=workflow%3A%22continuous+integration%22)
[![CodeFactor](https://www.codefactor.io/repository/github/freecivx/freecivx/badge)](https://www.codefactor.io/repository/github/freecivx/freecivx)
[![Codacy Badge](https://app.codacy.com/project/badge/Grade/8656b7ce58e3438a81cb4ed037c7580e)](https://app.codacy.com/gh/freecivx/freecivx/dashboard?utm_source=gh&utm_medium=referral&utm_content=&utm_campaign=Badge_grade)


[FreecivX.net](https://www.freecivx.net) is an open-source turn-based strategy game. It can be played in a web-browser which supports HTML5 and WebGL 2 or WebGPU. The game features in-depth game-play and a wide variety of game modes and options. Your goal is to build cities, collect resources, organize your government, and build an army, with the ultimate goal of creating the best civilization. You can play online against other players (multiplayer) or play by yourself against the computer.

FreecivX.net is free and open source software. The Freeciv C server is released under the GNU General Public License, while the Freeciv-web client is released
under the GNU Affero General Public License. The 3D models are also "open source" and must be made free and open source. See [License](LICENSE.md) for the full license document.

FreecivX.net is a game about history, technology and human achievements. The developers of this game encourages peace and technological development as a winning strategy.


Live servers
------------
Currently known servers based on FreecivX.net / Freeciv-web, which are open source in compliance with [the AGPL license](LICENSE.md):

https://Freecivx.net 

Screenshots:
------------------------
![Freeciv-web](https://raw.githubusercontent.com/freecivx/freecivx/main/doc/img/Screenshot.png "FREECIVX.NET screenshot")


Overview
--------

FreecivX.net consists of these components:

* [Freeciv-web](freeciv-web) - a Java web application for the Freeciv-web client.
  This application is a Java web application which make up the application
  viewed in each user's web browser. The Metaserver is also a part of this module.
  Implemented in Javascript, Java, JSP, HTML and CSS. Built with maven and runs 
  on Tomcat and nginx.

* [Freeciv](freeciv) - the Freeciv C server, which is checked out from the official
  Git repository, and patched to work with a WebSocket/JSON protocol. Implemented in C.

* [Publite2](publite2) - a process launcher for Freeciv C servers, which manages
  multiple Freeciv server processes and checks capacity through the Metaserver. 
  Implemented in Python.

Freeciv 3D
-------------
Freeciv 3D is the 3D version using the Three.js 3D engine, which requires WebGl 2 or WebGPU support.

Running FreecivX.net on your computer
------------------------------------
The recommended and probably easiest way is to use Docker. Freeciv-web can also be run with WSL. In some cases it may be easier.

Check out Freeciv-web to a
directory on your computer, by installing [Git](http://git-scm.com/) and
running this command:
 ```bash
  git clone https://github.com/freecivx/freecivx.git --depth=10
 ```

You may also want to change some parameters before installing, although
it's not needed in most cases. If you have special requirements, have a look
at [config.dist](config/config.dist),
copy it without the `.dist` extension and edit to your liking.



All software components in Freeciv-web will log to the /logs sub-directory of the Freeciv-web installation.

Start and stop Freeciv-web with the following commands:  
  start-freeciv-web.sh  
  stop-freeciv-web.sh  
  status-freeciv-web.sh

### Running Freecivx on Podman / Docker
Get https://podman.io/
See: [Docker](/doc/Docker.md)

### Running Freeciv-web on Windows Subsystem for Linux (WSL)
[Windows Subsystem for Linux (WSL)](/doc/Windows%20Subsystem%20for%20Linux.md)

Developers interested in Freecivx
------------------------------------

If you want to contibute to Freecivx, see the [issues](https://github.com/freecivx/freecivx/issues) on GibHub for some tasks you can work on. Pull requests and suggestions/issues on Github are welcome! 


Contributors to Freeciv-web
---------------------------
Andreas Røsdal  [@andreasrosdal](https://github.com/andreasrosdal)  
Marko Lindqvist [@cazfi](https://github.com/cazfi)  
Sveinung Kvilhaugsvik [@kvilhaugsvik](https://github.com/kvilhaugsvik)  
Gerik Bonaert [@adaxi](https://github.com/adaxi)  
Lmoureaux [@lmoureaux](https://github.com/lmoureaux)  
Máximo Castañeda [@lonemadmax](https://github.com/lonemadmax)  
and the [Freeciv.org project](https://www.freeciv.org/wiki/People)!
