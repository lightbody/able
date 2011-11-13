package net.lightbody.able.loggly;

import biz.neustar.loggly.Loggly;
import com.google.inject.Binder;
import com.google.inject.Inject;
import com.google.inject.Key;
import com.google.inject.Module;
import net.lightbody.able.core.config.Configuration;

import java.util.Map;
import java.util.Properties;
import java.util.logging.Level;
import java.util.logging.Logger;

public class LogglyModule implements Module {

    @Override
    public void configure(Binder binder) {
        binder.requestInjection(this);
    }

    @Inject
    public void configureLoggly(@Configuration Properties props) {
        String inputUrl = props.getProperty("loggly.url");
        if (inputUrl != null) {
            Logger logger = Logger.getLogger("");
            biz.neustar.loggly.LogglyHandler handler = new biz.neustar.loggly.LogglyHandler(inputUrl);
            handler.setLevel(Level.FINE);
            logger.addHandler(handler);

            for (Map.Entry<Object, Object> entry : props.entrySet()) {
                String key = (String) entry.getKey();
                if (key.startsWith("loggly.global.")) {
                    key = key.substring(14);
                    Object value = entry.getValue();
                    Loggly.addGlobal(key, value);
                }
            }
        }
    }
}
