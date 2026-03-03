(() => {
  const COLS = 10, ROWS = 20, BLOCK = 30;
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const ui = {
    score: document.getElementById('score'),
    lines: document.getElementById('lines'),
    level: document.getElementById('level'),
    status: document.getElementById('status'),
    toggle: document.getElementById('toggle'),
    restart: document.getElementById('restart')
  };

  const COLORS = {
    I: '#39d0ff', O: '#ffd34a', T: '#b883ff', S: '#63ff7b',
    Z: '#ff5b7d', J: '#4b7bff', L: '#ff9c45', G: '#95a4c7'
  };

  const SHAPES = {
    I: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
    O: [[1,1],[1,1]],
    T: [[0,1,0],[1,1,1],[0,0,0]],
    S: [[0,1,1],[1,1,0],[0,0,0]],
    Z: [[1,1,0],[0,1,1],[0,0,0]],
    J: [[1,0,0],[1,1,1],[0,0,0]],
    L: [[0,0,1],[1,1,1],[0,0,0]]
  };
  const PIECES = Object.keys(SHAPES);

  let board, current, next, score, lines, level;
  let dropCounter = 0, lastTime = 0;
  let paused = false, gameOver = false;

  const makeBoard = () => Array.from({length: ROWS}, () => Array(COLS).fill(null));
  const clone = (m) => m.map(r => r.slice());

  function rotateMatrix(matrix, dir) {
    const m = clone(matrix);
    for (let y = 0; y < m.length; y++) {
      for (let x = 0; x < y; x++) [m[x][y], m[y][x]] = [m[y][x], m[x][y]];
    }
    if (dir > 0) m.forEach(r => r.reverse());
    else m.reverse();
    return m;
  }

  function randPiece() {
    const type = PIECES[(Math.random() * PIECES.length) | 0];
    return { type, matrix: clone(SHAPES[type]), x: 0, y: 0 };
  }

  function collides(b, p) {
    const { matrix, x: px, y: py } = p;
    for (let y = 0; y < matrix.length; y++) {
      for (let x = 0; x < matrix[y].length; x++) {
        if (!matrix[y][x]) continue;
        const bx = px + x, by = py + y;
        if (bx < 0 || bx >= COLS || by >= ROWS) return true;
        if (by >= 0 && b[by][bx]) return true;
      }
    }
    return false;
  }

  function merge(b, p) {
    p.matrix.forEach((row, y) => row.forEach((v, x) => {
      if (!v) return;
      const by = p.y + y, bx = p.x + x;
      if (by >= 0) b[by][bx] = p.type;
    }));
  }

  function clearLines() {
    let cleared = 0;
    outer: for (let y = ROWS - 1; y >= 0; y--) {
      for (let x = 0; x < COLS; x++) if (!board[y][x]) continue outer;
      board.splice(y, 1);
      board.unshift(Array(COLS).fill(null));
      cleared++; y++;
    }
    if (cleared) {
      lines += cleared;
      const table = [0, 100, 300, 500, 800];
      score += table[cleared] * level;
      level = 1 + Math.floor(lines / 10);
      updateUI();
    }
  }

  function dropIntervalMs() {
    return Math.max(100, 800 - (level - 1) * 60);
  }

  function spawn() {
    current = next || randPiece();
    next = randPiece();
    current.y = 0;
    current.x = ((COLS / 2) | 0) - ((current.matrix[0].length / 2) | 0);

    if (collides(board, current)) {
      gameOver = true;
      ui.status.textContent = "Game Over";
      ui.toggle.textContent = "Resume";
    }
  }

  function softDrop() {
    current.y++;
    if (collides(board, current)) {
      current.y--;
      merge(board, current);
      clearLines();
      spawn();
    } else {
      score += 1;
      updateUI();
    }
    dropCounter = 0;
  }

  function hardDrop() {
    let dist = 0;
    while (!collides(board, current)) { current.y++; dist++; }
    current.y--; dist--;
    score += Math.max(0, dist) * 2;
    merge(board, current);
    clearLines();
    spawn();
    dropCounter = 0;
    updateUI();
  }

  function move(dir) {
    current.x += dir;
    if (collides(board, current)) current.x -= dir;
  }

  function rotate(dir) {
    const old = current.matrix;
    current.matrix = rotateMatrix(current.matrix, dir);

    const kicks = [0, -1, 1, -2, 2];
    const ox = current.x;
    for (const k of kicks) {
      current.x = ox + k;
      if (!collides(board, current)) return;
    }
    current.x = ox;
    current.matrix = old;
  }

  function ghostPiece(p) {
    const g = { type: 'G', matrix: p.matrix, x: p.x, y: p.y };
    while (!collides(board, g)) g.y++;
    g.y--;
    return g;
  }

  function drawCell(x, y, type, alpha = 1) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = COLORS[type] || '#fff';
    ctx.fillRect(x * BLOCK, y * BLOCK, BLOCK - 1, BLOCK - 1);
    ctx.globalAlpha = 1;
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#050915';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++)
        if (board[y][x]) drawCell(x, y, board[y][x]);

    if (!gameOver) {
      const g = ghostPiece(current);
      g.matrix.forEach((row, y) => row.forEach((v, x) => {
        if (v) drawCell(g.x + x, g.y + y, 'G', 0.25);
      }));
    }

    current.matrix.forEach((row, y) => row.forEach((v, x) => {
      if (v) drawCell(current.x + x, current.y + y, current.type);
    }));

    if (paused && !gameOver) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#e6eefc';
      ctx.font = 'bold 24px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2);
    }

    if (gameOver) {
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#e6eefc';
      ctx.font = 'bold 24px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 10);
      ctx.font = '14px system-ui';
      ctx.fillText('Press Restart', canvas.width / 2, canvas.height / 2 + 18);
    }
  }

  function updateUI() {
    ui.score.textContent = score;
    ui.lines.textContent = lines;
    ui.level.textContent = level;
  }

  function togglePause() {
    if (gameOver) return;
    paused = !paused;
    ui.status.textContent = paused ? "Paused" : "Running";
    ui.toggle.textContent = paused ? "Resume" : "Pause";
  }

  function reset() {
    board = makeBoard();
    score = 0; lines = 0; level = 1;
    paused = false; gameOver = false;
    ui.status.textContent = "Running";
    ui.toggle.textContent = "Pause";
    updateUI();
    next = randPiece();
    spawn();
    lastTime = 0;
    dropCounter = 0;
  }

  function loop(time = 0) {
    const delta = time - lastTime;
    lastTime = time;

    if (!paused && !gameOver) {
      dropCounter += delta;
      if (dropCounter > dropIntervalMs()) softDrop();
    }
    draw();
    requestAnimationFrame(loop);
  }

  //  --- Laptop Buttons ---
  document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'p') return togglePause();
    if (paused || gameOver) return;

    switch (e.key) {
      case 'ArrowLeft': move(-1); break;
      case 'ArrowRight': move(1); break;
      case 'ArrowDown': softDrop(); break;
      case ' ': e.preventDefault(); hardDrop(); break;
      case 'z': case 'Z': rotate(-1); break;
      case 'x': case 'X': rotate(1); break;
    }
  });

    // --- Mobile buttons ---
  document.querySelectorAll('.mbtn').forEach(btn => {
    const action = btn.dataset.action;

    const fire = () => {
      if (paused || gameOver) return;
      if (action === 'left') move(-1);
      if (action === 'right') move(1);
      if (action === 'down') softDrop();
      if (action === 'drop') hardDrop();
      if (action === 'rotate') rotate(1);
    };

    // Fast response on mobile
    btn.addEventListener('touchstart', (e) => { e.preventDefault(); fire(); }, { passive:false });
    btn.addEventListener('click', fire);
  });

  ui.toggle.addEventListener('click', togglePause);
  ui.restart.addEventListener('click', reset);

  reset();
  requestAnimationFrame(loop);
})();