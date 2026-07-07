import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Sync is entirely optional: with no env vars set (or a malformed URL —
// createClient throws synchronously on anything that isn't a valid URL,
// e.g. a bare project ref instead of https://<ref>.supabase.co), sync
// stays off and the app runs local-only instead of crashing at boot.
let client = null;
if (url && anonKey) {
  try {
    client = createClient(url, anonKey);
  } catch (err) {
    console.error("Supabase sync disabled — invalid configuration:", err);
  }
}

export const supabase = client;
export const syncEnabled = Boolean(client);
