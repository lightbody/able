// Sign-in: bearer tokens are checked against the JWKS in the context.

import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AppContext } from "../src/context.js";
import { buildApp } from "../src/server.js";
import { mintKeys, type TestKeys } from "./support/auth.js";

let app: FastifyInstance;
let keys: TestKeys;

beforeAll(async () => {
  keys = await mintKeys();
  app = buildApp({ jwks: keys.jwks } as AppContext, "http://localhost:5173");
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe("GET /hello", () => {
  it("rejects a request with no bearer token", async () => {
    const res = await app.inject({ method: "GET", url: "/hello" });
    expect(res.statusCode).toBe(401);
  });
});

describe("GET /me", () => {
  it("rejects a request with no bearer token", async () => {
    const res = await app.inject({ method: "GET", url: "/me" });
    expect(res.statusCode).toBe(401);
  });

  it("rejects a token signed by another key", async () => {
    const other = await mintKeys();
    const jwt = await other.token("user_123");
    const res = await app.inject({ method: "GET", url: "/me", headers: { authorization: `Bearer ${jwt}` } });
    expect(res.statusCode).toBe(401);
  });

  it("returns the authenticated user's id", async () => {
    const jwt = await keys.token("user_123");
    const res = await app.inject({ method: "GET", url: "/me", headers: { authorization: `Bearer ${jwt}` } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ id: "user_123" });
  });
});
