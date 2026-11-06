import type { FastifyInstance } from "fastify";
import { authenticate } from "../auth.js";
import type { AppContext } from "../context.js";

// Minimal smoke-test endpoint for the auth wiring -- confirms a WorkOS
// access token validates against this backend's JWKS. No users table yet;
// add one (and real onboarding) once there's a feature that needs it.
export function registerMeRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get("/me", async (req, reply) => {
    const userId = await authenticate(ctx, req);
    return reply.send({ id: userId });
  });
}
