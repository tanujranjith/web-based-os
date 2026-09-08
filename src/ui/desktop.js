import { registry } from "../core/app-registry.js";
import { manager } from "../core/window-manager.js";
import { store } from "../core/state.js";
import { bus } from "../core/event-bus.js";
import { contextMenu } from "./context-menu.js";
import { onLongPress } from "./focus-trap.js";
import { fs } from "../core/filesystem.js";

let iconsEl, widgetsEl;
let selectedIcon = null;

export function initDesktop() {
  iconsEl = document.getElementById("desktop-icons");
  widgetsEl = document.getElementById("desktop-widgets");

  renderIcons();
  renderWidgets();

  const desktopEl = document.getElementById("desktop");
  desktopEl.addEventListener("contextmenu", onDesktopContext);
  desktopEl.addEventListener("click", (e) => {
    if (e.target.closest(".desktop-icon")) return;
    deselect();
  });
  // Long-press → context menu on touch
  onLongPress(desktopEl, (x, y) => {
    onDesktopContext({ preventDefault() {}, clientX: x, clientY: y, target: document.elementFromPoint(x, y) || desktopEl });
  });

  let lastShortcuts = store.get().desktopShortcuts.join(",");
  bus.on("state-change", () => {
    const cur = store.get().desktopShortcuts.join(",");
    if (cur !== lastShortcuts) { lastShortcuts = cur; renderIcons(); }
  });
  bus.on("dock-context", ({ app, x, y }) => {
    contextMenu.open(x, y, dockMenuItems(app));
  });

}

function renderIcons() {
  const ids = store.get().desktopShortcuts;
  iconsEl.innerHTML = "";
  for (const id of ids) {
    const a = registry.get(id);
    if (!a) continue;
    const el = document.createElement("button");
    el.className = "desktop-icon";
    el.dataset.app = id;
    el.innerHTML = `<span class="desktop-icon-glyph">${a.icon || "▣"}</span><span class="desktop-icon-label">${escape(a.name)}</span>`;
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      if (selectedIcon === id) { manager.open(id); deselect(); }
      else { select(id, el); }
    });
    el.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      manager.open(id);
    });
    el.addEventListener("contextmenu", (e) => {
      e.preventDefault(); e.stopPropagation();
      contextMenu.open(e.clientX, e.clientY, [
        { label: "Open", action: () => manager.open(id) },
        { label: "Remove from Desktop", action: () => {
          store.update((s) => { s.desktopShortcuts = s.desktopShortcuts.filter((x) => x !== id); });
        }},
      ]);
    });
    iconsEl.appendChild(el);
  }
}

function select(id, el) {
  deselect();
  selectedIcon = id;
  el.classList.add("selected");
}
function deselect() {
  if (!selectedIcon) return;
  selectedIcon = null;
  iconsEl.querySelectorAll(".desktop-icon.selected").forEach((e) => e.classList.remove("selected"));
}

function onDesktopContext(e) {
  if (e.target.closest(".desktop-icon, .globe-handle")) return;
  e.preventDefault();
  contextMenu.open(e.clientX, e.clientY, [
    { label: "Open Launcher", shortcut: "Ctrl/⌘ Space", action: () => bus.emit("launcher-open") },
    { label: "New Note", shortcut: "Ctrl/⌘ N", action: () => manager.open("notes", { newNote: true }) },
    { label: "New Folder on Desktop", action: () => createDesktopFolder() },
    { sep: true },
    { label: "Open Settings", shortcut: "Ctrl/⌘ ,", action: () => manager.open("settings") },
    { label: "Change Wallpaper", action: () => manager.open("settings", { tab: "appearance" }) },
    { sep: true },
    { label: "Refresh", action: () => { renderIcons(); bus.emit('desktop-refresh'); } },
  ]);
}

function createDesktopFolder() {
  let name = "New Folder", i = 1;
  while (fs.exists("/Desktop/" + name)) name = `New Folder ${++i}`;
  fs.mkdir("/Desktop/" + name);
  bus.emit("notify", { title: "Folder created", body: `Created '${name}' on Desktop` });
}

function dockMenuItems(app) {
  const pinned = store.get().desktopShortcuts.includes(app.id);
  return [
    { label: "Open", action: () => manager.open(app.id) },
    { label: manager.has(app.id) ? "Minimize" : "Open", action: () => manager.has(app.id) ? manager.minimize(app.id) : manager.open(app.id) },
    { sep: true },
    { label: pinned ? "Unpin from Dock" : "Pin to Dock", action: () => {
      store.update((s) => {
        s.desktopShortcuts = pinned ? s.desktopShortcuts.filter((x) => x !== app.id) : [...s.desktopShortcuts, app.id];
      });
    }},
    { label: manager.has(app.id) ? "Close" : "", action: () => manager.close(app.id), disabled: !manager.has(app.id) },
  ].filter((i) => i.label !== "");
}

/* ---- Widgets ---- */

function renderWidgets() {
  widgetsEl.innerHTML = "";
  widgetsEl.appendChild(quickNoteWidget());
}


function quickNoteWidget() {
  const el = document.createElement("div");
  el.className = "widget widget-quick-note";
  el.innerHTML = `<h3>Quick note</h3><textarea placeholder="Jot something quickly…"></textarea>`;
  const ta = el.querySelector("textarea");
  ta.value = store.get().quickNote || "";
  ta.addEventListener("input", () => {
    store.update((s) => { s.quickNote = ta.value; });
  });
  return el;
}

function escape(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
