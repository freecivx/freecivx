/**********************************************************************
 Freecivx - the 3D web version of Freeciv. http://www.Freecivx.net/
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

public final class NoopLogger implements GameLogger {
  @Override
  public void debug(String message) {}

  @Override
  public void debug(String message, Throwable err) {}

  @Override
  public void info(String message) {}

  @Override
  public void error(String message) {}

  @Override
  public void error(String message, Throwable err) {}

  @Override
  public void warning(String message) {}

  @Override
  public void warning(String message, Throwable err) {}
}
