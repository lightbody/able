package net.lightbody.able.jetty;

import org.eclipse.jetty.servlet.DefaultServlet;
import org.eclipse.jetty.util.resource.Resource;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;

public class NoDirectoryDefaultServlet extends DefaultServlet {
    @Override
    public String getInitParameter(String name) {
        if ("dirAllowed".equals(name)) {
            return "true";
        }

        return super.getInitParameter(name);
    }

    @Override
    public String getServletName() {
        return "default";
    }

    @Override
    protected void sendDirectory(HttpServletRequest request, HttpServletResponse response, Resource resource, String pathInContext) throws IOException {
        response.sendError(HttpServletResponse.SC_NOT_FOUND);
    }
}
