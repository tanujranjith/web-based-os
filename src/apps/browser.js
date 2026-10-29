import { store } from "../core/state.js";
import { escape } from "../ui/icons.js";
export default {
  id: "browser",
  name: "Browser",
  category: "Internet",
  keywords: ["web", "bookmarks", "tabs"],
  defaultSize: { w: 1100, h: 720 },
  mount(container) {
    let tabs = structuredClone(
        store.get().browserTabs || [
          { id: crypto.randomUUID(), url: "", history: [], index: -1 },
        ],
      ),
      active = tabs[0]?.id,
      disposed = false,
      timeout;
    const el = document.createElement("div");
    el.className = "app browser-v4";
    el.innerHTML = `<div class="browser-tabs"></div><div class="browser-bar"><button class="nav-btn" data-back aria-label="Back">←</button><button class="nav-btn" data-forward aria-label="Forward">→</button><button class="nav-btn" data-home aria-label="Home">⌂</button><button class="nav-btn" data-reload aria-label="Reload">⟳</button><input class="url" aria-label="Address or search" placeholder="Search or enter address"><button class="nav-btn" data-star aria-label="Bookmark page">☆</button><button class="btn" data-external>Open externally ↗</button></div><div class="browser-frame"></div>`;
    container.append(el);
    const frame = el.querySelector(".browser-frame"),
      address = el.querySelector(".url");
    const current = () => tabs.find((t) => t.id === active);
    const persist = () =>
      store.update((s) => (s.browserTabs = structuredClone(tabs)));
    function navigation() {
      const t = current();
      address.value = t?.url || "";
      el.querySelector("[data-back]").disabled = !t || t.index <= 0;
      el.querySelector("[data-forward]").disabled =
        !t || t.index >= t.history.length - 1;
      el.querySelector("[data-external]").disabled = !t?.url;
      el.querySelector("[data-star]").textContent = (
        store.get().bookmarks || []
      ).some((b) => b.url === t?.url)
        ? "★"
        : "☆";
    }
    function renderTabs() {
      el.querySelector(".browser-tabs").innerHTML =
        tabs
          .map(
            (t) =>
              `<button class="browser-tab ${t.id === active ? "active" : ""}" data-tab="${t.id}">${escape(t.url ? new URL(t.url).hostname : "New tab")}<span data-close="${t.id}">×</span></button>`,
          )
          .join("") +
        '<button class="browser-tab-new" aria-label="New tab">+</button>';
      el.querySelectorAll("[data-tab]").forEach(
        (b) =>
          (b.onclick = (e) => {
            if (e.target.dataset.close) {
              tabs = tabs.filter((t) => t.id !== b.dataset.tab);
              if (!tabs.length)
                tabs = [
                  { id: crypto.randomUUID(), url: "", history: [], index: -1 },
                ];
              if (!tabs.some((t) => t.id === active)) active = tabs.at(-1).id;
            } else active = b.dataset.tab;
            persist();
            render();
          }),
      );
      el.querySelector(".browser-tab-new").onclick = () => {
        const t = { id: crypto.randomUUID(), url: "", history: [], index: -1 };
        tabs.push(t);
        active = t.id;
        persist();
        render();
        address.focus();
      };
    }
    function render() {
      clearTimeout(timeout);
      renderTabs();
      navigation();
      const t = current();
      frame.replaceChildren();
      if (!t?.url) {
        const home = document.createElement("div");
        home.className = "browser-start";
        home.innerHTML = `<small>NOVABROWSE</small><h1>A window to the web.</h1><p>Browse compatible websites here, or open any page in your browser.</p><h3>Bookmarks</h3><div class="quick">${(store.get().bookmarks || [{ url: "https://example.com", title: "Example" }]).map((b) => `<button class="btn" data-url="${escape(b.url)}">${escape(b.title)}</button>`).join("")}</div><h3>Recent history</h3><div class="browser-history">${(
          store.get().browserHistory || []
        )
          .slice(0, 12)
          .map(
            (b) =>
              `<button data-url="${escape(b.url)}">${escape(b.url)}</button>`,
          )
          .join(
            "",
          )}</div><button class="btn" data-clear>Clear history</button>`;
        frame.append(home);
        home
          .querySelectorAll("[data-url]")
          .forEach((b) => (b.onclick = () => navigate(b.dataset.url)));
        home.querySelector("[data-clear]").onclick = () => {
          store.update((s) => (s.browserHistory = []));
          render();
        };
        return;
      }
      const iframe = document.createElement("iframe");
      iframe.title = "Web page";
      iframe.referrerPolicy = "no-referrer";
      iframe.setAttribute("sandbox", "allow-scripts allow-forms allow-popups");
      iframe.src = t.url;
      frame.append(iframe);
      const notice = document.createElement("div");
      notice.className = "browser-embed-notice";
      notice.innerHTML =
        '<span>Some sites block embedded browsing.</span><button class="btn">Open this page externally ↗</button>';
      notice.querySelector("button").onclick = external;
      frame.append(notice);
      timeout = setTimeout(() => {
        if (!disposed) notice.classList.add("expanded");
      }, 3500);
    }
    function navigate(raw) {
      let url;
      try {
        const text = raw.trim();
        url = new URL(
          /^https?:\/\//i.test(text)
            ? text
            : /^[\w.-]+\.[a-z]{2,}([/:?#].*)?$/i.test(text)
              ? "https://" + text
              : "https://duckduckgo.com/?q=" + encodeURIComponent(text),
        );
        if (!["https:", "http:"].includes(url.protocol)) return;
      } catch {
        return;
      }
      const t = current();
      t.url = url.href;
      t.history = t.history.slice(0, t.index + 1);
      t.history.push(t.url);
      t.index = t.history.length - 1;
      store.update((s) => {
        s.browserHistory = [
          { url: t.url, at: Date.now() },
          ...(s.browserHistory || []).filter((x) => x.url !== t.url),
        ].slice(0, 100);
      });
      persist();
      render();
    }
    function external() {
      const url = current()?.url;
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    }
    address.onkeydown = (e) => {
      if (e.key === "Enter") navigate(address.value);
    };
    el.querySelector("[data-back]").onclick = () => {
      const t = current();
      if (t.index > 0) {
        t.url = t.history[--t.index];
        persist();
        render();
      }
    };
    el.querySelector("[data-forward]").onclick = () => {
      const t = current();
      if (t.index < t.history.length - 1) {
        t.url = t.history[++t.index];
        persist();
        render();
      }
    };
    el.querySelector("[data-home]").onclick = () => {
      current().url = "";
      persist();
      render();
    };
    el.querySelector("[data-reload]").onclick = render;
    el.querySelector("[data-external]").onclick = external;
    el.querySelector("[data-star]").onclick = () => {
      const t = current();
      if (!t.url) return;
      store.update((s) => {
        s.bookmarks ??= [];
        const found = s.bookmarks.find((b) => b.url === t.url);
        s.bookmarks = found
          ? s.bookmarks.filter((b) => b !== found)
          : [...s.bookmarks, { url: t.url, title: new URL(t.url).hostname }];
      });
      navigation();
    };
    render();
    return {
      unmount() {
        disposed = true;
        clearTimeout(timeout);
        el.remove();
      },
    };
  },
};
