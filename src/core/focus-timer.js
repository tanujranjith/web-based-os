import { store } from "./state.js";
import { bus } from "./event-bus.js";

export const durations = { focus: 1500, short: 300, long: 900 };
const initial = () => ({
  mode: "focus",
  remaining: 1500,
  endAt: null,
  completed: 0,
});
function state() {
  return store.get().focusTimer || initial();
}
function change(fn) {
  store.update((s) => {
    s.focusTimer ||= initial();
    fn(s.focusTimer);
  });
  bus.emit("focus-tick", focusTimer.snapshot());
}
function finish(count = true) {
  if (count && state().mode === "focus")
    store.update((s) => {
      s.focusHistory ??= [];
      s.focusHistory.push({
        id: crypto.randomUUID(),
        taskId: s.focusTaskId || null,
        completedAt: Date.now(),
        minutes: 25,
      });
      s.focusHistory = s.focusHistory.slice(-500);
    });
  change((s) => {
    if (s.mode === "focus") {
      if (count) s.completed++;
      s.mode = count && s.completed % 4 === 0 ? "long" : "short";
    } else s.mode = "focus";
    s.remaining = durations[s.mode];
    s.endAt = null;
  });
}
export const focusTimer = {
  snapshot() {
    const s = state();
    return {
      ...s,
      remaining: s.endAt
        ? Math.max(0, Math.ceil((s.endAt - Date.now()) / 1000))
        : s.remaining,
      total: durations[s.mode],
    };
  },
  toggle() {
    change((s) => {
      if (s.endAt) {
        s.remaining = Math.max(0, Math.ceil((s.endAt - Date.now()) / 1000));
        s.endAt = null;
      } else s.endAt = Date.now() + s.remaining * 1000;
    });
  },
  mode(mode) {
    if (!durations[mode]) return;
    change((s) => {
      s.mode = mode;
      s.remaining = durations[mode];
      s.endAt = null;
    });
  },
  reset() {
    this.mode(state().mode);
  },
  skip() {
    finish(false);
  },
};
setInterval(() => {
  const s = focusTimer.snapshot();
  if (s.endAt && s.remaining === 0) {
    finish();
    bus.emit("notify", {
      title:
        s.mode === "focus"
          ? "A little progress. Well earned."
          : "Ready for another round?",
      body:
        s.mode === "focus"
          ? "Your focus session is complete. Take a break."
          : "Your break is over. Start when you are ready.",
    });
  } else bus.emit("focus-tick", s);
}, 500);
