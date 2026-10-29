import { store } from "../core/state.js";
import { fs } from "../core/filesystem.js";
import { registry } from "../core/app-registry.js";
import { manager } from "../core/window-manager.js";

const OS_NAME = "NovaOS";
const OS_VERSION = "4.0.0";
const CODENAME = "Orbit";

export default {
  id: "about",
  name: "About",
  icon: "ℹ",
  category: "System",
  defaultSize: { w: 540, h: 460 },
  keywords: ["info", "system", "credits", "version"],
  mount(container) {
    const el = document.createElement("div");
    el.className = "app about-app app-content";

    const ua = navigator.userAgent;
    const browser = detectBrowser(ua);
    const totals = fs.countAll("/");
    let storage = "—";
    try {
      storage =
        (new Blob([JSON.stringify(store.get())]).size / 1024).toFixed(1) +
        " KB";
    } catch {}
    const apps = registry.all().length;

    el.innerHTML = `
      <div class="hero">
        <div class="logo">N</div>
        <div>
          <h2>${OS_NAME}</h2>
          <div class="ver">Version ${OS_VERSION}</div>
          <div class="ver">${apps} built-in apps · local-first</div>
        </div>
      </div>
      <div class="about-grid">
        <div class="k">OS</div><div class="v">${OS_NAME}</div>
        <div class="k">Version</div><div class="v">${OS_VERSION}</div>
        <div class="k">Codename</div><div class="v">${CODENAME}</div>
        <div class="k">Browser</div><div class="v">${escape(browser)}</div>
        <div class="k">Platform</div><div class="v">${escape(navigator.platform || "—")}</div>
        <div class="k">Language</div><div class="v">${escape(navigator.language || "—")}</div>
        <div class="k">Display</div><div class="v">${window.innerWidth} × ${window.innerHeight}</div>
        <div class="k">Online</div><div class="v">${navigator.onLine ? "Connected" : "Offline"}</div>
        <div class="k">Files</div><div class="v">${totals.files} files in ${totals.dirs} folders</div>
        <div class="k">Storage used</div><div class="v">${storage}</div>
      </div>
      <div class="ver" style="margin-top:8px">A browser-based desktop environment. All data lives locally on your device — there is no backend.</div>
      <div class="actions">
        <button class="btn primary" data-act="settings">Open Settings</button>
        <button class="btn" data-act="terminal">Open Terminal</button>
        <button class="btn ghost" data-act="reset">Reset NovaOS…</button>
      </div>
    `;
    container.appendChild(el);

    el.querySelector('[data-act="settings"]').addEventListener("click", () =>
      manager.open("settings"),
    );
    el.querySelector('[data-act="terminal"]').addEventListener("click", () =>
      manager.open("terminal"),
    );
    el.querySelector('[data-act="reset"]').addEventListener("click", () => {
      if (confirm("This wipes all local data. Continue?")) {
        store.reset();
        store.flush().then(() => location.reload());
      }
    });

    return {
      unmount() {
        el.remove();
      },
    };
  },
};

function detectBrowser(ua) {
  if (/edg\//i.test(ua)) return "Microsoft Edge";
  if (/firefox/i.test(ua)) return "Firefox";
  if (/chrome/i.test(ua)) return "Chrome";
  if (/safari/i.test(ua)) return "Safari";
  return "Web";
}
function escape(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}
