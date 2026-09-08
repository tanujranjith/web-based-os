import { fs, joinPath, basename, dirname } from "../core/filesystem.js";
import { bus } from "../core/event-bus.js";
import { contextMenu } from "../ui/context-menu.js";

const COMMON = [
  { label: "Desktop", path: "/Desktop", icon: "🖥" },
  { label: "Documents", path: "/Documents", icon: "📄" },
  { label: "Downloads", path: "/Downloads", icon: "⬇" },
  { label: "Pictures", path: "/Pictures", icon: "🖼" },
  { label: "Projects", path: "/Projects", icon: "💼" },
];

export default {
  id: "files",
  name: "Files",
  icon: "📁",
  category: "System",
  defaultSize: { w: 820, h: 540 },
  keywords: ["finder", "explorer", "folder"],
  mount(container, ctx) {
    let cwd = ctx.opts?.path || "/Desktop";
    let selected = null;

    const el = document.createElement("div");
    el.className = "app";
    el.innerHTML = `
      <div class="app-toolbar">
        <button class="btn ghost" data-act="back" aria-label="Up">↑ Up</button>
        <button class="btn ghost" data-act="new-folder">＋ Folder</button>
        <button class="btn ghost" data-act="new-file">＋ Text file</button>
        <div class="files-breadcrumbs" id="bc"></div>
      </div>
      <div class="app-body">
        <aside class="app-sidebar scroll-thin">
          <div class="sidebar-section">
            <h4>Locations</h4>
            ${COMMON.map((c) => `<div class="sidebar-item" data-path="${c.path}"><span>${c.icon}</span><span>${c.label}</span></div>`).join("")}
          </div>
        </aside>
        <main class="app-main">
          <div class="files-grid scroll-thin" id="grid"></div>
          <div class="files-info" id="info"></div>
        </main>
      </div>
    `;
    container.appendChild(el);

    const grid = el.querySelector("#grid");
    const bc = el.querySelector("#bc");
    const info = el.querySelector("#info");

    const open = (path) => {
      if (fs.isDir(path)) { cwd = path; selected = null; render(); }
      else { openFile(path); }
    };

    const openFile = (path) => {
      const node = fs.read(path);
      if (!node) return;
      const mime = node.mime || "";
      const ext = path.split(".").pop().toLowerCase();
      if (mime.startsWith("image/") || ["png","jpg","jpeg","gif","webp","svg"].includes(ext)) {
        ctx.openApp("image-viewer", { openFsFile: path });
      } else if (mime === "application/pdf" || ext === "pdf") {
        ctx.openApp("pdf-viewer", { openFsFile: path });
      } else if (mime.startsWith("audio/") || ["mp3","wav","ogg","m4a","flac"].includes(ext)) {
        ctx.openApp("music");
      } else if (["js","ts","jsx","tsx","json","html","css","py","rs","go"].includes(ext)) {
        ctx.openApp("code-editor", { openFsFile: path });
        bus.emit("code-open-file", { path });
      } else if (["md","markdown"].includes(ext)) {
        ctx.openApp("markdown", { openFsFile: path });
      } else {
        ctx.openApp("notes", { openFsFile: path });
        bus.emit("notes-open-file", { path });
      }
    };

    const setSelected = (path) => {
      selected = path;
      grid.querySelectorAll(".files-cell").forEach((c) => c.classList.toggle("selected", c.dataset.path === path));
      updateInfo();
    };

    const updateInfo = () => {
      const entries = fs.ls(cwd) || [];
      let str = `${entries.length} item${entries.length === 1 ? "" : "s"}`;
      if (selected) {
        const s = fs.stat(selected);
        if (s) str += ` · ${s.name} · ${s.type === "dir" ? "Folder" : formatSize(s.size)} · modified ${new Date(s.modifiedAt).toLocaleString()}`;
      }
      info.textContent = str;
    };

    const render = () => {
      // breadcrumbs
      const parts = cwd.split("/").filter(Boolean);
      bc.innerHTML = `<span class="crumb" data-path="/">🏠</span>` + parts.map((p, i) => {
        const path = "/" + parts.slice(0, i + 1).join("/");
        return `<span class="sep">/</span><span class="crumb" data-path="${path}">${escape(p)}</span>`;
      }).join("");
      bc.querySelectorAll(".crumb").forEach((c) => c.addEventListener("click", () => { cwd = c.dataset.path; render(); }));

      // sidebar active
      el.querySelectorAll(".sidebar-item").forEach((s) => s.classList.toggle("active", s.dataset.path === cwd));

      const entries = fs.ls(cwd) || [];
      grid.innerHTML = "";
      if (!entries.length) {
        grid.innerHTML = `<div class="app-empty" style="grid-column: 1/-1"><div class="em-icon">📂</div><div class="em-title">This folder is empty</div><div class="em-sub">Use the toolbar or right-click to add files and folders.</div></div>`;
      } else {
        for (const e of entries) {
          const cell = document.createElement("button");
          cell.className = "files-cell";
          cell.dataset.path = e.path;
          cell.innerHTML = `<span class="icon">${e.type === "dir" ? "📁" : iconFor(e.name)}</span><span class="name">${escape(e.name)}</span>`;
          cell.addEventListener("click", () => setSelected(e.path));
          cell.addEventListener("dblclick", () => open(e.path));
          cell.addEventListener("contextmenu", (ev) => {
            ev.preventDefault(); ev.stopPropagation();
            setSelected(e.path);
            contextMenu.open(ev.clientX, ev.clientY, [
              { label: "Open", action: () => open(e.path) },
              { label: "Rename", action: () => rename(e) },
              { label: "Delete", action: () => del(e) },
            ]);
          });
          grid.appendChild(cell);
        }
      }
      updateInfo();
    };

    const rename = (entry) => {
      const cell = grid.querySelector(`.files-cell[data-path="${cssEscape(entry.path)}"] .name`);
      if (!cell) return;
      cell.setAttribute("contenteditable", "true");
      const original = cell.textContent;
      cell.focus();
      document.getSelection().selectAllChildren(cell);
      const finish = (commit) => {
        cell.removeAttribute("contenteditable");
        cell.removeEventListener("keydown", onKey);
        cell.removeEventListener("blur", onBlur);
        const newName = cell.textContent.trim();
        if (!commit || !newName || newName === original) { render(); return; }
        try {
          fs.rename(entry.path, newName);
          bus.emit("notify", { title: "Renamed", body: `${original} → ${newName}` });
        } catch (e) {
          bus.emit("notify", { title: "Rename failed", body: e.message });
        }
        render();
      };
      const onKey = (e) => {
        if (e.key === "Enter") { e.preventDefault(); finish(true); }
        if (e.key === "Escape") finish(false);
      };
      const onBlur = () => finish(true);
      cell.addEventListener("keydown", onKey);
      cell.addEventListener("blur", onBlur);
    };

    const del = (entry) => {
      if (!confirm(`Delete ${entry.name}?`)) return;
      try {
        fs.remove(entry.path);
        bus.emit("notify", { title: "Deleted", body: entry.name });
      } catch (e) {
        bus.emit("notify", { title: "Delete failed", body: e.message });
      }
      render();
    };

    const newFolder = () => {
      let name = "New Folder", i = 1;
      while (fs.exists(joinPath(cwd, name))) name = `New Folder ${++i}`;
      fs.mkdir(joinPath(cwd, name));
      render();
      const stat = fs.stat(joinPath(cwd, name));
      if (stat) {
        setTimeout(() => rename({ path: joinPath(cwd, name), name }), 50);
      }
    };
    const newFile = () => {
      let name = "Untitled.txt", i = 1;
      while (fs.exists(joinPath(cwd, name))) name = `Untitled ${++i}.txt`;
      fs.touch(joinPath(cwd, name), "");
      render();
      setTimeout(() => rename({ path: joinPath(cwd, name), name }), 50);
    };

    el.querySelector('[data-act="back"]').addEventListener("click", () => { if (cwd !== "/") { cwd = dirname(cwd) || "/"; render(); } });
    el.querySelector('[data-act="new-folder"]').addEventListener("click", newFolder);
    el.querySelector('[data-act="new-file"]').addEventListener("click", newFile);

    el.querySelectorAll(".sidebar-item").forEach((s) => s.addEventListener("click", () => { cwd = s.dataset.path; selected = null; render(); }));

    grid.addEventListener("contextmenu", (e) => {
      if (e.target.closest(".files-cell")) return;
      e.preventDefault();
      contextMenu.open(e.clientX, e.clientY, [
        { label: "New Folder", action: newFolder },
        { label: "New Text File", action: newFile },
        { sep: true },
        { label: "Refresh", action: render },
      ]);
    });

    const unsub = bus.on("fs-change", render);

    render();

    return {
      onOpen(opts) { if (opts.path && fs.isDir(opts.path)) { cwd = opts.path; selected = null; render(); } },
      unmount() { unsub(); el.remove(); },
    };
  },
};

function iconFor(name) {
  const ext = name.split(".").pop().toLowerCase();
  if (["txt", "md"].includes(ext)) return "📝";
  if (["js", "ts", "jsx", "tsx", "py", "rs", "go", "java", "c", "cpp", "h"].includes(ext)) return "📜";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return "🖼";
  if (["mp3", "wav", "ogg", "flac"].includes(ext)) return "🎵";
  if (["mp4", "mkv", "mov", "webm"].includes(ext)) return "🎬";
  if (["zip", "rar", "7z", "tar"].includes(ext)) return "🗜";
  if (["pdf"].includes(ext)) return "📕";
  return "📄";
}
function formatSize(n) { if (n < 1024) return `${n} B`; if (n < 1024 * 1024) return `${(n/1024).toFixed(1)} KB`; return `${(n/1024/1024).toFixed(2)} MB`; }
function escape(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function cssEscape(s) { return String(s).replace(/(["\\])/g, "\\$1"); }
