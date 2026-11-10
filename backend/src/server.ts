import cors from "@fastify/cors";
import Fastify, { type FastifyBaseLogger, type FastifyInstance } from "fastify";
import type { AppContext } from "./context.js";
import { errorHandler } from "./errors.js";
import { quietCorsPreflights, registerRouteNaming } from "./observability.js";
import { registerGreetingRoutes } from "./routes/greetings.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerLiveRoutes } from "./routes/live.js";
import { registerMeRoutes } from "./routes/me.js";

export interface BuildAppOptions {
  /** A pino logger for request logs. Omitted (as in tests), Fastify logs nothing. */
  logger?: FastifyBaseLogger;
}

export function buildApp(ctx: AppContext, allowedOrigin: string, opts: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({ logger: opts.logger ?? false });
  registerRouteNaming(app);
  quietCorsPreflights(app);

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
