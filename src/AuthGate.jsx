import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";

// Magic-link + OTP-code sign-in gate for cross-device sync. Only
// rendered when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are set
// (see main.jsx) — sync is opt-in, so an unconfigured deployment
// never shows this.
//
// The 6-digit code path exists alongside the link because iOS treats
// a Safari tab and a "Add to Home Screen" install of the same site as
// separate storage partitions: a link opened from Mail always lands
// in Safari, never inside the installed app, so it can't complete
// sign-in there. Typing the code keeps the whole flow inside whichever
// context you're already in.
export default function AuthGate({ children }) {
  const [session, setSession] = useState(undefined); // undefined = loading
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .catch(() => setSession(null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const sendCode = async (e) => {
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

  const verifyCode = async (e) => {
    e.preventDefault();
    setError(null);
    setVerifying(true);
    const { error: err } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "email",
    });
    setVerifying(false);
    if (err) setError(err.message);
    // on success, onAuthStateChange fires and session updates itself
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
        <div className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
          <div className="space-y-1 text-center">
            <h1 className="text-xl font-bold text-slate-100">Twine</h1>
            <p className="text-sm text-slate-400">
              Sign in to sync your tasks across devices.
            </p>
          </div>

          {!sent ? (
            <form onSubmit={sendCode} className="space-y-4">
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
                {sending ? "Sending…" : "Send sign-in code"}
              </button>
              {error && <p className="text-center text-xs text-rose-400">{error}</p>}
            </form>
          ) : (
            <form onSubmit={verifyCode} className="space-y-3">
              <p className="rounded-lg bg-cyan-500/10 px-3 py-2 text-center text-sm text-cyan-300">
                Sent to {email}. Click the link, or enter the 6-digit
                code from that email below.
              </p>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-center text-lg tracking-[0.3em] text-slate-100 outline-none focus:border-cyan-500"
              />
              <button
                type="submit"
                disabled={verifying || !code.trim()}
                className="w-full rounded-lg bg-cyan-500 px-3 py-2 text-sm font-semibold text-white transition disabled:opacity-40"
              >
                {verifying ? "Verifying…" : "Verify code"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSent(false);
                  setCode("");
                  setError(null);
                }}
                className="w-full text-center text-xs text-slate-500 hover:text-slate-300"
              >
                Use a different email
              </button>
              {error && <p className="text-center text-xs text-rose-400">{error}</p>}
            </form>
          )}
        </div>
      </div>
    );
  }

  return children(session);
}
