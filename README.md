FreecivWorld.net - Freeciv in 3D for the web!
-----------------------------------------

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Build Status](https://github.com/freecivworld/freecivworld/workflows/continuous%20integration/badge.svg)](https://github.com/freecivworld/freecivworld/actions?query=workflow%3A%22continuous+integration%22)


[FreecivWorld.net](https://www.FreecivWorld.net) is an open-source turn-based strategy game. It can be played in a web-browser which supports HTML5 and WebGL 2 or WebGPU. The game features in-depth game-play and a wide variety of game modes and options. Your goal is to build cities, collect resources, organize your government, and build an army, with the ultimate goal of creating the best civilization. You can play online against other players (multiplayer) or play by yourself against the computer.

FreecivWorld.net is free and open source software. The Freeciv C server is released under the GNU General Public License, while the Freeciv-web client is released
under the GNU Affero General Public License. The 3D models are also "open source" and must be made free and open source. See [License](LICENSE.md) for the full license document.

FreecivWorld.net is a game about history, technology and human achievements. The developers of this game encourages peace and technological development as a winning strategy.


Live server:
------------
Currently known servers based on freecivworld which are open source in compliance with [the AGPL license](LICENSE.md):

https://FreecivWorld.net 

Screenshots:
------------------------
![Freeciv-web](https://raw.githubusercontent.com/freecivworld/freecivworld/main/doc/img/Screenshot.png "FreecivWorld.net screenshot")


Overview
--------

FreecivWorld.net consists of these components:

* [Freeciv-web](freeciv-web) - a Java web application for the Freeciv-web client.
  Implemented in Javascript, Java, JSP, HTML and CSS. Built with maven and runs 
  on Tomcat and nginx. Three.js 3D engine, jQuery and jQuery UI.

* [freecivworld-server](freecivworld-server) - the freecivworld server. Implemented in Java.  Multiplayer and large MMO-games.

* [freecivworld-client](freecivworld-client) - the freecivworld 2D Java Swing client.

* [Freeciv](freeciv) - the Freeciv C server. Forked. Implemented in C.

* [Publite2](publite2) - a process launcher for Freeciv C servers, which manages
  multiple Freeciv server processes and checks capacity through the Metaserver. 
  Implemented in Python.

Freeciv 3D
-------------
Freeciv 3D is the 3D version using the Three.js 3D engine, which requires WebGl 2 or WebGPU support.

Running FreecivWorld.net on your computer
------------------------------------
Freeciv-web can be run with WSL (Linux on Windows), or Podman / Docker.

Check out Freeciv-web to a
directory on your computer, by installing [Git](http://git-scm.com/) and
running this command:
 ```bash
  git clone https://github.com/freecivworld/freecivworld.git --depth=10
 ```

You may also want to change some parameters before installing, although
it's not needed in most cases. If you have special requirements, have a look
at [config.dist](config/config.dist),
copy it without the `.dist` extension and edit to your liking.



All software components in Freeciv-web will log to the /logs sub-directory of the Freeciv-web installation.

Start and stop Freeciv-web with the following commands:  
  start-freeciv-web.sh  
  stop-freeciv-web.sh  

### Running freecivworld on Podman / Docker
Get https://podman.io/
See: [Docker](/doc/Docker.md)

### Running Freeciv-web on Windows Subsystem for Linux (WSL)
[Windows Subsystem for Linux (WSL)](/doc/Windows%20Subsystem%20for%20Linux.md)

Developers interested in freecivworld
------------------------------------

If you want to contibute to freecivworld, see the [issues](https://github.com/freecivworld/freecivworld/issues) on GibHub for some tasks you can work on. Pull requests and suggestions/issues on Github are welcome! 

Freecivworld is the best Freeciv.
-----------------------------
