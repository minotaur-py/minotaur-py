// player.js
// Assumes script.js is loaded first and provides:
// getCurrentSeason(), timeAgo(), mostPlayedRace()

async function loadPlayerPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const playerId = urlParams.get("id");
  if (!playerId) return;

  const currentSeason = await getCurrentSeason();

  const [playerData, names, maps, ratings] = await Promise.all([
    fetchNoCache(`data/seasons/${currentSeason}/players/${playerId}.json`).then(r => r.json()),
    fetchNoCache("data/names.json").then(r => r.json()),
    fetchNoCache("data/maps.json").then(r => r.json()),
    fetchNoCache(`data/seasons/${currentSeason}/ratings.json`).then(r => r.json())
  ]);

  const playerName = names[playerId] || playerId;
  document.getElementById("playerNameHeader").textContent = playerName;

  // --- Get full player stats ---
  const allPlayers = Object.entries(ratings).map(([id, v]) => {
    const [games, mu, sigma, wins, p, t, z, r_, ts, , pW, tW, zW, rW, , rPw, rTw, rZw, rPl, rTl, rZl] = v;
    return { 
      id, games, mu, sigma, wins, 
      races: [p, t, z, r_], 
      winsByRace: [pW, tW, zW, rW],
      randomSubWins: [rPw, rTw, rZw],
      randomSubLosses: [rPl, rTl, rZl]
    };
  });

  const MIN_GAMES = 10;
  const eligiblePlayers = allPlayers.filter(p => p.games >= MIN_GAMES).sort((a, b) => b.mu - a.mu);
  const playerStats = allPlayers.find(p => p.id === playerId);
  if (!playerStats) return;

  const rankPlayer = eligiblePlayers.find(p => p.id === playerId);
  const rank = rankPlayer ? eligiblePlayers.indexOf(rankPlayer) + 1 : "—";
  const mmr = playerStats.mu.toFixed(2);
  const winrate = ((playerStats.wins / playerStats.games) * 100).toFixed(1);

  const losses = playerStats.games - playerStats.wins;
  const mmrUncertainty = playerStats.sigma.toFixed(2);

const countsForFunction = [
  playerStats.races[0], // Protoss
  playerStats.races[2], // Zerg
  playerStats.races[1], // Terran
  playerStats.races[3]  // Random
];

const mostPlayed = mostPlayedRace(countsForFunction);


const raceColors = {
  Protoss: "#EBD678",
  Terran: "#53B3FC",
  Zerg: "#C1A3F5",
  Random: "#AABBCB"
};
const mostPlayedColor = raceColors[mostPlayed] || "#AABBCB"; // Fallback to Random/Grey if race not found


const raceDisplayHTML = `
  <span style="
    display: inline-block;
    width: 10px;
    height: 10px;
    background: ${mostPlayedColor};
    border-radius: 2px;
    margin-right: 6px;
    vertical-align: middle;
  "></span>
  ${mostPlayed}
`;



const statsHTML = `
  <div style="font-size:0.86em; line-height:1.85; color:#ccc;">
    <table style="width:100%; border-collapse: collapse;">
     
       <tr>
        <td style="text-align: left; padding: 0;">Rank:</td>
        <td style="text-align: right; padding: 0;">${rank}</td>
      </tr>
      <tr>
        <td style="text-align: left; padding: 0;">MMR:</td>
        <td style="text-align: right; padding: 0;">${mmr}</td>
      </tr>
      <tr>
        <td style="text-align: left; padding: 0;">MMR Uncertainty:</td>
        <td style="text-align: right; padding: 0;">${mmrUncertainty}</td>
      </tr>
      <tr>
        <td style="text-align: left; padding: 0;">Win Rate:</td>
        <td style="text-align: right; padding: 0;">${playerStats.games}G ${playerStats.wins}W ${losses}L ${winrate}%</td>
      </tr>
      <!--<tr>
        <td style="text-align: left; padding: 0;">Most Played Race:</td>
        <td style="text-align: right; padding: 0;">${raceDisplayHTML}</td>
      </tr> -->
    </table>
  </div>
`;

// Inject HTML into the page
const overviewEl = document.getElementById("playeroverview-text");
if (overviewEl) {
  overviewEl.innerHTML = statsHTML;
}

/*
// --- Determine most played race ---
const races = ["protoss", "terran", "zerg", "random"];
const mostPlayedIndex = playerStats.races.indexOf(Math.max(...playerStats.races));
let mainRace = races[mostPlayedIndex];
if (mainRace === "random") {
  const base = ["protoss", "terran", "zerg"];
  mainRace = base[Math.floor(Math.random() * base.length)];
}

// --- Apply background image ---
const overviewBox = document.querySelector(".overview-info");
if (overviewBox) {
  overviewBox.style.backgroundImage = `url(assets/${mainRace}.webp)`;
  overviewBox.style.backgroundSize = "cover";
  overviewBox.style.backgroundPosition = "center";
  overviewBox.style.backgroundBlendMode = "overlay";
  overviewBox.style.backgroundColor = "#1c1c1caa";
}
*/
  // --- Race Pie Chart ---
// --- Race Pie Chart ---
const ctx = document.getElementById("raceChart")?.getContext?.("2d");
function drawRaceChart() {
  if (!ctx) return;
  if (typeof Chart === "undefined") {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/chart.js";
    s.onload = drawRaceChart;
    document.head.appendChild(s);
    return;
  }

  const races = ["Protoss", "Terran", "Zerg", "Random"];
  const raceColors = {
    Protoss: "#EBD678",
    Terran: "#53B3FC",
    Zerg: "#C1A3F5",
    Random: "#AABBCB"
  };

  const raceCounts = playerStats.races;
  const raceWins = playerStats.winsByRace;
  const raceWinrates = raceCounts.map((count, i) =>
    count > 0 ? ((raceWins[i] / count) * 100).toFixed(1) : 0
  );

  // Create custom tooltip container
  let tooltipEl = document.getElementById("pie-tooltip");
  if (!tooltipEl) {
    tooltipEl = document.createElement("div");
    tooltipEl.id = "pie-tooltip";
    Object.assign(tooltipEl.style, {
      position: "absolute",
      background: "rgba(0,0,0,0.85)",
      color: "#ddd",
      borderRadius: "6px",
      padding: "8px 10px",
      pointerEvents: "none",
      fontSize: "13px",
      whiteSpace: "nowrap",
      transition: "all 0.1s ease",
      zIndex: 1000
    });
    document.body.appendChild(tooltipEl);
  }

  new Chart(ctx, {
    type: "pie",
    data: {
      labels: races,
      datasets: [{
        data: raceCounts,
        backgroundColor: races.map(r => raceColors[r]),
        borderColor: "#222",
        borderWidth: 0
      }]
    },
    options: {
      plugins: {
        legend: {
          position: 'top',
          align: 'start',
          labels: { color: "#ddd" }
        },
        tooltip: {
          enabled: false,
         external: ctx => {
  const tooltip = ctx.tooltip;
  if (!tooltip || !tooltip.opacity) {
    tooltipEl.style.opacity = 0;
    return;
  }

  const index = tooltip.dataPoints?.[0]?.dataIndex;
  if (index == null) return;

  const race = races[index];
  const color = raceColors[race];
  const games = raceCounts[index];
  const wins = raceWins[index];
  const losses = games - wins;
  const rate = raceWinrates[index];

  // pluralization helper
  const plural = (n, word) => {
    if (word === "loss") return n === 1 ? "loss" : "losses";
    return n === 1 ? word : word + "s";
  };

// --- Main race line ---
let html = `
  <div style="display:grid;grid-template-columns:auto 1fr auto;column-gap:8px;align-items:center;font-weight:bold;">
    <span style="width:10px;height:10px;background:${color};display:inline-block;border-radius:2px;"></span>
    <span>${race}: ${wins} ${plural(wins, "win")}, ${losses} ${plural(losses, "loss")}</span>
    <span style="text-align:right;min-width:50px;">${rate}%</span>
  </div>
`;


  // --- Random subrace breakdowns ---
if (race === "Random") {
  const subRaces = ["Protoss", "Terran", "Zerg"];
  subRaces.forEach((sr, idx) => {
    const w = playerStats.randomSubWins[idx];
    const l = playerStats.randomSubLosses[idx];
    const total = w + l;
    const subRate = total > 0 ? ((w / total) * 100).toFixed(1) : 0;
    const subColor = raceColors[sr];

    html += `
      <div style="
        display:grid;
        grid-template-columns:5px 110px 50px 90px 50px;
        column-gap:8px;
        align-items:center;
        font-family: monospace;
        margin-top:2px;
        margin-left:24px;
      ">
        <span style="width:8px;height:8px;background:${subColor};
          display:inline-block;border-radius:2px;opacity:0.9;"></span>

        <span style="opacity:0.85;">Random → ${sr}</span>

        <span style="text-align:right;min-width:65px;opacity:0.85;">
          ${w} ${plural(w,"win")}
        </span>
        <span style="text-align:right;min-width:75px;opacity:0.85;">
          ${l} ${plural(l,"loss")}
        </span>

        <span style="text-align:right;min-width:50px;opacity:0.85;
          font-weight:bold;">${subRate}%</span>
      </div>
    `;
  });
}

  tooltipEl.innerHTML = html;

  const rect = ctx.chart.canvas.getBoundingClientRect();
  tooltipEl.style.opacity = 1;
  tooltipEl.style.left = rect.left + window.pageXOffset + tooltip.caretX + 12 + "px";
  tooltipEl.style.top = rect.top + window.pageYOffset + tooltip.caretY + "px";
}
        }
      }
    }
  });
}
drawRaceChart();

  // --- Helper for race normalization ---
  function normalizeRace(race) {
    if (!race) return "";
    race = race.toLowerCase();
    if (["p", "pp"].includes(race)) return "p";
    if (["t", "tt"].includes(race)) return "t";
    if (["z", "zz"].includes(race)) return "z";
    if (["r", "rr"].includes(race)) return "r";
    if (["rp", "rt", "rz"].includes(race)) return race;
    return "unknown";
  }

  // --- MMR Chart with HTML tooltip ---
  const mmrCanvas = document.getElementById("mmrChart");
  if (mmrCanvas && playerData && playerData.length > 0) {
    const mmrCtx = mmrCanvas.getContext("2d");
    const mmrValues = playerData.map(m => m.mmr);
    const gameIndices = mmrValues.map((_, i) => i + 1);

    // Normalize match metadata
    const matchMeta = playerData.map(match => ({
winners: match.winners.map(([id, race, mu, sigma, muChange]) => ({
  name: names[id] || id,
  race: normalizeRace(race),
  mu,
  muChange
})),
losers: match.losers.map(([id, race, mu, sigma, muChange]) => ({
  name: names[id] || id,
  race: normalizeRace(race),
  mu,
  muChange
}))
    }));

    const raceInfo = {
      p:  { name: "Protoss", color: "#EBD678" },
      t:  { name: "Terran",  color: "#53B3FC" },
      z:  { name: "Zerg",    color: "#C1A3F5" },
      r:  { name: "Random",  color: "#AABBCB" },
      rp: { name: "Random → Protoss", color: "#EBD678" },
      rt: { name: "Random → Terran",  color: "#53B3FC" },
      rz: { name: "Random → Zerg",    color: "#C1A3F5" },
      unknown: { name: "Unknown", color: "#999" }
    };

    function drawMMRChart() {
      if (typeof Chart === "undefined") {
        const s = document.createElement("script");
        s.src = "https://cdn.jsdelivr.net/npm/chart.js";
        s.onload = drawMMRChart;
        document.head.appendChild(s);
        return;
      }

      // Create tooltip element once
      let tooltipEl = document.getElementById("chartjs-tooltip");
      if (!tooltipEl) {
        tooltipEl = document.createElement("div");
        tooltipEl.id = "chartjs-tooltip";
        Object.assign(tooltipEl.style, {
          position: "absolute",
          background: "rgba(0,0,0,0.85)",
          color: "#ddd",
          borderRadius: "6px",
          padding: "8px 10px",
          pointerEvents: "none",
          whiteSpace: "nowrap",
          fontSize: "13px",
          transition: "all 0.1s ease"
        });
        document.body.appendChild(tooltipEl);
      }

      new Chart(mmrCtx, {
        type: "line",
        data: {
          labels: gameIndices,
          datasets: [{
            label: "MMR",
            data: mmrValues,
            borderColor: "#3b82f6",
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 5,
            hitRadius: 30,
            pointBackgroundColor: "#3b82f6",
            tension: 0.25,
            fill: false
          }]
        },
        options: {
          plugins: {
            legend: { display: false },
            tooltip: {
              enabled: false,
              external: ctx => {
                const tooltip = ctx.tooltip;
                if (!tooltip || !tooltip.opacity) {
                  tooltipEl.style.opacity = 0;
                  return;
                }

                const indices = (tooltip.dataPoints || []).map(dp => dp.dataIndex);
                if (!indices.length) return;

                const index = indices[indices.length - 1];
                const meta = matchMeta[index];
                if (!meta) return;

                const fmtTeam = (team, label, isWinner) => {
  if (!team?.length) return "";
  const players = team.map(p => {
    const info = raceInfo[p.race] || raceInfo.unknown;
    const baseColor = isWinner ? "#34D399" : "#F87171";
    const change = p.muChange > 0 ? `+${p.muChange.toFixed(1)}` : p.muChange.toFixed(1);
    const changeColor = isWinner ? "#34D399" : "#F87171";
    const mmrAfter = (p.mu).toFixed(1);
    const mmrBefore = (p.mu - p.muChange).toFixed(1);

    return `
      <div style="
        display: grid;
        grid-template-columns: auto 1fr min-content;
        align-items: center;
        column-gap: 8px;
        font-family: monospace;
        margin-bottom: 2px;
        white-space: nowrap;
      ">
        <span style="color:${info.color};">■</span>
        <span style="
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 265px;
          display: inline-block;
        ">${p.name} (${info.name})</span>
        <span style="text-align: right; min-width: 85px;">
          ${mmrAfter}
        <span style="color:white;">(</span><span style="color:${changeColor};">${change}</span><span style="color:white;">)</span>

        </span>
      </div>`;
  }).join("");
  return `<div style="margin-top:4px;"><strong>${label}:</strong>${players}</div>`;
};

           tooltipEl.innerHTML = `
  <div style="font-weight:bold;color:#fff;">Game ${index + 1}</div>
  ${fmtTeam(meta.winners, "Winners", true)}
  ${fmtTeam(meta.losers, "Losers", false)}
`;

                const rect = ctx.chart.canvas.getBoundingClientRect();
                tooltipEl.style.opacity = 1;
                tooltipEl.style.left = rect.left + window.pageXOffset + tooltip.caretX + 12 + "px";
                tooltipEl.style.top = rect.top + window.pageYOffset + tooltip.caretY + "px";
              }
            }
          },
          scales: {
            x: {
              title: { display: true, text: "Games", color: "#ccc" },
              ticks: { display: true, autoSkip: true,
      maxTicksLimit: 32 },
              grid: { color: "#333" }
            },
            y: {
              title: { display: true, text: "MMR", color: "#ccc" },
              ticks: { color: "#ccc" },
              grid: { color: "#333" }
            }
          }
        }
      });
    }

    drawMMRChart();
  }

  // --- Match list rendering ---
  const container = document.getElementById("matches");
  if (!container) return;

  function raceIcon(race) {
    const base = "icons";
    if (!race) return `${base}/unknown.png`;
    const raceMap = { tt: "t", pp: "p", zz: "z", rt: "r_t", rp: "r_p", rz: "r_z" };
    const key = raceMap[race.toLowerCase()] || "unknown";
    return `${base}/${key}.png`;
  }

  function playerCard(p) {
    const [id, race, mu, sigma, muChange] = p;
    const name = names[id] || id;
    const rating = Number(mu).toFixed(2);
    const formattedChange = (muChange > 0 ? `+${muChange.toFixed(2)}` : muChange.toFixed(2));
    const changeColor = muChange > 0 ? "#34D399" : muChange < 0 ? "#F87171" : "white";

    return `
      <div class="player-card">
        <img src="${raceIcon(race)}" class="race-icon">
        <a href="player.html?id=${id}" class="player-name">${name}</a>
        <div class="player-rating">${rating}</div>
        <div class="player-change" style="color:${changeColor}">${formattedChange}</div>
      </div>
    `;
  }

  container.innerHTML = "";
  (playerData || []).slice().reverse().forEach(match => {
    const isWin = match.winners.some(p => p[0] == playerId);
    const status = isWin ? "Win" : "Loss";
    const color = isWin ? "#34D399" : "#F87171";

    const leftTeam = isWin ? match.winners : match.losers;
    const rightTeam = isWin ? match.losers : match.winners;
    const leftPlayers = leftTeam.map(p => playerCard(p)).join("");
    const rightPlayers = rightTeam.map(p => playerCard(p)).join("");

    const timeString = timeAgo(match.end_time);
    const durationSec = Math.round((match.game_length || 0) / 1000);
    const minutes = Math.floor(durationSec / 60);
    const seconds = durationSec % 60;
    const duration = `${minutes}:${seconds.toString().padStart(2, "0")} min`;
    const mapName = maps[match.map_id] || match.map_id;

    const row = document.createElement("div");
    row.className = "match-row";
    row.innerHTML = `
      <div class="match-status" style="color:${color}">
        ${status}<br><span class="ago">${timeString}</span>
      </div>
      <div class="team-column">${leftPlayers}</div>
      <div class="spacer"></div>
      <div class="team-column">${rightPlayers}</div>
      <div class="spacer"></div>
      <div class="match-info">
        <div>${mapName}</div>
        <div class="duration">${duration}</div>
      </div>
    `;
    container.appendChild(row);
  });
}

if (window.location.pathname.includes("player.html")) {
  loadPlayerPage();
}
