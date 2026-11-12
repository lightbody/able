import type { KeyLike } from "jose"; // able:only auth
import type { Db } from "./db.js"; // able:only postgres

/** State shared across every request. */
export interface AppContext
  extends Db // able:only postgres
{
  // able:begin auth
  /** WorkOS JWKS, fetched once at boot and never refreshed (see auth.ts). */
  jwks: Map<string, KeyLike>;
  // able:end
}
