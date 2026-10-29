import { fs } from "../core/filesystem.js";
import { store } from "../core/state.js";
import { bus } from "../core/event-bus.js";
export default {
  id: "paint",
  name: "Paint",
  category: "Media",
  keywords: ["draw", "sketch", "canvas"],
  defaultSize: { w: 1040, h: 720 },
  mount(container) {
    const el = document.createElement("div");
    el.className = "app paint-v4";
    el.innerHTML = `<div class="app-toolbar"><select class="select" aria-label="Drawing tool"><option value="brush">Brush</option><option value="eraser">Eraser</option><option value="line">Line</option><option value="rect">Rectangle</option><option value="ellipse">Ellipse</option></select><input type="color" value="#4f7fe8" aria-label="Brush color"><input type="range" min="1" max="50" value="6" aria-label="Brush size"><button class="btn" data-undo>Undo</button><button class="btn" data-redo>Redo</button><button class="btn" data-clear>Clear</button><button class="btn primary" data-save>Save to Pictures</button><button class="btn" data-export>Export PNG</button></div><div class="paint-stage scroll-thin"><canvas width="1280" height="800" aria-label="Drawing canvas"></canvas></div>`;
    container.append(el);
    const canvas = el.querySelector("canvas"),
      c = canvas.getContext("2d");
    let undo = [],
      redo = [],
      drawing = false,
      start,
      snapshot,
      disposed = false;
    c.fillStyle = "white";
    c.fillRect(0, 0, 1280, 800);
    function restore(data) {
      const image = new Image();
      image.onload = () => {
        if (disposed) return;
        c.clearRect(0, 0, 1280, 800);
        c.drawImage(image, 0, 0);
      };
      image.src = data;
    }
    if (store.get().paintDraft) restore(store.get().paintDraft);
    function persist() {
      store.update((s) => (s.paintDraft = canvas.toDataURL("image/png")));
    }
    function push() {
      undo.push(canvas.toDataURL("image/png"));
      undo = undo.slice(-24);
      redo = [];
    }
    const point = (e) => {
      const r = canvas.getBoundingClientRect();
      return {
        x: ((e.clientX - r.left) * canvas.width) / r.width,
        y: ((e.clientY - r.top) * canvas.height) / r.height,
      };
    };
    canvas.onpointerdown = (e) => {
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      push();
      drawing = true;
      start = point(e);
      snapshot = c.getImageData(0, 0, 1280, 800);
      c.strokeStyle =
        el.querySelector("select").value === "eraser"
          ? "white"
          : el.querySelector("input[type=color]").value;
      c.lineWidth = +el.querySelector("input[type=range]").value;
      c.lineCap = "round";
      c.lineJoin = "round";
      c.beginPath();
      c.moveTo(start.x, start.y);
      c.lineTo(start.x + 0.01, start.y + 0.01);
      c.stroke();
    };
    canvas.onpointermove = (e) => {
      if (!drawing) return;
      const p = point(e),
        tool = el.querySelector("select").value;
      if (tool === "brush" || tool === "eraser") {
        c.beginPath();
        c.moveTo(start.x, start.y);
        c.lineTo(p.x, p.y);
        c.stroke();
        start = p;
      } else {
        c.putImageData(snapshot, 0, 0);
        if (tool === "rect")
          c.strokeRect(start.x, start.y, p.x - start.x, p.y - start.y);
        else if (tool === "ellipse") {
          c.beginPath();
          c.ellipse(
            (start.x + p.x) / 2,
            (start.y + p.y) / 2,
            Math.abs(p.x - start.x) / 2,
            Math.abs(p.y - start.y) / 2,
            0,
            0,
            Math.PI * 2,
          );
          c.stroke();
        } else {
          c.beginPath();
          c.moveTo(start.x, start.y);
          c.lineTo(p.x, p.y);
          c.stroke();
        }
      }
    };
    canvas.onpointerup = canvas.onpointercancel = () => {
      if (drawing) {
        drawing = false;
        persist();
      }
    };
    el.querySelector("[data-undo]").onclick = () => {
      const data = undo.pop();
      if (data) {
        redo.push(canvas.toDataURL());
        restore(data);
        store.update((s) => (s.paintDraft = data));
      }
    };
    el.querySelector("[data-redo]").onclick = () => {
      const data = redo.pop();
      if (data) {
        undo.push(canvas.toDataURL());
        restore(data);
        store.update((s) => (s.paintDraft = data));
      }
    };
    el.querySelector("[data-clear]").onclick = () => {
      push();
      c.fillStyle = "white";
      c.fillRect(0, 0, 1280, 800);
      persist();
    };
    el.querySelector("[data-save]").onclick = () => {
      const p = fs.unique("/Pictures/Painting.png");
      fs.touch(p, canvas.toDataURL(), { mime: "image/png", binary: true });
      bus.emit("notify", { title: "Painting saved", body: p });
    };
    el.querySelector("[data-export]").onclick = () => {
      const a = document.createElement("a");
      a.href = canvas.toDataURL();
      a.download = "Painting.png";
      a.click();
    };
    return {
      unmount() {
        disposed = true;
        persist();
        el.remove();
      },
    };
  },
};
