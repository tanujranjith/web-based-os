import { store } from "./state.js";
import { bus } from "./event-bus.js";

let canvas,
  ctx,
  raf,
  particles = [],
  lastMouse = { x: -1e9, y: -1e9 };
let stopped = true;

function setup() {
  canvas = document.createElement("canvas");
  canvas.className = "wallpaper-canvas";
  canvas.style.cssText =
    "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;mix-blend-mode:screen;opacity:0.55";
  document.getElementById("wallpaper").appendChild(canvas);
  ctx = canvas.getContext("2d");
  resize();
  seed();
  window.addEventListener("resize", resize);
  window.addEventListener("mousemove", (e) => {
    lastMouse.x = e.clientX;
    lastMouse.y = e.clientY;
  });
}

function resize() {
  if (!canvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx.scale(dpr, dpr);
}

function seed() {
  particles = [];
  const count = Math.min(80, Math.max(28, Math.floor(window.innerWidth / 28)));
  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      r: Math.random() * 1.6 + 0.4,
    });
  }
}

function step() {
  if (stopped) return;
  if (!ctx) {
    raf = requestAnimationFrame(step);
    return;
  }
  const w = window.innerWidth,
    h = window.innerHeight;
  ctx.clearRect(0, 0, w, h);
  const accent =
    getComputedStyle(document.documentElement)
      .getPropertyValue("--accent")
      .trim() || "#5b8def";
  ctx.fillStyle = accent;
  ctx.strokeStyle = accent;

  for (const p of particles) {
    // Mouse repulsion
    const dx = p.x - lastMouse.x;
    const dy = p.y - lastMouse.y;
    const dist2 = dx * dx + dy * dy;
    if (dist2 < 12000) {
      const f = 0.06 * (1 - dist2 / 12000);
      p.vx += (dx / Math.sqrt(dist2 + 1)) * f;
      p.vy += (dy / Math.sqrt(dist2 + 1)) * f;
    }
    p.vx *= 0.985;
    p.vy *= 0.985;
    p.x += p.vx;
    p.y += p.vy;
    if (p.x < 0) p.x = w;
    else if (p.x > w) p.x = 0;
    if (p.y < 0) p.y = h;
    else if (p.y > h) p.y = 0;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Connect nearby
  ctx.lineWidth = 0.6;
  for (let i = 0; i < particles.length; i++) {
    const a = particles[i];
    for (let j = i + 1; j < particles.length; j++) {
      const b = particles[j];
      const dx = a.x - b.x,
        dy = a.y - b.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 11000) {
        ctx.globalAlpha = (1 - d2 / 11000) * 0.5;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
  }
  raf = requestAnimationFrame(step);
}

export const animatedWallpaper = {
  start() {
    if (!canvas) setup();
    if (!stopped) return;
    stopped = false;
    raf = requestAnimationFrame(step);
  },
  stop() {
    stopped = true;
    if (raf) cancelAnimationFrame(raf);
    if (canvas) {
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
  },
  apply() {
    const prefs = store.get().prefs;
    if (
      prefs.reduceMotion ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !prefs.animatedWallpaper
    )
      this.stop();
    else this.start();
  },
};

bus.on("theme-change", () => animatedWallpaper.apply());

document.addEventListener("visibilitychange", () => {
  if (document.hidden) animatedWallpaper.stop();
  else animatedWallpaper.apply();
});
