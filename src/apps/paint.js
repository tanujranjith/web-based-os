import { fs } from "../core/filesystem.js";
import { bus } from "../core/event-bus.js";

export default {
  id: "paint",
  name: "Paint",
  icon: "🎨",
  category: "Media",
  defaultSize: { w: 760, h: 560 },
  keywords: ["draw", "sketch", "art", "canvas"],
  mount(container) {
    const el = document.createElement("div");
    el.className = "app paint-app";
    el.innerHTML = `
      <div class="app-toolbar">
        <button class="btn ${0}" data-tool="brush" id="t-brush">🖌</button>
        <button class="btn ghost" data-tool="eraser" id="t-eraser">🩹</button>
        <button class="btn ghost" data-tool="line" id="t-line">／</button>
        <button class="btn ghost" data-tool="rect" id="t-rect">▭</button>
        <button class="btn ghost" data-tool="ellipse" id="t-ellipse">◯</button>
        <span class="ce-spacer"></span>
        <input type="color" id="paint-color" value="#5b8def" title="Color"/>
        <input type="range" id="paint-size" min="1" max="40" value="6" title="Brush size"/>
        <button class="btn ghost" id="paint-clear">Clear</button>
        <button class="btn ghost" id="paint-undo">Undo</button>
        <button class="btn primary" id="paint-save">Save to Pictures</button>
      </div>
      <div class="paint-stage" id="paint-stage">
        <canvas id="paint-canvas"></canvas>
      </div>
    `;
    container.appendChild(el);
    const stage = el.querySelector("#paint-stage");
    const canvas = el.querySelector("#paint-canvas");
    const ctx = canvas.getContext("2d");
    let tool = "brush", drawing = false, last = null, snapshot = null, undoStack = [];

    const resize = () => {
      const rect = stage.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const img = canvas.width ? canvas.toDataURL() : null;
      canvas.width = Math.max(2, Math.floor(rect.width * dpr));
      canvas.height = Math.max(2, Math.floor(rect.height * dpr));
      canvas.style.width = rect.width + "px";
      canvas.style.height = rect.height + "px";
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (img) {
        const i = new Image();
        i.onload = () => ctx.drawImage(i, 0, 0, canvas.width, canvas.height);
        i.src = img;
      }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(stage);

    const pos = (e) => {
      const r = canvas.getBoundingClientRect();
      const x = (e.clientX - r.left) * (canvas.width / r.width);
      const y = (e.clientY - r.top) * (canvas.height / r.height);
      return { x, y };
    };

    const pushUndo = () => {
      try {
        undoStack.push(canvas.toDataURL("image/png"));
        if (undoStack.length > 20) undoStack.shift();
      } catch {}
    };
    const undo = () => {
      const snap = undoStack.pop();
      if (!snap) return;
      const i = new Image();
      i.onload = () => { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(i, 0, 0); };
      i.src = snap;
    };

    const setTool = (t) => {
      tool = t;
      el.querySelectorAll('[data-tool]').forEach((b) => b.classList.toggle("ghost", b.dataset.tool !== t));
    };
    el.querySelectorAll('[data-tool]').forEach((b) => b.addEventListener("click", () => setTool(b.dataset.tool)));

    canvas.addEventListener("mousedown", (e) => {
      pushUndo();
      drawing = true;
      last = pos(e);
      const color = el.querySelector("#paint-color").value;
      const size = +el.querySelector("#paint-size").value;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = tool === "eraser" ? "#ffffff" : color;
      ctx.fillStyle = color;
      ctx.lineWidth = size;
      if (tool === "line" || tool === "rect" || tool === "ellipse") {
        snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
      } else {
        ctx.beginPath();
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(last.x + 0.01, last.y + 0.01);
        ctx.stroke();
      }
    });
    canvas.addEventListener("mousemove", (e) => {
      if (!drawing) return;
      const p = pos(e);
      if (tool === "brush" || tool === "eraser") {
        ctx.beginPath();
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        last = p;
      } else if (snapshot) {
        ctx.putImageData(snapshot, 0, 0);
        if (tool === "line") {
          ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
        } else if (tool === "rect") {
          ctx.strokeRect(last.x, last.y, p.x - last.x, p.y - last.y);
        } else if (tool === "ellipse") {
          ctx.beginPath();
          ctx.ellipse((last.x + p.x) / 2, (last.y + p.y) / 2, Math.abs(p.x - last.x) / 2, Math.abs(p.y - last.y) / 2, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    });
    window.addEventListener("mouseup", () => { drawing = false; snapshot = null; });

    el.querySelector("#paint-clear").addEventListener("click", () => { pushUndo(); ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height); });
    el.querySelector("#paint-undo").addEventListener("click", undo);
    el.querySelector("#paint-save").addEventListener("click", () => {
      const dataUrl = canvas.toDataURL("image/png");
      const name = "Painting " + new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19) + ".png";
      const path = "/Pictures/" + name;
      fs.touch(path, dataUrl, { mime: "image/png", binary: true });
      bus.emit("notify", { title: "Painting saved", body: path });
    });

    return { unmount() { ro.disconnect(); el.remove(); } };
  },
};
