package net.lightbody.able.stripes;

import com.google.inject.servlet.ServletModule;
import net.lightbody.able.core.util.Able;
import net.sourceforge.stripes.action.ActionBean;
import net.sourceforge.stripes.util.ResolverUtil;

import java.util.HashMap;
import java.util.Set;

public class StripesModule extends ServletModule {
    @Override
    protected void configureServlets() {
        ResolverUtil<ActionBean> resolver = new ResolverUtil<ActionBean>();
        ResolverUtil<ActionBean> resolverUtil = resolver.findImplementations(ActionBean.class, Able.findAnchorClass().getPackage().getName());
        Set<Class<? extends ActionBean>> classes = resolverUtil.getClasses();
        for (Class<? extends ActionBean> actionBeanClass : classes) {
            bind(actionBeanClass);
        }

        bind(ResourceBundleReset.class);

        HashMap<String, String> params = new HashMap<String, String>();
        params.put("Extension.Packages", GuiceRuntimeConfiguration.class.getPackage().getName());
        filter("/*").through(new GuiceStripesFilter(), params);
    }

    public static void wire(ServletModule servletModule) {

    }
}
