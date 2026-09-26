const SPLASH_DURATION_MS = 5000;
const SPLASH_FADE_MS = 600;

const GRID_SIZE = 100;     // full battle space is GRID_SIZE x GRID_SIZE
const AREA_SIZE = 15;      // the player's chosen battle space is AREA_SIZE x AREA_SIZE
const LABEL_EVERY = 5;     // axis labels shown on the first cell and every 5th cell
const MAJOR_LINE_EVERY = 10;

let playerName = "";

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

function buildAxes() {
  const top = document.getElementById("axis-top");
  const left = document.getElementById("axis-left");

  for (let i = 0; i < GRID_SIZE; i++) {
    const showLabel = i === 0 || (i + 1) % LABEL_EVERY === 0;

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

function buildGridLines() {
  let minor = "";
  let major = "";
  for (let i = 1; i < GRID_SIZE; i++) {
    const line = `M${i} 0V${GRID_SIZE}M0 ${i}H${GRID_SIZE}`;
    if (i % MAJOR_LINE_EVERY === 0) {
      major += line;
    } else {
      minor += line;
    }
  }
  document.getElementById("grid-minor").setAttribute("d", minor);
  document.getElementById("grid-major").setAttribute("d", major);
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
    battleSpace = { col: selection.col, row: selection.row, size: AREA_SIZE };
    document.getElementById("locked-range").textContent = rangeLabel(battleSpace.col, battleSpace.row);
    showStage("locked");
  });

  document.getElementById("btn-change").addEventListener("click", () => {
    battleSpace = null;
    showStage("select");
  });
}

function startGame() {
  document.getElementById("game-commander").textContent = `Commander ${playerName}`;
  buildAxes();
  buildGridLines();
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
