const SPLASH_DURATION_MS = 5000;
const SPLASH_FADE_MS = 600;

const GRID_SIZE = 100;     // full battle space is GRID_SIZE x GRID_SIZE
const AREA_SIZE = 15;      // the player's chosen battle space is AREA_SIZE x AREA_SIZE
const LABEL_EVERY = 5;     // axis labels shown on the first cell and every 5th cell
const MAJOR_LINE_EVERY = 10;
const LOCKED_PAUSE_MS = 1500;   // how long the frozen selection is shown before the split view

let playerName = "";
let opponentName = "";     // picked at random from OPPONENT_NAMES (js/names.js) each new game

// Top-left cell (0-based) of the player's battle space.
const selection = { col: 0, row: 0 };
let battleSpace = null;    // set once the player confirms, e.g. { col, row, size }

// 0 -> A, 25 -> Z, 26 -> AA, 99 -> CV
function columnLabel(index) {
  let label = "";
  let n = index + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    label = String.fromCharCode(65 + rem) + label;
    n = Math.floor((n - 1) / 26);
  }
  return label;
}

function cellLabel(col, row) {
  return `${columnLabel(col)}${row + 1}`;
}

function rangeLabel(col, row) {
  return `${cellLabel(col, row)} – ${cellLabel(col + AREA_SIZE - 1, row + AREA_SIZE - 1)}`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/* ---------- Battle space board ---------- */

// Fills the top (letters) and left (numbers) axes with labels.
function buildAxes(top, left, cells, labelEvery = 1) {
  for (let i = 0; i < cells; i++) {
    const showLabel = labelEvery === 1 || i === 0 || (i + 1) % labelEvery === 0;

    const colCell = document.createElement("span");
    colCell.className = "axis__label";
    colCell.textContent = showLabel ? columnLabel(i) : "";
    top.appendChild(colCell);

    const rowCell = document.createElement("span");
    rowCell.className = "axis__label";
    rowCell.textContent = showLabel ? String(i + 1) : "";
    left.appendChild(rowCell);
  }
}

// Draws the grid lines into an SVG whose viewBox is 0 0 cells cells.
function buildGridLines(svg, cells, majorEvery = 0) {
  let minor = "";
  let major = "";
  for (let i = 1; i < cells; i++) {
    const line = `M${i} 0V${cells}M0 ${i}H${cells}`;
    if (majorEvery && i % majorEvery === 0) {
      major += line;
    } else {
      minor += line;
    }
  }
  svg.querySelector(".board__grid-minor").setAttribute("d", minor);
  svg.querySelector(".board__grid-major").setAttribute("d", major);
}

// Draws one line per label, running through the centre of each label's slot, so every
// intersection is a named point (e.g. F5 = line F meets line 5).
function buildLabelledLines(svg, lines) {
  const first = 0.5;
  const last = lines - 0.5;
  let path = "";
  for (let i = 0; i < lines; i++) {
    const pos = i + 0.5;
    path += `M${pos} ${first}V${last}M${first} ${pos}H${last}`;
  }
  svg.querySelector(".board__grid-minor").setAttribute("d", path);
}

// Builds a board with `lines` labelled lines each way inside `wrap` and returns the board element.
function createBoard(wrap, lines) {
  wrap.style.setProperty("--cells", lines);
  wrap.innerHTML = `
    <div class="axis-corner" aria-hidden="true"></div>
    <div class="axis axis--top" aria-hidden="true"></div>
    <div class="axis axis--left" aria-hidden="true"></div>
    <div class="board">
      <svg class="board__grid" viewBox="0 0 ${lines} ${lines}" preserveAspectRatio="none" aria-hidden="true">
        <path class="board__grid-minor"></path>
        <path class="board__grid-major"></path>
      </svg>
    </div>`;
  buildAxes(wrap.querySelector(".axis--top"), wrap.querySelector(".axis--left"), lines);
  buildLabelledLines(wrap.querySelector(".board__grid"), lines);
  return wrap.querySelector(".board");
}

// Converts a pointer position to the grid cell underneath it.
function cellFromPointer(event) {
  const rect = document.getElementById("board").getBoundingClientRect();
  const cellSize = rect.width / GRID_SIZE;
  return {
    col: clamp(Math.floor((event.clientX - rect.left) / cellSize), 0, GRID_SIZE - 1),
    row: clamp(Math.floor((event.clientY - rect.top) / cellSize), 0, GRID_SIZE - 1),
  };
}

/* ---------- 15 x 15 selector ---------- */

function moveSelection(col, row) {
  const max = GRID_SIZE - AREA_SIZE;
  selection.col = clamp(col, 0, max);
  selection.row = clamp(row, 0, max);
  renderSelection();
}

function renderSelection() {
  const { col, row } = selection;
  const selector = document.getElementById("selector");
  selector.style.left = `${col}%`;
  selector.style.top = `${row}%`;
  document.getElementById("axis-top-band").style.left = `${col}%`;
  document.getElementById("axis-left-band").style.top = `${row}%`;
  document.getElementById("readout-range").textContent = rangeLabel(col, row);
}

function setupSelector() {
  const board = document.getElementById("board");
  const selector = document.getElementById("selector");
  const cursorReadout = document.getElementById("readout-cursor");
  let dragOffset = null;   // where inside the selector the drag started, in cells

  const isSelecting = () => !selector.hidden && !selector.classList.contains("is-locked");

  selector.addEventListener("pointerdown", (event) => {
    if (!isSelecting()) return;
    event.preventDefault();
    event.stopPropagation();
    const cell = cellFromPointer(event);
    dragOffset = { col: cell.col - selection.col, row: cell.row - selection.row };
    selector.setPointerCapture(event.pointerId);
    selector.classList.add("is-dragging");
    selector.focus();
  });

  selector.addEventListener("pointermove", (event) => {
    if (!dragOffset) return;
    const cell = cellFromPointer(event);
    moveSelection(cell.col - dragOffset.col, cell.row - dragOffset.row);
  });

  const endDrag = () => {
    dragOffset = null;
    selector.classList.remove("is-dragging");
  };
  selector.addEventListener("pointerup", endDrag);
  selector.addEventListener("pointercancel", endDrag);

  // Clicking elsewhere on the map centres the selector on that cell.
  board.addEventListener("pointerdown", (event) => {
    if (!isSelecting()) return;
    const cell = cellFromPointer(event);
    const half = Math.floor(AREA_SIZE / 2);
    moveSelection(cell.col - half, cell.row - half);
    selector.focus();
  });

  board.addEventListener("pointermove", (event) => {
    const cell = cellFromPointer(event);
    cursorReadout.textContent = cellLabel(cell.col, cell.row);
  });
  board.addEventListener("pointerleave", () => {
    cursorReadout.textContent = "–";
  });

  selector.addEventListener("keydown", (event) => {
    if (!isSelecting()) return;
    const step = event.shiftKey ? 5 : 1;
    const moves = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    moveSelection(selection.col + move[0], selection.row + move[1]);
  });
}

/* ---------- Stages: view -> select -> locked ---------- */

function showStage(name) {
  for (const stage of ["view", "select", "locked"]) {
    document.getElementById(`stage-${stage}`).hidden = stage !== name;
  }

  const selecting = name === "select";
  const showSelector = name !== "view";
  const selector = document.getElementById("selector");

  selector.hidden = !showSelector;
  selector.classList.toggle("is-locked", name === "locked");
  document.getElementById("board").classList.toggle("is-selecting", selecting);
  document.getElementById("axis-top-band").hidden = !showSelector;
  document.getElementById("axis-left-band").hidden = !showSelector;

  if (selecting) {
    selector.focus();
  }
}

function setupStages() {
  document.getElementById("btn-choose").addEventListener("click", () => {
    const centre = Math.floor((GRID_SIZE - AREA_SIZE) / 2);
    moveSelection(centre, centre);
    showStage("select");
  });

  document.getElementById("btn-confirm").addEventListener("click", () => {
    // The battle space is frozen from here on; there is no way back to the selector.
    battleSpace = Object.freeze({ col: selection.col, row: selection.row, size: AREA_SIZE });
    document.getElementById("locked-range").textContent = rangeLabel(battleSpace.col, battleSpace.row);
    showStage("locked");
    setTimeout(showBattle, LOCKED_PAUSE_MS);
  });
}

/* ---------- Battle: split screen ---------- */

function showBattle() {
  const game = document.getElementById("game");
  const battle = document.getElementById("battle");

  document.getElementById("player-space-title").textContent = `Commander ${playerName}'s Battle Space`;
  document.getElementById("opponent-space-title").textContent = `Commander ${opponentName}'s Battle Space`;

  // Left: the chosen 15 x 15 slice of the terrain, scaled up to fill the board.
  const map = createBoard(document.getElementById("battle-map"), battleSpace.size);
  const zoom = (GRID_SIZE / battleSpace.size) * 100;
  const maxOffset = GRID_SIZE - battleSpace.size;
  map.style.backgroundSize = `${zoom}% ${zoom}%`;
  map.style.backgroundPosition = `${(battleSpace.col / maxOffset) * 100}% ${(battleSpace.row / maxOffset) * 100}%`;

  // Right: the same grid with no background.
  createBoard(document.getElementById("battle-grid"), battleSpace.size);

  game.hidden = true;
  battle.hidden = false;
}

function startGame() {
  opponentName = randomOpponentName();
  document.getElementById("game-commander").textContent = `Commander ${playerName}`;
  buildAxes(document.getElementById("axis-top"), document.getElementById("axis-left"), GRID_SIZE, LABEL_EVERY);
  buildGridLines(document.getElementById("board-grid"), GRID_SIZE, MAJOR_LINE_EVERY);
  setupSelector();
  setupStages();
  showStage("view");
}

/* ---------- Intro: name entry and splash ---------- */

function showGame() {
  const splash = document.getElementById("splash");
  const game = document.getElementById("game");

  splash.classList.add("is-leaving");
  setTimeout(() => {
    splash.hidden = true;
    game.hidden = false;
    startGame();
  }, SPLASH_FADE_MS);
}

function showSplash() {
  document.getElementById("welcome-message").textContent = `Welcome Commander ${playerName}`;
  document.getElementById("name-entry").hidden = true;
  document.getElementById("splash").hidden = false;
  setTimeout(showGame, SPLASH_DURATION_MS);
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("name-form");
  const input = document.getElementById("player-name");

  input.focus();

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = input.value.trim();
    if (!name) {
      input.value = "";
      input.focus();
      return;
    }
    playerName = name;
    showSplash();
  });
});
