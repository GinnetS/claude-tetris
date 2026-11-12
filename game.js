'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

// Retro skin palette (the original flat colors)
const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#b71c1c', // J - blood red (darker than Z so they stay distinguishable)
  '#ffb74d', // L - orange
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
];

const LINE_SCORES = [0, 100, 300, 500, 800];
const MAX_START_LEVEL = 10; // highest selectable start level (level 11 hits the 100 ms speed floor)
const START_LEVEL_KEY = 'tetris.startLevel';

// High score table (persisted in localStorage)
const RECORDS_KEY = 'tetris.records';
const PLAYER_KEY = 'tetris.playerName';
const MAX_RECORDS = 5;
const NAME_MAX_LENGTH = 12;

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggle = document.getElementById('theme-toggle');
const themeText = document.getElementById('theme-text');
const pauseMenu = document.getElementById('pause-menu');
const resumeBtn = document.getElementById('resume-btn');
const menuRestartBtn = document.getElementById('menu-restart-btn');
const controlsBtn = document.getElementById('controls-btn');
const pauseControls = document.getElementById('pause-controls');
const startLevelEl = document.getElementById('start-level');
const levelDownBtn = document.getElementById('level-down');
const levelUpBtn = document.getElementById('level-up');
const overlayStats = document.getElementById('overlay-stats');
const nameForm = document.getElementById('name-form');
const nameLabel = document.getElementById('name-label');
const nameInput = document.getElementById('player-name');
const recordsSection = document.getElementById('records');
const recordsBody = document.getElementById('records-body');
const recordsStats = document.getElementById('records-stats');
const resetRecordsBtn = document.getElementById('reset-records');
const skinSelect = document.getElementById('skin-select');

// Canvas colors per theme (canvas does not inherit CSS variables)
const THEMES = {
  dark:  { grid: '#22222e', highlight: 'rgba(255,255,255,0.12)' },
  light: { grid: '#e1e3ee', highlight: 'rgba(255,255,255,0.35)' },
};
let theme = 'dark';

// Path a rounded rectangle with arcTo (works without ctx.roundRect)
function roundedRectPath(context, x, y, w, h, r) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

// 6×6 texture stamped over every pixel-art block:
// L = light edge, D = dark edge, x = dither speck, . = base color
const PIXEL_PATTERN = [
  'LLLLLD',
  'L.x..D',
  'L...xD',
  'Lx...D',
  'L..x.D',
  'DDDDDD',
];
const PIXEL_SHADES = {
  L: 'rgba(255,255,255,0.45)',
  D: 'rgba(0,0,0,0.35)',
  x: 'rgba(0,0,0,0.15)',
};

// Visual skins. Each one supplies a palette, an optional fixed canvas
// background / grid color (otherwise the light/dark theme decides), and the
// function that paints one cell at pixel position (px, py).
const SKINS = {
  retro: {
    label: 'Retro',
    colors: COLORS,
    drawCell(context, px, py, size, color) {
      context.fillStyle = color;
      context.fillRect(px + 1, py + 1, size - 2, size - 2);
      context.fillStyle = THEMES[theme].highlight;
      context.fillRect(px + 1, py + 1, size - 2, 4);
    },
  },
  neon: {
    label: 'Neón',
    colors: [null, '#00f5ff', '#fff700', '#bf00ff', '#39ff14', '#ff3131', '#ff006e', '#ff9f00'],
    background: '#000000',
    grid: '#10141c',
    drawCell(context, px, py, size, color, alpha) {
      context.shadowColor = color;
      context.shadowBlur = size * 0.5;
      // dim translucent core
      context.globalAlpha = alpha * 0.25;
      context.fillStyle = color;
      context.fillRect(px + 3, py + 3, size - 6, size - 6);
      // glowing tube outline
      context.globalAlpha = alpha;
      context.strokeStyle = color;
      context.lineWidth = 2;
      context.strokeRect(px + 4, py + 4, size - 8, size - 8);
      context.shadowBlur = 0;
    },
  },
  pastel: {
    label: 'Pastel',
    colors: [null, '#a0e7ef', '#fff1a8', '#d7b8f3', '#b9f2c4', '#ffb8b8', '#e48f9b', '#ffd3a5'],
    drawCell(context, px, py, size, color) {
      const r = size * 0.25;
      roundedRectPath(context, px + 2, py + 2, size - 4, size - 4, r);
      context.fillStyle = color;
      context.fill();
      context.strokeStyle = 'rgba(0,0,0,0.12)';
      context.lineWidth = 1;
      context.stroke();
      // soft glossy highlight
      roundedRectPath(context, px + 5, py + 4, size - 10, size * 0.3, r * 0.6);
      context.fillStyle = 'rgba(255,255,255,0.45)';
      context.fill();
    },
  },
  pixel: {
    label: 'Pixel art',
    colors: [null, '#3cbcfc', '#f8d878', '#b853f8', '#58d854', '#f83800', '#a80020', '#fc9838'],
    drawCell(context, px, py, size, color) {
      const n = PIXEL_PATTERN.length;
      const step = size / n;
      context.fillStyle = color;
      context.fillRect(px, py, size, size);
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          const shade = PIXEL_SHADES[PIXEL_PATTERN[r][c]];
          if (!shade) continue;
          context.fillStyle = shade;
          context.fillRect(Math.round(px + c * step), Math.round(py + r * step), Math.ceil(step), Math.ceil(step));
        }
      }
    },
  },
};
const SKIN_STORAGE_KEY = 'tetris-skin';
let skin = 'retro';

let board, current, next, score, lines, level, baseLevel, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

// Level chosen in the pause menu; applies from the next game on.
let startLevel = loadStartLevel();

// Keys pressed while the pause menu is open. They stay ignored by the game
// until released, so a key held while closing the menu can't move the piece.
const heldKeys = new Set();
// combo = consecutive locked pieces that cleared at least one line
let combo, maxCombo;
// Result of the last game waiting for a name before entering the table
let pendingRecord = null;
// Index of the row to highlight in the table (-1 = none)
let highlightIndex = -1;
// Which all-time stats the last game improved
let newBest = { combo: false, lines: false };

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  combo = cleared ? combo + 1 : 0;
  maxCombo = Math.max(maxCombo, combo);
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = baseLevel + Math.floor(lines / 10);
    dropInterval = dropIntervalFor(level);
    updateHUD();
  }
}

function dropIntervalFor(lvl) {
  return Math.max(100, 1000 - (lvl - 1) * 90);
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const s = SKINS[skin];
  const a = alpha ?? 1;
  context.globalAlpha = a;
  s.drawCell(context, x * size, y * size, size, s.colors[colorIndex], a);
  context.globalAlpha = 1;
}

// Clear a canvas and paint the skin's fixed background, if it has one
function clearCanvas(context, el) {
  context.clearRect(0, 0, el.width, el.height);
  const bg = SKINS[skin].background;
  if (bg) {
    context.fillStyle = bg;
    context.fillRect(0, 0, el.width, el.height);
  }
}

function drawGrid() {
  ctx.strokeStyle = SKINS[skin].grid || THEMES[theme].grid;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  clearCanvas(ctx, canvas);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  clearCanvas(nextCtx, nextCanvas);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function setTheme(name) {
  theme = name === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  themeToggle.setAttribute('aria-checked', String(theme === 'light'));
  themeText.textContent = theme === 'light' ? 'Modo oscuro' : 'Modo claro';
  // Redraw immediately so paused / game-over states update too
  if (current && next) { draw(); drawNext(); }
  else if (board) { clearCanvas(ctx, canvas); drawGrid(); }
}

// ---- High scores ----

function emptyRecords() {
  return { scores: [], bestCombo: 0, maxLines: 0 };
}

function loadRecords() {
  try {
    const data = JSON.parse(localStorage.getItem(RECORDS_KEY));
    if (!data || !Array.isArray(data.scores)) return emptyRecords();
    return {
      scores: data.scores
        .filter(e => e && Number.isFinite(e.score))
        .slice(0, MAX_RECORDS),
      bestCombo: Number(data.bestCombo) || 0,
      maxLines: Number(data.maxLines) || 0,
    };
  } catch {
    return emptyRecords();
  }
}

function saveRecords(records) {
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
  } catch {
    // Storage unavailable (private mode, quota): records only last this session
  }
}

function loadPlayerName() {
  try { return localStorage.getItem(PLAYER_KEY) || ''; } catch { return ''; }
}

function savePlayerName(name) {
  try { localStorage.setItem(PLAYER_KEY, name); } catch { /* ignore */ }
}

// Position (0-based) a score would take in the table, or -1 if it doesn't qualify.
// Ties go below existing entries, so matching the 5th place is not enough.
function recordRank(records, value) {
  if (value <= 0) return -1;
  const idx = records.scores.findIndex(e => value > e.score);
  if (idx !== -1) return idx;
  return records.scores.length < MAX_RECORDS ? records.scores.length : -1;
}

function cleanName(raw) {
  return raw.trim().slice(0, NAME_MAX_LENGTH) || 'Anónimo';
}

// Store the pending game in the table under the given name
function commitPendingRecord() {
  if (!pendingRecord) return;
  const name = cleanName(nameInput.value);
  const records = loadRecords();
  const rank = recordRank(records, pendingRecord.score);
  if (rank !== -1) {
    records.scores.splice(rank, 0, { ...pendingRecord, name });
    records.scores.length = Math.min(records.scores.length, MAX_RECORDS);
    saveRecords(records);
  }
  savePlayerName(name);
  highlightIndex = rank;
  pendingRecord = null;
  nameForm.classList.add('hidden');
  renderRecords();
}

function renderRecords() {
  const records = loadRecords();
  const rows = records.scores.map(e => ({ ...e, pending: false }));
  let highlight = highlightIndex;
  if (pendingRecord) {
    // Preview where the current game will land, using the name being typed
    highlight = recordRank(records, pendingRecord.score);
    rows.splice(highlight, 0, { ...pendingRecord, name: nameInput.value.trim() || '…', pending: true });
    rows.length = Math.min(rows.length, MAX_RECORDS);
  }

  recordsBody.replaceChildren();
  if (!rows.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 4;
    td.className = 'records-empty';
    td.textContent = 'Sin récords todavía';
    tr.append(td);
    recordsBody.append(tr);
  }
  rows.forEach((e, i) => {
    const tr = document.createElement('tr');
    if (i === highlight) tr.className = 'current';
    for (const text of [i + 1, e.name, e.score.toLocaleString(), e.lines ?? 0]) {
      const td = document.createElement('td');
      td.textContent = text;
      tr.append(td);
    }
    recordsBody.append(tr);
  });

  recordsStats.replaceChildren(
    statLine('Mejor combo', records.bestCombo, newBest.combo),
    statLine('Líneas máx.', records.maxLines, newBest.lines),
  );
  resetRecordsBtn.disabled = !records.scores.length && !records.bestCombo && !records.maxLines;
}

function statLine(label, value, isNew) {
  const span = document.createElement('span');
  span.textContent = `${label}: ${value}`;
  if (isNew) {
    span.className = 'new-best';
    span.textContent += ' ¡nuevo!';
  }
  return span;
}

function resetRecords() {
  if (!confirm('¿Borrar todos los récords?')) return;
  try { localStorage.removeItem(RECORDS_KEY); } catch { /* ignore */ }
  highlightIndex = -1;
  newBest = { combo: false, lines: false };
  renderRecords();
}

// Show the overlay with the records table (start screen and game over)
function showRecordsOverlay(title, scoreText, statsText, buttonText) {
  overlayTitle.textContent = title;
  overlayScore.textContent = scoreText;
  overlayStats.textContent = statsText;
  restartBtn.textContent = buttonText;
  recordsSection.classList.remove('hidden');
  renderRecords();
  overlay.classList.remove('hidden');
}

function showStartScreen() {
  board = createBoard();
  gameOver = true; // blocks game input until the first game starts
  clearCanvas(ctx, canvas);
  drawGrid();
  nameForm.classList.add('hidden');
  showRecordsOverlay('TETRIS', '', '', 'Jugar');
  restartBtn.focus();
}

function loadSkin() {
  try { return localStorage.getItem(SKIN_STORAGE_KEY); } catch { return null; }
}

function setSkin(name) {
  skin = Object.hasOwn(SKINS, name) ? name : 'retro';
  skinSelect.value = skin;
  try { localStorage.setItem(SKIN_STORAGE_KEY, skin); } catch { /* storage unavailable */ }
  // Redraw immediately so paused / game-over states update too
  if (current && next) { draw(); drawNext(); }
  else if (board) { clearCanvas(ctx, canvas); drawGrid(); }
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);

  // All-time stats count every game, even those outside the top 5
  const records = loadRecords();
  newBest = { combo: maxCombo > records.bestCombo, lines: lines > records.maxLines };
  records.bestCombo = Math.max(records.bestCombo, maxCombo);
  records.maxLines = Math.max(records.maxLines, lines);
  saveRecords(records);

  highlightIndex = -1;
  const rank = recordRank(records, score);
  pendingRecord = rank === -1 ? null : { score, lines, combo: maxCombo, date: Date.now() };
  nameForm.classList.toggle('hidden', !pendingRecord);
  if (pendingRecord) {
    nameLabel.textContent = `¡Entras en el top ${MAX_RECORDS}! Puesto #${rank + 1}`;
    nameInput.value = loadPlayerName();
  }

  showRecordsOverlay(
    'GAME OVER',
    `Puntuación: ${score.toLocaleString()}`,
    `Líneas: ${lines} · Mejor combo: ${maxCombo}`,
    'Reiniciar',
  );
  // Only focus the text field: focusing the button here would let the
  // keyup of the Space that ended the game click it and restart instantly.
  if (pendingRecord) {
    nameInput.focus();
    nameInput.select();
  }
}

function clampLevel(n) {
  return Math.min(MAX_START_LEVEL, Math.max(1, Math.round(n) || 1));
}

function loadStartLevel() {
  try { return clampLevel(Number(localStorage.getItem(START_LEVEL_KEY))); }
  catch { return 1; }
}

function setStartLevel(n) {
  startLevel = clampLevel(n);
  startLevelEl.textContent = startLevel;
  startLevelEl.setAttribute('aria-valuenow', String(startLevel));
  levelDownBtn.disabled = startLevel <= 1;
  levelUpBtn.disabled = startLevel >= MAX_START_LEVEL;
  try { localStorage.setItem(START_LEVEL_KEY, String(startLevel)); } catch { /* storage unavailable */ }
}

function menuItems() {
  return [resumeBtn, menuRestartBtn, controlsBtn, startLevelEl];
}

function openPauseMenu() {
  if (gameOver || paused) return;
  paused = true;
  cancelAnimationFrame(animId);
  showControls(false);
  pauseMenu.classList.remove('hidden');
  resumeBtn.focus();
}

function closePauseMenu() {
  if (!paused) return;
  paused = false;
  pauseMenu.classList.add('hidden');
  if (pauseMenu.contains(document.activeElement)) document.activeElement.blur();
  lastTime = performance.now();
  animId = requestAnimationFrame(loop);
}

function showControls(show) {
  pauseControls.hidden = !show;
  controlsBtn.setAttribute('aria-expanded', String(show));
  controlsBtn.textContent = show ? 'Ocultar controles' : 'Ver controles';
}

function restartFromMenu() {
  pauseMenu.classList.add('hidden');
  if (pauseMenu.contains(document.activeElement)) document.activeElement.blur();
  init();
}

// Keyboard navigation inside the pause menu. Never reaches game actions.
function handleMenuKey(e) {
  const items = menuItems();
  const idx = items.indexOf(document.activeElement);
  switch (e.code) {
    case 'KeyP':
    case 'Escape':
      e.preventDefault();
      closePauseMenu();
      break;
    case 'ArrowUp':
    case 'ArrowDown': {
      e.preventDefault();
      const step = e.code === 'ArrowDown' ? 1 : -1;
      const from = idx === -1 ? (step > 0 ? -1 : 0) : idx;
      items[(from + step + items.length) % items.length].focus();
      break;
    }
    case 'ArrowLeft':
    case 'ArrowRight':
      if (document.activeElement === startLevelEl) {
        e.preventDefault();
        setStartLevel(startLevel + (e.code === 'ArrowRight' ? 1 : -1));
      }
      break;
    case 'Enter':
    case 'NumpadEnter':
    case 'Space':
      // Handle activation on keydown (and cancel the native one) so the
      // release of this key can't trigger anything after the menu closes.
      e.preventDefault();
      if (!e.repeat && document.activeElement instanceof HTMLButtonElement && pauseMenu.contains(document.activeElement)) {
        document.activeElement.click();
      }
      break;
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  // lockPiece() may have ended the game; endGame() cancelled the frame that is
  // already running, so stop here instead of scheduling another one.
  if (gameOver) return;
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  baseLevel = startLevel;
  level = baseLevel;
  combo = 0;
  maxCombo = 0;
  paused = false;
  gameOver = false;
  dropInterval = dropIntervalFor(level);
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  pauseMenu.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  // Let the focused theme switch handle Space/Enter without dropping the piece
  if (e.target === themeToggle && (e.code === 'Space' || e.code === 'Enter')) return;
  // While the skin dropdown is focused, arrows/space belong to it
  if (e.target === skinSelect) return;
  // Typing the player name must not control the game
  if (e.target === nameInput) return;
  if (paused) {
    heldKeys.add(e.code);
    handleMenuKey(e);
    return;
  }
  if (gameOver) return;
  if (e.code === 'KeyP' || e.code === 'Escape') { openPauseMenu(); return; }
  if (heldKeys.has(e.code)) {
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    return;
  }
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

document.addEventListener('keyup', e => heldKeys.delete(e.code));
// keyup is lost if the window loses focus while a key is held
window.addEventListener('blur', () => heldKeys.clear());

restartBtn.addEventListener('click', () => {
  // Starting a new game without pressing "Guardar" still keeps the record
  commitPendingRecord();
  init();
});
nameForm.addEventListener('submit', e => {
  e.preventDefault();
  commitPendingRecord();
  restartBtn.focus(); // Enter again starts a new game
});
nameInput.addEventListener('input', renderRecords);
resetRecordsBtn.addEventListener('click', resetRecords);
resumeBtn.addEventListener('click', closePauseMenu);
menuRestartBtn.addEventListener('click', restartFromMenu);
controlsBtn.addEventListener('click', () => showControls(pauseControls.hidden));
levelDownBtn.addEventListener('click', () => setStartLevel(startLevel - 1));
levelUpBtn.addEventListener('click', () => setStartLevel(startLevel + 1));

// The menu's controls list is a copy of the side panel's, so both stay in sync.
pauseControls.appendChild(document.querySelector('.panel .controls ul').cloneNode(true));
setStartLevel(startLevel);
themeToggle.addEventListener('click', () => {
  setTheme(theme === 'light' ? 'dark' : 'light');
  themeToggle.blur(); // return keyboard control to the game
});

for (const [value, { label }] of Object.entries(SKINS)) {
  skinSelect.add(new Option(label, value));
}
skinSelect.addEventListener('change', () => {
  setSkin(skinSelect.value);
  skinSelect.blur(); // return keyboard control to the game
});

setSkin(loadSkin());
showStartScreen();
