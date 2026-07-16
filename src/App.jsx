// ─────────────────────────────────────────────────────────────
// TWINE — twin threads of time, intertwined.
// Kronos (the enemy clock) and Kairos (the reward current) woven
// into one checklist, calendar, and timeline.
// ─────────────────────────────────────────────────────────────
import {
  useState, useEffect, useRef, useCallback, useMemo, createContext, useContext,
} from "react";
import {
  Plus, X, Check, GripVertical, Trash2,
  ChevronRight, ChevronLeft, Calendar, CalendarDays, Clock,
  CornerDownRight, AlertCircle, Repeat, Pencil, Undo2, Redo2, List,
  Settings, Sun, Moon, RotateCcw, Coins, Tag, SlidersHorizontal, Activity,
  History, Swords, Sparkles, Star, Trophy, Download, Upload, Copy, Clipboard,
  Cloud, CloudOff, LogOut, ListFilter, ArrowDownAZ, Car,
} from "lucide-react";
import { supabase } from "./lib/supabaseClient";
import { useCloudSync } from "./useCloudSync";

// ─────────────────────────────────────────────────────────────
// MODULE: storage — async persistence adapter with three tiers:
//   1. window.storage — Claude artifact persistent storage. Survives
//      sessions AND code updates, so iterating on this file no longer
//      wipes data in the preview.
//   2. localStorage — for local/deployed builds (window.storage absent).
//   3. in-memory — last-resort fallback so nothing ever throws.
// Data lives under stable keys, decoupled from the code. Shape changes
// are handled by migration at load (see loadState), never key bumps.
// ─────────────────────────────────────────────────────────────
const memStore = {};
const storage = {
  async load(key, fallback) {
    // tier 1: artifact persistent storage
    try {
      if (typeof window !== "undefined" && window.storage?.get) {
        try {
          const res = await window.storage.get(key, false);
          if (res && res.value != null) return JSON.parse(res.value);
        } catch (_) {
          /* key doesn't exist yet — fall through */
        }
      }
    } catch (_) {}
    // tier 2: localStorage
    try {
      if (typeof localStorage !== "undefined") {
        const raw = localStorage.getItem(key);
        if (raw != null) return JSON.parse(raw);
      }
    } catch (_) {}
    // tier 3: memory
    return key in memStore ? memStore[key] : fallback;
  },
  async save(key, value) {
    const json = JSON.stringify(value);
    try {
      if (typeof window !== "undefined" && window.storage?.set) {
        await window.storage.set(key, json, false);
      }
    } catch (_) {}
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(key, json);
      }
    } catch (_) {}
    memStore[key] = value; // always mirror in memory
  },
  async remove(key) {
    try {
      if (typeof window !== "undefined" && window.storage?.delete) {
        await window.storage.delete(key, false);
      }
    } catch (_) {}
    try {
      if (typeof localStorage !== "undefined") localStorage.removeItem(key);
    } catch (_) {}
    delete memStore[key];
  },
};

// NOTE: keys keep the legacy "checklist." prefix on purpose — renaming
// them would orphan existing stored data. The app is Twine; the keys
// are plumbing, and data continuity wins.
const STORAGE_KEY = "checklist.tasks.v1";
const THEME_KEY = "checklist.theme.v2"; // v2: palette is now editable
const CATEGORIES_KEY = "checklist.categories.v1";
const VEHICLES_KEY = "checklist.vehicles.v1";

// ─────────────────────────────────────────────────────────────
// MODULE: theme tokens — the single source of truth for color.
// Light/dark are static token sets; the accent is injected at
// runtime as one inline CSS var (--accent) that everything derives
// from. This is what makes dark mode + accent swap trivial: no
// component knows a hex value, they all read semantic classes.
// ─────────────────────────────────────────────────────────────
// The accent palette is user-editable but capped at PALETTE_SIZE
// swatches. Frost cyan leads — Twine's home thread — the rest are
// alternates. Everything derives from a single --accent var.
const DEFAULT_PALETTE = [
  "#06b6d4", "#3b82f6", "#8b5cf6", "#10b981",
  "#f43f5e", "#f59e0b", "#6366f1",
];
const PALETTE_SIZE = DEFAULT_PALETTE.length; // hard cap on accent count
const clamp = (i, max) => Math.max(0, Math.min(max, i || 0));

const THEME_CSS = `
html, body {
  overscroll-behavior-y: none;
}
:root {
  --app-bg:#eef2f6; --surface:#f8fafc; --card:#ffffff; --card-hover:#f1f5f9;
  --border:#e2e8f0; --border-strong:#cbd5e1;
  --txt-strong:#0f172a; --txt:#1e293b; --txt-muted:#64748b;
  --txt-soft:#94a3b8; --txt-faint:#cbd5e1;
  --track:#e2e8f0; --danger:#e11d48; --danger-soft:#fff1f2; --warn:#b45309;
  --overlay:rgba(15,23,42,0.40); --toast:#0f172a;
  --accent:#06b6d4;
  --accent-strong:color-mix(in srgb, var(--accent) 82%, #000);
  --accent-soft:color-mix(in srgb, var(--accent) 13%, transparent);
}
.theme-dark {
  --app-bg:#0b1120; --surface:#0f172a; --card:#1e293b; --card-hover:#273449;
  --border:#334155; --border-strong:#475569;
  --txt-strong:#f1f5f9; --txt:#e2e8f0; --txt-muted:#94a3b8;
  --txt-soft:#64748b; --txt-faint:#475569;
  --track:#334155; --danger:#fb7185; --danger-soft:rgba(244,63,94,0.14); --warn:#fbbf24;
  --overlay:rgba(0,0,0,0.62); --toast:#020617;
  --accent-soft:color-mix(in srgb, var(--accent) 24%, transparent);
}
.app-bg{
  background:
    repeating-linear-gradient(45deg, color-mix(in srgb, var(--accent) 4%, transparent) 0 1px, transparent 1px 14px),
    repeating-linear-gradient(-45deg, color-mix(in srgb, var(--danger) 3%, transparent) 0 1px, transparent 1px 14px),
    var(--app-bg);
}
.surface{background:var(--surface)}
.card{background:var(--card)}
.bd{border-color:var(--border)}
.bd-strong{border-color:var(--border-strong)}
.track{background:var(--track)}
.txt-strong{color:var(--txt-strong)}
.txt{color:var(--txt)}
.txt-muted{color:var(--txt-muted)}
.txt-soft{color:var(--txt-soft)}
.txt-faint{color:var(--txt-faint)}
.danger{color:var(--danger)}
.danger-soft{background:var(--danger-soft)}
.warn{color:var(--warn)}
.overlay-bg{background:var(--overlay)}
.toast{background:var(--toast)}
.accent-solid{background:var(--accent);color:#fff}
.accent-solid:hover{background:var(--accent-strong)}
.accent-fg{color:var(--accent)}
.accent-bd{border-color:var(--accent)}
.accent-soft{background:var(--accent-soft);color:var(--accent)}
.accent-dot{background:var(--accent)}
.ph::placeholder{color:var(--txt-soft);opacity:1}
.hover-card:hover{background:var(--card-hover)}
.hover-surface:hover{background:var(--card-hover)}
.hover-bd-strong:hover{border-color:var(--border-strong)}
.hover-accent-bd:hover{border-color:var(--accent)}
.hover-accent:hover{color:var(--accent)}
.hover-txt:hover{color:var(--txt)}
.hover-strong:hover{color:var(--txt-strong)}
.hover-danger:hover{color:var(--danger)}
.hover-white:hover{color:#fff}
.focus-accent:focus-within{border-color:var(--accent)}
input[type=color]{-webkit-appearance:none;appearance:none;border:none;padding:0;background:transparent;cursor:pointer}
input[type=color]::-webkit-color-swatch-wrapper{padding:0}
input[type=color]::-webkit-color-swatch{border:1px solid var(--border);border-radius:9999px}
input[type=color]::-moz-color-swatch{border:1px solid var(--border);border-radius:9999px}
`;

// ─────────────────────────────────────────────────────────────
// MODULE: useTheme — owns dark mode + an editable accent palette.
// Hydrates asynchronously; also migrates the old v1 theme shape
// ({dark, accent: id}) so pre-palette prefs aren't lost.
// ─────────────────────────────────────────────────────────────
const THEME_DEFAULTS = { dark: true, accentIndex: 0, palette: [...DEFAULT_PALETTE] };
// legacy v1 accents map by hex (order-proof against palette reshuffles)
const OLD_ACCENT_HEX = {
  indigo: "#6366f1", blue: "#3b82f6", violet: "#8b5cf6", emerald: "#10b981",
  rose: "#f43f5e", amber: "#f59e0b", cyan: "#06b6d4",
};

const normalizeTheme = (loaded) => {
  if (
    loaded &&
    Array.isArray(loaded.palette) &&
    loaded.palette.length === PALETTE_SIZE
  ) {
    return {
      dark: !!loaded.dark,
      accentIndex: clamp(loaded.accentIndex, PALETTE_SIZE - 1),
      palette: loaded.palette.slice(0, PALETTE_SIZE),
    };
  }
  // v1 shape: { dark, accent: "indigo" } → migrate to palette form
  if (loaded && typeof loaded.accent === "string") {
    const hex = OLD_ACCENT_HEX[loaded.accent];
    const idx = hex ? DEFAULT_PALETTE.indexOf(hex) : -1;
    return {
      dark: !!loaded.dark,
      accentIndex: idx >= 0 ? idx : 0,
      palette: [...DEFAULT_PALETTE],
    };
  }
  return null;
};

function useTheme() {
  const [pref, setPref] = useState(THEME_DEFAULTS);
  const hydrated = useRef(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      // current key first, then the legacy v1 key for migration
      let normalized = normalizeTheme(await storage.load(THEME_KEY, null));
      if (!normalized)
        normalized = normalizeTheme(await storage.load("checklist.theme.v1", null));
      if (!alive) return;
      if (normalized) setPref(normalized);
      hydrated.current = true;
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated.current) return; // never save defaults over stored prefs
    storage.save(THEME_KEY, pref);
  }, [pref]);

  const accentValue = pref.palette[pref.accentIndex] || DEFAULT_PALETTE[0];

  return {
    dark: pref.dark,
    palette: pref.palette,
    accentIndex: pref.accentIndex,
    accentValue,
    toggleDark: () => setPref((p) => ({ ...p, dark: !p.dark })),
    setAccentIndex: (i) =>
      setPref((p) => ({ ...p, accentIndex: clamp(i, PALETTE_SIZE - 1) })),
    setAccentColor: (i, hex) =>
      setPref((p) => {
        const palette = p.palette.slice();
        palette[i] = hex;
        return { ...p, palette };
      }),
    resetPalette: () => setPref((p) => ({ ...p, palette: [...DEFAULT_PALETTE] })),
    resetAll: () => setPref({ ...THEME_DEFAULTS, palette: [...DEFAULT_PALETTE] }),
    setAll: (p) => setPref(p), // expects a normalized theme (backup restore)
  };
}

// ─────────────────────────────────────────────────────────────
// MODULE: categories — now user-managed (add/rename/recolor/delete)
// and persisted. Colors are theme-independent hex, tinted via
// color-mix at the display layer. A context exposes the live list to
// chips/pickers so call sites only need a category id.
// ─────────────────────────────────────────────────────────────
const DEFAULT_CATEGORIES = [
  { id: "work", label: "Work", color: "#6366f1" },
  { id: "personal", label: "Personal", color: "#10b981" },
  {
    id: "health",
    label: "Health",
    color: "#ef4444",
    // measurement template: a value + unit pair for tracking reps,
    // distance, calories, hours, glasses, etc. in checklist fashion.
    template: {
      currency: false,
      currencyCode: "USD",
      measure: true,
      measureUnit: "",
      tags: ["Exercise", "Nutrition", "Sleep", "Hydration", "Mindfulness"],
    },
  },
  { id: "learning", label: "Learning", color: "#f59e0b" },
  {
    id: "home",
    label: "Home",
    color: "#8b5cf6",
    template: {
      currency: false,
      currencyCode: "USD",
      tags: ["Bedroom", "Kitchen", "Bathroom", "Living Room", "Garage", "Yard"],
    },
  },
  {
    id: "finances",
    label: "Finances",
    color: "#16a34a",
    // A category template adds extra fields to the composer when this
    // category is selected. Editable per-category in Settings.
    template: {
      currency: true,
      currencyCode: "USD",
      tags: ["Income", "Expense", "Bill", "Subscription", "Investment"],
    },
  },
  {
    id: "auto",
    label: "Auto",
    color: "#f97316",
    // vehicle: true swaps in a picker over the saved Vehicles list (see
    // the vehicles module below) instead of retyping make/model each
    // time. measure doubles as an odometer reading at time of service.
    template: {
      vehicle: true,
      measure: true,
      measureUnit: "mi",
      tags: ["Maintenance", "Repair", "Registration", "Fuel", "Insurance"],
    },
  },
  {
    id: "projects",
    label: "Projects",
    color: "#0ea5e9",
    // No special template — Projects' distinguishing feature is that
    // its tasks tend to lean on deeply nested subtask outlines, which
    // every task can do (see the recursive subtask tree below).
    template: {
      currency: false,
      currencyCode: "USD",
      tags: ["Planning", "In Progress", "Blocked", "Review"],
    },
  },
];
// suggested colors cycled through when adding a new category
const CATEGORY_SWATCHES = [
  "#6366f1", "#10b981", "#ef4444", "#f59e0b", "#8b5cf6",
  "#06b6d4", "#ec4899", "#14b8a6", "#f97316", "#84cc16",
];

const CategoriesContext = createContext([]);
const useCategoryList = () => useContext(CategoriesContext);

function useCategories() {
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const hydrated = useRef(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const loaded = await storage.load(CATEGORIES_KEY, null);
      if (!alive) return;
      if (Array.isArray(loaded)) setCategories(loaded);
      hydrated.current = true;
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated.current) return; // never save defaults over stored data
    storage.save(CATEGORIES_KEY, categories);
  }, [categories]);

  const add = () =>
    setCategories((cs) => [
      ...cs,
      {
        id: crypto.randomUUID(),
        label: "New category",
        color: CATEGORY_SWATCHES[cs.length % CATEGORY_SWATCHES.length],
      },
    ]);
  const update = (id, patch) =>
    setCategories((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const remove = (id) =>
    setCategories((cs) => cs.filter((c) => c.id !== id));

  // ── template tag management (scoped to one category) ──
  const emptyTemplate = () => ({ currency: false, currencyCode: "USD", tags: [] });

  // replace a category's whole tag list (used for rename/delete in settings)
  const setCategoryTags = (categoryId, tags) =>
    setCategories((cs) =>
      cs.map((c) => {
        if (c.id !== categoryId) return c;
        const tmpl = c.template || emptyTemplate();
        return { ...c, template: { ...tmpl, tags } };
      })
    );

  // append a tag to a category's template, creating the template if
  // needed. Used when a tag is created while composing a task, so it
  // is kept on that category for next time. No-op on duplicates.
  const addCategoryTag = (categoryId, tag) => {
    const v = (tag || "").trim();
    if (!v) return;
    setCategories((cs) =>
      cs.map((c) => {
        if (c.id !== categoryId) return c;
        const tmpl = c.template || emptyTemplate();
        if ((tmpl.tags || []).includes(v)) return c;
        return { ...c, template: { ...tmpl, tags: [...(tmpl.tags || []), v] } };
      })
    );
  };

  return {
    categories, add, update, remove, setCategoryTags, addCategoryTag,
    resetAll: () => setCategories([...DEFAULT_CATEGORIES]),
    setAll: (list) => setCategories(list), // backup restore
  };
}

// ─────────────────────────────────────────────────────────────
// MODULE: vehicles — a reusable "garage" for the Auto category's
// vehicle template field, so make/model/etc. get entered once and
// picked thereafter instead of retyped per task. Persisted the same
// way as categories; a context exposes the live list to the picker
// and chip so call sites only need a vehicle id.
// ─────────────────────────────────────────────────────────────
const VehiclesContext = createContext([]);
const useVehicleList = () => useContext(VehiclesContext);

const vehicleLabel = (v) => {
  if (!v) return "";
  if (v.label) return v.label;
  return [v.year, v.make, v.model].filter(Boolean).join(" ") || "Vehicle";
};

function useVehicles() {
  const [vehicles, setVehicles] = useState([]);
  const hydrated = useRef(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const loaded = await storage.load(VEHICLES_KEY, null);
      if (!alive) return;
      if (Array.isArray(loaded)) setVehicles(loaded);
      hydrated.current = true;
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    storage.save(VEHICLES_KEY, vehicles);
  }, [vehicles]);

  // returns the created vehicle (with its id) synchronously, so a
  // caller (the composer's picker) can select it immediately without
  // waiting on the state update to commit.
  const add = (draft) => {
    const v = { id: crypto.randomUUID(), make: "", model: "", year: "", label: "", plate: "", ...draft };
    setVehicles((vs) => [...vs, v]);
    return v;
  };
  const update = (id, patch) =>
    setVehicles((vs) => vs.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  const remove = (id) => setVehicles((vs) => vs.filter((v) => v.id !== id));

  return {
    vehicles, add, update, remove,
    resetAll: () => setVehicles([]),
    setAll: (list) => setVehicles(list), // backup restore
  };
}

// ─────────────────────────────────────────────────────────────
// MODULE: date helpers — scheduling + recurrence math in one place.
// ─────────────────────────────────────────────────────────────
const fmtDate = (iso) => {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tmrw = new Date(today);
  tmrw.setDate(tmrw.getDate() + 1);
  if (d.getTime() === today.getTime()) return "Today";
  if (d.getTime() === tmrw.getTime()) return "Tomorrow";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const fmtTime = (t) => {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2, "0")} ${ampm}`;
};

const isOverdue = (date, time) => {
  if (!date) return false;
  const due = new Date(date + "T" + (time || "23:59"));
  return due < new Date();
};

// format a numeric amount as currency; falls back gracefully if the
// currency code isn't a valid ISO 4217 code (user-typed).
const formatMoney = (amount, code) => {
  if (amount === "" || amount == null) return null;
  const n = typeof amount === "number" ? amount : parseFloat(amount);
  if (isNaN(n)) return null;
  const cc = (code || "USD").toUpperCase();
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: cc,
    }).format(n);
  } catch (_) {
    return `${cc} ${n.toFixed(2)}`;
  }
};

const advanceDate = (iso, repeat) => {
  if (!iso || repeat === "none") return iso;
  const d = new Date(iso + "T00:00:00");
  if (repeat === "daily") d.setDate(d.getDate() + 1);
  if (repeat === "weekly") d.setDate(d.getDate() + 7);
  if (repeat === "monthly") d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
};

const REPEAT_OPTIONS = [
  { value: "none", label: "Does not repeat" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];
const repeatLabel = (v) =>
  ({ daily: "Daily", weekly: "Weekly", monthly: "Monthly" }[v] || null);

// ── calendar helpers ──
const toISO = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const todayISO = () => toISO(new Date());
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const buildMonthGrid = (cursor) => {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push(d);
  }
  return cells;
};

// ── timestamp helpers (mm/dd/yyyy) for created/completed times ──
const fmtStamp = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}/${d.getFullYear()}`;
};
const fmtStampTime = (iso) => {
  const date = fmtStamp(iso);
  if (!date) return null;
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${date} ${h}:${String(m).padStart(2, "0")} ${ampm}`;
};
const nowISO = () => new Date().toISOString();

// copy text to the clipboard, cascading from the modern API to the
// legacy execCommand path (which works in more sandboxed iframes).
const copyText = async (text) => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (_) {}
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch (_) {
    return false;
  }
};

// ─────────────────────────────────────────────────────────────
// MODULE: Kronos/Kairos scoring — structured time as an enemy that
// strikes when cycles lapse; passion time as a reward engine.
// ─────────────────────────────────────────────────────────────
const SCORING = {
  kairosBase: 10,   // completing a Kairos task
  perMark: 5,       // bonus per special mark (star), 0–3
  onTime: 5,        // beat the scheduled deadline
  kronosPenalty: 10 // per missed Kronos cycle
};
const MAX_MARKS = 3;

const deadlineOf = (task) =>
  task.date ? new Date(task.date + "T" + (task.time || "23:59")) : null;

// points awarded when a Kairos task is completed at time `now`
const kairosPoints = (task, now) => {
  if (task.side !== "kairos") return 0;
  let pts = SCORING.kairosBase + (task.marks || 0) * SCORING.perMark;
  const dl = deadlineOf(task);
  if (dl && now <= dl) pts += SCORING.onTime;
  return pts;
};

// ── List-view sort helpers ──
// A task's potential point value, for sorting (not the same as
// kairosPoints: no "on time" bonus, since that's only knowable once
// a task is actually completed). Kronos tasks carry the penalty
// they're at risk of as a negative value.
const taskPointValue = (task) => {
  if (task.side === "kairos") return SCORING.kairosBase + (task.marks || 0) * SCORING.perMark;
  if (task.side === "kronos") return -SCORING.kronosPenalty;
  return 0;
};
// the template-driven numeric field on a task — currency amount or
// measurement value, whichever the task's category template uses
const taskValueNumber = (task) => {
  const raw = task.amount !== "" && task.amount != null ? task.amount : task.measureValue;
  const n = parseFloat(raw);
  return isNaN(n) ? null : n;
};
const taskDeadlineMs = (task) =>
  task.date ? new Date(task.date + "T" + (task.time || "23:59")).getTime() : null;

// an event captures a snapshot at the moment it happened.
// type: "complete" (default, incl. legacy events) | "penalty"
const makeEvent = (task, ts, extra = {}) => ({
  id: crypto.randomUUID(),
  taskId: task.id,
  ts,
  type: "complete",
  points: 0,
  side: task.side || "",
  text: task.text,
  category: task.category || "",
  vehicleId: task.vehicleId || "",
  amount: task.amount || "",
  measureValue: task.measureValue || "",
  measureUnit: task.measureUnit || "",
  tags: Array.isArray(task.tags) ? [...task.tags] : [],
  ...extra,
});

const makePenaltyEvent = (task, ts) =>
  makeEvent(task, ts, { type: "penalty", points: -SCORING.kronosPenalty });

// ── the Kronos sweep ──
// Pure function: applies every lapsed, uncompleted Kronos cycle up to
// `now`. Recurring tasks penalize per missed occurrence and roll
// forward; non-recurring ones strike at the deadline, then daily while
// overdue (tracked via penalizedThrough so re-sweeps are idempotent).
const DAY_MS = 86400000;
const sweepKronos = (state, now = new Date()) => {
  let changed = false;
  let score = state.score;
  let events = state.events;

  const tasks = state.tasks.map((t) => {
    if (t.side !== "kronos" || t.done || !t.date) return t;

    if (t.repeat !== "none") {
      let date = t.date;
      let subtasks = t.subtasks;
      let dl = deadlineOf({ ...t, date });
      let dirty = false;
      let guard = 0;
      while (dl && dl < now && guard < 400) {
        score -= SCORING.kronosPenalty;
        events = [...events, makePenaltyEvent(t, dl.toISOString())];
        date = advanceDate(date, t.repeat);
        subtasks = subtasks.map((s) => ({ ...s, done: false }));
        dl = deadlineOf({ ...t, date });
        dirty = true;
        guard++;
      }
      if (!dirty) return t;
      changed = true;
      return { ...t, date, subtasks };
    }

    // non-recurring: first strike when the deadline lapses, then one
    // per full day overdue. penalizedThrough marks how far we've charged.
    const dl = deadlineOf(t);
    if (!dl || now <= dl) return t;
    let through = t.penalizedThrough ? new Date(t.penalizedThrough) : null;
    let dirty = false;
    let guard = 0;
    if (!through) {
      score -= SCORING.kronosPenalty;
      events = [...events, makePenaltyEvent(t, dl.toISOString())];
      through = dl;
      dirty = true;
    }
    while (through.getTime() + DAY_MS < now.getTime() && guard < 400) {
      through = new Date(through.getTime() + DAY_MS);
      score -= SCORING.kronosPenalty;
      events = [...events, makePenaltyEvent(t, through.toISOString())];
      dirty = true;
      guard++;
    }
    if (!dirty) return t;
    changed = true;
    return { ...t, penalizedThrough: through.toISOString() };
  });

  return changed ? { ...state, tasks, events, score } : state;
};

// ── recursive subtask tree helpers ──
// Subtasks nest arbitrarily deep (each node may itself carry a
// `subtasks` array), rendered as a collapsible outline — see
// SubtaskNode. ids are UUIDs and unique across the whole tree, so
// every operation below just needs a target id, not a full path.
const mapSubtaskTree = (nodes, id, fn) =>
  nodes.map((n) =>
    n.id === id ? fn(n) : { ...n, subtasks: mapSubtaskTree(n.subtasks, id, fn) }
  );
const removeFromSubtaskTree = (nodes, id) =>
  nodes
    .filter((n) => n.id !== id)
    .map((n) => ({ ...n, subtasks: removeFromSubtaskTree(n.subtasks, id) }));
// parentId === null adds at the task's top level
const addChildToSubtaskTree = (nodes, parentId, child) => {
  if (parentId === null) return [...nodes, child];
  return nodes.map((n) =>
    n.id === parentId
      ? { ...n, subtasks: [...n.subtasks, child] }
      : { ...n, subtasks: addChildToSubtaskTree(n.subtasks, parentId, child) }
  );
};
const flattenSubtasks = (nodes) => nodes.flatMap((n) => [n, ...flattenSubtasks(n.subtasks)]);
const normalizeSubtask = (s) => ({
  id: s.id || crypto.randomUUID(),
  text: s.text || "",
  done: !!s.done,
  subtasks: Array.isArray(s.subtasks) ? s.subtasks.map(normalizeSubtask) : [],
});

// The persisted state is { tasks, events, score }. Older shapes (bare
// array; {tasks,events} without score; tasks without side/marks) are
// migrated transparently so updates never reset personalization.
// normalizeState is shared by hydration AND backup import.
const normalizeTask = (t) => ({
  side: "",
  marks: 0,
  penalizedThrough: null,
  vehicleId: "",
  ...t,
  subtasks: Array.isArray(t.subtasks) ? t.subtasks.map(normalizeSubtask) : [],
});
const normalizeEvent = (e) => ({ type: "complete", points: 0, side: "", vehicleId: "", ...e });

const emptyState = () => ({ tasks: [], events: [], score: 0 });

const normalizeState = (raw) => {
  if (Array.isArray(raw))
    return { tasks: raw.map(normalizeTask), events: [], score: 0 };
  if (raw && Array.isArray(raw.tasks))
    return {
      tasks: raw.tasks.map(normalizeTask),
      events: (Array.isArray(raw.events) ? raw.events : []).map(normalizeEvent),
      score: typeof raw.score === "number" ? raw.score : 0,
    };
  return null; // unrecognized shape
};

// fresh installs start empty — the app is yours to populate.
const loadState = async () =>
  normalizeState(await storage.load(STORAGE_KEY, null)) ?? emptyState();

// ─────────────────────────────────────────────────────────────
// MODULE: useHistory — generic past/present/future container.
// ─────────────────────────────────────────────────────────────
function useHistory(initial) {
  const [state, setState] = useState(() => ({
    past: [],
    present: typeof initial === "function" ? initial() : initial,
    future: [],
  }));

  const commit = useCallback((updater, label) => {
    setState((h) => {
      const next =
        typeof updater === "function" ? updater(h.present) : updater;
      if (next === h.present) return h;
      return {
        past: [...h.past.slice(-49), { present: h.present, label }],
        present: next,
        future: [],
      };
    });
  }, []);

  const set = useCallback((present) => {
    setState((h) => ({ ...h, present }));
  }, []);

  // reset: replace present AND clear history (used for hydration and
  // the "reset app data" action).
  const reset = useCallback((present) => {
    setState({ past: [], present, future: [] });
  }, []);

  const undo = useCallback(() => {
    setState((h) => {
      if (h.past.length === 0) return h;
      const previous = h.past[h.past.length - 1];
      return {
        past: h.past.slice(0, -1),
        present: previous.present,
        future: [{ present: h.present, label: previous.label }, ...h.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setState((h) => {
      if (h.future.length === 0) return h;
      const nextEntry = h.future[0];
      return {
        past: [...h.past, { present: h.present, label: nextEntry.label }],
        present: nextEntry.present,
        future: h.future.slice(1),
      };
    });
  }, []);

  return {
    present: state.present,
    commit, set, reset, undo, redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    undoLabel: state.past.length ? state.past[state.past.length - 1].label : null,
    redoLabel: state.future.length ? state.future[0].label : null,
    depth: state.past.length,
  };
}

// ─────────────────────────────────────────────────────────────
// MODULE: useTasks — task operations on top of useHistory.
// ─────────────────────────────────────────────────────────────
function buildTask(draft) {
  return {
    id: crypto.randomUUID(),
    text: draft.text.trim(),
    done: false,
    date: draft.date || "",
    time: draft.time || "",
    repeat: draft.repeat || "none",
    category: draft.category || "",
    vehicleId: draft.vehicleId || "",
    amount: (draft.amount ?? "").toString().trim(),
    measureValue: (draft.measureValue ?? "").toString().trim(),
    measureUnit: (draft.measureUnit ?? "").toString().trim(),
    tags: Array.isArray(draft.tags) ? draft.tags.filter(Boolean) : [],
    side: draft.side || "",
    marks: clamp(draft.marks, MAX_MARKS),
    penalizedThrough: null,
    createdAt: nowISO(),   // timestamp: added to the list
    completedAt: null,     // timestamp: when completed (null until done)
    // depth-1 at creation time; nesting grows later via row-level
    // "add sub-item" actions (see addSubChild)
    subtasks: (draft.subtasks || [])
      .filter((s) => s.text.trim())
      .map((s) => ({ id: crypto.randomUUID(), text: s.text.trim(), done: false, subtasks: [] })),
  };
}

function useTasks() {
  // state is { tasks, events }: the events log is a first-class,
  // undoable, persisted record of completions powering the timeline.
  // Storage is async now, so we start empty and hydrate on mount.
  const h = useHistory({ tasks: [], events: [] });
  const [ready, setReady] = useState(false);
  const tasks = h.present.tasks;
  const events = h.present.events;

  // hydrate once from storage; reset() installs it without a history entry
  useEffect(() => {
    let alive = true;
    (async () => {
      const s = await loadState();
      if (!alive) return;
      h.reset(s);
      setReady(true);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // persist (debounced) — but never before hydration, and skip the
  // save that hydration itself triggers (it would re-write what we
  // just loaded).
  const skipNextSave = useRef(true);
  useEffect(() => {
    if (!ready) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    const id = setTimeout(() => storage.save(STORAGE_KEY, h.present), 400);
    return () => clearTimeout(id);
  }, [h.present, ready]);

  // best-effort flush on tab close (sync tiers land; artifact tier
  // may not complete — the 400ms debounce keeps the exposure tiny)
  useEffect(() => {
    if (!ready) return;
    const flush = () => {
      storage.save(STORAGE_KEY, h.present);
    };
    window.addEventListener?.("beforeunload", flush);
    return () => window.removeEventListener?.("beforeunload", flush);
  }, [h.present, ready]);

  // replace everything (reset-app-data path): clears history too
  const resetTo = (state) => {
    skipNextSave.current = false;
    h.reset(state);
  };

  // ── the Kronos sweep ──
  // Runs after hydration and every 60s. Applied via h.set (NOT commit)
  // because strikes are system events: undo should never pop a penalty
  // instead of the user's own last action. Changes still persist via
  // the save effect above.
  useEffect(() => {
    if (!ready) return;
    const run = () => {
      const swept = sweepKronos(h.present, new Date());
      if (swept !== h.present) h.set(swept);
    };
    run();
    const id = setInterval(run, 60000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, h.present]);

  // most operations only touch the task list, not the event log
  const commitTasks = (fn, label) =>
    h.commit((s) => ({ ...s, tasks: fn(s.tasks) }), label);

  const add = (draft) =>
    commitTasks((t) => [...t, buildTask(draft)], "Task added");

  const replace = (id, draft) =>
    commitTasks(
      (t) =>
        t.map((x) =>
          x.id === id
            ? {
                ...x,
                text: draft.text.trim(),
                date: draft.date || "",
                time: draft.time || "",
                repeat: draft.repeat || "none",
                category: draft.category || "",
                vehicleId: draft.vehicleId || "",
                amount: (draft.amount ?? "").toString().trim(),
                measureValue: (draft.measureValue ?? "").toString().trim(),
                measureUnit: (draft.measureUnit ?? "").toString().trim(),
                tags: Array.isArray(draft.tags) ? draft.tags.filter(Boolean) : [],
                side: draft.side || "",
                marks: clamp(draft.marks, MAX_MARKS),
                // schedule or side changed → the enemy's clock restarts
                penalizedThrough:
                  x.date !== (draft.date || "") ||
                  x.time !== (draft.time || "") ||
                  x.side !== (draft.side || "")
                    ? null
                    : x.penalizedThrough || null,
                // preserve each item's nested subtasks — the composer
                // only edits top-level text/done, never the outline
                // built up via row-level "add sub-item" actions
                subtasks: (draft.subtasks || [])
                  .filter((s) => s.text.trim())
                  .map((s) => ({
                    id: s.id || crypto.randomUUID(),
                    text: s.text.trim(),
                    done: s.done || false,
                    subtasks: Array.isArray(s.subtasks) ? s.subtasks : [],
                  })),
              }
            : x
        ),
      "Task edited"
    );

  // toggling completion writes to the event log and the score:
  // Kairos completions award base + marks + on-time points; recurring
  // roll-forwards award per occurrence; un-completing removes the
  // task's most recent event and reverses its exact points.
  const toggle = (id) =>
    h.commit((s) => {
      const nowStr = nowISO();
      const nowD = new Date(nowStr);
      let events = s.events;
      let score = s.score;
      const tasks = s.tasks.map((x) => {
        if (x.id !== id) return x;
        // recurring with a date: roll forward + log a completion
        if (!x.done && x.repeat !== "none" && x.date) {
          const pts = kairosPoints(x, nowD);
          score += pts;
          events = [...events, makeEvent(x, nowStr, { points: pts })];
          return {
            ...x,
            date: advanceDate(x.date, x.repeat),
            subtasks: x.subtasks.map((st) => ({ ...st, done: false })),
          };
        }
        if (!x.done) {
          const pts = kairosPoints(x, nowD);
          score += pts;
          const done = { ...x, done: true, completedAt: nowStr };
          events = [...events, makeEvent(done, nowStr, { points: pts })];
          return done;
        }
        // un-completing: drop this task's most recent event + its points
        const idx = events.map((e) => e.taskId).lastIndexOf(id);
        if (idx !== -1) {
          score -= events[idx].points || 0;
          events = events.filter((_, i) => i !== idx);
        }
        return { ...x, done: false, completedAt: null };
      });
      return { ...s, tasks, events, score };
    }, "Task toggled");

  const remove = (id) =>
    commitTasks((t) => t.filter((x) => x.id !== id), "Task deleted");

  const reorder = (from, to) =>
    commitTasks((t) => {
      const next = [...t];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    }, "Task reordered");

  const clearDone = () =>
    commitTasks((t) => t.filter((x) => !x.done), "Completed cleared");

  // subId may be nested at any depth — mapSubtaskTree searches the
  // whole outline under this task, so callers never need a full path
  const toggleSub = (taskId, subId) =>
    commitTasks(
      (t) =>
        t.map((x) =>
          x.id === taskId
            ? { ...x, subtasks: mapSubtaskTree(x.subtasks, subId, (n) => ({ ...n, done: !n.done })) }
            : x
        ),
      "Subtask toggled"
    );

  // parentSubId === null adds at the task's top level; otherwise
  // nests under that specific (possibly deeply nested) subtask
  const addSubChild = (taskId, parentSubId, text) => {
    const v = (text || "").trim();
    if (!v) return;
    const child = { id: crypto.randomUUID(), text: v, done: false, subtasks: [] };
    commitTasks(
      (t) =>
        t.map((x) =>
          x.id === taskId
            ? { ...x, subtasks: addChildToSubtaskTree(x.subtasks, parentSubId, child) }
            : x
        ),
      "Sub-item added"
    );
  };

  const removeSub = (taskId, subId) =>
    commitTasks(
      (t) =>
        t.map((x) =>
          x.id === taskId
            ? { ...x, subtasks: removeFromSubtaskTree(x.subtasks, subId) }
            : x
        ),
      "Sub-item removed"
    );

  return {
    tasks, events, ready, resetTo,
    score: h.present.score,
    add, replace, toggle, remove, reorder, clearDone, toggleSub, addSubChild, removeSub,
    undo: h.undo, redo: h.redo,
    canUndo: h.canUndo, canRedo: h.canRedo,
    undoLabel: h.undoLabel, redoLabel: h.redoLabel,
    depth: h.depth,
  };
}

// ─────────────────────────────────────────────────────────────
// MODULE: Checkbox — shared atom (accent-driven).
// ─────────────────────────────────────────────────────────────
function Checkbox({ done, onClick, size = 5 }) {
  const px = size * 4;
  return (
    <button
      onClick={onClick}
      aria-label={done ? "Mark incomplete" : "Mark complete"}
      style={{ width: px, height: px }}
      className={`flex shrink-0 items-center justify-center rounded-md border-2 transition ${
        done ? "accent-solid accent-bd" : "bd-strong hover-accent-bd"
      }`}
    >
      {done && <Check size={size === 5 ? 13 : 11} strokeWidth={3} />}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// MODULE: CategoryChip — colored tag shown on rows + agenda.
// ─────────────────────────────────────────────────────────────
function CategoryChip({ id }) {
  const categories = useCategoryList();
  const c = categories.find((x) => x.id === id);
  if (!c) return null;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium"
      style={{
        background: `color-mix(in srgb, ${c.color} 16%, transparent)`,
        color: c.color,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.color }} />
      {c.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// MODULE: VehicleChip — shown on rows when a task has a vehicle set.
// ─────────────────────────────────────────────────────────────
function VehicleChip({ id }) {
  const vehicles = useVehicleList();
  const v = vehicles.find((x) => x.id === id);
  if (!v) return null;
  return (
    <span className="surface txt inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold">
      <Car size={10} />
      {vehicleLabel(v)}
      {v.plate ? ` · ${v.plate}` : ""}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// MODULE: CategoryPicker — selectable chips inside the composer.
// ─────────────────────────────────────────────────────────────
function CategoryPicker({ value, onChange }) {
  const categories = useCategoryList();
  if (categories.length === 0)
    return (
      <p className="txt-soft text-[11px]">
        No categories yet — add some in settings.
      </p>
    );
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {categories.map((c) => {
        const active = value === c.id;
        return (
          <button
            key={c.id}
            onClick={() => onChange(active ? "" : c.id)}
            className="flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-medium transition"
            style={
              active
                ? { background: c.color, color: "#fff", borderColor: c.color }
                : undefined
            }
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: active ? "#fff" : c.color }}
            />
            <span className={active ? "" : "txt-muted"}>{c.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MODULE: MoneyBadge — currency chip. Resolves the currency code
// from the task's category template (reflects settings live).
// ─────────────────────────────────────────────────────────────
function MoneyBadge({ amount, categoryId }) {
  const categories = useCategoryList();
  const cat = categories.find((c) => c.id === categoryId);
  const code = cat?.template?.currencyCode || "USD";
  const text = formatMoney(amount, code);
  if (!text) return null;
  return (
    <span className="surface txt inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold">
      <Coins size={10} />
      {text}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// MODULE: MeasureBadge — value+unit chip for health/fitness/habit
// tracking. Falls back to the category template's default unit when
// the task didn't specify one.
// ─────────────────────────────────────────────────────────────
function MeasureBadge({ value, unit, categoryId }) {
  const categories = useCategoryList();
  if (value == null || value === "") return null;
  const cat = categories.find((c) => c.id === categoryId);
  const u = (unit && unit.trim()) || cat?.template?.measureUnit || "";
  return (
    <span className="surface txt inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold">
      <Activity size={10} />
      {value}
      {u ? ` ${u}` : ""}
    </span>
  );
}


// ─────────────────────────────────────────────────────────────
// MODULE: SideBadge — Kronos (enemy) / Kairos (reward) chip, with
// the task's special marks shown as stars on the Kairos side.
// ─────────────────────────────────────────────────────────────
function SideBadge({ side, marks }) {
  if (side === "kronos")
    return (
      <span className="danger-soft danger inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold">
        <Swords size={10} />
        Kronos
      </span>
    );
  if (side === "kairos")
    return (
      <span className="accent-soft inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold">
        <Sparkles size={10} />
        Kairos
        {marks > 0 && (
          <span className="inline-flex items-center">
            {Array.from({ length: marks }).map((_, i) => (
              <Star key={i} size={9} fill="currentColor" strokeWidth={0} />
            ))}
          </span>
        )}
      </span>
    );
  return null;
}

// ─────────────────────────────────────────────────────────────
// MODULE: ScoreBadge — running Kronos/Kairos score in the header.
// ─────────────────────────────────────────────────────────────
function ScoreBadge({ score }) {
  const negative = score < 0;
  return (
    <span
      className={`card bd inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold ${
        negative ? "danger" : "accent-fg"
      }`}
      title="Kronos/Kairos score"
    >
      <Trophy size={13} />
      {score > 0 ? `+${score}` : score}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// MODULE: SyncBadge — cloud sync status, shown only when signed in.
// ─────────────────────────────────────────────────────────────
function SyncBadge({ status, onSignOut }) {
  const label = { syncing: "Syncing…", synced: "Synced", error: "Sync error" }[status] || "Sync";
  const Icon = status === "error" ? CloudOff : Cloud;
  return (
    <button
      onClick={onSignOut}
      title={`${label} — click to sign out`}
      className={`card bd inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition hover-strong ${
        status === "error" ? "danger" : "txt-muted"
      }`}
    >
      <Icon size={13} className={status === "syncing" ? "animate-pulse" : ""} />
      <LogOut size={11} className="opacity-50" />
    </button>
  );
}

function TagChips({ tags }) {
  const clean = (tags || []).filter((t) => t && t.trim());
  if (clean.length === 0) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {clean.map((t) => (
        <span
          key={t}
          className="accent-soft inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium"
        >
          #{t}
        </span>
      ))}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// MODULE: VehicleField — picker over the saved Vehicles "garage"
// (Auto category template), with an inline "add new vehicle" form so
// make/model/etc. get entered once and reused thereafter.
// ─────────────────────────────────────────────────────────────
function VehicleField({ vehicleId, onVehicleId, onAddVehicle }) {
  const vehicles = useVehicleList();
  const [adding, setAdding] = useState(false);
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [label, setLabel] = useState("");
  const [plate, setPlate] = useState("");

  const saveNew = () => {
    if (!make.trim() && !model.trim() && !label.trim()) return;
    const v = onAddVehicle({
      make: make.trim(), model: model.trim(), year: year.trim(),
      label: label.trim(), plate: plate.trim(),
    });
    onVehicleId(v.id);
    setAdding(false);
    setMake(""); setModel(""); setYear(""); setLabel(""); setPlate("");
  };

  return (
    <div className="space-y-1.5">
      <label className="bd focus-accent flex items-center gap-2 rounded-lg border px-2 py-1.5">
        <Car size={13} className="txt-soft shrink-0" />
        <select
          value={adding ? "__new__" : vehicleId || ""}
          onChange={(e) => {
            if (e.target.value === "__new__") {
              setAdding(true);
              return;
            }
            setAdding(false);
            onVehicleId(e.target.value);
          }}
          className="txt w-full bg-transparent text-sm outline-none"
        >
          <option value="">No vehicle</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {vehicleLabel(v)}
            </option>
          ))}
          <option value="__new__">+ Add new vehicle…</option>
        </select>
      </label>

      {adding && (
        <div className="bd surface space-y-2 rounded-lg border p-2">
          <div className="grid grid-cols-2 gap-2">
            <input
              value={make}
              onChange={(e) => setMake(e.target.value)}
              placeholder="Make"
              className="ph bd txt focus-accent rounded-lg border bg-transparent px-2 py-1.5 text-xs outline-none"
            />
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Model"
              className="ph bd txt focus-accent rounded-lg border bg-transparent px-2 py-1.5 text-xs outline-none"
            />
            <input
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="Year"
              className="ph bd txt focus-accent rounded-lg border bg-transparent px-2 py-1.5 text-xs outline-none"
            />
            <input
              value={plate}
              onChange={(e) => setPlate(e.target.value)}
              placeholder="Plate"
              className="ph bd txt focus-accent rounded-lg border bg-transparent px-2 py-1.5 text-xs outline-none"
            />
          </div>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Nickname (optional)"
            className="ph bd txt focus-accent w-full rounded-lg border bg-transparent px-2 py-1.5 text-xs outline-none"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="txt-muted hover-strong rounded-lg px-2 py-1 text-[11px] font-medium transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveNew}
              className="accent-solid rounded-lg px-2 py-1 text-[11px] font-semibold"
            >
              Save vehicle
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MODULE: TemplateFields — extra composer inputs contributed by a
// category's template (currency amount, measurement, vehicle picker,
// customizable tags). Only rendered when the selected category has a
// template.
// ─────────────────────────────────────────────────────────────
function TemplateFields({
  template, amount, measureValue, measureUnit, tags, vehicleId,
  onAmount, onMeasureValue, onMeasureUnit, onToggleTag, onAddTag, onRemoveTag,
  onVehicleId, onAddVehicle,
}) {
  const [tagText, setTagText] = useState("");
  const presets = (template.tags || []).filter((t) => t && t.trim());
  const custom = tags.filter((t) => t && t.trim() && !presets.includes(t));
  const showTags = Array.isArray(template.tags);

  return (
    <div className="bd space-y-2.5 border-t pt-2">
      <span className="txt-muted text-[11px] font-semibold uppercase tracking-wide">
        Details
      </span>

      {template.vehicle && (
        <VehicleField vehicleId={vehicleId} onVehicleId={onVehicleId} onAddVehicle={onAddVehicle} />
      )}

      {template.currency && (
        <label className="bd focus-accent flex items-center gap-2 rounded-lg border px-2 py-1.5">
          <Coins size={13} className="txt-soft shrink-0" />
          <span className="txt-muted text-xs font-medium">
            {(template.currencyCode || "USD").toUpperCase()}
          </span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={amount}
            onChange={(e) => onAmount(e.target.value)}
            placeholder="0.00"
            className="ph txt w-full bg-transparent text-sm outline-none"
          />
        </label>
      )}

      {template.measure && (
        <div className="flex gap-2">
          <label className="bd focus-accent flex flex-1 items-center gap-2 rounded-lg border px-2 py-1.5">
            <Activity size={13} className="txt-soft shrink-0" />
            <input
              type="number"
              inputMode="decimal"
              value={measureValue}
              onChange={(e) => onMeasureValue(e.target.value)}
              placeholder="0"
              className="ph txt w-full bg-transparent text-sm outline-none"
              aria-label="Measurement value"
            />
          </label>
          <input
            value={measureUnit}
            onChange={(e) => onMeasureUnit(e.target.value)}
            placeholder={template.measureUnit || "unit"}
            className="ph bd txt focus-accent w-24 rounded-lg border bg-transparent px-2 py-1.5 text-sm outline-none"
            aria-label="Measurement unit"
          />
        </div>
      )}

      {showTags && (
        <div className="space-y-1.5">
          <div className="flex flex-wrap gap-1.5">
            {presets.map((tag) => {
              const active = tags.includes(tag);
              return (
                <button
                  key={tag}
                  onClick={() => onToggleTag(tag)}
                  className="rounded-full border px-2 py-0.5 text-[11px] font-medium transition"
                  style={
                    active
                      ? { background: "var(--accent)", color: "#fff", borderColor: "var(--accent)" }
                      : undefined
                  }
                >
                  <span className={active ? "" : "txt-muted"}>#{tag}</span>
                </button>
              );
            })}
            {custom.map((tag) => (
              <span
                key={tag}
                className="accent-soft inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
              >
                #{tag}
                <button
                  onClick={() => onRemoveTag(tag)}
                  aria-label={`Remove ${tag}`}
                  className="hover-strong"
                >
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2 pl-0.5">
            <Tag size={13} className="txt-faint shrink-0" />
            <input
              value={tagText}
              onChange={(e) => setTagText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onAddTag(tagText);
                  setTagText("");
                }
              }}
              placeholder="Add tag…"
              className="ph txt-muted flex-1 bg-transparent text-[13px] outline-none"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MODULE: TaskComposer — shared create/edit form. Now includes a
// category picker alongside title, schedule, repeat, subtasks.
// ─────────────────────────────────────────────────────────────
function emptyDraft() {
  return {
    text: "", date: "", time: "", repeat: "none", category: "", vehicleId: "",
    amount: "", measureValue: "", measureUnit: "", tags: [],
    side: "", marks: 0, subtasks: [],
  };
}

function TaskComposer({ initial, onSubmit, onCancel, submitLabel, onAddCategoryTag, onAddVehicle, timestamps }) {
  const [draft, setDraft] = useState(initial || emptyDraft());
  const [subText, setSubText] = useState("");

  const patch = (p) => setDraft((d) => ({ ...d, ...p }));

  const addSub = () => {
    const v = subText.trim();
    if (!v) return;
    patch({
      subtasks: [...draft.subtasks, { id: crypto.randomUUID(), text: v, done: false, subtasks: [] }],
    });
    setSubText("");
  };
  const editSub = (id, text) =>
    patch({
      subtasks: draft.subtasks.map((s) => (s.id === id ? { ...s, text } : s)),
    });
  const removeSub = (id) =>
    patch({ subtasks: draft.subtasks.filter((s) => s.id !== id) });

  // resolve the active category + its template (drives extra fields)
  const categories = useCategoryList();
  const activeTemplate =
    categories.find((c) => c.id === draft.category)?.template || null;

  const toggleTag = (tag) =>
    patch({
      tags: draft.tags.includes(tag)
        ? draft.tags.filter((t) => t !== tag)
        : [...draft.tags, tag],
    });
  // creating a tag selects it for this task AND keeps it on the
  // category's template (so it's reusable next time, on this category only).
  const addTag = (tag) => {
    const v = tag.trim();
    if (!v) return;
    if (!draft.tags.includes(v)) patch({ tags: [...draft.tags, v] });
    if (draft.category && onAddCategoryTag) onAddCategoryTag(draft.category, v);
  };
  const removeTag = (tag) =>
    patch({ tags: draft.tags.filter((t) => t !== tag) });

  const canSubmit = draft.text.trim().length > 0;
  const submit = () => {
    if (!canSubmit) return;
    // template fields are category-specific: only persist them when the
    // chosen category actually supports them.
    const tmpl = categories.find((c) => c.id === draft.category)?.template;
    const cleaned = {
      ...draft,
      vehicleId: tmpl?.vehicle ? draft.vehicleId : "",
      amount: tmpl?.currency ? draft.amount : "",
      measureValue: tmpl?.measure ? draft.measureValue : "",
      measureUnit: tmpl?.measure ? draft.measureUnit : "",
      tags: Array.isArray(tmpl?.tags) ? draft.tags : [],
    };
    onSubmit(cleaned);
  };

  return (
    <div className="card bd space-y-3 rounded-xl border p-3 shadow-sm">
      {/* title */}
      <input
        autoFocus
        value={draft.text}
        onChange={(e) => patch({ text: e.target.value })}
        onKeyDown={(e) => e.key === "Enter" && canSubmit && submit()}
        placeholder="Task name…"
        className="ph txt w-full bg-transparent text-sm font-medium outline-none"
      />

      {/* schedule + repeat row */}
      <div className="grid grid-cols-3 gap-2">
        <label className="bd focus-accent col-span-1 flex items-center gap-1.5 rounded-lg border px-2 py-1.5">
          <Calendar size={13} className="txt-soft shrink-0" />
          <input
            type="date"
            value={draft.date}
            onChange={(e) => patch({ date: e.target.value })}
            className="txt w-full bg-transparent text-xs outline-none"
          />
        </label>
        <label className="bd focus-accent col-span-1 flex items-center gap-1.5 rounded-lg border px-2 py-1.5">
          <Clock size={13} className="txt-soft shrink-0" />
          <input
            type="time"
            value={draft.time}
            onChange={(e) => patch({ time: e.target.value })}
            className="txt w-full bg-transparent text-xs outline-none"
          />
        </label>
        <label className="bd focus-accent col-span-1 flex items-center gap-1.5 rounded-lg border px-2 py-1.5">
          <Repeat size={13} className="txt-soft shrink-0" />
          <select
            value={draft.repeat}
            onChange={(e) => patch({ repeat: e.target.value })}
            className="txt w-full bg-transparent text-xs outline-none"
          >
            {REPEAT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {draft.repeat !== "none" && !draft.date && (
        <p className="warn flex items-center gap-1 text-[11px]">
          <AlertCircle size={11} /> Set a date for the repeat to advance from.
        </p>
      )}

      {/* Kronos / Kairos allocation */}
      <div className="bd space-y-1.5 border-t pt-2">
        <span className="txt-muted text-[11px] font-semibold uppercase tracking-wide">
          Kronos / Kairos
        </span>
        <div className="flex gap-1.5">
          {[
            { id: "kronos", label: "Kronos", icon: Swords },
            { id: "", label: "None", icon: null },
            { id: "kairos", label: "Kairos", icon: Sparkles },
          ].map(({ id, label, icon: Icon }) => {
            const active = (draft.side || "") === id;
            return (
              <button
                key={id || "none"}
                onClick={() => patch({ side: id })}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-semibold transition ${
                  active
                    ? id === "kronos"
                      ? "danger-soft danger"
                      : id === "kairos"
                      ? "accent-soft accent-fg"
                      : "surface txt"
                    : "bd txt-muted hover-strong"
                }`}
                style={
                  active
                    ? {
                        borderColor:
                          id === "kronos"
                            ? "var(--danger)"
                            : id === "kairos"
                            ? "var(--accent)"
                            : "var(--border-strong)",
                      }
                    : undefined
                }
              >
                {Icon && <Icon size={13} />}
                {label}
              </button>
            );
          })}
        </div>

        {draft.side === "kairos" && (
          <div className="flex items-center gap-2 pt-1">
            <span className="txt-muted text-[11px]">Special marks</span>
            <div className="flex items-center gap-1">
              {Array.from({ length: MAX_MARKS }).map((_, i) => {
                const filled = (draft.marks || 0) > i;
                return (
                  <button
                    key={i}
                    onClick={() =>
                      patch({ marks: filled && draft.marks === i + 1 ? i : i + 1 })
                    }
                    aria-label={`${i + 1} mark${i ? "s" : ""}`}
                    className={filled ? "accent-fg" : "txt-faint hover-accent"}
                  >
                    <Star
                      size={16}
                      fill={filled ? "currentColor" : "none"}
                      strokeWidth={filled ? 0 : 2}
                    />
                  </button>
                );
              })}
            </div>
            <span className="txt-soft text-[11px]">
              +{SCORING.perMark} pts each
            </span>
          </div>
        )}

        {draft.side === "kronos" && !draft.date && (
          <p className="warn flex items-center gap-1 text-[11px]">
            <AlertCircle size={11} /> A Kronos enemy needs a date — its
            attacks trigger when the schedule lapses.
          </p>
        )}
      </div>

      {/* category picker */}
      <div className="bd space-y-1.5 border-t pt-2">
        <span className="txt-muted text-[11px] font-semibold uppercase tracking-wide">
          Category
        </span>
        <CategoryPicker
          value={draft.category}
          onChange={(id) => patch({ category: id })}
        />
      </div>

      {/* category-specific template fields (Finances, Health, Home, …) */}
      {activeTemplate && (
        <TemplateFields
          template={activeTemplate}
          amount={draft.amount}
          measureValue={draft.measureValue}
          measureUnit={draft.measureUnit}
          tags={draft.tags}
          vehicleId={draft.vehicleId}
          onAmount={(v) => patch({ amount: v })}
          onMeasureValue={(v) => patch({ measureValue: v })}
          onMeasureUnit={(v) => patch({ measureUnit: v })}
          onToggleTag={toggleTag}
          onAddTag={addTag}
          onRemoveTag={removeTag}
          onVehicleId={(v) => patch({ vehicleId: v })}
          onAddVehicle={onAddVehicle}
        />
      )}

      {/* subtask builder */}
      <div className="bd space-y-1.5 border-t pt-2">
        {draft.subtasks.map((s) => (
          <div key={s.id} className="flex items-center gap-2 pl-1">
            <CornerDownRight size={14} className="txt-faint shrink-0" />
            <input
              value={s.text}
              onChange={(e) => editSub(s.id, e.target.value)}
              className="txt flex-1 bg-transparent text-[13px] outline-none"
            />
            <button
              onClick={() => removeSub(s.id)}
              aria-label="Remove subtask"
              className="txt-faint hover-danger transition"
            >
              <X size={14} />
            </button>
          </div>
        ))}
        <div className="flex items-center gap-2 pl-1">
          <Plus size={14} className="txt-faint shrink-0" />
          <input
            value={subText}
            onChange={(e) => setSubText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addSub();
              }
            }}
            placeholder="Add subtask…"
            className="ph txt-muted flex-1 bg-transparent text-[13px] outline-none"
          />
        </div>
      </div>

      {/* read-only timestamps (edit mode only) */}
      {timestamps && (timestamps.createdAt || timestamps.completedAt) && (
        <div className="bd flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-2 text-[11px]">
          {timestamps.createdAt && (
            <span className="txt-soft inline-flex items-center gap-1">
              <Plus size={11} /> Added {fmtStamp(timestamps.createdAt)}
            </span>
          )}
          {timestamps.completedAt && (
            <span className="txt-soft inline-flex items-center gap-1">
              <Check size={11} /> Completed {fmtStamp(timestamps.completedAt)}
            </span>
          )}
        </div>
      )}

      {/* actions */}
      <div className="bd flex items-center justify-end gap-2 border-t pt-2">
        {onCancel && (
          <button
            onClick={onCancel}
            className="txt-muted hover-strong rounded-lg px-3 py-1.5 text-xs font-medium transition"
          >
            Cancel
          </button>
        )}
        <button
          onClick={submit}
          disabled={!canSubmit}
          className="accent-solid rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-40"
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MODULE: Modal — lightweight overlay used to host the editor.
// ─────────────────────────────────────────────────────────────
function Modal({ children, onClose }) {
  return (
    <div
      className="overlay-bg fixed inset-0 z-30 flex items-start justify-center p-4 pt-20"
      onClick={onClose}
    >
      <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MODULE: DueBadge — chip summarizing schedule + recurrence.
// ─────────────────────────────────────────────────────────────
function DueBadge({ date, time, repeat }) {
  const hasSchedule = date || time;
  const rep = repeatLabel(repeat);
  if (!hasSchedule && !rep) return null;
  const overdue = isOverdue(date, time);
  return (
    <span className="inline-flex items-center gap-1.5">
      {hasSchedule && (
        <span
          className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
            overdue ? "danger-soft danger" : "surface txt-muted"
          }`}
        >
          {overdue && <AlertCircle size={11} />}
          {date && fmtDate(date)}
          {time && (date ? " · " : "") + fmtTime(time)}
        </span>
      )}
      {rep && (
        <span className="accent-soft inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium">
          <Repeat size={10} />
          {rep}
        </span>
      )}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// MODULE: SubtaskList — read/check view on the row.
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// MODULE: SubtaskNode / SubtaskList — recursive, collapsible subtask
// outline (Reddit-comment-style: any node can carry its own children,
// collapsed independently). Renaming existing text is still done via
// the task's Edit composer; this view handles toggling done,
// collapsing, adding a child under any node, and removing a node
// (and its whole subtree) — the operations that make the outline feel
// alive without reopening the composer each time.
// ─────────────────────────────────────────────────────────────
function SubtaskNode({ taskId, node, ops }) {
  const [expanded, setExpanded] = useState(true);
  const [addingChild, setAddingChild] = useState(false);
  const [childText, setChildText] = useState("");
  const hasChildren = node.subtasks.length > 0;

  const submitChild = () => {
    const v = childText.trim();
    if (!v) return;
    ops.addSubChild(taskId, node.id, v);
    setChildText("");
    setAddingChild(false);
  };

  return (
    <div className="space-y-1.5">
      <div className="group flex items-center gap-1.5">
        <button
          onClick={() => setExpanded((e) => !e)}
          aria-label={expanded ? "Collapse" : "Expand"}
          className={`txt-soft hover-strong shrink-0 transition ${
            hasChildren ? "" : "pointer-events-none opacity-20"
          }`}
        >
          <ChevronRight
            size={12}
            className={`transition-transform ${expanded ? "rotate-90" : ""}`}
          />
        </button>
        <Checkbox size={4} done={node.done} onClick={() => ops.toggleSub(taskId, node.id)} />
        <span
          className={`flex-1 text-[13px] transition ${
            node.done ? "txt-soft line-through" : "txt"
          }`}
        >
          {node.text}
        </span>
        <button
          onClick={() => setAddingChild((a) => !a)}
          aria-label="Add sub-item"
          className="txt-faint hover-accent shrink-0 opacity-0 transition group-hover:opacity-100"
        >
          <Plus size={13} />
        </button>
        <button
          onClick={() => ops.removeSub(taskId, node.id)}
          aria-label="Remove sub-item"
          className="txt-faint hover-danger shrink-0 opacity-0 transition group-hover:opacity-100"
        >
          <X size={13} />
        </button>
      </div>

      {addingChild && (
        <div className="ml-5 flex items-center gap-2">
          <CornerDownRight size={12} className="txt-faint shrink-0" />
          <input
            autoFocus
            value={childText}
            onChange={(e) => setChildText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitChild();
              }
              if (e.key === "Escape") {
                setAddingChild(false);
                setChildText("");
              }
            }}
            onBlur={() => !childText.trim() && setAddingChild(false)}
            placeholder="Add sub-item…"
            className="ph txt-muted flex-1 bg-transparent text-[13px] outline-none"
          />
        </div>
      )}

      {expanded && hasChildren && (
        <div className="bd ml-2 space-y-1.5 border-l-2 pl-3">
          {node.subtasks.map((child) => (
            <SubtaskNode key={child.id} taskId={taskId} node={child} ops={ops} />
          ))}
        </div>
      )}
    </div>
  );
}

function SubtaskList({ taskId, subtasks, ops }) {
  const [addingRoot, setAddingRoot] = useState(false);
  const [rootText, setRootText] = useState("");

  const submitRoot = () => {
    const v = rootText.trim();
    if (!v) return;
    ops.addSubChild(taskId, null, v);
    setRootText("");
    setAddingRoot(false);
  };

  return (
    <div className="bd ml-8 mt-2 space-y-1.5 border-l-2 pl-3">
      {subtasks.map((node) => (
        <SubtaskNode key={node.id} taskId={taskId} node={node} ops={ops} />
      ))}
      {addingRoot ? (
        <div className="flex items-center gap-2">
          <Plus size={12} className="txt-faint shrink-0" />
          <input
            autoFocus
            value={rootText}
            onChange={(e) => setRootText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitRoot();
              }
              if (e.key === "Escape") {
                setAddingRoot(false);
                setRootText("");
              }
            }}
            onBlur={() => !rootText.trim() && setAddingRoot(false)}
            placeholder="Add sub-item…"
            className="ph txt-muted flex-1 bg-transparent text-[13px] outline-none"
          />
        </div>
      ) : (
        <button
          onClick={() => setAddingRoot(true)}
          className="txt-soft hover-accent flex items-center gap-1.5 text-[11px] font-medium transition"
        >
          <Plus size={12} /> Add sub-item
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MODULE: TaskRow — display + quick interactions.
// ─────────────────────────────────────────────────────────────
function TaskRow({ task, index, ops, drag, onEdit, dragEnabled = true }) {
  const [expanded, setExpanded] = useState(task.subtasks.length > 0);

  // flattened so the count (and the "expand to add one" affordance)
  // reflects the whole nested outline, not just the top level
  const flatSubs = flattenSubtasks(task.subtasks);
  const subDone = flatSubs.filter((s) => s.done).length;
  const subTotal = flatSubs.length;
  const hasAmount = task.amount != null && task.amount !== "";
  const hasTags = Array.isArray(task.tags) && task.tags.length > 0;
  const hasMeasure = task.measureValue != null && task.measureValue !== "";
  const hasMeta =
    task.date || task.time || task.repeat !== "none" || task.category ||
    task.side || hasAmount || hasMeasure || hasTags || subTotal > 0;

  return (
    <li
      data-task-index={index}
      className={`card rounded-xl border transition-all ${
        drag.overIndex === index ? "accent-bd accent-soft" : "bd hover-bd-strong"
      }`}
    >
      <div className="group flex items-center gap-2.5 px-3 py-3">
        <button
          onPointerDown={(e) => {
            if (!dragEnabled) return;
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.start(index);
          }}
          onPointerMove={(e) => {
            if (!dragEnabled) return;
            drag.move(e.clientX, e.clientY);
          }}
          onPointerUp={() => dragEnabled && drag.end()}
          onPointerCancel={() => dragEnabled && drag.end()}
          className={`txt-faint hover-txt touch-none select-none transition ${
            dragEnabled
              ? "cursor-grab opacity-40 group-hover:opacity-100 active:cursor-grabbing"
              : "pointer-events-none opacity-0"
          }`}
          aria-label="Drag to reorder"
          title={dragEnabled ? undefined : "Switch to manual order to reorder"}
        >
          <GripVertical size={16} />
        </button>

        <button
          onClick={() => setExpanded((e) => !e)}
          aria-label={expanded ? "Collapse" : "Expand"}
          title={subTotal ? undefined : "Expand to add sub-items"}
          className="txt-soft hover-strong transition"
        >
          <ChevronRight
            size={15}
            className={`transition-transform ${expanded ? "rotate-90" : ""}`}
          />
        </button>

        <Checkbox done={task.done} onClick={() => ops.toggle(task.id)} />

        <div className="flex flex-1 flex-col gap-1">
          <span
            className={`text-sm transition ${
              task.done ? "txt-soft line-through" : "txt"
            }`}
          >
            {task.text}
          </span>
          {hasMeta && (
            <div className="flex flex-wrap items-center gap-1.5">
              <SideBadge side={task.side} marks={task.marks} />
              <CategoryChip id={task.category} />
              <VehicleChip id={task.vehicleId} />
              <MoneyBadge amount={task.amount} categoryId={task.category} />
              <MeasureBadge
                value={task.measureValue}
                unit={task.measureUnit}
                categoryId={task.category}
              />
              <DueBadge date={task.date} time={task.time} repeat={task.repeat} />
              <TagChips tags={task.tags} />
              {subTotal > 0 && (
                <span className="txt-soft text-[11px]">
                  {subDone}/{subTotal} subtasks
                </span>
              )}
            </div>
          )}
        </div>

        <button
          onClick={() => onEdit(task)}
          aria-label="Edit task"
          className="txt-faint hover-accent opacity-0 transition group-hover:opacity-100"
        >
          <Pencil size={15} />
        </button>

        <button
          onClick={() => ops.remove(task.id)}
          aria-label="Delete task"
          className="txt-faint hover-danger opacity-0 transition group-hover:opacity-100"
        >
          <X size={16} />
        </button>
      </div>

      {expanded && (
        <div className="pb-3">
          <SubtaskList taskId={task.id} subtasks={task.subtasks} ops={ops} />
        </div>
      )}
    </li>
  );
}

// ─────────────────────────────────────────────────────────────
// MODULE: FilterSortBar — List-view-only category + tag filters
// (multi-select toggle chips) and a sort mode select. All display-
// only transforms: the underlying task order (used for drag reorder)
// is never touched. Manual drag reorder only makes sense against the
// true stored order, so it's disabled by the caller whenever a
// filter or non-manual sort is active — see `dragEnabled` on TaskRow.
// ─────────────────────────────────────────────────────────────
const SORT_OPTIONS = [
  { value: "manual", label: "Manual order" },
  { value: "alpha", label: "Name (A–Z)" },
  { value: "date", label: "Date (soonest first)" },
  { value: "value", label: "Value (highest first)" },
  { value: "points", label: "Points (highest first)" },
];

function FilterSortBar({
  activeCategories, onToggleCategory,
  activeTags, onToggleTag, availableTags,
  onClearFilters, sortMode, onSortMode,
}) {
  const categories = useCategoryList();
  const hasFilters = activeCategories.length > 0 || activeTags.length > 0;
  if (categories.length === 0 && availableTags.length === 0) return null;

  return (
    <div className="space-y-2 border-b bd pb-3">
      {categories.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <ListFilter size={13} className="txt-faint shrink-0" />
          {categories.map((c) => {
            const active = activeCategories.includes(c.id);
            return (
              <button
                key={c.id}
                onClick={() => onToggleCategory(c.id)}
                className="flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-medium transition"
                style={
                  active
                    ? { background: c.color, color: "#fff", borderColor: c.color }
                    : undefined
                }
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: active ? "#fff" : c.color }}
                />
                <span className={active ? "" : "txt-muted"}>{c.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {availableTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <Tag size={13} className="txt-faint shrink-0" />
          {availableTags.map((tag) => {
            const active = activeTags.includes(tag);
            return (
              <button
                key={tag}
                onClick={() => onToggleTag(tag)}
                className={`rounded-full border px-2 py-0.5 text-[11px] font-medium transition ${
                  active
                    ? "accent-solid accent-bd"
                    : "bd txt-muted hover-accent-bd"
                }`}
              >
                #{tag}
              </button>
            );
          })}
        </div>
      )}

      {hasFilters && (
        <button
          onClick={onClearFilters}
          className="txt-soft hover-danger flex items-center gap-1 text-[11px] font-medium transition"
        >
          <X size={11} /> Clear filters
        </button>
      )}

      <label className="flex items-center gap-1.5">
        <ArrowDownAZ size={13} className="txt-faint shrink-0" />
        <select
          value={sortMode}
          onChange={(e) => onSortMode(e.target.value)}
          className="bd txt focus-accent rounded-lg border bg-transparent px-2 py-1 text-[11px] font-medium outline-none"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MODULE: ViewSwitcher — segmented control toggling list/calendar.
// ─────────────────────────────────────────────────────────────
function ViewSwitcher({ view, onChange }) {
  const tabs = [
    { id: "list", label: "List", icon: List },
    { id: "calendar", label: "Calendar", icon: CalendarDays },
    { id: "timeline", label: "Timeline", icon: History },
  ];
  return (
    <div className="card bd flex rounded-lg border p-0.5">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold transition ${
            view === id ? "accent-solid shadow-sm" : "txt-muted hover-strong"
          }`}
        >
          <Icon size={14} />
          {label}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MODULE: CalendarView — month grid of scheduled tasks.
// ─────────────────────────────────────────────────────────────
function CalendarView({ tasks, onEdit, onToggle }) {
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState(() => todayISO());

  const cells = buildMonthGrid(cursor);
  const monthIdx = cursor.getMonth();
  const today = todayISO();

  const byDate = {};
  for (const t of tasks) {
    if (!t.date) continue;
    (byDate[t.date] ||= []).push(t);
  }
  const unscheduled = tasks.filter((t) => !t.date);
  const selectedTasks = byDate[selected] || [];

  const shiftMonth = (delta) =>
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));
  const goToday = () => {
    const now = new Date();
    setCursor(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelected(todayISO());
  };

  return (
    <div className="space-y-4">
      {/* month nav */}
      <div className="flex items-center justify-between">
        <h2 className="txt-strong text-sm font-semibold">
          {MONTH_NAMES[monthIdx]} {cursor.getFullYear()}
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={goToday}
            className="accent-fg hover-surface mr-1 rounded-md px-2 py-1 text-xs font-medium transition"
          >
            Today
          </button>
          <button
            onClick={() => shiftMonth(-1)}
            aria-label="Previous month"
            className="txt-soft hover-surface hover-strong rounded-md p-1 transition"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => shiftMonth(1)}
            aria-label="Next month"
            className="txt-soft hover-surface hover-strong rounded-md p-1 transition"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* weekday header */}
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="txt-soft py-1 text-center text-[10px] font-semibold uppercase tracking-wide"
          >
            {d}
          </div>
        ))}
      </div>

      {/* day grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d) => {
          const iso = toISO(d);
          const inMonth = d.getMonth() === monthIdx;
          const dayTasks = byDate[iso] || [];
          const isToday = iso === today;
          const isSelected = iso === selected;
          const hasOverdue = dayTasks.some(
            (t) => !t.done && isOverdue(t.date, t.time)
          );
          return (
            <button
              key={iso}
              onClick={() => setSelected(iso)}
              className={`relative flex aspect-square flex-col items-center justify-start rounded-lg border p-1 text-xs transition ${
                isSelected ? "accent-bd accent-soft" : "hover-surface border-transparent"
              } ${inMonth ? "" : "opacity-30"}`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[12px] ${
                  isToday ? "accent-solid font-bold" : "txt"
                }`}
              >
                {d.getDate()}
              </span>
              {dayTasks.length > 0 && (
                <span className="mt-0.5 flex items-center gap-0.5">
                  {dayTasks.slice(0, 3).map((t) => (
                    <span
                      key={t.id}
                      className="h-1.5 w-1.5 rounded-full"
                      style={{
                        background: t.done
                          ? "var(--txt-faint)"
                          : hasOverdue
                          ? "var(--danger)"
                          : "var(--accent)",
                      }}
                    />
                  ))}
                  {dayTasks.length > 3 && (
                    <span className="txt-soft text-[8px] font-semibold">
                      +{dayTasks.length - 3}
                    </span>
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* selected-day agenda */}
      <div className="bd space-y-2 border-t pt-3">
        <h3 className="txt-muted text-xs font-semibold">
          {fmtDate(selected) === "Today"
            ? "Today"
            : new Date(selected + "T00:00:00").toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
        </h3>
        {selectedTasks.length === 0 ? (
          <p className="txt-soft py-3 text-center text-xs">
            No tasks scheduled this day.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {selectedTasks.map((task) => (
              <li
                key={task.id}
                className="card bd flex items-center gap-2.5 rounded-lg border px-3 py-2"
              >
                <Checkbox done={task.done} onClick={() => onToggle(task.id)} />
                <button
                  onClick={() => onEdit(task)}
                  className="flex flex-1 flex-col items-start text-left"
                >
                  <span
                    className={`text-sm ${
                      task.done ? "txt-soft line-through" : "txt"
                    }`}
                  >
                    {task.text}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    <SideBadge side={task.side} marks={task.marks} />
                    <CategoryChip id={task.category} />
                    <VehicleChip id={task.vehicleId} />
                    <MoneyBadge amount={task.amount} categoryId={task.category} />
                    <MeasureBadge
                      value={task.measureValue}
                      unit={task.measureUnit}
                      categoryId={task.category}
                    />
                    {task.time && (
                      <span className="txt-soft text-[11px]">
                        {fmtTime(task.time)}
                      </span>
                    )}
                    {task.repeat !== "none" && (
                      <span className="accent-fg inline-flex items-center gap-0.5 text-[11px]">
                        <Repeat size={9} />
                        {repeatLabel(task.repeat)}
                      </span>
                    )}
                    <TagChips tags={task.tags} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* unscheduled */}
      {unscheduled.length > 0 && (
        <div className="bd space-y-2 border-t pt-3">
          <h3 className="txt-muted text-xs font-semibold">
            Unscheduled ({unscheduled.length})
          </h3>
          <ul className="space-y-1.5">
            {unscheduled.map((task) => (
              <li
                key={task.id}
                className="card bd flex items-center gap-2.5 rounded-lg border border-dashed px-3 py-2"
              >
                <Checkbox done={task.done} onClick={() => onToggle(task.id)} />
                <button
                  onClick={() => onEdit(task)}
                  className={`flex-1 text-left text-sm ${
                    task.done ? "txt-soft line-through" : "txt"
                  }`}
                >
                  {task.text}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MODULE: TimelineView — completed events in reverse-chronological
// order, grouped by day. Reads the events log, so it persists even
// after tasks are cleared, and recurring completions each appear.
// ─────────────────────────────────────────────────────────────
function TimelineView({ events }) {
  // newest first
  const sorted = [...events].sort((a, b) => (a.ts < b.ts ? 1 : -1));

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <History size={28} className="txt-faint" />
        <p className="txt-muted text-sm font-medium">No completed tasks yet</p>
        <p className="txt-soft text-xs">
          Check tasks off and they'll thread into the weave, in the order you finished them.
        </p>
      </div>
    );
  }

  // group events by calendar day (mm/dd/yyyy)
  const groups = [];
  let current = null;
  for (const ev of sorted) {
    const day = fmtStamp(ev.ts);
    if (!current || current.day !== day) {
      current = { day, ts: ev.ts, items: [] };
      groups.push(current);
    }
    current.items.push(ev);
  }

  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <div key={g.day} className="space-y-2">
          <div className="flex items-baseline justify-between">
            <h3 className="txt-strong text-sm font-semibold">
              {fmtStamp(todayISO()) === g.day ? "Today" : g.day}
            </h3>
            <span className="txt-soft text-[11px]">
              {(() => {
                const done = g.items.filter((e) => e.type !== "penalty").length;
                const hits = g.items.length - done;
                return [
                  done ? `${done} completed` : null,
                  hits ? `${hits} strike${hits > 1 ? "s" : ""}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ");
              })()}
            </span>
          </div>

          {/* the thread: Kairos current fading into Kronos red */}
          <ol
            className="relative space-y-2 border-l-2 bd pl-4"
            style={{
              borderImageSource:
                "linear-gradient(to bottom, var(--accent), var(--danger))",
              borderImageSlice: 1,
            }}
          >
            {g.items.map((ev) => {
              const isPenalty = ev.type === "penalty";
              return (
                <li key={ev.id} className="relative">
                  {/* node dot */}
                  <span
                    className="absolute top-1.5 flex h-3 w-3 items-center justify-center rounded-full"
                    style={{
                      background: isPenalty ? "var(--danger)" : "var(--accent)",
                      left: "-21px",
                    }}
                  >
                    {isPenalty ? (
                      <Swords size={8} strokeWidth={3} className="text-white" />
                    ) : (
                      <Check size={8} strokeWidth={4} className="text-white" />
                    )}
                  </span>
                  <div
                    className={`card rounded-lg border px-3 py-2 ${
                      isPenalty ? "" : "bd"
                    }`}
                    style={
                      isPenalty
                        ? { borderColor: "color-mix(in srgb, var(--danger) 45%, transparent)" }
                        : undefined
                    }
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className={`text-sm ${isPenalty ? "danger" : "txt"}`}>
                        {isPenalty ? `Kronos strike — ${ev.text}` : ev.text}
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        {(ev.points || 0) !== 0 && (
                          <span
                            className={`text-[11px] font-bold ${
                              ev.points > 0 ? "accent-fg" : "danger"
                            }`}
                          >
                            {ev.points > 0 ? `+${ev.points}` : ev.points}
                          </span>
                        )}
                        <span className="txt-soft text-[11px]">
                          {fmtStampTime(ev.ts)?.split(" ").slice(1).join(" ")}
                        </span>
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <SideBadge side={ev.side} marks={0} />
                      <CategoryChip id={ev.category} />
                      <VehicleChip id={ev.vehicleId} />
                      <MoneyBadge amount={ev.amount} categoryId={ev.category} />
                      <MeasureBadge
                        value={ev.measureValue}
                        unit={ev.measureUnit}
                        categoryId={ev.category}
                      />
                      <TagChips tags={ev.tags} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MODULE: UndoToast — transient revert bar.
// ─────────────────────────────────────────────────────────────
function UndoToast({ show, label, onUndo, onDismiss }) {
  useEffect(() => {
    if (!show) return;
    const id = setTimeout(onDismiss, 5000);
    return () => clearTimeout(id);
  }, [show, label, onDismiss]);

  if (!show) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
      <div className="toast pointer-events-auto flex items-center gap-3 rounded-xl py-2.5 pl-4 pr-2.5 text-sm text-white shadow-lg">
        <span className="text-slate-200">{label}</span>
        <button
          onClick={onUndo}
          className="flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1 text-xs font-semibold transition hover:bg-white/20"
        >
          <Undo2 size={13} />
          Undo
        </button>
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="rounded-md p-1 text-slate-400 transition hover-white"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MODULE: HistoryControls — persistent undo/redo buttons.
// ─────────────────────────────────────────────────────────────
function HistoryControls({ canUndo, canRedo, onUndo, onRedo }) {
  return (
    <div className="card bd inline-flex rounded-lg border p-0.5">
      <button
        onClick={onUndo}
        disabled={!canUndo}
        aria-label="Undo"
        title="Undo (Ctrl/Cmd+Z)"
        className="txt-muted hover-surface hover-strong rounded-md p-1.5 transition disabled:cursor-not-allowed disabled:opacity-30"
      >
        <Undo2 size={15} />
      </button>
      <button
        onClick={onRedo}
        disabled={!canRedo}
        aria-label="Redo"
        title="Redo (Ctrl/Cmd+Shift+Z)"
        className="txt-muted hover-surface hover-strong rounded-md p-1.5 transition disabled:cursor-not-allowed disabled:opacity-30"
      >
        <Redo2 size={15} />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MODULE: ToggleSwitch — reusable accent-aware on/off switch.
// ─────────────────────────────────────────────────────────────
function ToggleSwitch({ on, onClick, label }) {
  return (
    <button
      onClick={onClick}
      role="switch"
      aria-checked={on}
      aria-label={label}
      className="relative h-6 w-11 shrink-0 rounded-full transition"
      style={{ background: on ? "var(--accent)" : "var(--border-strong)" }}
    >
      <span
        className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform"
        style={{ transform: on ? "translateX(20px)" : "translateX(0)" }}
      />
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// MODULE: CategorySettingRow — one category in settings, with an
// expandable template editor (currency + customizable tags). The
// template is what makes a category like Finances carry extra fields.
// ─────────────────────────────────────────────────────────────
function CategorySettingRow({ c, onUpdate, onRemove, onSetTags }) {
  const [open, setOpen] = useState(false);
  const [tagText, setTagText] = useState("");
  const tmpl = c.template || null;

  const baseTemplate = () =>
    tmpl || { currency: false, currencyCode: "USD", tags: [] };
  const patchTemplate = (p) =>
    onUpdate(c.id, { template: { ...baseTemplate(), ...p } });
  const setTemplateOn = (on) =>
    onUpdate(c.id, { template: on ? baseTemplate() : null });

  const tags = tmpl?.tags || [];

  return (
    <div className="bd rounded-lg border">
      <div className="flex items-center gap-2 p-2">
        <input
          type="color"
          value={c.color}
          onChange={(e) => onUpdate(c.id, { color: e.target.value })}
          aria-label={`Color for ${c.label}`}
          className="h-7 w-7 shrink-0"
        />
        <input
          value={c.label}
          onChange={(e) => onUpdate(c.id, { label: e.target.value })}
          placeholder="Category name"
          className="ph bd txt focus-accent flex-1 rounded-lg border bg-transparent px-2 py-1.5 text-sm outline-none"
        />
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label="Template options"
          title="Template options"
          className={`shrink-0 p-1 transition hover-strong ${
            tmpl ? "accent-fg" : "txt-soft"
          }`}
        >
          <SlidersHorizontal size={15} />
        </button>
        <button
          onClick={() => onRemove(c.id)}
          aria-label={`Delete ${c.label}`}
          className="txt-faint hover-danger shrink-0 p-1 transition"
        >
          <Trash2 size={15} />
        </button>
      </div>

      {open && (
        <div className="bd space-y-3 border-t p-3">
          <div className="flex items-center justify-between">
            <span className="txt text-xs font-medium">Custom template</span>
            <ToggleSwitch
              on={!!tmpl}
              onClick={() => setTemplateOn(!tmpl)}
              label="Toggle custom template"
            />
          </div>

          {tmpl && (
            <>
              {/* currency */}
              <div className="flex items-center justify-between gap-2">
                <span className="txt-muted flex items-center gap-1.5 text-xs">
                  <Coins size={13} /> Currency amount
                </span>
                <div className="flex items-center gap-2">
                  {tmpl.currency && (
                    <input
                      value={tmpl.currencyCode || "USD"}
                      onChange={(e) =>
                        patchTemplate({
                          currencyCode: e.target.value.toUpperCase().slice(0, 4),
                        })
                      }
                      aria-label="Currency code"
                      className="bd txt focus-accent w-14 rounded border bg-transparent px-1.5 py-1 text-center text-xs outline-none"
                    />
                  )}
                  <ToggleSwitch
                    on={!!tmpl.currency}
                    onClick={() => patchTemplate({ currency: !tmpl.currency })}
                    label="Toggle currency field"
                  />
                </div>
              </div>

              {/* measurement (value + unit) */}
              <div className="flex items-center justify-between gap-2">
                <span className="txt-muted flex items-center gap-1.5 text-xs">
                  <Activity size={13} /> Value &amp; unit
                </span>
                <div className="flex items-center gap-2">
                  {tmpl.measure && (
                    <input
                      value={tmpl.measureUnit || ""}
                      onChange={(e) =>
                        patchTemplate({ measureUnit: e.target.value })
                      }
                      placeholder="unit"
                      aria-label="Default unit"
                      className="ph bd txt focus-accent w-20 rounded border bg-transparent px-1.5 py-1 text-center text-xs outline-none"
                    />
                  )}
                  <ToggleSwitch
                    on={!!tmpl.measure}
                    onClick={() => patchTemplate({ measure: !tmpl.measure })}
                    label="Toggle measurement field"
                  />
                </div>
              </div>

              {/* tags — each is editable (rename) and deletable */}
              <div className="space-y-1.5">
                <span className="txt-muted flex items-center gap-1.5 text-xs">
                  <Tag size={13} /> Tags
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag, i) => (
                    <span
                      key={i}
                      className="surface bd inline-flex items-center gap-1 rounded-full border py-0.5 pl-2 pr-1 text-[11px] font-medium"
                    >
                      <span className="txt-soft">#</span>
                      <input
                        value={tag}
                        size={Math.max(tag.length, 2)}
                        onChange={(e) =>
                          onSetTags(
                            c.id,
                            tags.map((t, idx) => (idx === i ? e.target.value : t))
                          )
                        }
                        aria-label={`Edit tag ${tag}`}
                        className="txt bg-transparent outline-none"
                      />
                      <button
                        onClick={() =>
                          onSetTags(
                            c.id,
                            tags.filter((_, idx) => idx !== i)
                          )
                        }
                        aria-label={`Delete tag ${tag}`}
                        className="txt-faint hover-danger"
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                  {tags.length === 0 && (
                    <span className="txt-soft text-[11px]">No tags yet.</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Plus size={13} className="txt-faint shrink-0" />
                  <input
                    value={tagText}
                    onChange={(e) => setTagText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const v = tagText.trim();
                        if (v && !tags.includes(v)) onSetTags(c.id, [...tags, v]);
                        setTagText("");
                      }
                    }}
                    placeholder="Add tag…"
                    className="ph txt-muted flex-1 bg-transparent text-[13px] outline-none"
                  />
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MODULE: VehicleSettingRow — one saved vehicle in Settings, with
// inline-editable fields and delete. No template system needed here
// (unlike categories) — vehicles are a flat, simple garage list.
// ─────────────────────────────────────────────────────────────
function VehicleSettingRow({ v, onUpdate, onRemove }) {
  return (
    <div className="bd space-y-2 rounded-lg border p-2">
      <div className="flex items-center gap-2">
        <Car size={15} className="txt-soft shrink-0" />
        <input
          value={v.label}
          onChange={(e) => onUpdate(v.id, { label: e.target.value })}
          placeholder="Nickname"
          className="ph bd txt focus-accent flex-1 rounded-lg border bg-transparent px-2 py-1.5 text-sm outline-none"
        />
        <button
          onClick={() => onRemove(v.id)}
          aria-label={`Delete ${vehicleLabel(v)}`}
          className="txt-faint hover-danger shrink-0 p-1 transition"
        >
          <Trash2 size={15} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input
          value={v.make}
          onChange={(e) => onUpdate(v.id, { make: e.target.value })}
          placeholder="Make"
          className="ph bd txt focus-accent rounded-lg border bg-transparent px-2 py-1.5 text-xs outline-none"
        />
        <input
          value={v.model}
          onChange={(e) => onUpdate(v.id, { model: e.target.value })}
          placeholder="Model"
          className="ph bd txt focus-accent rounded-lg border bg-transparent px-2 py-1.5 text-xs outline-none"
        />
        <input
          value={v.year}
          onChange={(e) => onUpdate(v.id, { year: e.target.value })}
          placeholder="Year"
          className="ph bd txt focus-accent rounded-lg border bg-transparent px-2 py-1.5 text-xs outline-none"
        />
        <input
          value={v.plate}
          onChange={(e) => onUpdate(v.id, { plate: e.target.value })}
          placeholder="Plate"
          className="ph bd txt focus-accent rounded-lg border bg-transparent px-2 py-1.5 text-xs outline-none"
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MODULE: SettingsPanel — the settings surface (hosted in a Modal).
// Sections: Appearance (dark + editable accent palette) and
// Categories (full CRUD + per-category templates).
// ─────────────────────────────────────────────────────────────
function SettingsPanel({
  theme, categories, vehicles, onClose, onResetData, onBuildBackup, onApplyBackup,
}) {
  const [armReset, setArmReset] = useState(false);
  const fileRef = useRef(null);
  const [pending, setPending] = useState(null); // parsed backup awaiting confirm
  const [importMsg, setImportMsg] = useState(null);
  const [exportJson, setExportJson] = useState(null); // open export card
  const [copyMsg, setCopyMsg] = useState(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");

  // shared by the file picker and the paste path
  const ingestBackupText = (text) => {
    try {
      const backup = JSON.parse(text);
      const st = backup?.state ?? backup;
      if (!st || !Array.isArray(st.tasks)) throw new Error("shape");
      const nTasks = st.tasks.length;
      const nEvents = Array.isArray(st.events) ? st.events.length : 0;
      setPending({
        backup,
        summary: `${nTasks} task${nTasks === 1 ? "" : "s"}, ${nEvents} timeline entr${
          nEvents === 1 ? "y" : "ies"
        }${backup.exportedAt ? ` · exported ${fmtStamp(backup.exportedAt)}` : ""}`,
      });
      setImportMsg(null);
      return true;
    } catch (_) {
      setPending(null);
      setImportMsg("That doesn't look like a Twine backup.");
      return false;
    }
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => ingestBackupText(reader.result);
    reader.onerror = () => setImportMsg("Couldn't read the file.");
    reader.readAsText(file);
  };

  const openExport = () => {
    setExportJson(JSON.stringify(onBuildBackup?.(), null, 2));
    setCopyMsg(null);
  };

  const tryDownload = () => {
    try {
      const blob = new Blob([exportJson], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `twine-backup-${todayISO()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (_) {}
  };

  const doCopy = async () => {
    const ok = await copyText(exportJson);
    setCopyMsg(
      ok
        ? "Copied — paste it somewhere safe."
        : "Copy was blocked — select the text below and copy manually."
    );
  };
  return (
    <div
      className="card bd space-y-5 overflow-y-auto rounded-xl border p-4 shadow-lg"
      style={{ maxHeight: "80vh" }}
    >
      <div className="flex items-center justify-between">
        <h2 className="txt-strong text-base font-bold">Settings</h2>
        <button
          onClick={onClose}
          aria-label="Close settings"
          className="txt-soft hover-strong transition"
        >
          <X size={18} />
        </button>
      </div>

      {/* ── Appearance ── */}
      <section className="space-y-3">
        <h3 className="txt-muted text-[11px] font-semibold uppercase tracking-wide">
          Appearance
        </h3>

        <div className="flex items-center justify-between">
          <span className="txt flex items-center gap-1.5 text-sm font-medium">
            {theme.dark ? <Moon size={14} /> : <Sun size={14} />}
            Dark mode
          </span>
          <ToggleSwitch
            on={theme.dark}
            onClick={theme.toggleDark}
            label="Toggle dark mode"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="txt text-sm font-medium">Accent</span>
            <button
              onClick={theme.resetPalette}
              className="txt-soft hover-accent flex items-center gap-1 text-[11px] font-medium transition"
            >
              <RotateCcw size={11} /> Reset palette
            </button>
          </div>

          {/* selectable swatches (fixed count) */}
          <div className="flex flex-wrap gap-2">
            {theme.palette.map((hex, i) => {
              const active = theme.accentIndex === i;
              return (
                <button
                  key={i}
                  onClick={() => theme.setAccentIndex(i)}
                  aria-label={`Select accent ${i + 1}`}
                  className="flex h-7 w-7 items-center justify-center rounded-full transition"
                  style={{
                    background: hex,
                    boxShadow: active
                      ? "0 0 0 2px var(--card), 0 0 0 3.5px var(--txt-strong)"
                      : "0 0 0 1px var(--border)",
                  }}
                >
                  {active && (
                    <Check size={14} strokeWidth={3} className="text-white" />
                  )}
                </button>
              );
            })}
          </div>

          {/* edit the currently-selected swatch */}
          <label className="bd flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
            <span className="txt-muted text-xs">Edit selected color</span>
            <span className="flex items-center gap-2">
              <span className="txt-soft text-[11px] uppercase tracking-wide">
                {theme.accentValue}
              </span>
              <input
                type="color"
                value={theme.accentValue}
                onChange={(e) =>
                  theme.setAccentColor(theme.accentIndex, e.target.value)
                }
                aria-label="Edit selected accent color"
                className="h-7 w-7"
              />
            </span>
          </label>
        </div>
      </section>

      {/* ── Categories ── */}
      <section className="space-y-3">
        <h3 className="txt-muted text-[11px] font-semibold uppercase tracking-wide">
          Categories
        </h3>

        <div className="space-y-2">
          {categories.categories.map((c) => (
            <CategorySettingRow
              key={c.id}
              c={c}
              onUpdate={categories.update}
              onRemove={categories.remove}
              onSetTags={categories.setCategoryTags}
            />
          ))}
          {categories.categories.length === 0 && (
            <p className="txt-soft text-xs">No categories. Add one below.</p>
          )}
        </div>

        <button
          onClick={categories.add}
          className="bd-strong txt-muted hover-accent-bd hover-accent flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed px-3 py-2 text-xs font-medium transition"
        >
          <Plus size={15} /> Add category
        </button>
      </section>

      {/* ── Vehicles ── */}
      <section className="space-y-3">
        <h3 className="txt-muted text-[11px] font-semibold uppercase tracking-wide">
          Vehicles
        </h3>

        <div className="space-y-2">
          {vehicles.vehicles.map((v) => (
            <VehicleSettingRow
              key={v.id}
              v={v}
              onUpdate={vehicles.update}
              onRemove={vehicles.remove}
            />
          ))}
          {vehicles.vehicles.length === 0 && (
            <p className="txt-soft text-xs">
              No vehicles yet — add one here, or from a task's Auto category picker.
            </p>
          )}
        </div>

        <button
          onClick={() => vehicles.add({})}
          className="bd-strong txt-muted hover-accent-bd hover-accent flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed px-3 py-2 text-xs font-medium transition"
        >
          <Plus size={15} /> Add vehicle
        </button>
      </section>

      {/* ── Data ── */}
      <section className="space-y-2">
        <h3 className="txt-muted text-[11px] font-semibold uppercase tracking-wide">
          Data
        </h3>

        {/* backup + restore */}
        <div className="flex gap-2">
          <button
            onClick={openExport}
            className="bd txt hover-accent-bd hover-accent flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition"
          >
            <Download size={14} />
            Export backup
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="bd txt hover-accent-bd hover-accent flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition"
          >
            <Upload size={14} />
            Import from file
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            onChange={handleFile}
            style={{ display: "none" }}
            aria-label="Import backup file"
          />
        </div>
        <button
          onClick={() => setPasteOpen((o) => !o)}
          className="txt-soft hover-accent flex items-center gap-1 text-[11px] font-medium transition"
        >
          <Clipboard size={11} />
          {pasteOpen ? "Hide paste area" : "Or paste a backup from your clipboard"}
        </button>

        {/* export card: file, clipboard, and manual-copy paths */}
        {exportJson && (
          <div className="bd surface space-y-2 rounded-lg border p-2.5">
            <p className="txt text-xs font-medium">Your backup</p>
            <div className="flex gap-2">
              <button
                onClick={tryDownload}
                className="bd txt hover-accent-bd flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition"
              >
                <Download size={12} /> Download file
              </button>
              <button
                onClick={doCopy}
                className="accent-solid flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-semibold"
              >
                <Copy size={12} /> Copy to clipboard
              </button>
            </div>
            {copyMsg && <p className="txt-muted text-[11px]">{copyMsg}</p>}
            <textarea
              readOnly
              value={exportJson}
              rows={5}
              onFocus={(e) => e.target.select()}
              className="bd txt-muted w-full rounded-lg border bg-transparent p-2 text-[10px] leading-snug outline-none"
              style={{ fontFamily: "monospace" }}
              aria-label="Backup JSON"
            />
            <div className="flex items-center justify-between">
              <p className="txt-soft text-[11px]">
                Sandboxed previews block file downloads — use Copy there; the
                file button works in local builds.
              </p>
              <button
                onClick={() => setExportJson(null)}
                className="txt-muted hover-strong shrink-0 rounded-lg px-2 py-1 text-[11px] font-medium transition"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* paste-a-backup path */}
        {pasteOpen && (
          <div className="bd surface space-y-2 rounded-lg border p-2.5">
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={4}
              placeholder="Paste backup JSON here…"
              className="ph bd txt w-full rounded-lg border bg-transparent p-2 text-[10px] leading-snug outline-none"
              style={{ fontFamily: "monospace" }}
              aria-label="Paste backup JSON"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setPasteText("");
                  setPasteOpen(false);
                }}
                className="txt-muted hover-strong rounded-lg px-3 py-1.5 text-xs font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (ingestBackupText(pasteText)) {
                    setPasteText("");
                    setPasteOpen(false);
                  }
                }}
                disabled={!pasteText.trim()}
                className="accent-solid rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
              >
                Read backup
              </button>
            </div>
          </div>
        )}

        {/* parsed backup awaiting confirmation */}
        {pending && (
          <div className="bd surface space-y-2 rounded-lg border p-2.5">
            <p className="txt text-xs font-medium">Backup ready to import</p>
            <p className="txt-muted text-[11px]">{pending.summary}</p>
            <p className="warn flex items-center gap-1 text-[11px]">
              <AlertCircle size={11} /> Importing replaces your current tasks,
              timeline, categories, and theme.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setPending(null)}
                className="txt-muted hover-strong rounded-lg px-3 py-1.5 text-xs font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const ok = onApplyBackup?.(pending.backup);
                  setPending(null);
                  setImportMsg(
                    ok ? "Backup imported." : "Import failed — unrecognized data."
                  );
                }}
                className="accent-solid rounded-lg px-3 py-1.5 text-xs font-semibold"
              >
                Import backup
              </button>
            </div>
          </div>
        )}

        {importMsg && <p className="txt-muted text-[11px]">{importMsg}</p>}

        <button
          onClick={() => {
            if (!armReset) {
              setArmReset(true);
              return;
            }
            setArmReset(false);
            onResetData?.();
          }}
          className={`danger flex w-full items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition ${
            armReset ? "danger-soft" : "bd hover:opacity-80"
          }`}
          style={armReset ? { borderColor: "var(--danger)" } : undefined}
        >
          <Trash2 size={14} />
          {armReset ? "Tap again to confirm reset" : "Reset app data"}
        </button>
        <p className="txt-soft text-[11px]">
          Reset clears all tasks and timeline history and restores default
          categories and theme. It cannot be undone — download a backup first
          if you might want this data later.
        </p>
      </section>

      <div className="bd flex justify-end border-t pt-3">
        <button
          onClick={onClose}
          className="accent-solid rounded-lg px-4 py-1.5 text-xs font-semibold"
        >
          Done
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MODULE: ProgressBar — counts tasks + subtasks.
// ─────────────────────────────────────────────────────────────
function ProgressBar({ done, total }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="txt-muted flex items-center justify-between text-xs">
        <span>
          {done} of {total} done
        </span>
        <span className="accent-fg font-semibold">{pct}%</span>
      </div>
      <div className="track h-1.5 w-full overflow-hidden rounded-full">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, background: "var(--accent)" }}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SHELL: composes modules; owns theme, view, history toast, keys.
// ─────────────────────────────────────────────────────────────
export default function App({ session } = {}) {
  const userId = session?.user?.id || null;
  const t = useTasks();
  const theme = useTheme();
  const cats = useCategories();
  const vehicles = useVehicles();
  const dragFrom = useRef(null);
  const [overIndex, setOverIndex] = useState(null);
  const [composing, setComposing] = useState(false);
  const [editing, setEditing] = useState(null);
  const [toastOpen, setToastOpen] = useState(false);
  const [view, setView] = useState("list");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState([]);
  const [tagFilter, setTagFilter] = useState([]);
  const [sortMode, setSortMode] = useState("manual");

  useEffect(() => {
    try {
      document.title = "Twine";
    } catch (_) {}
  }, []);

  // pop the toast whenever a committed action changes history depth
  const prevDepth = useRef(t.depth);
  useEffect(() => {
    if (t.depth !== prevDepth.current && t.canUndo) setToastOpen(true);
    prevDepth.current = t.depth;
  }, [t.depth, t.canUndo]);

  // keyboard: Cmd/Ctrl+Z undo, Cmd/Ctrl+Shift+Z (or Ctrl+Y) redo
  useEffect(() => {
    const onKey = (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        t.undo();
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault();
        t.redo();
      }
    };
    window.addEventListener?.("keydown", onKey);
    return () => window.removeEventListener?.("keydown", onKey);
  }, [t]);

  // Pointer Events, not HTML5 drag-and-drop: the native DnD API has no
  // real touch support (iOS Safari never fires drag events for touch
  // input), so "hold to reorder" silently did nothing on phones.
  // Pointer Events unify mouse/touch/pen. Only the grip handle listens
  // (touch-action: none there) so a drag never fights normal list
  // scrolling — see TaskRow.
  const drag = {
    overIndex,
    start: (i) => (dragFrom.current = i),
    move: (clientX, clientY) => {
      if (dragFrom.current === null) return;
      const row = document.elementFromPoint(clientX, clientY)?.closest("[data-task-index]");
      if (!row) return;
      const idx = Number(row.dataset.taskIndex);
      if (!Number.isNaN(idx) && idx !== overIndex) setOverIndex(idx);
    },
    end: () => {
      if (dragFrom.current !== null && overIndex !== null && overIndex !== dragFrom.current)
        t.reorder(dragFrom.current, overIndex);
      dragFrom.current = null;
      setOverIndex(null);
    },
  };

  const allUnits = t.tasks.flatMap((x) => [x, ...x.subtasks]);
  const doneCount = allUnits.filter((u) => u.done).length;
  const parentDone = t.tasks.filter((x) => x.done).length;

  // filter/sort are display-only transforms of t.tasks — the stored
  // order (and progress totals above) always reflect the full list
  const toggleCategoryFilter = (id) =>
    setCategoryFilter((cs) => (cs.includes(id) ? cs.filter((c) => c !== id) : [...cs, id]));
  const toggleTagFilter = (tag) =>
    setTagFilter((ts) => (ts.includes(tag) ? ts.filter((x) => x !== tag) : [...ts, tag]));
  const clearFilters = () => {
    setCategoryFilter([]);
    setTagFilter([]);
  };

  const availableTags = useMemo(() => {
    const set = new Set();
    for (const tk of t.tasks) (tk.tags || []).forEach((tg) => tg && set.add(tg));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [t.tasks]);

  const filteredTasks = t.tasks.filter((tk) => {
    if (categoryFilter.length > 0 && !categoryFilter.includes(tk.category)) return false;
    if (tagFilter.length > 0 && !(tk.tags || []).some((tg) => tagFilter.includes(tg)))
      return false;
    return true;
  });

  const visibleTasks = (() => {
    switch (sortMode) {
      case "alpha":
        return [...filteredTasks].sort((a, b) => a.text.localeCompare(b.text));
      case "date":
        return [...filteredTasks].sort((a, b) => {
          const da = taskDeadlineMs(a), db = taskDeadlineMs(b);
          if (da == null && db == null) return 0;
          if (da == null) return 1;
          if (db == null) return -1;
          return da - db;
        });
      case "value":
        return [...filteredTasks].sort((a, b) => {
          const va = taskValueNumber(a), vb = taskValueNumber(b);
          if (va == null && vb == null) return 0;
          if (va == null) return 1;
          if (vb == null) return -1;
          return vb - va;
        });
      case "points":
        return [...filteredTasks].sort((a, b) => taskPointValue(b) - taskPointValue(a));
      default:
        return filteredTasks;
    }
  })();

  const dragEnabled =
    categoryFilter.length === 0 && tagFilter.length === 0 && sortMode === "manual";

  const toDraft = (task) => ({
    text: task.text,
    date: task.date,
    time: task.time,
    repeat: task.repeat,
    category: task.category || "",
    vehicleId: task.vehicleId || "",
    amount: task.amount || "",
    measureValue: task.measureValue || "",
    measureUnit: task.measureUnit || "",
    tags: Array.isArray(task.tags) ? [...task.tags] : [],
    side: task.side || "",
    marks: task.marks || 0,
    subtasks: task.subtasks.map((s) => ({ ...s })),
  });

  // ── backup: assemble everything for export. The panel decides how
  // to deliver it (file download, clipboard, or manual copy) since
  // sandboxed previews block programmatic downloads. Also the shape
  // synced to the cloud, one row per user (see useCloudSync).
  const buildBackup = useCallback(
    () => ({
      app: "twine",
      version: 1,
      exportedAt: nowISO(),
      state: { tasks: t.tasks, events: t.events, score: t.score },
      categories: cats.categories,
      vehicles: vehicles.vehicles,
      theme: {
        dark: theme.dark,
        accentIndex: theme.accentIndex,
        palette: theme.palette,
      },
    }),
    [
      t.tasks, t.events, t.score, cats.categories, vehicles.vehicles,
      theme.dark, theme.accentIndex, theme.palette,
    ]
  );

  // accepts a parsed backup object; returns true if applied
  const applyBackup = useCallback(
    (backup) => {
      const state = normalizeState(backup?.state ?? backup);
      if (!state) return false;
      t.resetTo(state);
      if (Array.isArray(backup?.categories)) {
        const clean = backup.categories.filter((c) => c && c.id && c.label);
        if (clean.length) cats.setAll(clean);
      }
      if (Array.isArray(backup?.vehicles)) {
        vehicles.setAll(backup.vehicles.filter((v) => v && v.id));
      }
      const th = normalizeTheme(backup?.theme);
      if (th) theme.setAll(th);
      return true;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // cloud sync is a no-op (status "idle") unless VITE_SUPABASE_* env vars
  // are set and the user is signed in — see src/lib/supabaseClient.js
  const cloudBackup = useMemo(() => buildBackup(), [buildBackup]);
  const syncStatus = useCloudSync(userId, cloudBackup, {
    applyBackup,
    ready: t.ready,
  });

  return (
    <CategoriesContext.Provider value={cats.categories}>
    <VehiclesContext.Provider value={vehicles.vehicles}>
    <div
      className={`app-bg min-h-screen px-4 py-10 ${theme.dark ? "theme-dark" : ""}`}
      style={{ "--accent": theme.accentValue, colorScheme: theme.dark ? "dark" : "light" }}
    >
      {/* token stylesheet — injected once, drives all theming */}
      <style>{THEME_CSS}</style>

      <div className="mx-auto max-w-md space-y-5">
        <header className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {/* braid mark: the two threads — Kairos (accent) and
                    Kronos (danger) — crossing into one */}
                <svg
                  width="26"
                  height="26"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M4 4C12 4 12 20 20 20"
                    stroke="var(--accent)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M20 4C12 4 12 20 4 20"
                    stroke="var(--danger)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </svg>
                <h1 className="txt-strong text-2xl font-bold tracking-tight">
                  Twine
                </h1>
              </div>
              <p className="txt-muted text-sm">
                Twin threads of time, intertwined.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {userId && (
                <SyncBadge status={syncStatus} onSignOut={() => supabase.auth.signOut()} />
              )}
              <ScoreBadge score={t.score} />
              <HistoryControls
                canUndo={t.canUndo}
                canRedo={t.canRedo}
                onUndo={t.undo}
                onRedo={t.redo}
              />
              <button
                onClick={() => setSettingsOpen(true)}
                aria-label="Open settings"
                className="card bd txt-muted hover-strong rounded-lg border p-1.5 transition"
              >
                <Settings size={15} />
              </button>
            </div>
          </div>
          <ViewSwitcher view={view} onChange={setView} />
        </header>

        <div className="surface bd space-y-4 rounded-2xl border p-4 shadow-sm">
          {!t.ready ? (
            <p className="txt-soft py-10 text-center text-sm">
              Weaving your threads…
            </p>
          ) : view === "list" ? (
            <>
              <ProgressBar done={doneCount} total={allUnits.length} />

              <FilterSortBar
                activeCategories={categoryFilter}
                onToggleCategory={toggleCategoryFilter}
                activeTags={tagFilter}
                onToggleTag={toggleTagFilter}
                availableTags={availableTags}
                onClearFilters={clearFilters}
                sortMode={sortMode}
                onSortMode={setSortMode}
              />

              {composing ? (
                <TaskComposer
                  submitLabel="Add task"
                  onSubmit={(draft) => {
                    t.add(draft);
                    setComposing(false);
                  }}
                  onCancel={() => setComposing(false)}
                  onAddCategoryTag={cats.addCategoryTag}
                  onAddVehicle={vehicles.add}
                />
              ) : (
                <button
                  onClick={() => setComposing(true)}
                  className="card bd-strong txt-muted hover-accent-bd hover-accent flex w-full items-center gap-2 rounded-xl border border-dashed px-3 py-2.5 text-sm font-medium transition"
                >
                  <Plus size={18} />
                  New task
                </button>
              )}

              <ul className="space-y-2">
                {visibleTasks.map((task, i) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    index={i}
                    ops={t}
                    drag={drag}
                    dragEnabled={dragEnabled}
                    onEdit={(tk) => setEditing(tk)}
                  />
                ))}
              </ul>

              {visibleTasks.length === 0 && !composing && (
                <p className="txt-soft py-6 text-center text-sm">
                  {t.tasks.length === 0
                    ? "Nothing here yet. Create your first task above."
                    : "No tasks match this filter."}
                </p>
              )}

              {parentDone > 0 && (
                <div className="bd flex justify-end border-t pt-3">
                  <button
                    onClick={t.clearDone}
                    className="txt-soft hover-danger flex items-center gap-1.5 text-xs font-medium transition"
                  >
                    <Trash2 size={13} />
                    Clear completed
                  </button>
                </div>
              )}
            </>
          ) : view === "calendar" ? (
            <CalendarView
              tasks={t.tasks}
              onEdit={(tk) => setEditing(tk)}
              onToggle={t.toggle}
            />
          ) : (
            <TimelineView events={t.events} />
          )}
        </div>
      </div>

      {editing && (
        <Modal onClose={() => setEditing(null)}>
          <TaskComposer
            initial={toDraft(editing)}
            submitLabel="Save changes"
            onSubmit={(draft) => {
              t.replace(editing.id, draft);
              setEditing(null);
            }}
            onCancel={() => setEditing(null)}
            onAddCategoryTag={cats.addCategoryTag}
            onAddVehicle={vehicles.add}
            timestamps={{
              createdAt: editing.createdAt,
              completedAt: editing.completedAt,
            }}
          />
        </Modal>
      )}

      {settingsOpen && (
        <Modal onClose={() => setSettingsOpen(false)}>
          <SettingsPanel
            theme={theme}
            categories={cats}
            vehicles={vehicles}
            onClose={() => setSettingsOpen(false)}
            onBuildBackup={buildBackup}
            onApplyBackup={applyBackup}
            onResetData={async () => {
              await storage.remove(STORAGE_KEY);
              await storage.remove(THEME_KEY);
              await storage.remove(CATEGORIES_KEY);
              await storage.remove(VEHICLES_KEY);
              t.resetTo(emptyState());
              cats.resetAll();
              vehicles.resetAll();
              theme.resetAll();
              setSettingsOpen(false);
            }}
          />
        </Modal>
      )}

      <UndoToast
        show={toastOpen && t.canUndo}
        label={t.undoLabel}
        onUndo={() => {
          t.undo();
          setToastOpen(false);
        }}
        onDismiss={() => setToastOpen(false)}
      />
    </div>
    </VehiclesContext.Provider>
    </CategoriesContext.Provider>
  );
}
