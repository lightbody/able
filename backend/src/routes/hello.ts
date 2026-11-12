import { formatGreeting } from "@myapp/shared";
import type { FastifyInstance } from "fastify";
import { authenticate } from "../auth.js"; // able:only auth
import type { AppContext } from "../context.js"; // able:only auth

// "Hello world" for the API: proves the frontend can reach the backend, and
// that both use the same shared code. Replace it with real routes.
export function registerHelloRoutes(
  app: FastifyInstance,
  ctx: AppContext, // able:only auth
): void {
  app.get(
    "/hello",
    { preHandler: async (req) => void (await authenticate(ctx, req)) }, // able:only auth
    async () => ({ message: formatGreeting("Hello from the API") }),
  );
}
