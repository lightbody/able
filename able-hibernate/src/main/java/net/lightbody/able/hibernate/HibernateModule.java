package net.lightbody.able.hibernate;

import com.google.inject.Inject;
import com.google.inject.persist.PersistFilter;
import com.google.inject.persist.jpa.JpaPersistModule;
import com.google.inject.servlet.ServletModule;
import net.lightbody.able.core.config.Configuration;

import java.util.Properties;

public class HibernateModule extends ServletModule {

    private Properties properties = new Properties();

    @Override
    protected void configureServlets() {
        requestInjection(this);
        filter("/*").through(PersistFilter.class);
        install(new JpaPersistModule("able").properties(properties));
    }

    @Inject
    public void loadProperties(@Configuration Properties props) {
        for (String name : props.stringPropertyNames()) {
            if (name.startsWith("hibernate.")) {
                properties.put(name, props.getProperty(name));
            }
        }
    }
}
