import { bus } from "./event-bus.js";
import { readProfile, writeProfile } from "./persistence.js";
import { profiles } from "./profiles.js";

const STORAGE_KEY = profiles.storageKey();

const defaultState = () => {
  const p = profiles.active();
  return {
    version: 1,
    user: { name: p.name, avatar: p.avatar },
    prefs: {
      theme: "dark",
      accent: "#a8c78d",
      wallpaper: "pebble",
      dockStyle: "floating",
      reduceMotion: false,
      largeText: false,
      animatedWallpaper: false,
      sounds: false,
    },
    windows: {},
    session: [],
    workspaceNames: ["Personal", "Studio", "Focus"],
    drafts: {},
    trash: [],
    layouts: [],
    focusHistory: [],
    recent: [],
    desktopShortcuts: ["files", "notes", "browser", "terminal", "settings"],
    quickNote: "",
    notifications: [],
    fs: null,
    notes: [],
    tasks: [],
    board: [],
    events: [],
    paint: [],
  };
};

let state;
let saveTimer;
let pending = Promise.resolve();
let status = "saved";
let revision = 0;
function save() {
  clearTimeout(saveTimer);
  const snapshot = structuredClone(state);
  const rev = ++revision;
  status = "saving";
  bus.emit("save-status", status);
  pending = pending
    .catch(() => {})
    .then(async () => {
      if (await writeProfile(STORAGE_KEY, snapshot)) {
        // Only a small recovery marker remains in Web Storage after migration.
        localStorage.removeItem(STORAGE_KEY);
      } else localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      if (rev === revision) {
        status = "saved";
        bus.emit("save-status", status);
      }
    })
    .catch((error) => {
      status = "error";
      bus.emit("save-status", status);
      bus.emit("notify", {
        title: "Save failed",
        body:
          "Your work is still open. Export a backup before closing. " +
          error.message,
      });
      throw error;
    });
  return pending;
}

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
    if (["__proto__", "prototype", "constructor"].includes(k)) continue;
    const v = src[k];
    if (
      v &&
      typeof v === "object" &&
      !Array.isArray(v) &&
      target[k] &&
      typeof target[k] === "object" &&
      !Array.isArray(target[k])
    ) {
      out[k] = deepMerge(target[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function scheduleSave() {
  clearTimeout(saveTimer);
  status = "pending";
  saveTimer = setTimeout(() => {
    save().catch(() => {});
  }, 180);
}

state = load();

export const store = {
  get() {
    return state;
  },
  get status() {
    return status;
  },
  ready: null,
  get state() {
    return state;
  },

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

  /** Validate and restore an older or current backup into the active profile. */
  async restore(snapshot) {
    await store.ready;
    if (
      !snapshot ||
      typeof snapshot !== "object" ||
      Array.isArray(snapshot) ||
      snapshot.version !== 1
    )
      throw new Error("This is not a supported NovaOS backup.");
    for (const key of [
      "notes",
      "tasks",
      "board",
      "events",
      "desktopShortcuts",
      "recent",
      "notifications",
      "trash",
      "session",
      "layouts",
    ]) {
      if (snapshot[key] !== undefined && !Array.isArray(snapshot[key]))
        throw new Error(`Invalid backup field: ${key}`);
    }
    if (
      snapshot.prefs &&
      (typeof snapshot.prefs !== "object" || Array.isArray(snapshot.prefs))
    )
      throw new Error("Invalid preferences in backup.");
    validateSnapshot(snapshot);
    const next = deepMerge(defaultState(), snapshot);
    await pending.catch(() => {});
    // Persist before replacing the live state, so a full disk leaves it intact.
    if (!(await writeProfile(STORAGE_KEY, next)))
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    clearTimeout(saveTimer);
    state = next;
    bus.emit("state-change", state);
  },

  /** Wipe all persisted data for the active profile */
  reset() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    state = defaultState();
    bus.emit("state-reset", state);
    bus.emit("state-change", state);
    scheduleSave();
  },

  flush() {
    return save();
  },
};
store.ready = (async () => {
  try {
    const saved = await readProfile(STORAGE_KEY);
    if (saved) state = deepMerge(defaultState(), saved);
    else await save();
  } catch (error) {
    store.loadError = error;
    status = "error";
    console.error("[storage]", error);
  }
})();
window.addEventListener("pagehide", () => {
  store.flush().catch(() => {});
});
window.addEventListener("beforeunload", (event) => {
  if (status !== "saved") {
    store.flush().catch(() => {});
    event.preventDefault();
    event.returnValue = "";
  }
});

function validateSnapshot(snapshot) {
  for (const [key, fields] of [
    ["notes", ["id", "title", "body"]],
    ["tasks", ["id", "text"]],
    ["events", ["id", "title", "date"]],
  ]) {
    if (
      snapshot[key]?.some(
        (record) =>
          !record || fields.some((field) => typeof record[field] !== "string"),
      )
    )
      throw new Error("Invalid " + key + " records in backup.");
  }
  if (
    snapshot.user &&
    (typeof snapshot.user.name !== "string" ||
      typeof snapshot.user.avatar !== "string")
  )
    throw new Error("Invalid profile in backup.");
  if (
    snapshot.workspaceNames &&
    (!Array.isArray(snapshot.workspaceNames) ||
      snapshot.workspaceNames.length !== 3 ||
      snapshot.workspaceNames.some((x) => typeof x !== "string"))
  )
    throw new Error("Invalid workspaces in backup.");
  if (
    snapshot.prefs?.theme &&
    !["dark", "light", "system"].includes(snapshot.prefs.theme)
  )
    throw new Error("Invalid appearance in backup.");
  if (snapshot.prefs?.accent && !/^#[a-f0-9]{6}$/i.test(snapshot.prefs.accent))
    throw new Error("Invalid accent color.");
  const validateNode = (node, depth = 0) => {
    if (
      depth > 80 ||
      !node ||
      !["file", "dir"].includes(node.type) ||
      typeof node.name !== "string"
    )
      throw new Error("Invalid file tree in backup.");
    if (node.type === "dir") {
      if (
        !node.children ||
        typeof node.children !== "object" ||
        Array.isArray(node.children)
      )
        throw new Error("Invalid folder.");
      for (const [key, child] of Object.entries(node.children)) {
        if (
          ["__proto__", "constructor", "prototype", ".", ".."].includes(key) ||
          key.includes("/")
        )
          throw new Error("Invalid filename.");
        validateNode(child, depth + 1);
      }
    } else if (typeof node.content !== "string")
      throw new Error("Invalid file contents.");
  };
  if (snapshot.fs) validateNode(snapshot.fs);
  if (
    snapshot.session?.some(
      (r) =>
        !r ||
        typeof r.appId !== "string" ||
        !r.state ||
        ["x", "y", "w", "h"].some((k) => !Number.isFinite(r.state[k])),
    )
  )
    throw new Error("Invalid window session.");
}
