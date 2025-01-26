/* Copyright (C) The Authors 2025 */
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
