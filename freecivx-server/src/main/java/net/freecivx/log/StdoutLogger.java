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

public final class StdoutLogger implements GameLogger {
  private final LogLevel level;

  public StdoutLogger(LogLevel level) {
    this.level = level;
  }

  @Override
  public void debug(String message) {
    if (level.ordinal() == LogLevel.DEBUG.ordinal()) {
      System.out.println("[DEBUG] " + message);
    }
  }

  @Override
  public void debug(String message, Throwable err) {
    if (level.ordinal() == LogLevel.DEBUG.ordinal()) {
      System.out.println("[DEBUG] " + message);
      err.printStackTrace(System.out);
    }
  }

  @Override
  public void info(String message) {
    if (level.ordinal() <= LogLevel.INFO.ordinal()) {
      System.out.println("[INFO] " + message);
    }
  }

  @Override
  public void warning(String message) {
    if (level.ordinal() <= LogLevel.WARN.ordinal()) {
      System.out.println("[WARN] " + message);
    }
  }

  @Override
  public void warning(String message, Throwable err) {
    if (level.ordinal() <= LogLevel.WARN.ordinal()) {
      System.out.println("[WARN] " + message);
      err.printStackTrace(System.out);
    }
  }

  @Override
  public void error(String message) {
    if (level.ordinal() <= LogLevel.ERROR.ordinal()) {
      System.out.println("[ERROR] " + message);
    }
  }

  @Override
  public void error(String message, Throwable err) {
    if (level.ordinal() <= LogLevel.ERROR.ordinal()) {
      System.out.println("[ERROR] " + message);
      err.printStackTrace(System.out);
    }
  }
}
