package net.lightbody.able.jetty;

import com.google.inject.Inject;
import com.google.inject.Provider;
import com.google.inject.name.Named;
import com.google.inject.servlet.GuiceFilter;
import net.lightbody.able.core.util.Able;
import net.lightbody.able.core.util.Log;
import org.eclipse.jetty.server.Server;
import org.eclipse.jetty.servlet.ServletContextHandler;
import org.eclipse.jetty.servlet.ServletHolder;
import org.eclipse.jetty.util.resource.Resource;
import org.eclipse.jetty.webapp.WebAppContext;

import java.io.File;
import java.io.IOException;

public class EmbeddedJettyWebAppProvider implements Provider<Server> {
    private static final Log LOG = new Log();

    private Server server;

    @Inject
    public EmbeddedJettyWebAppProvider(@Named("port") int port) throws IOException {
        String envPort = System.getenv("PORT");
        if (envPort != null) {
            port = Integer.parseInt(envPort);
        }

        server = new Server(port);

        ServletContextHandler context = new WebAppContext();
        context.setContextPath("/");

        // diable URL rewriting, cuz it is annoying and stupid and nobody has cookieless browsers anymore!
        context.getSessionHandler().getSessionManager().setSessionIdPathParameterName(null);
        context.addFilter(DisableURLRewritingFilter.class, "/*", 0);

        context.addFilter(GuiceFilter.class, "/*", 0);
        context.addServlet(NoDirectoryDefaultServlet.class, "/");
        ServletHolder holder = new ServletHolder(new NoDirectoryDefaultServlet());
        holder.setName("default");
        context.addServlet(holder, "/");

        File webappDir = Able.findWebAppDir();
        LOG.info("Using webapp directory " + webappDir.getPath());
        Resource resource = Resource.newResource(webappDir.toURI());

        context.setBaseResource(resource);

        server.setHandler(context);
    }

    @Override
    public Server get() {
        return server;
    }
}
