package net.freecivx.log;

/** A logging facade to integrate with runtime-preferred logging mechanism. */
public sealed interface GameLogger permits NoopLogger, StdoutLogger {
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