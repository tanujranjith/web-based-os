import { store } from "../core/state.js";
import { fs, basename } from "../core/filesystem.js";
import { bus } from "../core/event-bus.js";

const newNote = () => ({
  id: crypto.randomUUID?.() || String(Math.random()).slice(2),
  title: "Untitled",
  body: "",
  createdAt: Date.now(),
  modifiedAt: Date.now(),
});

export default {
  id: "notes",
  name: "Notes",
  icon: "📝",
  category: "Productivity",
  defaultSize: { w: 760, h: 520 },
  keywords: ["note", "memo", "write", "text"],
  mount(container, ctx) {
    const el = document.createElement("div");
    el.className = "app";
    el.innerHTML = `
      <div class="app-body">
        <aside class="notes-list">
          <div class="search">
            <input class="input" id="nt-search" placeholder="Search notes…" />
          </div>
          <div class="app-toolbar" style="border-bottom:1px solid var(--border);padding:6px 10px">
            <button class="btn primary" id="nt-new">＋ New note</button>
          </div>
          <div class="notes-items scroll-thin" id="nt-items"></div>
        </aside>
        <main class="notes-editor">
          <input class="title-input" id="nt-title" placeholder="Note title" />
          <textarea class="body-input scroll-thin" id="nt-body" placeholder="Start writing…"></textarea>
        </main>
      </div>
    `;
    container.appendChild(el);

    const $items = el.querySelector("#nt-items");
    const $search = el.querySelector("#nt-search");
    const $title = el.querySelector("#nt-title");
    const $body = el.querySelector("#nt-body");
    const $new = el.querySelector("#nt-new");
    let activeId = null;
    let importedFsPath = null;
    let importedContent = null;
    let saveTimer;

    const notes = () => store.get().notes;

    const renderList = () => {
      const q = $search.value.trim().toLowerCase();
      const list = notes().filter((n) =>
        !q || n.title.toLowerCase().includes(q) || (n.body || "").toLowerCase().includes(q)
      ).sort((a, b) => b.modifiedAt - a.modifiedAt);

      if (!list.length) {
        $items.innerHTML = `<div class="app-empty"><div class="em-icon">🪶</div><div class="em-title">No notes yet</div><div class="em-sub">Create your first note with the button above.</div></div>`;
        return;
      }
      $items.innerHTML = list.map((n) => `
        <button class="notes-item ${n.id === activeId ? "active" : ""}" data-id="${n.id}">
          <span class="nt-title">${escape(n.title || "Untitled")}</span>
          <span class="nt-snippet">${escape((n.body || "").slice(0, 70))}</span>
          <span class="nt-time">${new Date(n.modifiedAt).toLocaleString()}</span>
        </button>
      `).join("");
      $items.querySelectorAll(".notes-item").forEach((b) => {
        b.addEventListener("click", () => select(b.dataset.id));
        b.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          import("../ui/context-menu.js").then(({ contextMenu }) => {
            contextMenu.open(e.clientX, e.clientY, [
              { label: "Open", action: () => select(b.dataset.id) },
              { label: "Duplicate", action: () => duplicate(b.dataset.id) },
              { label: "Delete", action: () => del(b.dataset.id) },
            ]);
          });
        });
      });
    };

    const select = (id) => {
      const n = notes().find((x) => x.id === id);
      if (!n) return;
      activeId = id;
      importedFsPath = null;
      $title.disabled = false;
      $title.value = n.title;
      $body.value = n.body;
      ctx.setTitle?.("Notes");
      renderList();
    };

    const create = (title = "Untitled", body = "") => {
      const n = newNote();
      n.title = title; n.body = body;
      store.update((s) => { s.notes.push(n); });
      select(n.id);
    };

    const openFsFile = (path) => {
      const node = fs.read(path);
      if (!node) return;
      importedFsPath = path;
      activeId = null;
      $title.disabled = true;
      $title.value = basename(path);
      $body.value = node.content;
      ctx.setTitle?.(`Notes — ${basename(path)}`);
      renderList();
    };

    const duplicate = (id) => {
      const src = notes().find((x) => x.id === id);
      if (!src) return;
      const n = { ...newNote(), title: src.title + " (copy)", body: src.body };
      store.update((s) => { s.notes.push(n); });
      select(n.id);
    };

    const del = (id) => {
      if (!confirm("Delete this note?")) return;
      store.update((s) => { s.notes = s.notes.filter((x) => x.id !== id); });
      if (activeId === id) { activeId = null; $title.value = ""; $body.value = ""; }
      renderList();
    };

    const scheduleSave = () => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        if (importedFsPath) {
          fs.write(importedFsPath, $body.value);
        } else if (activeId) {
          store.update((s) => {
            const n = s.notes.find((x) => x.id === activeId);
            if (!n) return;
            n.title = $title.value || "Untitled";
            n.body = $body.value;
            n.modifiedAt = Date.now();
          });
        }
        renderList();
      }, 220);
    };

    $title.addEventListener("input", scheduleSave);
    $body.addEventListener("input", scheduleSave);
    $search.addEventListener("input", renderList);
    $new.addEventListener("click", () => create());

    const onShortcutNew = bus.on("shortcut-new", () => create());
    const onOpenFsFile = bus.on("notes-open-file", ({ path }) => openFsFile(path));

    // initial selection — open from FS or create new
    if (ctx.opts?.openFsFile && fs.exists(ctx.opts.openFsFile)) {
      openFsFile(ctx.opts.openFsFile);
    } else if (ctx.opts?.newNote || notes().length === 0) {
      create();
    } else {
      const list = [...notes()].sort((a, b) => b.modifiedAt - a.modifiedAt);
      if (list[0]) select(list[0].id);
    }

    renderList();

    return {
      unmount() {
        onShortcutNew?.();
        onOpenFsFile?.();
        clearTimeout(saveTimer);
        el.remove();
      },
    };
  },
};

function escape(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
