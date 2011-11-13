package net.lightbody.able.mongo;

import com.google.code.morphia.Morphia;
import com.google.inject.AbstractModule;
import com.mongodb.Mongo;

public class MongoModule extends AbstractModule {
    @Override
    protected void configure() {
        bind(Mongo.class).toProvider(MongoProvider.class);
        bind(Morphia.class).toProvider(MorphiaProvider.class);
    }
}
