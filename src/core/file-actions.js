import { fs, basename } from "./filesystem.js";
import { manager } from "./window-manager.js";
export function appFor(path) {
  const node = fs.read(path),
    mime = node?.mime || "",
    ext = path.split(".").pop().toLowerCase();
  if (fs.isDir(path)) return "files";
  if (
    mime.startsWith("image/") ||
    ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)
  )
    return "image-viewer";
  if (mime === "application/pdf" || ext === "pdf") return "pdf-viewer";
  if (
    mime.startsWith("audio/") ||
    ["mp3", "wav", "ogg", "m4a", "flac"].includes(ext)
  )
    return "music";
  if (
    [
      "js",
      "ts",
      "jsx",
      "tsx",
      "json",
      "html",
      "css",
      "py",
      "rs",
      "go",
      "md",
      "markdown",
    ].includes(ext)
  )
    return "code-editor";
  return "notes";
}
export function openFile(path, extra = {}) {
  return manager.open(appFor(path), { path, openFsFile: path, ...extra });
}
export function downloadFile(path) {
  const node = fs.read(path);
  if (!node) throw new Error("File not found");
  const url = node.binary
    ? node.content
    : URL.createObjectURL(new Blob([node.content], { type: node.mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = basename(path);
  a.click();
  if (!node.binary) setTimeout(() => URL.revokeObjectURL(url), 1000);
}
