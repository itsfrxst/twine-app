import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Sync is entirely optional: with no env vars set, `supabase` stays null
// and the app runs exactly as it did before (local-only, no auth gate).
export const syncEnabled = Boolean(url && anonKey);
export const supabase = syncEnabled ? createClient(url, anonKey) : null;
