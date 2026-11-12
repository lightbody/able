# Changes to `auth`

Notes for apps that have this Module, newest first. `able/CHANGES.md`
says how to write an entry.

## 2026-11-12: Sign-in lives in one place on each side

The frontend's sign-in is one component, `<AuthGate>`, in
`frontend/src/auth.tsx`. The backend's JWKS loading moved into
`backend/src/auth.ts` (`loadJwks`).

- **Why:** the rest of the app no longer needs to know how sign-in works.
- **Touches:** `frontend/src/auth.tsx`, `main.tsx`, `App.tsx`;
  `backend/src/auth.ts`, `context.ts`, `main.ts`.
- **Needs from you:** nothing.
