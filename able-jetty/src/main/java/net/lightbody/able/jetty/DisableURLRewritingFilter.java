package net.lightbody.able.jetty;

import javax.servlet.*;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpServletResponseWrapper;
import java.io.IOException;

public class DisableURLRewritingFilter implements Filter {
    public void init(FilterConfig filterConfig) throws ServletException {
    }

    public void doFilter(ServletRequest servletRequest, ServletResponse servletResponse, FilterChain filterChain) throws IOException, ServletException {
        filterChain.doFilter(servletRequest, new NoURLRewriteServletResponseWrapper(servletResponse));
    }

    public void destroy() {
    }

    private static class NoURLRewriteServletResponseWrapper extends HttpServletResponseWrapper {
        public NoURLRewriteServletResponseWrapper(ServletResponse servletResponse) {
            super((HttpServletResponse) servletResponse);
        }

        public String encodeRedirectUrl(String url) {
            return url;
        }

        public String encodeRedirectURL(String url) {
            return url;
        }

        public String encodeUrl(String url) {
            return url;
        }

        public String encodeURL(String url) {
            return url;
        }
    }
}
