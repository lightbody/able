package net.lightbody.able.jetty;

import com.google.inject.Inject;
import com.google.inject.Injector;
import com.google.inject.Singleton;
import com.google.inject.servlet.GuiceServletContextListener;
import org.eclipse.jetty.server.Server;
import org.eclipse.jetty.servlet.ServletContextHandler;

import javax.servlet.ServletContextEvent;

@Singleton
public class JettyServer {
    private Server server;

    @Inject
    public JettyServer(Server server) {
        this.server = server;
    }

    public void start(final Injector injector) throws Exception {
        GuiceServletContextListener gscl = new GuiceServletContextListener() {
            @Override
            protected Injector getInjector() {
                return injector;
            }
        };

        ServletContextHandler context = (ServletContextHandler) server.getHandler();
        gscl.contextInitialized(new ServletContextEvent(context.getServletContext()));

        server.start();
        server.join();
    }
}
