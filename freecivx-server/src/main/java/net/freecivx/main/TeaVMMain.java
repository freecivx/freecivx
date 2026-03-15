/**********************************************************************
 Freecivx - the 3D web version of Freeciv. http://www.FreecivWorld.net/
 Copyright (C) 2009-2025  The Freeciv-web project, Andreas Røsdal

 This program is free software: you can redistribute it and/or modify
 it under the terms of the GNU Affero General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.

 This program is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU Affero General Public License for more details.

 You should have received a copy of the GNU Affero General Public License
 along with this program.  If not, see <http://www.gnu.org/licenses/>.

 ***********************************************************************/

package net.freecivx.main;

/**
 * Entry point for the TeaVM build of freecivx-server.
 *
 * <p>TeaVM compiles Java bytecode to JavaScript, allowing the game logic to run
 * in a browser or Node.js environment. This entry point is used when building
 * with the {@code teavm} Maven profile ({@code mvn package -P teavm}).
 *
 * <p>Unlike the standard {@link Main} class, this entry point avoids
 * server-side Java APIs (HTTP server, Java-WebSocket) that are not supported
 * by TeaVM and instead relies on native JavaScript networking.
 */
public class TeaVMMain {

    /**
     * TeaVM entry point. Initialises the game logic for the JavaScript build.
     *
     * @param args command-line arguments (unused in the JavaScript environment)
     */
    public static void main(String[] args) {
        // TeaVM entry point — networking is provided by the surrounding
        // JavaScript environment rather than Java server libraries.
        System.out.println("FreecivX server (TeaVM/JavaScript build) starting...");
    }
}
