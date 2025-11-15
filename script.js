// script.js

// --- Determine current season from data/season_start.json ---
async function getCurrentSeason() {
  const res = await fetch('data/season_start.json');
  const seasonStart = await res.json();

  const now = Date.now();

  const sorted = Object.entries(seasonStart)
    .map(([s, start]) => [Number(s), start])
    .sort((a, b) => a[1] - b[1]);

  let currentSeason = sorted[0][0];
  for (let i = 0; i < sorted.length; i++) {
    const [season, startTime] = sorted[i];
    if (now >= startTime) currentSeason = season;
    else break;
  }
  return currentSeason;
}

// --- Utility: convert timestamp (ms or epoch) to relative time ---
function timeAgo(timestamp) {
  // Accept either number (ms) or numeric string or ISO string
  const then = (typeof timestamp === 'number') ? new Date(timestamp) : new Date(Number(timestamp) || timestamp);
  const now = new Date();
  const diffMs = now - then;

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;

  const months = Math.floor(days / 30.44);
  if (months < 12) return `${months}mo ago`;

  const years = Math.floor(days / 365.25);
  return `${years}y ago`;
}

// --- Utility: determine most played race ---
// Expects counts array in order: [protossCount, zergCount, terranCount, randomCount]
function mostPlayedRace(counts) {
  if (!Array.isArray(counts) || counts.length < 4) return "-";
  const races = ["Protoss", "Zerg", "Terran", "Random"];
  const max = Math.max(...counts);
  if (max === 0) return "-";
  const i = counts.indexOf(max);
  return races[i];
}

// Build a global rank map from ratings object (id -> rank number)
function buildGlobalRankMap(ratings) {
  const arr = Object.entries(ratings).map(([id, v]) => ({ id, mu: v[1] }));
  arr.sort((a, b) => b.mu - a.mu);
  const map = {};
  arr.forEach((p, idx) => map[p.id] = idx + 1); // 1-based rank
  return map;
}

// --- Main load logic for index.html leaderboard ---
document.addEventListener("DOMContentLoaded", async () => {
  const leaderboardTable = document.querySelector("#leaderboard");
  if (!leaderboardTable) return;
  const tbody = leaderboardTable.querySelector("tbody");
  if (!tbody) return;

  const currentSeason = await getCurrentSeason();
  const seasonLabelEl = document.getElementById("season-label");
  if (seasonLabelEl) seasonLabelEl.textContent = `Season ${currentSeason}`;

  const [ratings, names] = await Promise.all([
    fetch(`data/seasons/${currentSeason}/ratings.json`).then(r => r.json()),
    fetch("data/names.json").then(r => r.json())
  ]);

  // Convert ratings into player objects
  const allPlayers = Object.entries(ratings).map(([id, v]) => {
    const [games, mu, sigma, wins, pCount, tCount, zCount, rCount, ts] = v;
    const losses = games - wins;
    return { id, games, mu, sigma, wins, losses, races: [pCount, zCount, tCount, rCount], ts }; 
    // reorder races to match mostPlayedRace order: [Protoss, Zerg, Terran, Random]
  });

  const MIN_GAMES = 10;
  const eligiblePlayers = allPlayers
    .filter(p => p.games >= MIN_GAMES)
    .sort((a, b) => b.mu - a.mu);

  // Assign ranks
  eligiblePlayers.forEach((p, idx) => p.rank = idx + 1);

  // Render rows
  tbody.innerHTML = ""; // clear existing
  eligiblePlayers.forEach(p => {
    const race = mostPlayedRace(p.races);
    const playerName = names[p.id] || p.id;

const row = document.createElement("tr");
row.classList.add("clickable");

row.innerHTML = `
  <td>
    <a href="player.html?id=${p.id}" class="row-link">
      ${p.rank}
    </a>
  </td>
  <td>
    <a href="player.html?id=${p.id}" class="row-link">
      <span class="player-name" style="color:#89CFF0; font-size:1.2rem;">${playerName}</span><br>
      <span class="race-subtext" style="font-size:0.8rem; color:#aaa;">${race}</span>
    </a>
  </td>
  <td><a href="player.html?id=${p.id}" class="row-link">${p.mu.toFixed(2)}</a></td>
  <td><a href="player.html?id=${p.id}" class="row-link">${p.sigma.toFixed(2)}</a></td>
  <td><a href="player.html?id=${p.id}" class="row-link">${p.wins}-${p.losses}</a></td>
  <td><a href="player.html?id=${p.id}" class="row-link">${timeAgo(p.ts)}</a></td>
`;


tbody.appendChild(row);
  });

  // Update last updated timestamp
const lastUpdatedEl = document.getElementById("last-updated");
if (lastUpdatedEl) {
  try {
    const procData = await fetch("data/proc_data.json").then(r => r.json());
    const lastProcess = procData.last_process;
    // convert seconds → milliseconds if value looks too small
    const tsMs = lastProcess < 1e12 ? lastProcess * 1000 : lastProcess;
    const relTime = timeAgo(tsMs);

    lastUpdatedEl.innerHTML = 
      `Match data from <a href="https://shieldbattery.net" target="_blank" rel="noopener noreferrer" style="color:#89CFF0;">ShieldBattery.net</a>. Last updated ${relTime}.`;
  } catch (err) {
    console.error("Failed to load proc_data.json:", err);
    lastUpdatedEl.textContent = "Match data from ShieldBattery.net (last updated: unknown).";
  }
}
});