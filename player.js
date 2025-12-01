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












(function () {
  const toggleBtn = document.getElementById("toggleExtraStats");
  const extraStats = document.getElementById("extra-stats");
  const chartToggleBtn = document.getElementById("chartModeToggle");
  const extraChart1Label = document.getElementById("extraChart1Label");

  let chartLoaded = false;
  let chartInstance = null;
  let cachedData = null;

  function updateExtraChartLabel(text) {
    extraChart1Label.textContent = text;
  }

  // ----------------------------------------------------
  // Expandable section toggle
  // ----------------------------------------------------
  toggleBtn.addEventListener("click", () => {
    const opened = extraStats.classList.toggle("open");
    toggleBtn.textContent = opened
      ? "Hide additional statistics"
      : "Show additional statistics";

    if (opened && !chartLoaded) {
  const playerId = new URLSearchParams(window.location.search).get("id");
  if (playerId) {
    ensureChart(playerId);   // loads PWR chart
    loadMatchupChart(playerId); // loads PWM chart
    chartLoaded = true;
  }
}
  });

  // ----------------------------------------------------
  // Load Chart.js if missing
  // ----------------------------------------------------
  function ensureChart(playerId) {
    if (typeof Chart === "undefined") {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/chart.js";
      s.onload = () => initChart(playerId);
      document.head.appendChild(s);
    } else {
      initChart(playerId);
    }
  }











  // ----------------------------------------------------
  // Initialize chart
  // ----------------------------------------------------
  async function initChart(playerId) {
    cachedData = await loadPlayerData(playerId);
    if (!cachedData) return;

    // Default chart
    drawTotalChart(cachedData);
    updateExtraChartLabel("Total MMR Gained with Each Race");

    // INITIAL MODE
    chartToggleBtn.dataset.mode = "total";

    // Show button
    chartToggleBtn.style.display = "inline-block";

    // Toggle handler
    chartToggleBtn.addEventListener("click", switchChart);
  }

  // ----------------------------------------------------
  // Fetch season data once
  // ----------------------------------------------------
  async function loadPlayerData(playerId) {
    const season = await getCurrentSeason();
    const res = await fetchNoCache(`data/seasons/${season}/statistics_data.json`);
    if (!res.ok) return null;

    const data = await res.json();
    const player = data.pwr?.[playerId];
    if (!player) return null;

    function parse(entry) {
      if (!entry) return { total: 0, wins: 0, losses: 0, games: 0 };
      const [total, wins, losses] = entry;
      return {
        total: total ?? 0,
        wins: wins ?? 0,
        losses: losses ?? 0,
        games: (wins ?? 0) + (losses ?? 0)
      };
    }

    const p = parse(player.p);
    const t = parse(player.t);
    const z = parse(player.z);

    return {
      raw: { p, t, z },
      total: {
        p: p.total,
        t: t.total,
        z: z.total
      },
      perGame: {
        p: p.games > 0 ? p.total / p.games : 0,
        t: t.games > 0 ? t.total / t.games : 0,
        z: z.games > 0 ? z.total / z.games : 0
      }
    };
  }

  // ----------------------------------------------------
  // Switch chart type
  // ----------------------------------------------------
  function switchChart() {
    const mode = chartToggleBtn.dataset.mode;

    if (mode === "total") {
      drawPerGameChart(cachedData);
      updateExtraChartLabel("MMR Gained per Game with Each Race");
      chartToggleBtn.dataset.mode = "pergame";
      chartToggleBtn.textContent = "Show Total MMR Gained";
    } else {
      drawTotalChart(cachedData);
      updateExtraChartLabel("Total MMR Gained with Each Race");
      chartToggleBtn.dataset.mode = "total";
      chartToggleBtn.textContent = "Show MMR per Game";
    }
  }

  // ----------------------------------------------------
  // Destroy previous chart safely
  // ----------------------------------------------------
  function resetChart() {
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }
  }

  // ----------------------------------------------------
  // Chart A: Total MMR gained
  // ----------------------------------------------------
  function drawTotalChart(data) {
    resetChart();
    const ctx = document.getElementById("extraChart1").getContext("2d");

    chartInstance = new Chart(ctx, {
      type: "bar",
      data: {
        labels: ["Protoss", "Terran", "Zerg"],
        datasets: [{
          data: [data.total.p, data.total.t, data.total.z],
          backgroundColor: ["#EBD678", "#53B3FC", "#C1A3F5"]
        }]
      },
      options: chartOptions("total", data)
    });
  }

  // ----------------------------------------------------
  // Chart B: MMR per game
  // ----------------------------------------------------
  function drawPerGameChart(data) {
    resetChart();
    const ctx = document.getElementById("extraChart1").getContext("2d");

    chartInstance = new Chart(ctx, {
      type: "bar",
      data: {
        labels: ["Protoss", "Terran", "Zerg"],
        datasets: [{
          data: [data.perGame.p, data.perGame.t, data.perGame.z],
          backgroundColor: ["#EBD678", "#53B3FC", "#C1A3F5"]
        }]
      },
      options: chartOptions("pergame", data)
    });
  }

  // ----------------------------------------------------
  // Shared chart styling
  // ----------------------------------------------------
  function chartOptions(mode, playerStats, barThickness = 56) {

  // Create tooltip element once
  let tooltipEl = document.getElementById("bar-tooltip");
  if (!tooltipEl) {
    tooltipEl = document.createElement("div");
    tooltipEl.id = "bar-tooltip";
    Object.assign(tooltipEl.style, {
      position: "absolute",
      background: "rgba(0,0,0,0.85)",
      color: "#ddd",
      borderRadius: "6px",
      padding: "7px 9px",
      pointerEvents: "none",
      fontSize: "13px",
      whiteSpace: "nowrap",
      transition: "opacity 0.1s ease",
      opacity: 0,
      zIndex: 1000
    });
    document.body.appendChild(tooltipEl);
  }

  const raceColors = {
    Protoss: "#EBD678",
    Terran: "#53B3FC",
    Zerg:   "#C1A3F5"
  };

  const labelToKey = { Protoss: "p", Terran: "t", Zerg: "z" };

  return {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: "y",

    datasets: {
      bar: {
        barThickness: barThickness
      }
    },

    plugins: {
      legend: { display: false },

      tooltip: {
        enabled: false,

        external: ctx => {
          const tooltip = ctx.tooltip;

          // Hide tooltip when not hovering
          if (!tooltip || !tooltip.opacity) {
            tooltipEl.style.opacity = 0;
            return;
          }

          const dp = tooltip.dataPoints?.[0];
          if (!dp) return;

          const race = dp.label;
          const key = labelToKey[race];
          const stats = playerStats.raw[key];

          const { total, wins, losses, games } = stats;
          const wr = games > 0 ? (wins / games) * 100 : 0;
          const wrTxt = wr.toFixed(1) + "%";
          const color = raceColors[race];

          const plural = (n, w) =>
            w === "loss" ? (n === 1 ? "loss" : "losses") : (n === 1 ? w : w + "s");

          let mmrValue = mode === "total" ? total : (games > 0 ? total / games : 0);
          let mmrLabel =
            mmrValue < 0
              ? (mode === "total" ? "MMR lost" : "MMR lost per game")
              : (mode === "total" ? "MMR gained" : "MMR gained per game");

          const mmrAbs = Math.abs(mmrValue).toFixed(2);

          // -----------------------------------------------------------
          // HTML (two-line layout)
          // -----------------------------------------------------------
          let html = `
            <div style="display:flex; align-items:center; font-weight:bold;">
              <span style="
                width:10px;height:10px;
                background:${color};
                display:inline-block;
                border-radius:2px;
                margin-right:6px;
              "></span>
              <span>${race}</span>
            </div>

            <div style="
              margin-top:4px;
              margin-left:16px;
              font-family:monospace;
              opacity:0.85;
            ">
              ${wins} ${plural(wins,"win")}, ${losses} ${plural(losses,"loss")}, ${wrTxt}. 
              ${mmrAbs} ${mmrLabel}.
            </div>
          `;

          tooltipEl.innerHTML = html;

          // -----------------------------------------------------------
          // Accurate mouse positioning (REAL cursor position)
          // -----------------------------------------------------------

          const rect = ctx.chart.canvas.getBoundingClientRect();

          // Tooltip stores the exact mouse coordinates here
          const mouse = ctx.chart.tooltip?._eventPosition;

          let x = tooltip.caretX;
          let y = tooltip.caretY;

          if (mouse) {
            x = mouse.x;
            y = mouse.y;
          }

          const pageX = rect.left + window.pageXOffset + x;
          const pageY = rect.top + window.pageYOffset + y;

          tooltipEl.style.left = (pageX + 14) + "px";
          tooltipEl.style.top  = (pageY - 12) + "px";
          tooltipEl.style.opacity = 1;
        }
      }
    },

    scales: {
      x: {
        beginAtZero: true,
        grid: { display: true, color: "#222222" },
        ticks: { color: "#AAAAAA" }
      },
      y: {
        ticks: { color: "#AAAAAA" }
      }
    }
  };
}



/* pwm starter her */

















let matchupChartInstance = null;
let matchupDataCache = null;

async function loadMatchupChart(playerId) {
  const season = await getCurrentSeason();
  const res = await fetchNoCache(`data/seasons/${season}/statistics_data.json`);
  if (!res.ok) return;

  const data = await res.json();
  const matchups = data.pwm?.[playerId];
  if (!matchups) return;

  matchupDataCache = parseMatchupData(matchups);
  drawMatchupChartTotal(matchupDataCache);

  const labelEl = document.getElementById("extraChart2Label");
  const toggleEl = document.getElementById("chartModeToggle2");

  labelEl.textContent = "Total MMR Gained with Each Team Comp.";
  toggleEl.dataset.mode = "total";
  toggleEl.style.display = "inline-block";

  toggleEl.addEventListener("click", () => {
    const mode = toggleEl.dataset.mode;
    if (mode === "total") {
      drawMatchupChartPerGame(matchupDataCache);
      labelEl.textContent = "MMR Gained per Game with Each Team Comp.";
      toggleEl.dataset.mode = "pergame";
      toggleEl.textContent = "Show Total MMR Gained";
    } else {
      drawMatchupChartTotal(matchupDataCache);
      labelEl.textContent = "Total MMR Gained with Each Team Comp.";
      toggleEl.dataset.mode = "total";
      toggleEl.textContent = "Show MMR per Game";
    }
  });
}

// ======================================================================
// Parse pwm → usable list
// ======================================================================
function parseMatchupData(obj) {
function asLabel(key) {
  if (!key || key.length < 3) return "";

  const playerRace = key[0].toUpperCase();
  const r1 = key[1].toUpperCase();
  const r2 = key[2].toUpperCase();

  // If the two teammate letters are identical: parenthesize the first and show the second
  if (r1 === r2) {
    return `(${r1})${r2}`;
  }

  // If r1 matches the player's race, show it first (parenthesized) then the other
  if (r1 === playerRace) {
    return `(${r1})${r2}`;
  }

  // If r2 matches the player's race, show r2 first (parenthesized) then r1
  if (r2 === playerRace) {
    return `(${r2})${r1}`;
  }

  // Fallback: neither matches playerRace — parenthesize the first teammate and show the second
  return `(${r1})${r2}`;
}

  const entries = Object.entries(obj).map(([key, arr]) => {
    const [mmr, wins, losses] = arr ?? [0,0,0];
    const games = (wins ?? 0) + (losses ?? 0);

    return {
      key,
      label: asLabel(key),
      total: mmr ?? 0,
      wins: wins ?? 0,
      losses: losses ?? 0,
      games,
      perGame: games > 0 ? (mmr / games) : 0
    };
  });

  entries.sort((a,b) => b.total - a.total);
  return entries;
}

// ======================================================================
// Chart rendering
// ======================================================================
function resetMatchupChart() {
  if (matchupChartInstance) {
    matchupChartInstance.destroy();
    matchupChartInstance = null;
  }
}

function drawMatchupChartTotal(list) {
  resetMatchupChart();

  const ctx = document.getElementById("extraChart2").getContext("2d");
  const thickness = calcBarThickness(list.length);

  matchupChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: list.map(x => x.label),
      datasets: [{
        data: list.map(x => x.total),
        backgroundColor: list.map(x => matchupColor(x.key)),
        barThickness: thickness,       // ← dynamic thickness
        maxBarThickness: 44            // ← safety cap (optional)
      }]
    },
    options: matchupChartOptions("total", list, thickness)
  });
}

function drawMatchupChartPerGame(list) {
  resetMatchupChart();

  const ctx = document.getElementById("extraChart2").getContext("2d");
  const thickness = calcBarThickness(list.length);

  matchupChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: list.map(x => x.label),
      datasets: [{
        data: list.map(x => x.perGame),
        backgroundColor: list.map(x => matchupColor(x.key)),
        barThickness: thickness,
        maxBarThickness: 44
      }]
    },
    options: matchupChartOptions("pergame", list, thickness)
  });
}

// ======================================================================
// Colors
// ======================================================================
function matchupColor(key) {
  const race = key[0];
  return {
    p: "#EBD678",
    t: "#53B3FC",
    z: "#C1A3F5"
  }[race] ?? "#999";
}


function calcBarThickness(listLength) {
  const max = 44;
  const quota = 132;
  if (listLength <= 0) return max;
  return Math.min(max, Math.floor(quota / listLength));
}

// ======================================================================
// Tooltip + chart options
// ======================================================================
function matchupChartOptions(mode, list, barThickness = 44) {
  let tooltipEl = document.getElementById("bar-tooltip-matchups");
  if (!tooltipEl) {
    tooltipEl = document.createElement("div");
    tooltipEl.id = "bar-tooltip-matchups";
    Object.assign(tooltipEl.style, {
      position: "absolute",
      background: "rgba(0,0,0,0.85)",
      color: "#ddd",
      borderRadius: "6px",
      padding: "7px 9px",
      pointerEvents: "none",
      fontSize: "13px",
      whiteSpace: "nowrap",
      transition: "opacity 0.1s ease",
      opacity: 0,
      zIndex: 1000
    });
    document.body.appendChild(tooltipEl);
  }

  return {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: "y",

    datasets: {
      bar: {
        // Uses the barThickness parameter from the function signature
        barThickness,
        // Integrated from the first function's options
        maxBarThickness: 44
      }
    },

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

          const dp = tooltip.dataPoints?.[0];
          if (!dp) return;

          const entry = list[dp.dataIndex];
          const { label, wins, losses, games, total, perGame } = entry;

          const wr = games > 0 ? (wins / games) * 100 : 0;
          const mmrValue = mode === "total" ? total : perGame;
          const mmrAbs = Math.abs(mmrValue).toFixed(2);
          const mmrLabel =
            mmrValue < 0
              ? (mode === "total" ? "MMR lost" : "MMR lost per game")
              : (mode === "total" ? "MMR gained" : "MMR gained per game");

          tooltipEl.innerHTML = `
            <div style="font-weight:bold;">${label}</div>
            <div style="margin-top:4px; font-family:monospace; opacity:0.85;">
              ${wins} wins, ${losses} losses, ${wr.toFixed(1)}%<br>
              ${mmrAbs} ${mmrLabel}
            </div>
          `;

          const rect = ctx.chart.canvas.getBoundingClientRect();
          const mouse = ctx.chart.tooltip?._eventPosition;
          const x = mouse ? mouse.x : tooltip.caretX;
          const y = mouse ? mouse.y : tooltip.caretY;

          tooltipEl.style.left = (rect.left + window.pageXOffset + x + 14) + "px";
          tooltipEl.style.top  = (rect.top + window.pageYOffset + y - 12) + "px";
          tooltipEl.style.opacity = 1;
        }
      }
    },

    scales: {
      x: {
        beginAtZero: true,
        grid: { color: "#222" },
        ticks: { color: "#AAA" }
      },
      y: {
        ticks: { color: "#AAA" }
      }
    }
  };
}




/* slutten av pwm */







})();