import { store } from "../core/state.js";
import { bus } from "../core/event-bus.js";
export default {
  id: "game-2048",
  name: "2048",
  icon: "🎲",
  category: "Games",
  defaultSize: { w: 440, h: 540 },
  keywords: ["2048", "puzzle", "game"],
  mount(container) {
    const el = document.createElement("div");
    el.className = "app game-app";
    el.innerHTML = `
      <div class="app-toolbar">
        <button class="btn primary" id="g-new">New game</button>
        <span class="ce-spacer"></span>
        <span class="game-stat">Score: <strong id="g-score">0</strong></span>
        <span class="game-stat">Best: <strong id="g-best">0</strong></span>
      </div>
      <div class="g2048-board" id="board" tabindex="0"></div>
      <div class="game-help">Arrow keys / WASD or swipe.</div>
    `;
    container.appendChild(el);

    const board = el.querySelector("#board");
    const $score = el.querySelector("#g-score"),
      $best = el.querySelector("#g-best");
    let grid,
      score = 0,
      won = false;
    const bestKey = "novaos:2048-best";
    let best =
      store.get().gameScores?.["game-2048"] ||
      +(localStorage.getItem(bestKey) || 0);
    $best.textContent = best;

    const empty = () => Array.from({ length: 4 }, () => [0, 0, 0, 0]);
    const addRandom = () => {
      const empties = [];
      for (let r = 0; r < 4; r++)
        for (let c = 0; c < 4; c++) if (!grid[r][c]) empties.push([r, c]);
      if (!empties.length) return;
      const [r, c] = empties[Math.floor(Math.random() * empties.length)];
      grid[r][c] = Math.random() < 0.9 ? 2 : 4;
    };
    const newGame = () => {
      grid = empty();
      score = 0;
      won = false;
      addRandom();
      addRandom();
      $score.textContent = 0;
      render();
    };
    const tileColor = (v) => {
      const map = {
        2: "#eee4da",
        4: "#ede0c8",
        8: "#f2b179",
        16: "#f59563",
        32: "#f67c5f",
        64: "#f65e3b",
        128: "#edcf72",
        256: "#edcc61",
        512: "#edc850",
        1024: "#edc53f",
        2048: "#edc22e",
      };
      return map[v] || "#3c3a32";
    };
    const render = () => {
      store.update((s) => (s.game2048 = { grid, score, won }));
      board.innerHTML = "";
      for (let r = 0; r < 4; r++)
        for (let c = 0; c < 4; c++) {
          const v = grid[r][c];
          const t = document.createElement("div");
          t.className = "g2048-tile";
          t.style.background = v ? tileColor(v) : "rgba(255,255,255,0.05)";
          t.style.color = v >= 8 ? "#fff" : "#3c3a32";
          t.style.fontSize = v >= 1024 ? "16px" : v >= 128 ? "20px" : "24px";
          t.textContent = v || "";
          board.appendChild(t);
        }
    };
    const slide = (row) => {
      const f = row.filter((x) => x);
      for (let i = 0; i < f.length - 1; i++) {
        if (f[i] === f[i + 1]) {
          f[i] *= 2;
          score += f[i];
          f[i + 1] = 0;
        }
      }
      const compact = f.filter((x) => x);
      while (compact.length < 4) compact.push(0);
      return compact;
    };
    const transpose = (m) => m[0].map((_, c) => m.map((r) => r[c]));
    const reverseRows = (m) => m.map((r) => r.slice().reverse());

    const move = (dir) => {
      const before = JSON.stringify(grid);
      if (dir === "left") grid = grid.map(slide);
      else if (dir === "right")
        grid = reverseRows(reverseRows(grid).map(slide));
      else if (dir === "up") grid = transpose(transpose(grid).map(slide));
      else if (dir === "down")
        grid = transpose(reverseRows(reverseRows(transpose(grid)).map(slide)));
      if (JSON.stringify(grid) === before) return;
      addRandom();
      $score.textContent = score;
      if (score > best) {
        best = score;
        store.update((s) => {
          s.gameScores ??= {};
          s.gameScores["game-2048"] = best;
        });
        $best.textContent = best;
      }
      if (!won && grid.some((r) => r.includes(2048))) {
        won = true;
        bus.emit("notify", {
          title: "2048 reached",
          body: "Keep going for a higher score.",
        });
      }
      render();
      if (!canMove())
        bus.emit("notify", {
          title: "Game over",
          body: "Start a new game to try again.",
        });
    };
    const canMove = () => {
      for (let r = 0; r < 4; r++)
        for (let c = 0; c < 4; c++) {
          if (!grid[r][c]) return true;
          if (c < 3 && grid[r][c] === grid[r][c + 1]) return true;
          if (r < 3 && grid[r][c] === grid[r + 1][c]) return true;
        }
      return false;
    };

    board.addEventListener("keydown", (e) => {
      const k = e.key.toLowerCase();
      if (k === "arrowleft" || k === "a") move("left");
      else if (k === "arrowright" || k === "d") move("right");
      else if (k === "arrowup" || k === "w") move("up");
      else if (k === "arrowdown" || k === "s") move("down");
      else return;
      e.preventDefault();
    });
    board.style.touchAction = "none";
    // swipe
    let sx, sy;
    board.addEventListener(
      "touchstart",
      (e) => {
        const t = e.touches[0];
        sx = t.clientX;
        sy = t.clientY;
      },
      { passive: true },
    );
    board.addEventListener("touchend", (e) => {
      const t = e.changedTouches[0];
      const dx = t.clientX - sx,
        dy = t.clientY - sy;
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 24) move("right");
        else if (dx < -24) move("left");
      } else {
        if (dy > 24) move("down");
        else if (dy < -24) move("up");
      }
    });

    el.querySelector("#g-new").addEventListener("click", newGame);
    const saved = store.get().game2048;
    if (saved?.grid?.length === 4) {
      grid = saved.grid;
      score = saved.score;
      won = saved.won;
      $score.textContent = score;
      render();
    } else newGame();
    setTimeout(() => board.focus(), 50);
    return {
      unmount() {
        el.remove();
      },
    };
  },
};
