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

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public final class Slf4jLogger implements GameLogger {
    private final Logger logger;

    public Slf4jLogger(Class<?> clazz) {
        this.logger = LoggerFactory.getLogger(clazz);
    }

    public Slf4jLogger(String name) {
        this.logger = LoggerFactory.getLogger(name);
    }

    @Override
    public void debug(String message) {
        logger.debug(message);
    }

    @Override
    public void debug(String message, Throwable err) {
        logger.debug(message, err);
    }

    @Override
    public void info(String message) {
        logger.info(message);
    }

    @Override
    public void error(String message) {
        logger.error(message);
    }

    @Override
    public void error(String message, Throwable err) {
        logger.error(message, err);
    }

    @Override
    public void warning(String message) {
        logger.warn(message);
    }

    @Override
    public void warning(String message, Throwable err) {
        logger.warn(message, err);
    }
}
