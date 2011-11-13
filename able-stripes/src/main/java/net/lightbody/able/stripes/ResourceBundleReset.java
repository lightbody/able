package net.lightbody.able.stripes;

import com.google.inject.Singleton;
import com.google.inject.Stage;
import com.google.inject.Inject;

import java.util.ResourceBundle;
import java.util.Map;
import java.lang.reflect.Field;

@Singleton
public class ResourceBundleReset {
    private Stage stage;

    @Inject
    public ResourceBundleReset(Stage stage) {
        this.stage = stage;
    }

    public void reset() {
        if (stage == Stage.DEVELOPMENT) {
            try {
                Class type = ResourceBundle.class;
                Field cacheList = type.getDeclaredField("cacheList");
                cacheList.setAccessible(true);
                ((Map)cacheList.get(ResourceBundle.class)).clear();
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }
}