// Use origin+/api in dev (Vite proxies that to the local backend), or the
// explicit VITE_API_URL in production.
export const BASE: string =
  import.meta.env.VITE_API_URL !== undefined ? import.meta.env.VITE_API_URL : `${window.location.origin}/api`;

/** Resolves with the write's transaction id, for the live query's awaitTxId(). */
export async function postGreeting(message: string, token: string): Promise<{ txid: string }> {
  const res = await fetch(`${BASE}/greetings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) throw new Error(`POST /greetings failed: ${res.status}`);
  return (await res.json()) as { txid: string };
}
