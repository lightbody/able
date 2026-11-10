// JWT extraction: WorkOS JWTs validated against a boot-time JWKS snapshot.
// The verified user id is also recorded on the request's trace span.
//
// No issuer check: the JWKS signature already proves the token is from
// WorkOS. WorkOS's iss claim is an opaque internal ID that differs from the
// public client ID, making static validation brittle. No audience check
// either.

import type { FastifyRequest } from "fastify";
import { decodeProtectedHeader, jwtVerify } from "jose";
import type { AppContext } from "./context.js";
import { AppError } from "./errors.js";
import { setSpanUser } from "./observability.js";

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
    setSpanUser(payload.sub);
    return payload.sub;
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw AppError.unauthorized("invalid token");
  }
}
