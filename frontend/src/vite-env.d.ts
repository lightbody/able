/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string; // able:only backend
  readonly VITE_WORKOS_CLIENT_ID?: string; // able:only auth
  // able:begin observability
  /** Grafana Faro collector URL; unset turns frontend telemetry off. */
  readonly VITE_GRAFANA_FARO_URL?: string;
  readonly VITE_OTEL_SERVICE_NAMESPACE?: string;
  /** "<APP_HANDLE>" (Production) or "<APP_HANDLE>-pr<n>", matching the backend's deployment.environment.name. */
  readonly VITE_DEPLOY_ENVIRONMENT?: string;
  /** The commit SHA, matching the backend's service.version. */
  readonly VITE_APP_VERSION?: string;
  // able:end
}
