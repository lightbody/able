package net.lightbody.able.core.config;

import com.google.inject.AbstractModule;
import com.google.inject.Key;
import com.google.inject.name.Names;
import org.jetbrains.annotations.Nullable;

import java.io.*;
import java.lang.annotation.Annotation;
import java.util.Map;
import java.util.Properties;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class ConfigurationModule extends AbstractModule {
    protected String name;

    public ConfigurationModule(String name) {
        this.name = name;
    }

    @Override
    public void configure() {
        Properties props;
        try {
            props = getProperties();
        } catch (Exception e) {
            addError(e);
            return;
        }

        bind(Properties.class).annotatedWith(Configuration.class).toInstance(props);
        customize(props);
        bindProperties(props);
    }

    /*
     * Copy of Named.bindProperties, but with support for primitives in addition to Strings
     */
    private void bindProperties(Properties properties) {
        //binder().skipSources(Names.class);

        // use enumeration to include the default properties
        for (Map.Entry<Object, Object> entry : properties.entrySet()) {
            String key = (String) entry.getKey();
            Object value = entry.getValue();
            if (value instanceof String) {
                bind(Key.get(String.class, Names.named(key))).toInstance((String) value);
            } else if (value instanceof Integer) {
                bind(Key.get(Integer.class, Names.named(key))).toInstance((Integer) value);
            } else if (value instanceof Long) {
                bind(Key.get(Long.class, Names.named(key))).toInstance((Long) value);
            } else if (value instanceof Float) {
                bind(Key.get(Float.class, Names.named(key))).toInstance((Float) value);
            } else if (value instanceof Boolean) {
                bind(Key.get(Boolean.class, Names.named(key))).toInstance((Boolean) value);
            } else {
                bind(Key.get(String.class, Names.named(key))).toInstance(value.toString());
            }
        }
    }

    protected void customize(Properties props) {

    }

    protected void bindString(Properties props, Class<? extends Annotation> annotation, String property, @Nullable String defaultValue) {
        String value = props.getProperty(property);
        if (value == null) {
            value = System.getProperty(property);
        }

        if (value == null) {
            value = defaultValue;
        }

        if (value == null) {
            return;
        }

        bindConstant()
                .annotatedWith(annotation)
                .to(value);
    }

    protected void bindString(Properties props, Class<? extends Annotation> annotation, String property) {
        bindString(props, annotation, property, null);
    }

    protected void bindInteger(Properties props, Class<? extends Annotation> annotation, String property, @Nullable Integer defaultValue) {
        String value = props.getProperty(property);
        if (value == null) {
            value = System.getProperty(property);
        }

        Integer parsed;
        if (value == null) {
            parsed = defaultValue;
        } else {
            parsed = Integer.parseInt(value);
        }

        if (parsed == null) {
            return;
        }

        bindConstant()
                .annotatedWith(annotation)
                .to(parsed);
    }

    protected void bindInteger(Properties props, Class<? extends Annotation> annotation, String property) {
        bindInteger(props, annotation, property, null);
    }

    protected void bindBoolean(Properties props, Class<? extends Annotation> annotation, String property) {
        bindConstant()
                .annotatedWith(annotation)
                .to(Boolean.parseBoolean(props.getProperty(property)));
    }

    public BaseProperties getProperties() throws IOException {
        BaseProperties props = new BaseProperties();

        // load the core properties
        InputStream is = Configuration.class.getResourceAsStream("/" + name + ".properties");
        if (null == is) {
            throw new FileNotFoundException("The core configuration file \"" + name + ".properties\" could not be found.");
        }

        props.load(is);

        // set up home directory
        File homeDir = new File(System.getProperty("user.home"));
        File wmDir = new File(homeDir, ".webmetrics");
        wmDir.mkdirs();

        // grab global.properties if it exists
        File global = new File(wmDir, "global.properties");
        if (global.exists()) {
            FileInputStream fis = new FileInputStream(global);
            props.load(fis);
        }

        // grab name.properties in the .webmetrics dir if it exists
        File local = new File(wmDir, name + ".properties");
        if (local.exists()) {
            FileInputStream fis = new FileInputStream(local);
            props.load(fis);
        }

        // now do some variable replacements
        int maxDepth = 5;
        Pattern pattern = Pattern.compile("\\$\\{([^}]*)\\}");
        for (Map.Entry<Object, Object> entry : props.entrySet()) {
            String value = (String) entry.getValue();
            entry.setValue(replace(maxDepth, pattern, props, value));
        }

        /*
        // finally, replace any string that looks like a primitive to be an actual primitive
        for (Map.Entry<Object, Object> entry : props.entrySet()) {
            String value = (String) entry.getValue();
            value = value.trim();
            if (value.equalsIgnoreCase("true")) {
                entry.setValue(true);
            } else if (value.equalsIgnoreCase("false")) {
                entry.setValue(false);
            } else {
                // is it an integer?
                try {
                    int intVal = Integer.parseInt(value);
                    entry.setValue(intVal);
                    continue;
                } catch (NumberFormatException e) {
                    // nope!
                }

                // is it a long?
                try {
                    long longVal = Long.parseLong(value);
                    entry.setValue(longVal);
                    continue;
                } catch (NumberFormatException e) {
                    // nope!
                }

                // is it a float?
                try {
                    float floatVal = Float.parseFloat(value);
                    entry.setValue(floatVal);
                    continue;
                } catch (NumberFormatException e) {
                    // nope!
                }
            }
        }
        */

        return props;
    }

    protected String replace(int maxDepth, Pattern pattern, Properties props, String replace) {
        if (maxDepth == 0) {
            throw new RuntimeException("Looks like your configuration has a circular dependency associated with " + replace);
        }

        Matcher matcher = pattern.matcher(replace);
        StringBuffer sb = new StringBuffer();
        boolean found = false;
        while (matcher.find()) {
            found = true;
            String key = matcher.group(1);
            if (key.startsWith("env.")) {
                key = key.substring(4);
                matcher.appendReplacement(sb, System.getenv(key));
            } else if (key.startsWith("system.")) {
                key = key.substring(7);
                matcher.appendReplacement(sb, System.getProperty(key));
            } else {
                String value = props.getProperty(key);
                if (value != null) {
                    matcher.appendReplacement(sb, replace(maxDepth - 1, pattern, props, value));
                } else {
                    throw new RuntimeException("Could not find variable replacement for ${" + key + "}");
                }
            }
        }

        if (found) {
            matcher.appendTail(sb);
            return sb.toString();
        } else {
            return replace;
        }
    }
}
