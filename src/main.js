import { migrateBoard } from "./core/tasks.js";
import { initWorkspaceTools } from "./ui/workspace-tools.js";
import { store } from "./core/state.js";
import { fs } from "./core/filesystem.js";
import { registry } from "./core/app-registry.js";
import { manager } from "./core/window-manager.js";
import { theme } from "./core/theme.js";
import { installShortcuts } from "./core/shortcuts.js";
import { bus } from "./core/event-bus.js";
import { profiles } from "./core/profiles.js";
import { animatedWallpaper } from "./core/animated-wallpaper.js";
import { sound } from "./core/sound.js";
import { installIcons } from "./ui/icons.js";
import { initOrbit } from "./ui/orbit.js";
import Board from "./apps/board.js";
import Calendar from "./apps/calendar.js";
import Studio from "./apps/studio.js";
import { initDesktopPlus } from "./ui/desktop-plus.js";

import { initDesktop } from "./ui/desktop.js";
import { initDock } from "./ui/dock.js";
import { initLauncher } from "./ui/launcher.js";
import { initNotifications, notify } from "./ui/notifications.js";
import { initPalette } from "./ui/palette.js";
import { lockScreen } from "./ui/lock-screen.js";

import Files from "./apps/files.js";
import Notes from "./apps/notes.js";
import Browser from "./apps/browser.js";
import Terminal from "./apps/terminal.js";
import Settings from "./apps/settings.js";
import Tasks from "./apps/tasks.js";
import About from "./apps/about.js";
import Calculator from "./apps/calculator.js";
import Clock from "./apps/clock.js";
import Pomodoro from "./apps/focus.js";
import CodeEditor from "./apps/code-editor.js";
import Markdown from "./apps/markdown.js";
import ImageViewer from "./apps/image-viewer.js";
import Paint from "./apps/paint.js";
import PdfViewer from "./apps/pdf-viewer.js";
import Camera from "./apps/camera.js";
import Music from "./apps/music.js";
import Snake from "./apps/snake.js";
import Game2048 from "./apps/game-2048.js";
import Minesweeper from "./apps/minesweeper.js";

[
  Files,
  Notes,
  Browser,
  Terminal,
  Settings,
  Tasks,
  About,
  Calculator,
  Clock,
  Pomodoro,
  CodeEditor,
  Markdown,
  ImageViewer,
  Paint,
  PdfViewer,
  Camera,
  Music,
  Snake,
  Game2048,
  Minesweeper,
  Board,
  Calendar,
  Studio,
].forEach((a) => registry.register(a));
installIcons(registry);

bus.on("open-app", ({ id, opts }) => manager.open(id, opts));

// Apply theme synchronously and tolerate failure
try {
  theme.apply();
} catch (e) {
  console.error("[theme] apply failed", e);
}

let booted = false;
function hideBoot() {
  const bootEl = document.getElementById("boot-screen");
  const osEl = document.getElementById("os");
  if (osEl) osEl.hidden = false;
  if (bootEl) {
    bootEl.classList.add("hide");
    setTimeout(() => {
      try {
        bootEl.remove();
      } catch {}
    }, 500);
  }
}

function showBootError(msg) {
  const bootEl = document.getElementById("boot-screen");
  if (!bootEl) return;
  const existing = bootEl.querySelector(".boot-error");
  if (existing) existing.remove();
  const box = document.createElement("div");
  box.className = "boot-error";
  box.style.cssText =
    "max-width:520px;margin:14px auto 0;padding:10px 14px;border-radius:10px;background:#3a1a23;border:1px solid #ff8a8a44;color:#ffd0d0;font-size:12px;text-align:left;font-family:ui-monospace,monospace;white-space:pre-wrap;word-break:break-word";
  box.textContent = msg;
  bootEl.appendChild(box);
}

function safeInit(name, fn) {
  try {
    fn();
    return true;
  } catch (e) {
    console.error(`[${name}] init failed:`, e);
    showBootError(`Init "${name}" failed: ${e?.message || e}`);
    return false;
  }
}

async function boot() {
  if (booted) return;
  booted = true;
  await store.ready;
  if (store.loadError) {
    showBootError(
      "Storage could not be opened. Your saved data has not been replaced. Close other NovaOS tabs and try again. Recovery tools: clear.html",
    );
    return;
  }
  fs.init();
  migrateBoard();
  theme.apply();

  safeInit("desktop", initDesktop);
  safeInit("dock", initDock);
  safeInit("launcher", initLauncher);
  safeInit("notifications", initNotifications);
  safeInit("palette", initPalette);
  safeInit("shortcuts", installShortcuts);
  safeInit("orbit", initOrbit);
  safeInit("desktop-plus", initDesktopPlus);
  safeInit("workspace-tools", initWorkspaceTools);
  safeInit("animatedWallpaper", () => animatedWallpaper.apply());
  safeInit("lockScreen", () => lockScreen.showIfLocked());

  manager.restoreSession();
  hideBoot();

  try {
    sound.boot();
  } catch {}

  if (!localStorage.getItem("novaos:welcomed")) {
    setTimeout(() => {
      try {
        notify({
          title: "Welcome to NovaOS",
          body: "Press Ctrl/⌘ Space for the launcher · Ctrl/⌘ K for the command palette.",
        });
        localStorage.setItem("novaos:welcomed", "1");
      } catch {}
    }, 800);
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("./sw.js")
      .then((reg) => {
        const offerUpdate = () => {
          if (!reg.waiting) return;
          const button = document.createElement("button");
          button.className = "update-prompt btn";
          button.textContent = "NovaOS update available · Restart";
          button.onclick = async () => {
            if (!confirm("Save your work and restart to install this update?"))
              return;
            await store.flush();
            sessionStorage.setItem("novaos-updating", "1");
            reg.waiting.postMessage({ type: "ACTIVATE" });
          };
          document.body.appendChild(button);
        };
        offerUpdate();
        reg.addEventListener("updatefound", () =>
          reg.installing?.addEventListener("statechange", offerUpdate),
        );
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (
            navigator.serviceWorker.controller &&
            sessionStorage.getItem("novaos-updating")
          ) {
            sessionStorage.removeItem("novaos-updating");
            location.reload();
          }
        });
      })
      .catch(() => {});
  }

  window.addEventListener("error", (e) => {
    console.error(e.error || e.message);
    try {
      notify({
        title: "Something went wrong",
        body: e.message || "An error occurred.",
      });
    } catch {}
  });
  window.addEventListener("unhandledrejection", (e) => {
    console.error(e.reason);
    try {
      notify({
        title: "Unhandled error",
        body: String(e.reason?.message || e.reason || "").slice(0, 120),
      });
    } catch {}
  });
}

// Surface any fatal load-time error inside the boot overlay
window.addEventListener("error", (e) => {
  if (!booted)
    showBootError(
      `${e.message || e.error}\n${e.filename ? "  at " + e.filename + ":" + e.lineno : ""}`,
    );
});

// Hard fallback: never leave the boot screen up for more than 5 seconds
setTimeout(() => {
  if (!booted) {
    console.warn("[boot] forced fallback: boot() didn't complete in time");
    showBootError(
      "Boot didn't complete in 5s. Forcing OS shell to show. Open DevTools console for details.",
    );
    try {
      boot();
    } catch (e) {
      console.error(e);
    }
    hideBoot();
  }
}, 5000);

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => setTimeout(boot, 250));
} else {
  setTimeout(boot, 250);
}

window.NovaOS = {
  store,
  fs,
  registry,
  manager,
  theme,
  bus,
  notify,
  profiles,
  lockScreen,
};
