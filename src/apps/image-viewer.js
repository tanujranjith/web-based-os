import { fs, basename } from "../core/filesystem.js";
import { fileDialog } from "../ui/dialogs.js";
import { bus } from "../core/event-bus.js";
export default {
  id: "image-viewer",
  name: "Images",
  category: "Media",
  keywords: ["photo", "image", "crop", "rotate"],
  defaultSize: { w: 1000, h: 720 },
  mount(container, ctx) {
    let path = null,
      zoom = 1,
      rotation = 0,
      x = 0,
      y = 0,
      crop = false,
      start,
      selection = null,
      disposed = false;
    const el = document.createElement("div");
    el.className = "app image-v4";
    el.innerHTML = `<div class="app-toolbar"><button class="btn" data-open>Open</button><label class="btn">Import<input type="file" accept="image/*" hidden></label><button class="btn" data-fit>Fit</button><button class="btn" data-in aria-label="Zoom in">+</button><button class="btn" data-out aria-label="Zoom out">−</button><button class="btn" data-rotate>Rotate</button><button class="btn" data-crop>Crop</button><button class="btn primary" data-save>Save copy</button><span data-info></span></div><div class="image-stage"><img alt="" draggable="false" hidden><div class="crop-selection" hidden></div><p data-empty>Open an image to view or edit.</p></div>`;
    container.append(el);
    const stage = el.querySelector(".image-stage"),
      img = el.querySelector("img"),
      box = el.querySelector(".crop-selection");
    function transform() {
      img.style.transform = `translate(${x}px,${y}px) rotate(${rotation}deg) scale(${zoom})`;
    }
    function fit() {
      zoom = 1;
      rotation = 0;
      x = y = 0;
      transform();
      selection = null;
      box.hidden = true;
    }
    function open(p) {
      const node = fs.read(p);
      if (!node) return;
      path = p;
      img.src = node.content;
      img.alt = basename(p);
      img.hidden = false;
      el.querySelector("[data-empty]").hidden = true;
      fit();
      ctx.setTitle("Images · " + basename(p));
      ctx.checkpoint?.();
      img.onload = () => {
        if (!disposed)
          el.querySelector("[data-info]").textContent =
            `${img.naturalWidth} × ${img.naturalHeight}`;
      };
    }
    function output() {
      if (!path) return;
      const canvas = document.createElement("canvas"),
        c = canvas.getContext("2d");
      if (selection && crop) {
        const r = img.getBoundingClientRect();
        const scaleX = img.naturalWidth / r.width,
          scaleY = img.naturalHeight / r.height;
        canvas.width = Math.round(selection.w * scaleX);
        canvas.height = Math.round(selection.h * scaleY);
        if (canvas.width < 1 || canvas.height < 1) return;
        const sr = stage.getBoundingClientRect();
        c.drawImage(
          img,
          (selection.x + sr.left - r.left) * scaleX,
          (selection.y + sr.top - r.top) * scaleY,
          canvas.width,
          canvas.height,
          0,
          0,
          canvas.width,
          canvas.height,
        );
      } else {
        const swap = rotation % 180 !== 0;
        canvas.width = swap ? img.naturalHeight : img.naturalWidth;
        canvas.height = swap ? img.naturalWidth : img.naturalHeight;
        c.translate(canvas.width / 2, canvas.height / 2);
        c.rotate((rotation * Math.PI) / 180);
        c.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      }
      const p = fs.unique(
        "/Pictures/" + basename(path).replace(/\.[^.]+$/, "") + " edited.png",
      );
      fs.touch(p, canvas.toDataURL("image/png"), {
        binary: true,
        mime: "image/png",
      });
      bus.emit("notify", { title: "Image saved", body: p });
      open(p);
    }
    el.querySelector("[data-open]").onclick = async () => {
      const p = await fileDialog({
        accept: (p) => fs.read(p)?.mime?.startsWith("image/"),
      });
      if (p) open(p);
    };
    el.querySelector("input").onchange = async (e) => {
      if (e.target.files[0])
        open(await fs.importFile(e.target.files[0], "/Pictures"));
    };
    el.querySelector("[data-fit]").onclick = fit;
    el.querySelector("[data-in]").onclick = () => {
      zoom = Math.min(8, zoom * 1.2);
      transform();
    };
    el.querySelector("[data-out]").onclick = () => {
      zoom = Math.max(0.1, zoom / 1.2);
      transform();
    };
    el.querySelector("[data-rotate]").onclick = () => {
      crop = false;
      selection = null;
      box.hidden = true;
      rotation = (rotation + 90) % 360;
      transform();
    };
    el.querySelector("[data-crop]").onclick = () => {
      fit();
      crop = !crop;
      el.querySelector("[data-crop]").setAttribute("aria-pressed", crop);
    };
    el.querySelector("[data-save]").onclick = output;
    stage.onwheel = (e) => {
      e.preventDefault();
      zoom = Math.max(0.1, Math.min(8, zoom * (e.deltaY < 0 ? 1.1 : 0.9)));
      transform();
    };
    stage.onpointerdown = (e) => {
      if (!path) return;
      const r = stage.getBoundingClientRect();
      start = { x: e.clientX, y: e.clientY, tx: x, ty: y };
      stage.setPointerCapture(e.pointerId);
      stage.onpointermove = (event) => {
        if (!start) return;
        if (crop) {
          const ir = img.getBoundingClientRect();
          const left = Math.max(ir.left, Math.min(start.x, event.clientX)),
            top = Math.max(ir.top, Math.min(start.y, event.clientY)),
            right = Math.min(ir.right, Math.max(start.x, event.clientX)),
            bottom = Math.min(ir.bottom, Math.max(start.y, event.clientY));
          selection = {
            x: left - r.left,
            y: top - r.top,
            w: Math.max(0, right - left),
            h: Math.max(0, bottom - top),
          };
          box.hidden = false;
          Object.assign(box.style, {
            left: selection.x + "px",
            top: selection.y + "px",
            width: selection.w + "px",
            height: selection.h + "px",
          });
        } else {
          x = start.tx + event.clientX - start.x;
          y = start.ty + event.clientY - start.y;
          transform();
        }
      };
    };
    stage.onpointerup = () => {
      start = null;
      stage.onpointermove = null;
    };
    if (ctx.opts.openFsFile) open(ctx.opts.openFsFile);
    return {
      onOpen(opts) {
        if (opts.openFsFile) open(opts.openFsFile);
      },
      session: () => ({ openFsFile: path }),
      unmount() {
        disposed = true;
        el.remove();
      },
    };
  },
};
