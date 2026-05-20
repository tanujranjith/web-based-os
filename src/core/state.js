import { bus } from "./event-bus.js";

const STORAGE_KEY = "novaos:v1";

const defaultState = () => ({
  version: 1,
  user: { name: "Friend", avatar: "🙂" },
  prefs: {
    theme: "dark",                // 'dark' | 'light' | 'system'
    accent: "#5b8def",
    wallpaper: "aurora",
    dockStyle: "floating",        // 'floating' | 'bar'
    reduceMotion: false,
    largeText: false,
  },
  windows: {},                    // appId -> { x, y, w, h, maximized }
  recent: [],
  desktopShortcuts: ["files", "notes", "browser", "terminal", "settings"],
  quickNote: "",
  notifications: [],
  fs: null,                       // populated by filesystem module
  notes: [],
  tasks: [],
});

let state;
let saveTimer;

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return deepMerge(defaultState(), parsed);
  } catch (e) {
    console.warn("[state] corrupted localStorage, resetting", e);
    return defaultState();
  }
}

function deepMerge(target, src) {
  if (!src || typeof src !== "object") return target;
  const out = Array.isArray(target) ? [...target] : { ...target };
  for (const k of Object.keys(src)) {
    const v = src[k];
    if (v && typeof v === "object" && !Array.isArray(v) && target[k] && typeof target[k] === "object" && !Array.isArray(target[k])) {
      out[k] = deepMerge(target[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error("[state] save failed (storage full?)", e);
      bus.emit("notify", { title: "Storage error", body: "Couldn't save state. Local storage may be full." });
    }
  }, 80);
}

state = load();

export const store = {
  get() { return state; },
  get state() { return state; },

  /** Update via mutator function; emits 'state-change' and persists */
  update(mutator) {
    mutator(state);
    scheduleSave();
    bus.emit("state-change", state);
  },

  /** Replace a top-level key */
  set(key, value) {
    state[key] = value;
    scheduleSave();
    bus.emit("state-change", state);
  },

  /** Wipe all persisted data */
  reset() {
    localStorage.removeItem(STORAGE_KEY);
    state = defaultState();
    bus.emit("state-reset", state);
    bus.emit("state-change", state);
  },

  flush() {
    clearTimeout(saveTimer);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  },
};

// Save on page hide so nothing is lost
window.addEventListener("beforeunload", () => store.flush());
window.addEventListener("pagehide", () => store.flush());
