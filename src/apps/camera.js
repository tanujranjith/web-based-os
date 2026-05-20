import { fs } from "../core/filesystem.js";
import { bus } from "../core/event-bus.js";

export default {
  id: "camera",
  name: "Camera",
  icon: "📷",
  category: "Media",
  defaultSize: { w: 640, h: 540 },
  keywords: ["webcam", "photo", "snapshot"],
  mount(container) {
    const el = document.createElement("div");
    el.className = "app cam-app";
    el.innerHTML = `
      <div class="cam-stage">
        <video id="cam-video" autoplay muted playsinline></video>
        <canvas id="cam-snap" hidden></canvas>
        <div class="cam-overlay" id="cam-overlay">
          <div class="em-icon">📷</div>
          <div class="em-title">Camera not started</div>
          <div class="em-sub">Click "Start" to allow webcam access. Snapshots are saved to /Pictures.</div>
        </div>
      </div>
      <div class="app-toolbar" style="border-top:1px solid var(--border); border-bottom:0; justify-content:center">
        <button class="btn primary" id="cam-start">Start</button>
        <button class="btn" id="cam-snap-btn" disabled>📸 Snap</button>
        <button class="btn ghost" id="cam-flip" disabled>↺ Flip</button>
        <button class="btn ghost danger" id="cam-stop" disabled>Stop</button>
      </div>
      <div class="cam-shots" id="cam-shots"></div>
    `;
    container.appendChild(el);
    const video = el.querySelector("#cam-video");
    const canvas = el.querySelector("#cam-snap");
    const overlay = el.querySelector("#cam-overlay");
    const $start = el.querySelector("#cam-start");
    const $snap = el.querySelector("#cam-snap-btn");
    const $flip = el.querySelector("#cam-flip");
    const $stop = el.querySelector("#cam-stop");
    const $shots = el.querySelector("#cam-shots");
    let stream = null;
    let mirror = true;
    const updateMirror = () => { video.style.transform = mirror ? "scaleX(-1)" : "none"; };
    updateMirror();

    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        video.srcObject = stream;
        overlay.hidden = true;
        $start.disabled = true; $snap.disabled = false; $flip.disabled = false; $stop.disabled = false;
      } catch (e) {
        bus.emit("notify", { title: "Camera error", body: e.message || "Permission denied." });
      }
    };
    const stop = () => {
      if (stream) stream.getTracks().forEach((t) => t.stop());
      stream = null;
      video.srcObject = null;
      overlay.hidden = false;
      $start.disabled = false; $snap.disabled = true; $flip.disabled = true; $stop.disabled = true;
    };
    const snap = () => {
      if (!stream) return;
      const w = video.videoWidth, h = video.videoHeight;
      canvas.width = w; canvas.height = h;
      const c = canvas.getContext("2d");
      if (mirror) { c.translate(w, 0); c.scale(-1, 1); }
      c.drawImage(video, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/png");
      const name = "Snapshot " + new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19) + ".png";
      const path = "/Pictures/" + name;
      fs.touch(path, dataUrl, { mime: "image/png", binary: true });
      const t = document.createElement("img"); t.src = dataUrl; t.title = name; t.className = "cam-shot";
      $shots.prepend(t);
      bus.emit("notify", { title: "Photo saved", body: path });
    };

    $start.addEventListener("click", start);
    $stop.addEventListener("click", stop);
    $snap.addEventListener("click", snap);
    $flip.addEventListener("click", () => { mirror = !mirror; updateMirror(); });

    return { unmount() { stop(); el.remove(); } };
  },
};
