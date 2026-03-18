Freecivx.com - Freeciv in 3D for the web!
-----------------------------------------

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Build Status](https://github.com/freecivworld/freecivworld/workflows/continuous%20integration/badge.svg)](https://github.com/freecivworld/freecivworld/actions?query=workflow%3A%22continuous+integration%22)
[![Codacy Badge](https://app.codacy.com/project/badge/Grade/70b76d922923473d8793e0019f157992)](https://app.codacy.com/gh/freecivworld/freecivworld/dashboard?utm_source=gh&utm_medium=referral&utm_content=&utm_campaign=Badge_grade)


[Freecivx.com](https://www.freecivx.com) is an open-source turn-based strategy game. It can be played in a web-browser which supports HTML5 and WebGPU. The game features in-depth game-play and a wide variety of game modes and options. Your goal is to build cities, collect resources, organize your government, and build an army, with the ultimate goal of creating the best civilization. You can play online against other players (multiplayer) or play by yourself against the computer.

Freecivx.com is free and open source software. The Freeciv C server is released under the GNU General Public License, while the Freeciv-web client is released
under the GNU Affero General Public License. The 3D models are also "open source" and must be made free and open source. See [License](LICENSE.md) for the full license document.

Freecivx.com is a game about history, technology and human achievements. The developers of this game encourages peace and technological development as a winning strategy.


Live server:
------------
Currently known servers based on Freecivx which are open source in compliance with [the AGPL license](LICENSE.md):

https://freecivx.com 

Screenshots:
------------------------
![Freeciv-web](https://raw.githubusercontent.com/freecivx/freecivx/main/doc/img/Screenshot.png "Freecivx.com screenshot")


Overview
--------

Freecivx.com consists of these components:

* [Freeciv-web](freeciv-web) - a Java web application for the Freeciv-web client.
  Implemented in Javascript, Java, JSP, HTML and CSS. Built with maven and runs 
  on Tomcat and nginx. Three.js 3D engine, jQuery and jQuery UI.

* [Freeciv](freeciv) - the Freeciv C server. Forked. Implemented in C.

* [Publite-go](publite-go) - a process launcher for Freeciv C servers, which manages
  multiple Freeciv server processes and checks capacity through the Metaserver. 
  Implemented in Go.

* [freecivx-server](freecivx-server) - Freeciv Java server.

  

Freeciv 3D
-------------
Freeciv 3D is the 3D version using the Three.js 3D engine, which requires WebGPU support.

Running Freecivx.com on your computer
------------------------------------
Freeciv-web can be run with WSL (Linux on Windows), or Podman / Docker.

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

Start and stop Freeciv-web with the following commands:  
  start-freeciv-web.sh  
  stop-freeciv-web.sh  

### Running Freecivx on Podman / Docker
Get https://podman.io/
See: [Podman / Docker](/doc/PodmanDocker.md)

### Running Freeciv-web on Windows Subsystem for Linux (WSL)
[Windows Subsystem for Linux (WSL)](/doc/Windows%20Subsystem%20for%20Linux.md)

Developers interested in Freecivx
------------------------------------

If you want to contibute to freecivworld, see the [issues](https://github.com/freecivworld/freecivworld/issues) on GibHub for some tasks you can work on. Pull requests and suggestions/issues on Github are welcome! 

Freecivx is the best Freeciv. 
-----------------------------
