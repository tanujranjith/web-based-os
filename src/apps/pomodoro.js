import { bus } from "../core/event-bus.js";

export default {
  id: "pomodoro",
  name: "Pomodoro",
  icon: "🍅",
  category: "Productivity",
  defaultSize: { w: 380, h: 460 },
  keywords: ["focus", "timer", "pomodoro"],
  mount(container) {
    const el = document.createElement("div");
    el.className = "app pomo-app";
    el.innerHTML = `
      <div class="pomo-modes">
        <button data-mode="focus" class="pomo-mode active">Focus</button>
        <button data-mode="short" class="pomo-mode">Short break</button>
        <button data-mode="long" class="pomo-mode">Long break</button>
      </div>
      <div class="pomo-ring">
        <svg viewBox="0 0 200 200" width="220" height="220">
          <circle cx="100" cy="100" r="88" stroke="rgba(255,255,255,0.10)" stroke-width="10" fill="none"/>
          <circle id="pomo-progress" cx="100" cy="100" r="88" stroke="var(--accent)" stroke-width="10" fill="none"
            stroke-dasharray="552.92" stroke-dashoffset="552.92" stroke-linecap="round"
            transform="rotate(-90 100 100)" />
        </svg>
        <div class="pomo-time" id="pomo-time">25:00</div>
      </div>
      <div class="pomo-row">
        <button class="btn primary" id="pomo-start">Start</button>
        <button class="btn" id="pomo-skip">Skip</button>
        <button class="btn ghost" id="pomo-reset">Reset</button>
      </div>
      <div class="pomo-stats">
        <span>Round <strong id="pomo-round">1</strong>/4</span>
        <span>Completed: <strong id="pomo-done">0</strong></span>
      </div>
    `;
    container.appendChild(el);

    const durations = { focus: 25 * 60, short: 5 * 60, long: 15 * 60 };
    let mode = "focus", round = 1, done = 0;
    let total = durations[mode], remain = total, running = false, raf, start = 0;

    const $time = el.querySelector("#pomo-time");
    const $ring = el.querySelector("#pomo-progress");
    const $startBtn = el.querySelector("#pomo-start");
    const $round = el.querySelector("#pomo-round");
    const $doneEl = el.querySelector("#pomo-done");

    const CIRC = 2 * Math.PI * 88;
    $ring.setAttribute("stroke-dasharray", CIRC);

    const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
    const setMode = (m) => {
      mode = m;
      total = durations[m]; remain = total;
      el.querySelectorAll(".pomo-mode").forEach((b) => b.classList.toggle("active", b.dataset.mode === m));
      render();
    };
    const render = () => {
      $time.textContent = fmt(remain);
      const pct = 1 - remain / total;
      $ring.setAttribute("stroke-dashoffset", String(CIRC * (1 - pct)));
      $round.textContent = round;
      $doneEl.textContent = done;
    };
    const tick = () => {
      if (!running) return;
      const elapsed = (Date.now() - start) / 1000;
      remain = Math.max(0, total - elapsed);
      render();
      if (remain <= 0) {
        running = false;
        if (mode === "focus") {
          done++;
          bus.emit("notify", { title: "Pomodoro", body: "Focus block complete. Take a break!" });
          setMode(round % 4 === 0 ? "long" : "short");
          round = round % 4 + 1;
        } else {
          bus.emit("notify", { title: "Pomodoro", body: "Break done. Back to focus." });
          setMode("focus");
        }
        $startBtn.textContent = "Start";
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    el.querySelectorAll(".pomo-mode").forEach((b) => b.addEventListener("click", () => { running = false; setMode(b.dataset.mode); $startBtn.textContent = "Start"; }));
    $startBtn.addEventListener("click", () => {
      if (running) { running = false; total = remain; $startBtn.textContent = "Resume"; return; }
      start = Date.now();
      running = true;
      $startBtn.textContent = "Pause";
      raf = requestAnimationFrame(tick);
    });
    el.querySelector("#pomo-skip").addEventListener("click", () => { running = false; remain = 0; if (raf) cancelAnimationFrame(raf); tick(); });
    el.querySelector("#pomo-reset").addEventListener("click", () => { running = false; remain = total; render(); $startBtn.textContent = "Start"; });

    render();
    return { unmount() { running = false; if (raf) cancelAnimationFrame(raf); el.remove(); } };
  },
};
