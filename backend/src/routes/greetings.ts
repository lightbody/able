import { formatGreeting } from "@myapp/shared";
import type { FastifyInstance } from "fastify";
import { authenticate } from "../auth.js";
import type { AppContext } from "../context.js";
import { AppError } from "../errors.js";
import { appMetrics } from "../observability.js"; // able:only observability

interface CreateGreetingBody {
  message?: string;
}

// Writes are plain REST -- reads flow
// through Neon Realtime live queries (live.ts) instead, so this only needs a
// create endpoint. The response carries the write's transaction id so the
// client can awaitTxId() until its own write has synced back in.
export function registerGreetingRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.post<{ Body: CreateGreetingBody }>("/greetings", async (req, reply) => {
    const userId = await authenticate(ctx, req);
    const message = req.body?.message?.trim();
    if (!message) throw AppError.badRequest("message_required");

    const { rows } = await ctx.pool.query(
      "INSERT INTO greetings (message, created_by) VALUES ($1, $2) RETURNING id, message, created_by, created_at, pg_current_xact_id()::text AS txid",
      [formatGreeting(message), userId],
    );
    appMetrics.greetingsCreated.add(1); // able:only observability
    return reply.status(201).send(rows[0]);
  });
}
