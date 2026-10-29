import { fs, basename } from "../core/filesystem.js";
import { store } from "../core/state.js";
import { bus } from "../core/event-bus.js";
import { fileDialog } from "../ui/dialogs.js";
import { escape } from "../ui/icons.js";
export default {
  id: "code-editor",
  name: "Code",
  category: "Developer",
  keywords: ["editor", "code", "markdown", "html", "preview"],
  defaultSize: { w: 1120, h: 720 },
  mount(container, ctx) {
    const el = document.createElement("div");
    el.className = "app code-workbench";
    el.innerHTML = `<div class="app-toolbar"><button class="btn" data-open>Open</button><button class="btn" data-new>New</button><button class="btn primary" data-save>Save</button><button class="btn" data-preview>Preview</button><span class="ce-spacer"></span><span data-status role="status">Loading editor…</span></div><div class="editor-tabs" role="tablist"></div><div class="workbench-body"><aside class="code-tree scroll-thin"></aside><main class="code-mount"></main><iframe class="code-preview" title="Code preview" sandbox="allow-scripts" hidden></iframe></div>`;
    container.append(el);
    let cm,
      view,
      active = null,
      tabs = [],
      disposed = false,
      showPreview = false;
    const host = el.querySelector(".code-mount"),
      frame = el.querySelector("iframe"),
      status = el.querySelector("[data-status]");
    const draftKey = (t) => t.path || `untitled:${t.id}`;
    function stash() {
      if (!active || !view) return;
      active.text = view.state.doc.toString();
      active.state = view.state;
    }
    function persistDraft() {
      if (!active || !view || !active.dirty) return;
      stash();
      store.update((s) => {
        s.drafts[draftKey(active)] = {
          text: active.text,
          path: active.path,
          modifiedAt: Date.now(),
        };
      });
    }
    function tree() {
      const out = [];
      const walk = (node, path) => {
        for (const child of Object.values(node.children || {})) {
          const p = path + "/" + child.name;
          if (child.type === "dir") walk(child, p);
          else if (!child.binary) out.push(p);
        }
      };
      walk(fs.root, "");
      el.querySelector(".code-tree").innerHTML =
        "<h4>WORKSPACE</h4>" +
        out
          .map(
            (p) =>
              `<button data-file="${escape(p)}" title="${escape(p)}">${escape(basename(p))}<small>${escape(p.split("/").slice(0, -1).join("/"))}</small></button>`,
          )
          .join("");
      el.querySelectorAll("[data-file]").forEach(
        (b) => (b.onclick = () => open(b.dataset.file)),
      );
    }
    function tabbar() {
      el.querySelector(".editor-tabs").innerHTML = tabs
        .map(
          (t) =>
            `<button role="tab" aria-selected="${t === active}" data-tab="${t.id}">${escape(t.path ? basename(t.path) : "Untitled")}${t.dirty ? " •" : ""}<span data-close="${t.id}" aria-label="Close tab">×</span></button>`,
        )
        .join("");
      el.querySelectorAll("[data-tab]").forEach(
        (b) =>
          (b.onclick = (e) => {
            const t = tabs.find((t) => t.id === b.dataset.tab);
            if (e.target.dataset.close) {
              stash();
              if (
                t.dirty &&
                !confirm(
                  "Close this tab? Its recovery draft will remain available.",
                )
              )
                return;
              tabs = tabs.filter((x) => x !== t);
              if (active === t) {
                active = null;
                if (tabs.length) select(tabs.at(-1));
                else open();
              }
              tabbar();
              ctx.setTitle("Code");
              return;
            }
            select(t);
          }),
      );
    }
    function stateFor(t) {
      const ext = t.path?.split(".").pop();
      const lang =
        ext === "html"
          ? cm.html()
          : ext === "css"
            ? cm.css()
            : ext === "json"
              ? cm.json()
              : cm.javascript({
                  typescript: ["ts", "tsx"].includes(ext),
                  jsx: ["tsx", "jsx"].includes(ext),
                });
      return cm.EditorState.create({
        doc: t.text,
        extensions: [
          cm.lineNumbers(),
          cm.history(),
          cm.drawSelection(),
          cm.highlightActiveLine(),
          cm.bracketMatching(),
          cm.syntaxHighlighting(cm.defaultHighlightStyle),
          cm.search(),
          cm.highlightSelectionMatches(),
          lang,
          cm.keymap.of([
            {
              key: "Mod-s",
              run: () => {
                save();
                return true;
              },
            },
            cm.indentWithTab,
            ...cm.defaultKeymap,
            ...cm.historyKeymap,
            ...cm.searchKeymap,
          ]),
          cm.EditorView.theme(
            {
              "&": {
                height: "100%",
                fontSize: "13px",
                background: "var(--bg-0)",
                color: "var(--text)",
              },
              ".cm-scroller": {
                overflow: "auto",
                fontFamily: "ui-monospace,monospace",
              },
              ".cm-gutters": {
                background: "var(--bg-1)",
                color: "var(--text-dim)",
                border: "none",
              },
              ".cm-cursor": { borderLeftColor: "var(--accent)" },
              ".cm-activeLine": { background: "#80808012" },
            },
            { dark: store.get().prefs.theme === "dark" },
          ),
          cm.EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              t.dirty = true;
              persistDraft();
              tabbar();
              status.textContent = "Recovery draft saved";
              if (showPreview) preview();
            }
          }),
        ],
      });
    }
    function select(t) {
      stash();
      active = t;
      if (!view)
        view = new cm.EditorView({
          state: t.state || stateFor(t),
          parent: host,
        });
      else view.setState(t.state || stateFor(t));
      tabbar();
      ctx.setTitle("Code · " + (t.path ? basename(t.path) : "Untitled"));
      status.textContent = t.dirty ? "Recovery draft" : "Saved";
      if (showPreview) preview();
      ctx.checkpoint?.();
    }
    function open(path) {
      if (!cm) {
        queued.push(path);
        return;
      }
      stash();
      let t = tabs.find((t) => path && t.path === path);
      if (!t) {
        const key = path || null,
          draft = key && store.get().drafts[key],
          node = path && fs.read(path);
        t = {
          id: crypto.randomUUID(),
          path: path || null,
          text: draft?.text ?? node?.content ?? "",
          dirty: !!draft,
        };
        tabs.push(t);
      }
      select(t);
    }
    async function save() {
      if (!active) return;
      stash();
      let path = active.path;
      if (!path) path = await fileDialog({ save: true, name: "Untitled.js" });
      if (!path) return;
      try {
        fs.write(path, active.text, {
          mime: path.endsWith(".html") ? "text/html" : "text/plain",
        });
        const old = draftKey(active);
        active.path = path;
        active.dirty = false;
        store.update((s) => {
          delete s.drafts[old];
          delete s.drafts[path];
        });
        ctx.checkpoint?.();
        await store.flush();
        tabbar();
        tree();
        status.textContent = "Saved";
        ctx.setTitle("Code · " + basename(path));
      } catch (error) {
        status.textContent = error.message;
      }
    }
    async function preview() {
      if (!active || !view) return;
      const text = view.state.doc.toString(),
        ext = active.path?.split(".").pop();
      if (ext === "md" || ext === "markdown") {
        const { markdown } = await import("../../vendor/markdown.js");
        frame.srcdoc =
          `<meta name="color-scheme" content="light dark"><style>body{font:16px/1.7 system-ui;padding:24px;max-width:75ch}pre{overflow:auto}</style>` +
          markdown(text);
        return;
      }
      const policy =
        '<meta http-equiv="Content-Security-Policy" content="default-src &apos;none&apos;; script-src &apos;unsafe-inline&apos;; style-src &apos;unsafe-inline&apos;; img-src data: blob:;">';
      frame.srcdoc =
        policy +
        (ext === "html"
          ? text
          : ext === "css"
            ? `<style>${text}</style><main><h1>CSS preview</h1><p>Edit styles to see changes here.</p><button>Example button</button></main>`
            : `<pre id="output"></pre><script>console.log=(...v)=>document.getElementById('output').textContent+=v.join(' ')+'\\n';try{${text.replace(/<\/script/gi, "<\\/script")}}catch(e){console.log(e.message)}<\/script>`);
    }
    el.querySelector("[data-open]").onclick = async () => {
      const p = await fileDialog({ accept: (p) => !fs.read(p)?.binary });
      if (p) open(p);
    };
    el.querySelector("[data-new]").onclick = () => open();
    el.querySelector("[data-save]").onclick = save;
    el.querySelector("[data-preview]").onclick = () => {
      showPreview = !showPreview;
      frame.hidden = !showPreview;
      if (showPreview) preview();
    };
    const queued = [];
    import("../../vendor/editor.js")
      .then((module) => {
        if (disposed) return;
        cm = module;
        tree();
        const saved = ctx.opts.tabs || [];
        if (saved.length) saved.forEach(open);
        else if (ctx.opts.openFsFile) open(ctx.opts.openFsFile);
        for (const [key, recovery] of Object.entries(store.get().drafts).filter(
          ([key]) => key.startsWith("untitled:"),
        )) {
          const tab = {
            id: key.slice(9),
            path: null,
            text: recovery.text,
            dirty: true,
          };
          tabs.push(tab);
          select(tab);
        }
        if (!tabs.length) open();
        queued.splice(0).forEach(open);
        status.textContent = "Ready · Ctrl F to find";
      })
      .catch((error) => {
        status.textContent = "Editor could not load: " + error.message;
      });
    const off = bus.on("fs-change", () => {
      if (cm) tree();
    });
    return {
      onOpen(opts) {
        if (opts.openFsFile) open(opts.openFsFile);
      },
      session() {
        stash();
        return { tabs: tabs.map((t) => t.path).filter(Boolean) };
      },
      beforeClose() {
        persistDraft();
        return true;
      },
      unmount() {
        disposed = true;
        persistDraft();
        view?.destroy();
        off();
        el.remove();
      },
    };
  },
};
