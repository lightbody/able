// Database and live-query tests. Requires a Postgres reachable via
// DATABASE_URL (defaults to the local docker-compose service). Realtime
// sealing is local crypto under a locally minted secret, so no Neon is
// needed; sign-in uses the locally minted keys in support/auth.ts.

import { randomBytes } from "node:crypto";
import { createRealtime } from "@neon/realtime/server";
import type { FastifyInstance } from "fastify";
import { compactDecrypt } from "jose";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AppContext } from "../src/context.js";
import { runMigrations } from "../src/migrate.js";
import { buildApp } from "../src/server.js";
import { mintKeys } from "./support/auth.js";

/** A well-formed Realtime secret: the SDK's prefix plus 32 random bytes, base64url. */
function mintRealtimeSecret(): { secret: string; key: Uint8Array } {
  const key = new Uint8Array(randomBytes(32));
  return { secret: `nrt_live_1${Buffer.from(key).toString("base64url")}`, key };
}

let pool: Pool;
let ctx: AppContext;
let app: FastifyInstance;
let token: (sub: string) => Promise<string>;
let realtimeKey: Uint8Array;

const REALTIME_URL = "wss://realtime.example.test/v1";

beforeAll(async () => {
  const databaseUrl =
    process.env.DATABASE_URL ?? "postgresql://postgres:password@127.0.0.1:5432/app_test?sslmode=disable";
  pool = new Pool({ connectionString: databaseUrl });
  await runMigrations(pool, new URL("../migrations", import.meta.url).pathname);

  const keys = await mintKeys();
  token = keys.token;

  const { secret, key } = mintRealtimeSecret();
  realtimeKey = key;
  const realtime = createRealtime({ secret, db: "neondb" });

  ctx = { pool, realtime, realtimeUrl: REALTIME_URL, jwks: keys.jwks };
  app = buildApp(ctx, "http://localhost:5173");
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await pool.end();
});

beforeEach(async () => {
  await pool.query("TRUNCATE greetings RESTART IDENTITY CASCADE");
});

describe("POST /greetings", () => {
  it("rejects an unauthenticated request", async () => {
    const res = await app.inject({ method: "POST", url: "/greetings", payload: { message: "hi" } });
    expect(res.statusCode).toBe(401);
  });

  it("normalizes the message via the shared formatGreeting helper and attributes it to the caller", async () => {
    const jwt = await token("user_123");
    const res = await app.inject({
      method: "POST",
      url: "/greetings",
      headers: { authorization: `Bearer ${jwt}` },
      payload: { message: "hi there" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ message: "hi there!", created_by: "user_123" });
    // Decimal-string txid, for the client's awaitTxId().
    expect(res.json().txid).toMatch(/^\d+$/);
  });

  it("rejects an empty message", async () => {
    const jwt = await token("user_123");
    const res = await app.inject({
      method: "POST",
      url: "/greetings",
      headers: { authorization: `Bearer ${jwt}` },
      payload: { message: "   " },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("GET /live/config", () => {
  it("rejects an unauthenticated request", async () => {
    const res = await app.inject({ method: "GET", url: "/live/config" });
    expect(res.statusCode).toBe(401);
  });

  it("returns the branch's Live SQL API URL", async () => {
    const jwt = await token("user_123");
    const res = await app.inject({ method: "GET", url: "/live/config", headers: { authorization: `Bearer ${jwt}` } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ url: REALTIME_URL });
  });
});

describe("POST /live/:view", () => {
  it("rejects an unauthenticated request", async () => {
    const res = await app.inject({ method: "POST", url: "/live/greetings" });
    expect(res.statusCode).toBe(401);
  });

  it("seals the view's server-defined query", async () => {
    const jwt = await token("user_123");
    const res = await app.inject({
      method: "POST",
      url: "/live/greetings",
      headers: { authorization: `Bearer ${jwt}` },
    });
    expect(res.statusCode).toBe(200);
    // A sealed query is a bearer token -- it must never be cached.
    expect(res.headers["cache-control"]).toBe("no-store");

    const sealed = res.json() as { capability: string; expiresAt: number; queryFingerprint: string };
    expect(sealed.expiresAt).toBeGreaterThan(Date.now());
    expect(sealed.queryFingerprint).toEqual(expect.any(String));

    // The capability is a JWE under the Realtime secret: decrypt it to check
    // exactly what the client is allowed to subscribe to.
    const { plaintext } = await compactDecrypt(sealed.capability, realtimeKey);
    const claims = JSON.parse(new TextDecoder().decode(plaintext));
    expect(claims).toMatchObject({
      database: "neondb",
      sql: "SELECT id, message, created_by, created_at FROM greetings ORDER BY created_at, id",
      parameters: [],
    });
  });

  it.each(["nope", "__proto__", "toString"])("rejects unknown view %s", async (view) => {
    const jwt = await token("user_123");
    const res = await app.inject({
      method: "POST",
      url: `/live/${view}`,
      headers: { authorization: `Bearer ${jwt}` },
    });
    expect(res.statusCode).toBe(400);
  });
});
