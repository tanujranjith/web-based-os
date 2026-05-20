import { store } from "./core/state.js";
import { fs } from "./core/filesystem.js";
import { registry } from "./core/app-registry.js";
import { manager } from "./core/window-manager.js";
import { theme } from "./core/theme.js";
import { installShortcuts } from "./core/shortcuts.js";
import { bus } from "./core/event-bus.js";

import { initDesktop } from "./ui/desktop.js";
import { initDock } from "./ui/dock.js";
import { initLauncher } from "./ui/launcher.js";
import { initNotifications, notify } from "./ui/notifications.js";

import Files from "./apps/files.js";
import Notes from "./apps/notes.js";
import Browser from "./apps/browser.js";
import Terminal from "./apps/terminal.js";
import Settings from "./apps/settings.js";
import Tasks from "./apps/tasks.js";
import About from "./apps/about.js";

[Files, Notes, Browser, Terminal, Settings, Tasks, About].forEach((a) => registry.register(a));

// Forward open-app events
bus.on("open-app", ({ id, opts }) => manager.open(id, opts));

// Apply theme before showing OS
theme.apply();

function boot() {
  initDesktop();
  initDock();
  initLauncher();
  initNotifications();
  installShortcuts();

  // Reveal OS
  const boot = document.getElementById("boot-screen");
  const osEl = document.getElementById("os");
  osEl.hidden = false;
  boot.classList.add("hide");
  setTimeout(() => boot.remove(), 400);

  // First-run welcome
  if (!localStorage.getItem("novaos:welcomed")) {
    setTimeout(() => {
      notify({ title: "Welcome to NovaOS", body: "Press Ctrl/⌘ Space to open the launcher." });
      localStorage.setItem("novaos:welcomed", "1");
    }, 800);
  }

  // Surface error to the user instead of dying silently
  window.addEventListener("error", (e) => {
    console.error(e.error || e.message);
    notify({ title: "Something went wrong", body: e.message || "An error occurred." });
  });
  window.addEventListener("unhandledrejection", (e) => {
    console.error(e.reason);
    notify({ title: "Unhandled error", body: String(e.reason?.message || e.reason || "").slice(0, 120) });
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => setTimeout(boot, 350));
} else {
  setTimeout(boot, 350);
}

// Expose for debugging / power users
window.NovaOS = { store, fs, registry, manager, theme, bus, notify };
