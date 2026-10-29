import { store } from "../core/state.js";
import { fs, basename } from "../core/filesystem.js";
import { bus } from "../core/event-bus.js";
import { mediaPlayer } from "../core/media-player.js";
import { escape } from "../ui/icons.js";
export default {
  id: "music",
  name: "Music",
  category: "Media",
  keywords: ["audio", "playlist", "player"],
  defaultSize: { w: 920, h: 650 },
  mount(container, ctx) {
    const el = document.createElement("div");
    el.className = "app music-v4";
    el.innerHTML = `<div class="app-toolbar"><label class="btn primary">Import audio<input type="file" accept="audio/*" multiple hidden></label><button class="btn" data-playlist>Save queue as playlist</button><select class="select" aria-label="Playlist"><option value="">All tracks</option></select><button class="btn" data-delete-list>Delete playlist</button></div><div class="music-body"><aside class="music-tracks scroll-thin"></aside><main class="music-now"><div class="album-art">♪</div><h2 data-title>Nothing playing</h2><p data-path>Import audio to start your library.</p><div class="music-controls"><button class="btn" data-shuffle aria-label="Shuffle">Shuffle</button><button class="btn" data-prev aria-label="Previous track">‹</button><button class="btn primary" data-play>Play</button><button class="btn" data-next aria-label="Next track">›</button><button class="btn" data-repeat>Repeat: off</button></div><div class="music-seek"><span data-time>0:00</span><input type="range" min="0" max="1000" value="0" aria-label="Seek"><span data-duration>0:00</span></div><label>Volume<input type="range" min="0" max="1" step=".01" data-volume aria-label="Volume"></label><small>Playback continues when this window closes.</small></main></div>`;
    container.append(el);
    const allTracks = () => {
      const out = [];
      const walk = (node, base) => {
        for (const child of Object.values(node.children || {})) {
          const p = base + "/" + child.name;
          if (child.type === "dir") walk(child, p);
          else if (
            child.mime?.startsWith("audio/") ||
            /\.(mp3|wav|ogg|m4a|flac)$/i.test(p)
          )
            out.push(p);
        }
      };
      walk(fs.root, "");
      return out;
    };
    function library() {
      const selected = el.querySelector("select").value;
      el.querySelector("select").innerHTML =
        '<option value="">All tracks</option>' +
        (store.get().playlists || [])
          .map(
            (p) =>
              `<option value="${escape(p.id)}" ${p.id === selected ? "selected" : ""}>${escape(p.name)}</option>`,
          )
          .join("");
      const tracks = selected
        ? store.get().playlists.find((p) => p.id === selected)?.paths || []
        : allTracks();
      el.querySelector(".music-tracks").innerHTML =
        tracks
          .map(
            (p) =>
              `<button data-track="${escape(p)}"><span>♪</span><strong>${escape(basename(p))}</strong><small>${escape(p)}</small></button>`,
          )
          .join("") || '<p class="app-empty">Your library is empty.</p>';
      el.querySelectorAll("[data-track]").forEach(
        (b) =>
          (b.onclick = () => {
            mediaPlayer.queue(tracks);
            mediaPlayer.play(b.dataset.track);
          }),
      );
    }
    function render() {
      const s = mediaPlayer.snapshot();
      el.querySelector("[data-title]").textContent = s.path
        ? basename(s.path)
        : "Nothing playing";
      el.querySelector("[data-path]").textContent =
        s.path || "Import audio to start your library.";
      el.querySelector("[data-play]").textContent = s.paused ? "Play" : "Pause";
      el.querySelector("[data-time]").textContent = fmt(s.time);
      el.querySelector("[data-duration]").textContent = fmt(s.duration);
      el.querySelector("input[aria-label=Seek]").value = s.duration
        ? (s.time / s.duration) * 1000
        : 0;
      el.querySelector("[data-volume]").value = s.volume;
      el.querySelector("[data-repeat]").textContent = "Repeat: " + s.repeat;
      el.querySelector("[data-shuffle]").setAttribute(
        "aria-pressed",
        s.shuffle,
      );
      el.querySelectorAll("[data-track]").forEach((b) =>
        b.classList.toggle("active", b.dataset.track === s.path),
      );
    }
    el.querySelector("input[type=file]").onchange = async (e) => {
      try {
        for (const f of e.target.files) await fs.importFile(f, "/Downloads");
        library();
        mediaPlayer.queue(allTracks());
      } catch (error) {
        bus.emit("notify", { title: "Import failed", body: error.message });
      }
      e.target.value = "";
    };
    el.querySelector("[data-play]").onclick = () => {
      if (!mediaPlayer.snapshot().queue.length) mediaPlayer.queue(allTracks());
      mediaPlayer.toggle();
    };
    el.querySelector("[data-prev]").onclick = () => mediaPlayer.next(-1);
    el.querySelector("[data-next]").onclick = () => mediaPlayer.next();
    el.querySelector("[data-repeat]").onclick = () => mediaPlayer.repeat();
    el.querySelector("[data-shuffle]").onclick = () => mediaPlayer.shuffle();
    el.querySelector("[data-volume]").oninput = (e) =>
      mediaPlayer.volume(+e.target.value);
    el.querySelector("input[aria-label=Seek]").onchange = (e) =>
      mediaPlayer.seek(
        (+e.target.value / 1000) * mediaPlayer.snapshot().duration,
      );
    el.querySelector("select").onchange = library;
    el.querySelector("[data-playlist]").onclick = () => {
      const name = prompt("Playlist name");
      if (name?.trim())
        store.update((s) => {
          s.playlists ??= [];
          s.playlists.push({
            id: crypto.randomUUID(),
            name: name.trim(),
            paths: mediaPlayer.snapshot().queue.length
              ? mediaPlayer.snapshot().queue
              : allTracks(),
          });
        });
      library();
    };
    el.querySelector("[data-delete-list]").onclick = () => {
      const id = el.querySelector("select").value;
      if (id && confirm("Delete this playlist? Audio files are kept."))
        store.update(
          (s) => (s.playlists = s.playlists.filter((p) => p.id !== id)),
        );
      library();
    };
    const off = bus.on("media-change", render),
      offFs = bus.on("fs-change", library);
    library();
    render();
    if (ctx.opts.openFsFile) mediaPlayer.play(ctx.opts.openFsFile);
    return {
      onOpen(opts) {
        if (opts.openFsFile) mediaPlayer.play(opts.openFsFile);
      },
      unmount() {
        off();
        offFs();
        el.remove();
      },
    };
  },
};
function fmt(s) {
  return Number.isFinite(s)
    ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`
    : "0:00";
}
