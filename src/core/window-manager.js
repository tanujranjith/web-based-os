import { store } from "./state.js";
import { bus } from "./event-bus.js";
import { registry } from "./app-registry.js";
import { sound } from "./sound.js";
import { contextMenu } from "../ui/context-menu.js";

let zCounter = 100;
const windows = new Map(); // id -> { id, appId, el, app, instance, state }
let focused = null;
let workspace = 0;
let restoring = false;
function persistSession() {
  if (restoring) return;
  store.update((s) => {
    s.activeWorkspace = workspace;
    s.session = [...windows.values()]
      .filter((r) => !r.closing)
      .map((r) => ({
        id: r.id,
        appId: r.app.id,
        opts: r.instance?.session?.() || r.opts,
        state: { ...r.state },
        unsnapped: r.unsnapped,
      }));
  });
}
function record(id) {
  return (
    windows.get(id) ||
    [...windows.values()].find((r) => r.app.id === id && !r.closing)
  );
}
const root = () => document.getElementById("windows");

const isSmallScreen = () => window.innerWidth < 760;

function clamp(n, min, max) {
  return Math.min(Math.max(n, min), max);
}

function viewportBounds() {
  const dockH =
    parseInt(
      getComputedStyle(document.documentElement).getPropertyValue("--dock-h"),
    ) || 64;
  return {
    x: 0,
    y: 0,
    w: window.innerWidth,
    h: Math.max(200, window.innerHeight - dockH - 44),
  };
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
        <button class="win-ctrl close" aria-label="Close"></button>
        <button class="win-ctrl min" aria-label="Minimize"></button>
        <button class="win-ctrl max" aria-label="Maximize"></button>
      </div>
      <div class="window-title"><span class="window-title-icon">${app.icon || ""}</span><span class="window-title-text">${escapeHtml(opts.title || app.name)}</span></div>
      <button class="window-layout-control" aria-label="Arrange window" title="Arrange window">▥</button>
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
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}

function applyState(rec) {
  const { el, state } = rec;
  el.classList.toggle("workspace-hidden", (state.workspace || 0) !== workspace);
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
  if (
    !rec.app.persistGeometry &&
    rec.app.persistGeometry !== undefined &&
    rec.app.persistGeometry === false
  )
    return;
  store.update((s) => {
    s.windows[rec.app.id] = {
      x: rec.state.x,
      y: rec.state.y,
      w: rec.state.w,
      h: rec.state.h,
      maximized: rec.state.maximized,
    };
  });
  persistSession();
}

function setFocus(id) {
  for (const rec of windows.values()) rec.el.classList.add("unfocused");
  const rec = record(id);
  if (!rec) return;
  if ((rec.state.workspace || 0) !== workspace)
    manager.switchWorkspace(rec.state.workspace || 0);
  rec.el.classList.remove("unfocused");
  rec.el.style.zIndex = String(++zCounter);
  focused = rec.id;
  bus.emit("window-focus", { id: rec.id, appId: rec.app.id });
}

function attachDrag(rec) {
  const bar = rec.el.querySelector(".window-titlebar");
  let dragging = false;
  let offset = { x: 0, y: 0 };
  let preview = null;
  let snapZone = null;

  const onDown = (e) => {
    if (isSmallScreen()) return;
    if (e.target.closest("button")) return;
    if (rec.state.maximized) {
      // restore on drag-out from maximized
      const r = rec.el.getBoundingClientRect();
      rec.state.maximized = false;
      rec.state.x = clamp(
        e.clientX - rec.state.w / 2,
        8,
        window.innerWidth - rec.state.w - 8,
      );
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
    const ny = clamp(e.clientY - offset.y - 44, 0, vp.h - 40);
    rec.state.x = nx;
    rec.state.y = ny;
    rec.el.style.left = nx + "px";
    rec.el.style.top = ny + "px";

    // Snap preview detection (corners take priority for quarter snaps)
    const SNAP = 24;
    const CORNER = 60;
    let zone = null;
    if (e.clientY <= CORNER && e.clientX <= CORNER) zone = "tl";
    else if (e.clientY <= CORNER && e.clientX >= window.innerWidth - CORNER)
      zone = "tr";
    else if (e.clientY >= viewportBounds().h - CORNER && e.clientX <= CORNER)
      zone = "bl";
    else if (
      e.clientY >= viewportBounds().h - CORNER &&
      e.clientX >= window.innerWidth - CORNER
    )
      zone = "br";
    else if (e.clientY <= SNAP) zone = "top";
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
        Object.assign(preview.style, {
          left: region.x + "px",
          top: region.y + "px",
          width: region.w + "px",
          height: region.h + "px",
        });
      } else if (preview) {
        preview.remove();
        preview = null;
      }
    }
  };
  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    document.body.style.userSelect = "";
    if (preview && snapZone) {
      if (!rec.unsnapped) rec.unsnapped = { ...rec.state };
      const region = snapRegion(snapZone);
      if (snapZone === "top") {
        rec.state.maximized = true;
      } else {
        rec.state.maximized = false;
        rec.state.x = region.x;
        rec.state.y = region.y;
        rec.state.w = region.w;
        rec.state.h = region.h;
      }
      applyState(rec);
    }
    if (preview) {
      preview.remove();
      preview = null;
    }
    snapZone = null;
    persist(rec);
  };

  bar.addEventListener("mousedown", onDown);
  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);

  // Touch dragging
  bar.addEventListener(
    "touchstart",
    (e) => {
      const t = e.touches[0];
      onDown({
        target: e.target,
        clientX: t.clientX,
        clientY: t.clientY,
        preventDefault: () => {},
      });
    },
    { passive: true },
  );
  const onTouchMove = (e) => {
    if (!dragging) return;
    const t = e.touches[0];
    onMove({ clientX: t.clientX, clientY: t.clientY });
  };
  document.addEventListener("touchmove", onTouchMove, { passive: true });
  document.addEventListener("touchend", onUp);

  // Double click titlebar to toggle maximize
  bar.addEventListener("dblclick", (e) => {
    if (e.target.closest("button")) return;
    manager.toggleMaximize(rec.id);
  });

  rec._cleanup.push(() => {
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
    document.removeEventListener("touchmove", onTouchMove);
    document.removeEventListener("touchend", onUp);
    preview?.remove();
  });
}

function snapRegion(zone) {
  const vp = viewportBounds();
  const hw = Math.round(vp.w / 2);
  const hh = Math.round(vp.h / 2);
  if (zone === "top") return { x: 0, y: 0, w: vp.w, h: vp.h };
  if (zone === "left") return { x: 0, y: 0, w: hw, h: vp.h };
  if (zone === "right") return { x: hw, y: 0, w: hw, h: vp.h };
  if (zone === "tl") return { x: 0, y: 0, w: hw, h: hh };
  if (zone === "tr") return { x: hw, y: 0, w: hw, h: hh };
  if (zone === "bl") return { x: 0, y: hh, w: hw, h: hh };
  if (zone === "br") return { x: hw, y: hh, w: hw, h: hh };
  return { x: 0, y: 0, w: vp.w, h: vp.h };
}

function attachResize(rec) {
  rec.el.querySelectorAll(".window-resize").forEach((handle) => {
    handle.addEventListener("mousedown", (e) => {
      if (rec.state.maximized) return;
      e.stopPropagation();
      setFocus(rec.id);
      const startX = e.clientX,
        startY = e.clientY;
      const { x, y, w, h } = rec.state;
      const dir = handle.className.split(" ").pop();
      const onMove = (ev) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        let nx = x,
          ny = y,
          nw = w,
          nh = h;
        if (dir.includes("e")) nw = Math.max(320, w + dx);
        if (dir.includes("s")) nh = Math.max(200, h + dy);
        if (dir.includes("w")) {
          nw = Math.max(320, w - dx);
          nx = x + (w - nw);
        }
        if (dir.includes("n")) {
          nh = Math.max(200, h - dy);
          ny = y + (h - nh);
        }
        // clamp to viewport
        const vp = viewportBounds();
        nx = clamp(nx, 0, vp.w - 80);
        ny = clamp(ny, 0, vp.h - 60);
        nw = clamp(nw, 320, vp.w);
        nh = clamp(nh, 200, vp.h);
        Object.assign(rec.state, { x: nx, y: ny, w: nw, h: nh });
        rec.el.style.left = nx + "px";
        rec.el.style.top = ny + "px";
        rec.el.style.width = nw + "px";
        rec.el.style.height = nh + "px";
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
  const layout = rec.el.querySelector(".window-layout-control");
  layout.addEventListener("click", () => {
    const rect = layout.getBoundingClientRect();
    contextMenu.open(rect.right - 220, rect.bottom + 6, [
      { label: "Fill screen", action: () => manager.snap(rec.id, "top") },
      { label: "Left half", action: () => manager.snap(rec.id, "left") },
      { label: "Right half", action: () => manager.snap(rec.id, "right") },
      { sep: true },
      ...[
        ["tl", "Top left"],
        ["tr", "Top right"],
        ["bl", "Bottom left"],
        ["br", "Bottom right"],
      ].map(([zone, label]) => ({
        label,
        action: () => manager.snap(rec.id, zone),
      })),
      { sep: true },
      {
        label: "Restore floating window",
        action: () => manager.unsnap(rec.id),
      },
      { label: "Tile all windows", action: () => manager.tile() },
    ]);
  });
  rec.el
    .querySelector(".win-ctrl.close")
    .addEventListener("click", () => manager.close(rec.id));
  rec.el
    .querySelector(".win-ctrl.min")
    .addEventListener("click", () => manager.minimize(rec.id));
  rec.el
    .querySelector(".win-ctrl.max")
    .addEventListener("click", () => manager.toggleMaximize(rec.id));
  rec.el.addEventListener("mousedown", () => setFocus(rec.id), true);
}

export const manager = {
  open(appId, opts = {}) {
    const app = registry.get(appId);
    if (!app) {
      console.warn(`[wm] unknown app '${appId}'`);
      return null;
    }

    // Singleton: focus existing
    const existing = record(appId);
    if (existing && !opts.newWindow && !opts.restoreId) {
      const rec = existing;
      clearTimeout(rec.minTimer);
      if (rec.closing) return null;
      if (rec.state.minimized) {
        rec.state.minimized = false;
        applyState(rec);
      }
      setFocus(rec.id);
      rec.instance?.onOpen?.(opts);
      persistSession();
      return rec;
    }

    if (
      opts.newWindow &&
      ![
        "files",
        "code-editor",
        "pdf-viewer",
        "image-viewer",
        "terminal",
      ].includes(appId)
    )
      opts.newWindow = false;
    const id =
      opts.restoreId ||
      (windows.has(appId) ? `${appId}:${crypto.randomUUID()}` : appId);
    const persisted = opts.restoreState || store.get().windows[appId];
    const defaultSize = app.defaultSize || { w: 720, h: 480 };
    const vp = viewportBounds();
    const w = Math.min(persisted?.w || defaultSize.w, vp.w);
    const h = Math.min(persisted?.h || defaultSize.h, vp.h);
    const pos = persisted
      ? { x: persisted.x, y: persisted.y }
      : nextDefaultPos(w, h);
    const state = {
      x: clamp(pos.x, 0, vp.w - w),
      y: clamp(pos.y, 0, vp.h - h),
      w,
      h,
      workspace: opts.restoreState?.workspace ?? workspace,
      maximized: persisted?.maximized || false,
      minimized: opts.restoreState?.minimized || false,
    };

    const el = buildShell(app, opts);
    const content = el.querySelector(".window-content");
    if (app.bodyClass) content.parentElement.classList.add(app.bodyClass);
    const rec = {
      id,
      app,
      el,
      state,
      opts: {
        ...opts,
        newWindow: false,
        restoreId: undefined,
        restoreState: undefined,
      },
      unsnapped: opts.unsnapped,
      _cleanup: [],
    };
    el.dataset.window = id;
    windows.set(id, rec);

    root().appendChild(el);
    applyState(rec);
    attachDrag(rec);
    attachResize(rec);
    attachControls(rec);
    if (!restoring) setFocus(id);

    // Mount app
    try {
      const ctx = {
        windowId: id,
        checkpoint: persistSession,
        opts,
        openApp: (id, o) => manager.open(id, o),
        focusApp: (id) => manager.focus(id),
        close: () => manager.close(id),
        setTitle: (t) => {
          const el = rec.el.querySelector(".window-title-text");
          if (el) el.textContent = t;
        },
      };
      const instance = app.mount(content, ctx);
      rec.instance = instance || {};
    } catch (e) {
      console.error(`[wm] failed to mount ${appId}`, e);
      content.innerHTML = `<div class="app-empty"><div class="em-icon">⚠️</div><div class="em-title">Couldn't open ${escapeHtml(app.name)}</div><div class="em-sub">${escapeHtml(e.message)}</div></div>`;
    }

    persistSession();
    // Track recent apps
    store.update((s) => {
      s.recent = [appId, ...s.recent.filter((x) => x !== appId)].slice(0, 8);
    });

    setTimeout(() => el.classList.remove("opening"), 260);
    sound.open();
    bus.emit("window-open", { appId });
    return rec;
  },

  close(id) {
    const rec = record(id);
    if (!rec) return;
    if (rec.closing) return;
    if (rec.instance?.beforeClose?.() === false) return;
    rec.closing = true;
    persistSession();
    clearTimeout(rec.minTimer);
    sound.close();
    try {
      rec.instance?.unmount?.();
    } catch (e) {
      console.error(e);
    }
    rec.el.classList.add("closing");
    setTimeout(() => {
      rec._cleanup?.forEach((fn) => fn());
      rec.el.remove();
      windows.delete(rec.id);
      if (focused === id) {
        focused = null;
        const next = [...windows.values()]
          .filter(
            (r) =>
              !r.state.minimized &&
              r.state.workspace === workspace &&
              !r.closing,
          )
          .pop();
        if (next) setFocus(next.id);
      }
      bus.emit("window-close", { appId: rec.app.id });
    }, 180);
  },

  minimize(id) {
    const rec = record(id);
    if (!rec) return;
    if (rec.state.minimized || rec.closing) return;
    clearTimeout(rec.minTimer);
    // FLIP-style: animate toward the dock icon for this app
    const target = document.querySelector(
      `.dock-item[data-app="${rec.app.id}"]`,
    );
    if (
      target &&
      !document.documentElement.dataset.reduceMotion?.match(/true/)
    ) {
      const src = rec.el.getBoundingClientRect();
      const dst = target.getBoundingClientRect();
      const sx = dst.width / src.width;
      const sy = dst.height / src.height;
      const tx = dst.left + dst.width / 2 - (src.left + src.width / 2);
      const ty = dst.top + dst.height / 2 - (src.top + src.height / 2);
      rec.el.style.transformOrigin = "center";
      rec.el.animate(
        [
          { transform: "none", opacity: 1 },
          {
            transform: `translate(${tx}px, ${ty}px) scale(${sx}, ${sy})`,
            opacity: 0.2,
          },
        ],
        { duration: 260, easing: "cubic-bezier(0.55, 0, 0.85, 0.6)" },
      );
    }
    rec.minTimer = setTimeout(() => {
      rec.state.minimized = true;
      applyState(rec);
      if (focused === id) {
        focused = null;
        const next = [...windows.values()]
          .filter(
            (r) =>
              r.id !== id &&
              !r.state.minimized &&
              r.state.workspace === workspace,
          )
          .pop();
        if (next) setFocus(next.id);
      }
      persistSession();
      bus.emit("window-minimize", { appId: rec.app.id });
    }, 240);
  },

  restore(id) {
    const rec = record(id);
    if (!rec) return;
    clearTimeout(rec.minTimer);
    rec.state.minimized = false;
    applyState(rec);
    setFocus(id);
    persistSession();
    bus.emit("window-restore", { appId: rec.app.id });
  },

  toggleMaximize(id) {
    const rec = record(id);
    if (!rec) return;
    rec.state.maximized = !rec.state.maximized;
    applyState(rec);
    persist(rec);
  },

  focus(id) {
    const rec = record(id);
    if (!rec) return;
    clearTimeout(rec.minTimer);
    if (rec.state.minimized) this.restore(id);
    else setFocus(id);
  },

  focused() {
    return focused;
  },
  snap(id, zone) {
    const rec = record(id);
    if (
      !rec ||
      !["top", "left", "right", "tl", "tr", "bl", "br"].includes(zone)
    )
      return;
    if (!rec.unsnapped)
      rec.unsnapped = {
        x: rec.state.x,
        y: rec.state.y,
        w: rec.state.w,
        h: rec.state.h,
      };
    const region = snapRegion(zone);
    clearTimeout(rec.minTimer);
    Object.assign(rec.state, region, {
      maximized: zone === "top",
      minimized: false,
    });
    applyState(rec);
    setFocus(id);
    persist(rec);
    bus.emit("windows-arranged");
  },
  unsnap(id) {
    const rec = record(id);
    if (!rec) return;
    const vp = viewportBounds(),
      size = rec.app.defaultSize || { w: 720, h: 480 };
    const geometry = rec.unsnapped || {
      x: (vp.w - Math.min(size.w, vp.w)) / 2,
      y: 35,
      w: Math.min(size.w, vp.w),
      h: Math.min(size.h, vp.h),
    };
    Object.assign(rec.state, geometry, { maximized: false });
    rec.state.w = Math.min(rec.state.w, vp.w);
    rec.state.h = Math.min(rec.state.h, vp.h);
    rec.state.x = clamp(rec.state.x, 0, vp.w - rec.state.w);
    rec.state.y = clamp(rec.state.y, 0, vp.h - rec.state.h);
    rec.unsnapped = null;
    applyState(rec);
    persist(rec);
  },
  workspace() {
    return workspace;
  },
  switchWorkspace(index) {
    workspace = clamp(index, 0, 2);
    focused = null;
    windows.forEach(applyState);
    const next = [...windows.values()]
      .filter((r) => r.state.workspace === workspace && !r.state.minimized)
      .pop();
    if (next) setFocus(next.id);
    persistSession();
    bus.emit("workspace-change", { workspace });
  },
  moveToWorkspace(id, index) {
    const rec = record(id);
    if (!rec) return;
    rec.state.workspace = clamp(index, 0, 2);
    persistSession();
    this.switchWorkspace(workspace);
  },
  tile() {
    const visible = [...windows.values()].filter(
      (r) => r.state.workspace === workspace && !r.state.minimized,
    );
    if (!visible.length) return;
    const vp = viewportBounds(),
      cols = Math.ceil(Math.sqrt(visible.length)),
      rows = Math.ceil(visible.length / cols);
    visible.forEach((rec, i) => {
      Object.assign(rec.state, {
        maximized: false,
        x: ((i % cols) * vp.w) / cols + 6,
        y: (Math.floor(i / cols) * vp.h) / rows + 6,
        w: vp.w / cols - 12,
        h: vp.h / rows - 12,
      });
      applyState(rec);
      persist(rec);
    });
  },
  showDesktop() {
    windows.forEach((rec) => {
      if (rec.state.workspace === workspace) this.minimize(rec.id);
    });
  },
  list() {
    return Array.from(windows.values());
  },
  has(id) {
    return !!record(id);
  },
  refresh() {
    windows.forEach(applyState);
  },
  checkpoint() {
    persistSession();
  },
  restoreSession() {
    const saved = structuredClone(store.get().session || []);
    const active = store.get().activeWorkspace || 0;
    restoring = true;
    for (const entry of saved) {
      if (windows.has(entry.id)) continue;
      try {
        this.open(entry.appId, {
          ...entry.opts,
          restoreId: entry.id,
          restoreState: entry.state,
          unsnapped: entry.unsnapped,
        });
      } catch (error) {
        console.error("Session restore", error);
      }
    }
    restoring = false;
    this.switchWorkspace(active);
  },
  cycle() {
    const items = this.list().filter(
      (r) => r.state.workspace === workspace && !r.closing,
    );
    if (!items.length) return;
    this.focus(
      items[(items.findIndex((r) => r.id === focused) + 1) % items.length].id,
    );
  },

  closeAll() {
    for (const id of Array.from(windows.keys())) this.close(id);
  },
};

window.addEventListener("resize", () => {
  for (const rec of windows.values()) {
    if (rec.state.maximized) applyState(rec);
    else {
      const vp = viewportBounds();
      rec.state.w = Math.min(rec.state.w, vp.w);
      rec.state.h = Math.min(rec.state.h, vp.h);
      if (rec.state.x + rec.state.w > vp.w)
        rec.state.x = Math.max(0, vp.w - rec.state.w);
      if (rec.state.y + rec.state.h > vp.h)
        rec.state.y = Math.max(0, vp.h - rec.state.h);
      applyState(rec);
    }
  }
});
