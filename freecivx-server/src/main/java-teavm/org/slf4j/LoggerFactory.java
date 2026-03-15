/**
 * TeaVM no-op stub for org.slf4j.LoggerFactory.
 * Returns a silent no-op logger so that classes compiled to JavaScript do not
 * pull in java.util.concurrent classes that are absent from TeaVM's classlib.
 */
package org.slf4j;

public final class LoggerFactory {

    private static final Logger NOP = new Logger() {
        public void trace(String msg) {}
        public void trace(String f, Object a) {}
        public void trace(String f, Object a, Object b) {}
        public void trace(String f, Object... a) {}
        public void trace(String msg, Throwable t) {}
        public boolean isTraceEnabled() { return false; }

        public void debug(String msg) {}
        public void debug(String f, Object a) {}
        public void debug(String f, Object a, Object b) {}
        public void debug(String f, Object... a) {}
        public void debug(String msg, Throwable t) {}
        public boolean isDebugEnabled() { return false; }

        public void info(String msg) {}
        public void info(String f, Object a) {}
        public void info(String f, Object a, Object b) {}
        public void info(String f, Object... a) {}
        public void info(String msg, Throwable t) {}
        public boolean isInfoEnabled() { return false; }

        public void warn(String msg) {}
        public void warn(String f, Object a) {}
        public void warn(String f, Object a, Object b) {}
        public void warn(String f, Object... a) {}
        public void warn(String msg, Throwable t) {}
        public boolean isWarnEnabled() { return false; }

        public void error(String msg) {}
        public void error(String f, Object a) {}
        public void error(String f, Object a, Object b) {}
        public void error(String f, Object... a) {}
        public void error(String msg, Throwable t) {}
        public boolean isErrorEnabled() { return false; }
    };

    private LoggerFactory() {}

    public static Logger getLogger(Class<?> clazz) {
        return NOP;
    }

    public static Logger getLogger(String name) {
        return NOP;
    }
}
