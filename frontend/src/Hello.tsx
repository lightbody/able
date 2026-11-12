// "Hello world" for the API: shows the greeting the backend returns, which
// proves the page can reach it. Replace it with real features.

import { useAuth } from "@workos-inc/authkit-react"; // able:only auth
import { useEffect, useState } from "react";
import { BASE } from "./api";

export function Hello() {
  const { getAccessToken } = useAuth(); // able:only auth
  const [message, setMessage] = useState<string>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const headers: Record<string, string> = {};
      headers.Authorization = `Bearer ${await getAccessToken()}`; // able:only auth
      const res = await fetch(`${BASE}/hello`, { headers });
      if (!res.ok) throw new Error(`GET /hello failed: ${res.status}`);
      const body = (await res.json()) as { message: string };
      if (!cancelled) setMessage(body.message);
    })().catch(() => {
      if (!cancelled) setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [
    getAccessToken, // able:only auth
  ]);

  if (failed) return <p role="alert">Couldn't reach the API.</p>;
  return <p className="subtitle">{message ?? "Loading…"}</p>;
}
