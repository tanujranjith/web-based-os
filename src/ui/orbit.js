import { store } from "../core/state.js";
import { manager } from "../core/window-manager.js";
import { registry } from "../core/app-registry.js";
import { bus } from "../core/event-bus.js";
import { theme, wallpapers } from "../core/theme.js";
import { icon, escape } from "./icons.js";
import { trapFocus } from "./focus-trap.js";
import { focusTimer } from "../core/focus-timer.js";
import { initGlobe } from "./globe.js";
import { initMacShell } from "./mac-shell.js";

let spaces;
export function initOrbit() {
  spaces = store.get().workspaceNames;
  const os = document.getElementById("os");
  const bar = document.createElement("header");
  bar.className = "system-bar";
  bar.innerHTML = `<button class="system-brand" aria-label="Open NovaOS launchpad"><span class="nova-symbol">✳</span> nova<span class="brand-os">OS</span></button><span class="bar-separator"></span><span id="active-app">Desktop</span><nav class="space-tabs" aria-label="Workspaces">${spaces.map((s, i) => `<button data-space="${i}" aria-pressed="${i === 0}"><span class="space-dot"></span>${s}</button>`).join("")}</nav><div class="system-actions"><button id="overview-open" title="Window overview (Ctrl+Shift+O)" aria-label="Window overview">${icon("layers")}</button><button id="system-search" title="Search everything (Ctrl+K)" aria-label="Search everything">${icon("search")}</button><button id="system-theme" title="Switch appearance" aria-label="Switch appearance">${icon("moon")}</button><button id="system-time" aria-label="Open clock"></button></div>`;
  os.appendChild(bar);
  bar.querySelector(".system-brand").onclick = () => bus.emit("launcher-open");
  bar.querySelector("#system-search").onclick = () => bus.emit("palette-open");
  bar.querySelector("#system-theme").onclick = () =>
    theme.setTheme(
      document.documentElement.dataset.theme === "dark" ? "light" : "dark",
    );
  bar.querySelector("#system-time").onclick = () => manager.open("clock");
  bar
    .querySelectorAll("[data-space]")
    .forEach(
      (b) => (b.onclick = () => manager.switchWorkspace(+b.dataset.space)),
    );
  document
    .getElementById("wallpaper")
    .insertAdjacentHTML(
      "beforeend",
      '<div class="orbit-art" aria-hidden="true"><div class="orbit-glow"></div><div class="orbit-ring ring-one"></div><div class="orbit-ring ring-two"></div><div class="orbit-ring ring-three"></div><div class="orbit-planet"></div><div class="orbit-moon"></div></div>',
    );
  initGlobe();

  const home = document.createElement("div");
  home.className = "desktop-home";
  home.innerHTML = `<div class="home-eyebrow"><span></span> A LITTLE SPACE FOR BIG IDEAS</div><h1 id="home-greeting">A place for<br>your next idea.</h1><p>Your files, projects, and daily work.<br>Right where you left them.</p><button class="home-search">${icon("search")}<span>Where do you want to go?</span><kbd>Ctrl K</kbd></button><div class="home-shortcuts"><button data-open="board">${icon("board")} Project board ${icon("arrow")}</button><button data-open="notes">${icon("notes")} Capture a thought ${icon("arrow")}</button></div><div class="home-footnote"><span class="home-version">NOVA / 04</span><span>Yours to make something of.</span></div>`;
  document.getElementById("desktop").appendChild(home);
  home.querySelector(".home-search").onclick = () => bus.emit("palette-open");
  home
    .querySelectorAll("[data-open]")
    .forEach((b) => (b.onclick = () => manager.open(b.dataset.open)));

  const widgets = document.getElementById("desktop-widgets");
  const today = document.createElement("section");
  today.className = "widget orbit-today";
  today.innerHTML = `<div class="widget-label">YOUR DAY, AT A GLANCE ${icon("clock")}</div><div id="orbit-time"></div><div id="orbit-date"></div><div class="week-strip"></div><button class="day-agenda" data-open="tasks"><span class="agenda-mark"></span><span><strong id="agenda-count">A little breathing room</strong><small id="agenda-sub">Plan something good today</small></span>${icon("arrow")}</button>`;
  widgets.prepend(today);
  today.querySelector("[data-open]").onclick = () => manager.open("tasks");
  const focus = document.createElement("section");
  focus.className = "widget orbit-focus";
  focus.innerHTML = `<div class="widget-label">FIND YOUR FLOW ${icon("pomodoro")}</div><div class="focus-summary"><div><h3>One thing at a time.</h3><p>A little focus goes a long way.</p></div><span class="focus-dial">25<small>MIN</small></span></div><button class="focus-start">Start a focus session ${icon("arrow")}</button>`;
  focus.querySelector("button").onclick = () => manager.open("pomodoro");
  widgets.appendChild(focus);
  const updateFocus = (s) => {
    focus.querySelector(".focus-dial").innerHTML =
      `${Math.ceil(s.remaining / 60)}<small>MIN</small>`;
    focus.querySelector(".focus-summary h3").textContent = s.endAt
      ? s.mode === "focus"
        ? "You’re in your element."
        : "A moment to recharge."
      : "One thing at a time.";
    focus.querySelector(".focus-start").innerHTML =
      `${s.endAt ? "View your session" : s.remaining < s.total ? "Resume your session" : "Start a focus session"} ${icon("arrow")}`;
  };
  bus.on("focus-tick", updateFocus);
  updateFocus(focusTimer.snapshot());
  const note = widgets.querySelector(".widget-quick-note");
  note.querySelector("h3").innerHTML = `SCRATCHPAD ${icon("notes")}`;
  note.querySelector("textarea").placeholder = "An idea worth keeping…";
  note
    .querySelector("textarea")
    .setAttribute("aria-label", "Desktop scratchpad");
  note.insertAdjacentHTML(
    "beforeend",
    '<span class="scratch-saved">Saved on this device <span>↗</span></span>',
  );

  const bottom = document.createElement("div");
  bottom.className = "desktop-bottom";
  bottom.innerHTML = `<span><i></i> <span id="connection-label">Local workspace</span></span><div class="wallpaper-picker" aria-label="Wallpaper">${["orbit", "midnight", "forest", "sunrise", "ocean"].map((w) => `<button data-wall="${w}" title="${wallpapers[w].name} wallpaper" aria-label="${wallpapers[w].name} wallpaper" style="background:${wallpapers[w].css}"></button>`).join("")}</div><button id="desktop-reveal">Show desktop <kbd>Ctrl Shift D</kbd></button>`;
  os.appendChild(bottom);
  bottom
    .querySelectorAll("[data-wall]")
    .forEach((b) => (b.onclick = () => theme.setWallpaper(b.dataset.wall)));
  bottom.querySelector("#desktop-reveal").onclick = () => manager.showDesktop();

  const overview = document.createElement("section");
  overview.className = "orbit-overview";
  overview.hidden = true;
  overview.innerHTML = `<div class="overview-backdrop"></div><div class="overview-panel" role="dialog" aria-modal="true" aria-label="Window overview"><div class="overview-heading"><div><div class="home-eyebrow">A LITTLE PERSPECTIVE</div><h2>Your open spaces.</h2></div><button class="btn" id="overview-close">Done <kbd>Esc</kbd></button></div><div class="overview-spaces"></div><div class="overview-windows"></div><div class="overview-footer"><span>Switch apps or move them to another space.</span><button class="btn" id="tile-windows">${icon("grid")} Tile this workspace</button></div></div>`;
  os.appendChild(overview);
  let release;
  const closeOverview = () => {
    overview.hidden = true;
    release?.();
    release = null;
  };
  const renderOverview = () => {
    const list = manager.list().filter((r) => !r.closing);
    overview.querySelector(".overview-spaces").innerHTML = spaces
      .map(
        (s, i) =>
          `<button data-switch="${i}" class="${manager.workspace() === i ? "selected" : ""}"><span>0${i + 1}</span><strong>${s}</strong><small>${list.filter((r) => r.state.workspace === i).length} apps</small></button>`,
      )
      .join("");
    overview.querySelectorAll("[data-switch]").forEach(
      (b) =>
        (b.onclick = () => {
          manager.switchWorkspace(+b.dataset.switch);
          renderOverview();
        }),
    );
    const current = list.filter(
      (r) => r.state.workspace === manager.workspace(),
    );
    overview.querySelector(".overview-windows").innerHTML = current.length
      ? current
          .map(
            (r) =>
              `<article class="overview-card"><button data-focus="${r.id}"><span class="overview-app-icon" data-app="${r.id}">${r.app.icon}</span><h3>${escape(r.app.name)}</h3><p>${r.state.minimized ? "Minimized" : "Ready to pick up where you left off"}</p></button><label>Move to <select data-move="${r.id}" aria-label="Move ${escape(r.app.name)} to workspace">${spaces.map((s, i) => `<option value="${i}" ${i === manager.workspace() ? "selected" : ""}>${s}</option>`).join("")}</select></label></article>`,
          )
          .join("")
      : '<div class="overview-empty">Room to think.<p>Open an app in this workspace to get started.</p><button class="btn" id="overview-launch">Explore apps</button></div>';
    overview.querySelectorAll("[data-focus]").forEach(
      (b) =>
        (b.onclick = () => {
          manager.focus(b.dataset.focus);
          closeOverview();
        }),
    );
    overview.querySelectorAll("[data-move]").forEach(
      (b) =>
        (b.onchange = () => {
          manager.moveToWorkspace(b.dataset.move, +b.value);
          renderOverview();
        }),
    );
    const launch = overview.querySelector("#overview-launch");
    if (launch)
      launch.onclick = () => {
        closeOverview();
        bus.emit("launcher-open");
      };
  };
  const openOverview = () => {
    bus.emit("launcher-close");
    renderOverview();
    overview.hidden = false;
    release?.();
    release = trapFocus(overview.querySelector(".overview-panel"));
    overview.querySelector("#overview-close").focus();
  };
  bar.querySelector("#overview-open").onclick = openOverview;
  overview.querySelector("#overview-close").onclick = closeOverview;
  overview.querySelector(".overview-backdrop").onclick = closeOverview;
  overview.querySelector("#tile-windows").onclick = () => {
    manager.tile();
    closeOverview();
  };
  bus.on("escape", closeOverview);
  bus.on("overview-open", openOverview);
  const update = () => {
    const name =
      manager.list().find((r) => r.id === manager.focused())?.app.name ||
      "Finder";
    bar.querySelector("#active-app").textContent = name;
    bar.querySelectorAll("[data-space]").forEach((b) => {
      b.lastChild.textContent = spaces[+b.dataset.space];
      b.setAttribute(
        "aria-pressed",
        String(+b.dataset.space === manager.workspace()),
      );
    });
    const pending = store.get().tasks.filter((t) => !t.done);
    today.querySelector("#agenda-count").textContent = pending.length
      ? `${pending.length} thing${pending.length === 1 ? "" : "s"} on your list`
      : "A little breathing room";
    today.querySelector("#agenda-sub").textContent =
      pending[0]?.text || "Plan something good today";
    bottom
      .querySelectorAll("[data-wall]")
      .forEach((b) =>
        b.setAttribute(
          "aria-pressed",
          String(b.dataset.wall === store.get().prefs.wallpaper),
        ),
      );
  };
  [
    "window-open",
    "window-close",
    "window-focus",
    "window-minimize",
    "workspace-change",
    "state-change",
  ].forEach((event) => bus.on(event, update));
  const tick = () => {
    const now = new Date();
    today.querySelector("#orbit-time").textContent = now.toLocaleTimeString(
      [],
      { hour: "2-digit", minute: "2-digit", hour12: false },
    );
    today.querySelector("#orbit-date").textContent = now.toLocaleDateString(
      [],
      { weekday: "long", month: "long", day: "numeric" },
    );
    bar.querySelector("#system-time").textContent =
      now.toLocaleDateString([], { weekday: "short" }) +
      " " +
      now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    today.querySelector(".week-strip").innerHTML = Array.from(
      { length: 7 },
      (_, i) => {
        const d = new Date(now);
        d.setDate(now.getDate() - ((now.getDay() + 6) % 7) + i);
        return `<span class="${d.toDateString() === now.toDateString() ? "current" : ""}"><small>${d.toLocaleDateString("en", { weekday: "narrow" })}</small><b>${d.getDate()}</b></span>`;
      },
    ).join("");
  };
  tick();
  update();
  setInterval(tick, 15000);
  initMacShell();
  document.addEventListener("keydown", (e) => {
    if (!(e.ctrlKey || e.metaKey) || !e.shiftKey) return;
    if (e.key.toLowerCase() === "o") {
      e.preventDefault();
      overview.hidden ? openOverview() : closeOverview();
    }
    if (e.key.toLowerCase() === "d") {
      e.preventDefault();
      manager.showDesktop();
    }
    if (["1", "2", "3"].includes(e.key)) {
      e.preventDefault();
      manager.switchWorkspace(+e.key - 1);
    }
  });
}
