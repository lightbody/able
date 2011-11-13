package net.lightbody.able.example.stripes;

import com.google.inject.Inject;
import com.google.inject.name.Named;
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

    @Inject
    public FooActionBean(@Named("foo") String foo) {
        this.foo = foo;
    }

    public Resolution display() {
//        return new StreamingResolution("text/plain", "stripes says hello: " + foo);
        return new ForwardResolution("/foo.ftl");
    }
}
