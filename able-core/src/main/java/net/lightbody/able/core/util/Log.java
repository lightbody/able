package net.lightbody.able.core.util;

import java.util.logging.*;

public class Log {
    static {
        Logger logger = Logger.getLogger("");
        Handler[] handlers = logger.getHandlers();
        for (Handler handler : handlers) {
            logger.removeHandler(handler);
        }

        ConsoleHandler handler = new ConsoleHandler();
        handler.setFormatter(new StandardFormatter());
        handler.setLevel(Level.FINE);
        logger.addHandler(handler);

        // tell commons-logging to use the JDK logging (otherwise it would default to log4j
        System.setProperty("org.apache.commons.logging.Log", "org.apache.commons.logging.impl.Jdk14Logger");
    }

    protected Logger logger;
    private String className;

    public Log() {
        Exception e = new Exception();
        className = e.getStackTrace()[1].getClassName();
        logger = Logger.getLogger(className);
    }

    public Log(Class clazz) {
        className = clazz.getName();
        logger = Logger.getLogger(className);
    }

    public void severe(String msg, Throwable e) {
        log(Level.SEVERE, msg, e);
    }

    public void severe(String msg, Object... args) {
        log(Level.SEVERE, msg, args);
    }

    public void severe(String msg, Throwable e, Object... args) {
        log(Level.SEVERE, msg, e, args);
    }

    public RuntimeException severeAndRethrow(String msg, Throwable e, Object... args) {
        log(Level.SEVERE, msg, e, args);

        //noinspection ThrowableInstanceNeverThrown
        return new RuntimeException(new java.util.Formatter().format(msg, args).toString());
    }

    public void warn(String msg, Throwable e) {
        log(Level.WARNING, msg, e);
    }

    public void warn(String msg, Object... args) {
        log(Level.WARNING, msg, args);
    }

    public void warn(String msg, Throwable e, Object... args) {
        log(Level.WARNING, msg, e, args);
    }

    public void info(String msg, Throwable e) {
        log(Level.INFO, msg, e);
    }

    public void info(String msg, Object... args) {
        log(Level.INFO, msg, args);
    }

    public void info(String msg, Throwable e, Object... args) {
        log(Level.INFO, msg, e, args);
    }

    public void fine(String msg, Throwable e) {
        log(Level.FINE, msg, e);
    }

    /**
     * debug method is a synonym for fine
     * @param msg
     * @param args
     */
    public void debug(String msg, Object... args) {
        fine(msg, args);
    }

    public void fine(String msg, Object... args) {
        log(Level.FINE, msg, args);
    }

    public void fine(String msg, Throwable e, Object... args) {
        log(Level.FINE, msg, e, args);
    }

    private void log(Level level, String msg, Throwable e) {
        logger.log(level, msg, e);
    }

    private void log(Level level, String msg, Object... args) {
        logger.log(level, msg, args);
    }

    private void log(Level level, String msg, Throwable e, Object... args) {
        LogRecord lr = new LogRecord(level, msg);
        lr.setThrown(e);
        lr.setParameters(args);
        lr.setSourceMethodName("");
        lr.setSourceClassName(className);
        lr.setLoggerName(className);
        logger.log(lr);
    }

    /**
     * return true if debug level logging is currently enabled
     * @return boolean
     */
    public boolean isDebugEnabled() {
        boolean ret = false;

        Level level = getLevel();
        if (level != null) {
            if (Level.FINE.equals(level) || Level.FINER.equals(level) || Level.FINEST.equals(level))
                ret = true;
        }

        return ret;
    }

    /**
     * set the current level for logging i.e. debug
     * @param level Level
     */
    public void setLevel(Level level) {
        if (this.logger != null) {
            this.logger.setLevel(level);
        } else {
            System.err.println("ERROR - NO LOGGER - Unable to Set Logging Level to " + (level != null ? level.getName() : "null"));
        }
    }

    /**
     * return the current level for logging i.e. debug
     * @return Level
     */
    public Level getLevel() {
        Level level = null;
        if (this.logger != null) {
            level = this.logger.getLevel();
        }
        return level;
    }

}