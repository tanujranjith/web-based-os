export default {
  id: "clock",
  name: "Clock",
  icon: "⏰",
  category: "Utilities",
  defaultSize: { w: 520, h: 420 },
  keywords: ["timer", "stopwatch", "alarm", "world"],
  mount(container) {
    const el = document.createElement("div");
    el.className = "app clock-app";
    el.innerHTML = `
      <div class="clock-tabs">
        <button class="clock-tab active" data-tab="world">World</button>
        <button class="clock-tab" data-tab="stopwatch">Stopwatch</button>
        <button class="clock-tab" data-tab="timer">Timer</button>
      </div>
      <div class="clock-body" id="clock-body"></div>
    `;
    container.appendChild(el);
    const body = el.querySelector("#clock-body");
    let active = "world", cleanups = [];

    const renderWorld = () => {
      const zones = [
        { z: "local", label: "Local time", tz: undefined },
        { z: "America/Los_Angeles", label: "San Francisco" },
        { z: "America/New_York", label: "New York" },
        { z: "Europe/London", label: "London" },
        { z: "Europe/Paris", label: "Paris" },
        { z: "Asia/Tokyo", label: "Tokyo" },
        { z: "Asia/Kolkata", label: "Kolkata" },
      ];
      body.innerHTML = `<div class="clock-world">${zones.map((z) => `
        <div class="clock-zone" data-tz="${z.tz || ""}">
          <div class="cz-label">${z.label}</div>
          <div class="cz-time">--:--</div>
          <div class="cz-date">—</div>
        </div>`).join("")}</div>`;
      const tick = () => {
        body.querySelectorAll(".clock-zone").forEach((zEl) => {
          const tz = zEl.dataset.tz || undefined;
          const opts = tz ? { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: tz } : { hour: "2-digit", minute: "2-digit", second: "2-digit" };
          const dopts = tz ? { weekday: "short", month: "short", day: "numeric", timeZone: tz } : { weekday: "short", month: "short", day: "numeric" };
          try {
            zEl.querySelector(".cz-time").textContent = new Date().toLocaleTimeString([], opts);
            zEl.querySelector(".cz-date").textContent = new Date().toLocaleDateString([], dopts);
          } catch { zEl.querySelector(".cz-time").textContent = "—"; }
        });
      };
      tick();
      const id = setInterval(tick, 1000);
      cleanups.push(() => clearInterval(id));
    };

    const renderStopwatch = () => {
      body.innerHTML = `
        <div class="clock-big" id="sw-display">00:00.00</div>
        <div class="clock-row">
          <button class="btn primary" id="sw-start">Start</button>
          <button class="btn" id="sw-lap" disabled>Lap</button>
          <button class="btn" id="sw-reset">Reset</button>
        </div>
        <div class="clock-laps" id="sw-laps"></div>
      `;
      let start = 0, accum = 0, running = false, raf, laps = [];
      const disp = body.querySelector("#sw-display");
      const startBtn = body.querySelector("#sw-start");
      const lapBtn = body.querySelector("#sw-lap");
      const lapsEl = body.querySelector("#sw-laps");
      const fmt = (ms) => {
        const m = Math.floor(ms / 60000).toString().padStart(2, "0");
        const s = Math.floor((ms % 60000) / 1000).toString().padStart(2, "0");
        const cs = Math.floor((ms % 1000) / 10).toString().padStart(2, "0");
        return `${m}:${s}.${cs}`;
      };
      const tick = () => {
        if (!running) return;
        disp.textContent = fmt(performance.now() - start + accum);
        raf = requestAnimationFrame(tick);
      };
      startBtn.addEventListener("click", () => {
        if (running) {
          accum += performance.now() - start;
          running = false;
          startBtn.textContent = "Start";
          startBtn.classList.add("primary");
          lapBtn.disabled = true;
        } else {
          start = performance.now();
          running = true;
          startBtn.textContent = "Stop";
          startBtn.classList.remove("primary");
          lapBtn.disabled = false;
          raf = requestAnimationFrame(tick);
        }
      });
      lapBtn.addEventListener("click", () => {
        if (!running) return;
        laps.unshift(performance.now() - start + accum);
        lapsEl.innerHTML = laps.map((l, i) => `<div class="clock-lap"><span>Lap ${laps.length - i}</span><span>${fmt(l)}</span></div>`).join("");
      });
      body.querySelector("#sw-reset").addEventListener("click", () => {
        running = false; accum = 0; laps = []; lapsEl.innerHTML = "";
        disp.textContent = "00:00.00";
        startBtn.textContent = "Start"; startBtn.classList.add("primary");
        lapBtn.disabled = true;
      });
      cleanups.push(() => { running = false; if (raf) cancelAnimationFrame(raf); });
    };

    const renderTimer = () => {
      body.innerHTML = `
        <div class="clock-big" id="tm-display">00:00</div>
        <div class="clock-row">
          <input class="input clock-num" id="tm-m" type="number" min="0" max="999" value="5" />
          <span class="clock-sep">:</span>
          <input class="input clock-num" id="tm-s" type="number" min="0" max="59" value="0" />
        </div>
        <div class="clock-row">
          <button class="btn primary" id="tm-start">Start</button>
          <button class="btn" id="tm-reset">Reset</button>
        </div>
      `;
      let remain = 0, running = false, end = 0, raf;
      const disp = body.querySelector("#tm-display");
      const startBtn = body.querySelector("#tm-start");
      const mIn = body.querySelector("#tm-m");
      const sIn = body.querySelector("#tm-s");
      const fmt = (ms) => {
        ms = Math.max(0, ms);
        const m = Math.floor(ms / 60000).toString().padStart(2, "0");
        const s = Math.floor((ms % 60000) / 1000).toString().padStart(2, "0");
        return `${m}:${s}`;
      };
      const tick = () => {
        if (!running) return;
        const r = end - Date.now();
        disp.textContent = fmt(r);
        if (r <= 0) {
          running = false;
          startBtn.textContent = "Start"; startBtn.classList.add("primary");
          disp.classList.add("blink");
          import("../ui/notifications.js").then(({ notify }) => notify({ title: "Timer", body: "Time's up!" }));
          try { new AudioContext(); } catch {}
          return;
        }
        raf = requestAnimationFrame(tick);
      };
      startBtn.addEventListener("click", () => {
        if (running) {
          remain = end - Date.now();
          running = false;
          startBtn.textContent = "Resume"; startBtn.classList.add("primary");
        } else {
          if (!remain) remain = ((+mIn.value || 0) * 60 + (+sIn.value || 0)) * 1000;
          if (remain <= 0) return;
          end = Date.now() + remain;
          running = true;
          disp.classList.remove("blink");
          startBtn.textContent = "Pause"; startBtn.classList.remove("primary");
          raf = requestAnimationFrame(tick);
        }
      });
      body.querySelector("#tm-reset").addEventListener("click", () => {
        running = false; remain = 0;
        disp.textContent = "00:00";
        disp.classList.remove("blink");
        startBtn.textContent = "Start"; startBtn.classList.add("primary");
      });
      cleanups.push(() => { running = false; if (raf) cancelAnimationFrame(raf); });
    };

    const renderers = { world: renderWorld, stopwatch: renderStopwatch, timer: renderTimer };

    const switchTab = (tab) => {
      cleanups.forEach((c) => c()); cleanups = [];
      active = tab;
      el.querySelectorAll(".clock-tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === tab));
      renderers[tab]();
    };
    el.querySelectorAll(".clock-tab").forEach((t) => t.addEventListener("click", () => switchTab(t.dataset.tab)));
    switchTab("world");

    return { unmount() { cleanups.forEach((c) => c()); el.remove(); } };
  },
};
