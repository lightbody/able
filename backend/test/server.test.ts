// The server itself: health, the hello route, CORS and request logging.
// Needs no database.

import type { FastifyInstance } from "fastify";
import { pino } from "pino";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AppContext } from "../src/context.js"; // able:only auth
import { buildApp } from "../src/server.js";
import { mintKeys } from "./support/auth.js"; // able:only auth

let ctx: AppContext; // able:only auth
let app: FastifyInstance;
/** Headers a signed-in browser would send. */
let headers: Record<string, string> = {};

beforeAll(async () => {
  // able:begin auth
  // Routes only read the context when they're called, so sign-in's share
  // of it is enough here.
  const keys = await mintKeys();
  ctx = { jwks: keys.jwks } as AppContext;
  headers = { authorization: `Bearer ${await keys.token("user_123")}` };
  // able:end
  app = buildApp(
    ctx, // able:only auth
    "http://localhost:5173",
  );
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe("GET /health", () => {
  it("reports ok without auth", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
  });
});

describe("GET /hello", () => {
  it("greets, using the shared formatGreeting helper", async () => {
    const res = await app.inject({ method: "GET", url: "/hello", headers });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ message: "Hello from the API!" });
  });
});

describe("request logging", () => {
  // A real pino logger writing into an array, so we see exactly what would
  // reach stdout.
  async function withCapturedLogs(
    fn: (logged: FastifyInstance) => Promise<void>,
  ): Promise<Array<Record<string, unknown>>> {
    const lines: Array<Record<string, unknown>> = [];
    const logger = pino({ level: "info" }, { write: (line: string) => void lines.push(JSON.parse(line)) });
    const logged = buildApp(
      ctx, // able:only auth
      "http://localhost:5173",
      { logger },
    );
    await logged.ready();
    try {
      await fn(logged);
    } finally {
      await logged.close();
    }
    return lines;
  }

  it("keeps CORS preflights out of the logs", async () => {
    const lines = await withCapturedLogs(async (logged) => {
      const res = await logged.inject({
        method: "OPTIONS",
        url: "/hello",
        headers: {
          origin: "http://localhost:5173",
          "access-control-request-method": "GET",
          "access-control-request-headers": "authorization,content-type",
        },
      });
      expect(res.statusCode).toBe(204);
      expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    });
    expect(lines.filter((l) => (l.req as { method?: string } | undefined)?.method === "OPTIONS")).toEqual([]);
    expect(lines.filter((l) => l.msg === "request completed")).toEqual([]);
  });

  it("keeps /health out of the logs", async () => {
    const lines = await withCapturedLogs(async (logged) => {
      await logged.inject({ method: "GET", url: "/health" });
    });
    expect(lines).toEqual([]);
  });

  it("still logs ordinary requests", async () => {
    const lines = await withCapturedLogs(async (logged) => {
      const res = await logged.inject({ method: "GET", url: "/hello", headers });
      expect(res.statusCode).toBe(200);
    });
    expect(lines.map((l) => l.msg)).toEqual(["incoming request", "request completed"]);
  });
});
