package net.lightbody.able.example;

import com.google.inject.Guice;
import com.google.inject.Injector;
import com.google.inject.servlet.ServletModule;
import com.google.sitebricks.SitebricksModule;
import net.lightbody.able.core.config.ConfigurationModule;
import net.lightbody.able.core.util.Log;
import net.lightbody.able.example.bricks.TestBrick;
import net.lightbody.able.freemarker.FreemarkerModule;
import net.lightbody.able.hibernate.HibernateModule;
import net.lightbody.able.jetty.JettyModule;
import net.lightbody.able.jetty.JettyServer;
import net.lightbody.able.loggly.LogglyModule;
import net.lightbody.able.soy.SoyAbleModule;
import net.lightbody.able.stripes.StripesModule;

public class Main {
    private static final Log LOG = new Log();

    public static void main(String[] args) throws Exception {
        LOG.info("Starting Able...");

        Injector injector = Guice.createInjector(new ConfigurationModule("example"),
                new LogglyModule(),
                new JettyModule(),
                new HibernateModule(),
                new StripesModule(),
                new FreemarkerModule(),
                new SoyAbleModule(),
                new SitebricksModule() {
                    @Override
                    protected void configureSitebricks() {
                        scan(TestBrick.class.getPackage());
                    }
                },
                new ServletModule() {
                    @Override
                    protected void configureServlets() {
                        serve("/test").with(TestServlet.class);
                    }
                }
        );
        JettyServer server = injector.getInstance(JettyServer.class);
        server.start(injector);
    }
}
