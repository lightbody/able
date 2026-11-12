// Postgres (Neon) and Neon Realtime: the connection pool, the migrations, and
// the sealer for live queries. main.ts calls initDb() once at boot.

import type { RawSqlQuery, RealtimeServer } from "@neon/realtime/server";
import { createRealtime } from "@neon/realtime/server";
import { Pool } from "pg";
import { requireEnv } from "./env.js";
import { runMigrations } from "./migrate.js";

/** The database's share of AppContext. */
export interface Db {
  pool: Pool;
  /** Seals live queries with the branch's NEON_REALTIME_SECRET (see routes/live.ts). */
  realtime: RealtimeServer<RawSqlQuery<unknown>>;
  /** The branch's Live SQL API WebSocket URL, handed to the browser as-is. */
  realtimeUrl: string;
}

/** Connects to DATABASE_URL, applies pending migrations, and sets up sealing. */
export async function initDb(migrationsDir: string): Promise<Db> {
  const databaseUrl = requireEnv("DATABASE_URL");
  const realtimeUrl = requireEnv("NEON_REALTIME_URL");
  // createRealtime throws on a malformed secret, so a bad deploy fails here
  // at boot rather than on the first live query.
  const realtime = createRealtime({
    secret: requireEnv("NEON_REALTIME_SECRET"),
    db: process.env.NEON_DB_NAME ?? "neondb",
  });

  // Without an explicit timeout, a stalled TCP handshake hangs the pool
  // forever instead of surfacing an error (pg's default connectionTimeoutMillis
  // is 0 = no timeout). 30s rather than something tighter: a freshly
  // provisioned Neon branch's pooled endpoint can legitimately take longer
  // than a few seconds to accept its first connection after a cold start.
  const pool = new Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 30_000 });

  await runMigrations(pool, migrationsDir);

  return { pool, realtime, realtimeUrl };
}
