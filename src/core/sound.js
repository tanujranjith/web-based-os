import { store } from "./state.js";

let ctx;
const get = () => {
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch { ctx = null; }
  }
  if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
};

function enabled() { return !!store.get().prefs?.sounds; }

function tone({ freq = 440, dur = 0.08, type = "sine", gain = 0.04, slide = null }) {
  if (!enabled()) return;
  const c = get(); if (!c) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  if (slide) osc.frequency.linearRampToValueAtTime(slide, t + dur);
  g.gain.value = 0;
  g.gain.linearRampToValueAtTime(gain, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export const sound = {
  click() { tone({ freq: 1100, dur: 0.04, type: "triangle", gain: 0.02 }); },
  open()  { tone({ freq: 600,  dur: 0.10, type: "sine",     gain: 0.05, slide: 880 }); },
  close() { tone({ freq: 700,  dur: 0.10, type: "sine",     gain: 0.04, slide: 400 }); },
  toggle(){ tone({ freq: 900,  dur: 0.06, type: "triangle", gain: 0.03 }); },
  notify(){ tone({ freq: 720,  dur: 0.08, type: "sine",     gain: 0.05, slide: 1040 }); setTimeout(() => tone({ freq: 1040, dur: 0.12, gain: 0.04, slide: 1280 }), 80); },
  error() { tone({ freq: 220,  dur: 0.18, type: "sawtooth", gain: 0.05, slide: 140 }); },
  boot()  {
    tone({ freq: 380, dur: 0.18, type: "sine", gain: 0.06, slide: 520 });
    setTimeout(() => tone({ freq: 520, dur: 0.22, type: "sine", gain: 0.05, slide: 760 }), 120);
    setTimeout(() => tone({ freq: 760, dur: 0.30, type: "sine", gain: 0.04, slide: 880 }), 260);
  },
};
