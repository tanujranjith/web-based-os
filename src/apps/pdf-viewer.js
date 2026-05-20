import { fs, basename } from "../core/filesystem.js";

export default {
  id: "pdf-viewer",
  name: "PDF",
  icon: "📕",
  category: "Media",
  defaultSize: { w: 760, h: 600 },
  keywords: ["pdf", "document", "reader"],
  mount(container, ctx) {
    const el = document.createElement("div");
    el.className = "app pdf-app";
    el.innerHTML = `
      <div class="app-toolbar">
        <label class="btn">📂 Open…<input type="file" id="pdf-import" accept="application/pdf" hidden></label>
        <button class="btn ghost" id="pdf-list">VFS PDFs</button>
        <span class="ce-status" id="pdf-name">No file</span>
        <span class="ce-spacer"></span>
        <button class="btn ghost" id="pdf-zoom-out">−</button>
        <button class="btn ghost" id="pdf-zoom-in">＋</button>
      </div>
      <div class="pdf-stage" id="pdf-stage">
        <div class="app-empty" id="pdf-empty">
          <div class="em-icon">📕</div>
          <div class="em-title">No PDF open</div>
          <div class="em-sub">Open a PDF from your computer or pick one already in the VFS.</div>
        </div>
        <iframe id="pdf-frame" hidden></iframe>
      </div>
    `;
    container.appendChild(el);

    const $frame = el.querySelector("#pdf-frame");
    const $empty = el.querySelector("#pdf-empty");
    const $name = el.querySelector("#pdf-name");
    let zoom = 100;

    const setSrc = (src, name) => {
      $frame.src = src + (src.startsWith("data:") ? "" : "#zoom=" + zoom);
      $frame.hidden = false;
      $empty.hidden = true;
      $name.textContent = name;
      ctx.setTitle?.("PDF — " + name);
    };

    const open = (path) => {
      const node = fs.read(path);
      if (!node) return;
      setSrc(node.content, basename(path));
    };

    el.querySelector("#pdf-import").addEventListener("change", async (e) => {
      const f = e.target.files?.[0]; if (!f) return;
      const dataUrl = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(f); });
      const path = "/Documents/" + f.name;
      fs.touch(path, dataUrl, { mime: "application/pdf", binary: true });
      open(path);
    });
    el.querySelector("#pdf-list").addEventListener("click", () => listPdfs().then((p) => p && open(p)));
    el.querySelector("#pdf-zoom-in").addEventListener("click", () => { zoom = Math.min(300, zoom + 25); refresh(); });
    el.querySelector("#pdf-zoom-out").addEventListener("click", () => { zoom = Math.max(50, zoom - 25); refresh(); });
    const refresh = () => { if ($frame.src && !$frame.src.startsWith("data:")) $frame.src = $frame.src.split("#")[0] + "#zoom=" + zoom; };

    if (ctx.opts?.openFsFile && fs.exists(ctx.opts.openFsFile)) open(ctx.opts.openFsFile);

    return { unmount() { el.remove(); } };
  },
};

function listPdfs() {
  return new Promise((resolve) => {
    const found = [];
    const walk = (node, base) => {
      for (const c of Object.values(node.children || {})) {
        const p = base === "/" ? "/" + c.name : base + "/" + c.name;
        if (c.type === "dir") walk(c, p);
        else if ((c.mime || "") === "application/pdf") found.push(p);
      }
    };
    walk(fs.root, "/");
    const r = document.createElement("div");
    r.className = "dialog-backdrop";
    r.innerHTML = `<div class="dialog"><h3>PDFs in VFS</h3>${found.length
      ? `<div class="pdf-picker">${found.map((p) => `<button class="sidebar-item" data-p="${p}">📕 ${p}</button>`).join("")}</div>`
      : `<p>No PDFs yet. Import one with the toolbar.</p>`}
      <div class="row"><button class="btn" data-c>Close</button></div></div>`;
    document.body.appendChild(r);
    const close = (v) => { r.remove(); resolve(v); };
    r.querySelector("[data-c]").onclick = () => close(null);
    r.querySelectorAll("[data-p]").forEach((b) => b.addEventListener("click", () => close(b.dataset.p)));
  });
}
