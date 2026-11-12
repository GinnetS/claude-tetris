'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

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
const skinSelect = document.getElementById('skin-select');

// Canvas colors per theme (canvas does not inherit CSS variables)
const THEMES = {
  dark:  { grid: '#22222e', highlight: 'rgba(255,255,255,0.12)' },
  light: { grid: '#e1e3ee', highlight: 'rgba(255,255,255,0.35)' },
};
let theme = 'dark';

// ---- Skins ----
// Each skin provides a palette (index = piece type), optional canvas background,
// optional grid colors per theme, and the function that paints one cell.

const SKIN_STORAGE_KEY = 'tetris-skin';

// Mixes a #rrggbb color towards white (amount > 0) or black (amount < 0)
function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const target = amount < 0 ? 0 : 255;
  const t = Math.abs(amount);
  const ch = v => Math.round(v + (target - v) * t);
  const r = ch(n >> 16), g = ch((n >> 8) & 255), b = ch(n & 255);
  return `rgb(${r},${g},${b})`;
}

function roundedRectPath(context, x, y, w, h, r) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

function drawRetroCell(context, px, py, size, color) {
  context.fillStyle = color;
  context.fillRect(px + 1, py + 1, size - 2, size - 2);
  context.fillStyle = THEMES[theme].highlight;
  context.fillRect(px + 1, py + 1, size - 2, 4);
}

function drawNeonCell(context, px, py, size, color) {
  const inset = 3;
  context.shadowColor = color;
  context.shadowBlur = size * 0.5;
  // Dim translucent core plus a bright outline that carries the glow
  context.fillStyle = color;
  context.globalAlpha *= 0.25;
  context.fillRect(px + inset, py + inset, size - inset * 2, size - inset * 2);
  context.globalAlpha /= 0.25;
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.strokeRect(px + inset, py + inset, size - inset * 2, size - inset * 2);
  // Hot white center line for a tube-light look
  context.shadowBlur = 0;
  context.strokeStyle = 'rgba(255,255,255,0.6)';
  context.lineWidth = 0.75;
  context.strokeRect(px + inset, py + inset, size - inset * 2, size - inset * 2);
}

function drawPastelCell(context, px, py, size, color) {
  const pad = 2;
  const r = size * 0.22;
  roundedRectPath(context, px + pad, py + pad, size - pad * 2, size - pad * 2, r);
  context.fillStyle = color;
  context.fill();
  context.strokeStyle = shade(color, -0.18);
  context.lineWidth = 1.5;
  context.stroke();
  // Soft gloss blob in the top-left corner
  roundedRectPath(context, px + pad + 3, py + pad + 3, size * 0.4, size * 0.22, r * 0.5);
  context.fillStyle = 'rgba(255,255,255,0.45)';
  context.fill();
}

// 6×6 texture: L = light, D = dark, M = mid speck, . = base color
const PIXEL_PATTERN = [
  'LLLLLD',
  'L.M..D',
  'L...MD',
  'LM...D',
  'L..M.D',
  'DDDDDD',
];

function drawPixelCell(context, px, py, size, color) {
  const n = PIXEL_PATTERN.length;
  const unit = size / n;
  const tones = { L: shade(color, 0.4), D: shade(color, -0.4), M: shade(color, -0.15), '.': color };
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      context.fillStyle = tones[PIXEL_PATTERN[r][c]];
      // Snap to whole pixels so the texture stays crisp
      const x0 = Math.round(px + c * unit), y0 = Math.round(py + r * unit);
      const x1 = Math.round(px + (c + 1) * unit), y1 = Math.round(py + (r + 1) * unit);
      context.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
  }
}

const SKINS = {
  retro: {
    colors: [
      null,
      '#4dd0e1', // I - cyan
      '#ffd54f', // O - yellow
      '#ba68c8', // T - purple
      '#81c784', // S - green
      '#e57373', // Z - red
      '#b71c1c', // J - blood red (darker than Z so they stay distinguishable)
      '#ffb74d', // L - orange
    ],
    background: null,
    grid: null,
    drawCell: drawRetroCell,
  },
  neon: {
    colors: [null, '#00f0ff', '#fff200', '#d400ff', '#39ff14', '#ff073a', '#ff2fd6', '#ff8c00'],
    background: '#000000', // always black, regardless of light/dark theme
    grid: { dark: '#0d0d1a', light: '#0d0d1a' },
    drawCell: drawNeonCell,
  },
  pastel: {
    colors: [null, '#a0e7f0', '#fff3a8', '#d7b8f3', '#b5ead7', '#ffb7b2', '#c9a0a0', '#ffdac1'],
    background: null,
    grid: null,
    drawCell: drawPastelCell,
  },
  pixel: {
    colors: [null, '#3cbcfc', '#f8b800', '#9878f8', '#58d854', '#f83800', '#a80020', '#fc9838'],
    background: null,
    grid: null,
    drawCell: drawPixelCell,
  },
};
let skin = 'retro';

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

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
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
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
  context.save();
  context.globalAlpha = alpha ?? 1;
  SKINS[skin].drawCell(context, x * size, y * size, size, SKINS[skin].colors[colorIndex]);
  context.restore();
}

// Paints the skin background (if it has one) or clears to the CSS surface color
function paintBackground(context, w, h) {
  const bg = SKINS[skin].background;
  if (bg) {
    context.fillStyle = bg;
    context.fillRect(0, 0, w, h);
  } else {
    context.clearRect(0, 0, w, h);
  }
}

function drawGrid() {
  ctx.strokeStyle = SKINS[skin].grid?.[theme] ?? THEMES[theme].grid;
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
  paintBackground(ctx, canvas.width, canvas.height);
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
  paintBackground(nextCtx, nextCanvas.width, nextCanvas.height);
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
}

function setSkin(name) {
  skin = SKINS[name] ? name : 'retro';
  document.documentElement.dataset.skin = skin;
  skinSelect.value = skin;
  try { localStorage.setItem(SKIN_STORAGE_KEY, skin); } catch (_) { /* storage unavailable */ }
  // Redraw immediately so paused / game-over states update too
  if (current && next) { draw(); drawNext(); }
}

function loadSkin() {
  try { return localStorage.getItem(SKIN_STORAGE_KEY) || 'retro'; } catch (_) { return 'retro'; }
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
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
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  // Let the focused theme switch handle Space/Enter without dropping the piece
  if (e.target === themeToggle && (e.code === 'Space' || e.code === 'Enter')) return;
  // Let the focused skin selector use the arrow keys without moving the piece
  if (e.target === skinSelect) return;
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
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

restartBtn.addEventListener('click', init);
themeToggle.addEventListener('click', () => {
  setTheme(theme === 'light' ? 'dark' : 'light');
  themeToggle.blur(); // return keyboard control to the game
});
skinSelect.addEventListener('change', () => {
  setSkin(skinSelect.value);
  skinSelect.blur(); // return keyboard control to the game
});

setSkin(loadSkin());
init();
