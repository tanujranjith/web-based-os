let menuEl;
let onCloseFn;
let previousFocus;
let listenerTimer;

function ensure() {
  if (!menuEl) menuEl = document.getElementById("context-menu");
  return menuEl;
}

export const contextMenu = {
  open(x, y, items, opts = {}) {
    this.close();
    const el = ensure();
    previousFocus=document.activeElement;
    el.setAttribute('role','menu');
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
      b.setAttribute('role','menuitem');
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
      if(el.hidden)return;
      const px = Math.max(8, Math.min(x, window.innerWidth - r.width - 8));
      const py = Math.max(8, Math.min(y, window.innerHeight - r.height - 8));
      el.style.left = px + "px";
      el.style.top = py + "px";
      el.style.visibility = "visible";
      el.querySelector('button:not(:disabled)')?.focus();
    });
    onCloseFn = opts.onClose;

    listenerTimer=setTimeout(() => {
      document.addEventListener("pointerdown", outside);
      document.addEventListener("keydown", esc);
    }, 0);
  },
  close() {
    const el = ensure();
    clearTimeout(listenerTimer);
    document.removeEventListener('pointerdown',outside);
    if (el.hidden) return;
    el.hidden = true;
    if(el.contains(document.activeElement)&&previousFocus?.isConnected)previousFocus.focus();
    document.removeEventListener("keydown", esc);
    onCloseFn?.();
    onCloseFn = null;
  },
};

function outside(e) {
  if (!menuEl || menuEl.hidden) return;
  if (!menuEl.contains(e.target)) contextMenu.close();
}
function esc(e) {
  if(e.key==='Escape'){contextMenu.close();return;}
  if(!['ArrowDown','ArrowUp','Home','End'].includes(e.key))return;
  e.preventDefault();
  const items=[...menuEl.querySelectorAll('button:not(:disabled)')];
  if(!items.length)return;
  const index=items.indexOf(document.activeElement);
  const next=e.key==='Home'?0:e.key==='End'?items.length-1:(index+(e.key==='ArrowDown'?1:-1)+items.length)%items.length;
  items[next].focus();
}
