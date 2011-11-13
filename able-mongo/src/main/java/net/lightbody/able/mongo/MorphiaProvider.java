package net.lightbody.able.mongo;

import com.google.code.morphia.Morphia;
import com.google.code.morphia.validation.MorphiaValidation;
import com.google.inject.Provider;
import com.google.inject.Singleton;

@Singleton
public class MorphiaProvider implements Provider<Morphia> {
    private MorphiaValidation morphiaValidation;
    private Morphia morphia;

    public Morphia get() {
        if (morphia == null) {
            morphia = new Morphia();
            morphiaValidation = new MorphiaValidation();

            morphiaValidation.applyTo(morphia);
        }

        return morphia;
    }
}