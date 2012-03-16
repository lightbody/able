package net.lightbody.able.freemarker;

import com.google.inject.servlet.ServletModule;
import freemarker.ext.servlet.FreemarkerServlet;
import freemarker.template.Configuration;

import java.io.IOException;
import java.util.Collections;

public class FreemarkerModule extends ServletModule {
    @Override
    protected void configureServlets() {
        final ConfigurationProvider provider;
        try {
            provider = new ConfigurationProvider();
            bind(Configuration.class).toProvider(provider);
        } catch (IOException e) {
            addError(e);
            return;
        }

        serve("*.ftl").with(new FreemarkerServlet() {
            @Override
            protected Configuration createConfiguration() {
                return provider.get();
            }
        }, Collections.singletonMap("TemplatePath", "/"));
    }
}
