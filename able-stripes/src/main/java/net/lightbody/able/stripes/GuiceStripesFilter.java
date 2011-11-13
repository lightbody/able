package net.lightbody.able.stripes;

import net.sourceforge.stripes.controller.DynamicMappingFilter;

import javax.servlet.FilterConfig;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

public class GuiceStripesFilter extends DynamicMappingFilter {
    private FilterConfig config;

    @Override
    public void init(FilterConfig config) throws ServletException {
        this.config = config;
        super.init(config);
    }

    @Override
    protected void initStripesFilter(HttpServletRequest request, HttpServletResponse response) throws ServletException {
        createStripesFilter(config);
    }
}
