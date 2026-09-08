import { store } from "../core/state.js";
import { bus } from "../core/event-bus.js";
import { sound } from "../core/sound.js";
import { theme } from '../core/theme.js';
import { manager } from '../core/window-manager.js';

let toastsEl;
let ncListEl;
let ncEl;
let dot;

export function initNotifications() {
  toastsEl = document.getElementById("notifications-toasts");
  ncListEl = document.getElementById("nc-list");
  ncEl = document.getElementById("notification-center");
  dot = document.getElementById("tray-notif-dot");

  document.getElementById("tray-notifications").addEventListener("click", toggleCenter);
  document.querySelector('[data-close="nc"]').addEventListener("click", closeCenter);
  document.getElementById("nc-clear").addEventListener("click", () => {
    store.update((s) => { s.notifications = []; });
    renderCenter();
    updateDot();
  });

  bus.on("notify", notify);
  bus.on('quick-setting', ({key}) => {
    if(key==='theme') theme.setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark');
    if(key==='reduce-motion') theme.toggleReduceMotion();
    if(key==='wallpaper') { closeCenter(); manager.open('settings',{tab:'appearance'}); }
    if(key==='reset' && confirm('Reset all data for the current profile?')) { store.reset(); location.reload(); }
  });
  bus.on("escape", () => { if (!ncEl.hidden) closeCenter(); });

  // Quick settings buttons handled by their owners — we just dispatch events
  ncEl.querySelectorAll(".nc-quick-grid button").forEach((b) => {
    b.addEventListener("click", () => bus.emit("quick-setting", { key: b.dataset.quick }));
  });

  renderCenter();
  updateDot();
}

export function notify({ title, body, icon }) {
  const t = { id: crypto.randomUUID?.() || String(Date.now()), title, body, icon, at: Date.now() };
  store.update((s) => { s.notifications = [t, ...s.notifications].slice(0, 50); });
  if (!store.get().prefs.doNotDisturb) showToast(t);
  if (ncEl && !ncEl.hidden) renderCenter();
  updateDot();
  if (!store.get().prefs.doNotDisturb) sound.notify();
}

function showToast(t) {
  const el = document.createElement("div");
  el.className = "toast";
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "polite");
  el.innerHTML = `<div class="t-title">${escape(t.title || "Notification")}</div>${t.body ? `<div class="t-body">${escape(t.body)}</div>` : ""}`;
  toastsEl.appendChild(el);
  setTimeout(() => {
    el.classList.add("fade-out");
    setTimeout(() => el.remove(), 250);
  }, 3600);
}

function renderCenter() {
  const list = store.get().notifications;
  if (!list.length) {
    ncListEl.innerHTML = `<div class="nc-empty">No notifications.</div>`;
    return;
  }
  ncListEl.innerHTML = list.map((t) => `
    <div class="nc-item">
      <div class="nc-title">${escape(t.title || "")}</div>
      ${t.body ? `<div class="nc-body">${escape(t.body)}</div>` : ""}
      <div class="nc-time">${timeAgo(t.at)}</div>
    </div>
  `).join("");
}

function updateDot() {
  const n = store.get().notifications.length;
  dot.hidden = n === 0;
}

function toggleCenter() {
  if (ncEl.hidden) openCenter(); else closeCenter();
}
function openCenter() {
  renderCenter();
  ncEl.hidden = false;
}
function closeCenter() { ncEl.hidden = true; }

function timeAgo(ts) {
  const d = Math.floor((Date.now() - ts) / 1000);
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return new Date(ts).toLocaleDateString();
}
function escape(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
