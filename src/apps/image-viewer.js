import { fs, basename, dirname } from "../core/filesystem.js";

export default {
  id: "image-viewer",
  name: "Photos",
  icon: "🖼",
  category: "Media",
  defaultSize: { w: 760, h: 560 },
  keywords: ["image", "photo", "viewer", "picture"],
  mount(container, ctx) {
    const el = document.createElement("div");
    el.className = "app iv-app";
    el.innerHTML = `
      <div class="app-toolbar">
        <button class="btn ghost" id="iv-prev" title="Previous">‹</button>
        <button class="btn ghost" id="iv-next" title="Next">›</button>
        <button class="btn ghost" id="iv-fit" title="Fit">⤢</button>
        <button class="btn ghost" id="iv-actual" title="100%">1:1</button>
        <button class="btn ghost" id="iv-zoom-in">＋</button>
        <button class="btn ghost" id="iv-zoom-out">−</button>
        <span class="ce-status" id="iv-name">—</span>
        <span class="ce-spacer"></span>
        <button class="btn" id="iv-wallpaper">Set as wallpaper</button>
        <label class="btn">Import…<input id="iv-import" type="file" accept="image/*" multiple hidden></label>
      </div>
      <div class="iv-stage" id="iv-stage">
        <img id="iv-img" alt="Image preview"/>
        <div class="iv-empty" id="iv-empty">
          <div class="em-icon">🌅</div>
          <div class="em-title">No images yet</div>
          <div class="em-sub">Import images (saved to /Pictures), or open one from the Files app.</div>
        </div>
      </div>
      <div class="iv-thumbs scroll-thin" id="iv-thumbs"></div>
    `;
    container.appendChild(el);

    const stage = el.querySelector("#iv-stage");
    const $img = el.querySelector("#iv-img");
    const $empty = el.querySelector("#iv-empty");
    const $thumbs = el.querySelector("#iv-thumbs");
    const $name = el.querySelector("#iv-name");

    let list = [], idx = -1;
    let zoom = 1, tx = 0, ty = 0;

    const collect = () => {
      const found = [];
      const walk = (node, base) => {
        for (const child of Object.values(node.children || {})) {
          const p = base === "/" ? "/" + child.name : base + "/" + child.name;
          if (child.type === "dir") walk(child, p);
          else if (child.binary && /^image\//.test(child.mime || "")) found.push(p);
        }
      };
      walk(fs.root, "/");
      return found.sort();
    };

    const setImg = (path) => {
      const node = fs.read(path);
      if (!node) return;
      $img.src = node.content;
      $img.hidden = false;
      $empty.hidden = true;
      $name.textContent = basename(path);
      ctx.setTitle?.("Photos — " + basename(path));
      zoom = 1; tx = 0; ty = 0; applyTransform();
    };

    const renderThumbs = () => {
      $thumbs.innerHTML = list.map((p, i) => `<button class="iv-thumb ${i === idx ? "active" : ""}" data-i="${i}"><img src="${escape((fs.read(p) || {}).content || "")}" alt=""></button>`).join("");
      $thumbs.querySelectorAll(".iv-thumb").forEach((t) => t.addEventListener("click", () => { idx = +t.dataset.i; setImg(list[idx]); renderThumbs(); }));
    };

    const refresh = () => {
      list = collect();
      if (!list.length) {
        $img.hidden = true; $empty.hidden = false; $name.textContent = "—"; renderThumbs();
        return;
      }
      if (idx < 0 || idx >= list.length) idx = 0;
      setImg(list[idx]);
      renderThumbs();
    };

    const next = (dir) => { if (!list.length) return; idx = (idx + dir + list.length) % list.length; setImg(list[idx]); renderThumbs(); };

    const applyTransform = () => { $img.style.transform = `translate(${tx}px, ${ty}px) scale(${zoom})`; };
    const setZoom = (z) => { zoom = Math.max(0.1, Math.min(8, z)); applyTransform(); };

    el.querySelector("#iv-prev").addEventListener("click", () => next(-1));
    el.querySelector("#iv-next").addEventListener("click", () => next(1));
    el.querySelector("#iv-fit").addEventListener("click", () => { zoom = 1; tx = 0; ty = 0; applyTransform(); });
    el.querySelector("#iv-actual").addEventListener("click", () => setZoom(1));
    el.querySelector("#iv-zoom-in").addEventListener("click", () => setZoom(zoom * 1.2));
    el.querySelector("#iv-zoom-out").addEventListener("click", () => setZoom(zoom / 1.2));

    el.querySelector("#iv-wallpaper").addEventListener("click", () => {
      if (idx < 0) return;
      const node = fs.read(list[idx]);
      if (!node) return;
      // Use the data URL as a custom wallpaper via inline background
      document.getElementById("wallpaper").style.background = `center/cover no-repeat url("${node.content}")`;
      import("../ui/notifications.js").then(({ notify }) => notify({ title: "Wallpaper set", body: basename(list[idx]) }));
    });

    el.querySelector("#iv-import").addEventListener("change", async (e) => {
      const files = Array.from(e.target.files || []);
      for (const f of files) {
        const dataUrl = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(f); });
        const dest = "/Pictures/" + uniqueName("/Pictures", f.name);
        fs.touch(dest, dataUrl, { mime: f.type || "image/png", binary: true });
      }
      e.target.value = "";
      refresh();
    });

    // Mouse drag to pan
    let dragging = false, lastX = 0, lastY = 0;
    stage.addEventListener("mousedown", (e) => { if (e.target !== $img) return; dragging = true; lastX = e.clientX; lastY = e.clientY; stage.style.cursor = "grabbing"; });
    window.addEventListener("mousemove", (e) => { if (!dragging) return; tx += e.clientX - lastX; ty += e.clientY - lastY; lastX = e.clientX; lastY = e.clientY; applyTransform(); });
    window.addEventListener("mouseup", () => { dragging = false; stage.style.cursor = ""; });

    // Wheel to zoom
    stage.addEventListener("wheel", (e) => { e.preventDefault(); setZoom(zoom * (e.deltaY < 0 ? 1.1 : 0.9)); }, { passive: false });

    if (ctx.opts?.openFsFile && fs.exists(ctx.opts.openFsFile)) {
      list = collect();
      idx = Math.max(0, list.indexOf(ctx.opts.openFsFile));
      setImg(ctx.opts.openFsFile);
      renderThumbs();
    } else {
      refresh();
    }

    return { unmount() { el.remove(); } };
  },
};

function uniqueName(dir, name) {
  let n = name, i = 1;
  while (fs.exists(dir + "/" + n)) {
    const dot = name.lastIndexOf(".");
    if (dot > 0) n = name.slice(0, dot) + ` (${i})` + name.slice(dot);
    else n = `${name} (${i})`;
    i++;
  }
  return n;
}

function escape(s) { return String(s).replace(/"/g, '\\"'); }
