import { createRealtimeClient, type RealtimeClient, type SealedLiveQuery } from "@neon/realtime/client";
import { RealtimeProvider } from "@neon/realtime-react";
import { useAuth } from "@workos-inc/authkit-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { BASE } from "./api";

// Live data comes from Neon Realtime: the browser holds one WebSocket to
// Neon's Live SQL API, but can only subscribe to queries the backend has
// sealed (POST /live/<view>, see backend/src/routes/live.ts). Sealed queries
// expire after 60s, so useLiveQuery renews them through refreshQuery.

// One client (and so one WebSocket) per URL for the life of the page, so
// StrictMode's double mount doesn't open a second socket.
const clients = new Map<string, RealtimeClient>();

function clientFor(url: string): RealtimeClient {
  let client = clients.get(url);
  if (!client) {
    client = createRealtimeClient({ url });
    clients.set(url, client);
  }
  return client;
}

/**
 * Provides the Realtime client to everything below it. Must render inside a
 * signed-in subtree: the Live SQL API URL comes from the backend (it differs
 * per Neon branch, so it isn't baked into the build), behind auth.
 */
export function RealtimeGate({ children }: { children: ReactNode }) {
  const { getAccessToken } = useAuth();
  const [url, setUrl] = useState<string>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getAccessToken();
      const res = await fetch(`${BASE}/live/config`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`GET /live/config failed: ${res.status}`);
      const config = (await res.json()) as { url: string };
      if (!cancelled) setUrl(config.url);
    })().catch(() => {
      if (!cancelled) setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [getAccessToken]);

  if (failed) return <p className="status">Couldn't connect to live updates.</p>;
  if (!url) return <p className="status">Loading…</p>;
  return <RealtimeProvider client={clientFor(url)}>{children}</RealtimeProvider>;
}

export interface SealedView<Row> {
  sealedQuery?: SealedLiveQuery<Row>;
  refreshQuery: () => Promise<SealedLiveQuery<Row>>;
  error?: unknown;
}

/**
 * Fetches the sealed query for a named server-side view, plus the
 * refreshQuery callback useLiveQuery needs to keep it renewed. Render the
 * component that calls useLiveQuery only once `sealedQuery` is set.
 */
export function useSealedView<Row>(view: string): SealedView<Row> {
  const { getAccessToken } = useAuth();
  const [state, setState] = useState<{ sealedQuery?: SealedLiveQuery<Row>; error?: unknown }>({});

  const refreshQuery = useCallback(async () => {
    const token = await getAccessToken();
    const res = await fetch(`${BASE}/live/${view}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`POST /live/${view} failed: ${res.status}`);
    return (await res.json()) as SealedLiveQuery<Row>;
  }, [getAccessToken, view]);

  useEffect(() => {
    let cancelled = false;
    refreshQuery().then(
      (sealedQuery) => {
        if (!cancelled) setState({ sealedQuery });
      },
      (error: unknown) => {
        if (!cancelled) setState({ error });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [refreshQuery]);

  return { ...state, refreshQuery };
}
