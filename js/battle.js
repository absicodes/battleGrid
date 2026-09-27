// Battle: player and opponent take turns firing at each other's grid points.
// The opponent places its fleet at random, fires at random until it hits, then "seeks"
// along the ship until it sinks it.

const PIN_IMAGES = { hit: "Images/RedPinFire.png", miss: "Images/BluePin.png" };
const OPPONENT_TURN_DELAY_MS = 900;

const battle = {
  opponentBoard: null,
  opponentFleet: [],        // { ship, rotation, col, row, cells, hits }
  playerShots: new Set(),   // "c,r" points the player has fired at
  opponentShots: new Set(), // "c,r" points the opponent has fired at
  seekHits: [],             // opponent's hits on player ships not yet sunk
  turn: "player",
  over: false,
};

const cellKey = (col, row) => `${col},${row}`;
const pointLabel = (key) => {
  const [col, row] = key.split(",").map(Number);
  return `${columnLabel(col)}${row + 1}`;   // js/main.js
};
const pickRandom = (items) => items[Math.floor(Math.random() * items.length)];

/* ---------- Opponent fleet ---------- */

function randomFleet() {
  const placed = [];
  const occupied = new Set();
  for (const ship of SHIPS) {
    for (;;) {
      const rotation = Math.random() < 0.5 ? 0 : 90;
      const col = Math.floor(Math.random() * BOARD_LINES);
      const row = Math.floor(Math.random() * BOARD_LINES);
      const cells = shipCells(ship, rotation, col, row);
      if (cells.every(([c, r]) => c < BOARD_LINES && r < BOARD_LINES && !occupied.has(cellKey(c, r)))) {
        const keys = cells.map(([c, r]) => cellKey(c, r));
        keys.forEach((k) => occupied.add(k));
        placed.push({ ship, rotation, col, row, cells: keys, hits: new Set() });
        break;
      }
    }
  }
  return placed;
}

/* ---------- Pins and shots ---------- */

function addPin(board, key, hit) {
  const [col, row] = key.split(",").map(Number);
  const pin = document.createElement("img");
  pin.className = `pin ${hit ? "pin--hit" : "pin--miss"}`;
  pin.src = hit ? PIN_IMAGES.hit : PIN_IMAGES.miss;
  pin.alt = hit ? "Hit" : "Miss";
  pin.dataset.cell = key;
  pin.style.left = `${((col + 1) / BOARD_STEPS) * 100}%`;
  pin.style.top = `${((row + 1) / BOARD_STEPS) * 100}%`;
  board.appendChild(pin);
}

// Clears the hit pins on a sunk ship so its destroyed picture shows.
function removePins(board, cells) {
  for (const key of cells) {
    board.querySelector(`.pin[data-cell="${key}"]`)?.remove();
  }
}

// Records a shot against a fleet; returns the ship hit (if any) and whether it sank.
function resolveShot(ships, key) {
  const target = ships.find((s) => s.cells.includes(key));
  if (!target) return { hit: false };
  target.hits.add(key);
  return { hit: true, target, sunk: target.hits.size === target.ship.size };
}

const allSunk = (ships) => ships.every((s) => s.hits.size === s.ship.size);

function setStatus(id, text) {
  document.getElementById(id).textContent = text;
}

/* ---------- Player's turn ---------- */

function boardPointFromEvent(board, event) {
  const rect = board.getBoundingClientRect();
  const step = rect.width / BOARD_STEPS;
  const col = Math.round((event.clientX - rect.left) / step) - 1;
  const row = Math.round((event.clientY - rect.top) / step) - 1;
  if (col < 0 || row < 0 || col >= BOARD_LINES || row >= BOARD_LINES) return null;
  return cellKey(col, row);
}

function playerFire(event) {
  if (battle.over || battle.turn !== "player") return;
  const key = boardPointFromEvent(battle.opponentBoard, event);
  if (!key || battle.playerShots.has(key)) return;

  battle.playerShots.add(key);
  const result = resolveShot(battle.opponentFleet, key);
  addPin(battle.opponentBoard, key, result.hit);
  hideReticle();

  if (result.sunk) {
    const { ship, rotation, col, row, cells } = result.target;
    removePins(battle.opponentBoard, cells);
    const centre = shipCentre(ship, rotation, col, row);
    battle.opponentBoard.appendChild(createShipEl(ship, rotation, BOARD_STEPS, centre.x, centre.y, ship.destroyedImg));
    setStatus("fire-status", `${pointLabel(key)}: you sank Commander ${opponentName}'s ${ship.name}!`);
  } else {
    setStatus("fire-status", `${pointLabel(key)}: ${result.hit ? "hit!" : "miss."}`);
  }

  if (allSunk(battle.opponentFleet)) {
    endBattle(true);
    return;
  }
  setTurn("opponent");
  setTimeout(opponentFire, OPPONENT_TURN_DELAY_MS);
}

/* ---------- Opponent's turn ---------- */

// Random until it hits; then tries along the line of its hits, or around a lone hit.
function chooseOpponentTarget() {
  const free = (c, r) =>
    c >= 0 && r >= 0 && c < BOARD_LINES && r < BOARD_LINES && !battle.opponentShots.has(cellKey(c, r));

  if (battle.seekHits.length) {
    const hitSet = new Set(battle.seekHits);
    const hits = battle.seekHits.map((k) => k.split(",").map(Number));
    const [ac, ar] = hits[0];

    // Two or more hits in a row: keep going off either end of the line.
    for (const [dc, dr] of [[1, 0], [0, 1]]) {
      let back = 0;
      while (hitSet.has(cellKey(ac - (back + 1) * dc, ar - (back + 1) * dr))) back++;
      let ahead = 0;
      while (hitSet.has(cellKey(ac + (ahead + 1) * dc, ar + (ahead + 1) * dr))) ahead++;
      if (back + ahead === 0) continue;
      const ends = [
        [ac - (back + 1) * dc, ar - (back + 1) * dr],
        [ac + (ahead + 1) * dc, ar + (ahead + 1) * dr],
      ].filter(([c, r]) => free(c, r));
      if (ends.length) return cellKey(...pickRandom(ends));
    }

    // A lone hit (or a line that is blocked at both ends): try the points around each hit.
    for (const [c, r] of hits) {
      const around = [[c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]].filter(([x, y]) => free(x, y));
      if (around.length) return cellKey(...pickRandom(around));
    }
  }

  const open = [];
  for (let c = 0; c < BOARD_LINES; c++) {
    for (let r = 0; r < BOARD_LINES; r++) {
      if (free(c, r)) open.push(cellKey(c, r));
    }
  }
  return pickRandom(open);
}

function opponentFire() {
  if (battle.over) return;
  const key = chooseOpponentTarget();
  battle.opponentShots.add(key);

  const result = resolveShot(fleet.placed, key);   // js/fleet.js
  addPin(fleet.board, key, result.hit);

  if (result.hit) battle.seekHits.push(key);
  if (result.sunk) {
    const { ship, cells, el } = result.target;
    battle.seekHits = battle.seekHits.filter((k) => !cells.includes(k));
    removePins(fleet.board, cells);
    el.querySelector("img").src = ship.destroyedImg;
    setStatus("incoming-status", `Commander ${opponentName} fired at ${pointLabel(key)} and sank your ${ship.name}!`);
  } else {
    setStatus("incoming-status", `Commander ${opponentName} fired at ${pointLabel(key)}: ${result.hit ? "hit!" : "miss."}`);
  }

  if (allSunk(fleet.placed)) {
    endBattle(false);
    return;
  }
  setTurn("player");
}

/* ---------- Turns, aiming reticle, end of game ---------- */

function setTurn(turn) {
  battle.turn = turn;
  battle.opponentBoard.classList.toggle("is-targeting", turn === "player");
  document.getElementById("turn-banner").textContent =
    turn === "player" ? "Your turn: fire at a point on the enemy grid" : `Commander ${opponentName} is taking aim…`;
  document.getElementById("turn-banner").classList.toggle("is-opponent", turn !== "player");
}

function moveReticle(event) {
  const reticle = document.getElementById("reticle");
  const key = battle.turn === "player" && !battle.over ? boardPointFromEvent(battle.opponentBoard, event) : null;
  if (!key || battle.playerShots.has(key)) {
    reticle.hidden = true;
    return;
  }
  const [col, row] = key.split(",").map(Number);
  reticle.style.left = `${((col + 1) / BOARD_STEPS) * 100}%`;
  reticle.style.top = `${((row + 1) / BOARD_STEPS) * 100}%`;
  reticle.hidden = false;
}

function hideReticle() {
  document.getElementById("reticle").hidden = true;
}

function endBattle(playerWon) {
  battle.over = true;
  battle.opponentBoard.classList.remove("is-targeting");
  hideReticle();
  document.getElementById("turn-banner").textContent = playerWon ? "Victory!" : "Defeat";
  document.getElementById("game-over-title").textContent = playerWon ? "Victory!" : "Defeat";
  document.getElementById("game-over-text").textContent = playerWon
    ? `You sank Commander ${opponentName}'s entire fleet, Commander ${playerName}.`
    : `Commander ${opponentName} sank your entire fleet.`;
  document.getElementById("game-over").classList.toggle("is-defeat", !playerWon);
  document.getElementById("game-over").hidden = false;
}

function startBattle() {
  battle.opponentBoard = document.querySelector("#battle-grid .board");
  battle.opponentFleet = randomFleet();
  for (const record of fleet.placed) record.hits = new Set();

  const reticle = document.createElement("div");
  reticle.id = "reticle";
  reticle.className = "reticle";
  reticle.hidden = true;
  battle.opponentBoard.appendChild(reticle);

  battle.opponentBoard.addEventListener("click", playerFire);
  battle.opponentBoard.addEventListener("pointermove", moveReticle);
  battle.opponentBoard.addEventListener("pointerleave", hideReticle);
  document.getElementById("btn-play-again").addEventListener("click", () => location.reload());

  document.getElementById("turn-banner").hidden = false;
  setStatus("incoming-status", "");
  setStatus("fire-status", "");
  setTurn("player");
}
