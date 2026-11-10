// OpenTelemetry bootstrap: traces, metrics and logs over OTLP (Grafana Cloud
// in production). Loaded *before* the app with `node --import` (see the
// Dockerfile and package.json scripts) so instrumentation can patch `http`,
// `pg` and `pino` before anything imports them. main.ts imports it again for
// shutdownTelemetry(); that's the same module instance, not a second SDK.
//
// Configured entirely by the standard OTEL_* environment variables, which
// .github/actions/deploy-backend sets on Fly:
//   OTEL_EXPORTER_OTLP_ENDPOINT  e.g. https://otlp-gateway-prod-us-east-0.grafana.net/otlp
//   OTEL_EXPORTER_OTLP_HEADERS   Authorization=Basic%20<base64 instanceId:token>  (a Fly secret)
//   OTEL_SERVICE_NAME            myapp-backend
//   OTEL_RESOURCE_ATTRIBUTES     service.namespace=<app>,deployment.environment.name=<app>[-pr<n>],service.version=<sha>
// With no endpoint set (local dev, tests, an app that hasn't set up Grafana
// yet) the SDK never starts: the @opentelemetry/api calls elsewhere in the
// code are no-ops and nothing is exported.

import { register } from "node:module";
import type { IncomingMessage } from "node:http";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-proto";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-proto";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { PgInstrumentation } from "@opentelemetry/instrumentation-pg";
import { PinoInstrumentation } from "@opentelemetry/instrumentation-pino";
import { RuntimeNodeInstrumentation } from "@opentelemetry/instrumentation-runtime-node";
import { UndiciInstrumentation } from "@opentelemetry/instrumentation-undici";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";

/** Paths that are polled by infrastructure, not used by people: no spans. */
const UNTRACED_PATHS = new Set(["/health"]);

function startTelemetry(): NodeSDK | undefined {
  if (!process.env.OTEL_EXPORTER_OTLP_ENDPOINT || process.env.OTEL_SDK_DISABLED === "true") {
    return undefined;
  }

  // The backend is ESM, so `import pg from "pg"` needs the import-in-the-middle
  // loader hook for the pg instrumentation to see it.
  register("@opentelemetry/instrumentation/hook.mjs", import.meta.url);

  const sdk = new NodeSDK({
    // Service name, version and environment come from OTEL_SERVICE_NAME and
    // OTEL_RESOURCE_ATTRIBUTES (read by the SDK's default env detector).
    traceExporter: new OTLPTraceExporter(),
    metricReaders: [
      new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter(),
        // Grafana Cloud's free tier bills on active series, not samples;
        // 60s keeps the DPM (data points per minute) at 1 per series.
        exportIntervalMillis: 60_000,
      }),
    ],
    logRecordProcessors: [new BatchLogRecordProcessor({ exporter: new OTLPLogExporter() })],
    instrumentations: [
      new HttpInstrumentation({
        // CORS preflights (one per cross-origin API call from the frontend)
        // would double the trace count while saying nothing new.
        ignoreIncomingRequestHook: (req: IncomingMessage) =>
          req.method === "OPTIONS" || UNTRACED_PATHS.has((req.url ?? "").split("?")[0]),
      }),
      // fetch() -- e.g. the WorkOS JWKS load at boot.
      new UndiciInstrumentation(),
      new PgInstrumentation({
        // Spans for queries made while serving a request only, so boot-time
        // migrations and pool housekeeping don't create orphan root traces.
        requireParentSpan: true,
        // Never record bound parameters: they're user content (greetings,
        // WorkOS user ids).
        enhancedDatabaseReporting: false,
      }),
      // Ships every Fastify/pino log line as an OTLP log record, and stamps
      // trace_id/span_id onto the stdout copy too, so `fly logs` lines can be
      // pasted into Grafana's trace search.
      new PinoInstrumentation(),
      // Event loop delay/utilization, GC, heap.
      new RuntimeNodeInstrumentation(),
    ],
  });
  sdk.start();
  return sdk;
}

const sdk = startTelemetry();

/** True when telemetry is being exported (an OTLP endpoint is configured). */
export const telemetryEnabled = sdk !== undefined;

/**
 * Flushes buffered spans, metrics and logs. Call on shutdown: Fly stops idle
 * machines (auto_stop_machines), and without a flush the last minute of
 * telemetry before each stop would be lost.
 */
export async function shutdownTelemetry(): Promise<void> {
  await sdk?.shutdown();
}
