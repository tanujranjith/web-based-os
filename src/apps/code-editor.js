import { fs, basename, joinPath } from "../core/filesystem.js";
import { bus } from "../core/event-bus.js";

export default {
  id: "code-editor",
  name: "Code",
  icon: "💻",
  category: "Developer",
  defaultSize: { w: 880, h: 580 },
  keywords: ["code", "editor", "ide", "programming", "javascript"],
  mount(container, ctx) {
    const el = document.createElement("div");
    el.className = "app code-app";
    el.innerHTML = `
      <div class="app-toolbar">
        <button class="btn" id="ce-open">📂 Open…</button>
        <button class="btn primary" id="ce-save">💾 Save</button>
        <button class="btn ghost" id="ce-new">＋ New</button>
        <span class="ce-status" id="ce-status">Untitled</span>
        <span class="ce-spacer"></span>
        <select class="select" id="ce-lang" style="width:120px">
          <option value="js">JavaScript</option>
          <option value="md">Markdown</option>
          <option value="json">JSON</option>
          <option value="html">HTML</option>
          <option value="css">CSS</option>
          <option value="txt">Plain</option>
        </select>
      </div>
      <div class="code-body">
        <pre class="code-gutter" id="ce-gutter"><span>1</span></pre>
        <div class="code-edit">
          <pre class="code-hl" id="ce-hl"><code></code></pre>
          <textarea id="ce-area" class="code-area" spellcheck="false" autocorrect="off" autocapitalize="off" wrap="off"></textarea>
        </div>
      </div>
      <div class="code-foot">
        <span id="ce-pos">Ln 1, Col 1</span>
        <span id="ce-len">0 chars</span>
      </div>
    `;
    container.appendChild(el);

    const $area = el.querySelector("#ce-area");
    const $hl = el.querySelector("#ce-hl code");
    const $gutter = el.querySelector("#ce-gutter");
    const $status = el.querySelector("#ce-status");
    const $pos = el.querySelector("#ce-pos");
    const $len = el.querySelector("#ce-len");
    const $lang = el.querySelector("#ce-lang");

    let currentPath = null;
    let dirty = false;

    const setStatus = () => { $status.textContent = (currentPath ? basename(currentPath) : "Untitled") + (dirty ? " •" : ""); ctx.setTitle?.("Code — " + (currentPath ? basename(currentPath) : "Untitled")); };
    const setDirty = (d) => { if (dirty !== d) { dirty = d; setStatus(); } };

    const langFromName = (name) => {
      const ext = (name.split(".").pop() || "").toLowerCase();
      if (["js", "ts", "jsx", "tsx"].includes(ext)) return "js";
      if (ext === "md" || ext === "markdown") return "md";
      if (ext === "json") return "json";
      if (ext === "html" || ext === "htm") return "html";
      if (ext === "css") return "css";
      return "txt";
    };

    const update = () => {
      const text = $area.value;
      const lang = $lang.value;
      $hl.innerHTML = highlight(text, lang);
      const lines = text.split("\n").length;
      $gutter.innerHTML = Array.from({ length: lines }, (_, i) => `<span>${i + 1}</span>`).join("");
      $len.textContent = `${text.length} chars`;
      const pos = $area.selectionStart;
      const before = text.slice(0, pos);
      const line = before.split("\n").length;
      const col = before.length - before.lastIndexOf("\n");
      $pos.textContent = `Ln ${line}, Col ${col}`;
    };

    const sync = () => { $hl.parentElement.scrollTop = $area.scrollTop; $hl.parentElement.scrollLeft = $area.scrollLeft; $gutter.scrollTop = $area.scrollTop; };

    $area.addEventListener("input", () => { setDirty(true); update(); });
    $area.addEventListener("scroll", sync);
    $area.addEventListener("keyup", update);
    $area.addEventListener("click", update);
    $area.addEventListener("keydown", (e) => {
      if (e.key === "Tab") {
        e.preventDefault();
        const start = $area.selectionStart, end = $area.selectionEnd;
        $area.setRangeText("  ", start, end, "end");
        update();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
      }
    });
    $lang.addEventListener("change", update);

    const open = (path) => {
      const node = fs.read(path);
      if (!node) return;
      currentPath = path;
      $area.value = node.content || "";
      $lang.value = langFromName(path);
      dirty = false;
      setStatus();
      update();
    };

    const save = () => {
      if (!currentPath) {
        const name = prompt("Save as (full path or filename):", `Untitled.${$lang.value}`);
        if (!name) return;
        currentPath = name.startsWith("/") ? name : joinPath("/Documents", name);
        if (fs.exists(currentPath) && !confirm(`Overwrite ${currentPath}?`)) { currentPath = null; return; }
      }
      fs.write(currentPath, $area.value, { mime: mimeFor($lang.value) });
      setDirty(false);
      setStatus();
      bus.emit("notify", { title: "Saved", body: currentPath });
    };

    el.querySelector("#ce-open").addEventListener("click", () => openDialog().then((p) => p && open(p)));
    el.querySelector("#ce-save").addEventListener("click", save);
    el.querySelector("#ce-new").addEventListener("click", () => {
      if (dirty && !confirm("Discard unsaved changes?")) return;
      currentPath = null; $area.value = ""; dirty = false; setStatus(); update();
    });

    // Initial load
    if (ctx.opts?.openFsFile && fs.exists(ctx.opts.openFsFile)) open(ctx.opts.openFsFile);
    else { $area.value = "// Welcome to Code\n// Use the toolbar to open or create files in the file system.\n\nconst greet = (name) => `Hello, ${name}!`;\nconsole.log(greet('NovaOS'));\n"; setStatus(); update(); }

    const onFsOpen = bus.on("code-open-file", ({ path }) => open(path));

    return { unmount() { onFsOpen?.(); el.remove(); } };
  },
};

function mimeFor(lang) {
  return { js: "application/javascript", md: "text/markdown", json: "application/json", html: "text/html", css: "text/css", txt: "text/plain" }[lang] || "text/plain";
}

function openDialog() {
  return new Promise((resolve) => {
    const root = document.createElement("div");
    root.className = "dialog-backdrop";
    root.innerHTML = `
      <div class="dialog">
        <h3>Open file</h3>
        <p>Enter the path of a file to open.</p>
        <input class="input" id="op-path" value="/Projects/hello.js" />
        <div class="row">
          <button class="btn" data-act="cancel">Cancel</button>
          <button class="btn primary" data-act="ok">Open</button>
        </div>
      </div>
    `;
    document.body.appendChild(root);
    const input = root.querySelector("#op-path");
    setTimeout(() => input.focus(), 20);
    const cleanup = (v) => { root.remove(); resolve(v); };
    root.querySelector('[data-act="cancel"]').addEventListener("click", () => cleanup(null));
    root.querySelector('[data-act="ok"]').addEventListener("click", () => cleanup(input.value));
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") cleanup(input.value); if (e.key === "Escape") cleanup(null); });
  });
}

/* Minimal syntax highlighter — token-based, escapes HTML safely. */
function highlight(src, lang) {
  if (lang === "txt") return escape(src) + "\n";
  const rules = LANG_RULES[lang] || [];
  const tokens = tokenize(src, rules);
  return tokens.map((t) => t.type
    ? `<span class="tok-${t.type}">${escape(t.text)}</span>`
    : escape(t.text)
  ).join("") + "\n";
}

const COMMON_KEYWORDS = "var|let|const|function|return|if|else|for|while|do|switch|case|break|continue|new|class|extends|super|this|null|undefined|true|false|typeof|instanceof|in|of|try|catch|finally|throw|async|await|yield|import|from|export|default|static";
const LANG_RULES = {
  js: [
    { type: "comment", re: /^\/\/[^\n]*/ },
    { type: "comment", re: /^\/\*[\s\S]*?\*\// },
    { type: "string", re: /^"(?:\\.|[^"\\])*"/ },
    { type: "string", re: /^'(?:\\.|[^'\\])*'/ },
    { type: "string", re: /^`(?:\\.|[^`\\])*`/ },
    { type: "number", re: /^-?\b\d+(?:\.\d+)?\b/ },
    { type: "kw", re: new RegExp("^\\b(" + COMMON_KEYWORDS + ")\\b") },
    { type: "ident", re: /^[A-Za-z_$][\w$]*/ },
    { type: "punct", re: /^[{}()[\];,.]/ },
    { type: "op", re: /^[+\-*/%=<>!?&|^~:]+/ },
  ],
  json: [
    { type: "string", re: /^"(?:\\.|[^"\\])*"/ },
    { type: "number", re: /^-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/ },
    { type: "kw", re: /^\b(true|false|null)\b/ },
    { type: "punct", re: /^[{}\[\],:]/ },
  ],
  html: [
    { type: "comment", re: /^<!--[\s\S]*?-->/ },
    { type: "tag", re: /^<\/?[A-Za-z][\w-]*/ },
    { type: "string", re: /^"(?:\\.|[^"\\])*"/ },
    { type: "string", re: /^'(?:\\.|[^'\\])*'/ },
    { type: "ident", re: /^[A-Za-z_-][\w-]*/ },
    { type: "punct", re: /^[<>/=]/ },
  ],
  css: [
    { type: "comment", re: /^\/\*[\s\S]*?\*\// },
    { type: "string", re: /^"(?:\\.|[^"\\])*"/ },
    { type: "string", re: /^'(?:\\.|[^'\\])*'/ },
    { type: "number", re: /^-?\d+(?:\.\d+)?(?:px|em|rem|%|vh|vw|s|ms|deg)?\b/ },
    { type: "kw", re: /^[a-zA-Z-]+(?=\s*:)/ },
    { type: "ident", re: /^[A-Za-z_-][\w-]*/ },
    { type: "punct", re: /^[{}();,:]/ },
  ],
  md: [
    { type: "kw", re: /^#{1,6}\s[^\n]+/ },
    { type: "string", re: /^`[^`\n]*`/ },
    { type: "comment", re: /^>\s[^\n]+/ },
    { type: "tag", re: /^\*\*[^*]+\*\*/ },
    { type: "ident", re: /^[A-Za-z0-9_]+/ },
  ],
};

function tokenize(src, rules) {
  const out = [];
  let i = 0;
  while (i < src.length) {
    if (src[i] === "\n" || src[i] === " " || src[i] === "\t") {
      const m = src.slice(i).match(/^[\s]+/);
      out.push({ type: null, text: m[0] });
      i += m[0].length; continue;
    }
    let matched = false;
    for (const r of rules) {
      const m = src.slice(i).match(r.re);
      if (m) {
        out.push({ type: r.type, text: m[0] });
        i += m[0].length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      out.push({ type: null, text: src[i] });
      i++;
    }
  }
  return out;
}

function escape(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
