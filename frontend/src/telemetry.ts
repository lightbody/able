// Real-user monitoring with Grafana Faro (Grafana Cloud Frontend
// Observability): page loads, Web Vitals, JS errors, console errors, and
// fetch() traces whose `traceparent` header joins each API call to the
// backend's own trace in Tempo.
//
// Off unless VITE_GRAFANA_FARO_URL is set at build time (frontend.yml passes
// deploy.env's GRAFANA_FARO_URL). The collector URL is public by design: it
// only accepts data for this one app, and it ships in the bundle. Faro is
// loaded as a separate chunk so an unconfigured build doesn't pay for it.

import { BASE } from "./api";

type Faro = typeof import("@grafana/faro-web-sdk").faro;

let faro: Faro | undefined;
let pendingUserId: string | null | undefined;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function initTelemetry(): Promise<void> {
  const url = import.meta.env.VITE_GRAFANA_FARO_URL;
  if (!url) return;

  const [sdk, { TracingInstrumentation }] = await Promise.all([
    import("@grafana/faro-web-sdk"),
    import("@grafana/faro-web-tracing"),
  ]);
  const namespace = import.meta.env.VITE_OTEL_SERVICE_NAMESPACE || "myapp";

  faro = sdk.initializeFaro({
    url,
    app: {
      name: `${namespace}-frontend`,
      namespace,
      version: import.meta.env.VITE_APP_VERSION,
      environment: import.meta.env.VITE_DEPLOY_ENVIRONMENT,
    },
    instrumentations: [
      ...sdk.getWebInstrumentations(),
      new TracingInstrumentation({
        instrumentationOptions: {
          // Cross-origin, so only calls to our own backend get a traceparent
          // header (never WorkOS or Neon). The backend's CORS reflects
          // requested headers, so the preflight allows it.
          propagateTraceHeaderCorsUrls: [new RegExp(`^${escapeRegExp(BASE)}`)],
        },
      }),
    ],
  });

  if (pendingUserId !== undefined) setTelemetryUser(pendingUserId);
}

/**
 * Tags the session with the signed-in WorkOS user id (the same `user.id` the
 * backend puts on its spans), or clears it on sign-out. Only the opaque id:
 * no email or name leaves the browser.
 */
export function setTelemetryUser(userId: string | null): void {
  if (!faro) {
    pendingUserId = userId;
    return;
  }
  if (userId) faro.api.setUser({ id: userId });
  else faro.api.resetUser();
}
