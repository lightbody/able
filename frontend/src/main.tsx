import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./App.css";
import { AuthGate } from "./auth"; // able:only auth
import { initTelemetry } from "./telemetry"; // able:only observability

// able:begin observability
// Not awaited: telemetry must never delay or break the first render.
void initTelemetry().catch((e) => console.warn("telemetry init failed", e));
// able:end

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthGate> {/* able:only auth */}
        <App />
      </AuthGate> {/* able:only auth */}
    </BrowserRouter>
  </React.StrictMode>,
);
