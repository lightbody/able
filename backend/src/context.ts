import type { KeyLike } from "jose";
import type { Db } from "./db.js"; // able:only postgres

/** State shared across every request. Each feature adds its share. */
export interface AppContext
  extends Db // able:only postgres
{
  /** WorkOS JWKS, fetched once at boot and never refreshed (see auth.ts). */
  jwks: Map<string, KeyLike>;
}
