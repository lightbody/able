import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    // able:begin backend,observability
    // One copy of the OpenTelemetry API in the bundle. The backend's newer
    // @opentelemetry/api is hoisted to the root node_modules, and Faro's
    // tracing packages would otherwise mix it with their own. OTel's global
    // registry refuses a newer API reading an older one's registration, so
    // fetch() would silently stop sending `traceparent` to the backend.
    dedupe: ["@opentelemetry/api"],
    // able:end
    // able:begin backend
    alias: {
      "@myapp/shared": path.resolve(__dirname, "../shared/src/index.ts"),
    },
    // able:end
  },
  // able:begin backend
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  // able:end
});
