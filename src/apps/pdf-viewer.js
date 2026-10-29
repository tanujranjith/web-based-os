import { fs, basename } from "../core/filesystem.js";
import { store } from "../core/state.js";
import { fileDialog } from "../ui/dialogs.js";
export default {
  id: "pdf-viewer",
  name: "PDF",
  category: "Media",
  keywords: ["document", "pdf", "reader"],
  defaultSize: { w: 1000, h: 720 },
  mount(container, ctx) {
    const el = document.createElement("div");
    el.className = "app pdf-reader";
    el.innerHTML = `<div class="app-toolbar"><button class="btn" data-open>Open</button><label class="btn">Import<input type="file" accept="application/pdf" hidden></label><button class="btn" data-prev aria-label="Previous page">‹</button><input class="input pdf-page" type="number" min="1" value="1" aria-label="Page number"><span data-pages>/ 0</span><button class="btn" data-next aria-label="Next page">›</button><button class="btn" data-minus aria-label="Zoom out">−</button><button class="btn" data-plus aria-label="Zoom in">+</button><button class="btn" data-fit>Fit</button><input class="input pdf-search" placeholder="Find text" aria-label="Find text"><button class="btn" data-find>Find next</button></div><div class="pdf-workbench"><aside class="pdf-thumbnails"></aside><div class="pdf-document scroll-thin"><p data-message>Open a PDF to start reading.</p><canvas hidden></canvas><div class="pdf-text"></div></div></div>`;
    container.append(el);
    let doc = null,
      page = 1,
      scale = 1,
      path = null,
      generation = 0,
      task = null,
      loadingTask = null,
      disposed = false,
      pdf,
      found = [],
      findIndex = -1;
    const canvas = el.querySelector("canvas"),
      stage = el.querySelector(".pdf-document"),
      message = el.querySelector("[data-message]"),
      number = el.querySelector(".pdf-page");
    async function render() {
      if (!doc || disposed) return;
      const token = ++generation;
      task?.cancel();
      try {
        const p = await doc.getPage(page);
        if (token !== generation) return;
        const viewport = p.getViewport({ scale });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.hidden = false;
        task = p.render({ canvasContext: canvas.getContext("2d"), viewport });
        await task.promise;
        if (token !== generation) return;
        const content = await p.getTextContent();
        const text = content.items.map((x) => x.str).join(" ");
        const layer = el.querySelector(".pdf-text");
        layer.textContent = text;
        layer.setAttribute("aria-label", "Page text");
        const q = el.querySelector(".pdf-search").value.trim();
        if (q) {
          layer.replaceChildren();
          const bits = text.split(
            new RegExp(
              "(" + q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")",
              "ig",
            ),
          );
          for (const bit of bits) {
            const n = document.createElement(
              bit.toLowerCase() === q.toLowerCase() ? "mark" : "span",
            );
            n.textContent = bit;
            layer.append(n);
          }
        }
        number.value = page;
        number.max = doc.numPages;
        message.textContent = `Page ${page} of ${doc.numPages} · ${Math.round(scale * 100)}%`;
        if (path)
          store.update((s) => {
            s.pdfPositions ??= {};
            s.pdfPositions[path] = { page, scale };
          });
      } catch (error) {
        if (error.name !== "RenderingCancelledException")
          message.textContent = error.message;
      }
    }
    async function open(p) {
      const token = ++generation;
      task?.cancel();
      loadingTask?.destroy().catch(() => {});
      doc = null;
      path = p;
      ctx.checkpoint?.();
      canvas.hidden = true;
      el.querySelector(".pdf-text").textContent = "";
      message.textContent = "Loading PDF…";
      try {
        pdf ??= await import("../../vendor/pdf.mjs");
        pdf.GlobalWorkerOptions.workerSrc = new URL(
          "../../vendor/pdf.worker.mjs",
          import.meta.url,
        ).href;
        const node = fs.read(p);
        if (!node) throw new Error("PDF not found");
        const bytes = await (await fetch(node.content)).arrayBuffer();
        const nextTask = pdf.getDocument({
          data: bytes,
          cMapUrl: new URL("../../vendor/cmaps/", import.meta.url).href,
          cMapPacked: true,
          standardFontDataUrl: new URL(
            "../../vendor/standard_fonts/",
            import.meta.url,
          ).href,
        });
        loadingTask = nextTask;
        const loaded = await nextTask.promise;
        if (token !== generation || disposed) {
          nextTask.destroy().catch(() => {});
          return;
        }
        doc = loaded;
        const saved = store.get().pdfPositions?.[p];
        page = Math.min(doc.numPages, saved?.page || 1);
        scale = saved?.scale || 1;
        ctx.setTitle("PDF · " + basename(p));
        el.querySelector("[data-pages]").textContent = "/ " + doc.numPages;
        const thumbs = el.querySelector(".pdf-thumbnails");
        thumbs.replaceChildren();
        for (let n = 1; n <= doc.numPages; n++) {
          const b = document.createElement("button");
          b.className = "pdf-thumb btn";
          b.textContent = String(n);
          b.onclick = () => {
            page = n;
            render();
          };
          thumbs.append(b);
          if (n <= 30) {
            const pg = await doc.getPage(n);
            if (disposed || token !== generation) return;
            const c = document.createElement("canvas"),
              v = pg.getViewport({ scale: 0.16 });
            c.width = v.width;
            c.height = v.height;
            await pg.render({ canvasContext: c.getContext("2d"), viewport: v })
              .promise;
            b.prepend(c);
          }
        }
        render();
      } catch (error) {
        if (token === generation && !disposed)
          message.textContent = "Could not open PDF: " + error.message;
      }
    }
    el.querySelector("[data-open]").onclick = async () => {
      const p = await fileDialog({
        accept: (p) => p.toLowerCase().endsWith(".pdf"),
      });
      if (p) open(p);
    };
    el.querySelector("input[type=file]").onchange = async (e) => {
      if (e.target.files[0])
        open(await fs.importFile(e.target.files[0], "/Documents"));
    };
    el.querySelector("[data-prev]").onclick = () => {
      if (page > 1) {
        page--;
        render();
      }
    };
    el.querySelector("[data-next]").onclick = () => {
      if (page < doc?.numPages) {
        page++;
        render();
      }
    };
    number.onchange = () => {
      if (!doc) return;
      page = Math.max(1, Math.min(doc.numPages, Number(number.value) || 1));
      render();
    };
    el.querySelector("[data-minus]").onclick = () => {
      scale = Math.max(0.25, scale - 0.2);
      render();
    };
    el.querySelector("[data-plus]").onclick = () => {
      scale = Math.min(4, scale + 0.2);
      render();
    };
    el.querySelector("[data-fit]").onclick = async () => {
      if (!doc) return;
      const p = await doc.getPage(page);
      scale = Math.max(
        0.25,
        (stage.clientWidth - 50) / p.getViewport({ scale: 1 }).width,
      );
      render();
    };
    el.querySelector("[data-find]").onclick = async () => {
      if (!doc) return;
      const q = el.querySelector(".pdf-search").value.toLowerCase().trim();
      if (!q) return;
      const current = doc;
      found = [];
      for (let n = 1; n <= current.numPages; n++) {
        const text = await (await current.getPage(n)).getTextContent();
        if (current !== doc) return;
        if (
          text.items
            .map((x) => x.str)
            .join(" ")
            .toLowerCase()
            .includes(q)
        )
          found.push(n);
      }
      if (!found.length) {
        message.textContent = "No matches";
        return;
      }
      findIndex = (findIndex + 1) % found.length;
      page = found[findIndex];
      render();
    };
    if (ctx.opts.openFsFile) open(ctx.opts.openFsFile);
    return {
      onOpen(opts) {
        if (opts.openFsFile) open(opts.openFsFile);
      },
      session: () => ({ openFsFile: path }),
      unmount() {
        disposed = true;
        generation++;
        task?.cancel();
        loadingTask?.destroy().catch(() => {});
        el.remove();
      },
    };
  },
};
