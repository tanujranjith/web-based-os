import test from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import {
  writeProfile,
  readProfile,
  database,
  deleteProfile,
} from "../src/core/persistence.js";
test("binary files round-trip as blobs and profiles remain isolated", async () => {
  const content = "data:application/pdf;base64,SGVsbG8=";
  await writeProfile("a", {
    version: 1,
    fs: { type: "dir", children: { pdf: { binary: true, content } } },
  });
  await writeProfile("b", { version: 1, quickNote: "Other person" });
  const raw = await new Promise((resolve, reject) => {
    database().then((db) => {
      const r = db.transaction("profiles").objectStore("profiles").get("a");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  });
  assert.ok(raw.fs.children.pdf.content instanceof Blob);
  assert.equal((await readProfile("a")).fs.children.pdf.content, content);
  assert.equal((await readProfile("b")).quickNote, "Other person");
  await deleteProfile("a");
  assert.equal(await readProfile("a"), undefined);
  assert.equal((await readProfile("b")).quickNote, "Other person");
});
