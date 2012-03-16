package net.lightbody.able.freemarker;

import com.google.inject.Provider;
import freemarker.template.Configuration;
import freemarker.template.DefaultObjectWrapper;
import net.lightbody.able.core.util.Able;

import java.io.File;
import java.io.FilenameFilter;
import java.io.IOException;

public class ConfigurationProvider implements Provider<Configuration> {
    private Configuration configuration;

    public ConfigurationProvider() throws IOException {
        configuration = new Configuration();
        Configuration cfg = configuration;
        File dir = Able.findWebAppDir();
        cfg.setDirectoryForTemplateLoading(dir);
        cfg.setObjectWrapper(new DefaultObjectWrapper());
        File tags = new File(dir, "tags");
        if (tags.exists()) {
            File[] files = tags.listFiles(new FilenameFilter() {
                @Override
                public boolean accept(File dir, String name) {
                    return name.endsWith(".ftl");
                }
            });

            for (File file : files) {
                String name = file.getName().substring(0, file.getName().lastIndexOf(".ftl"));
                cfg.addAutoImport(name, "tags/" + file.getName());
            }
        }
    }

    @Override
    public Configuration get() {
        return configuration;
    }
}
