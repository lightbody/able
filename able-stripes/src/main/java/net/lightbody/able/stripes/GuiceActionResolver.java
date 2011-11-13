package net.lightbody.able.stripes;

import com.google.inject.Binding;
import com.google.inject.Inject;
import com.google.inject.Injector;
import com.google.inject.Key;
import net.sourceforge.stripes.action.ActionBean;
import net.sourceforge.stripes.action.ActionBeanContext;
import net.sourceforge.stripes.controller.NameBasedActionResolver;
import net.sourceforge.stripes.exception.StripesServletException;

import java.lang.reflect.Method;
import java.lang.reflect.Type;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

public class GuiceActionResolver extends NameBasedActionResolver {
    private Injector injector;

    @Inject
    public GuiceActionResolver(Injector injector) {
        this.injector = injector;
    }

    protected ActionBean makeNewActionBean(Class<? extends ActionBean> type, ActionBeanContext context) throws Exception {
        return injector.getInstance(type);
    }

    @SuppressWarnings("unchecked")
    protected String getEventNameFromRequestParams(Class<? extends ActionBean> bean, ActionBeanContext context) {
        if (bean.getName().contains("$$")) {
            bean = (Class<? extends ActionBean>) bean.getSuperclass();
        }

        return super.getEventNameFromRequestParams(bean, context);
    }

    protected String getEventNameFromPath(Class<? extends ActionBean> bean, ActionBeanContext context) {
        if (bean.getName().contains("$$")) {
            bean = (Class<? extends ActionBean>) bean.getSuperclass();
        }

        return super.getEventNameFromPath(bean, context);
    }

    protected String getEventNameFromEventNameParam(Class<? extends ActionBean> bean, ActionBeanContext context) {
        if (bean.getName().contains("$$")) {
            bean = (Class<? extends ActionBean>) bean.getSuperclass();
        }

        return super.getEventNameFromEventNameParam(bean, context);
    }

    public Method getHandler(Class<? extends ActionBean> bean, String eventName) throws StripesServletException {
        if (bean.getName().contains("$$")) {
            bean = (Class<? extends ActionBean>) bean.getSuperclass();
        }

        return super.getHandler(bean, eventName);
    }

    public Method getDefaultHandler(Class<? extends ActionBean> bean) throws StripesServletException {
        if (bean.getName().contains("$$")) {
            bean = (Class<? extends ActionBean>) bean.getSuperclass();
        }

        return super.getDefaultHandler(bean);
    }

    /**
     * Don't auto-search, instead force them to be defined in Guice.
     *
     * @return an empty set
     */
    protected Set<Class<? extends ActionBean>> findClasses() {
        HashSet<Class<? extends ActionBean>> classes = new HashSet<Class<? extends ActionBean>>();

        Map<Key<?>,Binding<?>> bindings = injector.getBindings();
        for (Key<?> key : bindings.keySet()) {
            Type type = key.getTypeLiteral().getType();
            if (type instanceof Class  && ActionBean.class.isAssignableFrom((Class) type)) {
                //noinspection unchecked
                classes.add((Class) type);
            }
        }

        return classes;
    }
}