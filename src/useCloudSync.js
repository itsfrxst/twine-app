import { useEffect, useRef, useState } from "react";
import { supabase } from "./lib/supabaseClient";

const TABLE = "twine_backups";

// Syncs the app's backup blob (tasks/events/score/categories/theme) to a
// single row per user in Supabase, with Realtime pushing remote changes
// to every other open device. Reuses the app's existing buildBackup /
// applyBackup shape — no separate sync schema to maintain.
export function useCloudSync(userId, backup, { applyBackup, ready }) {
  const [status, setStatus] = useState("idle"); // idle | syncing | synced | error
  const hydrated = useRef(false);
  const applyingRemote = useRef(false);
  const lastSeen = useRef(null); // JSON of the last backup we pushed or received

  // initial pull-or-seed, once local state has hydrated
  useEffect(() => {
    if (!userId || !ready) return;
    let alive = true;
    (async () => {
      setStatus("syncing");
      const { data, error } = await supabase
        .from(TABLE)
        .select("data")
        .eq("user_id", userId)
        .maybeSingle();
      if (!alive) return;
      if (error) {
        setStatus("error");
        return;
      }
      if (data?.data) {
        applyingRemote.current = true;
        applyBackup(data.data);
        lastSeen.current = JSON.stringify(data.data);
        applyingRemote.current = false;
      } else {
        lastSeen.current = JSON.stringify(backup);
        await supabase
          .from(TABLE)
          .upsert({ user_id: userId, data: backup, updated_at: new Date().toISOString() });
      }
      hydrated.current = true;
      setStatus("synced");
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, ready]);

  // realtime: pull changes pushed by other devices
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`twine_backups_${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: TABLE, filter: `user_id=eq.${userId}` },
        (payload) => {
          const incoming = payload.new?.data;
          if (!incoming) return;
          const json = JSON.stringify(incoming);
          if (json === lastSeen.current) return; // echo of our own write
          applyingRemote.current = true;
          applyBackup(incoming);
          lastSeen.current = json;
          applyingRemote.current = false;
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, applyBackup]);

  // push local changes, debounced
  useEffect(() => {
    if (!userId || !hydrated.current || applyingRemote.current) return;
    const json = JSON.stringify(backup);
    if (json === lastSeen.current) return;
    const id = setTimeout(async () => {
      lastSeen.current = json;
      setStatus("syncing");
      const { error } = await supabase
        .from(TABLE)
        .upsert({ user_id: userId, data: backup, updated_at: new Date().toISOString() });
      setStatus(error ? "error" : "synced");
    }, 800);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, backup]);

  return status;
}
