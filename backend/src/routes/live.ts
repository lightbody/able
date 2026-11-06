// Neon Realtime live-query endpoints. The browser holds a WebSocket straight
// to Neon's Live SQL API, but it can only subscribe to queries this backend
// has *sealed*: signed and encrypted (SQL + parameters) with the branch's
// NEON_REALTIME_SECRET, valid for 60s. So authorization happens here, at seal
// time, and the client renews by calling back in before expiry.
//
// Clients ask for a view by name (POST /live/<name>) and never send SQL or
// parameters -- each view is a fixed query built server-side from the
// authenticated userId. Auth gates *who can read at all*, not yet *which
// rows*: `greetings` is shared by every signed-in user, so it
// ignores userId. Once a view needs to be scoped to one person or one
// household, bind userId as a `$1` parameter (or join through a membership
// table, so removing a member revokes access immediately).

import type { RawSqlQuery } from "@neon/realtime/server";
import { rawSql } from "@neon/realtime/server";
import type { FastifyInstance } from "fastify";
import { authenticate } from "../auth.js";
import type { AppContext } from "../context.js";
import { AppError } from "../errors.js";

export const VIEWS: Record<string, (userId: string) => RawSqlQuery<unknown>> = {
  greetings: () =>
    rawSql("SELECT id, message, created_by, created_at FROM greetings ORDER BY created_at, id"),
};

export function registerLiveRoutes(app: FastifyInstance, ctx: AppContext): void {
  // The Live SQL API URL is per Neon branch, so serve it from the backend's
  // own config rather than baking it into the frontend build -- a PR's
  // frontend is built before its preview branch's URL is known.
  app.get("/live/config", async (req, reply) => {
    await authenticate(ctx, req);
    return reply.send({ url: ctx.realtimeUrl });
  });

  app.post<{ Params: { view: string } }>("/live/:view", async (req, reply) => {
    const userId = await authenticate(ctx, req);
    const view = Object.hasOwn(VIEWS, req.params.view) ? VIEWS[req.params.view] : undefined;
    if (!view) throw AppError.badRequest("unknown_view");

    const sealed = await ctx.realtime.seal({ query: view(userId) });
    // A sealed query is a bearer token: never let anything cache it.
    reply.header("cache-control", "no-store");
    return reply.send(sealed);
  });
}
