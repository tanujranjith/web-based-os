export default {
  id: "browser",
  name: "Browser",
  icon: "🌐",
  category: "Internet",
  defaultSize: { w: 900, h: 600 },
  keywords: ["web", "internet", "tab"],
  mount(container) {
    const el = document.createElement("div");
    el.className = "app";
    el.innerHTML = `
      <div class="browser-tabs" id="tabs"></div>
      <div class="browser-bar">
        <button class="nav-btn" data-act="back" aria-label="Back">←</button>
        <button class="nav-btn" data-act="fwd" aria-label="Forward">→</button>
        <button class="nav-btn" data-act="reload" aria-label="Reload">⟳</button>
        <button class="nav-btn" data-act="home" aria-label="Home">⌂</button>
        <input class="url" id="url" placeholder="Enter a URL or search…" />
        <button class="nav-btn" data-act="go" aria-label="Go">↵</button>
      </div>
      <div class="browser-frame" id="frame"></div>
    `;
    container.appendChild(el);

    const $tabs = el.querySelector("#tabs");
    const $url = el.querySelector("#url");
    const $frame = el.querySelector("#frame");

    const QUICK = [
      { label: "DuckDuckGo", url: "https://duckduckgo.com/", desc: "Search the web (HTTPS, may block iframes)" },
      { label: "Wikipedia", url: "https://en.wikipedia.org/wiki/Operating_system", desc: "Read about operating systems" },
      { label: "MDN Web Docs", url: "https://developer.mozilla.org/", desc: "Web development reference" },
      { label: "Hacker News", url: "https://news.ycombinator.com/", desc: "Tech news" },
      { label: "Example.com", url: "https://example.com/", desc: "Test page" },
    ];

    const tabs = [];
    let activeIdx = -1;

    const startPage = () => `
      <div class="browser-start">
        <h2>NovaBrowse</h2>
        <p>A lightweight in-OS browser. Many sites refuse to load in iframes (X-Frame-Options/CSP). Use the search bar or quick links below.</p>
        <div class="quick">
          ${QUICK.map((q) => `<a data-go="${escape(q.url)}"><strong>${escape(q.label)}</strong><small>${escape(q.desc)}</small></a>`).join("")}
        </div>
      </div>
    `;

    const newTab = (url = "") => {
      const id = Math.random().toString(36).slice(2, 8);
      tabs.push({ id, title: url ? "Loading…" : "New tab", url, history: url ? [url] : [], hIdx: url ? 0 : -1 });
      activeIdx = tabs.length - 1;
      renderTabs();
      if (url) navigate(url);
      else showStart();
      $url.focus();
    };

    const closeTab = (idx) => {
      tabs.splice(idx, 1);
      if (!tabs.length) { newTab(); return; }
      if (activeIdx >= tabs.length) activeIdx = tabs.length - 1;
      renderTabs();
      restore();
    };

    const renderTabs = () => {
      $tabs.innerHTML = tabs.map((t, i) => `
        <div class="browser-tab ${i === activeIdx ? "active" : ""}" data-i="${i}">
          <span class="title">${escape(t.title || t.url || "New tab")}</span>
          <button class="x" data-x="${i}" aria-label="Close tab">×</button>
        </div>
      `).join("") + `<button class="browser-tab-new" id="new-tab" aria-label="New tab">＋</button>`;

      $tabs.querySelectorAll(".browser-tab").forEach((tab) => {
        tab.addEventListener("click", (e) => {
          if (e.target.closest(".x")) {
            const i = +e.target.dataset.x;
            closeTab(i);
            return;
          }
          activeIdx = +tab.dataset.i;
          renderTabs();
          restore();
        });
      });
      $tabs.querySelector("#new-tab").addEventListener("click", () => newTab());
    };

    const restore = () => {
      const t = tabs[activeIdx];
      if (!t) return;
      if (t.url) {
        $url.value = t.url;
        renderFrame(t.url);
      } else {
        $url.value = "";
        showStart();
      }
    };

    const showStart = () => {
      $frame.innerHTML = startPage();
      $frame.querySelectorAll("[data-go]").forEach((a) => {
        a.addEventListener("click", () => navigate(a.dataset.go));
      });
    };

    const renderFrame = (url) => {
      $frame.innerHTML = `<iframe src="${escape(url)}" referrerpolicy="no-referrer" sandbox="allow-same-origin allow-scripts allow-popups allow-forms"></iframe>
        <div class="browser-start" id="iframe-error" style="display:none">
          <h2>Couldn't load</h2>
          <p>This site refused to load in a frame (X-Frame-Options/CSP). Try one of the quick links.</p>
          <div class="quick">${QUICK.map((q) => `<a data-go="${escape(q.url)}"><strong>${escape(q.label)}</strong><small>${escape(q.desc)}</small></a>`).join("")}</div>
        </div>`;
      const iframe = $frame.querySelector("iframe");
      const fallback = $frame.querySelector("#iframe-error");
      let loaded = false;
      iframe.addEventListener("load", () => {
        loaded = true;
        try {
          const t = iframe.contentDocument?.title;
          if (t) updateTitle(t);
        } catch { /* cross-origin */ }
      });
      setTimeout(() => {
        if (!loaded) {
          iframe.style.display = "none";
          fallback.style.display = "";
          fallback.querySelectorAll("[data-go]").forEach((a) => a.addEventListener("click", () => navigate(a.dataset.go)));
        }
      }, 4000);
    };

    const updateTitle = (title) => {
      const t = tabs[activeIdx]; if (!t) return;
      t.title = title;
      renderTabs();
    };

    const navigate = (raw) => {
      let url = raw.trim();
      if (!url) return;
      if (!/^https?:\/\//i.test(url)) {
        if (/\s/.test(url) || !/\.[a-z]{2,}/i.test(url)) {
          url = "https://duckduckgo.com/?q=" + encodeURIComponent(url);
        } else {
          url = "https://" + url;
        }
      }
      const t = tabs[activeIdx];
      if (!t) return;
      t.url = url;
      t.history = [...t.history.slice(0, t.hIdx + 1), url];
      t.hIdx = t.history.length - 1;
      t.title = hostnameOf(url);
      $url.value = url;
      renderTabs();
      renderFrame(url);
    };

    el.querySelector('[data-act="go"]').addEventListener("click", () => navigate($url.value));
    el.querySelector('[data-act="reload"]').addEventListener("click", () => {
      const t = tabs[activeIdx]; if (t?.url) renderFrame(t.url);
    });
    el.querySelector('[data-act="home"]').addEventListener("click", () => {
      const t = tabs[activeIdx]; if (!t) return;
      t.url = ""; t.history = []; t.hIdx = -1; t.title = "New tab";
      renderTabs(); showStart(); $url.value = "";
    });
    el.querySelector('[data-act="back"]').addEventListener("click", () => {
      const t = tabs[activeIdx]; if (!t || t.hIdx <= 0) return;
      t.hIdx--; t.url = t.history[t.hIdx]; $url.value = t.url; renderFrame(t.url);
    });
    el.querySelector('[data-act="fwd"]').addEventListener("click", () => {
      const t = tabs[activeIdx]; if (!t || t.hIdx >= t.history.length - 1) return;
      t.hIdx++; t.url = t.history[t.hIdx]; $url.value = t.url; renderFrame(t.url);
    });
    $url.addEventListener("keydown", (e) => { if (e.key === "Enter") navigate($url.value); });

    newTab();

    return {
      unmount() { el.remove(); },
    };
  },
};

function hostnameOf(u) { try { return new URL(u).hostname; } catch { return u; } }
function escape(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
