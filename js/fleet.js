// Fleet deployment: pick a ship in the dock, rotate it, drag it onto your battle space.

// size = number of grid points the ship covers; ratio = image height / width
const SHIPS = [
  { id: "carrier",    name: "Carrier",     size: 5, img: "Images/Ships/AircraftCareer.png", ratio: 724 / 2172 },
  { id: "battleship", name: "Battle Ship", size: 4, img: "Images/Ships/BattleShip.png",     ratio: 733 / 2146 },
  { id: "cruiser",    name: "Cruiser",     size: 3, img: "Images/Ships/Cruiser.png",        ratio: 733 / 2146 },
  { id: "destroyer",  name: "Destroyer",   size: 2, img: "Images/Ships/Destroyer.png",      ratio: 724 / 2172 },
  { id: "submarine",  name: "Submarine",   size: 3, img: "Images/Ships/Submarine.png",      ratio: 721 / 2181 },
];

const DOCK_STEPS = 6;              // the dock is a 6 x 6 grid
const BOARD_LINES = 15;            // named grid lines each way on the battle board (A-O, 1-15)
const BOARD_STEPS = BOARD_LINES + 1;

const fleet = {
  board: null,          // the player's battle board element
  selected: null,       // ship currently in the dock
  rotation: 0,          // 0, 90, 180 or 270 degrees clockwise
  placed: [],           // { ship, rotation, col, row, cells: ["c,r", ...] }
};

const isHorizontal = (rotation) => rotation % 180 === 0;

// Creates a ship element sized and centred within a square container of `steps` steps.
// cx, cy are the ship's centre in step units.
function createShipEl(ship, rotation, steps, cx, cy) {
  const el = document.createElement("div");
  el.className = "ship";
  el.innerHTML = `<img src="${ship.img}" alt="${ship.name}" draggable="false">`;
  el.style.left = `${(cx / steps) * 100}%`;
  el.style.top = `${(cy / steps) * 100}%`;
  el.style.width = `${(ship.size / steps) * 100}%`;
  el.style.height = `${((ship.size * ship.ratio) / steps) * 100}%`;
  el.style.transform = `translate(-50%, -50%) rotate(${rotation}deg)`;
  return el;
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
function nearestLegalPlacement(ship, rotation, dropX, dropY) {
  const occupied = new Set(fleet.placed.flatMap((p) => p.cells));
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

/* ---------- Dock ---------- */

function renderDock() {
  const dock = document.getElementById("dock");
  dock.querySelector(".ship")?.remove();
  document.getElementById("btn-rotate").disabled = !fleet.selected;

  if (!fleet.selected) return;
  const centre = DOCK_STEPS / 2;
  const el = createShipEl(fleet.selected, fleet.rotation, DOCK_STEPS, centre, centre);
  el.classList.add("ship--draggable");
  el.addEventListener("pointerdown", startDrag);
  dock.appendChild(el);
}

function selectShip(ship) {
  fleet.selected = ship;
  fleet.rotation = 0;
  for (const btn of document.querySelectorAll(".ship-btn")) {
    btn.classList.toggle("is-selected", btn.dataset.ship === ship.id);
  }
  renderDock();
}

/* ---------- Dragging onto the board ---------- */

function startDrag(event) {
  event.preventDefault();
  const dockShip = event.currentTarget;
  const ship = fleet.selected;
  const rotation = fleet.rotation;
  const step = fleet.board.getBoundingClientRect().width / BOARD_STEPS;

  // Ghost at the board's scale that follows the pointer.
  const ghost = createShipEl(ship, rotation, 1, 0, 0);
  ghost.classList.add("ship--ghost");
  ghost.style.width = `${ship.size * step}px`;
  ghost.style.height = `${ship.size * ship.ratio * step}px`;
  document.body.appendChild(ghost);

  const moveGhost = (e) => {
    ghost.style.left = `${e.clientX}px`;
    ghost.style.top = `${e.clientY}px`;
  };
  moveGhost(event);
  dockShip.classList.add("is-dragging");
  dockShip.setPointerCapture(event.pointerId);

  const onMove = (e) => moveGhost(e);
  const onUp = (e) => {
    dockShip.removeEventListener("pointermove", onMove);
    dockShip.removeEventListener("pointerup", onUp);
    dockShip.removeEventListener("pointercancel", onUp);
    ghost.remove();
    dockShip.classList.remove("is-dragging");
    dropShip(ship, rotation, e.clientX, e.clientY);
  };
  dockShip.addEventListener("pointermove", onMove);
  dockShip.addEventListener("pointerup", onUp);
  dockShip.addEventListener("pointercancel", onUp);
}

// Snaps a dropped ship to the nearest legal spot; drops off the board are ignored.
function dropShip(ship, rotation, clientX, clientY) {
  const rect = fleet.board.getBoundingClientRect();
  const inside = clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
  if (!inside) return;

  const step = rect.width / BOARD_STEPS;
  const spot = nearestLegalPlacement(ship, rotation, (clientX - rect.left) / step, (clientY - rect.top) / step);
  if (!spot) return;

  const centre = shipCentre(ship, rotation, spot.col, spot.row);
  fleet.board.appendChild(createShipEl(ship, rotation, BOARD_STEPS, centre.x, centre.y));
  fleet.placed.push({ ship, rotation, ...spot });

  const btn = document.querySelector(`.ship-btn[data-ship="${ship.id}"]`);
  btn.disabled = true;
  btn.classList.remove("is-selected");
  fleet.selected = null;
  renderDock();

  if (fleet.placed.length === SHIPS.length) {
    document.getElementById("deploy-done").hidden = false;
  }
}

/* ---------- Start ---------- */

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

  renderDock();
  document.getElementById("deploy").hidden = false;
}
