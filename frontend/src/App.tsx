import { formatGreeting } from "@myapp/shared";
import type { SealedLiveQuery } from "@neon/realtime/client";
import { useLiveQuery } from "@neon/realtime-react";
import { useAuth } from "@workos-inc/authkit-react";
import { useEffect, useState } from "react";
import { Route, Routes } from "react-router-dom";
import { postGreeting } from "./api";
import { useReturnPathRedirect } from "./authReturn";
import { Landing } from "./pages/Landing";
import { RealtimeGate, useSealedView, type Greeting } from "./realtime";
import { setTelemetryUser } from "./telemetry";

export default function App() {
  const { isLoading, user } = useAuth();
  // Every sign-in redirect lands back on "/" (see main.tsx); send anyone who
  // started deeper in the app back to where they actually started.
  useReturnPathRedirect(user, isLoading);
  useEffect(() => {
    if (!isLoading) setTelemetryUser(user?.id ?? null);
  }, [isLoading, user?.id]);

  if (isLoading) {
    return <p className="status">Loading…</p>;
  }

  return (
    <Routes>
      <Route
        path="/*"
        element={
          user ? (
            <RealtimeGate>
              <Home />
            </RealtimeGate>
          ) : (
            <Landing />
          )
        }
      />
    </Routes>
  );
}

function Home() {
  const { signOut } = useAuth();
  const { sealedQuery, refreshQuery, error } = useSealedView<Greeting>("greetings");

  return (
    <main className="app">
      <header className="topbar">
        <h1>My App</h1>
        <button className="btn-link" onClick={() => signOut()}>
          Sign out
        </button>
      </header>
      <p className="subtitle">Skeleton project -- Postgres → Neon Realtime → React, end to end.</p>

      {sealedQuery ? (
        <Greetings sealedQuery={sealedQuery} refreshQuery={refreshQuery} />
      ) : error ? (
        <p role="alert">Couldn't load greetings.</p>
      ) : (
        <p>Loading…</p>
      )}
    </main>
  );
}

interface GreetingsProps {
  sealedQuery: SealedLiveQuery<Greeting>;
  refreshQuery: () => Promise<SealedLiveQuery<Greeting>>;
}

function Greetings({ sealedQuery, refreshQuery }: GreetingsProps) {
  const { getAccessToken } = useAuth();
  const { data: greetings, status, error, utils } = useLiveQuery(sealedQuery, { refreshQuery });
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || submitting) return;
    setSubmitting(true);
    try {
      const token = await getAccessToken();
      const { txid } = await postGreeting(draft, token);
      setDraft("");
      // Hold the form until our own write has synced back into the list.
      await utils.awaitTxId(txid, 10_000).catch(() => {});
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <form className="greeting-form" onSubmit={handleSubmit}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Say hello"
          aria-label="New greeting"
        />
        <button type="submit" disabled={submitting || !draft.trim()}>
          Add
        </button>
      </form>

      {status === "error" ? (
        <p role="alert">Live updates stopped: {error.message}</p>
      ) : greetings === undefined ? (
        <p>Loading…</p>
      ) : (
        <>
          {status === "stale" && <p role="status">Reconnecting…</p>}
          <ul className="greeting-list">
            {greetings.map((g) => (
              <li key={g.id}>{formatGreeting(g.message)}</li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
