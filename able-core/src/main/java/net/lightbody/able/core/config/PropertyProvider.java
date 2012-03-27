package net.lightbody.able.core.config;

import com.google.inject.Provider;

public class PropertyProvider<T> implements Provider<T> {
    private JsonProperties properties;
    private String key;

    public PropertyProvider(JsonProperties properties, String key) {
        this.properties = properties;
        this.key = key;
    }

    @Override
    public T get() {
        return (T) properties.getProperty(key);
    }
}
