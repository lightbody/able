import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthKitProvider } from "@workos-inc/authkit-react";
import App from "./App";
import "./App.css";

const clientId = import.meta.env.VITE_WORKOS_CLIENT_ID;
if (!clientId) {
  throw new Error("VITE_WORKOS_CLIENT_ID is not set");
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {/* WorkOS validates redirect_uri as an exact string against a fixed
        allowlist (no path wildcards), so this must stay pinned to the bare
        origin -- see authReturn.ts for how deep links still return the user
        to where they started after signing in. */}
    <AuthKitProvider clientId={clientId} redirectUri={window.location.origin} devMode={true}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AuthKitProvider>
  </React.StrictMode>,
);
