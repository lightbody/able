package net.lightbody.able.soy;

import com.google.inject.servlet.ServletModule;
import com.google.template.soy.SoyModule;

public class SoyAbleModule extends ServletModule {
    @Override
    protected void configureServlets() {
        install(new SoyModule());
        serve("/soy/*").with(SilkenServlet.class);
    }
}
