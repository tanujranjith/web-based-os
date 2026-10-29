import { store } from "../core/state.js";
import { fs, basename } from "../core/filesystem.js";
import { bus } from "../core/event-bus.js";
import { escape } from "../ui/icons.js";
import { fileDialog } from "../ui/dialogs.js";
import { openFile } from "../core/file-actions.js";
export default {
  id: "notes",
  name: "Notes",
  category: "Productivity",
  keywords: ["memo", "write", "markdown", "notes"],
  defaultSize: { w: 1000, h: 680 },
  mount(container, ctx) {
    const el = document.createElement("div");
    el.className = "app notes-workbench";
    el.innerHTML = `<div class="app-toolbar"><button class="btn primary" data-new>New note</button><input class="input" data-search placeholder="Search notes or #tags" aria-label="Search notes"><select class="select" data-folder aria-label="Note folder"><option value="">All folders</option></select><button class="btn" data-export>Export</button><button class="btn" data-delete>Delete</button></div><div class="app-body"><aside class="notes-list"><div class="notes-items scroll-thin"></div></aside><main class="notes-editor"><div class="note-tabs" role="tablist"></div><input class="title-input" aria-label="Note title" placeholder="Untitled"><div class="note-details"><input class="input" data-note-folder placeholder="Folder" aria-label="Folder"><input class="input" data-tags placeholder="Tags, separated by commas" aria-label="Tags"></div><div class="note-format"><button class="btn" data-format="bold">Bold</button><button class="btn" data-format="italic">Italic</button><button class="btn" data-format="heading">Heading</button><button class="btn" data-format="list">List</button><button class="btn" data-attach>Attach file</button><button class="btn" data-preview>Read</button><span class="ce-spacer"></span><small data-saved role="status">Saved</small></div><textarea class="body-input" aria-label="Note body" placeholder="Start writing. Markdown formatting is supported."></textarea><article class="note-preview scroll-thin" hidden></article><div class="note-attachments"></div></main></div>`;
    container.append(el);
    const title = el.querySelector(".title-input"),
      body = el.querySelector("textarea"),
      folder = el.querySelector("[data-note-folder]"),
      tags = el.querySelector("[data-tags]"),
      list = el.querySelector(".notes-items"),
      read = el.querySelector(".note-preview");
    let active = null,
      path = null,
      tabs = [],
      reading = false,
      markdown,
      disposed = false;
    const current = () => store.get().notes.find((n) => n.id === active);
    function renderList() {
      const q = el.querySelector("[data-search]").value.toLowerCase(),
        f = el.querySelector("[data-folder]").value;
      const notes = store
        .get()
        .notes.filter(
          (n) =>
            (!f || n.folder === f) &&
            (!q ||
              [n.title, n.body, ...(n.tags || [])]
                .join(" ")
                .toLowerCase()
                .includes(q.replace(/^#/, ""))),
        )
        .sort((a, b) => b.modifiedAt - a.modifiedAt);
      list.innerHTML =
        notes
          .map(
            (n) =>
              `<button class="notes-item ${n.id === active ? "active" : ""}" data-id="${escape(n.id)}"><strong>${escape(n.title || "Untitled")}</strong><span class="nt-snippet">${escape((n.body || "").slice(0, 80))}</span><small>${escape(n.folder || "Notes")} · ${new Date(n.modifiedAt).toLocaleDateString()}</small></button>`,
          )
          .join("") || '<p class="app-empty">No notes match.</p>';
      list
        .querySelectorAll("button")
        .forEach((b) => (b.onclick = () => select(b.dataset.id)));
      const dirs = [
        ...new Set(
          store
            .get()
            .notes.map((n) => n.folder)
            .filter(Boolean),
        ),
      ];
      el.querySelector("[data-folder]").innerHTML =
        '<option value="">All folders</option>' +
        dirs
          .map(
            (x) => `<option ${x === f ? "selected" : ""}>${escape(x)}</option>`,
          )
          .join("");
    }
    function tabbar() {
      el.querySelector(".note-tabs").innerHTML = tabs
        .map((id) => {
          const n = store.get().notes.find((n) => n.id === id);
          return n
            ? `<button role="tab" aria-selected="${id === active}" data-tab="${escape(id)}">${escape(n.title || "Untitled")}</button>`
            : "";
        })
        .join("");
      el.querySelectorAll("[data-tab]").forEach(
        (b) => (b.onclick = () => select(b.dataset.tab)),
      );
    }
    function attachments() {
      el.querySelector(".note-attachments").innerHTML = (
        current()?.attachments || []
      )
        .map(
          (p) =>
            `<button class="btn" data-attachment="${escape(p)}">▤ ${escape(basename(p))}</button>`,
        )
        .join("");
      el.querySelectorAll("[data-attachment]").forEach(
        (b) => (b.onclick = () => openFile(b.dataset.attachment)),
      );
    }
    async function preview() {
      if (!reading) return;
      markdown ??= (await import("../../vendor/markdown.js")).markdown;
      if (!disposed) read.innerHTML = markdown(body.value);
    }
    function select(id) {
      const n = store.get().notes.find((n) => n.id === id);
      if (!n) return;
      active = id;
      path = null;
      if (!tabs.includes(id)) tabs.push(id);
      title.disabled = false;
      title.value = n.title;
      body.value = n.body;
      folder.value = n.folder || "";
      tags.value = (n.tags || []).join(", ");
      ctx.setTitle("Notes · " + (n.title || "Untitled"));
      renderList();
      tabbar();
      attachments();
      preview();
      ctx.checkpoint?.();
    }
    function create() {
      const n = {
        id: crypto.randomUUID(),
        title: "Untitled",
        body: "",
        folder: "",
        tags: [],
        attachments: [],
        createdAt: Date.now(),
        modifiedAt: Date.now(),
      };
      store.update((s) => s.notes.push(n));
      select(n.id);
      title.focus();
      title.select();
    }
    function open(pathname) {
      const n = fs.read(pathname);
      if (!n || n.binary) return;
      path = pathname;
      active = null;
      title.value = basename(path);
      title.disabled = true;
      body.value = n.content;
      folder.value = "";
      tags.value = "";
      el.querySelector(".note-attachments").replaceChildren();
      ctx.setTitle("Notes · " + basename(path));
      renderList();
      preview();
      ctx.checkpoint?.();
    }
    function save() {
      if (path) {
        fs.write(path, body.value);
      } else if (active)
        store.update((s) => {
          const n = s.notes.find((n) => n.id === active);
          if (n)
            Object.assign(n, {
              title: title.value || "Untitled",
              body: body.value,
              folder: folder.value.trim(),
              tags: tags.value
                .split(",")
                .map((x) => x.trim())
                .filter(Boolean),
              modifiedAt: Date.now(),
            });
        });
      ctx.setTitle("Notes · " + (title.value || "Untitled"));
      renderList();
      tabbar();
      preview();
      el.querySelector("[data-saved]").textContent = "Saving…";
    }
    [title, body, folder, tags].forEach((x) => (x.oninput = save));
    el.querySelector("[data-search]").oninput = renderList;
    el.querySelector("[data-folder]").onchange = renderList;
    el.querySelector("[data-new]").onclick = create;
    el.querySelector("[data-preview]").onclick = () => {
      reading = !reading;
      body.hidden = reading;
      read.hidden = !reading;
      el.querySelector("[data-preview]").textContent = reading
        ? "Edit"
        : "Read";
      preview();
    };
    el.querySelectorAll("[data-format]").forEach(
      (b) =>
        (b.onclick = () => {
          const start = body.selectionStart,
            end = body.selectionEnd,
            text = body.value.slice(start, end),
            format = b.dataset.format;
          const insert =
            format === "bold"
              ? `**${text || "text"}**`
              : format === "italic"
                ? `*${text || "text"}*`
                : format === "heading"
                  ? `\n## ${text || "Heading"}\n`
                  : `\n- ${text || "List item"}`;
          body.setRangeText(insert, start, end, "end");
          body.focus();
          save();
        }),
    );
    el.querySelector("[data-attach]").onclick = async () => {
      if (!active) return;
      const p = await fileDialog();
      if (p) {
        store.update((s) => {
          const n = s.notes.find((n) => n.id === active);
          n.attachments ??= [];
          if (!n.attachments.includes(p)) n.attachments.push(p);
        });
        attachments();
      }
    };
    el.querySelector("[data-export]").onclick = () => {
      const a = document.createElement("a"),
        url = URL.createObjectURL(
          new Blob([`# ${title.value}\n\n${body.value}`], {
            type: "text/markdown",
          }),
        );
      a.href = url;
      a.download = (title.value || "Note") + ".md";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    el.querySelector("[data-delete]").onclick = () => {
      if (!active || !confirm("Move this note to Trash?")) return;
      const n = current();
      const p = fs.unique(
        "/Documents/" + (n.title || "Note").replaceAll("/", "-") + ".md",
      );
      fs.touch(p, `# ${n.title}\n\n${n.body}`);
      fs.remove(p);
      store.update((s) => (s.notes = s.notes.filter((x) => x.id !== active)));
      tabs = tabs.filter((id) => id !== active);
      active = null;
      store.get().notes.length ? select(store.get().notes[0].id) : create();
    };
    const off = bus.on("notes-select", ({ id }) => select(id)),
      offSave = bus.on("save-status", (value) => {
        el.querySelector("[data-saved]").textContent =
          value === "saved"
            ? "Saved on this device"
            : value === "error"
              ? "Save failed, export a copy"
              : "Saving…";
      });
    const onOpen = (opts) => {
      if (opts.openFsFile) open(opts.openFsFile);
      else if (opts.noteId) select(opts.noteId);
      else if (opts.newNote) create();
    };
    if (ctx.opts.openFsFile) open(ctx.opts.openFsFile);
    else if (ctx.opts.noteId) select(ctx.opts.noteId);
    else if (ctx.opts.newNote || !store.get().notes.length) create();
    else select(store.get().notes[0].id);
    return {
      onOpen,
      session: () => (path ? { openFsFile: path } : { noteId: active }),
      unmount() {
        disposed = true;
        off();
        offSave();
        el.remove();
      },
    };
  },
};
