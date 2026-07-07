import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";

// Magic-link sign-in gate for cross-device sync. Only rendered when
// VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are set (see main.jsx) —
// sync is opt-in, so an unconfigured deployment never shows this.
export default function AuthGate({ children }) {
  const [session, setSession] = useState(undefined); // undefined = loading
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .catch(() => setSession(null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const sendLink = async (e) => {
    e.preventDefault();
    setError(null);
    setSending(true);
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.href },
    });
    setSending(false);
    if (err) setError(err.message);
    else setSent(true);
  };

  if (session === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <p className="text-sm text-slate-400">Loading…</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
        <form
          onSubmit={sendLink}
          className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl"
        >
          <div className="space-y-1 text-center">
            <h1 className="text-xl font-bold text-slate-100">Twine</h1>
            <p className="text-sm text-slate-400">
              Sign in to sync your tasks across devices.
            </p>
          </div>
          {sent ? (
            <p className="rounded-lg bg-cyan-500/10 px-3 py-2 text-center text-sm text-cyan-300">
              Check {email} for a sign-in link.
            </p>
          ) : (
            <>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
              />
              <button
                type="submit"
                disabled={sending || !email.trim()}
                className="w-full rounded-lg bg-cyan-500 px-3 py-2 text-sm font-semibold text-white transition disabled:opacity-40"
              >
                {sending ? "Sending…" : "Send magic link"}
              </button>
              {error && <p className="text-center text-xs text-rose-400">{error}</p>}
            </>
          )}
        </form>
      </div>
    );
  }

  return children(session);
}
