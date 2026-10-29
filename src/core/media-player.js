import { store } from "./state.js";
import { fs } from "./filesystem.js";
import { bus } from "./event-bus.js";
const audio = new Audio();
let path = null,
  lastSaved = 0;
function state() {
  return (
    store.get().media || {
      queue: [],
      repeat: "off",
      shuffle: false,
      volume: 0.8,
    }
  );
}
function change(fn) {
  store.update((s) => {
    s.media ??= { queue: [], repeat: "off", shuffle: false, volume: 0.8 };
    fn(s.media);
  });
  bus.emit("media-change");
}
function emit() {
  bus.emit("media-change", mediaPlayer.snapshot());
}
audio.addEventListener("timeupdate", () => {
  if (Date.now() - lastSaved > 5000) {
    lastSaved = Date.now();
    change((s) => {
      s.time = audio.currentTime;
      s.path = path;
    });
  }
  emit();
});
["play", "pause", "loadedmetadata", "volumechange"].forEach((e) =>
  audio.addEventListener(e, emit),
);
audio.addEventListener("error", () =>
  bus.emit("notify", {
    title: "Playback failed",
    body: "This file could not be decoded by your browser.",
  }),
);
audio.addEventListener("ended", () => {
  if (state().repeat === "one") {
    audio.currentTime = 0;
    audio.play().catch(() => {});
  } else mediaPlayer.next();
});
export const mediaPlayer = {
  snapshot() {
    return {
      ...state(),
      path,
      paused: audio.paused,
      time: audio.currentTime,
      duration: audio.duration || 0,
    };
  },
  play(p) {
    const node = fs.read(p);
    if (!node) return;
    path = p;
    audio.src = node.content;
    audio.volume = state().volume ?? 0.8;
    change((s) => {
      s.path = p;
      s.time = 0;
      if (!s.queue.includes(p)) s.queue.push(p);
    });
    audio
      .play()
      .catch((error) =>
        bus.emit("notify", { title: "Playback paused", body: error.message }),
      );
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: p.split("/").pop(),
      });
      navigator.mediaSession.setActionHandler("play", () => audio.play());
      navigator.mediaSession.setActionHandler("pause", () => audio.pause());
      navigator.mediaSession.setActionHandler("nexttrack", () => this.next());
      navigator.mediaSession.setActionHandler("previoustrack", () =>
        this.next(-1),
      );
    }
  },
  toggle() {
    if (!path) {
      const saved = state();
      if (saved.path) {
        this.play(saved.path);
        audio.addEventListener(
          "loadedmetadata",
          () => {
            audio.currentTime = saved.time || 0;
          },
          { once: true },
        );
      } else if (saved.queue[0]) this.play(saved.queue[0]);
      return;
    }
    audio.paused ? audio.play().catch(() => {}) : audio.pause();
  },
  next(direction = 1) {
    const s = state(),
      queue = s.queue.filter((p) => fs.exists(p));
    if (!queue.length) return;
    let index = queue.indexOf(path) + direction;
    if (s.shuffle) index = Math.floor(Math.random() * queue.length);
    if (index >= queue.length && s.repeat === "off") return;
    this.play(queue[(index + queue.length) % queue.length]);
  },
  seek(seconds) {
    if (Number.isFinite(audio.duration))
      audio.currentTime = Math.max(0, Math.min(seconds, audio.duration));
  },
  queue(paths) {
    change((s) => (s.queue = [...new Set(paths)]));
  },
  volume(value) {
    audio.volume = value;
    change((s) => (s.volume = value));
  },
  repeat() {
    change(
      (s) => (s.repeat = { off: "all", all: "one", one: "off" }[s.repeat]),
    );
  },
  shuffle() {
    change((s) => (s.shuffle = !s.shuffle));
  },
};
