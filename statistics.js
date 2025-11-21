




/* CHART 1  */


async function loadActivityChart() {
  const currentSeason = await getCurrentSeason().catch(() => 0);
  const res = await fetchNoCache(`data/seasons/${currentSeason}/statistics_data.json`);
  const data = await res.json();
  const timestamps = data.activity || [];

  const dates = timestamps.map(ts => new Date(ts)).sort((a, b) => a - b);
  if (!dates.length) return;

// Convert all activity timestamps to UTC-normalized dates
const datesUTC = timestamps
  .map(ts => new Date(ts))
  .sort((a, b) => a - b);

// 1. Anchor earliest date to UTC midnight
const first = datesUTC[0];
const startUTC = new Date(Date.UTC(
  first.getUTCFullYear(),
  first.getUTCMonth(),
  first.getUTCDate()
));

// 2. Convert Sunday (0) to 7 so Monday is week start
const weekday = startUTC.getUTCDay() === 0 ? 7 : startUTC.getUTCDay();

// 3. Move to Monday of that week
startUTC.setUTCDate(startUTC.getUTCDate() - weekday + 1);

// 4. Build week buckets in UTC (no local timezone involved)
const nowUTC = new Date();
const weekBuckets = {};

for (
  let d = new Date(startUTC);
  d <= nowUTC;
  d.setUTCDate(d.getUTCDate() + 7)
) {
  const key = d.toISOString().slice(0, 10);
  weekBuckets[key] = 0;
}

// 5. Assign activity items into their correct UTC week
for (const date of datesUTC) {
  const weekStartUTC = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  ));
  const wd = weekStartUTC.getUTCDay() === 0 ? 7 : weekStartUTC.getUTCDay();
  weekStartUTC.setUTCDate(weekStartUTC.getUTCDate() - wd + 1);

  const key = weekStartUTC.toISOString().slice(0, 10);
  if (key in weekBuckets) weekBuckets[key]++;
}


/* Lager kunstige uker som starter på sesongstarts-datoen
  for (const date of dates) {
    const weekStart = new Date(date);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
    weekStart.setHours(0, 0, 0, 0);
    const key = weekStart.toISOString().slice(0, 10);
    if (key in weekBuckets) weekBuckets[key]++;
  }
*/


  const labels = Object.keys(weekBuckets);
  const counts = Object.values(weekBuckets);

  Chart.defaults.color = "#ccc";
  Chart.defaults.borderColor = "#333";

new Chart(document.getElementById("activityChart"), {
  type: "bar",
  data: {
    labels,
    datasets: [{
      label: "Games Played",
      data: counts,
      backgroundColor: "rgba(255,111,60,0.7)",
      borderColor: "#FF6F3C",
      borderWidth: 1,
      borderRadius: 6
    }]
  },
  options: {
    scales: {
      x: {
        title: { display: true, text: "Week starting" },
        grid: { color: "#222" }
      },
      y: {
        title: { display: true, text: "Games" },
        beginAtZero: true,
        grid: { color: "#222" }
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: function() {
            return ""; // removes the header
          },
          label: function(context) {
            return context.raw + " games"; // just show number of games
          }
        }
      }
    }
  }
});
}





/* CHART 2 WEEKS */



async function loadActivityWeekdayChart() {
  // 1. Load season + activity timestamps
  const currentSeason = await getCurrentSeason().catch(() => 0);
  const res = await fetchNoCache(`data/seasons/${currentSeason}/statistics_data.json`);
  const data = await res.json();
  const timestamps = data.activity || [];

  if (!timestamps.length) return;

  // 2. Convert to UTC Date objects and sort
  const datesUTC = timestamps.map(ts => new Date(ts));
  datesUTC.sort((a, b) => a - b);

  // 3. Weekday buckets: Monday–Sunday
  const weekdayBuckets = Array(7).fill(0);
  for (const d of datesUTC) {
    const jsDay = d.getUTCDay(); // 0=Sun … 6=Sat
    const weekdayIndex = (jsDay + 6) % 7; // shift: 0=Mon … 6=Sun
    weekdayBuckets[weekdayIndex]++;
  }

  // 4. Compute number of weeks spanned
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weeksSpan = Math.max(1, (datesUTC[datesUTC.length - 1] - datesUTC[0]) / msPerWeek);

  // 5. Compute per-weekday averages
  const weekdayAverages = weekdayBuckets.map(count => count / weeksSpan);

  // 6. Labels
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  // 7. Draw chart with averages as main data
  const ctx = document.getElementById("activityWeekdayChart").getContext("2d");

  new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Average games per weekday",
        data: weekdayAverages,
        borderWidth: 2,
        borderColor: "#FF6F3C",
        backgroundColor: "rgba(255,111,60,0.7)"
      }]
    },
    options: {
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true,
          callbacks: {
            label: (ctx) => {
              const i = ctx.dataIndex;
              const avg = weekdayAverages[i].toFixed(2);
              const total = weekdayBuckets[i];
              return [`Avg per week: ${avg}`, `Total games: ${total}`];
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: "#222" }
        },
        y: {
          beginAtZero: true,
          grid: { color: "#222" },
          ticks: {
            precision: 2 // decimals for averages
          }
        }
      }
    }
  });
}


















/* Chart 3   time of day activity     */


async function loadActivityClockChart() {
  const currentSeason = await getCurrentSeason().catch(() => 0);
  const res = await fetchNoCache(`data/seasons/${currentSeason}/statistics_data.json`);
  const data = await res.json();
  const timestamps = data.activity || [];

  if (!timestamps.length) return;

  const datesUTC = timestamps.map(ts => new Date(ts));

  // Count games by hour (UTC)
  const hourBuckets = Array(24).fill(0);
  for (const d of datesUTC) {
    hourBuckets[d.getUTCHours()]++;
  }

  const totalGames = hourBuckets.reduce((a, b) => a + b, 0);

  const labels = [...Array(24).keys()].map(h => `${h}`);

  new Chart(document.getElementById("activityChartB"), {
    type: "radar",
    data: {
      labels,
      datasets: [{
        data: hourBuckets,
        borderWidth: 2,
        borderColor: "#FF6F3C",
        backgroundColor: "rgba(255,111,60,0.7)"
      }]
    },
    options: {
      plugins: {
        legend: { display: false },
        tooltip: {
          // Remove the title by returning an empty string
          callbacks: {
            title: function() { return ""; },
            label: function(context) {
              const hour = parseInt(context.label);
              const count = context.raw;
              const pct = totalGames ? ((count / totalGames) * 100).toFixed(1) : 0;
              const hourStart = hour.toString().padStart(2, '0') + "00";
              const hourEnd = ((hour + 1) % 24).toString().padStart(2, '0') + "00";
              return `${hourStart} - ${hourEnd} UTC: ${count} games (${pct}%)`;
            }
          }
        }
      },
      interaction: {
        mode: 'nearest',    // could also try 'index'
        intersect: false    // allows hovering anywhere along the radial line to trigger the tooltip
      },
      scales: {
        r: {
          angleLines: { color: "#333" },
          grid: { color: "#222" },
          ticks: { display: false, backdropColor: "transparent" }
        }
      }
    }
  });
}

















/* CHART 4  */


async function loadIndividualRaceSelectionChart() {
  const currentSeason = await getCurrentSeason().catch(() => 0);
  const res = await fetchNoCache(`data/seasons/${currentSeason}/statistics_data.json`);
  const data = await res.json();
  const irs = data.irs || {};

  const raceOrder = ["p", "t", "z", "r"];
  const raceNames = { p: "Protoss", t: "Terran", z: "Zerg", r: "Random" };
  const raceColors = { p: "#EBD678", t: "#53B3FC", z: "#C1A3F5", r: "#AABBCB" };

  const labels = raceOrder.map(r => raceNames[r]);
  const values = raceOrder.map(r => irs[r]?.[0] || 0); // wins
  const colors = raceOrder.map(r => raceColors[r]);

  let tooltipEl = document.getElementById("irs-tooltip");
  if (!tooltipEl) {
    tooltipEl = document.createElement("div");
    tooltipEl.id = "irs-tooltip";
    Object.assign(tooltipEl.style, {
      position: "absolute",
      background: "rgba(0,0,0,0.85)",
      border: "1px solid #333",
      borderRadius: "6px",
      color: "#ddd",
      padding: "8px 12px",
      fontSize: "0.85em",
      pointerEvents: "none",
      boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
      zIndex: 10,
      opacity: 0,
      transition: "opacity 0.1s ease"
    });
    document.body.appendChild(tooltipEl);
  }

 new Chart(document.getElementById("irsChart"), {
  type: "pie",
  data: { labels, datasets: [{ data: values, backgroundColor: colors, borderColor: "#1f1f1f", borderWidth: 0 }] },
  options: {
    aspectRatio: 1.3,
    plugins: {
      legend: { position: "right", labels: { color: "#ccc", boxWidth: 16, padding: 14 } },
      tooltip: {
        enabled: false,
        external: ctx => {
          const tooltip = ctx.tooltip;
          if (!tooltip || !tooltip.opacity) {
            tooltipEl.style.opacity = 0;
            return;
          }

          const i = tooltip.dataPoints?.[0]?.dataIndex;
          if (i == null) return;

          const key = raceOrder[i];
          const value = irs[key]?.[0] || 0;         // wins
          const totalCount = ctx.chart._metasets[0].total;  // total picks
          const percent = totalCount ? ((value / totalCount) * 100).toFixed(1) : 0;

// Sum all games played (not just wins) for all races
const totalGamesAllRaces = raceOrder.reduce((sum, r) => sum + (irs[r]?.[1] || 0), 0);

const totalGamesPlayed = irs[key]?.[1] || 0; // games for this race
const [wins, games] = irs[key] || [0, 0];
const wr = games ? ((wins / games) * 100).toFixed(1) : 0;

// First line: heading = race only
let html = `
  <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
    <span style="width:12px;height:12px;background:${raceColors[key]};display:inline-block;border-radius:2px;"></span>
    <strong style="color:#fff;font-size:1em;">${raceNames[key]}</strong>
  </div>
`;

// Second line: selections for this race / total selections + %
const selectionPct = totalGamesAllRaces
  ? ((totalGamesPlayed / totalGamesAllRaces) * 100).toFixed(1)
  : "0";

html += `
  <div style="margin-bottom:6px;font-size:0.9em;padding-left:18px;">
    Selected ${totalGamesPlayed} times / ${totalGamesAllRaces} total race selections (${selectionPct}%)
  </div>
`;

// Third line: wins/games + win rate
html += `
  <div style="margin-bottom:6px;font-size:0.9em;padding-left:18px;">
    ${wins} wins / ${games} selections (${wr}%)
  </div>
`;

// RANDOM: detailed breakdown (no overall header, deeper indentation)
if (key === "r" && irs.x) {

  html += `
    <div style="
      display:grid;
      grid-template-columns: auto auto auto;
      gap:4px 12px;
      font-size:12px;
      margin-top:6px;
      padding-left:32px;   /* deeper indent */
    ">
  `;

  Object.entries(irs.x).forEach(([subRace, [subWins, subGames]]) => {
    const subWR = subGames ? ((subWins / subGames) * 100).toFixed(1) : 0;

    html += `
      <span style="display:flex;align-items:center;gap:6px;">
        <span style="width:10px;height:10px;background:${raceColors[subRace]};display:inline-block;border-radius:2px;"></span>
        <span> Random -> ${raceNames[subRace]}</span>
      </span>
      <span style="text-align:right;">${subWins} / ${subGames}</span>
      <span style="text-align:right;font-weight:500;">${subWR}%</span>
    `;
  });

  html += `</div>`;
}

          tooltipEl.innerHTML = html;

          const rect = ctx.chart.canvas.getBoundingClientRect();
          let left = rect.left + window.pageXOffset + tooltip.caretX + 12;
          let top = rect.top + window.pageYOffset + tooltip.caretY;

          const tooltipRect = tooltipEl.getBoundingClientRect();
          if (left + tooltipRect.width + 20 > window.innerWidth) {
            left = rect.left + window.pageXOffset + tooltip.caretX - tooltipRect.width - 12;
          }
          if (top + tooltipRect.height + 20 > window.pageYOffset + window.innerHeight) {
            top = window.pageYOffset + window.innerHeight - tooltipRect.height - 20;
          }

          tooltipEl.style.left = `${left}px`;
          tooltipEl.style.top = `${top}px`;
          tooltipEl.style.opacity = 1;
        }
      }
    }
  }
});
}




/* GRAF 5*/

async function loadTeamRaceFrequencyChart() {
  const currentSeason = await getCurrentSeason().catch(() => 0);
  const res = await fetchNoCache(`data/seasons/${currentSeason}/statistics_data.json`);
  const data = await res.json();
  const muwr = data.muwr || {};

  // -----------------------------------
  // COLORS
  // -----------------------------------
  const raceColors = {
    p: "#EBD678",
    t: "#53B3FC",
    z: "#C1A3F5",
    r: "#AABBCB"
  };

  // -----------------------------------
  // BUILD ENTRIES
  // -----------------------------------
  const entries = Object.entries(muwr).map(([matchup, vsData]) => {
    let totalGames = 0;
    const sub = [];

    for (const [opponent, [wins, games]] of Object.entries(vsData)) {
      const g = games || 0;
      sub.push({ opponent, wins, games: g });
      totalGames += g;
    }

    return { matchup, totalGames, sub };
  });

  const grandTotalSelections = entries.reduce((s, e) => s + e.totalGames, 0);

  // -----------------------------------
  // FREQUENCY SORT
  // -----------------------------------
  entries.sort((a, b) => b.totalGames - a.totalGames);

  const freqLabels = entries.map(e => e.matchup.toUpperCase());
  const freqValues = entries.map(e => e.totalGames);

  // -----------------------------------
  // WIN RATE SORT
  // -----------------------------------
  const wrSorted = [...entries].sort((a, b) => {
    const gamesA = a.sub.reduce((s, r) => s + r.games, 0);
    const gamesB = b.sub.reduce((s, r) => s + r.games, 0);
    const wrA = gamesA ? a.sub.reduce((s, r) => s + r.wins, 0) / gamesA : 0;
    const wrB = gamesB ? b.sub.reduce((s, r) => s + r.wins, 0) / gamesB : 0;
    return wrB - wrA;
  });

  const wrLabels = wrSorted.map(e => e.matchup.toUpperCase());
  const wrValues = wrSorted.map(e => {
    const wins = e.sub.reduce((s, r) => s + r.wins, 0);
    const games = e.sub.reduce((s, r) => s + r.games, 0);
    return games ? (wins / games * 100).toFixed(1) : 0;
  });

  // -----------------------------------
  // TOOLTIP ELEMENT
  // -----------------------------------
  let tooltipEl = document.getElementById("teamfreq-tooltip");
  if (!tooltipEl) {
    tooltipEl = document.createElement("div");
    tooltipEl.id = "teamfreq-tooltip";
    Object.assign(tooltipEl.style, {
      position: "absolute",
      background: "rgba(0,0,0,0.85)",
      border: "1px solid #333",
      borderRadius: "8px",
      color: "#ddd",
      padding: "8px 12px",
      fontSize: "0.85em",
      pointerEvents: "none",
      boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
      zIndex: 10,
      opacity: 0,
      transition: "opacity 0.1s ease"
    });
    document.body.appendChild(tooltipEl);
  }

  // -----------------------------------
  // CUSTOM TOOLTIP
  // -----------------------------------
  function detailedTooltip(ctx, activeEntries) {
    const { chart, tooltip } = ctx;

    if (tooltip.opacity === 0) {
      tooltipEl.style.opacity = 0;
      return;
    }

    const index = tooltip.dataPoints?.[0]?.dataIndex;
    if (index == null) return;

    const e = activeEntries[index];
    const [r1, r2] = e.matchup.split("");

    const totalWins = e.sub.reduce((sum, s) => sum + s.wins, 0);
    const totalGames = e.sub.reduce((sum, s) => sum + s.games, 0);
    const overallWR = totalGames ? ((totalWins / totalGames) * 100).toFixed(1) : "0.0";

    const isWRView = ctx.chart.data.datasets[0].label.includes("Win Rate");

    let summaryHTML = "";

    if (!isWRView) {
      summaryHTML = `
        <div style="margin-bottom:2px;">
          Selected ${e.totalGames} times / ${grandTotalSelections} selections
          (${((e.totalGames / grandTotalSelections) * 100).toFixed(1)}%)
        </div>
        <div style="margin-bottom:6px;">
          ${totalWins} wins / ${totalGames} games (${overallWR}%)
        </div>`;
    } else {
      summaryHTML = `
        <div style="margin-bottom:2px;">
          ${totalWins} wins / ${totalGames} games (${overallWR}%)
        </div>
        <div style="margin-bottom:6px;">
          Selected ${e.totalGames} times / ${grandTotalSelections} selections
          (${((e.totalGames / grandTotalSelections) * 100).toFixed(1)}%)
        </div>`;
    }

    let html = `
      <div style="display:flex;align-items:center;gap:4px;margin-bottom:6px;">
        <span style="width:10px;height:10px;background:${raceColors[r1]};border-radius:2px;"></span>
        <span style="width:10px;height:10px;background:${raceColors[r2]};border-radius:2px;"></span>
        <strong style="color:#fff;">${e.matchup.toUpperCase()}</strong>
      </div>
      ${summaryHTML}
      <div style="
        display:grid;
        grid-template-columns:1fr auto auto auto;
        gap:4px 12px;
        font-size:12px;">
        <strong>Opponent</strong>
        <strong style="text-align:right;">Wins</strong>
        <strong style="text-align:right;">Games</strong>
        <strong style="text-align:right;">Win %</strong>
    `;

    e.sub
      .filter(s => s.games > 0)
      .sort((a, b) => b.games - a.games)
      .forEach(s => {
        const boxes = s.opponent.split("").map(r => `
          <span style="width:10px;height:10px;background:${raceColors[r]};border-radius:2px;margin-right:2px;"></span>
        `).join("");

        const wr = s.games ? ((s.wins / s.games) * 100).toFixed(1) : "0.0";

        html += `
          <div style="display:flex;align-items:center;gap:2px;">
            ${boxes}${s.opponent.toUpperCase()}
          </div>
          <span style="text-align:right;">${s.wins}</span>
          <span style="text-align:right;">${s.games}</span>
          <span style="text-align:right;">${wr}%</span>
        `;
      });

    html += "</div>";
    tooltipEl.innerHTML = html;

    const rect = chart.canvas.getBoundingClientRect();
    tooltipEl.style.opacity = 1;
    tooltipEl.style.left = rect.left + window.pageXOffset + tooltip.caretX + 12 + "px";
    tooltipEl.style.top = rect.top + window.pageYOffset + tooltip.caretY + "px";
  }

  // -----------------------------------
  // SHARED OPTIONS
  // -----------------------------------
  // Added isWinRateView parameter
  const chartOptions = (activeEntries, axisLabel, isWinRateView = false) => ({
    scales: {
      x: {
        grid: { color: "#222" },
        ticks: { color: "#ccc" }
      },
      y: {
        beginAtZero: true,
        // Conditionally set max: 100 for Win Rate view
        max: isWinRateView ? 100 : undefined, 
        grid: { color: "#222" },
        ticks: { color: "#ccc" },
        title: {
          display: true,
          text: axisLabel,
          color: "#ccc",
          font: { size: 13 }
        }
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: false,
        external: ctx => detailedTooltip(ctx, activeEntries)
      }
    }
  });

  // -----------------------------------
  // INITIAL CHART
  // -----------------------------------
  const canvas = document.getElementById("teamFreqChart");
  const ctx2d = canvas.getContext("2d");

  const labelEl = document.querySelector(".chart-labelx");


  let showingFreq = true;

  let currentChart = new Chart(ctx2d, {
    type: "bar",
    data: {
      labels: freqLabels,
      datasets: [{
        label: "Selections",
        data: freqValues,
        backgroundColor: "rgba(79,163,255,0.8)",
        borderColor: "#4FA3FF",
        borderWidth: 1,
        borderRadius: 6
      }]
    },
    // Not Win Rate, so no third argument
    options: chartOptions(entries, "Number of Selections") 
  });

  // -----------------------------------
  // BUTTON TOGGLE
  // -----------------------------------
  document.getElementById("toggleTeamChart").addEventListener("click", () => {
    currentChart.destroy();

    if (showingFreq) {
      currentChart = new Chart(ctx2d, {
        type: "bar",
        data: {
          labels: wrLabels,
          datasets: [{
            label: "Win Rate (%)",
            data: wrValues,
            backgroundColor: "rgba(57,208,112,0.8)",
            borderColor: "#39D070",
            borderWidth: 1,
            borderRadius: 6
          }]
        },
        // Passed true for isWinRateView to set max: 100
        options: chartOptions(wrSorted, "Win Rate (%)", true) 
      });

      toggleTeamChart.textContent = "Switch to Race Selections View";
      labelEl.textContent = "Team Race Selection Win Rates";
    } else {
      currentChart = new Chart(ctx2d, {
        type: "bar",
        data: {
          labels: freqLabels,
          datasets: [{
            label: "Selections",
            data: freqValues,
            backgroundColor: "rgba(79,163,255,0.8)",
            borderColor: "#4FA3FF",
            borderWidth: 1,
            borderRadius: 6
          }]
        },
        // Not Win Rate, so no third argument
        options: chartOptions(entries, "Number of Selections") 
      });

      toggleTeamChart.textContent = "Switch to Win Rate View";
      labelEl.textContent = "Team Race Selection Rates";
    }

    showingFreq = !showingFreq;
  });
}






/* GRAF 6*/


async function loadMatchupWinrateChart() {
  const currentSeason = await getCurrentSeason().catch(() => 0);
  const res = await fetchNoCache(`data/seasons/${currentSeason}/statistics_data.json`);
  const data = await res.json();
  const muwrr = data.muwrr || {};

  const raceColors = {
    p: "#EBD678",
    t: "#53B3FC",
    z: "#C1A3F5",
    r: "#AABBCB"
  };

  const entries = Object.entries(muwrr).map(([matchup, vsData]) => {
    let totalWins = 0;
    let totalGames = 0;
    const sub = [];

    for (const [opponent, [wins, games]] of Object.entries(vsData)) {
      sub.push({ opponent, wins, games });
      totalWins += wins;
      totalGames += games;
    }

    const wr = totalGames ? (totalWins / totalGames) * 100 : 0;
    return { matchup, wr, totalWins, totalGames, sub };
  });

  entries.sort((a, b) => b.wr - a.wr);

  const labels = entries.map(e => e.matchup.toUpperCase());
  const winrates = entries.map(e => e.wr.toFixed(1));

  let tooltipEl = document.getElementById("matchup-tooltip");
  if (!tooltipEl) {
    tooltipEl = document.createElement("div");
    tooltipEl.id = "matchup-tooltip";
    Object.assign(tooltipEl.style, {
      position: "absolute",
      background: "rgba(0,0,0,0.85)",
      border: "1px solid #333",
      borderRadius: "8px",
      color: "#ddd",
      padding: "8px 12px",
      fontSize: "0.85em",
      pointerEvents: "none",
      boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
      zIndex: 10,
      opacity: 0,
      transition: "opacity 0.1s ease"
    });
    document.body.appendChild(tooltipEl);
  }

  new Chart(document.getElementById("matchupChart"), {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Winrate %",
        data: winrates,
        backgroundColor: "rgba(57,208,112,0.8)",
        borderColor: "#39D070",
        borderWidth: 1,
        borderRadius: 6
      }]
    },
    options: {
      scales: {
        x: { grid: { color: "#222" }, ticks: { color: "#ccc" } },
        y: { beginAtZero: true, max: 100, grid: { color: "#222" }, ticks: { color: "#ccc" } }
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

            const index = tooltip.dataPoints?.[0]?.dataIndex;
            if (index == null) return;
            const e = entries[index];
            const [r1, r2] = e.matchup.split("");

            let html = `
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                <span style="width:10px;height:10px;background:${raceColors[r1]};display:inline-block;border-radius:2px;"></span>
                <span style="width:10px;height:10px;background:${raceColors[r2]};display:inline-block;border-radius:2px;"></span>
                <strong style="color:#fff;">${e.matchup.toUpperCase()}</strong>
              </div>
              <div style="margin-bottom:6px;">${e.totalWins} wins / ${e.totalGames} games (${e.wr.toFixed(1)}%)</div>

              <div style="display:grid;grid-template-columns:1fr auto auto auto;gap:4px 12px;font-size:12px;align-items:center;">
                <strong>Opponent</strong><strong style="text-align:right;">Wins</strong><strong style="text-align:right;">Games</strong><strong style="text-align:right;">WR%</strong>
            `;

            e.sub
              .filter(s => s.games > 0)
              .sort((a, b) => (b.wins / b.games) - (a.wins / a.games))
              .forEach(s => {
                const races = s.opponent.toLowerCase().split("");
                const boxes = races
                  .map(r => `<span style="width:10px;height:10px;background:${raceColors[r] || "#999"};display:inline-block;border-radius:2px;"></span>`)
                  .join("");

                const subWr = ((s.wins / s.games) * 100).toFixed(1);

                html += `
                  <div style="display:flex;align-items:center;gap:4px;">
                    ${boxes}
                    <span>${s.opponent.toUpperCase()}</span>
                  </div>
                  <span style="text-align:right;">${s.wins}</span>
                  <span style="text-align:right;">${s.games}</span>
                  <span style="text-align:right;">${subWr}</span>
                `;
              });

            html += `</div>`;
            tooltipEl.innerHTML = html;

            const rect = ctx.chart.canvas.getBoundingClientRect();
            tooltipEl.style.left = `${rect.left + window.pageXOffset + tooltip.caretX + 12}px`;
            tooltipEl.style.top = `${rect.top + window.pageYOffset + tooltip.caretY}px`;
            tooltipEl.style.opacity = 1;
          }
        }
      }
    }
  });
}



















async function loadWinrateChart() {
  const currentSeason = await getCurrentSeason().catch(() => 0);
  const res = await fetchNoCache(`data/seasons/${currentSeason}/statistics_data.json`);
  const data = await res.json();
  const wlp = data.wlp || {};

  const groups = {
    pz: ["ppzz", "pprz", "zzrp", "rprz"],
    tz: ["ttzz", "ttrz", "zzrt", "rtrz"],
    zz: ["zzzz", "zzrz", "rzrz"],
    pt: ["pptt", "pprt", "ttrp", "rprt"],
    pp: ["pppp", "pprp", "rprp"],
    tt: ["tttt", "ttrt", "rtrt"]
  };

  const subLabels = {
    ppzz: "Protoss + Zerg",
    pprz: "Protoss + Random → Zerg",
    zzrp: "Zerg + Random → Protoss",
    rprz: "Random → Protoss + Random → Zerg",    
    ttzz: "Terran + Zerg",
    ttrz: "Terran + Random → Zerg",
    zzrt: "Zerg + Random → Terran",
    rtrz: "Random → Terran + Random → Zerg",    
    zzzz: "Zerg + Zerg",
    zzrz: "Zerg + Random → Zerg",
    rzrz: "Random → Zerg + Random → Zerg",    
    pptt: "Protoss + Terran",
    pprt: "Protoss + Random → Terran",
    ttrp: "Terran + Random → Protoss",
    rprt: "Random → Protoss + Random → Terran",    
    pppp: "Protoss + Protoss",
    pprp: "Protoss + Random → Protoss",
    rprp: "Random → Protoss + Random → Protoss",    
    tttt: "Terran + Terran",
    ttrt: "Terran + Random → Terran",    
    rtrt: "Random → Terran + Random → Terran"
  };

  const raceColors = {
    p: "#EBD678",
    t: "#53B3FC",
    z: "#C1A3F5",
    r: "#AABBCB"
  };

  function sumWinsLosses(keys) {
    let wins = 0, losses = 0;
    for (const k of keys) {
      const d = wlp[k];
      if (!d) continue;
      if (Array.isArray(d)) {
        wins += d[0];
        losses += d[1] - d[0];
      } else if (typeof d === "object") {
        wins += d.wins || 0;
        losses += d.losses || 0;
      }
    }
    return { wins, losses, total: wins + losses };
  }

  // --- Compute and sort ---
  const groupData = Object.entries(groups).map(([label, keys]) => {
    const { wins, losses, total } = sumWinsLosses(keys);
    const winrate = total ? (wins / total) * 100 : 0;
    return { label, keys, wins, losses, total, winrate };
  });
  groupData.sort((a, b) => b.winrate - a.winrate); // descending

  const labels = groupData.map(g => g.label.toUpperCase());
  const winrates = groupData.map(g => g.winrate.toFixed(1));

  // --- Tooltip element ---
  let tooltipEl = document.getElementById("winrate-tooltip");
  if (!tooltipEl) {
    tooltipEl = document.createElement("div");
    tooltipEl.id = "winrate-tooltip";
    Object.assign(tooltipEl.style, {
      position: "absolute",
      background: "rgba(0, 0, 0, 0.85)",
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

  // --- Draw chart ---
  new Chart(document.getElementById("winrateChart"), {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Winrate %",
        data: winrates,
        backgroundColor: "rgba(57,208,112,0.8)",
        borderColor: "#39D070",
        borderWidth: 1,
        borderRadius: 6
      }]
    },
    options: {
      indexAxis: "x",
      scales: {
        x: { grid: { color: "#222" }, ticks: { color: "#ccc" } },
        y: { beginAtZero: true, max: 100,  	grid: { color: "#222" }, ticks: { color: "#ccc" } }
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

    const index = tooltip.dataPoints?.[0]?.dataIndex;
    if (index == null) return;
    const g = groupData[index];
    const title = g.label.toUpperCase();
    const [r1, r2] = title.split("");

    const wr = g.total ? ((g.wins / g.total) * 100).toFixed(1) : 0;

    // Header (colored squares + title)
    let html = `
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
        <span style="width:10px;height:10px;background:${raceColors[r1.toLowerCase()]};display:inline-block;border-radius:2px;"></span>
        <span style="width:10px;height:10px;background:${raceColors[r2.toLowerCase()]};display:inline-block;border-radius:2px;"></span>
        <strong style="color:#fff;">${title}</strong>
      </div>
      <div style="
  display:grid;
  grid-template-columns: 1fr auto auto;
  gap: 4px 12px;
  font-size:12px;
  margin-left:0px;
  margin-bottom:6px;
  color:#eee;
  font-weight:600;
">
  <span style="opacity:0.9;">Overall</span>
  <span style="text-align:right;">${g.wins} wins, ${g.losses} losses</span>
  <span style="text-align:right;font-weight:500;">${wr}%</span>
</div>
    `;

    // Sub-rows in a table-like grid
    html += `
      <div style="
        display:grid;
        grid-template-columns: 1fr auto auto;
        gap: 4px 12px;
        font-size:12px;
        margin-left:0px;
      ">
    `;

   const subEntries = g.keys
  .map(key => {
    const d = wlp[key];
    if (!d) return null;
    const total = Array.isArray(d) ? d[1] : (d.wins + d.losses);
    const wins = Array.isArray(d) ? d[0] : d.wins;
    const wr = total ? (wins / total) * 100 : 0;
    return { key, wins, total, wr };
  })
  .filter(Boolean)
  .sort((a, b) => b.wr - a.wr);

for (const e of subEntries) {
  html += `
    <span style="opacity:0.9;">${subLabels[e.key]}</span>
    <span style="text-align:right;">${e.wins} wins, ${e.total - e.wins} losses</span>
    <span style="text-align:right;font-weight:500;">${e.wr.toFixed(1)}%</span>
  `;
}

    html += `</div>`;

    tooltipEl.innerHTML = html;

    const rect = ctx.chart.canvas.getBoundingClientRect();
    tooltipEl.style.opacity = 1;
    let left = rect.left + window.pageXOffset + tooltip.caretX + 12;
let top = rect.top + window.pageYOffset + tooltip.caretY;

// Prevent tooltip overflow on right edge
const tooltipRect = tooltipEl.getBoundingClientRect();
const screenWidth = window.innerWidth;
if (left + tooltipRect.width + 20 > screenWidth) {
  left = rect.left + window.pageXOffset + tooltip.caretX - tooltipRect.width - 12;
}

// Prevent tooltip overflow on bottom edge
const screenHeight = window.innerHeight;
if (top + tooltipRect.height + 20 > window.pageYOffset + screenHeight) {
  top = window.pageYOffset + screenHeight - tooltipRect.height - 20;
}

tooltipEl.style.left = `${left}px`;
tooltipEl.style.top = `${top}px`;
  }
}
      }
    }
  });
}





loadActivityChart();
loadActivityWeekdayChart();
loadActivityClockChart();
loadIndividualRaceSelectionChart();

loadTeamRaceFrequencyChart();

loadMatchupWinrateChart();   

loadWinrateChart();
