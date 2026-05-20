import { fs } from "../core/filesystem.js";
import { bus } from "../core/event-bus.js";

export default {
  id: "music",
  name: "Music",
  icon: "🎵",
  category: "Media",
  defaultSize: { w: 760, h: 560 },
  keywords: ["audio", "music", "player", "song"],
  mount(container, ctx) {
    const el = document.createElement("div");
    el.className = "app music-app";
    el.innerHTML = `
      <div class="app-body">
        <aside class="app-sidebar">
          <div class="sidebar-section">
            <h4>Library</h4>
            <label class="btn" style="width:100%; justify-content:center">＋ Import…<input type="file" id="mu-import" accept="audio/*" multiple hidden></label>
          </div>
          <div class="sidebar-section">
            <h4>Tracks</h4>
            <div id="mu-list" class="mu-list"></div>
          </div>
        </aside>
        <main class="app-main">
          <div class="mu-now">
            <div class="mu-cover" id="mu-cover">♪</div>
            <div class="mu-meta">
              <div class="mu-title" id="mu-title">Nothing playing</div>
              <div class="mu-sub" id="mu-sub">Import an audio file to start.</div>
            </div>
            <div class="mu-bar">
              <span id="mu-cur">0:00</span>
              <input type="range" min="0" max="1000" value="0" id="mu-seek"/>
              <span id="mu-dur">0:00</span>
            </div>
            <div class="mu-ctrls">
              <button class="btn ghost" id="mu-prev">⏮</button>
              <button class="btn primary" id="mu-play">▶</button>
              <button class="btn ghost" id="mu-next">⏭</button>
              <span class="mu-vol">
                🔉
                <input type="range" min="0" max="100" value="80" id="mu-vol"/>
              </span>
            </div>
            <audio id="mu-audio"></audio>
          </div>
        </main>
      </div>
    `;
    container.appendChild(el);

    const list = el.querySelector("#mu-list");
    const audio = el.querySelector("#mu-audio");
    const $title = el.querySelector("#mu-title");
    const $sub = el.querySelector("#mu-sub");
    const $cover = el.querySelector("#mu-cover");
    const $play = el.querySelector("#mu-play");
    const $seek = el.querySelector("#mu-seek");
    const $cur = el.querySelector("#mu-cur");
    const $dur = el.querySelector("#mu-dur");
    const $vol = el.querySelector("#mu-vol");

    let tracks = [], curIdx = -1, seeking = false;

    const collect = () => {
      const found = [];
      const walk = (node, base) => {
        for (const c of Object.values(node.children || {})) {
          const p = base === "/" ? "/" + c.name : base + "/" + c.name;
          if (c.type === "dir") walk(c, p);
          else if ((c.mime || "").startsWith("audio/") || /\.(mp3|wav|ogg|m4a|flac)$/i.test(c.name)) found.push(p);
        }
      };
      walk(fs.root, "/");
      return found.sort();
    };

    const renderList = () => {
      list.innerHTML = tracks.length
        ? tracks.map((p, i) => `<div class="mu-row ${i === curIdx ? "active" : ""}" data-i="${i}">
            <span class="mu-num">${i + 1}</span>
            <span class="mu-name">${escape(p.split("/").pop())}</span>
          </div>`).join("")
        : `<div class="app-empty" style="padding:20px"><div class="em-sub">No audio yet.</div></div>`;
      list.querySelectorAll(".mu-row").forEach((r) => r.addEventListener("click", () => play(+r.dataset.i)));
    };

    const play = (i) => {
      if (i < 0 || i >= tracks.length) return;
      curIdx = i;
      const node = fs.read(tracks[i]);
      if (!node) return;
      audio.src = node.content;
      audio.play().catch(() => {});
      const name = tracks[i].split("/").pop();
      $title.textContent = name;
      $sub.textContent = tracks[i];
      ctx.setTitle?.("Music — " + name);
      renderList();
    };

    const next = () => { if (!tracks.length) return; play((curIdx + 1) % tracks.length); };
    const prev = () => { if (!tracks.length) return; play((curIdx - 1 + tracks.length) % tracks.length); };

    audio.addEventListener("play", () => { $play.textContent = "⏸"; $cover.classList.add("playing"); });
    audio.addEventListener("pause", () => { $play.textContent = "▶"; $cover.classList.remove("playing"); });
    audio.addEventListener("ended", next);
    audio.addEventListener("timeupdate", () => {
      if (seeking) return;
      const d = audio.duration || 0;
      $seek.value = String(Math.floor((audio.currentTime / d) * 1000) || 0);
      $cur.textContent = fmt(audio.currentTime || 0);
      $dur.textContent = fmt(d);
    });
    $seek.addEventListener("input", () => { seeking = true; });
    $seek.addEventListener("change", () => { if (audio.duration) audio.currentTime = (audio.duration * $seek.value) / 1000; seeking = false; });
    $vol.addEventListener("input", () => { audio.volume = $vol.value / 100; });
    audio.volume = 0.8;

    $play.addEventListener("click", () => {
      if (!tracks.length) return;
      if (curIdx < 0) play(0);
      else if (audio.paused) audio.play().catch(() => {});
      else audio.pause();
    });
    el.querySelector("#mu-prev").addEventListener("click", prev);
    el.querySelector("#mu-next").addEventListener("click", next);

    el.querySelector("#mu-import").addEventListener("change", async (e) => {
      const files = Array.from(e.target.files || []);
      for (const f of files) {
        const dataUrl = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(f); });
        const dest = "/Downloads/" + f.name;
        fs.touch(dest, dataUrl, { mime: f.type || "audio/mpeg", binary: true });
      }
      e.target.value = "";
      tracks = collect();
      renderList();
      bus.emit("notify", { title: "Music", body: `Imported ${files.length} file(s).` });
    });

    tracks = collect();
    renderList();

    return { unmount() { try { audio.pause(); } catch {} el.remove(); } };
  },
};

function fmt(s) {
  if (!isFinite(s)) return "0:00";
  const m = Math.floor(s / 60); const ss = Math.floor(s % 60);
  return `${m}:${ss.toString().padStart(2, "0")}`;
}
function escape(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
