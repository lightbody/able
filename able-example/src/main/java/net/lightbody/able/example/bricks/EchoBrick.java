package net.lightbody.able.example.bricks;

import com.google.inject.name.Named;
import com.google.sitebricks.At;
import com.google.sitebricks.headless.Reply;
import com.google.sitebricks.headless.Service;
import com.google.sitebricks.http.Get;

@Service
@At("/api/echo")
public class EchoBrick {
    @Get
    @At("/:message")
    public Reply<?> message(@Named("message") String message) {
        return Reply.with("You said, \"" + message + "\"").ok();
    }
}
