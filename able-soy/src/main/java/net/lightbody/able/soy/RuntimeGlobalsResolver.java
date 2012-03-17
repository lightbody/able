package net.lightbody.able.soy;

import com.google.template.soy.data.SoyMapData;

import javax.servlet.http.HttpServletRequest;

/**
 * Implement to add a common set of globals (injected data - $ij) into rendered templates.
 * If implemented this will be called once per request.
 * 
 * @author chris
 */
public interface RuntimeGlobalsResolver {
    
    /**
     * @param request The HttpServletRequest associated with the render request.
     * @return The globals data.
     */
    SoyMapData resolveGlobals(HttpServletRequest request) ;

}
