import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import type { AppContext } from "./context.js";
import { errorHandler } from "./errors.js";
import { registerGreetingRoutes } from "./routes/greetings.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerLiveRoutes } from "./routes/live.js";
import { registerMeRoutes } from "./routes/me.js";

export function buildApp(ctx: AppContext, allowedOrigin: string): FastifyInstance {
  const app = Fastify({ logger: false });

  app.register(cors, {
    origin: allowedOrigin,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });

  app.setErrorHandler(errorHandler);

  registerHealthRoutes(app);
  registerMeRoutes(app, ctx);
  registerLiveRoutes(app, ctx);
  registerGreetingRoutes(app, ctx);

  return app;
}
