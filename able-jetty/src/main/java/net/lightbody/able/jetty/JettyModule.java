package net.lightbody.able.jetty;

import com.google.inject.AbstractModule;
import org.eclipse.jetty.server.Server;

public class JettyModule extends AbstractModule {
    @Override
    protected void configure() {
        bind(Server.class).toProvider(EmbeddedJettyWebAppProvider.class);
        bind(JettyServer.class).asEagerSingleton();
    }
}
