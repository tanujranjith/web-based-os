import { store } from "../core/state.js";
import { theme, wallpapers, accents } from "../core/theme.js";
import { bus } from "../core/event-bus.js";
import { profiles } from "../core/profiles.js";
import { animatedWallpaper } from "../core/animated-wallpaper.js";

const SECTIONS = [
  { id: "appearance", label: "Appearance", icon: "🎨" },
  { id: "dock", label: "Dock & Desktop", icon: "📌" },
  { id: "sounds", label: "Sounds", icon: "🔊" },
  { id: "accessibility", label: "Accessibility", icon: "♿" },
  { id: "profiles", label: "Users", icon: "👥" },
  { id: "account", label: "Profile", icon: "🙂" },
  { id: "system", label: "System", icon: "⚙" },
];

export default {
  id: "settings",
  name: "Settings",
  icon: "⚙",
  category: "System",
  defaultSize: { w: 740, h: 520 },
  keywords: ["preferences", "config", "theme", "wallpaper"],
  mount(container, ctx) {
    const el = document.createElement("div");
    el.className = "app";
    el.innerHTML = `
      <div class="settings-layout">
        <aside class="settings-side">
          ${SECTIONS.map((s) => `<button class="sidebar-item" data-sec="${s.id}"><span>${s.icon}</span><span>${s.label}</span></button>`).join("")}
        </aside>
        <main class="settings-pane scroll-thin" id="pane"></main>
      </div>
    `;
    container.appendChild(el);
    const pane = el.querySelector("#pane");

    let activeSec = ctx.opts?.tab || "appearance";

    const renderSide = () => {
      el.querySelectorAll(".sidebar-item").forEach((s) => s.classList.toggle("active", s.dataset.sec === activeSec));
    };

    const render = () => {
      renderSide();
      pane.innerHTML = "";
      const renderer = renderers[activeSec] || renderers.appearance;
      pane.appendChild(renderer());
    };

    el.querySelectorAll(".sidebar-item").forEach((s) => {
      s.addEventListener("click", () => { activeSec = s.dataset.sec; render(); });
    });

    const renderers = {
      appearance: () => {
        const root = document.createElement("div");
        const prefs = store.get().prefs;
        root.innerHTML = `
          <h2>Appearance</h2>
          <p class="pane-desc">Customize how NovaOS looks.</p>

          <div class="settings-row">
            <div class="label"><div class="title">Theme</div><div class="desc">Choose light, dark, or follow your system.</div></div>
            <select class="select" id="theme-sel">
              <option value="dark"  ${prefs.theme === "dark" ? "selected" : ""}>Dark</option>
              <option value="light" ${prefs.theme === "light" ? "selected" : ""}>Light</option>
              <option value="system" ${prefs.theme === "system" ? "selected" : ""}>System</option>
            </select>
          </div>

          <div class="settings-row">
            <div class="label"><div class="title">Accent color</div><div class="desc">Used for highlights and buttons.</div></div>
            <div class="swatch-row" id="accent-swatches">
              ${accents.map((c) => `<button aria-label="Accent ${c}" class="swatch ${c === prefs.accent ? "active" : ""}" data-accent="${c}" style="background:${c}"></button>`).join("")}
            </div>
          </div>

          <div class="settings-row" style="flex-direction:column;align-items:stretch">
            <div class="label"><div class="title">Wallpaper</div><div class="desc">Pick a desktop background.</div></div>
            <div class="wallpaper-grid">
              ${Object.entries(wallpapers).map(([k, v]) => `
                <div class="wallpaper-thumb ${k === prefs.wallpaper ? "active" : ""}" data-wp="${k}" style="background:${v.css}" title="${v.name}"></div>
              `).join("")}
            </div>
          </div>

          <div class="settings-row">
            <div class="label"><div class="title">Animated particles</div><div class="desc">Mouse-reactive accent particles drift over the wallpaper.</div></div>
            <div class="toggle ${prefs.animatedWallpaper ? "on" : ""}" data-toggle="animatedWallpaper" role="switch" aria-checked="${prefs.animatedWallpaper}"></div>
          </div>
        `;
        root.querySelector("#theme-sel").addEventListener("change", (e) => theme.setTheme(e.target.value));
        root.querySelectorAll("[data-accent]").forEach((s) => s.addEventListener("click", () => { theme.setAccent(s.dataset.accent); render(); }));
        root.querySelectorAll("[data-wp]").forEach((s) => s.addEventListener("click", () => { theme.setWallpaper(s.dataset.wp); render(); }));
        root.querySelectorAll("[data-toggle]").forEach((t) => {
          t.addEventListener("click", () => {
            const key = t.dataset.toggle;
            if (key === "animatedWallpaper") {
              store.update((s) => { s.prefs.animatedWallpaper = !s.prefs.animatedWallpaper; });
              animatedWallpaper.apply();
              render();
            }
          });
        });
        return root;
      },

      sounds: () => {
        const root = document.createElement("div");
        const prefs = store.get().prefs;
        root.innerHTML = `
          <h2>Sounds</h2>
          <p class="pane-desc">Subtle UI sound effects.</p>
          <div class="settings-row">
            <div class="label"><div class="title">UI sounds</div><div class="desc">Tiny tones for open, close, notify.</div></div>
            <div class="toggle ${prefs.sounds ? "on" : ""}" data-toggle="sounds" role="switch" aria-checked="${prefs.sounds}"></div>
          </div>
        `;
        root.querySelector("[data-toggle]").addEventListener("click", () => {
          store.update((s) => { s.prefs.sounds = !s.prefs.sounds; });
          render();
        });
        return root;
      },

      profiles: () => {
        const root = document.createElement("div");
        const list = profiles.list();
        const active = profiles.active();
        root.innerHTML = `
          <h2>Users</h2>
          <p class="pane-desc">Multiple profiles with separate data and (optionally) a PIN.</p>
          <div class="profiles-list">
            ${list.map((p) => `
              <div class="profile-row">
                <div class="lock-avatar" style="width:40px;height:40px;font-size:22px">${escape(p.avatar)}</div>
                <div style="flex:1">
                  <div class="title">${escape(p.name)} ${p.id === active.id ? '<span class="pal-kind">Active</span>' : ""}</div>
                  <div class="desc">${p.pin ? "🔒 PIN set" : "No PIN"}</div>
                </div>
                <button class="btn" data-pin="${p.id}">${p.pin ? "Change PIN" : "Set PIN"}</button>
                ${p.id !== active.id ? `<button class="btn primary" data-switch="${p.id}">Switch</button>` : ""}
                ${list.length > 1 ? `<button class="btn danger" data-del="${p.id}">Delete</button>` : ""}
              </div>
            `).join("")}
          </div>
          <div class="settings-row" style="margin-top:14px">
            <button class="btn primary" id="new-profile">＋ Add user</button>
            <button class="btn" id="lock-now">🔒 Lock screen now</button>
          </div>
        `;
        root.querySelectorAll("[data-switch]").forEach((b) => b.addEventListener("click", () => profiles.switchTo(b.dataset.switch)));
        root.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => { if (confirm("Delete this user and their data?")) { profiles.remove(b.dataset.del); render(); } }));
        root.querySelectorAll("[data-pin]").forEach((b) => b.addEventListener("click", () => {
          const pin = prompt("Set a 4–8 digit PIN (leave blank to clear):");
          if (pin === null) return;
          profiles.setPin(b.dataset.pin, pin);
          render();
        }));
        root.querySelector("#new-profile").addEventListener("click", () => {
          const name = prompt("Name for the new user:", "Friend");
          if (!name) return;
          const avatar = prompt("Avatar emoji (optional):", "🙂") || "🙂";
          profiles.create({ name, avatar });
          render();
        });
        root.querySelector("#lock-now").addEventListener("click", () => bus.emit("lock"));
        return root;
      },

      dock: () => {
        const root = document.createElement("div");
        const prefs = store.get().prefs;
        root.innerHTML = `
          <h2>Dock & Desktop</h2>
          <p class="pane-desc">Tweak the dock and desktop layout.</p>

          <div class="settings-row">
            <div class="label"><div class="title">Dock style</div><div class="desc">Floating capsule or full bar.</div></div>
            <select class="select" style="width:140px" id="dock-sel">
              <option value="floating" ${prefs.dockStyle === "floating" ? "selected" : ""}>Floating</option>
              <option value="bar" ${prefs.dockStyle === "bar" ? "selected" : ""}>Bar</option>
            </select>
          </div>

          <div class="settings-row">
            <div class="label"><div class="title">Pinned apps</div><div class="desc">Reset which apps appear on the dock.</div></div>
            <button class="btn" id="reset-pins">Reset pins</button>
          </div>
        `;
        root.querySelector("#dock-sel").addEventListener("change", (e) => theme.setDockStyle(e.target.value));
        root.querySelector("#reset-pins").addEventListener("click", () => {
          store.update((s) => { s.desktopShortcuts = ["files", "notes", "code-editor", "browser", "terminal", "settings"]; });
          bus.emit("notify", { title: "Dock", body: "Pinned apps reset." });
        });
        return root;
      },

      accessibility: () => {
        const root = document.createElement("div");
        const prefs = store.get().prefs;
        root.innerHTML = `
          <h2>Accessibility</h2>
          <p class="pane-desc">Adjust motion and text size.</p>

          <div class="settings-row">
            <div class="label"><div class="title">Reduce motion</div><div class="desc">Disable animations and transitions.</div></div>
            <div class="toggle ${prefs.reduceMotion ? "on" : ""}" data-toggle="reduceMotion" role="switch" aria-checked="${prefs.reduceMotion}"></div>
          </div>
          <div class="settings-row">
            <div class="label"><div class="title">Larger text</div><div class="desc">Increase base font size.</div></div>
            <div class="toggle ${prefs.largeText ? "on" : ""}" data-toggle="largeText" role="switch" aria-checked="${prefs.largeText}"></div>
          </div>
        `;
        root.querySelectorAll("[data-toggle]").forEach((t) => {
          t.addEventListener("click", () => {
            const key = t.dataset.toggle;
            if (key === "reduceMotion") theme.toggleReduceMotion();
            if (key === "largeText") theme.toggleLargeText();
            render();
          });
        });
        return root;
      },

      account: () => {
        const root = document.createElement("div");
        const u = store.get().user;
        root.innerHTML = `
          <h2>Profile</h2>
          <p class="pane-desc">Personalize your NovaOS session.</p>

          <div class="settings-row">
            <div class="label"><div class="title">Name</div><div class="desc">Shown in the terminal and around the OS.</div></div>
            <input class="input" id="name" value="${escape(u.name)}" style="max-width:200px"/>
          </div>
          <div class="settings-row">
            <div class="label"><div class="title">Avatar</div><div class="desc">Use any emoji as your avatar.</div></div>
            <input class="input" id="avatar" value="${escape(u.avatar)}" maxlength="4" style="max-width:80px;text-align:center;font-size:18px"/>
          </div>
        `;
        const save = () => {
          store.update((s) => {
            s.user.name = root.querySelector("#name").value.trim() || "Friend";
            s.user.avatar = root.querySelector("#avatar").value || "🙂";
          });
        };
        root.querySelector("#name").addEventListener("input", debounce(save, 250));
        root.querySelector("#avatar").addEventListener("input", debounce(save, 250));
        return root;
      },

      system: () => {
        const root = document.createElement("div");
        root.innerHTML = `
          <h2>System</h2>
          <p class="pane-desc">Manage local data.</p>

          <div class="settings-row">
            <div class="label"><div class="title">Reset NovaOS</div><div class="desc">Wipe all local data and start fresh. This cannot be undone.</div></div>
            <button class="btn danger" id="reset">Reset everything</button>
          </div>
          <div class="settings-row">
            <div class="label"><div class="title">Export data</div><div class="desc">Download a JSON snapshot of your NovaOS state.</div></div>
            <button class="btn" id="export">Export</button>
          </div>
          <div class="settings-row">
            <div class="label"><div class="title">Import data</div><div class="desc">Restore from a previously exported file.</div></div>
            <button class="btn" id="import">Import</button>
            <input type="file" id="import-file" accept="application/json" hidden />
          </div>
        `;
        root.querySelector("#reset").addEventListener("click", () => {
          if (confirm("Reset NovaOS and erase all local data?")) {
            store.reset();
            setTimeout(() => location.reload(), 200);
          }
        });
        root.querySelector("#export").addEventListener("click", () => {
          const data = JSON.stringify(store.get(), null, 2);
          const blob = new Blob([data], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url; a.download = "novaos-export.json"; a.click();
          URL.revokeObjectURL(url);
        });
        const fileInput = root.querySelector("#import-file");
        root.querySelector("#import").addEventListener("click", () => fileInput.click());
        fileInput.addEventListener("change", async (e) => {
          const f = e.target.files?.[0]; if (!f) return;
          try {
            const text = await f.text();
            const parsed = JSON.parse(text);
            if (!confirm('Restore this backup? It replaces the current profile’s data.')) return;
            store.restore(parsed);
            bus.emit("notify", { title: "Import OK", body: "Reloading…" });
            setTimeout(() => location.reload(), 500);
          } catch (err) {
            bus.emit("notify", { title: "Import failed", body: err.message });
          }
        });
        return root;
      },
    };

    const unsubTheme = bus.on('theme-change', () => { if (['appearance','dock','accessibility'].includes(activeSec)) render(); });

    render();

    return {
      onOpen(opts) { if (opts.tab && renderers[opts.tab]) { activeSec = opts.tab; render(); } },
      unmount() { unsubTheme(); el.remove(); },
    };
  },
};

function debounce(fn, ms) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
function escape(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
