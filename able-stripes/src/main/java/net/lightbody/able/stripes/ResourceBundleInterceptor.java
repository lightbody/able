package net.lightbody.able.stripes;

import com.google.inject.Inject;
import com.google.inject.Singleton;
import net.sourceforge.stripes.action.Resolution;
import net.sourceforge.stripes.controller.ExecutionContext;
import net.sourceforge.stripes.controller.Interceptor;
import net.sourceforge.stripes.controller.Intercepts;
import net.sourceforge.stripes.controller.LifecycleStage;

@Intercepts(LifecycleStage.ResolutionExecution)
@Singleton
public class ResourceBundleInterceptor implements Interceptor {
    private ResourceBundleReset reset;

    @Inject
    public ResourceBundleInterceptor(ResourceBundleReset reset) {
        this.reset = reset;
    }

    public Resolution intercept(ExecutionContext context) throws Exception {
        reset.reset();

        return context.proceed();
    }
}