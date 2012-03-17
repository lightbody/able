package net.lightbody.able.soy;

import com.google.template.soy.data.SoyMapData;

import javax.servlet.http.HttpServletRequest;
import java.util.Map;

/**
 * This implementation extracts the model from a HTTP request attribute. If you'd like to change the default model key,
 * simply subclass this implementation and set via the super constructor, and reference the class via the
 * "modelResolver" Servlet init parameter.
 * 
 * @author chris
 */
public class RequestAttributeModelResolver implements ModelResolver {

    private static final String DEFAULT_MODEL_KEY = "model";

    private final String modelKey;

    public RequestAttributeModelResolver() {
        this.modelKey = DEFAULT_MODEL_KEY;
    }

    public RequestAttributeModelResolver(String modelKey) {
        this.modelKey = modelKey;
    }

    /*
     * @see com.papercut.silken.ModelResolver#resolveModel(javax.servlet.http.HttpServletRequest)
     */
    public SoyMapData resolveModel(HttpServletRequest request) {
        Object model = request.getAttribute(modelKey);
        if (model == null) {
            return null;
        }

        if (model instanceof SoyMapData) {
            return (SoyMapData) model;
        }

        Map<String, ?> modeMap  = Utils.toSoyCompatibleMap(model);
       
        return new SoyMapData(modeMap);
    }

}
