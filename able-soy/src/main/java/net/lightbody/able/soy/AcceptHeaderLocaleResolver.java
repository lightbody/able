package net.lightbody.able.soy;

import javax.servlet.http.HttpServletRequest;
import java.util.Locale;

/**
 * Default implementation of the LocaleResolver that uses the accept-language header.
 * 
 * @author chris
 */
public class AcceptHeaderLocaleResolver implements LocaleResolver {

    /**
     * @see LocaleResolver#resolveLocale(javax.servlet.http.HttpServletRequest)
     */
    public Locale resolveLocale(HttpServletRequest request) {
        return request.getLocale();
    }

}
