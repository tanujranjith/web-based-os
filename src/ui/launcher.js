import { registry } from "../core/app-registry.js";
import { manager } from "../core/window-manager.js";
import { bus } from "../core/event-bus.js";
import { trapFocus } from "./focus-trap.js";

let el, input, grid, activeIndex = 0, filtered = [];
let releaseTrap = null;

export function initLauncher() {
  el = document.getElementById("launcher");
  input = document.getElementById("launcher-input");
  grid = document.getElementById("launcher-grid");

  document.getElementById("dock-launcher").addEventListener("click", () => toggle());
  el.querySelector('[data-close="launcher"]').addEventListener("click", close);

  input.addEventListener("input", () => { activeIndex = 0; render(); });
  input.addEventListener("keydown", onKey);
  bus.on("launcher-toggle", toggle);
  bus.on("escape", () => { if (!el.hidden) close(); });
  bus.on("launcher-open", open);
  bus.on("launcher-close", close);
}

function onKey(e) {
  const cols = computeCols();
  if (e.key === "Enter") {
    e.preventDefault();
    const a = filtered[activeIndex];
    if (a) launch(a.id);
  } else if (e.key === "ArrowDown") {
    e.preventDefault();
    activeIndex = Math.min(filtered.length - 1, activeIndex + cols);
    render();
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    activeIndex = Math.max(0, activeIndex - cols);
    render();
  } else if (e.key === "ArrowRight") {
    e.preventDefault();
    activeIndex = Math.min(filtered.length - 1, activeIndex + 1);
    render();
  } else if (e.key === "ArrowLeft") {
    e.preventDefault();
    activeIndex = Math.max(0, activeIndex - 1);
    render();
  }
}

function computeCols() {
  const w = grid.clientWidth || 600;
  return Math.max(1, Math.floor(w / 120));
}

function render() {
  const q = input.value.trim().toLowerCase();
  const all = registry.all();
  filtered = q
    ? all.filter((a) => a.name.toLowerCase().includes(q) || (a.category || "").toLowerCase().includes(q) || (a.keywords || []).some((k) => k.toLowerCase().includes(q)))
    : all;

  grid.innerHTML = filtered.map((a, i) => `
    <button class="launcher-card ${i === activeIndex ? "active" : ""}" data-app="${a.id}">
      <span class="glyph">${a.icon || "▣"}</span>
      <span class="label">${escape(a.name)}</span>
      <span class="cat">${escape(a.category || "")}</span>
    </button>
  `).join("");

  grid.querySelectorAll(".launcher-card").forEach((btn) => {
    btn.addEventListener("click", () => launch(btn.dataset.app));
  });

  if (!filtered.length) {
    grid.innerHTML = `<div class="app-empty" style="grid-column: 1/-1"><div class="em-icon">🔎</div><div class="em-title">No matches</div><div class="em-sub">Try a different keyword.</div></div>`;
  }
}

function open() {
  el.hidden = false;
  input.value = "";
  activeIndex = 0;
  render();
  setTimeout(() => input.focus(), 30);
  releaseTrap = trapFocus(el.querySelector(".launcher-panel"));
}
function close() {
  el.hidden = true;
  releaseTrap?.(); releaseTrap = null;
}
function toggle() {
  if (el.hidden) open(); else close();
}
function launch(id) {
  close();
  manager.open(id);
}

function escape(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
