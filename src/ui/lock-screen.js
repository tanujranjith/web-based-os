import { profiles } from "../core/profiles.js";
import { bus } from "../core/event-bus.js";
import { sound } from "../core/sound.js";

let overlay;

function build() {
  overlay = document.createElement("div");
  overlay.id = "lock-screen";
  overlay.className = "lock-screen";
  document.body.appendChild(overlay);
  render();
}

function render() {
  const active = profiles.active();
  const all = profiles.list();
  const time = new Date();
  overlay.innerHTML = `
    <div class="lock-bg"></div>
    <div class="lock-content">
      <div class="lock-clock">
        <div class="lock-time">${time.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</div>
        <div class="lock-date">${time.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</div>
      </div>
      <div class="lock-card">
        <div class="lock-avatar">${escape(active.avatar)}</div>
        <div class="lock-name">${escape(active.name)}</div>
        ${active.pin ? `
          <form class="lock-form" id="lock-form">
            <input class="lock-pin" id="lock-pin" type="password" inputmode="numeric" maxlength="12" placeholder="Enter PIN" autocomplete="off" />
            <button class="btn primary" type="submit">Unlock</button>
            <div class="lock-error" id="lock-error" aria-live="polite"></div>
          </form>
        ` : `
          <button class="btn primary lock-unlock" id="lock-unlock">Click to unlock</button>
        `}
      </div>
      ${all.length > 1 ? `
        <div class="lock-switch">
          <span>Switch user</span>
          <div class="lock-users">
            ${all.map((p) => `
              <button class="lock-user ${p.id === active.id ? "active" : ""}" data-id="${p.id}">
                <span class="lock-user-avatar">${escape(p.avatar)}</span>
                <span class="lock-user-name">${escape(p.name)}</span>
              </button>
            `).join("")}
          </div>
        </div>
      ` : ""}
    </div>
  `;

  const tick = () => {
    const t = overlay.querySelector(".lock-time");
    const d = overlay.querySelector(".lock-date");
    if (!t) return;
    const n = new Date();
    t.textContent = n.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    d.textContent = n.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  };
  clearInterval(overlay._tick);
  overlay._tick = setInterval(tick, 20 * 1000);

  const form = overlay.querySelector("#lock-form");
  if (form) {
    const pinEl = overlay.querySelector("#lock-pin");
    const err = overlay.querySelector("#lock-error");
    setTimeout(() => pinEl.focus(), 50);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (profiles.unlock(pinEl.value)) {
        sound.click();
        unmount();
      } else {
        err.textContent = "Incorrect PIN";
        pinEl.value = "";
        pinEl.focus();
        sound.error();
        overlay.querySelector(".lock-card").animate(
          [{ transform: "translateX(-6px)" }, { transform: "translateX(6px)" }, { transform: "translateX(0)" }],
          { duration: 220 }
        );
      }
    });
  }
  const btn = overlay.querySelector("#lock-unlock");
  if (btn) btn.addEventListener("click", () => { profiles.unlock(""); sound.click(); unmount(); });

  overlay.querySelectorAll(".lock-user").forEach((b) => {
    b.addEventListener("click", () => profiles.switchTo(b.dataset.id));
  });
}

function unmount() {
  if (!overlay) return;
  overlay.classList.add("lock-exit");
  setTimeout(() => {
    clearInterval(overlay._tick);
    overlay.remove();
    overlay = null;
    bus.emit("unlocked");
  }, 300);
}

export const lockScreen = {
  isShowing() { return !!overlay; },
  show() {
    if (overlay) return;
    profiles.lock();
    build();
  },
  showIfLocked() {
    if (profiles.isLocked()) build();
  },
};

bus.on("lock", () => lockScreen.show());
