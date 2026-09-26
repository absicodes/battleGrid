// Opponent names from around the world. One is picked at random each new game.
const OPPONENT_NAMES = [
  // Africa
  "Amara", "Kwame", "Chidi", "Zanele", "Tariq", "Nia", "Kofi", "Ayodele", "Thabo", "Fatou",
  "Jabari", "Imani", "Sekou", "Wanjiru", "Oluwaseun", "Abebe", "Nomvula", "Yaw", "Makena", "Idris",
  // Asia
  "Arjun", "Priya", "Hiroshi", "Yuki", "Wei", "Mei", "Min-jun", "Ji-woo", "Anh", "Minh",
  "Siddharth", "Ananya", "Somchai", "Malai", "Rizal", "Dewi", "Bilal", "Ayesha", "Tenzin", "Bataar",
  // Europe
  "Sofia", "Luca", "Mateo", "Elena", "Lars", "Ingrid", "Pierre", "Amélie", "Klaus", "Greta",
  "Oisín", "Siobhan", "Dmitri", "Katya", "Nikos", "Eleni", "Jakub", "Zofia", "Björn", "Astrid",
  // Middle East
  "Omar", "Layla", "Karim", "Yasmin", "Farid", "Noor", "Ari", "Tamar", "Emre", "Elif",
  // Americas
  "Diego", "Valentina", "Santiago", "Camila", "João", "Beatriz", "Carlos", "Lucía", "Tupac", "Inti",
  "Ethan", "Maya", "Jamal", "Keisha", "Chayton", "Aiyana", "Liam", "Chloe", "Rafael", "Ximena",
  // Oceania
  "Aroha", "Tane", "Kalani", "Leilani", "Mere", "Tui", "Isla", "Jack", "Sione", "Losa",
];

function randomOpponentName() {
  return OPPONENT_NAMES[Math.floor(Math.random() * OPPONENT_NAMES.length)];
}
