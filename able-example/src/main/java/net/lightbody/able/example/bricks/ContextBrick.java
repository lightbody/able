package net.lightbody.able.example.bricks;

import com.google.inject.Inject;
import com.google.sitebricks.At;
import com.google.sitebricks.client.transport.Json;
import com.google.sitebricks.headless.Reply;
import com.google.sitebricks.headless.Service;
import com.google.sitebricks.http.Get;
import net.lightbody.able.core.config.Configuration;
import net.lightbody.able.core.config.JsonProperties;
import org.codehaus.jackson.JsonNode;

@Service
@At("/api/context")
public class ContextBrick {

    private JsonProperties config;

    @Inject
    public ContextBrick (@Configuration JsonProperties config) {
        this.config = config;
    }

    @Get
    public Reply<?> get() {
        JsonNode publicConfig = config.getJson("public");

        return Reply.with(publicConfig).as(Json.class);
    }
}
