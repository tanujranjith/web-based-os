import { manager } from "./window-manager.js";
import { bus } from "./event-bus.js";

const isMac = navigator.platform.toUpperCase().includes("MAC");

export function installShortcuts() {
  document.addEventListener("keydown", (e) => {
    const mod = (isMac ? e.metaKey : e.ctrlKey) || (e.ctrlKey && !isMac);
    const k = e.key.toLowerCase();

    // Don't intercept when typing in inputs unless modifier-only shortcuts
    const tgt = e.target;
    const isInput = tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA" || tgt.isContentEditable);

    // Cmd/Ctrl + Space → launcher
    if (mod && e.code === "Space") {
      e.preventDefault();
      bus.emit("launcher-toggle");
      return;
    }

    if (k === "escape") {
      bus.emit("escape");
      return;
    }

    // From here on, allow inside inputs only with modifier
    if (isInput && !mod) return;

    if (mod && k === "w") {
      e.preventDefault();
      const f = manager.focused();
      if (f) manager.close(f);
      return;
    }
    if (mod && k === "m") {
      e.preventDefault();
      const f = manager.focused();
      if (f) manager.minimize(f);
      return;
    }
    if (mod && k === "n") {
      // delegate to focused window's app — fallback: open notes
      bus.emit("shortcut-new");
      return;
    }
    if (mod && k === ",") {
      e.preventDefault();
      bus.emit("open-app", { id: "settings" });
      return;
    }
    if (mod && k === "p") {
      e.preventDefault();
      bus.emit("launcher-toggle");
      return;
    }
    if (mod && k === "k") {
      e.preventDefault();
      bus.emit("palette-toggle");
      return;
    }
    if (mod && k === "l" && e.shiftKey) {
      e.preventDefault();
      bus.emit("lock");
      return;
    }

    // Alt+Tab — cycle through open windows
    if (e.altKey && k === "tab") {
      e.preventDefault();
      const list = manager.list();
      if (list.length < 2) return;
      const cur = manager.focused();
      const idx = list.findIndex((r) => r.id === cur);
      const next = list[(idx + 1) % list.length];
      manager.focus(next.id);
    }
  });
}
