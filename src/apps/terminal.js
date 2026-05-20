import { fs, joinPath, dirname, basename, splitPath } from "../core/filesystem.js";
import { store } from "../core/state.js";
import { manager } from "../core/window-manager.js";
import { registry } from "../core/app-registry.js";

const VERSION = "1.0.0";

export default {
  id: "terminal",
  name: "Terminal",
  icon: "⌨",
  category: "Developer",
  defaultSize: { w: 760, h: 460 },
  bodyClass: "terminal-app",
  keywords: ["shell", "cli", "console", "bash"],
  mount(container, ctx) {
    const el = document.createElement("div");
    el.className = "app terminal-app";
    el.innerHTML = `<div class="terminal-screen scroll-thin" id="screen"></div>`;
    container.appendChild(el);

    const $screen = el.querySelector("#screen");
    let cwd = "/";
    const history = [];
    let hIdx = -1;

    const writeLine = (html, cls = "") => {
      const div = document.createElement("div");
      div.className = "line" + (cls ? " " + cls : "");
      div.innerHTML = html;
      $screen.appendChild(div);
      $screen.scrollTop = $screen.scrollHeight;
    };

    const promptText = () => `<span class="prompt-prefix">${store.get().user.name}@nova</span><span class="ansi-dim">:${escape(cwd)}$</span>`;

    const newPrompt = () => {
      const row = document.createElement("div");
      row.className = "prompt-line";
      row.innerHTML = `${promptText()} <input type="text" autocomplete="off" spellcheck="false" />`;
      $screen.appendChild(row);
      const input = row.querySelector("input");
      input.focus();
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          const value = input.value;
          input.disabled = true;
          // freeze prompt to plain output
          row.innerHTML = `${promptText()} <span>${escape(value)}</span>`;
          if (value.trim()) {
            history.push(value); hIdx = history.length;
            run(value);
          }
          newPrompt();
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          if (hIdx > 0) { hIdx--; input.value = history[hIdx]; }
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          if (hIdx < history.length - 1) { hIdx++; input.value = history[hIdx]; }
          else { hIdx = history.length; input.value = ""; }
        } else if (e.key === "Tab") {
          e.preventDefault();
          autocomplete(input);
        } else if (e.ctrlKey && e.key.toLowerCase() === "l") {
          e.preventDefault();
          $screen.innerHTML = "";
          newPrompt();
        }
      });
      $screen.scrollTop = $screen.scrollHeight;
    };

    const autocomplete = (input) => {
      const parts = input.value.split(" ");
      const last = parts[parts.length - 1];
      const dir = last.startsWith("/") ? dirname(last) : (last.includes("/") ? resolvePath(dirname(last)) : cwd);
      const prefix = basename(last);
      const entries = fs.ls(dir) || [];
      const matches = entries.filter((e) => e.name.startsWith(prefix));
      if (matches.length === 1) {
        const completed = (matches[0].type === "dir" ? matches[0].name + "/" : matches[0].name);
        parts[parts.length - 1] = (last.includes("/") ? dirname(last) + "/" : "") + completed;
        input.value = parts.join(" ");
      } else if (matches.length > 1) {
        const promptLine = input.closest(".prompt-line");
        const div = document.createElement("div");
        div.className = "line ansi-dim";
        div.innerHTML = matches.map((m) => escape(m.name) + (m.type === "dir" ? "/" : "")).join("  ");
        promptLine.insertAdjacentElement("beforebegin", div);
        $screen.scrollTop = $screen.scrollHeight;
      }
    };

    const resolvePath = (p) => {
      if (!p) return cwd;
      if (p === "~") return "/";
      if (p.startsWith("/")) return normalize(p);
      return normalize(joinPath(cwd, p));
    };
    const normalize = (p) => {
      const segs = [];
      for (const s of splitPath(p)) {
        if (s === ".") continue;
        if (s === "..") segs.pop();
        else segs.push(s);
      }
      return "/" + segs.join("/");
    };

    const commands = {
      help: () => {
        writeLine([
          "Available commands:",
          "  help              Show this help",
          "  clear             Clear screen",
          "  ls [path]         List directory contents",
          "  cd <path>         Change directory",
          "  pwd               Print working directory",
          "  mkdir <name>      Create directory",
          "  touch <name>      Create empty file (or update mtime)",
          "  cat <file>        Print file content",
          "  echo <text>       Print text   (use > file to write)",
          "  rm <path>         Remove file or folder",
          "  mv <src> <dst>    Rename / move",
          "  open <app>        Open an app  (try: notes, files, browser…)",
          "  apps              List available apps",
          "  date              Print current date/time",
          "  whoami            Print current user",
          "  sysinfo / neofetch  System info",
          "  history           Command history",
          "  reset             Reset NovaOS (clears storage)",
        ].join("\n"));
      },
      clear: () => { $screen.innerHTML = ""; },
      pwd: () => writeLine(cwd),
      whoami: () => writeLine(store.get().user.name),
      date: () => writeLine(new Date().toString()),
      history: () => writeLine(history.map((h, i) => `  ${i + 1}  ${escape(h)}`).join("\n")),
      apps: () => writeLine(registry.all().map((a) => `  ${a.id.padEnd(12)} ${a.name}`).join("\n")),
      ls: (args) => {
        const target = resolvePath(args[0] || cwd);
        const list = fs.ls(target);
        if (!list) return writeLine(`ls: no such directory: ${escape(args[0] || target)}`, "ansi-err");
        if (!list.length) return;
        writeLine(list.map((e) => e.type === "dir"
          ? `<span class="ansi-acc">${escape(e.name)}/</span>`
          : escape(e.name)).join("   "));
      },
      cd: (args) => {
        if (!args[0]) { cwd = "/"; return; }
        const p = resolvePath(args[0]);
        if (!fs.isDir(p)) return writeLine(`cd: not a directory: ${escape(args[0])}`, "ansi-err");
        cwd = p;
      },
      mkdir: (args) => {
        if (!args[0]) return writeLine("mkdir: missing operand", "ansi-err");
        try { fs.mkdir(resolvePath(args[0])); } catch (e) { writeLine(`mkdir: ${e.message}`, "ansi-err"); }
      },
      touch: (args) => {
        if (!args[0]) return writeLine("touch: missing operand", "ansi-err");
        try { fs.touch(resolvePath(args[0])); } catch (e) { writeLine(`touch: ${e.message}`, "ansi-err"); }
      },
      cat: (args) => {
        if (!args[0]) return writeLine("cat: missing operand", "ansi-err");
        const node = fs.read(resolvePath(args[0]));
        if (!node) return writeLine(`cat: no such file: ${escape(args[0])}`, "ansi-err");
        writeLine(escape(node.content || ""));
      },
      echo: (args, raw) => {
        // Handle redirection: echo text > file
        const m = raw.match(/^echo\s+(.*?)\s*>\s*(\S+)\s*$/);
        if (m) {
          const text = m[1].replace(/^"|"$/g, "");
          fs.write(resolvePath(m[2]), text);
          return;
        }
        writeLine(escape(args.join(" ")));
      },
      rm: (args) => {
        if (!args[0]) return writeLine("rm: missing operand", "ansi-err");
        try { fs.remove(resolvePath(args[0])); } catch (e) { writeLine(`rm: ${e.message}`, "ansi-err"); }
      },
      mv: (args) => {
        if (args.length < 2) return writeLine("mv: usage: mv <src> <dst>", "ansi-err");
        const src = resolvePath(args[0]);
        if (!fs.exists(src)) return writeLine(`mv: source not found: ${escape(args[0])}`, "ansi-err");
        const dst = args[1];
        const dstParent = dst.includes("/") ? resolvePath(dirname(dst)) : cwd;
        if (!fs.isDir(dstParent)) return writeLine(`mv: target dir not found`, "ansi-err");
        try { fs.rename(src, basename(dst)); }
        catch (e) { writeLine(`mv: ${e.message}`, "ansi-err"); }
      },
      open: (args) => {
        if (!args[0]) return writeLine("open: missing app id", "ansi-err");
        const id = args[0];
        if (!registry.get(id)) return writeLine(`open: unknown app: ${escape(id)}`, "ansi-err");
        manager.open(id);
        writeLine(`Opened ${escape(id)}.`, "ansi-dim");
      },
      sysinfo: () => writeLine(neofetch(), "ansi-acc"),
      neofetch: () => writeLine(neofetch(), "ansi-acc"),
      reset: () => {
        if (confirm("Reset all NovaOS data?")) { store.reset(); location.reload(); }
      },
    };

    const run = (line) => {
      const raw = line;
      const parts = line.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
      const cmd = parts.shift();
      const args = parts.map((p) => p.replace(/^"|"$/g, ""));
      if (!cmd) return;
      const fn = commands[cmd];
      if (!fn) return writeLine(`command not found: ${escape(cmd)}`, "ansi-err");
      try { fn(args, raw); } catch (e) { writeLine(String(e.message), "ansi-err"); }
    };

    // Banner
    writeLine(banner(), "ansi-acc");
    writeLine("Type <span class='ansi-ok'>help</span> for available commands.", "ansi-dim");
    newPrompt();

    return {
      unmount() { el.remove(); },
    };
  },
};

function banner() {
  return [
    "  _   _                  _____ _____ ",
    " | \\ | | _____   ____ _|  _  /  ___|",
    " |  \\| |/ _ \\ \\ / / _` | | | \\ `--. ",
    " | |\\  | (_) \\ V / (_| | |/ /`--. \\",
    " |_| \\_|\\___/ \\_/ \\__,_|___(_)____/ ",
    "",
    `  NovaOS Terminal v${VERSION}`,
  ].join("\n");
}

function neofetch() {
  const ua = navigator.userAgent;
  const screen = `${window.innerWidth}×${window.innerHeight}`;
  let storageUsed = "?";
  try { storageUsed = (new Blob([localStorage.getItem("novaos:v1") || ""]).size / 1024).toFixed(1) + " KB"; } catch {}
  return [
    `       /\\         OS:        NovaOS ${VERSION}`,
    `      /  \\        Kernel:    Browser ECMAScript`,
    `     /    \\       Host:      ${escape(navigator.platform || "Unknown")}`,
    `    /      \\      Resolution:${screen}`,
    `   /________\\     Shell:     novash`,
    `   \\        /     User:      ${escape(store.get().user.name)}`,
    `    \\      /      UA:        ${escape((ua || "").slice(0, 60))}...`,
    `     \\    /       Storage:   ${storageUsed}`,
    `      \\  /        Apps:      ${registry.all().length}`,
    `       \\/         Theme:     ${escape(store.get().prefs.theme)}`,
  ].join("\n");
}

function escape(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
