import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import AuthGate from "./AuthGate.jsx";
import { syncEnabled } from "./lib/supabaseClient";

const root = createRoot(document.getElementById("root"));

// Sync is opt-in: without Supabase env vars configured, skip the auth
// gate entirely and run local-only, exactly as before.
root.render(
  <StrictMode>
    {syncEnabled ? (
      <AuthGate>{(session) => <App session={session} />}</AuthGate>
    ) : (
      <App />
    )}
  </StrictMode>
);
