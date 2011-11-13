package net.lightbody.able.example;

import com.google.inject.Guice;
import com.google.inject.Injector;
import com.google.sitebricks.SitebricksModule;
import com.google.sitebricks.SitebricksServletModule;
import net.lightbody.able.core.config.ConfigurationModule;
import net.lightbody.able.example.bricks.TestBrick;
import net.lightbody.able.jetty.JettyModule;
import net.lightbody.able.jetty.JettyServer;
import net.lightbody.able.loggly.LogglyModule;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;

public class Main extends HttpServlet {
    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {
        resp.getWriter().print("Hello from Java!\n");
        resp.getWriter().print(System.getenv("DATABASE_URL") + "\n");
    }

    public static void main(String[] args) throws Exception {
        Injector injector = Guice.createInjector(new ConfigurationModule("example"),
                new LogglyModule(),
                new JettyModule(Main.class),
                new SitebricksModule() {
                    @Override
                    protected void configureSitebricks() {
                        scan(TestBrick.class.getPackage());
                    }
                },
                new SitebricksServletModule() {
                    @Override
                    protected void configureCustomServlets() {
                        serve("/test").with(TestServlet.class);
                    }
                });
        JettyServer server = injector.getInstance(JettyServer.class);
        server.start(injector);
    }
}
