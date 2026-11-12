// Sign-in for tests: a locally minted RS256 key pair. The public key goes
// into AppContext.jwks and the private key signs test tokens, so no WorkOS
// network dependency is needed.

import { generateKeyPairSync } from "node:crypto";
import { exportJWK, importJWK, SignJWT, type KeyLike } from "jose";

const KID = "test-key";

export interface TestKeys {
  jwks: Map<string, KeyLike>;
  /** A signed access token for the given user id. */
  token(sub: string): Promise<string>;
}

export async function mintKeys(): Promise<TestKeys> {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = await exportJWK(publicKey);
  jwk.kid = KID;
  jwk.alg = "RS256";
  const importedPublic = await importJWK(jwk, "RS256");
  const jwks = new Map<string, KeyLike>();
  jwks.set(KID, importedPublic as KeyLike);
  return {
    jwks,
    token: (sub) =>
      new SignJWT({})
        .setProtectedHeader({ alg: "RS256", kid: KID })
        .setSubject(sub)
        .setExpirationTime("10y")
        .sign(privateKey as unknown as KeyLike),
  };
}
