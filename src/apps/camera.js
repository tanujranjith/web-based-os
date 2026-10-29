import { fs } from "../core/filesystem.js";
import { bus } from "../core/event-bus.js";

export default {
  id: "camera",
  name: "Camera",
  icon: "📷",
  category: "Media",
  defaultSize: { w: 640, h: 540 },
  keywords: ["webcam", "photo", "snapshot"],
  mount(container, ctx) {
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
        <select class="select" id="cam-device" aria-label="Camera device"><option value="">Default camera</option></select><button class="btn primary" id="cam-start">Start</button>
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
    let mirror = true,
      disposed = false,
      requestId = 0;
    const updateMirror = () => {
      video.style.transform = mirror ? "scaleX(-1)" : "none";
    };
    updateMirror();

    const start = async () => {
      try {
        const id = ++requestId;
        const device = el.querySelector("#cam-device").value;
        const incoming = await navigator.mediaDevices.getUserMedia({
          video: device ? { deviceId: { exact: device } } : true,
          audio: false,
        });
        if (disposed || id !== requestId) {
          incoming.getTracks().forEach((t) => t.stop());
          return;
        }
        stream?.getTracks().forEach((t) => t.stop());
        stream = incoming;
        const devices = await navigator.mediaDevices.enumerateDevices();
        const select = el.querySelector("#cam-device");
        select.replaceChildren(
          new Option("Default camera", ""),
          ...devices
            .filter((d) => d.kind === "videoinput")
            .map((d) => new Option(d.label || "Camera", d.deviceId)),
        );
        select.value = device;
        video.srcObject = stream;
        overlay.hidden = true;
        $start.disabled = true;
        $snap.disabled = false;
        $flip.disabled = false;
        $stop.disabled = false;
      } catch (e) {
        bus.emit("notify", {
          title: "Camera error",
          body: e.message || "Permission denied.",
        });
      }
    };
    const stop = () => {
      requestId++;
      if (stream) stream.getTracks().forEach((t) => t.stop());
      stream = null;
      video.srcObject = null;
      overlay.hidden = false;
      $start.disabled = false;
      $snap.disabled = true;
      $flip.disabled = true;
      $stop.disabled = true;
    };
    const snap = () => {
      if (!stream || !video.videoWidth) return;
      const w = video.videoWidth,
        h = video.videoHeight;
      canvas.width = w;
      canvas.height = h;
      const c = canvas.getContext("2d");
      if (mirror) {
        c.translate(w, 0);
        c.scale(-1, 1);
      }
      c.drawImage(video, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/png");
      const name =
        "Snapshot " +
        new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19) +
        ".png";
      const path = "/Pictures/" + name;
      fs.touch(path, dataUrl, { mime: "image/png", binary: true });
      const t = document.createElement("img");
      t.src = dataUrl;
      t.title = name;
      t.className = "cam-shot";
      t.tabIndex = 0;
      t.setAttribute("role", "button");
      t.setAttribute("aria-label", "Review photo " + name);
      t.onclick = () => ctx.openApp("image-viewer", { openFsFile: path });
      t.onkeydown = (e) => {
        if (e.key === "Enter") t.click();
      };
      $shots.prepend(t);
      bus.emit("notify", { title: "Photo saved", body: path });
    };

    el.querySelector("#cam-device").onchange = () => {
      if (stream) start();
    };
    $start.addEventListener("click", start);
    $stop.addEventListener("click", stop);
    $snap.addEventListener("click", snap);
    $flip.addEventListener("click", () => {
      mirror = !mirror;
      updateMirror();
    });

    return {
      unmount() {
        disposed = true;
        stop();
        el.remove();
      },
    };
  },
};
