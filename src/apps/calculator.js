import { store } from "../core/state.js";
import { calculate } from "../core/arithmetic.js";
import { escape } from "../ui/icons.js";
export default {
  id: "calculator",
  name: "Calculator",
  category: "Utilities",
  keywords: ["math", "scientific", "calc"],
  defaultSize: { w: 420, h: 650 },
  mount(container) {
    const el = document.createElement("div");
    el.className = "app calc-app";
    el.innerHTML = `<div class="app-toolbar"><button class="btn" data-angle>Radians</button><button class="btn" data-history>History</button></div><div class="calc-display"><input class="input" aria-label="Expression" placeholder="0"><div class="calc-val">0</div></div><div class="calc-science">${["sin(", "cos(", "tan(", "sqrt(", "log(", "ln(", "pi", "e", "(", ")", "^", "!"].map((k) => `<button class="btn" data-key="${k}">${k.replace("(", "")}</button>`).join("")}</div><div class="calc-history" hidden></div><div class="calc-keys">${["C", "⌫", "%", "/", "7", "8", "9", "*", "4", "5", "6", "-", "1", "2", "3", "+", "±", "0", ".", "="].map((k) => `<button class="calc-k ${["/", "*", "-", "+"].includes(k) ? "op" : k === "=" ? "eq" : ""}" data-key="${k}">${{ "/": "÷", "*": "×" }[k] || k}</button>`).join("")}</div>`;
    container.append(el);
    const input = el.querySelector("input"),
      out = el.querySelector(".calc-val"),
      history = el.querySelector(".calc-history");
    let degrees = false;
    const preview = () => {
      try {
        out.textContent = calculate(input.value, degrees);
      } catch {
        out.textContent = input.value ? "…" : "0";
      }
    };
    const evaluate = () => {
      try {
        const value = calculate(input.value, degrees);
        store.update((s) => {
          s.calcHistory = [
            { expression: input.value, value },
            ...(s.calcHistory || []),
          ].slice(0, 40);
        });
        input.value = String(value);
        preview();
        render();
      } catch (error) {
        out.textContent = error.message;
      }
    };
    const render = () => {
      history.innerHTML =
        (store.get().calcHistory || [])
          .map(
            (h, i) =>
              `<button class="calc-h-row" data-index="${i}"><span>${escape(h.expression)}</span><strong>${h.value}</strong></button>`,
          )
          .join("") || '<p class="app-empty">No calculations yet.</p>';
      history.querySelectorAll("button").forEach(
        (b) =>
          (b.onclick = () => {
            input.value = String(
              store.get().calcHistory[+b.dataset.index].value,
            );
            preview();
          }),
      );
    };
    el.querySelectorAll("[data-key]").forEach(
      (b) =>
        (b.onclick = () => {
          const k = b.dataset.key;
          if (k === "=") return evaluate();
          if (k === "C") input.value = "";
          else if (k === "⌫") input.value = input.value.slice(0, -1);
          else if (k === "±") input.value = "-(" + input.value + ")";
          else
            input.setRangeText(
              k,
              input.selectionStart,
              input.selectionEnd,
              "end",
            );
          preview();
          input.focus();
        }),
    );
    input.oninput = preview;
    input.onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        evaluate();
      }
    };
    el.querySelector("[data-angle]").onclick = (e) => {
      degrees = !degrees;
      e.target.textContent = degrees ? "Degrees" : "Radians";
      preview();
    };
    el.querySelector("[data-history]").onclick = () =>
      (history.hidden = !history.hidden);
    render();
    return {
      unmount() {
        el.remove();
      },
    };
  },
};
