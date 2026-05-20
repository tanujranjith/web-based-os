export default {
  id: "snake",
  name: "Snake",
  icon: "🐍",
  category: "Games",
  defaultSize: { w: 460, h: 520 },
  keywords: ["snake", "game", "arcade"],
  mount(container) {
    const el = document.createElement("div");
    el.className = "app game-app";
    el.innerHTML = `
      <div class="app-toolbar">
        <button class="btn primary" id="g-start">Start</button>
        <button class="btn ghost" id="g-pause">Pause</button>
        <span class="ce-spacer"></span>
        <span class="game-stat">Score: <strong id="g-score">0</strong></span>
        <span class="game-stat">Best: <strong id="g-best">0</strong></span>
      </div>
      <canvas id="snake" width="400" height="400" tabindex="0"></canvas>
      <div class="game-help">Use arrow keys or WASD.</div>
    `;
    container.appendChild(el);

    const canvas = el.querySelector("#snake");
    const ctx = canvas.getContext("2d");
    const SIZE = 20, CELLS = canvas.width / SIZE;
    let snake = [{ x: 8, y: 10 }, { x: 7, y: 10 }, { x: 6, y: 10 }];
    let dir = { x: 1, y: 0 }, queued = null, food = spawnFood();
    let timer = null, score = 0;
    const bestKey = "novaos:snake-best";
    let best = +(localStorage.getItem(bestKey) || 0);
    el.querySelector("#g-best").textContent = best;

    function spawnFood() {
      while (true) {
        const f = { x: Math.floor(Math.random() * CELLS), y: Math.floor(Math.random() * CELLS) };
        if (!snake.some((s) => s.x === f.x && s.y === f.y)) return f;
      }
    }

    function draw() {
      ctx.fillStyle = "#0a0c12";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // food
      ctx.fillStyle = "#ff5c8a";
      ctx.beginPath();
      ctx.arc(food.x * SIZE + SIZE / 2, food.y * SIZE + SIZE / 2, SIZE / 2 - 2, 0, Math.PI * 2);
      ctx.fill();
      // snake
      snake.forEach((s, i) => {
        ctx.fillStyle = i === 0 ? "var(--accent)" : "#6b8df5";
        ctx.fillStyle = i === 0 ? "#7aa8ff" : "#5b8def";
        ctx.fillRect(s.x * SIZE + 1, s.y * SIZE + 1, SIZE - 2, SIZE - 2);
      });
    }

    function step() {
      if (queued) { dir = queued; queued = null; }
      const head = { x: (snake[0].x + dir.x + CELLS) % CELLS, y: (snake[0].y + dir.y + CELLS) % CELLS };
      if (snake.some((s) => s.x === head.x && s.y === head.y)) return gameOver();
      snake.unshift(head);
      if (head.x === food.x && head.y === food.y) { score++; el.querySelector("#g-score").textContent = score; food = spawnFood(); }
      else snake.pop();
      draw();
    }

    function gameOver() {
      clearInterval(timer); timer = null;
      if (score > best) { best = score; localStorage.setItem(bestKey, best); el.querySelector("#g-best").textContent = best; }
      ctx.fillStyle = "rgba(0,0,0,0.65)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#fff"; ctx.font = "bold 22px system-ui"; ctx.textAlign = "center";
      ctx.fillText("Game Over", canvas.width / 2, canvas.height / 2 - 8);
      ctx.font = "14px system-ui";
      ctx.fillText(`Score: ${score}`, canvas.width / 2, canvas.height / 2 + 18);
    }

    function start() {
      snake = [{ x: 8, y: 10 }, { x: 7, y: 10 }, { x: 6, y: 10 }];
      dir = { x: 1, y: 0 }; queued = null;
      food = spawnFood();
      score = 0; el.querySelector("#g-score").textContent = 0;
      if (timer) clearInterval(timer);
      timer = setInterval(step, 100);
      canvas.focus();
    }
    function pause() {
      if (timer) { clearInterval(timer); timer = null; }
      else { timer = setInterval(step, 100); }
    }

    canvas.addEventListener("keydown", (e) => {
      const k = e.key.toLowerCase();
      if ((k === "arrowup" || k === "w") && dir.y === 0) queued = { x: 0, y: -1 };
      else if ((k === "arrowdown" || k === "s") && dir.y === 0) queued = { x: 0, y: 1 };
      else if ((k === "arrowleft" || k === "a") && dir.x === 0) queued = { x: -1, y: 0 };
      else if ((k === "arrowright" || k === "d") && dir.x === 0) queued = { x: 1, y: 0 };
      else return;
      e.preventDefault();
    });

    el.querySelector("#g-start").addEventListener("click", start);
    el.querySelector("#g-pause").addEventListener("click", pause);
    draw();
    setTimeout(() => canvas.focus(), 100);

    return { unmount() { if (timer) clearInterval(timer); el.remove(); } };
  },
};
