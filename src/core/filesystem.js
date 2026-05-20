import { store } from "./state.js";
import { bus } from "./event-bus.js";

const now = () => Date.now();

const seed = () => ({
  type: "dir",
  name: "/",
  createdAt: now(),
  modifiedAt: now(),
  children: {
    Desktop: dir("Desktop", {
      "welcome.txt": file("welcome.txt", "Welcome to NovaOS!\n\nThis is your virtual desktop. Try the launcher in the dock, open the Terminal, or browse files. Everything is stored locally in your browser.\n"),
    }),
    Documents: dir("Documents", {
      "README.md": file("README.md", "# NovaOS\n\nA polished browser-based OS shell. Files, notes, and tasks live in your browser's localStorage.\n"),
      "ideas.txt": file("ideas.txt", "- Add a music player app\n- Add a markdown editor\n- Add a calculator\n"),
    }),
    Downloads: dir("Downloads", {}),
    Pictures: dir("Pictures", {
      "wallpapers.txt": file("wallpapers.txt", "Change wallpapers from Settings → Appearance.\n"),
    }),
    Projects: dir("Projects", {
      "hello.js": file("hello.js", "console.log('hello world');\n"),
      "notes.md": file("notes.md", "# Project notes\n\nStart writing here…\n"),
    }),
  },
});

function dir(name, children = {}) {
  return { type: "dir", name, createdAt: now(), modifiedAt: now(), children };
}
function file(name, content = "") {
  return { type: "file", name, content, createdAt: now(), modifiedAt: now(), size: content.length };
}

function ensureRoot() {
  store.update((s) => { if (!s.fs) s.fs = seed(); });
  return store.get().fs;
}

/** Split & normalize a path into segments. '/' returns []. */
export function splitPath(path) {
  if (!path || path === "/") return [];
  return path.replace(/^\/+/, "").replace(/\/+$/, "").split("/").filter(Boolean);
}
export function joinPath(...parts) {
  const segs = [];
  for (const p of parts) splitPath(p).forEach((s) => segs.push(s));
  return "/" + segs.join("/");
}
export function basename(path) { const s = splitPath(path); return s[s.length - 1] || "/"; }
export function dirname(path) { const s = splitPath(path); s.pop(); return "/" + s.join("/"); }

function getNode(root, path) {
  const segs = splitPath(path);
  let node = root;
  for (const seg of segs) {
    if (node.type !== "dir" || !node.children[seg]) return null;
    node = node.children[seg];
  }
  return node;
}

function getParent(root, path) {
  const segs = splitPath(path);
  if (segs.length === 0) return null;
  const last = segs.pop();
  let node = root;
  for (const seg of segs) {
    if (node.type !== "dir" || !node.children[seg]) return null;
    node = node.children[seg];
  }
  return { parent: node, name: last };
}

export const fs = {
  init() { ensureRoot(); },

  get root() { return store.get().fs; },

  ls(path = "/") {
    const node = getNode(this.root, path);
    if (!node || node.type !== "dir") return null;
    return Object.values(node.children).map((c) => ({
      name: c.name,
      type: c.type,
      size: c.size || 0,
      modifiedAt: c.modifiedAt,
      path: joinPath(path, c.name),
    })).sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1));
  },

  exists(path) { return !!getNode(this.root, path); },

  read(path) {
    const node = getNode(this.root, path);
    if (!node || node.type !== "file") return null;
    return node;
  },

  stat(path) {
    const node = getNode(this.root, path);
    if (!node) return null;
    return {
      name: node.name, type: node.type,
      size: node.size || 0,
      createdAt: node.createdAt, modifiedAt: node.modifiedAt,
      path,
    };
  },

  isDir(path) { const n = getNode(this.root, path); return !!n && n.type === "dir"; },

  mkdir(path) {
    const p = getParent(this.root, path);
    if (!p) throw new Error(`mkdir: cannot create ${path}`);
    const { parent, name } = p;
    if (parent.type !== "dir") throw new Error(`mkdir: parent is not a directory`);
    if (parent.children[name]) throw new Error(`mkdir: '${name}' already exists`);
    store.update(() => {
      const live = getParent(this.root, path).parent;
      live.children[name] = dir(name);
      live.modifiedAt = now();
    });
    bus.emit("fs-change", { path, op: "mkdir" });
  },

  touch(path, content = "") {
    const p = getParent(this.root, path);
    if (!p) throw new Error(`touch: cannot create ${path}`);
    const { parent, name } = p;
    if (parent.type !== "dir") throw new Error(`touch: parent is not a directory`);
    if (parent.children[name]) {
      store.update(() => {
        const live = getParent(this.root, path).parent;
        live.children[name].modifiedAt = now();
      });
    } else {
      store.update(() => {
        const live = getParent(this.root, path).parent;
        live.children[name] = file(name, content);
        live.modifiedAt = now();
      });
    }
    bus.emit("fs-change", { path, op: "touch" });
  },

  write(path, content) {
    if (!this.exists(path)) return this.touch(path, content);
    store.update(() => {
      const node = getNode(this.root, path);
      if (!node || node.type !== "file") return;
      node.content = content;
      node.size = (content || "").length;
      node.modifiedAt = now();
    });
    bus.emit("fs-change", { path, op: "write" });
  },

  rename(path, newName) {
    if (newName.includes("/")) throw new Error("rename: name cannot contain '/'");
    const p = getParent(this.root, path);
    if (!p) throw new Error(`rename: not found`);
    if (p.parent.children[newName] && newName !== p.name) throw new Error(`rename: '${newName}' already exists`);
    store.update(() => {
      const live = getParent(this.root, path).parent;
      const node = live.children[basename(path)];
      delete live.children[basename(path)];
      node.name = newName;
      node.modifiedAt = now();
      live.children[newName] = node;
      live.modifiedAt = now();
    });
    bus.emit("fs-change", { path, op: "rename" });
  },

  remove(path) {
    const p = getParent(this.root, path);
    if (!p) throw new Error(`remove: not found`);
    store.update(() => {
      const live = getParent(this.root, path).parent;
      delete live.children[basename(path)];
      live.modifiedAt = now();
    });
    bus.emit("fs-change", { path, op: "remove" });
  },

  /** Recursively count entries (for size estimates) */
  countAll(path = "/") {
    const node = getNode(this.root, path);
    if (!node) return { files: 0, dirs: 0, bytes: 0 };
    let files = 0, dirs = 0, bytes = 0;
    const walk = (n) => {
      if (n.type === "file") { files++; bytes += n.size || 0; return; }
      dirs++;
      for (const c of Object.values(n.children || {})) walk(c);
    };
    walk(node);
    if (path !== "/") dirs -= 0;
    return { files, dirs, bytes };
  },
};

fs.init();
