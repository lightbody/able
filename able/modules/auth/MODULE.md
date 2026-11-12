---
module: auth
provider: WorkOS AuthKit
requires: backend
---

# auth

Sign-in. The frontend signs in with WorkOS AuthKit and sends a bearer token
with every backend call; the backend checks it against WorkOS's JWKS.

## Files

- `backend/src/auth.ts`
- `backend/src/routes/me.ts`
- `backend/test/auth.test.ts`
- `backend/test/support/auth.ts`
- `frontend/src/auth.tsx`
- `frontend/src/authReturn.ts`
- `frontend/src/pages/`
- `frontend/.env.local.example`

## npm dependencies

- `backend`: `jose`
- `frontend`: `@workos-inc/authkit-react`

## Deploy

- `deploy.env`: `WORKOS_CLIENT_ID`.
- No tokens: WorkOS is set up in its dashboard.
