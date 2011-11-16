package net.lightbody.able.example.stripes;

import com.google.inject.Inject;
import com.google.inject.name.Named;
import net.lightbody.able.freemarker.FreemarkerResolution;
import net.sourceforge.stripes.action.*;

@UrlBinding("/foo")
public class FooActionBean implements ActionBean {
    private ActionBeanContext context;

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
    public FooActionBean(@Named("foo") String foo) {
        this.foo = foo;
    }

    public Resolution display() {
        doodoo = 123;

        return new FreemarkerResolution("foo.ftl");
    }

    public int getDoodoo() {
        return doodoo;
    }
}
