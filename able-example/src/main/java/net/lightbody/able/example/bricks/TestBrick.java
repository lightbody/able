package net.lightbody.able.example.bricks;

import com.google.sitebricks.At;
import com.google.sitebricks.headless.Reply;
import com.google.sitebricks.headless.Service;
import com.google.sitebricks.http.Get;

@Service
@At("/api/test")
public class TestBrick {
    @Get
    public Reply<?> get() {
        return Reply.saying().ok();
    }
}
