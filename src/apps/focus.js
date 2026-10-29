import { store } from "../core/state.js";
import { escape } from "../ui/icons.js";
import { bus } from "../core/event-bus.js";
import { focusTimer } from "../core/focus-timer.js";

export default {
  id: "pomodoro",
  name: "Pomodoro",
  category: "Productivity",
  icon: "◷",
  defaultSize: { w: 440, h: 560 },
  keywords: ["focus", "timer", "pomodoro", "break"],
  mount(container) {
    const el = document.createElement("div");
    el.className = "app pomo-app orbit-pomo";
    el.innerHTML = `<div class="home-eyebrow">LESS NOISE. MORE MOMENTUM.</div><h1>A moment of focus.</h1><div class="pomo-modes"><button data-mode="focus" class="pomo-mode">Focus</button><button data-mode="short" class="pomo-mode">Short break</button><button data-mode="long" class="pomo-mode">Long break</button></div><div class="pomo-ring"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="220" height="220"><circle cx="100" cy="100" r="88" stroke="var(--border-strong)" stroke-width="3" fill="none"/><circle id="pomo-progress" cx="100" cy="100" r="88" stroke="var(--accent)" stroke-width="3" fill="none" stroke-dasharray="552.92" stroke-linecap="round" transform="rotate(-90 100 100)"/></svg><div class="pomo-time" id="pomo-time">25:00</div></div><p class="focus-caption">One task. A little space. You have this.</p><div class="pomo-row"><button class="btn primary" id="pomo-start">Start session</button><button class="btn" id="pomo-skip">Skip</button><button class="btn ghost" id="pomo-reset">Reset</button></div><div class="pomo-stats"><span>Completed sessions <strong id="pomo-done">0</strong></span><span>Continues when this window closes</span></div>`;
    container.appendChild(el);
    const detail = document.createElement("div");
    detail.className = "focus-task-detail";
    el.append(detail);
    const renderDetail = () => {
      const task = store
        .get()
        .tasks.find((t) => t.id === store.get().focusTaskId);
      detail.innerHTML = `<label>Focus on<select class="select" aria-label="Focus task"><option value="">Open focus</option>${store
        .get()
        .tasks.filter((t) => !t.done)
        .map(
          (t) =>
            `<option value="${escape(t.id)}" ${t.id === task?.id ? "selected" : ""}>${escape(t.text)}</option>`,
        )
        .join("")}</select></label><h4>Recent sessions</h4>${
        (store.get().focusHistory || [])
          .slice(-4)
          .reverse()
          .map(
            (h) =>
              `<p>${h.minutes} min · ${new Date(h.completedAt).toLocaleDateString()} · ${escape(store.get().tasks.find((t) => t.id === h.taskId)?.text || "Open focus")}</p>`,
          )
          .join("") || "<p>No completed sessions yet.</p>"
      }`;
      detail.querySelector("select").onchange = (e) =>
        store.update((s) => (s.focusTaskId = e.target.value));
    };
    const offDetail = bus.on("state-change", renderDetail);
    renderDetail();
    function render(s) {
      el.querySelector("#pomo-time").textContent =
        `${String(Math.floor(s.remaining / 60)).padStart(2, "0")}:${String(s.remaining % 60).padStart(2, "0")}`;
      el.querySelector("#pomo-progress").setAttribute(
        "stroke-dashoffset",
        String(552.92 * (1 - s.remaining / s.total)),
      );
      el.querySelector("#pomo-start").textContent = s.endAt
        ? "Pause"
        : s.remaining < s.total
          ? "Resume"
          : "Start session";
      el.querySelector("#pomo-done").textContent = s.completed;
      el.querySelectorAll("[data-mode]").forEach((b) => {
        b.classList.toggle("active", b.dataset.mode === s.mode);
        b.setAttribute("aria-pressed", String(b.dataset.mode === s.mode));
      });
    }
    el.querySelectorAll("[data-mode]").forEach(
      (b) => (b.onclick = () => focusTimer.mode(b.dataset.mode)),
    );
    el.querySelector("#pomo-start").onclick = () => focusTimer.toggle();
    el.querySelector("#pomo-skip").onclick = () => focusTimer.skip();
    el.querySelector("#pomo-reset").onclick = () => focusTimer.reset();
    const unsub = bus.on("focus-tick", render);
    render(focusTimer.snapshot());
    return {
      unmount() {
        offDetail();
        unsub();
        el.remove();
      },
    };
  },
};
