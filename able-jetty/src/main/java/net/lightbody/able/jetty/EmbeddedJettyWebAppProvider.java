package net.lightbody.able.jetty;

import com.google.inject.Inject;
import com.google.inject.Provider;
import com.google.inject.name.Named;
import com.google.inject.servlet.GuiceFilter;
import net.lightbody.able.core.util.Log;
import org.eclipse.jetty.server.Server;
import org.eclipse.jetty.servlet.DefaultServlet;
import org.eclipse.jetty.servlet.ServletContextHandler;
import org.eclipse.jetty.util.resource.Resource;
import org.eclipse.jetty.webapp.WebAppContext;

import java.io.File;
import java.io.IOException;
import java.net.URL;

public class EmbeddedJettyWebAppProvider implements Provider<Server> {
    private static final Log LOG = new Log();

    private Server server;

    @Inject
    public EmbeddedJettyWebAppProvider(@Named("port") int port, @AnchorClass Class anchorClass) throws IOException {
        String envPort = System.getenv("PORT");
        if (envPort != null) {
            port = Integer.parseInt(envPort);
        }

        server = new Server(port);

        ServletContextHandler context = new WebAppContext();
        context.setContextPath("/");
        context.setInitParameter("org.eclipse.jetty.servlet.Default.dirAllowed", "false");

        context.addFilter(GuiceFilter.class, "/*", 0);
        context.addServlet(DefaultServlet.class, "/");

        // Allows regular files (css, js, etc) to be served
        Resource resource;

        String classPath = anchorClass.getName();
        classPath = classPath.replaceAll("\\.", "/") + ".class";
        URL url = anchorClass.getResource("/" + classPath);

        if (url == null) {
            throw new IllegalStateException("Could not find class " + anchorClass.getName() + " in the class path");
        }

        String s = url.toString();
        File webappDir;
        if (s.startsWith("jar:file:")) {
            // if the class is in a jar, assume that the webapp dir is at ../webapp
            // relative to the directory holding the jar
            s = s.substring("jar:file:".length());
            s = s.substring(0, s.indexOf('!'));

            File path = new File(s);
            webappDir = new File(path.getParentFile().getParentFile(), "webapp");
        } else if (s.startsWith("file:")) {
            // if the class is not in a jar, assume the the webapp dir is at ../src/main/webapp
            // relative to the directory holding the class
            s = s.substring("file:".length());

            String replaced = anchorClass.getName().replaceAll("\\.", "/") + ".class";
            int index = s.lastIndexOf(replaced);
            s = s.substring(0, index);

            File path = new File(s);
            webappDir = new File(path.getParentFile().getParentFile(), "src/main/webapp");
        } else {
            throw new IllegalStateException("Unexpeted URI for anrchor class: " + s);
        }

        if (!webappDir.exists()) {
            throw new IllegalStateException("Webapp directory " + webappDir.getPath() + " not found");
        }

        LOG.info("Using webapp directory " + webappDir.getPath());
        resource = Resource.newResource(webappDir.toURI());

        context.setBaseResource(resource);

        server.setHandler(context);
    }

    @Override
    public Server get() {
        return server;
    }
}
