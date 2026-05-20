let menuEl;
let onCloseFn;

function ensure() {
  if (!menuEl) menuEl = document.getElementById("context-menu");
  return menuEl;
}

export const contextMenu = {
  open(x, y, items, opts = {}) {
    const el = ensure();
    el.innerHTML = "";
    for (const item of items) {
      if (item.sep) {
        const sep = document.createElement("div");
        sep.className = "ctx-sep";
        el.appendChild(sep);
        continue;
      }
      const b = document.createElement("button");
      b.type = "button";
      b.innerHTML = `<span>${item.label}</span>${item.shortcut ? `<span class="ctx-shortcut">${item.shortcut}</span>` : ""}`;
      if (item.disabled) b.disabled = true;
      b.addEventListener("click", () => {
        contextMenu.close();
        try { item.action?.(); } catch (e) { console.error(e); }
      });
      el.appendChild(b);
    }
    el.hidden = false;
    // place
    el.style.left = "0px"; el.style.top = "0px";
    el.style.visibility = "hidden";
    requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      const px = Math.min(x, window.innerWidth - r.width - 8);
      const py = Math.min(y, window.innerHeight - r.height - 8);
      el.style.left = px + "px";
      el.style.top = py + "px";
      el.style.visibility = "visible";
    });
    onCloseFn = opts.onClose;

    setTimeout(() => {
      document.addEventListener("mousedown", outside, { once: true });
      document.addEventListener("keydown", esc);
    }, 0);
  },
  close() {
    const el = ensure();
    if (el.hidden) return;
    el.hidden = true;
    document.removeEventListener("keydown", esc);
    onCloseFn?.();
    onCloseFn = null;
  },
};

function outside(e) {
  if (!menuEl || menuEl.hidden) return;
  if (!menuEl.contains(e.target)) contextMenu.close();
}
function esc(e) { if (e.key === "Escape") contextMenu.close(); }
