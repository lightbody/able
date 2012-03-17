package net.lightbody.able.soy;

import com.google.template.soy.data.SoyMapData;

import javax.servlet.http.HttpServletRequest;

/**
 * Extract the model (SoyMapData) which will be used to render the template.  This must be 
 * implemented and will be called once per request.
 * 
 * @author chris
 */
public interface ModelResolver {
    
    /**
     * @param request The HttpServletRequest associated with the render resource.
     * @return The model data.
     */
    SoyMapData resolveModel(HttpServletRequest request);

}
