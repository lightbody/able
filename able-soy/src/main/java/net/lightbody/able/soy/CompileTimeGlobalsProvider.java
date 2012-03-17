package net.lightbody.able.soy;

import java.util.Map;

/**
 * Implement this interface to provide global compile time.
 * 
 * @author chris
 */
public interface CompileTimeGlobalsProvider {

    /**
     * @return Return a map of key/values.
     */
    Map<String, ?> getGlobals();

}
