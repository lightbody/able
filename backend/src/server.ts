import cors from "@fastify/cors";
import Fastify, { type FastifyBaseLogger, type FastifyInstance } from "fastify";
import type { AppContext } from "./context.js";
import { errorHandler } from "./errors.js";
import { registerRouteNaming } from "./observability.js"; // able:only observability
import { registerGreetingRoutes } from "./routes/greetings.js"; // able:only postgres
import { registerHealthRoutes } from "./routes/health.js";
import { registerLiveRoutes } from "./routes/live.js"; // able:only postgres
import { registerMeRoutes } from "./routes/me.js"; // able:only auth

export interface BuildAppOptions {
  /** A pino logger for request logs. Omitted (as in tests), Fastify logs nothing. */
  logger?: FastifyBaseLogger;
}

/**
 * Keeps CORS preflights out of the request logs, like /health. @fastify/cors
 * answers them through its own `OPTIONS *` route, one per cross-origin API
 * call from the browser, so at "info" they double the log volume with lines
 * that say nothing new. Must be registered before the cors plugin adds that
 * route.
 */
function quietCorsPreflights(app: FastifyInstance): void {
  app.addHook("onRoute", (route) => {
    const methods = Array.isArray(route.method) ? route.method : [route.method];
    if (route.url === "*" && methods.includes("OPTIONS")) route.logLevel = "warn";
  });
}

// Each feature registers its own routes here, one line each. `ctx` is only
// read when a request arrives.
export function buildApp(ctx: AppContext, allowedOrigin: string, opts: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({ logger: opts.logger ?? false });
  registerRouteNaming(app); // able:only observability
  quietCorsPreflights(app);

  app.register(cors, {
    origin: allowedOrigin,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });

  app.setErrorHandler(errorHandler);

  registerHealthRoutes(app);
  registerMeRoutes(app, ctx); // able:only auth
  registerLiveRoutes(app, ctx); // able:only postgres
  registerGreetingRoutes(app, ctx); // able:only postgres

  return app;
}
