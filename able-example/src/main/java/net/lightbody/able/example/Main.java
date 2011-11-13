package net.lightbody.able.example;

import com.google.inject.Guice;
import com.google.inject.Injector;
import net.lightbody.able.core.config.ConfigurationModule;
import net.lightbody.able.loggly.LogglyModule;
import org.eclipse.jetty.server.Server;
import org.eclipse.jetty.servlet.ServletContextHandler;
import org.eclipse.jetty.servlet.ServletHolder;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Properties;

public class Main extends HttpServlet {
    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {
        resp.getWriter().print("Hello from Java!\n");
        resp.getWriter().print(System.getenv("DATABASE_URL") + "\n");
    }

    public static void main(String[] args) throws Exception{
        Injector injector = Guice.createInjector(new ConfigurationModule("example"), new LogglyModule());

        String portStr = System.getenv("PORT");
        if (portStr == null) {
            portStr = "8080";
        }
        Server server = new Server(Integer.valueOf(portStr));
        ServletContextHandler context = new ServletContextHandler(ServletContextHandler.SESSIONS);
        context.setContextPath("/");
        server.setHandler(context);
        context.addServlet(new ServletHolder(new Main()),"/*");
        server.start();
        server.join();
    }
}
