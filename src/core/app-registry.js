const apps = new Map();

export const registry = {
  register(app) {
    if (!app?.id) throw new Error("app must have an id");
    apps.set(app.id, app);
  },
  get(id) { return apps.get(id); },
  all() { return Array.from(apps.values()); },
  byCategory() {
    const map = new Map();
    for (const a of apps.values()) {
      const c = a.category || "Apps";
      if (!map.has(c)) map.set(c, []);
      map.get(c).push(a);
    }
    return Array.from(map.entries()).map(([category, list]) => ({ category, apps: list }));
  },
};
