/** Trap Tab focus inside `el` until released. Returns a release function. */
export function trapFocus(el) {
  const focusable = () => Array.from(el.querySelectorAll(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )).filter((n) => !n.hidden && n.offsetParent !== null);

  const onKey = (e) => {
    if (e.key !== "Tab") return;
    const items = focusable();
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
  };
  el.addEventListener("keydown", onKey);
  return () => el.removeEventListener("keydown", onKey);
}

/** Long-press detection for touch → context menu. Calls cb(clientX, clientY). */
export function onLongPress(el, cb, opts = {}) {
  const delay = opts.delay || 500;
  let timer, sx, sy;
  el.addEventListener("touchstart", (e) => {
    const t = e.touches[0]; sx = t.clientX; sy = t.clientY;
    timer = setTimeout(() => cb(sx, sy), delay);
  }, { passive: true });
  const cancel = () => clearTimeout(timer);
  el.addEventListener("touchmove", (e) => {
    const t = e.touches[0];
    if (Math.abs(t.clientX - sx) > 10 || Math.abs(t.clientY - sy) > 10) cancel();
  }, { passive: true });
  el.addEventListener("touchend", cancel);
  el.addEventListener("touchcancel", cancel);
}
