import { store } from "./state.js";
import { bus } from "./event-bus.js";
import { registry } from "./app-registry.js";

let zCounter = 100;
const windows = new Map();   // id -> { id, appId, el, app, instance, state }
let focused = null;
const root = () => document.getElementById("windows");

const isSmallScreen = () => window.innerWidth < 760;

function clamp(n, min, max) { return Math.min(Math.max(n, min), max); }

function viewportBounds() {
  const dockH = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--dock-h")) || 64;
  return { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight - dockH };
}

function nextDefaultPos(w, h) {
  const vp = viewportBounds();
  const base = Math.max(20, (vp.w - w) / 2);
  const offset = (windows.size * 28) % 220;
  return {
    x: clamp(base + offset, 8, vp.w - w - 8),
    y: clamp(60 + offset, 8, vp.h - h - 8),
  };
}

function buildShell(app, opts) {
  const el = document.createElement("section");
  el.className = "window opening";
  el.dataset.app = app.id;
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-label", app.name);
  el.tabIndex = -1;
  el.innerHTML = `
    <header class="window-titlebar">
      <div class="window-controls">
        <button class="win-ctrl close" aria-label="Close" tabindex="-1"></button>
        <button class="win-ctrl min" aria-label="Minimize" tabindex="-1"></button>
        <button class="win-ctrl max" aria-label="Maximize" tabindex="-1"></button>
      </div>
      <div class="window-title"><span class="window-title-icon">${app.icon || ""}</span><span class="window-title-text">${escapeHtml(opts.title || app.name)}</span></div>
      <div class="window-title-spacer"></div>
    </header>
    <div class="window-body"><div class="window-content scroll-thin"></div></div>
    <div class="window-resize n"></div>
    <div class="window-resize s"></div>
    <div class="window-resize e"></div>
    <div class="window-resize w"></div>
    <div class="window-resize ne"></div>
    <div class="window-resize nw"></div>
    <div class="window-resize se"></div>
    <div class="window-resize sw"></div>
  `;
  return el;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function applyState(rec) {
  const { el, state } = rec;
  if (state.maximized || isSmallScreen()) {
    el.classList.add("maximized");
    const vp = viewportBounds();
    el.style.left = "0px";
    el.style.top = "0px";
    el.style.width = vp.w + "px";
    el.style.height = vp.h + "px";
  } else {
    el.classList.remove("maximized");
    el.style.left = state.x + "px";
    el.style.top = state.y + "px";
    el.style.width = state.w + "px";
    el.style.height = state.h + "px";
  }
  if (state.minimized) el.style.display = "none";
  else el.style.display = "";
}

function persist(rec) {
  if (!rec.app.persistGeometry && rec.app.persistGeometry !== undefined && rec.app.persistGeometry === false) return;
  store.update((s) => {
    s.windows[rec.app.id] = {
      x: rec.state.x, y: rec.state.y,
      w: rec.state.w, h: rec.state.h,
      maximized: rec.state.maximized,
    };
  });
}

function setFocus(id) {
  for (const rec of windows.values()) rec.el.classList.add("unfocused");
  const rec = windows.get(id);
  if (!rec) return;
  rec.el.classList.remove("unfocused");
  rec.el.style.zIndex = String(++zCounter);
  focused = id;
  bus.emit("window-focus", { id, appId: rec.app.id });
}

function attachDrag(rec) {
  const bar = rec.el.querySelector(".window-titlebar");
  let dragging = false;
  let offset = { x: 0, y: 0 };
  let preview = null;
  let snapZone = null;

  const onDown = (e) => {
    if (e.target.closest(".win-ctrl")) return;
    if (rec.state.maximized) {
      // restore on drag-out from maximized
      const r = rec.el.getBoundingClientRect();
      rec.state.maximized = false;
      rec.state.x = clamp(e.clientX - rec.state.w / 2, 8, window.innerWidth - rec.state.w - 8);
      rec.state.y = clamp(e.clientY - 18, 8, viewportBounds().h - 60);
      applyState(rec);
    }
    dragging = true;
    setFocus(rec.id);
    const rect = rec.el.getBoundingClientRect();
    offset.x = e.clientX - rect.left;
    offset.y = e.clientY - rect.top;
    document.body.style.userSelect = "none";
    e.preventDefault();
  };
  const onMove = (e) => {
    if (!dragging) return;
    const vp = viewportBounds();
    const nx = clamp(e.clientX - offset.x, -rec.state.w + 80, vp.w - 80);
    const ny = clamp(e.clientY - offset.y, 0, vp.h - 40);
    rec.state.x = nx;
    rec.state.y = ny;
    rec.el.style.left = nx + "px";
    rec.el.style.top = ny + "px";

    // Snap preview detection
    const SNAP = 24;
    let zone = null;
    if (e.clientY <= SNAP) zone = "top";
    else if (e.clientX <= SNAP) zone = "left";
    else if (e.clientX >= window.innerWidth - SNAP) zone = "right";
    if (zone !== snapZone) {
      snapZone = zone;
      if (zone) {
        if (!preview) {
          preview = document.createElement("div");
          preview.className = "snap-preview";
          root().appendChild(preview);
        }
        const region = snapRegion(zone);
        Object.assign(preview.style, { left: region.x + "px", top: region.y + "px", width: region.w + "px", height: region.h + "px" });
      } else if (preview) {
        preview.remove(); preview = null;
      }
    }
  };
  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    document.body.style.userSelect = "";
    if (preview && snapZone) {
      const region = snapRegion(snapZone);
      if (snapZone === "top") {
        rec.state.maximized = true;
      } else {
        rec.state.maximized = false;
        rec.state.x = region.x; rec.state.y = region.y;
        rec.state.w = region.w; rec.state.h = region.h;
      }
      applyState(rec);
    }
    if (preview) { preview.remove(); preview = null; }
    snapZone = null;
    persist(rec);
  };

  bar.addEventListener("mousedown", onDown);
  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);

  // Touch dragging
  bar.addEventListener("touchstart", (e) => {
    const t = e.touches[0];
    onDown({ target: e.target, clientX: t.clientX, clientY: t.clientY, preventDefault: () => {} });
  }, { passive: true });
  document.addEventListener("touchmove", (e) => {
    if (!dragging) return;
    const t = e.touches[0];
    onMove({ clientX: t.clientX, clientY: t.clientY });
  }, { passive: true });
  document.addEventListener("touchend", onUp);

  // Double click titlebar to toggle maximize
  bar.addEventListener("dblclick", (e) => {
    if (e.target.closest(".win-ctrl")) return;
    manager.toggleMaximize(rec.id);
  });

  rec._cleanup.push(() => {
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
  });
}

function snapRegion(zone) {
  const vp = viewportBounds();
  if (zone === "top") return { x: 0, y: 0, w: vp.w, h: vp.h };
  if (zone === "left") return { x: 0, y: 0, w: Math.round(vp.w / 2), h: vp.h };
  if (zone === "right") return { x: Math.round(vp.w / 2), y: 0, w: Math.round(vp.w / 2), h: vp.h };
  return { x: 0, y: 0, w: vp.w, h: vp.h };
}

function attachResize(rec) {
  rec.el.querySelectorAll(".window-resize").forEach((handle) => {
    handle.addEventListener("mousedown", (e) => {
      if (rec.state.maximized) return;
      e.stopPropagation();
      setFocus(rec.id);
      const startX = e.clientX, startY = e.clientY;
      const { x, y, w, h } = rec.state;
      const dir = handle.className.split(" ").pop();
      const onMove = (ev) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        let nx = x, ny = y, nw = w, nh = h;
        if (dir.includes("e")) nw = Math.max(320, w + dx);
        if (dir.includes("s")) nh = Math.max(200, h + dy);
        if (dir.includes("w")) { nw = Math.max(320, w - dx); nx = x + (w - nw); }
        if (dir.includes("n")) { nh = Math.max(200, h - dy); ny = y + (h - nh); }
        // clamp to viewport
        const vp = viewportBounds();
        nx = clamp(nx, 0, vp.w - 80);
        ny = clamp(ny, 0, vp.h - 60);
        nw = clamp(nw, 320, vp.w);
        nh = clamp(nh, 200, vp.h);
        Object.assign(rec.state, { x: nx, y: ny, w: nw, h: nh });
        rec.el.style.left = nx + "px"; rec.el.style.top = ny + "px";
        rec.el.style.width = nw + "px"; rec.el.style.height = nh + "px";
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        persist(rec);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
      e.preventDefault();
    });
  });
}

function attachControls(rec) {
  rec.el.querySelector(".win-ctrl.close").addEventListener("click", () => manager.close(rec.id));
  rec.el.querySelector(".win-ctrl.min").addEventListener("click", () => manager.minimize(rec.id));
  rec.el.querySelector(".win-ctrl.max").addEventListener("click", () => manager.toggleMaximize(rec.id));
  rec.el.addEventListener("mousedown", () => setFocus(rec.id), true);
}

export const manager = {
  open(appId, opts = {}) {
    const app = registry.get(appId);
    if (!app) { console.warn(`[wm] unknown app '${appId}'`); return null; }

    // Singleton: focus existing
    if (windows.has(appId)) {
      const rec = windows.get(appId);
      if (rec.state.minimized) {
        rec.state.minimized = false;
        applyState(rec);
      }
      setFocus(rec.id);
      return rec;
    }

    const persisted = store.get().windows[appId];
    const defaultSize = app.defaultSize || { w: 720, h: 480 };
    const w = persisted?.w || defaultSize.w;
    const h = persisted?.h || defaultSize.h;
    const pos = persisted ? { x: persisted.x, y: persisted.y } : nextDefaultPos(w, h);
    const state = {
      x: pos.x, y: pos.y, w, h,
      maximized: persisted?.maximized || false,
      minimized: false,
    };

    const el = buildShell(app, opts);
    const content = el.querySelector(".window-content");
    if (app.bodyClass) content.parentElement.classList.add(app.bodyClass);
    const rec = { id: appId, app, el, state, _cleanup: [] };
    windows.set(appId, rec);

    root().appendChild(el);
    applyState(rec);
    attachDrag(rec);
    attachResize(rec);
    attachControls(rec);
    setFocus(appId);

    // Mount app
    try {
      const ctx = {
        windowId: appId,
        opts,
        openApp: (id, o) => manager.open(id, o),
        focusApp: (id) => manager.focus(id),
        close: () => manager.close(appId),
        setTitle: (t) => { const el = rec.el.querySelector(".window-title-text"); if (el) el.textContent = t; },
      };
      const instance = app.mount(content, ctx);
      rec.instance = instance || {};
    } catch (e) {
      console.error(`[wm] failed to mount ${appId}`, e);
      content.innerHTML = `<div class="app-empty"><div class="em-icon">⚠️</div><div class="em-title">Couldn't open ${escapeHtml(app.name)}</div><div class="em-sub">${escapeHtml(e.message)}</div></div>`;
    }

    // Track recent apps
    store.update((s) => {
      s.recent = [appId, ...s.recent.filter((x) => x !== appId)].slice(0, 8);
    });

    setTimeout(() => el.classList.remove("opening"), 260);
    bus.emit("window-open", { appId });
    return rec;
  },

  close(id) {
    const rec = windows.get(id);
    if (!rec) return;
    try { rec.instance?.unmount?.(); } catch (e) { console.error(e); }
    rec.el.classList.add("closing");
    setTimeout(() => {
      rec._cleanup?.forEach((fn) => fn());
      rec.el.remove();
      windows.delete(id);
      bus.emit("window-close", { appId: rec.app.id });
    }, 180);
  },

  minimize(id) {
    const rec = windows.get(id);
    if (!rec) return;
    rec.el.classList.add("minimizing");
    setTimeout(() => {
      rec.state.minimized = true;
      rec.el.classList.remove("minimizing");
      applyState(rec);
      bus.emit("window-minimize", { appId: rec.app.id });
    }, 240);
  },

  restore(id) {
    const rec = windows.get(id);
    if (!rec) return;
    rec.state.minimized = false;
    applyState(rec);
    setFocus(id);
    bus.emit("window-restore", { appId: rec.app.id });
  },

  toggleMaximize(id) {
    const rec = windows.get(id);
    if (!rec) return;
    rec.state.maximized = !rec.state.maximized;
    applyState(rec);
    persist(rec);
  },

  focus(id) {
    const rec = windows.get(id);
    if (!rec) return;
    if (rec.state.minimized) this.restore(id);
    else setFocus(id);
  },

  focused() { return focused; },
  list() { return Array.from(windows.values()); },
  has(id) { return windows.has(id); },

  closeAll() { for (const id of Array.from(windows.keys())) this.close(id); },
};

window.addEventListener("resize", () => {
  for (const rec of windows.values()) {
    if (rec.state.maximized) applyState(rec);
    else {
      const vp = viewportBounds();
      if (rec.state.x + rec.state.w > vp.w) rec.state.x = Math.max(0, vp.w - rec.state.w);
      if (rec.state.y + rec.state.h > vp.h) rec.state.y = Math.max(0, vp.h - rec.state.h);
      applyState(rec);
    }
  }
});
