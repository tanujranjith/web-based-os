import { store } from "./state.js";
export const statuses = ["ideas", "doing", "done"];
export function migrateBoard() {
  store.update((s) => {
    for (const card of s.board || []) {
      if (!s.tasks.some((t) => t.legacyCardId === card.id))
        s.tasks.push({
          ...card,
          id: crypto.randomUUID(),
          legacyCardId: card.id,
          text: card.title,
          done: card.status === "done",
          status: card.status,
          project: "Projects",
          when: card.when || "",
          subtasks: [],
        });
    }
    s.board = [];
    for (const t of s.tasks) {
      t.status ??= t.done ? "done" : "ideas";
      t.priority ??= "Normal";
      t.subtasks ??= [];
    }
  });
}
export function addTask(input) {
  const text = String(input.text || "").trim();
  if (!text) throw new Error("Give your task a title.");
  const task = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    text,
    when: "",
    priority: "Normal",
    status: "ideas",
    done: false,
    project: "",
    description: "",
    subtasks: [],
    ...input,
    text,
  };
  store.update((s) => s.tasks.push(task));
  return task;
}
export function updateTask(id, patch) {
  store.update((s) => {
    const t = s.tasks.find((t) => t.id === id);
    if (!t) return;
    Object.assign(t, patch);
    if ("done" in patch) t.status = t.done ? "done" : "ideas";
    else if ("status" in patch) t.done = t.status === "done";
  });
}
