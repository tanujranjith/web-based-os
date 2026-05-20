export default {
  id: "calculator",
  name: "Calculator",
  icon: "🧮",
  category: "Utilities",
  defaultSize: { w: 320, h: 480 },
  keywords: ["calc", "math", "compute"],
  mount(container) {
    const el = document.createElement("div");
    el.className = "app calc-app";
    el.innerHTML = `
      <div class="calc-display">
        <div class="calc-expr" id="calc-expr"></div>
        <div class="calc-val" id="calc-val">0</div>
      </div>
      <div class="calc-history" id="calc-history" hidden></div>
      <div class="calc-keys">
        <button data-k="C" class="calc-k fn">C</button>
        <button data-k="⌫" class="calc-k fn">⌫</button>
        <button data-k="%" class="calc-k fn">%</button>
        <button data-k="/" class="calc-k op">÷</button>

        <button data-k="7" class="calc-k">7</button>
        <button data-k="8" class="calc-k">8</button>
        <button data-k="9" class="calc-k">9</button>
        <button data-k="*" class="calc-k op">×</button>

        <button data-k="4" class="calc-k">4</button>
        <button data-k="5" class="calc-k">5</button>
        <button data-k="6" class="calc-k">6</button>
        <button data-k="-" class="calc-k op">−</button>

        <button data-k="1" class="calc-k">1</button>
        <button data-k="2" class="calc-k">2</button>
        <button data-k="3" class="calc-k">3</button>
        <button data-k="+" class="calc-k op">+</button>

        <button data-k="H" class="calc-k fn">↻</button>
        <button data-k="0" class="calc-k">0</button>
        <button data-k="." class="calc-k">.</button>
        <button data-k="=" class="calc-k eq">=</button>
      </div>
    `;
    container.appendChild(el);

    const $expr = el.querySelector("#calc-expr");
    const $val = el.querySelector("#calc-val");
    const $hist = el.querySelector("#calc-history");
    let expr = "";
    let history = [];

    const update = () => { $expr.textContent = formatExpr(expr); $val.textContent = preview(expr) ?? "0"; };

    const press = (k) => {
      if (k === "C") { expr = ""; update(); return; }
      if (k === "⌫") { expr = expr.slice(0, -1); update(); return; }
      if (k === "=") {
        const v = preview(expr);
        if (v == null) return;
        history.unshift({ expr, val: v });
        history = history.slice(0, 10);
        renderHistory();
        expr = String(v);
        update();
        return;
      }
      if (k === "H") { $hist.hidden = !$hist.hidden; return; }
      // Replace trailing operator if user types another
      if ("+-*/%".includes(k) && "+-*/%".includes(expr.slice(-1))) {
        expr = expr.slice(0, -1) + k;
      } else {
        expr += k;
      }
      update();
    };

    const renderHistory = () => {
      if (!history.length) { $hist.innerHTML = `<div class="calc-empty">No history</div>`; return; }
      $hist.innerHTML = history.map((h) => `
        <div class="calc-h-row" data-val="${escape(String(h.val))}">
          <span class="calc-h-expr">${escape(formatExpr(h.expr))}</span>
          <span class="calc-h-val">${escape(String(h.val))}</span>
        </div>`).join("");
      $hist.querySelectorAll(".calc-h-row").forEach((r) => {
        r.addEventListener("click", () => { expr = r.dataset.val; update(); });
      });
    };

    el.querySelectorAll(".calc-k").forEach((b) => b.addEventListener("click", () => press(b.dataset.k)));

    const onKey = (e) => {
      const map = { Enter: "=", "=": "=", Backspace: "⌫", Escape: "C", Delete: "C" };
      const k = map[e.key] || (/^[0-9.+\-*/%]$/.test(e.key) ? e.key : null);
      if (!k) return;
      e.preventDefault();
      press(k);
    };
    el.tabIndex = 0;
    el.addEventListener("keydown", onKey);
    setTimeout(() => el.focus(), 50);

    update(); renderHistory();
    return { unmount() { el.remove(); } };
  },
};

function formatExpr(s) {
  return s.replace(/\*/g, " × ").replace(/\//g, " ÷ ").replace(/-/g, " − ").replace(/\+/g, " + ").replace(/%/g, "%");
}

function preview(expr) {
  if (!expr) return null;
  // Replace trailing operator
  let e = expr.replace(/[+\-*/%]$/, "");
  if (!e) return null;
  // Allow only safe characters
  if (!/^[0-9+\-*/%.\s()]+$/.test(e)) return null;
  try {
    // Treat % as /100 when used between numbers and operators
    e = e.replace(/(\d+(?:\.\d+)?)%/g, "($1/100)");
    // eslint-disable-next-line no-new-func
    const v = Function(`"use strict";return (${e});`)();
    if (typeof v !== "number" || !isFinite(v)) return null;
    return Math.round(v * 1e12) / 1e12;
  } catch { return null; }
}

function escape(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
