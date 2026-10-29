import { store } from "../core/state.js";
import { bus } from "../core/event-bus.js";
import { dateKey } from "../core/calendar.js";
import { addTask, updateTask } from "../core/tasks.js";
import { escape } from "../ui/icons.js";
export default {
  id: "tasks",
  name: "Tasks",
  category: "Productivity",
  keywords: ["todo", "task", "project"],
  defaultSize: { w: 920, h: 680 },
  mount(container, ctx) {
    const el = document.createElement("div");
    el.className = "app task-workbench";
    el.innerHTML = `<header class="workbench-heading"><div><small>YOUR WORK, IN VIEW</small><h1>Tasks</h1></div><button class="btn" data-calendar>Open Calendar</button></header><div class="app-toolbar"><input class="input" data-add placeholder="What needs doing?" aria-label="New task"><input class="input" type="date" data-due aria-label="Due date"><button class="btn primary" data-create>Add task</button></div><div class="app-toolbar"><select class="select" data-filter aria-label="Filter tasks"><option value="open">Open</option><option value="today">Today</option><option value="all">All tasks</option><option value="done">Completed</option></select><input class="input" data-search placeholder="Search tasks or projects" aria-label="Search tasks"></div><div class="task-records scroll-thin"></div><form class="task-detail" hidden><h3>Task details</h3><input class="input" name="text" aria-label="Task title" required><div class="row"><input class="input" type="date" name="when" aria-label="Due date"><select class="select" name="priority" aria-label="Priority"><option>Low</option><option>Normal</option><option>High</option></select><input class="input" name="project" placeholder="Project" aria-label="Project"></div><textarea class="input" name="description" placeholder="Description" aria-label="Description"></textarea><label>Subtasks, one per line<textarea class="input" name="subtasks"></textarea></label><div class="row"><button class="btn" type="button" data-cancel>Cancel</button><button class="btn primary">Save details</button></div></form>`;
    container.append(el);
    const form = el.querySelector("form");
    let editing = null;
    function render() {
      const q = el.querySelector("[data-search]").value.toLowerCase(),
        filter = el.querySelector("[data-filter]").value;
      const tasks = store
        .get()
        .tasks.filter(
          (t) =>
            (filter === "all" || filter === "done"
              ? filter === "all" || t.done
              : !t.done) &&
            (filter !== "today" || t.when === dateKey()) &&
            [t.text, t.project, t.description]
              .join(" ")
              .toLowerCase()
              .includes(q),
        )
        .sort(
          (a, b) =>
            Number(a.done) - Number(b.done) ||
            ["High", "Normal", "Low"].indexOf(a.priority) -
              ["High", "Normal", "Low"].indexOf(b.priority) ||
            (a.when || "9999").localeCompare(b.when || "9999"),
        );
      el.querySelector(".task-records").innerHTML =
        tasks
          .map(
            (t) =>
              `<article class="task-record ${t.done ? "done" : ""}"><input type="checkbox" data-check="${escape(t.id)}" ${t.done ? "checked" : ""} aria-label="Complete ${escape(t.text)}"><button class="task-title" data-edit="${escape(t.id)}"><strong>${escape(t.text)}</strong><small>${escape([t.project, t.priority, t.when].filter(Boolean).join(" · "))}</small></button><span class="priority-dot ${t.priority}"></span><button class="btn" data-focus="${escape(t.id)}" aria-label="Focus on ${escape(t.text)}">◷</button><button class="btn" data-delete="${escape(t.id)}" aria-label="Delete ${escape(t.text)}">×</button>${(t.subtasks || []).map((sub, i) => `<label class="task-subtask"><input type="checkbox" data-sub="${escape(t.id)}" data-index="${i}" ${sub.done ? "checked" : ""}>${escape(sub.text)}</label>`).join("")}</article>`,
          )
          .join("") ||
        '<div class="app-empty"><h3>You’re all caught up.</h3><p>Add a task when something comes to mind.</p></div>';
      el.querySelectorAll("[data-check]").forEach(
        (b) =>
          (b.onchange = () => updateTask(b.dataset.check, { done: b.checked })),
      );
      el.querySelectorAll("[data-edit]").forEach(
        (b) => (b.onclick = () => edit(b.dataset.edit)),
      );
      el.querySelectorAll("[data-sub]").forEach(
        (b) =>
          (b.onchange = () =>
            store.update(
              (s) =>
                (s.tasks.find((t) => t.id === b.dataset.sub).subtasks[
                  +b.dataset.index
                ].done = b.checked),
            )),
      );
      el.querySelectorAll("[data-focus]").forEach(
        (b) =>
          (b.onclick = () => {
            store.update((s) => (s.focusTaskId = b.dataset.focus));
            ctx.openApp("pomodoro");
          }),
      );
      el.querySelectorAll("[data-delete]").forEach(
        (b) =>
          (b.onclick = () => {
            if (confirm("Delete this task?"))
              store.update(
                (s) =>
                  (s.tasks = s.tasks.filter((t) => t.id !== b.dataset.delete)),
              );
          }),
      );
    }
    function edit(id) {
      const t = store.get().tasks.find((t) => t.id === id);
      if (!t) return;
      editing = id;
      for (const name of ["text", "when", "project", "priority", "description"])
        form.elements[name].value = t[name] || "";
      form.elements.subtasks.value = (t.subtasks || [])
        .map((s) => (s.done ? "[x] " : "") + s.text)
        .join("\n");
      form.hidden = false;
      form.elements.text.focus();
    }
    function create() {
      const input = el.querySelector("[data-add]");
      if (!input.value.trim()) return;
      addTask({
        text: input.value,
        when: el.querySelector("[data-due]").value,
      });
      input.value = "";
      input.focus();
    }
    el.querySelector("[data-create]").onclick = create;
    el.querySelector("[data-add]").onkeydown = (e) => {
      if (e.key === "Enter") create();
    };
    el.querySelector("[data-filter]").onchange = render;
    el.querySelector("[data-search]").oninput = render;
    el.querySelector("[data-cancel]").onclick = () => (form.hidden = true);
    el.querySelector("[data-calendar]").onclick = () => ctx.openApp("calendar");
    form.onsubmit = (e) => {
      e.preventDefault();
      const values = Object.fromEntries(new FormData(form));
      values.subtasks = values.subtasks
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => ({
          text: s.replace(/^\[x\]\s*/i, ""),
          done: /^\[x\]/i.test(s),
        }));
      updateTask(editing, values);
      form.hidden = true;
    };
    const off = bus.on("state-change", render);
    render();
    if (ctx.opts.taskId) edit(ctx.opts.taskId);
    return {
      onOpen: (opts) => {
        if (opts.taskId) edit(opts.taskId);
      },
      unmount() {
        off();
        el.remove();
      },
    };
  },
};
