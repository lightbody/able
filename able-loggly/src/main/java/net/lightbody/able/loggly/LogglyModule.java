package net.lightbody.able.loggly;

import biz.neustar.loggly.Loggly;
import com.google.inject.Binder;
import com.google.inject.Inject;
import com.google.inject.Module;
import net.lightbody.able.core.config.Configuration;
import net.lightbody.able.core.config.JsonProperties;

import java.util.Map;
import java.util.logging.Level;
import java.util.logging.Logger;

public class LogglyModule implements Module {

    @Override
    public void configure(Binder binder) {
        binder.requestInjection(this);
    }

    @Inject
    public void configureLoggly(@Configuration JsonProperties props) {
        String inputUrl = (String) props.getProperty("log.loggly.url");
        if (inputUrl != null) {
            Level level = Level.parse((String) props.getProperty("log.loggly.level", "FINE"));
            Logger logger = Logger.getLogger("");
            biz.neustar.loggly.LogglyHandler handler = new biz.neustar.loggly.LogglyHandler(inputUrl);
            handler.setLevel(level);
            logger.addHandler(handler);

            JsonProperties logglyProps = props.getProperties("log.loggly.global");
            for (Map.Entry<String, Object> entry : logglyProps.entrySet()) {
                String key = entry.getKey();
                Object value = entry.getValue();
                
                Loggly.addGlobal(key, value);
            }
        }
    }
}
