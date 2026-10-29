import { pdfFixture, audioFixture } from "./fixtures.mjs";
import { chromium } from "playwright";
import { browserOptions } from "./browser-runtime.mjs";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
const server = spawn(process.execPath, ["scripts/serve.mjs"], {
  env: { ...process.env, PORT: "4192", NOVAOS_SERVE_DIR: "dist" },
  stdio: ["ignore", "pipe", "pipe"],
});
await new Promise((resolve, reject) => {
  server.stdout.once("data", resolve);
  server.once("error", reject);
  server.once("exit", (code) => reject(new Error("Server exited " + code)));
});
await mkdir("artifacts", { recursive: true });
const options = await browserOptions();
options.args = options.args.filter((x) => x !== "--single-process");
const browser = await chromium.launch(options);
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  serviceWorkers: "block",
});
const page = await context.newPage();
page.setDefaultTimeout(12000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("dialog", (d) =>
  d.accept(d.type() === "prompt" ? "Test playlist" : undefined),
);
page.on("console", (m) => {
  if (m.type() === "error") console.log("CONSOLE", m.text());
});
const base = "http://127.0.0.1:4192";
async function open(id, opts = {}) {
  await page.evaluate(({ id, opts }) => window.NovaOS.manager.open(id, opts), {
    id,
    opts,
  });
  await page.waitForTimeout(300);
  return page.locator(`.window[data-app="${id}"]`).last();
}
async function closeAll() {
  await page.evaluate(() => window.NovaOS.manager.closeAll());
  await page.waitForTimeout(350);
}
try {
  await page.goto(base);
  await page.waitForFunction(
    () => window.NovaOS?.fs.root && document.querySelector("#os:not([hidden])"),
  );
  await page.waitForTimeout(400);
  assert.equal(
    await page.evaluate(() => window.NovaOS.registry.all().length),
    23,
  );
  await page.screenshot({ path: "artifacts/desktop.png" });
  console.log("PASS desktop boot");
  for (const id of await page.evaluate(() =>
    window.NovaOS.registry.all().map((a) => a.id),
  )) {
    console.log("CHECK APP", id);
    const win = await open(id);
    assert.ok(await win.isVisible(), id + " visible");
    assert.equal(
      await win
        .locator(".em-title")
        .filter({ hasText: "Couldn't open" })
        .count(),
      0,
      id + " mounted",
    );
    await closeAll();
  }
  console.log("PASS all 23 apps mount and close");
  let win = await open("notes");
  await win.getByLabel("Note title", { exact: true }).fill("Integration note");
  await win
    .getByLabel("Note body", { exact: true })
    .fill("Remember this **important** idea.");
  await win.getByLabel("Folder", { exact: true }).fill("School");
  await win.getByLabel("Tags", { exact: true }).fill("physics, planning");
  await win.locator("[data-preview]").click();
  await page.waitForTimeout(200);
  assert.equal(
    await win.locator(".note-preview strong").innerText(),
    "important",
  );
  await page.screenshot({ path: "artifacts/notes.png" });
  await closeAll();
  await page.evaluate(() => window.NovaOS.store.flush());
  await page.reload();
  await page.waitForFunction(
    () => window.NovaOS?.fs.root && !document.querySelector("#boot-screen"),
  );
  assert.ok(
    await page.evaluate(() =>
      window.NovaOS.store
        .get()
        .notes.some(
          (n) => n.title === "Integration note" && n.body.includes("important"),
        ),
    ),
  );
  console.log("PASS note formatting and persistence");
  win = await open("tasks");
  await win.getByLabel("New task", { exact: true }).fill("Prepare physics lab");
  await win.locator("[data-create]").click();
  await win
    .locator("[data-edit]")
    .filter({ hasText: "Prepare physics lab" })
    .click();
  await win.locator("form [name=when]").fill("2026-10-29");
  await win.locator("form [name=project]").fill("Physics");
  await win.locator("form [name=priority]").selectOption("High");
  await win
    .locator("form [name=subtasks]")
    .fill("Collect data\n[x] Read instructions");
  await win.getByRole("button", { name: "Save details", exact: true }).click();
  await closeAll();
  win = await open("board");
  assert.ok(
    await win
      .getByRole("button", { name: "Prepare physics lab", exact: true })
      .isVisible(),
  );
  await win.locator("[data-status]").selectOption("doing");
  await page.screenshot({ path: "artifacts/board.png" });
  await closeAll();
  win = await open("calendar", { date: "2026-10-29" });
  assert.ok(
    await win
      .locator(".calendar-events")
      .getByRole("button", { name: "Prepare physics lab", exact: true })
      .isVisible(),
  );
  await win.locator("[data-new]").click();
  await win.locator("form [name=title]").fill("Weekly review");
  await win.locator("form [name=repeat]").selectOption("weekly");
  await win.getByRole("button", { name: "Save event", exact: true }).click();
  await page.screenshot({ path: "artifacts/calendar.png" });
  await closeAll();
  console.log("PASS shared Tasks/Board/Calendar and recurring events");
  win = await open("files", { path: "/Documents" });
  await win.locator("input[type=file]").setInputFiles({
    name: "roundtrip.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("File round trip"),
  });
  await page.waitForTimeout(100);
  await win.locator('[data-path="/Documents/roundtrip.txt"]').dblclick();
  await page.waitForTimeout(150);
  assert.equal(
    await page.locator(".window[data-app=notes] textarea").inputValue(),
    "File round trip",
  );
  await closeAll();
  await page.evaluate(() => {
    const { fs } = window.NovaOS;
    fs.copy("/Documents/roundtrip.txt", "/Desktop/copied.txt");
    fs.remove("/Desktop/copied.txt");
    fs.restoreTrash(window.NovaOS.store.get().trash.at(-1).id);
  });
  assert.equal(
    await page.evaluate(
      () => window.NovaOS.fs.read("/Desktop/copied.txt").content,
    ),
    "File round trip",
  );
  console.log("PASS file import, app handoff, copy and Trash restore");
  win = await open("code-editor", { openFsFile: "/Projects/hello.js" });
  await win.locator(".cm-editor").waitFor();
  await page.waitForFunction(() =>
    document.querySelector(".cm-content")?.textContent.includes("hello world"),
  );
  await win.locator("[data-new]").click();
  await win.locator(".cm-content").fill('console.log("Preview works")');
  await win.locator("[data-preview]").click();
  await page.waitForTimeout(150);
  assert.ok(
    await win
      .locator("iframe")
      .contentFrame()
      .locator("#output")
      .innerText()
      .then((x) => x.includes("Preview works")),
  );
  await page.screenshot({ path: "artifacts/code.png" });
  await closeAll();
  win = await open("code-editor");
  await win.locator(".cm-editor").waitFor();
  assert.equal(
    await win.locator(".cm-content").innerText(),
    'console.log("Preview works")',
  );
  await win.locator("[data-preview]").click();
  assert.equal(
    await win
      .locator("iframe")
      .contentFrame()
      .locator("body")
      .evaluate(() => {
        try {
          return !!parent.NovaOS;
        } catch {
          return "blocked";
        }
      }),
    "blocked",
  );
  await win.locator("[data-save]").click();
  await page.locator(".file-dialog [name=filename]").fill("recovered.js");
  await page
    .locator(".file-dialog")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await page.waitForFunction(
    () => !!window.NovaOS.fs.read("/Documents/recovered.js"),
  );
  await closeAll();
  console.log("PASS code editor, recovery draft and sandboxed preview");

  win = await open("pdf-viewer");
  await win.locator("input[type=file]").setInputFiles({
    name: "sample.pdf",
    mimeType: "application/pdf",
    buffer: pdfFixture(),
  });
  await win
    .locator(".pdf-text")
    .filter({ hasText: "PDF search sample" })
    .waitFor();
  await win.locator("[data-next]").click();
  await win
    .locator(".pdf-text")
    .filter({ hasText: "Second page content" })
    .waitFor();
  await win.locator(".pdf-search").fill("search");
  await win.locator("[data-find]").click();
  await win.locator(".pdf-text mark").filter({ hasText: "search" }).waitFor();
  await win.locator("[data-plus]").click();
  await page.waitForTimeout(100);
  await page.screenshot({ path: "artifacts/pdf.png" });
  await win.locator("input[type=file]").setInputFiles({
    name: "another.pdf",
    mimeType: "application/pdf",
    buffer: pdfFixture("Another PDF"),
  });
  await win.locator(".pdf-text").filter({ hasText: "Another PDF" }).waitFor();
  await closeAll();
  console.log(
    "PASS PDF import, paging, text search, zoom and document switching",
  );
  win = await open("music");
  await win.locator("input[type=file]").setInputFiles({
    name: "tone.wav",
    mimeType: "audio/wav",
    buffer: audioFixture(),
  });
  await win.locator("[data-track]").click();
  await page.waitForFunction(() =>
    document.querySelector(".mini-player:not([hidden])"),
  );
  await win.locator("[data-repeat]").click();
  await win.locator("[data-playlist]").click();
  assert.equal(
    await page.evaluate(() => window.NovaOS.store.get().playlists[0].name),
    "Test playlist",
  );
  await page.screenshot({ path: "artifacts/music.png" });
  await closeAll();
  assert.ok(await page.locator(".mini-player").isVisible());
  await page.locator("[data-mini-play]").click();
  await page.evaluate(() => window.NovaOS.store.flush());
  assert.equal(
    await page.evaluate(() => window.NovaOS.store.get().media.repeat),
    "all",
  );
  console.log("PASS audio import, playback queue, repeat and desktop controls");
  win = await open("image-viewer");
  await win.locator("input[type=file]").setInputFiles({
    name: "pixel.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="60"><rect width="100" height="60" fill="blue"/></svg>',
    ),
  });
  await win.locator("img:not([hidden])").waitFor();
  await win.locator("[data-rotate]").click();
  await win.locator("[data-save]").click();
  await page.waitForFunction(() =>
    window.NovaOS.fs.ls("/Pictures").some((f) => f.name.includes("edited")),
  );
  await closeAll();
  console.log("PASS image import, rotation and saved export");
  win = await open("paint");
  const rect = await win.locator("canvas").boundingBox();
  await page.mouse.move(rect.x + 30, rect.y + 30);
  await page.mouse.down();
  await page.mouse.move(rect.x + 100, rect.y + 80);
  await page.mouse.up();
  await win.locator("[data-undo]").click();
  await win.locator("[data-redo]").click();
  await win.locator("[data-save]").click();
  assert.ok(
    await page.evaluate(() =>
      window.NovaOS.fs.ls("/Pictures").some((f) => f.name === "Painting.png"),
    ),
  );
  await closeAll();
  console.log("PASS drawing, undo/redo and saving");
  win = await open("files", { path: "/Desktop" });
  await win.locator("[data-window]").click();
  assert.equal(await page.locator(".window[data-app=files]").count(), 2);
  await page.evaluate(() => {
    const m = window.NovaOS.manager;
    const list = m.list();
    m.moveToWorkspace(list[1].id, 2);
    m.snap(list[0].id, "left");
    m.checkpoint();
    return window.NovaOS.store.flush();
  });
  await page.reload();
  await page.waitForFunction(
    () =>
      !document.querySelector("#boot-screen") &&
      window.NovaOS?.manager.list().length === 2,
  );
  assert.ok(
    await page.evaluate(() =>
      window.NovaOS.manager.list().some((r) => r.state.workspace === 2),
    ),
  );
  await closeAll();
  console.log("PASS multiple windows and session/workspace restoration");
  await page.setViewportSize({ width: 390, height: 844 });
  win = await open("tasks");
  assert.ok(await page.locator(".mobile-switcher").isVisible());
  await page.screenshot({ path: "artifacts/mobile-tasks.png" });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await closeAll();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() =>
    window.NovaOS.store.update((s) => {
      s.workspaceNames[1] = "Creative";
    }),
  );
  assert.equal(await page.locator('[data-space="1"]').innerText(), "Creative");
  await page.evaluate(() => window.NovaOS.manager.switchWorkspace(0));
  win = await open("files");
  await win.locator("[data-window]").click();
  await page.evaluate(() => {
    const m = window.NovaOS.manager,
      list = m.list();
    m.snap(list[0].id, "left");
    m.snap(list[1].id, "right");
  });
  await page.locator(".split-divider:not([hidden])").waitFor();
  const divider = await page.locator(".split-divider").boundingBox();
  await page.mouse.move(divider.x + 4, divider.y + 30);
  await page.mouse.down();
  await page.mouse.move(820, divider.y + 30);
  await page.mouse.up();
  assert.ok(
    await page.evaluate(() => window.NovaOS.manager.list()[0].state.w > 760),
  );
  await page.locator('[aria-label="Saved workspace layouts"]').click();
  await page.locator("[data-save-layout]").click();
  assert.ok(await page.locator("[data-layout]").count());
  await closeAll();
  console.log("PASS workspace naming, saved layouts and adjustable split");
  await context.close();
  const offline = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const op = await offline.newPage();
  op.on("dialog", (d) => d.accept());
  await op.goto(base);
  await op.waitForFunction(
    () => window.NovaOS?.fs.root && !document.querySelector("#boot-screen"),
  );
  await op.evaluate(() => navigator.serviceWorker.ready);
  await op.reload();
  await op.waitForFunction(() => !!navigator.serviceWorker.controller);
  await offline.setOffline(true);
  await op.reload();
  await op.waitForFunction(
    () => window.NovaOS?.fs.root && !document.querySelector("#boot-screen"),
  );
  await op.evaluate(() =>
    window.NovaOS.manager.open("code-editor", {
      openFsFile: "/Projects/hello.js",
    }),
  );
  await op.locator(".cm-editor").waitFor();
  await offline.close();
  console.log("PASS mobile layout and offline app loading");
  const migration = await browser.newContext({ serviceWorkers: "block" });
  await migration.addInitScript(() => {
    if (localStorage.getItem("novaos:profiles")) return;
    localStorage.setItem(
      "novaos:profiles",
      JSON.stringify({
        activeId: "legacy",
        profiles: [{ id: "legacy", name: "Legacy", avatar: "L" }],
        locked: false,
      }),
    );
    localStorage.setItem(
      "novaos:v1:legacy",
      JSON.stringify({
        version: 1,
        notes: [
          {
            id: "legacy-note",
            title: "Legacy note",
            body: "Preserve my work",
            modifiedAt: 1,
          },
        ],
        board: [
          {
            id: "legacy-card",
            title: "Legacy project",
            status: "doing",
            priority: "High",
          },
        ],
      }),
    );
  });
  const mp = await migration.newPage();
  await mp.goto(base);
  await mp.waitForFunction(
    () => window.NovaOS?.fs.root && !document.querySelector("#boot-screen"),
  );
  await mp.evaluate(() => window.NovaOS.store.flush());
  assert.ok(
    await mp.evaluate(
      () =>
        window.NovaOS.store.get().notes[0].body === "Preserve my work" &&
        window.NovaOS.store
          .get()
          .tasks.some((t) => t.text === "Legacy project") &&
        !localStorage.getItem("novaos:v1:legacy"),
    ),
  );
  await migration.close();
  console.log("PASS legacy profile and Board migration");
  assert.deepEqual(errors, []);
  console.log("PASS no uncaught browser errors");
} catch (error) {
  console.log("BROWSER ERRORS", errors);
  if (!page.isClosed())
    await page.screenshot({ path: "artifacts/failure.png" });
  throw error;
} finally {
  await browser.close();
  server.kill();
}
