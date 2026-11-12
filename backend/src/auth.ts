// JWT extraction: WorkOS JWTs validated against a boot-time JWKS snapshot.
// The verified user id is also recorded on the request's trace span.
//
// No issuer check: the JWKS signature already proves the token is from
// WorkOS. WorkOS's iss claim is an opaque internal ID that differs from the
// public client ID, making static validation brittle. No audience check
// either.

import type { FastifyRequest } from "fastify";
import { decodeProtectedHeader, importJWK, jwtVerify, type JWK, type KeyLike } from "jose";
import type { AppContext } from "./context.js";
import { requireEnv } from "./env.js";
import { AppError } from "./errors.js";
import { setSpanUser } from "./observability.js"; // able:only observability

/** Fetches the WorkOS JWKS from WORKOS_JWKS_URL. main.ts calls it once at boot. */
export async function loadJwks(): Promise<Map<string, KeyLike>> {
  const jwksRes = await fetch(requireEnv("WORKOS_JWKS_URL"), { signal: AbortSignal.timeout(30_000) });
  const jwksJson = (await jwksRes.json()) as { keys: Array<Record<string, unknown>> };
  const jwks = new Map<string, KeyLike>();
  for (const jwk of jwksJson.keys) {
    const kid = jwk.kid as string | undefined;
    if (!kid) continue;
    const alg = (jwk.alg as string | undefined) ?? "RS256";
    const key = await importJWK(jwk as unknown as JWK, alg);
    if (key instanceof Uint8Array) continue; // RSA/EC keys only
    jwks.set(kid, key);
  }
  return jwks;
}

export async function authenticate(ctx: AppContext, req: FastifyRequest): Promise<string> {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
  if (!token) throw AppError.unauthorized("missing authorization header");

  let kid: string | undefined;
  try {
    ({ kid } = decodeProtectedHeader(token));
  } catch {
    throw AppError.unauthorized("invalid token");
  }
  if (!kid) throw AppError.unauthorized("invalid token");

  const key = ctx.jwks.get(kid);
  if (!key) throw AppError.unauthorized("invalid token");

  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ["RS256"] });
    if (typeof payload.sub !== "string" || payload.sub.length === 0) {
      throw AppError.unauthorized("invalid token");
    }
    setSpanUser(payload.sub); // able:only observability
    return payload.sub;
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw AppError.unauthorized("invalid token");
  }
}
