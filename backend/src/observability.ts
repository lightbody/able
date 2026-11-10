// App-side telemetry: request route naming, the signed-in user on spans, and
// the app's own (business) metrics. Everything here goes through
// @opentelemetry/api, which is a no-op until telemetry.ts starts the SDK, so
// it's safe to call in tests and in local dev.

import { context, metrics, trace } from "@opentelemetry/api";
import { getRPCMetadata, RPCType } from "@opentelemetry/core";
import type { FastifyInstance } from "fastify";

const meter = metrics.getMeter("myapp-backend");

/**
 * The app's own metrics. Keep attribute values to small fixed sets (a view
 * name, an outcome) -- never ids or user input -- since every distinct
 * combination is a separate billed series in Grafana Cloud.
 */
export const appMetrics = {
  /** Live queries sealed, by view. Each signed-in tab renews every ~60s, so this tracks active viewers. */
  liveSeals: meter.createCounter("app.live.seals", {
    description: "Neon Realtime live queries sealed, by view",
  }),
  /** Greetings written. */
  greetingsCreated: meter.createCounter("app.greetings.created", {
    description: "Greetings created",
  }),
};

/** Records the authenticated WorkOS user id on the current request's span. */
export function setSpanUser(userId: string): void {
  trace.getActiveSpan()?.setAttribute("user.id", userId);
}

/**
 * Keeps CORS preflights out of the request logs, like /health. @fastify/cors
 * answers them through its own `OPTIONS *` route, one per cross-origin API
 * call from the browser, so at "info" they double the log volume with lines
 * that carry no trace id (telemetry.ts doesn't trace them either). Must be
 * registered before the cors plugin adds that route.
 */
export function quietCorsPreflights(app: FastifyInstance): void {
  app.addHook("onRoute", (route) => {
    const methods = Array.isArray(route.method) ? route.method : [route.method];
    if (route.url === "*" && methods.includes("OPTIONS")) route.logLevel = "warn";
  });
}

/**
 * Names each request's server span and http.server.request.duration series by
 * its route template ("POST /live/:view"), not its raw URL. Without a
 * framework instrumentation the http instrumentation only knows the method,
 * so every span would just be "POST". It reads the route back from the
 * context's RPC metadata when the response ends.
 */
export function registerRouteNaming(app: FastifyInstance): void {
  app.addHook("onRequest", async (req) => {
    const route = req.routeOptions.url;
    if (!route) return; // 404: leave it unnamed rather than invent a route
    const rpc = getRPCMetadata(context.active());
    if (rpc?.type === RPCType.HTTP) rpc.route = route;
  });
}
