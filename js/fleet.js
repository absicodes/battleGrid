// Fleet deployment: pick a ship in the dock, rotate it, drag it onto your battle space.
// Placed ships can be dragged around the board or back to the dock until deployment is confirmed.

// size = number of grid points the ship covers; ratio = image height / width
const SHIPS = [
  { id: "carrier",    name: "Carrier",     size: 6, img: "Images/Ships/AircraftCareer.png", ratio: 724 / 2172 },
  { id: "battleship", name: "Battle Ship", size: 5, img: "Images/Ships/BattleShip.png",     ratio: 733 / 2146 },
  { id: "cruiser",    name: "Cruiser",     size: 5, img: "Images/Ships/Cruiser.png",        ratio: 733 / 2146 },
  { id: "destroyer",  name: "Destroyer",   size: 5, img: "Images/Ships/Destroyer.png",      ratio: 724 / 2172 },
  { id: "submarine",  name: "Submarine",   size: 5, img: "Images/Ships/Submarine.png",      ratio: 721 / 2181 },
];

const DOCK_STEPS = 8;              // the dock is an 8 x 8 grid
const BOARD_LINES = 15;            // named grid lines each way on the battle board (A-O, 1-15)
const BOARD_STEPS = BOARD_LINES + 1;

const fleet = {
  board: null,          // the player's battle board element
  selected: null,       // ship currently in the dock
  rotation: 0,          // 0, 90, 180 or 270 degrees clockwise
  placed: [],           // { ship, rotation, col, row, cells: ["c,r", ...], el }
  confirmed: false,     // true once the player confirms deployment
};

const isHorizontal = (rotation) => rotation % 180 === 0;

// Footprint of a ship in steps: `size` long and 1 wide.
function footprint(ship, rotation) {
  return isHorizontal(rotation) ? { w: ship.size, h: 1 } : { w: 1, h: ship.size };
}

// Creates a ship element in a square container of `steps` steps, centred on cx, cy (step units).
// The element covers only the ship's footprint (so it is what you grab); the picture inside
// keeps its natural proportions and is rotated to match.
function createShipEl(ship, rotation, steps, cx, cy) {
  const { w, h } = footprint(ship, rotation);
  const el = document.createElement("div");
  el.className = "ship";
  el.innerHTML = `<img src="${ship.img}" alt="${ship.name}" draggable="false">`;
  el.style.width = `${(w / steps) * 100}%`;
  el.style.height = `${(h / steps) * 100}%`;
  positionShipEl(el, steps, cx, cy);

  const img = el.firstElementChild;
  img.style.width = `${(ship.size / w) * 100}%`;
  img.style.height = `${((ship.size * ship.ratio) / h) * 100}%`;
  img.style.transform = `translate(-50%, -50%) rotate(${rotation}deg)`;
  return el;
}

function positionShipEl(el, steps, cx, cy) {
  el.style.left = `${(cx / steps) * 100}%`;
  el.style.top = `${(cy / steps) * 100}%`;
}

// Grid points (0-based column/row indexes) a ship would cover starting at col,row.
function shipCells(ship, rotation, col, row) {
  const cells = [];
  for (let i = 0; i < ship.size; i++) {
    cells.push(isHorizontal(rotation) ? [col + i, row] : [col, row + i]);
  }
  return cells;
}

// Centre of a ship on the board in step units (point index i sits at step i + 1).
function shipCentre(ship, rotation, col, row) {
  const along = (ship.size - 1) / 2;
  return isHorizontal(rotation)
    ? { x: col + 1 + along, y: row + 1 }
    : { x: col + 1, y: row + 1 + along };
}

// Finds the legal start point closest to the dropped centre, or null if none fits.
// `moving` is a ship already on the board whose own points don't count as occupied.
function nearestLegalPlacement(ship, rotation, dropX, dropY, moving = null) {
  const occupied = new Set(fleet.placed.filter((p) => p !== moving).flatMap((p) => p.cells));
  let best = null;
  let bestDist = Infinity;

  for (let col = 0; col < BOARD_LINES; col++) {
    for (let row = 0; row < BOARD_LINES; row++) {
      const cells = shipCells(ship, rotation, col, row);
      const fits = cells.every(([c, r]) => c < BOARD_LINES && r < BOARD_LINES && !occupied.has(`${c},${r}`));
      if (!fits) continue;

      const centre = shipCentre(ship, rotation, col, row);
      const dist = (centre.x - dropX) ** 2 + (centre.y - dropY) ** 2;
      if (dist < bestDist) {
        bestDist = dist;
        best = { col, row, cells: cells.map(([c, r]) => `${c},${r}`) };
      }
    }
  }
  return best;
}

function isOver(el, x, y) {
  const rect = el.getBoundingClientRect();
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

// Converts a pointer position to board step units.
function boardPoint(x, y) {
  const rect = fleet.board.getBoundingClientRect();
  const step = rect.width / BOARD_STEPS;
  return { x: (x - rect.left) / step, y: (y - rect.top) / step };
}

/* ---------- Dock ---------- */

function renderDock() {
  const dock = document.getElementById("dock");
  dock.querySelector(".ship")?.remove();
  document.getElementById("btn-rotate").disabled = !fleet.selected;

  if (!fleet.selected) return;
  const centre = DOCK_STEPS / 2;
  const el = createShipEl(fleet.selected, fleet.rotation, DOCK_STEPS, centre, centre);
  el.classList.add("ship--draggable");
  el.addEventListener("pointerdown", (event) => {
    const ship = fleet.selected;
    const rotation = fleet.rotation;
    dragShip(event, ship, rotation, el, (x, y) => {
      if (isOver(fleet.board, x, y)) placeShip(ship, rotation, x, y);
    });
  });
  dock.appendChild(el);
}

function selectShip(ship, rotation = 0) {
  fleet.selected = ship;
  fleet.rotation = rotation;
  for (const btn of document.querySelectorAll(".ship-btn")) {
    btn.classList.toggle("is-selected", btn.dataset.ship === ship.id);
  }
  renderDock();
}

function updateDeployStatus() {
  const allPlaced = fleet.placed.length === SHIPS.length;
  document.getElementById("btn-deploy").hidden = !allPlaced;
}

/* ---------- Dragging ---------- */

// Drags a ghost of the ship (at the board's scale) from `sourceEl`; calls onDrop(x, y) on release.
function dragShip(event, ship, rotation, sourceEl, onDrop) {
  event.preventDefault();
  const step = fleet.board.getBoundingClientRect().width / BOARD_STEPS;
  const { w, h } = footprint(ship, rotation);

  const ghost = createShipEl(ship, rotation, 1, 0, 0);
  ghost.classList.add("ship--ghost");
  ghost.style.width = `${w * step}px`;
  ghost.style.height = `${h * step}px`;
  document.body.appendChild(ghost);

  const moveGhost = (e) => {
    ghost.style.left = `${e.clientX}px`;
    ghost.style.top = `${e.clientY}px`;
  };
  moveGhost(event);
  sourceEl.classList.add("is-dragging");
  sourceEl.setPointerCapture(event.pointerId);

  const onUp = (e) => {
    sourceEl.removeEventListener("pointermove", moveGhost);
    sourceEl.removeEventListener("pointerup", onUp);
    sourceEl.removeEventListener("pointercancel", onUp);
    ghost.remove();
    sourceEl.classList.remove("is-dragging");
    onDrop(e.clientX, e.clientY);
  };
  sourceEl.addEventListener("pointermove", moveGhost);
  sourceEl.addEventListener("pointerup", onUp);
  sourceEl.addEventListener("pointercancel", onUp);
}

/* ---------- Ships on the board ---------- */

// Places a ship from the dock at the nearest legal spot to the drop point.
function placeShip(ship, rotation, x, y) {
  const drop = boardPoint(x, y);
  const spot = nearestLegalPlacement(ship, rotation, drop.x, drop.y);
  if (!spot) return;

  const centre = shipCentre(ship, rotation, spot.col, spot.row);
  const el = createShipEl(ship, rotation, BOARD_STEPS, centre.x, centre.y);
  el.classList.add("ship--draggable");
  fleet.board.appendChild(el);

  const record = { ship, rotation, ...spot, el };
  fleet.placed.push(record);
  el.addEventListener("pointerdown", (event) => {
    if (!fleet.confirmed) dragPlacedShip(event, record);
  });

  const btn = document.querySelector(`.ship-btn[data-ship="${ship.id}"]`);
  btn.disabled = true;
  btn.classList.remove("is-selected");
  fleet.selected = null;
  renderDock();
  updateDeployStatus();
}

// Moves a placed ship around the board, or back to the dock if dropped on the deploy panel.
function dragPlacedShip(event, record) {
  dragShip(event, record.ship, record.rotation, record.el, (x, y) => {
    if (isOver(fleet.board, x, y)) {
      const drop = boardPoint(x, y);
      const spot = nearestLegalPlacement(record.ship, record.rotation, drop.x, drop.y, record);
      if (!spot) return;
      Object.assign(record, spot);
      const centre = shipCentre(record.ship, record.rotation, spot.col, spot.row);
      positionShipEl(record.el, BOARD_STEPS, centre.x, centre.y);
    } else if (isOver(document.getElementById("deploy"), x, y)) {
      returnToDock(record);
    }
    // Dropped anywhere else: the ship stays where it was.
  });
}

function returnToDock(record) {
  record.el.remove();
  fleet.placed = fleet.placed.filter((p) => p !== record);
  document.querySelector(`.ship-btn[data-ship="${record.ship.id}"]`).disabled = false;
  selectShip(record.ship, record.rotation);
  updateDeployStatus();
}

/* ---------- Start / confirm ---------- */

function confirmDeployment() {
  fleet.confirmed = true;
  for (const { el } of fleet.placed) {
    el.classList.remove("ship--draggable");
  }
  document.getElementById("deploy").hidden = true;
  document.getElementById("battle-locked-note").textContent = "Fleet deployed";
}

function startDeployment(board) {
  fleet.board = board;

  const buttons = document.getElementById("ship-buttons");
  for (const ship of SHIPS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ship-btn";
    btn.dataset.ship = ship.id;
    btn.innerHTML = `${ship.name}<span class="ship-btn__size">${ship.size}</span>`;
    btn.addEventListener("click", () => selectShip(ship));
    buttons.appendChild(btn);
  }

  document.getElementById("btn-rotate").addEventListener("click", () => {
    if (!fleet.selected) return;
    fleet.rotation = (fleet.rotation + 90) % 360;
    renderDock();
  });

  document.getElementById("btn-deploy").addEventListener("click", confirmDeployment);

  renderDock();
  updateDeployStatus();
  document.getElementById("deploy").hidden = false;
}
