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

// Each feature that wraps the whole app does it here, one line each.
let app = <App />;
app = <AuthGate>{app}</AuthGate>; // able:only auth

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>{app}</BrowserRouter>
  </React.StrictMode>,
);
