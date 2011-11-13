package net.lightbody.able.jetty;

import com.google.inject.AbstractModule;
import org.eclipse.jetty.server.Server;

public class JettyModule extends AbstractModule {
    private Class anchor;

    public JettyModule(Class anchor) {
        this.anchor = anchor;
    }

    @Override
    protected void configure() {
        bind(Class.class).annotatedWith(AnchorClass.class).toInstance(anchor);
        bind(Server.class).toProvider(EmbeddedJettyWebAppProvider.class);
        bind(JettyServer.class).asEagerSingleton();
    }
}
