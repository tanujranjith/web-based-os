import { fs, joinPath, dirname, basename } from "../core/filesystem.js";
import { store } from "../core/state.js";
import { bus } from "../core/event-bus.js";
import { openFile, downloadFile } from "../core/file-actions.js";
import { contextMenu } from "../ui/context-menu.js";
import { escape } from "../ui/icons.js";
let clipboard = null;
const locations = ["Desktop", "Documents", "Downloads", "Pictures", "Projects"];
export default {
  id: "files",
  name: "Files",
  category: "System",
  keywords: ["finder", "explorer", "folder", "trash"],
  defaultSize: { w: 980, h: 640 },
  mount(container, ctx) {
    let cwd = ctx.opts.path || "/Desktop",
      selected = new Set(),
      query = "",
      sort = "name",
      view = store.get().prefs.fileView || "grid",
      history = [],
      forward = [];
    const el = document.createElement("div");
    el.className = "app files-app";
    el.innerHTML = `<div class="app-toolbar"><button class="btn" data-back aria-label="Back">‹</button><button class="btn" data-forward aria-label="Forward">›</button><button class="btn" data-up aria-label="Parent folder">↑</button><div class="files-breadcrumbs"></div><input class="input file-search" aria-label="Search folder" placeholder="Search this folder"><button class="btn" data-view>List</button></div><div class="app-body"><aside class="app-sidebar"><div class="sidebar-section"><h4>Locations</h4>${locations.map((n) => `<button class="sidebar-item" data-dir="/${n}">▣ ${n}</button>`).join("")}<button class="sidebar-item" data-dir="trash">♲ Trash</button></div><div class="sidebar-section"><h4>Actions</h4><button class="sidebar-item" data-folder>New folder</button><button class="sidebar-item" data-text>New text file</button><label class="sidebar-item">Import files<input type="file" multiple hidden data-import></label><button class="sidebar-item" data-window>New window</button></div></aside><main class="app-main"><div class="files-tools"><span data-count></span><select class="select" aria-label="Sort files"><option value="name">Name</option><option value="modifiedAt">Modified</option><option value="size">Size</option></select><button class="btn" data-paste>Paste</button><button class="btn" data-undo>Restore last deleted</button></div><div class="files-content"><div class="files-grid scroll-thin" tabindex="0" role="listbox" aria-label="Files" aria-multiselectable="true"></div><aside class="file-preview" hidden></aside></div><div class="files-info" role="status"></div></main></div>`;
    container.append(el);
    const grid = el.querySelector(".files-grid"),
      preview = el.querySelector(".file-preview");
    const safe = (fn) => {
      try {
        return fn();
      } catch (error) {
        bus.emit("notify", { title: "Files", body: error.message });
      }
    };
    const go = (path) => {
      if (path !== "trash" && !fs.isDir(path)) return;
      history.push(cwd);
      forward = [];
      cwd = path;
      selected.clear();
      render();
      ctx.setTitle("Files · " + (cwd === "trash" ? "Trash" : basename(cwd)));
      ctx.checkpoint?.();
    };
    const entries = () => {
      if (cwd === "trash")
        return (store.get().trash || []).map((x) => ({
          ...x.node,
          path: x.id,
          trashId: x.id,
          original: x.path,
        }));
      return (fs.ls(cwd) || [])
        .filter((x) => x.name.toLowerCase().includes(query))
        .sort((a, b) =>
          a.type === b.type
            ? sort === "name"
              ? a.name.localeCompare(b.name)
              : (b[sort] || 0) - (a[sort] || 0)
            : a.type === "dir"
              ? -1
              : 1,
        );
    };
    const showPreview = () => {
      const path = [...selected][0];
      const node = fs.read(path);
      preview.hidden = selected.size !== 1 || !node || cwd === "trash";
      preview.replaceChildren();
      if (preview.hidden) return;
      const title = document.createElement("strong");
      title.textContent = basename(path);
      preview.append(title);
      if (node.mime?.startsWith("image/")) {
        const img = document.createElement("img");
        img.src = node.content;
        img.alt = basename(path);
        preview.append(img);
      } else if (!node.binary) {
        const pre = document.createElement("pre");
        pre.textContent = String(node.content).slice(0, 3000);
        preview.append(pre);
      }
      const p = document.createElement("p");
      p.textContent = `${formatSize(node.size)} · ${node.mime || "File"}`;
      preview.append(p);
    };
    function render() {
      el.querySelector("[data-back]").disabled = !history.length;
      el.querySelector("[data-forward]").disabled = !forward.length;
      el.querySelector(".files-breadcrumbs").textContent =
        cwd === "trash" ? "Trash" : cwd;
      el.querySelector("[data-view]").textContent =
        view === "grid" ? "List" : "Grid";
      grid.classList.toggle("files-list", view === "list");
      el.querySelectorAll("[data-dir]").forEach((b) =>
        b.classList.toggle("active", b.dataset.dir === cwd),
      );
      const list = entries();
      el.querySelector("[data-count]").textContent = `${list.length} items`;
      el.querySelector(".files-info").textContent = selected.size
        ? `${selected.size} selected`
        : "Drag files here to import · Double-click to open";
      grid.innerHTML =
        list
          .map(
            (x) =>
              `<button class="files-cell ${selected.has(x.path) ? "selected" : ""}" role="option" aria-selected="${selected.has(x.path)}" draggable="${cwd !== "trash"}" data-path="${escape(x.path)}"><span class="icon">${x.type === "dir" ? "▣" : x.mime?.startsWith("image/") ? "▧" : "▤"}</span><span class="name">${escape(x.name)}</span><span class="file-meta">${x.type === "dir" ? "Folder" : formatSize(x.size)} · ${new Date(x.modifiedAt || x.createdAt).toLocaleDateString()}</span></button>`,
          )
          .join("") ||
        '<div class="app-empty"><h3>This folder is empty</h3><p>Import files or create something new.</p></div>';
      grid.querySelectorAll("[data-path]").forEach((b) => {
        const path = b.dataset.path;
        b.onclick = (e) => {
          if (!e.ctrlKey && !e.metaKey && !e.shiftKey) selected.clear();
          selected.has(path) ? selected.delete(path) : selected.add(path);
          render();
          grid.querySelector(`[data-path="${CSS.escape(path)}"]`)?.focus();
        };
        b.ondblclick = () =>
          cwd === "trash"
            ? safe(() => fs.restoreTrash(path))
            : fs.isDir(path)
              ? go(path)
              : openFile(path);
        b.ondragstart = (e) => {
          if (!selected.has(path)) {
            selected.clear();
            selected.add(path);
          }
          e.dataTransfer.setData(
            "application/x-nova-files",
            JSON.stringify([...selected]),
          );
        };
        b.ondragover = (e) => {
          if (fs.isDir(path)) e.preventDefault();
        };
        b.ondrop = (e) => {
          if (!fs.isDir(path)) return;
          e.preventDefault();
          e.stopPropagation();
          drop(e, path);
        };
        b.oncontextmenu = (e) => {
          e.preventDefault();
          if (!selected.has(path)) {
            selected.clear();
            selected.add(path);
            render();
          }
          contextMenu.open(
            e.clientX,
            e.clientY,
            cwd === "trash"
              ? [
                  {
                    label: "Restore",
                    action: () => safe(() => fs.restoreTrash(path)),
                  },
                  {
                    label: "Delete permanently",
                    action: () => {
                      if (confirm("Permanently delete this item?"))
                        store.update(
                          (s) =>
                            (s.trash = s.trash.filter((x) => x.id !== path)),
                        );
                      render();
                    },
                  },
                ]
              : [
                  {
                    label: "Open",
                    action: () => (fs.isDir(path) ? go(path) : openFile(path)),
                  },
                  { label: "Rename", action: () => rename(path) },
                  { label: "Copy", action: () => copy(false) },
                  { label: "Cut", action: () => copy(true) },
                  {
                    label: "Duplicate",
                    action: () => safe(() => fs.copy(path, fs.unique(path))),
                  },
                  {
                    label: "Download",
                    disabled: fs.isDir(path),
                    action: () => downloadFile(path),
                  },
                  { sep: true },
                  { label: "Move to Trash", action: remove },
                ],
          );
        };
      });
      showPreview();
    }
    function rename(path) {
      const name = prompt("Rename", basename(path));
      if (name) safe(() => fs.rename(path, name));
    }
    function copy(cut) {
      clipboard = { paths: [...selected], cut };
      bus.emit("notify", {
        title: cut ? "Ready to move" : "Copied",
        body: `${selected.size} items`,
      });
    }
    function paste() {
      if (cwd === "trash" || !clipboard) return;
      safe(() => {
        for (const p of clipboard.paths)
          fs.copy(p, fs.unique(joinPath(cwd, basename(p))), clipboard.cut);
        if (clipboard.cut) clipboard = null;
      });
    }
    function remove() {
      if (cwd === "trash") return;
      safe(() => {
        for (const path of [...selected].filter(
          (p) =>
            ![...selected].some(
              (parent) => parent !== p && p.startsWith(parent + "/"),
            ),
        ))
          fs.remove(path);
        selected.clear();
        render();
      });
    }
    async function drop(e, target = cwd) {
      if (target === "trash") return;
      try {
        const internal = e.dataTransfer.getData("application/x-nova-files");
        if (internal) {
          for (const path of JSON.parse(internal))
            fs.copy(path, fs.unique(joinPath(target, basename(path))), true);
        } else
          for (const file of e.dataTransfer.files)
            await fs.importFile(file, target);
      } catch (error) {
        bus.emit("notify", { title: "Import failed", body: error.message });
      }
    }
    el.querySelector("[data-back]").onclick = () => {
      forward.push(cwd);
      cwd = history.pop();
      selected.clear();
      render();
    };
    el.querySelector("[data-forward]").onclick = () => {
      history.push(cwd);
      cwd = forward.pop();
      selected.clear();
      render();
    };
    el.querySelector("[data-up]").onclick = () => go(dirname(cwd));
    el.querySelector(".file-search").oninput = (e) => {
      query = e.target.value.toLowerCase();
      render();
    };
    el.querySelector("select").onchange = (e) => {
      sort = e.target.value;
      render();
    };
    el.querySelector("[data-view]").onclick = () => {
      view = view === "grid" ? "list" : "grid";
      store.update((s) => (s.prefs.fileView = view));
      render();
    };
    el.querySelector("[data-folder]").onclick = () =>
      safe(() => {
        if (cwd !== "trash") fs.mkdir(fs.unique(joinPath(cwd, "New folder")));
      });
    el.querySelector("[data-text]").onclick = () =>
      safe(() => {
        if (cwd !== "trash")
          fs.touch(fs.unique(joinPath(cwd, "Untitled.txt")), "");
      });
    el.querySelector("[data-import]").onchange = async (e) => {
      try {
        for (const file of e.target.files)
          await fs.importFile(file, cwd === "trash" ? "/Downloads" : cwd);
      } catch (error) {
        bus.emit("notify", { title: "Import failed", body: error.message });
      }
      e.target.value = "";
    };
    el.querySelector("[data-window]").onclick = () =>
      ctx.openApp("files", {
        path: cwd === "trash" ? "/Desktop" : cwd,
        newWindow: true,
      });
    el.querySelector("[data-paste]").onclick = paste;
    el.querySelector("[data-undo]").onclick = () =>
      safe(() => fs.restoreTrash(store.get().trash.at(-1)?.id));
    grid.ondragover = (e) => e.preventDefault();
    grid.ondrop = (e) => {
      e.preventDefault();
      drop(e);
    };
    el.onkeydown = (e) => {
      if (e.target.matches("input,textarea,select")) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && ["a", "c", "x", "v"].includes(e.key.toLowerCase())) {
        e.preventDefault();
        if (e.key.toLowerCase() === "a") {
          selected = new Set(entries().map((x) => x.path));
          render();
        }
        if (e.key.toLowerCase() === "c") copy(false);
        if (e.key.toLowerCase() === "x") copy(true);
        if (e.key.toLowerCase() === "v") paste();
      }
      if (e.key === "Delete") remove();
      if (e.key === "F2" && selected.size === 1) rename([...selected][0]);
      if (e.key === "Enter" && selected.size === 1) {
        const path = [...selected][0];
        cwd === "trash"
          ? safe(() => fs.restoreTrash(path))
          : fs.isDir(path)
            ? go(path)
            : openFile(path);
      }
    };
    const off = bus.on("fs-change", render);
    render();
    return {
      onOpen(opts) {
        if (opts.path) go(opts.path);
      },
      session: () => ({ path: cwd === "trash" ? "/Desktop" : cwd }),
      unmount() {
        off();
        el.remove();
      },
    };
  },
};
function formatSize(n = 0) {
  return n < 1024
    ? `${n} B`
    : n < 1048576
      ? `${(n / 1024).toFixed(1)} KB`
      : `${(n / 1048576).toFixed(1)} MB`;
}
