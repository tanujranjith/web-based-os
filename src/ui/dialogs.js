import { fs, dirname, basename, joinPath } from "../core/filesystem.js";
import { trapFocus } from "./focus-trap.js";
import { escape } from "./icons.js";
export function fileDialog({
  save = false,
  path = "/Documents",
  name = "Untitled.txt",
  accept = () => true,
} = {}) {
  return new Promise((resolve) => {
    const root = document.createElement("section");
    root.className = "dialog-backdrop";
    root.innerHTML = `<form class="dialog file-dialog" role="dialog" aria-modal="true" aria-label="${save ? "Save file" : "Open file"}"><h2>${save ? "Save file" : "Open file"}</h2><div class="row"><button class="btn" type="button" data-up>↑ Up</button><input class="input" name="folder" aria-label="Folder" value="${escape(path)}"></div><div class="file-picker-list"></div>${save ? `<label>Filename<input class="input" name="filename" value="${escape(name)}" required></label>` : ""}<p role="alert"></p><div class="row"><button class="btn" type="button" data-cancel>Cancel</button><button class="btn primary" type="submit">${save ? "Save" : "Open selected"}</button></div></form>`;
    document.body.append(root);
    const form = root.querySelector("form"),
      list = root.querySelector(".file-picker-list");
    let selected = null;
    const release = trapFocus(form);
    const close = (value) => {
      release();
      root.remove();
      resolve(value);
    };
    const render = () => {
      selected = null;
      list.innerHTML =
        (fs.ls(path) || [])
          .filter((x) => x.type === "dir" || accept(x.path))
          .map(
            (x) =>
              `<button type="button" class="file-picker-item" data-path="${escape(x.path)}">${x.type === "dir" ? "▣" : "▤"} ${escape(x.name)}</button>`,
          )
          .join("") || "<p>No matching files</p>";
      form.elements.folder.value = path;
      list.querySelectorAll("button").forEach((b) => {
        b.onclick = () => {
          if (fs.isDir(b.dataset.path)) {
            path = b.dataset.path;
            render();
          } else {
            selected = b.dataset.path;
            list
              .querySelectorAll("button")
              .forEach((x) => x.classList.toggle("selected", x === b));
            if (save) form.elements.filename.value = basename(selected);
          }
        };
        b.ondblclick = () => {
          if (!save && !fs.isDir(b.dataset.path)) close(b.dataset.path);
        };
      });
    };
    form.querySelector("[data-up]").onclick = () => {
      path = dirname(path);
      render();
    };
    form.elements.folder.onchange = () => {
      if (fs.isDir(form.elements.folder.value)) {
        path = form.elements.folder.value;
        render();
      } else
        form.querySelector("[role=alert]").textContent = "Folder not found";
    };
    form.querySelector("[data-cancel]").onclick = () => close(null);
    root.onkeydown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close(null);
      }
    };
    form.onsubmit = (e) => {
      e.preventDefault();
      const result = save
        ? joinPath(path, form.elements.filename.value.trim())
        : selected;
      if (!result) return;
      if (save && fs.exists(result) && !confirm("Replace the existing file?"))
        return;
      close(result);
    };
    render();
    form.querySelector("input").focus();
  });
}
