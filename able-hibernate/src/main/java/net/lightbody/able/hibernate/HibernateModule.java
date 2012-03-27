package net.lightbody.able.hibernate;

import com.google.inject.Inject;
import com.google.inject.Injector;
import com.google.inject.persist.PersistFilter;
import com.google.inject.persist.jpa.JpaPersistModule;
import com.google.inject.servlet.ServletModule;
import net.lightbody.able.core.config.Configuration;
import net.lightbody.able.core.config.JsonProperties;

import java.util.Properties;

public class HibernateModule extends ServletModule {
    private static Injector injector;
    private Properties properties = new Properties();

    @Override
    protected void configureServlets() {
        requestInjection(this);
        filter("/*").through(PersistFilter.class);
        install(new JpaPersistModule("able").properties(properties));
    }

    @Inject
    public void initialize(@Configuration JsonProperties props, Injector injector) {
        HibernateModule.injector = injector;

        for (String name : props.propertyNames()) {
            if (name.startsWith("db.hibernate.")) {
                properties.put(name.replace("db.", ""), props.getProperty(name));
            }
        }

        // check if we're in a Heroku environment and honor that
        String herokuDbUrl = System.getenv("DATABASE_URL");
        if (herokuDbUrl != null) {
            properties.put("hibernate.connection.url", herokuDbUrl);
            properties.put("hibernate.connection.driver_class", "org.postgresql.Driver");
            properties.put("hibernate.dialect", "org.hibernate.dialect.PostgreSQLDialect");
            properties.remove("hibernate.connection.username");
            properties.remove("hibernate.connection.password");
        }

    }

    public static Injector getInjector() {
        return injector;
    }
}
