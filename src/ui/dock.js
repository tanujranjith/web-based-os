import { registry } from "../core/app-registry.js";
import { manager } from "../core/window-manager.js";
import { bus } from "../core/event-bus.js";
import { store } from "../core/state.js";

let pinnedEl, runningEl, timeEl, dateEl, netEl, batEl;

export function initDock() {
  pinnedEl = document.getElementById("dock-pinned");
  runningEl = document.getElementById("dock-running");
  timeEl = document.getElementById("tray-time");
  dateEl = document.getElementById("tray-date");
  netEl = document.getElementById("tray-net");
  batEl = document.getElementById("tray-battery");

  document
    .getElementById("tray-clock")
    .addEventListener("click", () => manager.open("clock"));

  setupNetwork();
  setupBattery();

  renderPinned();
  renderRunning();

  bus.on("window-open", renderRunning);
  bus.on("window-close", renderRunning);
  bus.on("window-focus", renderRunning);
  bus.on("window-minimize", renderRunning);
  bus.on("window-restore", renderRunning);

  let lastShortcuts = store.get().desktopShortcuts.join(",");
  bus.on("state-change", () => {
    const cur = store.get().desktopShortcuts.join(",");
    if (cur !== lastShortcuts) {
      lastShortcuts = cur;
      renderPinned();
      renderRunning();
    }
  });

  tickClock();
  setInterval(tickClock, 1000 * 15);
}

function renderPinned() {
  const ids = store.get().desktopShortcuts;
  pinnedEl.innerHTML = "";
  for (const id of ids) {
    const a = registry.get(id);
    if (!a) continue;
    pinnedEl.appendChild(makeDockItem(a));
  }
}

function renderRunning() {
  const running = manager.list();
  const pinned = new Set(store.get().desktopShortcuts);
  // Show indicator on pinned dock items for running apps
  pinnedEl.querySelectorAll(".dock-item").forEach((item) => {
    const id = item.dataset.app;
    const isRunning = running.some((r) => r.app.id === id);
    item.classList.toggle("running", isRunning);
    const focusedId = manager.focused();
    item.classList.toggle(
      "focused",
      running.find((r) => r.id === focusedId)?.app.id === id,
    );
  });

  // Running but not pinned
  runningEl.innerHTML = "";
  for (const rec of running.filter(
    (r, i, a) => a.findIndex((x) => x.app.id === r.app.id) === i,
  )) {
    if (pinned.has(rec.app.id)) continue;
    const item = makeDockItem(rec.app);
    item.classList.add("running");
    if (manager.focused() === rec.id) item.classList.add("focused");
    runningEl.appendChild(item);
  }
}

function makeDockItem(app) {
  const btn = document.createElement("button");
  btn.className = "dock-item";
  btn.dataset.app = app.id;
  btn.setAttribute("aria-label", app.name);
  btn.innerHTML = `<span class="g">${app.icon || "▣"}</span><span class="tooltip">${escape(app.name)}</span><span class="dock-indicator"></span>`;
  btn.addEventListener("click", (e) => {
    if (e.shiftKey) {
      manager.open(app.id, { newWindow: true });
      return;
    }
    if (manager.has(app.id)) {
      const focused = manager.focused();
      if (
        focused === app.id &&
        !manager.list().find((r) => r.app.id === app.id)?.state.minimized
      )
        manager.minimize(app.id);
      else manager.focus(app.id);
    } else {
      manager.open(app.id);
    }
  });
  btn.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    bus.emit("dock-context", { app, x: e.clientX, y: e.clientY });
  });
  let hoverTimer;
  btn.addEventListener("pointerenter", () => {
    hoverTimer = setTimeout(() => {
      document.querySelector(".dock-previews")?.remove();
      const records = manager
        .list()
        .filter((r) => r.app.id === app.id && !r.closing);
      if (!records.length) return;
      const panel = document.createElement("div");
      panel.className = "dock-previews";
      panel.innerHTML = records
        .map(
          (r) =>
            `<button data-window="${escape(r.id)}"><span>${app.icon}</span><strong>${escape(r.el.querySelector(".window-title-text").textContent)}</strong><small>${escape(store.get().workspaceNames[r.state.workspace])} · ${r.state.minimized ? "Minimized" : "Open"}</small></button>`,
        )
        .join("");
      document.body.append(panel);
      const rect = btn.getBoundingClientRect();
      panel.style.left =
        Math.max(
          8,
          Math.min(
            innerWidth - panel.offsetWidth - 8,
            rect.left + rect.width / 2 - panel.offsetWidth / 2,
          ),
        ) + "px";
      panel.style.bottom = innerHeight - rect.top + 12 + "px";
      panel.querySelectorAll("button").forEach(
        (b) =>
          (b.onclick = () => {
            manager.focus(b.dataset.window);
            panel.remove();
          }),
      );
      panel.onpointerleave = () => panel.remove();
      setTimeout(() => {
        if (!panel.matches(":hover") && !btn.matches(":hover")) panel.remove();
      }, 3000);
    }, 450);
  });
  btn.addEventListener("pointerleave", () => clearTimeout(hoverTimer));
  return btn;
}

function tickClock() {
  const now = new Date();
  timeEl.textContent = now.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  dateEl.textContent = now.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function setupNetwork() {
  const update = () => {
    const online = navigator.onLine;
    netEl.classList.toggle("online", online);
    netEl.classList.toggle("offline", !online);
    netEl.title = online ? "Online" : "Offline";
    netEl.innerHTML = online
      ? `<span class="ic" aria-hidden="true">●</span><span class="lbl">on</span>`
      : `<span class="ic" aria-hidden="true">●</span><span class="lbl">off</span>`;
  };
  window.addEventListener("online", update);
  window.addEventListener("offline", update);
  update();
}

async function setupBattery() {
  if (!navigator.getBattery) {
    batEl.hidden = true;
    return;
  }
  try {
    const b = await navigator.getBattery();
    const render = () => {
      const pct = Math.round((b.level || 0) * 100);
      batEl.hidden = false;
      batEl.classList.toggle("low", pct <= 20 && !b.charging);
      batEl.classList.toggle("crit", pct <= 10 && !b.charging);
      batEl.title = b.charging ? `Charging — ${pct}%` : `Battery — ${pct}%`;
      const icon = b.charging ? "⚡" : pct > 80 ? "🔋" : pct > 40 ? "🔋" : "🪫";
      batEl.innerHTML = `<span class="ic" aria-hidden="true">${icon}</span><span class="lbl">${pct}%</span>`;
    };
    b.addEventListener("levelchange", render);
    b.addEventListener("chargingchange", render);
    render();
  } catch {
    batEl.hidden = true;
  }
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
