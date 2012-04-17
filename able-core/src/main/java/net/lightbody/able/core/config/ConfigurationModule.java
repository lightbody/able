package net.lightbody.able.core.config;

import com.google.inject.AbstractModule;
import com.google.inject.Key;
import com.google.inject.Singleton;
import com.google.inject.name.Names;
import net.lightbody.able.core.util.Log;
import net.lightbody.able.core.util.UnstoppableRunnable;
import org.codehaus.jackson.JsonParser;
import org.codehaus.jackson.map.ObjectMapper;
import org.codehaus.jackson.node.ObjectNode;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.net.URISyntaxException;
import java.net.URL;
import java.util.*;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Singleton
public class ConfigurationModule extends AbstractModule {
    private static Log log = new Log();
    private static ObjectMapper objectMapper;

    private static final Pattern VAR_REPLACE_PATTERN = Pattern.compile("\\$\\{([^}]*)\\}"); // ${var.iab.les}
    private static final int MAX_VAR_REPLACEMENT_DEPTH = 5;

    private static final int DEFAULT_REFRESH_INTERVAL_SECONDS = 60 * 5;                     // 5 minute default refresh

    private final JsonProperties properties = new JsonProperties();
    private final Map<String, Long> lastModified = new Hashtable<String, Long>();

    protected String name;

    protected File homeDir;
    protected File wmDir;

    public ConfigurationModule(String name) {
        this.name = name;

        // set up home directory
        homeDir = new File(System.getProperty("user.home"));
        wmDir = new File(homeDir, ".able");
        //noinspection ResultOfMethodCallIgnored
        wmDir.mkdirs();
    }

    @Override
    public void configure() {
        if (null == objectMapper) {
            objectMapper = new ObjectMapper();

            // Allow comments in the properties files
            objectMapper.configure(JsonParser.Feature.ALLOW_COMMENTS, true);
        }

        try {
            JsonProperties props = loadJsonProperties();
            properties.load(props, true);
        } catch (IOException e) {
            addError(e);
            return;
        } catch (URISyntaxException e) {
            addError(e);
            return;
        }

        // Bind properties
        bind(JsonProperties.class).annotatedWith(Configuration.class).toInstance(properties);
        bindPropertyProviders();

        // Update json config periodically to ensure the latest values (no app restart necessary)
        int refreshInterval = (Integer) properties.getProperty("config.refresh", DEFAULT_REFRESH_INTERVAL_SECONDS);

        if (refreshInterval > 0) {
            ScheduledExecutorService updateExecutor = Executors.newSingleThreadScheduledExecutor(new ThreadFactory() {
                @Override
                public Thread newThread(Runnable r) {
                    return new Thread(r, "Configuration Updater");
                }
            });

            updateExecutor.scheduleWithFixedDelay(new UpdateConfigRunnable(), refreshInterval, refreshInterval, TimeUnit.SECONDS);

            log.info("Configuration set with %d second refresh", refreshInterval);
        } else {
            log.info("Configuration set with refresh disabled", refreshInterval);
        }
    }

    public JsonProperties loadJsonProperties() throws IOException, URISyntaxException {
        JsonProperties props = new JsonProperties();

        // Load the core app properties first (src/main/resources/<name>.json)
        URL url = Configuration.class.getResource("/" + name + ".json");
        if (null == url) {
            throw new FileNotFoundException("The core configuration file \"" + name + ".json\" could not be found.");
        }

        File core = new File(url.toURI());
        ObjectNode json = loadJson(core);
        if(null != json) {
            props.load(json);
        }

        // Load ~/.able/global.json if it exists
        ObjectNode global = loadJson(new File(wmDir, "global.json"));
        if(null != global) {
            props.load(global);
        }

        // Load ~/.able/<name>.json if it exists
        ObjectNode local = loadJson(new File(wmDir, name + ".json"));
        if(null != local) {
            props.load(local);
        }

        if (!props.isEmpty()) {
            // Make sure all properties are available for replacement
            JsonProperties allProps = new JsonProperties();
            if (!properties.isEmpty()) allProps.load(properties);
            allProps.load(props);

            // Now do the variable replacements
            int maxDepth = MAX_VAR_REPLACEMENT_DEPTH;
            Set<String> keys = props.propertyNames();
            for (String key : keys) {
                Object property = allProps.getProperty(key);

                if (null != property && property instanceof String && VAR_REPLACE_PATTERN.matcher((String) property).find()) {
                    try {
                        // Only update the property if the value has changed
                        String value = replace(maxDepth, VAR_REPLACE_PATTERN, props, (String) property);
                        if (!value.equals(allProps.get(key))) {
                            props.setProperty(key, value);
                        }
                    } catch (Exception e) {
                        log.warn("Unable to replace property [%s]", e, key);
                    }
                }

                // If the value is the same, don't report it as updated
                if (props.getProperty(key).equals(properties.getProperty(key))) {
                    props.remove(key);
                }
            }
        }
        
        return props;
    }

    protected String replace(int maxDepth, Pattern pattern, JsonProperties props, String replace) {
        if (maxDepth == 0) {
            throw new RuntimeException("Looks like your configuration has a circular dependency associated with '" + replace + "'");
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
                Object value = props.getProperty(key);
                if (value != null) {
                    matcher.appendReplacement(sb, replace(maxDepth - 1, pattern, props, value.toString()));
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

    private void bindPropertyProviders() {
        for (String key : properties.propertyNames() ) {

            Object value = properties.getProperty(key);

            if (value instanceof String) {
                bind(Key.get(String.class, Names.named(key))).toProvider(new PropertyProvider<String>(properties, key));
            } else if (value instanceof Integer) {
                bind(Key.get(Integer.class, Names.named(key))).toProvider(new PropertyProvider<Integer>(properties, key));
            } else if (value instanceof Long) {
                bind(Key.get(Long.class, Names.named(key))).toProvider(new PropertyProvider<Long>(properties, key));
            } else if (value instanceof Float) {
                bind(Key.get(Float.class, Names.named(key))).toProvider(new PropertyProvider<Float>(properties, key));
            } else if (value instanceof Boolean) {
                bind(Key.get(Boolean.class, Names.named(key))).toProvider(new PropertyProvider<Boolean>(properties, key));
            } else {
                bind(Key.get(Object.class, Names.named(key))).toProvider(new PropertyProvider<Object>(properties, key));
            }
        }

        printProperties(properties, "Binding the following configuration keys to Guice @Named annotations");
    }

    private ObjectNode loadJson(File file) throws IOException {
        String path = file.getPath();
        ObjectNode json = null;

        if (file.exists() && file.isFile()) {
            // Don't bother updating if the file hasn't been modified
            if (!lastModified.containsKey(path) || file.lastModified() > lastModified.get(path)) {

                log.info("Reading file '%s'", file);

                json = objectMapper.readValue(file, ObjectNode.class);
                lastModified.put(path, file.lastModified());
            }
        } else {
            // Return an empty node if the file doesn't exist
            json = objectMapper.createObjectNode();
        }

        return json;
    }
    
    private class UpdateConfigRunnable extends UnstoppableRunnable {
        @Override
        protected void runSafely() throws Exception {

            JsonProperties props = loadJsonProperties();
            if (props.isEmpty()) return;

            properties.load(props);

            printProperties(props, "Updating configuration");
        }
    }

    private static void printProperties (JsonProperties props) {
        printProperties(props, null);
    }

    private static void printProperties(JsonProperties props, String title) {
        SortedSet<String> sortedPropertyKeys = new TreeSet<String>(props.propertyNames());

        //find the maximum length of a key so we can print them all out in a pretty way
        int maxKeyNameWidth = 1;
        for( String key : sortedPropertyKeys )
            maxKeyNameWidth = Math.max(maxKeyNameWidth, key.length());

        log.info( null != title ? title : "Configuration Properties" );
        log.info("***************************************************************");
        for (String key : sortedPropertyKeys ) {

            Object value = props.getProperty(key);
            log.info("%-" + maxKeyNameWidth + "s = %s", key, value);
        }
        log.info("***************************************************************");
    }
}
