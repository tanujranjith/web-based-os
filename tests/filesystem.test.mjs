import test from "node:test";
import assert from "node:assert/strict";
const data = new Map();
globalThis.localStorage = {
  getItem: (k) => data.get(k) || null,
  setItem: (k, v) => data.set(k, String(v)),
  removeItem: (k) => data.delete(k),
};
globalThis.window = { addEventListener() {} };
const { store } = await import("../src/core/state.js");
await store.ready;
const { fs, joinPath } = await import("../src/core/filesystem.js");
test("copy/move and trash restore preserve nested files without overwrites", async () => {
  store.reset();
  fs.init();
  fs.mkdir("/Projects/demo");
  fs.touch("/Projects/demo/a.txt", "original");
  fs.copy("/Projects/demo", "/Documents/demo");
  assert.equal(fs.read("/Documents/demo/a.txt").content, "original");
  fs.copy("/Documents/demo/a.txt", "/Desktop/moved.txt", true);
  assert.equal(fs.exists("/Documents/demo/a.txt"), false);
  fs.remove("/Desktop/moved.txt");
  assert.equal(fs.exists("/Desktop/moved.txt"), false);
  const id = store.get().trash.at(-1).id;
  fs.touch("/Desktop/moved.txt", "new");
  assert.equal(fs.restoreTrash(id), "/Desktop/moved (2).txt");
  assert.equal(fs.read("/Desktop/moved.txt").content, "new");
  assert.equal(fs.read("/Desktop/moved (2).txt").content, "original");
  assert.throws(() => fs.copy("/Projects/demo", "/Projects/demo/child"));
  await store.flush();
});
test("filesystem rejects prototype names and normalizes relative paths", () => {
  assert.throws(() => fs.touch("/Desktop/__proto__", "bad"));
  assert.throws(() => fs.rename("/Desktop/welcome.txt", ".."));
  assert.equal(joinPath("/Projects/demo", "../other"), "/Projects/other");
  assert.equal({}.polluted, undefined);
});
