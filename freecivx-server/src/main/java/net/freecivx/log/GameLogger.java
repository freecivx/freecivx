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

package net.freecivx.log;

/** A logging facade to integrate with runtime-preferred logging mechanism. */
public sealed interface GameLogger permits  StdoutLogger {
// TODO Add Slf4jLogger

    enum LogLevel {
        DEBUG,
        INFO,
        WARN,
        ERROR
    }

    void debug(String message);

    void debug(String message, Throwable err);

    void info(String message);

    void error(String message);

    void error(String message, Throwable err);

    void warning(String message);

    void warning(String message, Throwable err);
}