import type { RawSqlQuery, RealtimeServer } from "@neon/realtime/server";
import type { KeyLike } from "jose";
import type { Pool } from "pg";

/** State shared across every request. */
export interface AppContext {
  pool: Pool;
  /** Seals live queries with the branch's NEON_REALTIME_SECRET (see routes/live.ts). */
  realtime: RealtimeServer<RawSqlQuery<unknown>>;
  /** The branch's Live SQL API WebSocket URL, handed to the browser as-is. */
  realtimeUrl: string;
  /** WorkOS JWKS, fetched once at boot and never refreshed (see auth.ts). */
  jwks: Map<string, KeyLike>;
}
