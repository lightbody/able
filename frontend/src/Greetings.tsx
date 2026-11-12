// The live list of greetings, and the form that adds one. Reads come from a
// Neon Realtime live query; the write is a plain REST call.

import { formatGreeting } from "@myapp/shared";
import type { SealedLiveQuery } from "@neon/realtime/client";
import { useLiveQuery } from "@neon/realtime-react";
import { useAuth } from "@workos-inc/authkit-react";
import { useState } from "react";
import { BASE } from "./api";
import { RealtimeGate, useSealedView } from "./realtime";

interface Greeting {
  id: string;
  message: string;
  created_by: string | null;
  created_at: Date;
}

/** Resolves with the write's transaction id, for the live query's awaitTxId(). */
async function postGreeting(message: string, token: string): Promise<{ txid: string }> {
  const res = await fetch(`${BASE}/greetings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) throw new Error(`POST /greetings failed: ${res.status}`);
  return (await res.json()) as { txid: string };
}

export function Greetings() {
  return (
    <RealtimeGate>
      <SealedGreetings />
    </RealtimeGate>
  );
}

function SealedGreetings() {
  const { sealedQuery, refreshQuery, error } = useSealedView<Greeting>("greetings");

  return sealedQuery ? (
    <GreetingList sealedQuery={sealedQuery} refreshQuery={refreshQuery} />
  ) : error ? (
    <p role="alert">Couldn't load greetings.</p>
  ) : (
    <p>Loading…</p>
  );
}

interface GreetingListProps {
  sealedQuery: SealedLiveQuery<Greeting>;
  refreshQuery: () => Promise<SealedLiveQuery<Greeting>>;
}

function GreetingList({ sealedQuery, refreshQuery }: GreetingListProps) {
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
