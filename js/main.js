const SPLASH_DURATION_MS = 5000;
const SPLASH_FADE_MS = 600;

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

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(showGame, SPLASH_DURATION_MS);
});
