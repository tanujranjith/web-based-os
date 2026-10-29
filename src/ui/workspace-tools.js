import { mediaPlayer } from "../core/media-player.js";
import { store } from "../core/state.js";
import { manager } from "../core/window-manager.js";
import { bus } from "../core/event-bus.js";
import { escape } from "./icons.js";
export function initWorkspaceTools() {
  document.documentElement.dataset.density =
    store.get().prefs.density || "comfortable";
  const bar = document.querySelector(".system-actions");
  const button = document.createElement("button");
  button.className = "workspace-layout-button";
  button.textContent = "▥";
  button.title = "Saved layouts";
  button.setAttribute("aria-label", "Saved workspace layouts");
  bar.prepend(button);
  const panel = document.createElement("section");
  panel.className = "workspace-layout-panel";
  panel.hidden = true;
  panel.innerHTML =
    '<h3>Workspace layouts</h3><p>Save your open apps and their arrangement.</p><button class="btn primary" data-save-layout>Save current layout</button><div class="saved-layouts"></div><button class="btn" data-reset-widgets>Reset widget positions</button>';
  document.getElementById("os").append(panel);
  const renderLayouts = () => {
    panel.querySelector(".saved-layouts").innerHTML = (
      store.get().layouts || []
    )
      .map(
        (l) =>
          `<div><button class="btn" data-layout="${escape(l.id)}">${escape(l.name)}</button><button class="btn" data-remove="${escape(l.id)}" aria-label="Delete layout">×</button></div>`,
      )
      .join("");
    panel.querySelectorAll("[data-layout]").forEach(
      (b) =>
        (b.onclick = () => {
          const layout = store
            .get()
            .layouts.find((l) => l.id === b.dataset.layout);
          if (!layout) return;
          for (const entry of layout.session) {
            const existing = manager
              .list()
              .find((r) => r.app.id === entry.appId && !r.closing);
            if (existing) {
              Object.assign(existing.state, entry.state);
              manager.refresh();
            } else
              manager.open(entry.appId, {
                ...entry.opts,
                restoreId: entry.id,
                restoreState: entry.state,
              });
          }
          manager.switchWorkspace(layout.workspace || 0);
          panel.hidden = true;
        }),
    );
    panel.querySelectorAll("[data-remove]").forEach(
      (b) =>
        (b.onclick = () => {
          store.update(
            (s) =>
              (s.layouts = s.layouts.filter((l) => l.id !== b.dataset.remove)),
          );
          renderLayouts();
        }),
    );
  };
  button.onclick = () => {
    panel.hidden = !panel.hidden;
    renderLayouts();
  };
  panel.querySelector("[data-save-layout]").onclick = () => {
    const name = prompt("Layout name", "My workspace");
    if (!name?.trim()) return;
    manager.checkpoint();
    store.update((s) => {
      s.layouts ??= [];
      s.layouts.push({
        id: crypto.randomUUID(),
        name: name.trim(),
        workspace: manager.workspace(),
        session: structuredClone(s.session),
      });
    });
    renderLayouts();
  };
  document.addEventListener("pointerdown", (e) => {
    if (!panel.contains(e.target) && !button.contains(e.target))
      panel.hidden = true;
  });
  bus.on("escape", () => (panel.hidden = true));
  const save = document.createElement("span");
  save.className = "save-indicator";
  save.setAttribute("role", "status");
  save.textContent = "Saved on this device";
  document.querySelector(".desktop-bottom")?.prepend(save);
  bus.on("save-status", (value) => {
    save.textContent =
      value === "saved"
        ? "Saved on this device"
        : value === "error"
          ? "Save failed · Export a backup"
          : "Saving…";
    save.dataset.status = value;
  });
  const widgets = [...document.querySelectorAll("#desktop-widgets > .widget")];
  function positionWidgets() {
    widgets.forEach((w, i) => {
      const state = store.get().prefs.widgetPositions?.[i];
      w.classList.toggle("widget-positioned", !!state && innerWidth >= 900);
      if (!state || innerWidth < 900) {
        w.style.removeProperty("left");
        w.style.removeProperty("top");
        w.style.removeProperty("width");
        w.style.removeProperty("height");
        return;
      }
      const height = Math.min(state.h, innerHeight - 170);
      Object.assign(w.style, {
        left:
          Math.max(
            8,
            Math.min(state.x, innerWidth - Math.min(state.w, innerWidth - 16)),
          ) + "px",
        top: Math.max(52, Math.min(state.y, innerHeight - height - 105)) + "px",
        width: Math.min(state.w, innerWidth - 16) + "px",
        height: height + "px",
      });
    });
  }
  widgets.forEach((w, i) => {
    const grip = document.createElement("button");
    grip.className = "widget-grip";
    grip.textContent = "⠿";
    grip.title = "Drag to move widget";
    grip.setAttribute("aria-label", "Move widget");
    w.prepend(grip);
    grip.onpointerdown = (e) => {
      if (innerWidth < 900) return;
      const rect = w.getBoundingClientRect(),
        x = e.clientX,
        y = e.clientY;
      w.classList.add("widget-positioned");
      Object.assign(w.style, {
        left: rect.left + "px",
        top: rect.top + "px",
        width: rect.width + "px",
        height: rect.height + "px",
      });
      grip.setPointerCapture(e.pointerId);
      grip.onpointermove = (event) => {
        w.style.left =
          Math.max(
            8,
            Math.min(
              innerWidth - rect.width - 8,
              rect.left + event.clientX - x,
            ),
          ) + "px";
        w.style.top =
          Math.max(
            52,
            Math.min(
              innerHeight - rect.height - 105,
              rect.top + event.clientY - y,
            ),
          ) + "px";
      };
      grip.onpointerup = () => {
        grip.onpointermove = null;
        const r = w.getBoundingClientRect();
        store.update((s) => {
          s.prefs.widgetPositions ??= {};
          s.prefs.widgetPositions[i] = {
            x: r.left,
            y: r.top,
            w: r.width,
            h: r.height,
          };
        });
      };
    };
    w.addEventListener("pointerup", () => {
      if (!w.classList.contains("widget-positioned")) return;
      const r = w.getBoundingClientRect();
      store.update((s) => {
        s.prefs.widgetPositions ??= {};
        s.prefs.widgetPositions[i] = {
          x: r.left,
          y: r.top,
          w: r.width,
          h: r.height,
        };
      });
    });
  });
  panel.querySelector("[data-reset-widgets]").onclick = () => {
    store.update((s) => delete s.prefs.widgetPositions);
    positionWidgets();
  };
  positionWidgets();
  window.addEventListener("resize", positionWidgets);
  const switcher = document.createElement("select");
  switcher.className = "mobile-switcher select";
  switcher.setAttribute("aria-label", "Switch app");
  document.getElementById("os").append(switcher);
  const updateSwitcher = () => {
    const list = manager.list().filter((r) => !r.closing);
    switcher.innerHTML =
      '<option value="">Switch app</option>' +
      list
        .map(
          (r) =>
            `<option value="${escape(r.id)}" ${r.id === manager.focused() ? "selected" : ""}>${escape(r.app.name)}</option>`,
        )
        .join("");
  };
  switcher.onchange = () => {
    if (switcher.value) manager.focus(switcher.value);
  };
  ["window-open", "window-close", "window-focus"].forEach((e) =>
    bus.on(e, updateSwitcher),
  );
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "`") {
      e.preventDefault();
      manager.cycle();
    }
  });
  const mini = document.createElement("div");
  mini.className = "mini-player";
  mini.hidden = true;
  mini.innerHTML =
    '<button data-mini-prev aria-label="Previous track">‹</button><button data-mini-play aria-label="Play or pause">▶</button><span></span><button data-mini-next aria-label="Next track">›</button>';
  document.getElementById("os").append(mini);
  mini.querySelector("[data-mini-play]").onclick = () => mediaPlayer.toggle();
  mini.querySelector("[data-mini-prev]").onclick = () => mediaPlayer.next(-1);
  mini.querySelector("[data-mini-next]").onclick = () => mediaPlayer.next();
  bus.on("media-change", () => {
    const s = mediaPlayer.snapshot();
    mini.hidden = !s.path;
    mini.querySelector("span").textContent = s.path?.split("/").pop() || "";
    mini.querySelector("[data-mini-play]").textContent = s.paused ? "▶" : "Ⅱ";
  });
  const divider = document.createElement("div");
  divider.className = "split-divider";
  divider.hidden = true;
  divider.setAttribute("role", "separator");
  divider.setAttribute("aria-label", "Resize split windows");
  divider.setAttribute("aria-orientation", "vertical");
  divider.tabIndex = 0;
  document.getElementById("os").append(divider);
  let ratio = 0.5;
  function halves() {
    const list = manager
      .list()
      .filter(
        (r) =>
          !r.closing &&
          !r.state.minimized &&
          r.state.workspace === manager.workspace(),
      );
    return [
      list.find(
        (r) =>
          r.state.x < 10 &&
          Math.abs(r.state.w - innerWidth * ratio) < 30 &&
          !r.state.maximized,
      ),
      list.find(
        (r) =>
          Math.abs(r.state.x - innerWidth * ratio) < 30 && !r.state.maximized,
      ),
    ];
  }
  function split(value) {
    const [a, b] = halves();
    if (!a || !b) return;
    ratio = Math.max(0.25, Math.min(0.75, value));
    a.state.w = innerWidth * ratio;
    b.state.x = innerWidth * ratio;
    b.state.w = innerWidth * (1 - ratio);
    manager.refresh();
    divider.style.left = innerWidth * ratio - 4 + "px";
    manager.checkpoint();
  }
  const showDivider = () => {
    const [a, b] = halves();
    divider.hidden = !a || !b || innerWidth < 900;
    divider.style.left = innerWidth * ratio - 4 + "px";
  };
  ["window-open", "window-close", "window-focus", "workspace-change"].forEach(
    (e) => bus.on(e, showDivider),
  );
  divider.onpointerdown = (e) => {
    divider.setPointerCapture(e.pointerId);
    divider.onpointermove = (event) => split(event.clientX / innerWidth);
    divider.onpointerup = () => (divider.onpointermove = null);
  };
  divider.onkeydown = (e) => {
    if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
      e.preventDefault();
      split(ratio + (e.key === "ArrowLeft" ? -0.025 : 0.025));
    }
  };
  bus.on("windows-arranged", () => {
    ratio = 0.5;
    showDivider();
  });
}
