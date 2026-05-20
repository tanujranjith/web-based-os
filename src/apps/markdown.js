import { fs, basename, joinPath } from "../core/filesystem.js";
import { bus } from "../core/event-bus.js";

export default {
  id: "markdown",
  name: "Markdown",
  icon: "📑",
  category: "Productivity",
  defaultSize: { w: 880, h: 560 },
  keywords: ["md", "markdown", "writer", "editor"],
  mount(container, ctx) {
    const el = document.createElement("div");
    el.className = "app md-app";
    el.innerHTML = `
      <div class="app-toolbar">
        <button class="btn" id="md-open">📂 Open…</button>
        <button class="btn primary" id="md-save">💾 Save</button>
        <button class="btn ghost" id="md-new">＋ New</button>
        <span class="ce-status" id="md-status">Untitled.md</span>
        <span class="ce-spacer"></span>
        <button class="btn ghost" id="md-toggle">Preview only</button>
      </div>
      <div class="md-body">
        <textarea class="md-edit scroll-thin" id="md-edit" spellcheck="false" placeholder="Write Markdown…"></textarea>
        <div class="md-preview scroll-thin" id="md-preview"></div>
      </div>
    `;
    container.appendChild(el);

    const $edit = el.querySelector("#md-edit");
    const $prev = el.querySelector("#md-preview");
    const $status = el.querySelector("#md-status");
    const $toggle = el.querySelector("#md-toggle");
    const $body = el.querySelector(".md-body");

    let currentPath = ctx.opts?.openFsFile || null;
    let dirty = false;
    let split = "split";

    const setStatus = () => {
      $status.textContent = (currentPath ? basename(currentPath) : "Untitled.md") + (dirty ? " •" : "");
      ctx.setTitle?.("Markdown — " + (currentPath ? basename(currentPath) : "Untitled.md"));
    };

    const render = () => { $prev.innerHTML = mdToHtml($edit.value); };

    $edit.addEventListener("input", () => { dirty = true; setStatus(); render(); });
    $edit.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); save(); }
    });

    const cycle = () => {
      split = split === "split" ? "preview" : split === "preview" ? "edit" : "split";
      $body.dataset.mode = split;
      $toggle.textContent = split === "split" ? "Preview only" : split === "preview" ? "Editor only" : "Split view";
    };
    $toggle.addEventListener("click", cycle);
    $body.dataset.mode = "split";

    const open = (path) => {
      const node = fs.read(path);
      if (!node) return;
      currentPath = path;
      $edit.value = node.content || "";
      dirty = false;
      setStatus();
      render();
    };

    const save = () => {
      if (!currentPath) {
        const name = prompt("Save as (filename or path):", "Untitled.md");
        if (!name) return;
        currentPath = name.startsWith("/") ? name : joinPath("/Documents", name);
        if (fs.exists(currentPath) && !confirm(`Overwrite ${currentPath}?`)) { currentPath = null; return; }
      }
      fs.write(currentPath, $edit.value, { mime: "text/markdown" });
      dirty = false;
      setStatus();
      bus.emit("notify", { title: "Saved", body: currentPath });
    };

    el.querySelector("#md-open").addEventListener("click", () => askPath().then((p) => p && open(p)));
    el.querySelector("#md-save").addEventListener("click", save);
    el.querySelector("#md-new").addEventListener("click", () => {
      if (dirty && !confirm("Discard unsaved changes?")) return;
      currentPath = null; $edit.value = ""; dirty = false; setStatus(); render();
    });

    if (currentPath && fs.exists(currentPath)) open(currentPath);
    else { $edit.value = "# Welcome to Markdown\n\nWrite **markdown** on the left, see the *preview* on the right.\n\n- Lists\n- And [links](https://example.com)\n- And `inline code`\n\n```\nfunction hello() {\n  return 'NovaOS';\n}\n```\n\n> Block quotes too.\n"; setStatus(); render(); }

    return { unmount() { el.remove(); } };
  },
};

function askPath() {
  return new Promise((resolve) => {
    const r = document.createElement("div");
    r.className = "dialog-backdrop";
    r.innerHTML = `<div class="dialog"><h3>Open Markdown</h3><input class="input" id="mp" value="/Documents/README.md"/><div class="row"><button class="btn" data-c>Cancel</button><button class="btn primary" data-o>Open</button></div></div>`;
    document.body.appendChild(r);
    const i = r.querySelector("#mp"); setTimeout(() => i.focus(), 10);
    r.querySelector("[data-c]").onclick = () => { r.remove(); resolve(null); };
    r.querySelector("[data-o]").onclick = () => { r.remove(); resolve(i.value); };
    i.addEventListener("keydown", (e) => { if (e.key === "Enter") { r.remove(); resolve(i.value); } if (e.key === "Escape") { r.remove(); resolve(null); } });
  });
}

/* Minimal Markdown → HTML converter (safe: all input is escaped first). */
export function mdToHtml(src) {
  let s = escape(src);
  // Code fences
  s = s.replace(/```([\s\S]*?)```/g, (_, code) => `<pre class="md-code"><code>${code}</code></pre>`);
  // Headings
  s = s.replace(/^(#{1,6})\s+(.+)$/gm, (_, h, txt) => `<h${h.length}>${txt.trim()}</h${h.length}>`);
  // Blockquote
  s = s.replace(/^&gt;\s?(.+)$/gm, "<blockquote>$1</blockquote>");
  // Lists (ul / ol)
  s = s.replace(/(?:^|\n)((?:\s*[-*]\s+.+(?:\n|$))+)/g, (block) => {
    const items = block.trim().split(/\n/).map((l) => l.replace(/^\s*[-*]\s+/, "").trim());
    return "\n<ul>" + items.map((i) => `<li>${i}</li>`).join("") + "</ul>";
  });
  s = s.replace(/(?:^|\n)((?:\s*\d+\.\s+.+(?:\n|$))+)/g, (block) => {
    const items = block.trim().split(/\n/).map((l) => l.replace(/^\s*\d+\.\s+/, "").trim());
    return "\n<ol>" + items.map((i) => `<li>${i}</li>`).join("") + "</ol>";
  });
  // Bold, italic, inline code
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\*(.+?)\*/g, "<em>$1</em>");
  s = s.replace(/`([^`\n]+)`/g, "<code>$1</code>");
  // Links
  s = s.replace(/\[(.+?)\]\((https?:[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  // Paragraphs: split on blank lines
  s = s.split(/\n{2,}/).map((blk) => /^<(h\d|ul|ol|blockquote|pre)/.test(blk.trim()) ? blk : `<p>${blk.replace(/\n/g, "<br>")}</p>`).join("\n");
  return s;
}

function escape(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
