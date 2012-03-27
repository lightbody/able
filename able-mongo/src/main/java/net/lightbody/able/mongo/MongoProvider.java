package net.lightbody.able.mongo;

import com.google.inject.Inject;
import com.google.inject.Provider;
import com.google.inject.Singleton;
import com.google.inject.name.Named;
import com.mongodb.Mongo;
import com.mongodb.MongoURI;

import java.net.UnknownHostException;

@Singleton
public class MongoProvider implements Provider<Mongo> {
    private Mongo db;

    private String mongoURI;

    @Inject
    public MongoProvider(@Named("db.mongo.uri") String mongoURI) {
        String herokuMongoLabHack = System.getenv("MONGOLAB_URI");
        if (herokuMongoLabHack != null) {
            mongoURI = herokuMongoLabHack;
        }

        String herokuMongoHQHack = System.getenv("MONGOHQ_URL");
        if (herokuMongoHQHack != null) {
            mongoURI = herokuMongoHQHack;
        }

        this.mongoURI = mongoURI;
    }

    public Mongo get() {
        try{
            if( db == null ) {
                db = new Mongo(new MongoURI(mongoURI));
            }

            return db;
        }
        catch(UnknownHostException e){
            throw new RuntimeException("Unable to connect to Mongo!", e);
        }
    }
}