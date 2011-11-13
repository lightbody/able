package net.lightbody.able.core.util;

public class Os {
    public static final boolean isOSX = System.getProperty("os.name").contains("OS X");
    public static final boolean isWin = System.getProperty("os.name").contains("Windows");
    public static final boolean isLinux = System.getProperty("os.name").contains("Linux");
}
