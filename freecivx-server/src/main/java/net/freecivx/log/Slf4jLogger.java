/**********************************************************************
 Freecivx - the 3D web version of Freeciv. http://www.freecivx.com/
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

import org.slf4j.Logger;

/** A {@link GameLogger} that delegates to an SLF4J {@link Logger}. */
public final class Slf4jLogger implements GameLogger {

    private final Logger delegate;

    public Slf4jLogger(Logger delegate) {
        this.delegate = delegate;
    }

    @Override
    public void debug(String message) {
        delegate.debug(message);
    }

    @Override
    public void debug(String message, Throwable err) {
        delegate.debug(message, err);
    }

    @Override
    public void info(String message) {
        delegate.info(message);
    }

    @Override
    public void warning(String message) {
        delegate.warn(message);
    }

    @Override
    public void warning(String message, Throwable err) {
        delegate.warn(message, err);
    }

    @Override
    public void error(String message) {
        delegate.error(message);
    }

    @Override
    public void error(String message, Throwable err) {
        delegate.error(message, err);
    }
}
