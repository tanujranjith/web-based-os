import { store } from "./state.js";
import { bus } from "./event-bus.js";

export const wallpapers = {
  aurora: {
    name: "Aurora",
    css: "radial-gradient(1100px 700px at 25% 30%, #6f86ff 0%, transparent 60%), radial-gradient(900px 600px at 80% 70%, #c47cff 0%, transparent 55%), linear-gradient(160deg, #0e1530 0%, #19082a 100%)",
  },
  midnight: {
    name: "Midnight",
    css: "radial-gradient(900px 600px at 30% 20%, #1a2752 0%, transparent 60%), linear-gradient(160deg, #050813 0%, #0a0f1f 100%)",
  },
  sunrise: {
    name: "Sunrise",
    css: "linear-gradient(180deg, #f6d365 0%, #fda085 50%, #ef6f8c 100%)",
  },
  forest: {
    name: "Forest",
    css: "radial-gradient(800px 500px at 70% 30%, #3e8e64 0%, transparent 55%), linear-gradient(160deg, #0c1a14 0%, #14302a 100%)",
  },
  pebble: {
    name: "Pebble",
    css: "linear-gradient(160deg, #2c2f3a 0%, #1a1c24 100%)",
  },
  ocean: {
    name: "Ocean",
    css: "radial-gradient(900px 500px at 20% 30%, #006c7a 0%, transparent 60%), linear-gradient(160deg, #001b24 0%, #002b3a 100%)",
  },
  paper: {
    name: "Paper",
    css: "radial-gradient(800px 500px at 30% 20%, #ffffff 0%, transparent 55%), linear-gradient(160deg, #e9e7df 0%, #d6d2c4 100%)",
  },
};

export const accents = [
  "#5b8def", "#7c5cff", "#ff5c8a", "#ff8a3d",
  "#22c55e", "#0ea5b7", "#eab308", "#a3a3a3",
];

function isDarkPrefers() { return window.matchMedia("(prefers-color-scheme: dark)").matches; }

export const theme = {
  apply() {
    const { prefs } = store.get();
    const themeMode = prefs.theme === "system" ? (isDarkPrefers() ? "dark" : "light") : prefs.theme;
    document.documentElement.dataset.theme = themeMode;
    document.documentElement.dataset.reduceMotion = String(!!prefs.reduceMotion);
    document.documentElement.style.setProperty("--accent", prefs.accent);
    document.documentElement.style.setProperty("--accent-strong", shade(prefs.accent, -10));
    document.documentElement.style.setProperty("--text-scale", prefs.largeText ? "1.12" : "1");

    const wp = wallpapers[prefs.wallpaper] || wallpapers.aurora;
    const wpEl = document.getElementById("wallpaper");
    if (wpEl) wpEl.style.background = wp.css;

    const dock = document.getElementById("dock");
    if (dock) dock.dataset.style = prefs.dockStyle || "floating";
    bus.emit("theme-change", prefs);
  },
  setTheme(mode) { store.update((s) => { s.prefs.theme = mode; }); this.apply(); },
  setAccent(c) { store.update((s) => { s.prefs.accent = c; }); this.apply(); },
  setWallpaper(key) { store.update((s) => { s.prefs.wallpaper = key; }); this.apply(); },
  setDockStyle(s) { store.update((st) => { st.prefs.dockStyle = s; }); this.apply(); },
  toggleReduceMotion() { store.update((s) => { s.prefs.reduceMotion = !s.prefs.reduceMotion; }); this.apply(); },
  toggleLargeText() { store.update((s) => { s.prefs.largeText = !s.prefs.largeText; }); this.apply(); },
};

function shade(hex, pct) {
  const c = hex.replace("#", "");
  if (c.length !== 6) return hex;
  const num = parseInt(c, 16);
  const amt = Math.round(2.55 * pct);
  const r = Math.max(0, Math.min(255, (num >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (num & 0xff) + amt));
  return "#" + ((r << 16) | (g << 8) | b).toString(16).padStart(6, "0");
}

window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (store.get().prefs.theme === "system") theme.apply();
});
