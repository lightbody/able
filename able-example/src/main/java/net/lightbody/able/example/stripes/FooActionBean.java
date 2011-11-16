package net.lightbody.able.example.stripes;

import com.google.inject.Inject;
import com.google.inject.name.Named;
import net.lightbody.able.example.models.Person;
import net.lightbody.able.freemarker.FreemarkerResolution;
import net.sourceforge.stripes.action.ActionBean;
import net.sourceforge.stripes.action.ActionBeanContext;
import net.sourceforge.stripes.action.Resolution;
import net.sourceforge.stripes.action.UrlBinding;

import javax.persistence.EntityManager;
import java.util.List;

@UrlBinding("/foo")
public class FooActionBean implements ActionBean {
    private ActionBeanContext context;
    private EntityManager em;

    @Override
    public void setContext(ActionBeanContext context) {
        this.context = context;
    }

    @Override
    public ActionBeanContext getContext() {
        return context;
    }

    private String foo;
    private int doodoo;

    @Inject
    public FooActionBean(@Named("foo") String foo, EntityManager em) {
        this.foo = foo;
        this.em = em;
    }

    public Resolution display() {
        doodoo = 123;
        List<Person> people = em.createQuery("From Person p").getResultList();
        System.out.println(people.size());

        return new FreemarkerResolution("foo.ftl");
    }

    public int getDoodoo() {
        return doodoo;
    }
}
