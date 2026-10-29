// IndexedDB keeps file blobs out of synchronous Web Storage. The legacy key is
// retained until the first transaction commits, making migration restartable.
let connection;
const request = (req) =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
export function database() {
  if (!globalThis.indexedDB) return Promise.resolve(null);
  return (connection ??= new Promise((resolve, reject) => {
    const req = indexedDB.open("novaos-4", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("profiles");
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => {
        db.close();
        connection = null;
      };
      resolve(db);
    };
    req.onerror = () => {
      connection = null;
      reject(req.error);
    };
    req.onblocked = () => {
      connection = null;
      reject(
        new Error("Close other NovaOS tabs to finish the storage upgrade."),
      );
    };
  }));
}
function encode(node) {
  if (!node || typeof node !== "object") return node;
  const out = Array.isArray(node) ? [] : {};
  for (const [key, value] of Object.entries(node)) {
    if (["__proto__", "constructor", "prototype"].includes(key)) continue;
    if (
      key === "content" &&
      node.binary &&
      typeof value === "string" &&
      /^data:[^,]*;base64,/.test(value)
    ) {
      const [header, data] = value.split(",");
      const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
      out[key] = new Blob([bytes], { type: header.slice(5).split(";")[0] });
    } else out[key] = encode(value);
  }
  return out;
}
async function decode(node) {
  if (node instanceof Blob) {
    const bytes = new Uint8Array(await node.arrayBuffer());
    let value = "";
    for (let i = 0; i < bytes.length; i += 32768)
      value += String.fromCharCode(...bytes.subarray(i, i + 32768));
    return `data:${node.type};base64,${btoa(value)}`;
  }
  if (!node || typeof node !== "object") return node;
  const out = Array.isArray(node) ? [] : {};
  for (const [key, value] of Object.entries(node))
    if (!["__proto__", "constructor", "prototype"].includes(key))
      out[key] = await decode(value);
  return out;
}
export async function readProfile(key) {
  const db = await database();
  if (!db) return null;
  return decode(
    await request(db.transaction("profiles").objectStore("profiles").get(key)),
  );
}
export async function writeProfile(key, value) {
  const db = await database();
  if (!db) return false;
  const snapshot = encode(value);
  await new Promise((resolve, reject) => {
    const tx = db.transaction("profiles", "readwrite");
    tx.objectStore("profiles").put(snapshot, key);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("Save aborted"));
  });
  return true;
}
export async function deleteProfile(key) {
  const db = await database();
  if (!db) return;
  await new Promise((resolve, reject) => {
    const tx = db.transaction("profiles", "readwrite");
    tx.objectStore("profiles").delete(key);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
