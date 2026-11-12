import type { FastifyInstance } from "fastify";

export function registerHealthRoutes(app: FastifyInstance): void {
  // Fly polls this every 30s. Keep it out of the request logs so it doesn't
  // drown out real traffic.
  // telemetry.ts keeps it out of traces too. // able:only observability
  app.get("/health", { logLevel: "warn" }, async (_req, reply) => {
    return reply.send({ status: "ok" });
  });
}
