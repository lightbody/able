package net.lightbody.able.core.config;

import net.lightbody.able.core.util.Log;
import org.codehaus.jackson.JsonNode;
import org.codehaus.jackson.node.ArrayNode;
import org.codehaus.jackson.node.ContainerNode;
import org.codehaus.jackson.node.JsonNodeFactory;
import org.codehaus.jackson.node.ObjectNode;

import java.math.BigDecimal;
import java.util.*;

public class JsonProperties extends Hashtable<String, Object> {
    private static final Log log = new Log();

    private static final Object LOCK = new Object();

    private ObjectNode json = JsonNodeFactory.instance.objectNode();

    public JsonProperties() {
    }

    public JsonProperties(JsonProperties props) {
        this.load(props);
    }

    public JsonProperties(ObjectNode json) {
        this.load(json);
    }

    public JsonProperties(Properties props) {
        this.load(props);
    }
    
    public void load(Properties props) {
        load(unflatten(props));
    }

    public void load(JsonProperties props) {
        load(props, false);
    }
    
    public void load(JsonProperties props, boolean clear) {
        load(props.getJson(), clear);
    }

    public void load(ObjectNode json) {
        load(json, false);
    }

    public void load(String path, ObjectNode json) throws Exception {
        // Move the json to the new path
        ObjectNode root = JsonNodeFactory.instance.objectNode();
        buildPath(path, json, root);

        // Then merge it with the existing json
        load(root, false);
    }
        
    public void load(ObjectNode json, boolean clear) {
        synchronized (LOCK) {
            if (clear) {
                clear();
            }
            
            // Merge the JSON property trees
            treeMerge(this.json, json);

            // Regenerate the properties list
            generateProperties();
        }
    }

    public synchronized Object setProperty(String key, Object value) throws Exception {
        setJson(key, value);
        return put(key, value);
    }

    public Object getProperty(String key) {
        return super.get(key);
    }

    public Object getProperty(String key, Object defaultValue) {
        Object val = getProperty(key);
        return (val == null) ? defaultValue : val;
    }

    public JsonProperties getProperties(String path) {
        JsonNode node = getJson(path);

        return node.isObject() ? new JsonProperties((ObjectNode) node) : new JsonProperties();
    }

    private JsonNode setJson(String key, Object value) throws Exception {
        ObjectNode node = buildPath(key, value, json);
        key = key.contains(".") ? key.substring(key.lastIndexOf(".") + 1) : key;
        
        return node.get(key);
    }

    public JsonNode getJson(String path) {
        ContainerNode props = json;
        
        if ("".equals(path)) {
            return props;
        }

        String[] chunks = path.trim().split("\\.");

        // TODO: Parse array indexes "some.items[10].user"
        JsonNode node = props;
        for (String chunk : chunks) {
            node = node.get(chunk);
            if (null == node) {
                return null;
            }
        }
        
        return node;
    }

    public synchronized void clear() {
        super.clear();
        json.removeAll();
    }

    public Set<String> propertyNames() {
        return keySet();
    }

    ObjectNode getJson() {
        return json;
    }

    private synchronized void generateProperties() {
        // Load the new properties
        putAll(flatten(json));
    }

    private ContainerNode treeMerge(ContainerNode target, ContainerNode... properties) {
        if (null == properties) {
            return target;
        }

        for (ContainerNode props : properties) {
            if (null == props || props.isNull()) {
                continue;
            }

            if (props.isArray()) {
                if (null == target || !target.isArray()) {
                    target = JsonNodeFactory.instance.arrayNode();
                }

                Iterator<JsonNode> elms = props.getElements();

                while (elms.hasNext()) {
                    JsonNode copy = elms.next();

                    if (copy.isMissingNode() || copy.isNull()) {
                        continue;
                    }

                    boolean has = false;
                    for (JsonNode source : target) {
                        if (source.equals(copy)) {
                            has = true;
                            break;
                        }
                    }

                    if (!has) {
                        ((ArrayNode) target).add(copy);
                    }
                }
            } else if (props.isObject()) {
                if (null == target || !target.isObject()) {
                    target = JsonNodeFactory.instance.objectNode();
                }
    
                Iterator<String> fields = props.getFieldNames();
    
                while (fields.hasNext()) {
                    String field = fields.next();
                    JsonNode source = target.get(field);
                    JsonNode copy = props.get(field);
    
                    if (null != source && source.equals(copy) || copy.isMissingNode() || copy.isNull()) {
                        continue;
                    }
    
                    if (null == source || source.isMissingNode() || source.isNull()) {
                        ((ObjectNode) target).put(field, copy);
                    } else if (copy.isValueNode()) {
                        ((ObjectNode) target).put(field, copy);
                    } else if (copy.isArray()) {
                        if (!source.isArray()) {
                            ((ObjectNode) target).put(field, copy);
                        } else {
                            ArrayNode clone = JsonNodeFactory.instance.arrayNode();
                            clone.addAll((ArrayNode) target.get(field));

                            ((ObjectNode) target).put(field, treeMerge(clone, (ArrayNode) copy));
                        }
                    } else if (copy.isObject()) {
                        if (!source.isObject()) {
                            ((ObjectNode) target).put(field, copy);
                        } else {
                            ObjectNode clone = JsonNodeFactory.instance.objectNode();
                            clone.putAll((ObjectNode) target.get(field));

                            ((ObjectNode) target).put(field, treeMerge(clone, (ObjectNode) copy));
                        }
                    }
                }
            }
        }

        return target;
    }

    private static Map<String, Object> flatten(JsonNode node) {
        return flatten(node, null);
    }
    /***
     * Flatten nested JSON into a single map of dot-notated properties.
     * (e.g. {"one": {"two": {"three": "yay!"}}} -> "one.two.three = yay!").
     *
     * @param node  Root JSON node that will be walked to produce a collection of properties
     * @param key   The root property name. Nested fields will be prefixed with this.
     * @return      A map of values with dot-notation keys representing the original path
     */
    private static Map<String, Object> flatten(JsonNode node, String key) {
        Map<String, Object> map = new HashMap<String, Object>();
        
        if (null != node) {
    
            if (node.isContainerNode()) {
                if (node.isArray()) {
                    Iterator<JsonNode> elms = node.getElements();
                    int i = 0;

                    while (elms.hasNext()) {
                        JsonNode elm = elms.next();
                        map.putAll(flatten(elm, key + "[" + i++ + "]"));
                    }
                } else if (node.isObject()) {
                    // TODO: Jackson 1.9 has node.getFields()
                    Iterator<String> fields = node.getFieldNames();
        
                    while (fields.hasNext()) {
                        String field = fields.next();
                        map.putAll(flatten(node.get(field), key == null ? field : key + "." + field));
                    }
                }
            } else if (node.isValueNode()) {
                if (node.isTextual()) {
                    map.put(key, node.getTextValue());
                } else if (node.isBoolean()) {
                    map.put(key, node.getBooleanValue());
                } else if (node.isInt()) {
                    map.put(key, node.getIntValue());
                } else if (node.isLong()) {
                    map.put(key, node.getLongValue());
                } else if (node.isDouble()) {
                    map.put(key, node.getDoubleValue());
                } else if (node.isBigInteger()) {
                    map.put(key, node.getBigIntegerValue());
                } else if (node.isBigDecimal()) {
                    map.put(key, node.getDecimalValue());
                } else if (node.isBinary()) {
                    // TODO: Handle binary??
//                    map.put(key, node.getBinaryValue());
                }
            }
        }

        return map;
    }
    
    private static ObjectNode unflatten(Properties props) {
        ObjectNode root = JsonNodeFactory.instance.objectNode();

        Set<String> keys = props.stringPropertyNames();
        for (String key : keys) {
            String value = props.getProperty(key);
            value = value.trim();
            ObjectNode node;

            try {
                // determine property value type
                if (value.equalsIgnoreCase("true")) {
                    buildPath(key, true, root);
                } else if (value.equalsIgnoreCase("false")) {
                    buildPath(key, false, root);
                } else {
                    // is it an integer?
                    try {
                        int intVal = Integer.parseInt(value);
                        buildPath(key, intVal, root);
                        continue;
                    } catch (NumberFormatException e) {
                        // nope!
                    }

                    // is it a long?
                    try {
                        long longVal = Long.parseLong(value);
                        buildPath(key, longVal, root);
                        continue;
                    } catch (NumberFormatException e) {
                        // nope!
                    }

                    // is it a float?
                    try {
                        float floatVal = Float.parseFloat(value);
                        buildPath(key, floatVal, root);
                        continue;
                    } catch (NumberFormatException e) {
                        // nope!
                    }

                    // guess it's a string
                    buildPath(key, value, root);
                }
            } catch (Exception e) {
                log.warn("Couldn't unflatten '%s' with value '%s'", e, key, value);
            }
        }

        return root;
    }
    
    private static ObjectNode buildPath(String key, Object value, ObjectNode root) {
        ObjectNode node = root;

        String fullKey = key;
        String path = "";

        List<String> chunks = Arrays.asList(key.trim().split("\\."));
        if (!chunks.isEmpty()) {

            Iterator<String> iterator = chunks.iterator();
            while (iterator.hasNext()) {
                String chunk = iterator.next();

                key = chunk;
                path = path.equals("") ? chunk : path + "." + chunk;

                if (!iterator.hasNext()) {
                    break;
                } else if (null != node.get(key) && !node.get(key).isObject()) {
                    throw new RuntimeException("Could not create path for key '" + fullKey + "', '" + path + "' already has a value");
                } else if (null == node.get(key)) {
                    node.put(key, node.objectNode());
                }

                node = (ObjectNode) node.get(key);
            }

            // Determine property value type
            if (value instanceof Boolean) {
                node.put(key, (Boolean) value);
            } else if (value instanceof Integer) {
                node.put(key, (Integer) value);
            } else if (value instanceof Long) {
                node.put(key, (Long) value);
            } else if (value instanceof Float) {
                node.put(key, (Float) value);
            } else if (value instanceof Double) {
                node.put(key, (Double) value);
            } else if (value instanceof BigDecimal) {
                node.put(key, (BigDecimal) value);
            } else if (value instanceof String) {
                node.put(key, (String) value);
            } else if (value instanceof JsonNode) {
                node.put(key, (JsonNode) value);
            } else {
                throw new RuntimeException("Unknown property type '" + value.getClass() + "'");
            }
        }

        return node;
    }

    public static Properties asProperties(JsonProperties properties) {
        Properties copy = new BaseProperties();
        Set<String> keys = properties.propertyNames();

        for (String key : keys) {
            Object value = properties.getProperty(key);

            try {
                copy.setProperty(key, properties.getProperty(key).toString());
            } catch (Exception e) {
                log.warn("Couldn't set property '%s'", e, key, value);
            }
        }

        return copy;
    }
}