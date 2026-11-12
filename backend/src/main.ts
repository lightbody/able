// Boot sequence.
// able:begin observability
// Run with `node --import ./dist/telemetry.js` (the Dockerfile sets it in
// NODE_OPTIONS) so OpenTelemetry is set up before anything below is imported.
// able:end

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { pino } from "pino";
import { loadJwks } from "./auth.js"; // able:only auth
import type { AppContext } from "./context.js"; // able:only auth
import { initDb } from "./db.js"; // able:only postgres
import { buildApp } from "./server.js";
import { shutdownTelemetry, telemetryEnabled } from "./telemetry.js"; // able:only observability

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.join(__dirname, "..");

// JSON lines on stdout (what `fly logs` shows).
// able:begin observability
// When telemetry is enabled the pino instrumentation also ships each line to
// Grafana Loki as an OTLP log record, with the active trace and span ids
// attached.
// able:end
const log = pino({ level: process.env.LOG_LEVEL ?? "info" });

async function main(): Promise<void> {
  dotenv.config({ path: path.join(backendRoot, ".env") });
  // .env.local overrides .env -- gitignored, holds real secrets locally.
  dotenv.config({ path: path.join(backendRoot, ".env.local"), override: true });

  const port = Number(process.env.PORT ?? "8080");
  const allowedOrigin = process.env.ALLOWED_ORIGIN ?? "http://localhost:5173";

  // able:begin auth
  const jwks = await loadJwks();
  log.info({ keys: jwks.size }, "loaded WorkOS JWKS");
  // able:end

  // able:begin postgres
  const db = await initDb(path.join(backendRoot, "migrations"));
  log.info("migrations applied");
  // able:end

  // able:begin auth
  // The request context. Each feature adds its share here, one line each.
  const ctx: AppContext = {
    jwks,
    ...db, // able:only postgres
  };
  // able:end
  const app = buildApp(
    ctx, // able:only auth
    allowedOrigin,
    { logger: log },
  );

  // Dual-stack by default, required by Fly.io; overridable via HOST for
  // environments without IPv6.
  const host = process.env.HOST ?? "::";
  await app.listen({ port, host });
  log.info({ port }, "listening");
  log.info({ telemetry: telemetryEnabled }, "telemetry"); // able:only observability

  // Fly sends SIGINT when it stops a machine (including auto-stop when idle),
  // then SIGKILL after kill_timeout (5s by default). Drain in-flight
  // requests before exiting.
  let stopping = false;
  const stop = async (signal: NodeJS.Signals): Promise<void> => {
    if (stopping) return;
    stopping = true;
    log.info({ signal }, "shutting down");
    try {
      await app.close();
      await db.pool.end(); // able:only postgres
    } finally {
      // able:begin observability
      // Flush telemetry so the last spans before a stop aren't lost.
      await shutdownTelemetry();
      // able:end
      process.exit(0);
    }
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}

main().catch(async (e) => {
  log.fatal(e, "boot failed");
  await shutdownTelemetry(); // able:only observability
  process.exit(1);
});
