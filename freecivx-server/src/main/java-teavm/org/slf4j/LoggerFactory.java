/**
 * TeaVM stub for org.slf4j.LoggerFactory.
 * Returns a {@link java.util.logging.Logger}-backed {@link Logger} so that
 * log calls compiled to JavaScript are forwarded to the browser console via
 * TeaVM's {@code java.util.logging} classlib mapping.
 * SLF4J-style {@code {}} placeholders are expanded before the message is
 * passed to JUL.
 */
package org.slf4j;

import java.util.logging.Level;

public final class LoggerFactory {

    private LoggerFactory() {}

    public static Logger getLogger(Class<?> clazz) {
        return new JulLogger(java.util.logging.Logger.getLogger(clazz.getName()));
    }

    public static Logger getLogger(String name) {
        return new JulLogger(java.util.logging.Logger.getLogger(name));
    }

    /** Expands SLF4J-style {@code {}} positional placeholders in {@code fmt}. */
    static String format(String fmt, Object... args) {
        if (args == null || args.length == 0 || fmt == null) return fmt;
        StringBuilder sb = new StringBuilder(fmt.length() + 32);
        int argIdx = 0;
        int i = 0;
        while (i < fmt.length()) {
            int idx = fmt.indexOf("{}", i);
            if (idx < 0 || argIdx >= args.length) {
                sb.append(fmt, i, fmt.length());
                break;
            }
            sb.append(fmt, i, idx);
            sb.append(args[argIdx++]);
            i = idx + 2;
        }
        return sb.toString();
    }

    private static final class JulLogger implements Logger {

        private final java.util.logging.Logger jul;

        JulLogger(java.util.logging.Logger jul) {
            this.jul = jul;
        }

        // ---- trace → JUL FINE ----
        public void trace(String msg)                            { jul.fine(msg); }
        public void trace(String f, Object a)                   { jul.fine(format(f, a)); }
        public void trace(String f, Object a, Object b)         { jul.fine(format(f, a, b)); }
        public void trace(String f, Object... a)                { jul.fine(format(f, a)); }
        public void trace(String msg, Throwable t)              { jul.log(Level.FINE, msg, t); }
        public boolean isTraceEnabled()                         { return jul.isLoggable(Level.FINE); }

        // ---- debug → JUL FINE ----
        public void debug(String msg)                           { jul.fine(msg); }
        public void debug(String f, Object a)                   { jul.fine(format(f, a)); }
        public void debug(String f, Object a, Object b)         { jul.fine(format(f, a, b)); }
        public void debug(String f, Object... a)                { jul.fine(format(f, a)); }
        public void debug(String msg, Throwable t)              { jul.log(Level.FINE, msg, t); }
        public boolean isDebugEnabled()                         { return jul.isLoggable(Level.FINE); }

        // ---- info → JUL INFO ----
        public void info(String msg)                            { jul.info(msg); }
        public void info(String f, Object a)                    { jul.info(format(f, a)); }
        public void info(String f, Object a, Object b)          { jul.info(format(f, a, b)); }
        public void info(String f, Object... a)                 { jul.info(format(f, a)); }
        public void info(String msg, Throwable t)               { jul.log(Level.INFO, msg, t); }
        public boolean isInfoEnabled()                          { return jul.isLoggable(Level.INFO); }

        // ---- warn → JUL WARNING ----
        public void warn(String msg)                            { jul.warning(msg); }
        public void warn(String f, Object a)                    { jul.warning(format(f, a)); }
        public void warn(String f, Object a, Object b)          { jul.warning(format(f, a, b)); }
        public void warn(String f, Object... a)                 { jul.warning(format(f, a)); }
        public void warn(String msg, Throwable t)               { jul.log(Level.WARNING, msg, t); }
        public boolean isWarnEnabled()                          { return jul.isLoggable(Level.WARNING); }

        // ---- error → JUL SEVERE ----
        public void error(String msg)                           { jul.severe(msg); }
        public void error(String f, Object a)                   { jul.severe(format(f, a)); }
        public void error(String f, Object a, Object b)         { jul.severe(format(f, a, b)); }
        public void error(String f, Object... a)                { jul.severe(format(f, a)); }
        public void error(String msg, Throwable t)              { jul.log(Level.SEVERE, msg, t); }
        public boolean isErrorEnabled()                         { return jul.isLoggable(Level.SEVERE); }
    }
}
