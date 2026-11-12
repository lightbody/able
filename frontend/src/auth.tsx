// Sign-in with WorkOS AuthKit. <AuthGate> wraps the app: it shows the
// sign-in page until there's a user, then renders its children. Everything
// below it can call useAuth().

import { AuthKitProvider, useAuth } from "@workos-inc/authkit-react";
import { useEffect, type ReactNode } from "react";
import { useReturnPathRedirect } from "./authReturn";
import { Landing } from "./pages/Landing";
import { setTelemetryUser } from "./telemetry"; // able:only observability

function requireClientId(): string {
  const id = import.meta.env.VITE_WORKOS_CLIENT_ID;
  if (!id) throw new Error("VITE_WORKOS_CLIENT_ID is not set");
  return id;
}
const clientId = requireClientId();

export function AuthGate({ children }: { children: ReactNode }) {
  return (
    // WorkOS validates redirect_uri as an exact string against a fixed
    // allowlist (no path wildcards), so this must stay pinned to the bare
    // origin -- see authReturn.ts for how deep links still return the user
    // to where they started after signing in.
    <AuthKitProvider clientId={clientId} redirectUri={window.location.origin} devMode={true}>
      <SignedIn>{children}</SignedIn>
    </AuthKitProvider>
  );
}

function SignedIn({ children }: { children: ReactNode }) {
  const { isLoading, user } = useAuth();
  // Every sign-in redirect lands back on "/"; send anyone who started deeper
  // in the app back to where they actually started.
  useReturnPathRedirect(user, isLoading);
  // able:begin observability
  useEffect(() => {
    if (!isLoading) setTelemetryUser(user?.id ?? null);
  }, [isLoading, user?.id]);
  // able:end

  if (isLoading) {
    return <p className="status">Loading…</p>;
  }
  return user ? <>{children}</> : <Landing />;
}

export function SignOutButton() {
  const { signOut } = useAuth();
  return (
    <button className="btn-link" onClick={() => signOut()}>
      Sign out
    </button>
  );
}
