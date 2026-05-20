import { store } from "../core/state.js";

export default {
  id: "tasks",
  name: "Tasks",
  icon: "✅",
  category: "Productivity",
  defaultSize: { w: 680, h: 540 },
  keywords: ["todo", "task", "calendar", "events"],
  mount(container) {
    const el = document.createElement("div");
    el.className = "app tasks-app app-content";
    el.innerHTML = `
      <div class="tasks-header">
        <h2>Tasks</h2>
        <div class="tasks-tabs">
          <button class="tasks-tab active" data-tab="all">All</button>
          <button class="tasks-tab" data-tab="open">Open</button>
          <button class="tasks-tab" data-tab="done">Done</button>
          <button class="tasks-tab" data-tab="today">Today</button>
        </div>
      </div>
      <div class="tasks-input-row">
        <input class="input" id="t-input" placeholder="Add a task (press Enter)…" />
        <input class="input" id="t-when" type="date" style="max-width:160px" />
        <button class="btn primary" id="t-add">Add</button>
      </div>
      <div class="tasks-list" id="t-list"></div>
      <div>
        <div class="cal-header">
          <button class="btn ghost" id="cal-prev">‹</button>
          <h3 id="cal-title">—</h3>
          <button class="btn ghost" id="cal-next">›</button>
        </div>
        <div class="cal" id="cal"></div>
      </div>
    `;
    container.appendChild(el);

    const $input = el.querySelector("#t-input");
    const $when = el.querySelector("#t-when");
    const $add = el.querySelector("#t-add");
    const $list = el.querySelector("#t-list");
    const $cal = el.querySelector("#cal");
    const $calTitle = el.querySelector("#cal-title");

    let filter = "all";
    let calRef = new Date(); calRef.setDate(1);

    const tasks = () => store.get().tasks;

    const renderList = () => {
      let list = [...tasks()];
      if (filter === "open") list = list.filter((t) => !t.done);
      else if (filter === "done") list = list.filter((t) => t.done);
      else if (filter === "today") {
        const today = ymd(new Date());
        list = list.filter((t) => t.when === today);
      }
      list.sort((a, b) => Number(a.done) - Number(b.done) || (a.when || "").localeCompare(b.when || "") || b.createdAt - a.createdAt);

      if (!list.length) {
        $list.innerHTML = `<div class="app-empty"><div class="em-icon">🌤</div><div class="em-title">Nothing here</div><div class="em-sub">Add a task above to get started.</div></div>`;
        return;
      }
      $list.innerHTML = list.map((t) => `
        <div class="task-row ${t.done ? "done" : ""}" data-id="${t.id}">
          <div class="checkbox ${t.done ? "checked" : ""}">${t.done ? "✓" : ""}</div>
          <div class="label">${escape(t.text)}</div>
          ${t.when ? `<div class="when">${formatDate(t.when)}</div>` : ""}
          <button class="btn ghost" data-del aria-label="Delete">✕</button>
        </div>
      `).join("");
      $list.querySelectorAll(".task-row").forEach((row) => {
        const id = row.dataset.id;
        row.querySelector(".checkbox").addEventListener("click", () => toggle(id));
        row.querySelector("[data-del]").addEventListener("click", () => del(id));
      });
    };

    const renderCal = () => {
      const y = calRef.getFullYear(), m = calRef.getMonth();
      $calTitle.textContent = calRef.toLocaleDateString(undefined, { month: "long", year: "numeric" });
      const start = new Date(y, m, 1);
      const startDay = start.getDay();
      const daysInMonth = new Date(y, m + 1, 0).getDate();
      const prevDays = new Date(y, m, 0).getDate();
      const today = ymd(new Date());
      const dueDates = new Set(tasks().filter((t) => !t.done && t.when).map((t) => t.when));
      const cells = [];
      const days = ["S", "M", "T", "W", "T", "F", "S"];
      for (const d of days) cells.push(`<div class="day-name">${d}</div>`);
      for (let i = 0; i < startDay; i++) {
        const day = prevDays - startDay + 1 + i;
        cells.push(`<div class="day dim">${day}</div>`);
      }
      for (let d = 1; d <= daysInMonth; d++) {
        const date = ymd(new Date(y, m, d));
        const has = dueDates.has(date);
        const isToday = date === today;
        cells.push(`<div class="day ${isToday ? "today" : ""} ${has ? "has" : ""}" data-date="${date}">${d}</div>`);
      }
      // Trailing cells
      while (cells.length % 7 !== 0) {
        const after = cells.length - (7 + startDay + daysInMonth) + 1;
        cells.push(`<div class="day dim">${after}</div>`);
      }
      $cal.innerHTML = cells.join("");
      $cal.querySelectorAll(".day[data-date]").forEach((d) => {
        d.addEventListener("click", () => {
          $when.value = d.dataset.date;
          $input.focus();
        });
      });
    };

    const add = () => {
      const text = $input.value.trim();
      if (!text) return;
      const t = { id: crypto.randomUUID?.() || String(Math.random()).slice(2), text, done: false, when: $when.value || "", createdAt: Date.now() };
      store.update((s) => { s.tasks.push(t); });
      $input.value = ""; $when.value = "";
      renderList(); renderCal();
    };

    const toggle = (id) => {
      store.update((s) => {
        const t = s.tasks.find((x) => x.id === id);
        if (t) t.done = !t.done;
      });
      renderList(); renderCal();
    };
    const del = (id) => {
      store.update((s) => { s.tasks = s.tasks.filter((x) => x.id !== id); });
      renderList(); renderCal();
    };

    $add.addEventListener("click", add);
    $input.addEventListener("keydown", (e) => { if (e.key === "Enter") add(); });
    el.querySelector("#cal-prev").addEventListener("click", () => { calRef.setMonth(calRef.getMonth() - 1); renderCal(); });
    el.querySelector("#cal-next").addEventListener("click", () => { calRef.setMonth(calRef.getMonth() + 1); renderCal(); });

    el.querySelectorAll(".tasks-tab").forEach((t) => {
      t.addEventListener("click", () => {
        filter = t.dataset.tab;
        el.querySelectorAll(".tasks-tab").forEach((x) => x.classList.toggle("active", x === t));
        renderList();
      });
    });

    renderList();
    renderCal();

    return {
      unmount() { el.remove(); },
    };
  },
};

function ymd(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function formatDate(s) { const d = new Date(s + "T00:00:00"); return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
function escape(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
