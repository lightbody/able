package net.lightbody.able.hibernate;

import net.lightbody.able.core.util.Log;
import org.hibernate.tuple.Instantiator;

import java.io.Serializable;

public class GuiceInstantiator implements Instantiator {
    private static Log LOG = new Log();

    private String entityName;

    public GuiceInstantiator(String entityName) {
        this.entityName = entityName;
    }

    public Object instantiate(Serializable id) {
        try {
            return HibernateModule.getInjector().getInstance(Class.forName(entityName));
        } catch (Exception e) {
            LOG.severe("Unable to create entity %s using Guice", e, id);
            return null;
        }
    }

    public Object instantiate() {
        return instantiate(null);
    }

    public boolean isInstance(Object object) {
        return object.getClass().getName().startsWith(entityName);
    }
}
