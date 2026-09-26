const SPLASH_DURATION_MS = 5000;
const SPLASH_FADE_MS = 600;

let playerName = "";

function startGame() {
  // Main game setup goes here in upcoming iterations.
}

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
