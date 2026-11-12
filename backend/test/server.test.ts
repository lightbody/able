// The server itself: health, CORS and request logging. Needs no database and
// no sign-in, because routes only read the context when they're called.

import type { FastifyInstance } from "fastify";
import { pino } from "pino";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AppContext } from "../src/context.js";
import { buildApp } from "../src/server.js";

const ctx = {} as AppContext;
let app: FastifyInstance;

beforeAll(async () => {
  app = buildApp(ctx, "http://localhost:5173");
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

describe("request logging", () => {
  // A real pino logger writing into an array, so we see exactly what would
  // reach stdout.
  async function withCapturedLogs(
    fn: (logged: FastifyInstance) => Promise<void>,
  ): Promise<Array<Record<string, unknown>>> {
    const lines: Array<Record<string, unknown>> = [];
    const logger = pino({ level: "info" }, { write: (line: string) => void lines.push(JSON.parse(line)) });
    const logged = buildApp(ctx, "http://localhost:5173", { logger });
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
        url: "/anything",
        headers: {
          origin: "http://localhost:5173",
          "access-control-request-method": "POST",
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
      const res = await logged.inject({ method: "GET", url: "/no-such-route" });
      expect(res.statusCode).toBe(404);
    });
    const messages = lines.map((l) => l.msg);
    expect(messages).toContain("incoming request");
    expect(messages).toContain("request completed");
  });
});
