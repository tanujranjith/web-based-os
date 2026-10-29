import { store } from "../core/state.js";
import { bus } from "../core/event-bus.js";
export default {
  id: "minesweeper",
  name: "Minesweeper",
  icon: "💣",
  category: "Games",
  defaultSize: { w: 540, h: 600 },
  keywords: ["mines", "game", "puzzle"],
  mount(container) {
    const el = document.createElement("div");
    el.className = "app game-app";
    el.innerHTML = `
      <div class="app-toolbar">
        <button class="btn primary" id="ms-new">New game</button>
        <select class="select" id="ms-diff" style="width:130px">
          <option value="easy">Easy (9×9 / 10)</option>
          <option value="medium" selected>Medium (12×12 / 24)</option>
          <option value="hard">Hard (16×16 / 50)</option>
        </select>
        <span class="ce-spacer"></span>
        <span class="game-stat">💣 <strong id="ms-mines">0</strong></span>
        <span class="game-stat">⏱ <strong id="ms-time">0</strong>s</span>
      </div>
      <div class="ms-board" id="board"></div>
      <div class="game-help">Click to reveal · Right click to flag</div><div class="row" style="justify-content:center"><button class="btn" id="ms-flag">Flag mode: off</button><small id="ms-best"></small></div>
    `;
    container.appendChild(el);
    const $board = el.querySelector("#board");
    const $mines = el.querySelector("#ms-mines");
    const $time = el.querySelector("#ms-time");
    let flagMode = false;
    el.querySelector("#ms-flag").onclick = (e) => {
      flagMode = !flagMode;
      e.target.textContent = "Flag mode: " + (flagMode ? "on" : "off");
    };
    let W = 12,
      H = 12,
      M = 24;
    let cells, flagsLeft, started, lost, won, timer, seconds;

    const presets = {
      easy: [9, 9, 10],
      medium: [12, 12, 24],
      hard: [16, 16, 50],
    };

    const idx = (r, c) => r * W + c;
    const inside = (r, c) => r >= 0 && c >= 0 && r < H && c < W;

    const newGame = () => {
      [W, H, M] = presets[el.querySelector("#ms-diff").value];
      cells = Array.from({ length: W * H }, () => ({
        mine: false,
        open: false,
        flag: false,
        n: 0,
      }));
      flagsLeft = M;
      started = false;
      lost = false;
      won = false;
      seconds = 0;
      $time.textContent = "0";
      $mines.textContent = M;
      if (timer) clearInterval(timer);
      timer = null;
      $board.style.gridTemplateColumns = `repeat(${W}, 1fr)`;
      const best = store.get().mineTimes?.[el.querySelector("#ms-diff").value];
      el.querySelector("#ms-best").textContent = best ? `Best: ${best}s` : "";
      render();
    };

    const placeMines = (safeR, safeC) => {
      let placed = 0;
      while (placed < M) {
        const r = Math.floor(Math.random() * H);
        const c = Math.floor(Math.random() * W);
        if (Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1) continue;
        const i = idx(r, c);
        if (cells[i].mine) continue;
        cells[i].mine = true;
        placed++;
      }
      for (let r = 0; r < H; r++)
        for (let c = 0; c < W; c++) {
          if (cells[idx(r, c)].mine) continue;
          let n = 0;
          for (let dr = -1; dr <= 1; dr++)
            for (let dc = -1; dc <= 1; dc++) {
              if (!dr && !dc) continue;
              if (inside(r + dr, c + dc) && cells[idx(r + dr, c + dc)].mine)
                n++;
            }
          cells[idx(r, c)].n = n;
        }
    };

    const reveal = (r, c) => {
      if (!inside(r, c)) return;
      const i = idx(r, c);
      const cell = cells[i];
      if (cell.open || cell.flag) return;
      cell.open = true;
      if (cell.mine) {
        lost = true;
        return;
      }
      if (cell.n === 0) {
        for (let dr = -1; dr <= 1; dr++)
          for (let dc = -1; dc <= 1; dc++) {
            if (!dr && !dc) continue;
            reveal(r + dr, c + dc);
          }
      }
    };

    const checkWin = () => {
      const opened = cells.filter((c) => c.open && !c.mine).length;
      const safe = W * H - M;
      if (opened === safe) won = true;
    };

    const render = () => {
      $board.innerHTML = "";
      for (let r = 0; r < H; r++)
        for (let c = 0; c < W; c++) {
          const cell = cells[idx(r, c)];
          const b = document.createElement("button");
          b.className =
            "ms-cell" +
            (cell.open ? " open" : "") +
            (cell.flag ? " flag" : "") +
            (lost && cell.mine ? " mine" : "");
          b.dataset.r = r;
          b.dataset.c = c;
          if (cell.open && !cell.mine && cell.n > 0) {
            b.textContent = cell.n;
            b.dataset.n = cell.n;
          } else if (cell.open && cell.mine) b.textContent = "💣";
          else if (cell.flag) b.textContent = "🚩";
          b.setAttribute(
            "aria-label",
            `Row ${r + 1}, column ${c + 1}${cell.flag ? ", flagged" : ""}`,
          );
          b.addEventListener("click", () => onClick(r, c, flagMode));
          b.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            onClick(r, c, true);
          });
          $board.appendChild(b);
        }
    };

    const onClick = (r, c, flag) => {
      if (lost || won) return;
      const cell = cells[idx(r, c)];
      if (!started) {
        started = true;
        placeMines(r, c);
        timer = setInterval(() => {
          seconds++;
          $time.textContent = seconds;
        }, 1000);
      }
      if (flag) {
        if (cell.open) return;
        cell.flag = !cell.flag;
        flagsLeft += cell.flag ? -1 : 1;
        $mines.textContent = Math.max(0, flagsLeft);
      } else {
        reveal(r, c);
      }
      checkWin();
      if (lost || won) {
        clearInterval(timer);
        timer = null;
        for (const c of cells) c.open = true;
      }
      render();
      if (lost)
        bus.emit("notify", {
          title: "Mine found",
          body: "Start a new game to try again.",
        });
      if (won) {
        const difficulty = el.querySelector("#ms-diff").value;
        store.update((s) => {
          s.mineTimes ??= {};
          s.mineTimes[difficulty] = Math.min(
            seconds,
            s.mineTimes[difficulty] ?? Infinity,
          );
        });
        bus.emit("notify", {
          title: "Board cleared",
          body: `Finished in ${seconds} seconds.`,
        });
      }
    };

    el.querySelector("#ms-new").addEventListener("click", newGame);
    el.querySelector("#ms-diff").addEventListener("change", newGame);
    newGame();
    return {
      unmount() {
        if (timer) clearInterval(timer);
        el.remove();
      },
    };
  },
};
