import { store } from "../core/state.js";
import { bus } from "../core/event-bus.js";
import { addTask, updateTask, statuses } from "../core/tasks.js";
import { escape } from "../ui/icons.js";
export default {
  id: "board",
  name: "Project Board",
  category: "Productivity",
  keywords: ["kanban", "projects", "board"],
  defaultSize: { w: 1100, h: 700 },
  mount(container, ctx) {
    const el = document.createElement("div");
    el.className = "app board-workbench";
    el.innerHTML = `<header class="workbench-heading"><div><small>A CLEARER VIEW</small><h1>Project board</h1><p>The same tasks, a different perspective.</p></div><button class="btn primary" data-add>New task</button></header><div class="app-toolbar"><input class="input" placeholder="Search tasks or projects" aria-label="Search board"><select class="select" aria-label="Filter project"><option value="">All projects</option></select></div><div class="board-columns"></div>`;
    container.append(el);
    function render() {
      const q = el.querySelector("input").value.toLowerCase(),
        project = el.querySelector("select").value;
      const all = store.get().tasks,
        projects = [...new Set(all.map((t) => t.project).filter(Boolean))];
      el.querySelector("select").innerHTML =
        '<option value="">All projects</option>' +
        projects
          .map(
            (p) =>
              `<option ${p === project ? "selected" : ""}>${escape(p)}</option>`,
          )
          .join("");
      el.querySelector(".board-columns").innerHTML = statuses
        .map((status, i) => {
          const tasks = all.filter(
            (t) =>
              (t.status || (t.done ? "done" : "ideas")) === status &&
              (!project || t.project === project) &&
              [t.text, t.description, t.project]
                .join(" ")
                .toLowerCase()
                .includes(q),
          );
          return `<section class="board-column" data-column="${status}"><header><h3>${["To do", "In progress", "Done"][i]}</h3><span>${tasks.length}</span></header><div class="board-card-list">${tasks.map((t) => `<article class="board-card" draggable="true" data-id="${escape(t.id)}"><small>${escape(t.project || "PERSONAL")} · ${escape(t.priority || "Normal")}</small><button class="board-card-title" data-edit="${escape(t.id)}">${escape(t.text)}</button><p>${escape(t.description || "")}</p>${t.when ? `<small>Due ${escape(t.when)}</small>` : ""}<select data-status="${escape(t.id)}" aria-label="Move ${escape(t.text)}">${statuses.map((x, j) => `<option value="${x}" ${x === status ? "selected" : ""}>${["To do", "In progress", "Done"][j]}</option>`).join("")}</select></article>`).join("") || '<p class="board-empty">Drop a task here</p>'}</div></section>`;
        })
        .join("");
      el.querySelectorAll("[data-id]").forEach(
        (c) =>
          (c.ondragstart = (e) =>
            e.dataTransfer.setData("text/nova-task", c.dataset.id)),
      );
      el.querySelectorAll("[data-column]").forEach((c) => {
        c.ondragover = (e) => e.preventDefault();
        c.ondrop = (e) => {
          e.preventDefault();
          updateTask(e.dataTransfer.getData("text/nova-task"), {
            status: c.dataset.column,
          });
        };
      });
      el.querySelectorAll("[data-status]").forEach(
        (s) =>
          (s.onchange = () =>
            updateTask(s.dataset.status, { status: s.value })),
      );
      el.querySelectorAll("[data-edit]").forEach(
        (b) =>
          (b.onclick = () => ctx.openApp("tasks", { taskId: b.dataset.edit })),
      );
    }
    el.querySelector("input").oninput = render;
    el.querySelector("select").onchange = render;
    el.querySelector("[data-add]").onclick = () => {
      const text = prompt("Task title");
      if (text?.trim()) {
        const task = addTask({
          text,
          project: el.querySelector("select").value,
        });
        ctx.openApp("tasks", { taskId: task.id });
      }
    };
    const off = bus.on("state-change", render);
    render();
    return {
      unmount() {
        off();
        el.remove();
      },
    };
  },
};
