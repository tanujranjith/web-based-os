/**
 * Multi-profile support. Each profile has its own namespaced localStorage key
 * (`novaos:v1:<id>`). A separate index key (`novaos:profiles`) stores the list
 * of profiles, the active profile id, lock state, and optional PIN.
 */

const INDEX_KEY = "novaos:profiles";

const defaultIndex = () => {
  const id = uid();
  return {
    activeId: id,
    locked: false,
    profiles: [
      { id, name: "Friend", avatar: "🙂", pin: "", createdAt: Date.now() },
    ],
  };
};

function load() {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) {
      // Migrate from legacy single-user setup if present
      const legacy = localStorage.getItem("novaos:v1");
      const fresh = defaultIndex();
      if (legacy) {
        try {
          const parsed = JSON.parse(legacy);
          if (parsed?.user?.name) fresh.profiles[0].name = parsed.user.name;
          if (parsed?.user?.avatar) fresh.profiles[0].avatar = parsed.user.avatar;
          localStorage.setItem(`novaos:v1:${fresh.profiles[0].id}`, legacy);
        } catch {}
      }
      localStorage.setItem(INDEX_KEY, JSON.stringify(fresh));
      return fresh;
    }
    return JSON.parse(raw);
  } catch {
    const fresh = defaultIndex();
    localStorage.setItem(INDEX_KEY, JSON.stringify(fresh));
    return fresh;
  }
}

function save(index) {
  try { localStorage.setItem(INDEX_KEY, JSON.stringify(index)); } catch {}
}

function uid() { return Math.random().toString(36).slice(2, 10); }

let index = load();

export const profiles = {
  index() { return index; },
  list() { return index.profiles.slice(); },
  active() { return index.profiles.find((p) => p.id === index.activeId) || index.profiles[0]; },
  storageKey() { return `novaos:v1:${index.activeId}`; },
  isLocked() { return !!index.locked; },

  switchTo(id) {
    if (!index.profiles.some((p) => p.id === id)) return false;
    index.activeId = id;
    index.locked = true;
    save(index);
    location.reload();
    return true;
  },

  create({ name = "New User", avatar = "🙂", pin = "" } = {}) {
    const id = uid();
    index.profiles.push({ id, name, avatar, pin, createdAt: Date.now() });
    save(index);
    return id;
  },

  rename(id, name) {
    const p = index.profiles.find((x) => x.id === id);
    if (p) { p.name = name; save(index); }
  },

  setAvatar(id, avatar) {
    const p = index.profiles.find((x) => x.id === id);
    if (p) { p.avatar = avatar; save(index); }
  },

  setPin(id, pin) {
    const p = index.profiles.find((x) => x.id === id);
    if (p) { p.pin = String(pin || ""); save(index); }
  },

  remove(id) {
    if (index.profiles.length <= 1) return false;
    index.profiles = index.profiles.filter((p) => p.id !== id);
    if (index.activeId === id) index.activeId = index.profiles[0].id;
    try { localStorage.removeItem(`novaos:v1:${id}`); } catch {}
    save(index);
    return true;
  },

  lock() {
    index.locked = true;
    save(index);
  },
  unlock(pin) {
    const active = this.active();
    if (active.pin && active.pin !== String(pin || "")) return false;
    index.locked = false;
    save(index);
    return true;
  },
};
