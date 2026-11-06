import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const RETURN_PATH_KEY = "myapp:returnPath";

/**
 * Call right before signIn()/signUp(). WorkOS validates redirect_uri as an
 * exact string against a fixed allowlist (no path wildcards), so
 * AuthKitProvider's redirectUri must stay pinned to the bare origin -- every
 * sign-in redirect lands back on "/" regardless of where it started. Stash
 * the real destination here so useReturnPathRedirect can send the user back
 * to it once signed in.
 */
export function saveReturnPath() {
  const path = window.location.pathname + window.location.search;
  if (path !== "/") sessionStorage.setItem(RETURN_PATH_KEY, path);
}

/** Once signed in, redirect back to whatever path saveReturnPath() captured. */
export function useReturnPathRedirect(user: unknown, isLoading: boolean) {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isLoading || !user) return;
    const path = sessionStorage.getItem(RETURN_PATH_KEY);
    if (!path || path === location.pathname + location.search) return;
    sessionStorage.removeItem(RETURN_PATH_KEY);
    navigate(path, { replace: true });
  }, [isLoading, user, location, navigate]);
}
