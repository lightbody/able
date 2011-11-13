package net.lightbody.able.stripes;

import com.google.inject.AbstractModule;
import com.google.inject.servlet.ServletModule;
import net.sourceforge.stripes.action.ActionBean;
import net.sourceforge.stripes.util.ResolverUtil;

import java.util.Set;

public class StripesModule extends AbstractModule {
    private Class anchorClass;

    public StripesModule(Class anchorClass) {
        this.anchorClass = anchorClass;
    }

    @Override
    protected void configure() {
        ResolverUtil<ActionBean> resolver = new ResolverUtil<ActionBean>();
        ResolverUtil<ActionBean> resolverUtil = resolver.findImplementations(ActionBean.class, anchorClass.getPackage().getName());
        Set<Class<? extends ActionBean>> classes = resolverUtil.getClasses();
        for (Class<? extends ActionBean> actionBeanClass : classes) {
            bind(actionBeanClass);
        }

        bind(ResourceBundleReset.class);
    }

    public static void wire(ServletModule servletModule) {

    }
}
