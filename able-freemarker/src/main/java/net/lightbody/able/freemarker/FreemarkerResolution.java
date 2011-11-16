package net.lightbody.able.freemarker;

import com.google.inject.Injector;
import freemarker.template.Configuration;
import freemarker.template.Template;
import net.sourceforge.stripes.action.Resolution;

import javax.servlet.ServletContext;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.PrintWriter;
import java.util.HashMap;
import java.util.Map;

public class FreemarkerResolution implements Resolution {
    private String name;
    private String contentType = "text/html";

    public FreemarkerResolution(String name) {
        this.name = name;
    }

    public FreemarkerResolution(String name, String contentType) {
        this.name = name;
        this.contentType = contentType;
    }

    @Override
    public void execute(HttpServletRequest req, HttpServletResponse res) throws Exception {
        ServletContext ctx = req.getSession().getServletContext();
        Injector injector = (Injector) ctx.getAttribute(Injector.class.getName());
        Configuration cfg = injector.getInstance(Configuration.class);

        Template temp = cfg.getTemplate(name);

        Map<String, Object> root = new HashMap<String, Object>();
        root.put("actionBean", req.getAttribute("actionBean"));

        PrintWriter out = res.getWriter();
        res.setContentType(contentType);
        temp.process(root, out);
        out.flush();
    }
}
