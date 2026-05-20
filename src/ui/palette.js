import { bus } from "../core/event-bus.js";
import { registry } from "../core/app-registry.js";
import { manager } from "../core/window-manager.js";
import { store } from "../core/state.js";
import { fs } from "../core/filesystem.js";
import { theme } from "../core/theme.js";
import { profiles } from "../core/profiles.js";
import { trapFocus } from "./focus-trap.js";

let el, input, listEl, items = [], idx = 0;
let releaseTrap = null;

export function initPalette() {
  el = document.createElement("section");
  el.id = "palette";
  el.className = "palette";
  el.hidden = true;
  el.innerHTML = `
    <div class="palette-backdrop"></div>
    <div class="palette-panel" role="dialog" aria-modal="true" aria-label="Command palette">
      <div class="palette-search">
        <span class="palette-icon">⌘</span>
        <input id="palette-input" type="search" placeholder="Type a command, app, file, or task…" autocomplete="off" spellcheck="false" />
        <kbd class="launcher-kbd">Esc</kbd>
      </div>
      <div class="palette-list" id="palette-list"></div>
      <div class="palette-foot">↑↓ navigate · ↵ run · Esc dismiss</div>
    </div>
  `;
  document.body.appendChild(el);
  input = el.querySelector("#palette-input");
  listEl = el.querySelector("#palette-list");

  el.querySelector(".palette-backdrop").addEventListener("click", close);
  input.addEventListener("input", () => { idx = 0; render(); });
  input.addEventListener("keydown", onKey);

  bus.on("palette-toggle", toggle);
  bus.on("palette-open", open);
  bus.on("escape", () => { if (!el.hidden) close(); });
}

function actions() {
  const apps = registry.all().map((a) => ({
    kind: "App", id: "app-" + a.id, label: a.name, sub: a.category, icon: a.icon || "▣",
    keywords: [a.name, a.category, ...(a.keywords || [])].join(" "),
    run: () => manager.open(a.id),
  }));

  const notes = store.get().notes.map((n) => ({
    kind: "Note", id: "note-" + n.id, label: n.title || "Untitled", sub: (n.body || "").slice(0, 60),
    icon: "📝", keywords: (n.title + " " + n.body),
    run: () => { manager.open("notes"); bus.emit("notes-select", { id: n.id }); },
  }));

  const tasks = store.get().tasks.map((t) => ({
    kind: t.done ? "Task ✓" : "Task", id: "task-" + t.id, label: t.text, sub: t.when || "",
    icon: t.done ? "☑" : "☐", keywords: t.text,
    run: () => manager.open("tasks"),
  }));

  const files = listAllFiles().map((f) => ({
    kind: "File", id: "file-" + f.path, label: f.path.split("/").pop(), sub: f.path,
    icon: "📄", keywords: f.path,
    run: () => fs.isDir(f.path)
      ? manager.open("files", { path: f.path })
      : (manager.open("notes"), bus.emit("notes-open-file", { path: f.path })),
  }));

  const cmds = [
    { kind: "Action", label: "Toggle theme", icon: "🌗", run: () => theme.setTheme(store.get().prefs.theme === "dark" ? "light" : "dark") },
    { kind: "Action", label: "Toggle reduce motion", icon: "🌀", run: () => theme.toggleReduceMotion() },
    { kind: "Action", label: "Toggle larger text", icon: "🔠", run: () => theme.toggleLargeText() },
    { kind: "Action", label: "Toggle sounds", icon: "🔈", run: () => { store.update((s) => { s.prefs.sounds = !s.prefs.sounds; }); } },
    { kind: "Action", label: "Toggle animated wallpaper", icon: "✨", run: () => { store.update((s) => { s.prefs.animatedWallpaper = !s.prefs.animatedWallpaper; }); bus.emit("theme-change", store.get().prefs); } },
    { kind: "Action", label: "Lock screen", icon: "🔒", run: () => bus.emit("lock") },
    { kind: "Action", label: "Open Settings", icon: "⚙", run: () => manager.open("settings") },
    { kind: "Action", label: "Change wallpaper…", icon: "🖼", run: () => manager.open("settings", { tab: "appearance" }) },
    { kind: "Action", label: "New note", icon: "📝", run: () => manager.open("notes", { newNote: true }) },
    { kind: "Action", label: "New file in Desktop", icon: "📄", run: () => { let n = "Untitled.txt", i = 1; while (fs.exists("/Desktop/" + n)) n = `Untitled ${++i}.txt`; fs.touch("/Desktop/" + n, ""); manager.open("files", { path: "/Desktop" }); } },
    { kind: "Action", label: "Reset NovaOS…", icon: "♻", run: () => { if (confirm("Wipe local data for this profile?")) { store.reset(); setTimeout(() => location.reload(), 200); } } },
  ].map((a, i) => ({ ...a, id: "cmd-" + i, sub: "Action", keywords: a.label }));

  return [...cmds, ...apps, ...files, ...notes, ...tasks];
}

function listAllFiles() {
  const out = [];
  const walk = (node, base) => {
    for (const child of Object.values(node.children || {})) {
      const p = base === "/" ? "/" + child.name : base + "/" + child.name;
      if (child.type === "dir") { out.push({ path: p }); walk(child, p); }
      else out.push({ path: p });
    }
  };
  walk(fs.root, "/");
  return out;
}

function render() {
  const q = input.value.trim().toLowerCase();
  const all = actions();
  items = q
    ? all.filter((a) => a.label.toLowerCase().includes(q) || (a.keywords || "").toLowerCase().includes(q) || (a.sub || "").toLowerCase().includes(q)).slice(0, 30)
    : all.slice(0, 12);
  idx = Math.min(idx, Math.max(0, items.length - 1));

  if (!items.length) {
    listEl.innerHTML = `<div class="palette-empty">No matches.</div>`;
    return;
  }
  listEl.innerHTML = items.map((it, i) => `
    <button class="palette-item ${i === idx ? "active" : ""}" data-i="${i}">
      <span class="pal-icon">${it.icon || "▢"}</span>
      <span class="pal-main">
        <span class="pal-label">${escape(it.label)}</span>
        ${it.sub ? `<span class="pal-sub">${escape(it.sub)}</span>` : ""}
      </span>
      <span class="pal-kind">${escape(it.kind)}</span>
    </button>
  `).join("");
  listEl.querySelectorAll(".palette-item").forEach((b) => {
    b.addEventListener("click", () => { idx = +b.dataset.i; run(); });
    b.addEventListener("mouseenter", () => { idx = +b.dataset.i; updateActive(); });
  });
  updateActive();
}

function updateActive() {
  listEl.querySelectorAll(".palette-item").forEach((b, i) => b.classList.toggle("active", i === idx));
  const active = listEl.querySelector(".palette-item.active");
  if (active) active.scrollIntoView({ block: "nearest" });
}

function onKey(e) {
  if (e.key === "ArrowDown") { e.preventDefault(); idx = Math.min(items.length - 1, idx + 1); updateActive(); }
  else if (e.key === "ArrowUp") { e.preventDefault(); idx = Math.max(0, idx - 1); updateActive(); }
  else if (e.key === "Enter") { e.preventDefault(); run(); }
}

function run() {
  const it = items[idx]; if (!it) return;
  close();
  try { it.run(); } catch (e) { console.error(e); }
}

function open() {
  el.hidden = false;
  input.value = "";
  idx = 0;
  render();
  setTimeout(() => input.focus(), 30);
  releaseTrap = trapFocus(el.querySelector(".palette-panel"));
}
function close() { el.hidden = true; releaseTrap?.(); releaseTrap = null; }
function toggle() { if (el.hidden) open(); else close(); }

function escape(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
