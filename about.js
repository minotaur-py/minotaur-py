async function loadActivityChart() {
  const currentSeason = await getCurrentSeason().catch(() => 0);
  const res = await fetch(`/data/seasons/${currentSeason}/statistics_data.json`);
  const data = await res.json();
  const timestamps = data.activity || [];

  const dates = timestamps.map(ts => new Date(ts)).sort((a, b) => a - b);
  if (!dates.length) return;

  const start = new Date(dates[0]);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay() + 1);

  const now = new Date();
  const weekBuckets = {};
  for (let d = new Date(start); d <= now; d.setDate(d.getDate() + 7)) {
    const weekKey = d.toISOString().slice(0, 10);
    weekBuckets[weekKey] = 0;
  }

  for (const date of dates) {
    const weekStart = new Date(date);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
    weekStart.setHours(0, 0, 0, 0);
    const key = weekStart.toISOString().slice(0, 10);
    if (key in weekBuckets) weekBuckets[key]++;
  }

  const labels = Object.keys(weekBuckets);
  const counts = Object.values(weekBuckets);

  Chart.defaults.color = "#ccc";
  Chart.defaults.borderColor = "#333";

  new Chart(document.getElementById("activityChart"), {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Weekly Activity",
        data: counts,
        backgroundColor: "rgba(137, 207, 240, 0.8)",
        borderColor: "#89CFF0",
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
          title: { display: true, text: "Activity count" },
          beginAtZero: true,
          grid: { color: "#222" }
        }
      },
      plugins: { legend: { display: false } }
    }
  });
}



async function loadIndividualRaceSelectionChart() {
  const currentSeason = await getCurrentSeason().catch(() => 0);
  const res = await fetch(`/data/seasons/${currentSeason}/statistics_data.json`);
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
      background: "#1f1f1f",
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

// Header: total games & fraction of all picks
let html = `
  <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">
    <span style="width:10px;height:10px;background:${raceColors[key]};display:inline-block;border-radius:2px;"></span>
    <strong style="color:#fff;">
      ${raceNames[key]} selected ${totalGamesPlayed} times (${totalGamesAllRaces ? ((totalGamesPlayed / totalGamesAllRaces) * 100).toFixed(1) : 0}%)
    </strong>
  </div>
`;

// Second line: wins / games + win rate
html += `
  <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;font-size:0.9em;">
    <span style="width:10px;height:10px;background:#555;display:inline-block;border-radius:2px;"></span>
    <span>${wins} wins / ${games} selections (${wr}%)</span>
  </div>
`;

          // Random breakdown
          if (key === "r" && irs.x) {
            const totalWins = Object.values(irs.x).reduce((sum, [w]) => sum + w, 0);
            const totalGames = Object.values(irs.x).reduce((sum, [, g]) => sum + g, 0);
            const overallWR = totalGames ? ((totalWins / totalGames) * 100).toFixed(1) : 0;

            html += `
              <div style="margin-top:4px;font-weight:600;">Random breakdown (Overall win rate: ${totalWins} / ${totalGames} (${overallWR}%))</div>
              <div style="display:grid;grid-template-columns: auto auto auto; gap:4px 12px; font-size:12px; margin-top:2px;">
            `;

            Object.entries(irs.x).forEach(([subRace, [subWins, subGames]]) => {
              const subWR = subGames ? ((subWins / subGames) * 100).toFixed(1) : 0;
              html += `
                <span style="display:flex;align-items:center;gap:6px;">
                  <span style="width:10px;height:10px;background:${raceColors[subRace]};display:inline-block;border-radius:2px;"></span>
                  <span>${raceNames[subRace]}</span>
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



async function loadIRSBarLineChart() {
  const currentSeason = await getCurrentSeason().catch(() => 0);
  const res = await fetch(`/data/seasons/${currentSeason}/statistics_data.json`);
  const data = await res.json();
  const irs = data.irs || {};

  const raceOrder = ["p", "t", "z", "r"];
  const raceNames = { p: "Protoss", t: "Terran", z: "Zerg", r: "Random" };
  const raceColors = { p: "#EBD678", t: "#53B3FC", z: "#C1A3F5", r: "#AABBCB" };

  const labels = raceOrder.map(r => raceNames[r]);
  const wins = raceOrder.map(r => irs[r]?.[0] || 0);
  const games = raceOrder.map(r => irs[r]?.[1] || 0);
  const winrates = raceOrder.map((r, i) =>
    games[i] ? ((wins[i] / games[i]) * 100).toFixed(1) : 0
  );

  const ctx = document.getElementById("irsBarLineChart");

  new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Wins",
          data: wins,
          backgroundColor: raceOrder.map(r => raceColors[r]),
          borderColor: "#1f1f1f",
          borderWidth: 0
        },
        {
          label: "Selections",
          data: games,
          backgroundColor: raceOrder.map(r => raceColors[r] + "55"),
          borderColor: "#1f1f1f",
          borderWidth: 0
        },
        {
          type: "line",
          label: "Win Rate (%)",
          data: winrates,
          yAxisID: "y1",
          pointRadius: 4,
          pointHoverRadius: 6,
          borderWidth: 2,
          borderColor: "#89CFF0",
          tension: 0.3
        }
      ]
    },
    options: {
      responsive: true,
      aspectRatio: 1.5,
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: "#2a2a2a" },
          ticks: { color: "#ccc" }
        },
        y1: {
          beginAtZero: true,
          position: "right",
          grid: { drawOnChartArea: false },
          ticks: { color: "#ccc", callback: v => v + "%" }
        },
        x: {
          ticks: { color: "#ccc" }
        }
      },
      plugins: {
        legend: {
          labels: { color: "#ccc" }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              if (ctx.dataset.type === "line") {
                return `Win Rate: ${ctx.formattedValue}%`;
              }
              if (ctx.dataset.label === "Wins") return `Wins: ${ctx.raw}`;
              if (ctx.dataset.label === "Selections") return `Selections: ${ctx.raw}`;
            }
          }
        }
      }
    }
  });
}














async function loadMatchupWinrateChart() {
  const currentSeason = await getCurrentSeason().catch(() => 0);
  const res = await fetch(`/data/seasons/${currentSeason}/statistics_data.json`);
  const data = await res.json();
  const muwrr = data.muwrr || {};

  const raceColors = {
    p: "#EBD678",
    t: "#53B3FC",
    z: "#C1A3F5",
    r: "#AABBCB"
  };

  // Aggregate general winrates per matchup (excluding mirror matchups)
  const entries = Object.entries(muwrr).map(([matchup, vsData]) => {
    let totalWins = 0;
    let totalGames = 0;
    const sub = [];

    for (const [opponent, [wins, games]] of Object.entries(vsData)) {
      if (matchup === opponent) continue; // skip mirrors
      sub.push({ opponent, wins, games });
      totalWins += wins;
      totalGames += games;
    }

    const wr = totalGames ? (totalWins / totalGames) * 100 : 0;
    return { matchup, wr, totalWins, totalGames, sub };
  });

  // Sort by winrate descending
  entries.sort((a, b) => b.wr - a.wr);

  const labels = entries.map(e => e.matchup.toUpperCase());
  const winrates = entries.map(e => e.wr.toFixed(1));

  // Tooltip element (custom HTML)
  let tooltipEl = document.getElementById("matchup-tooltip");
  if (!tooltipEl) {
    tooltipEl = document.createElement("div");
    tooltipEl.id = "matchup-tooltip";
    Object.assign(tooltipEl.style, {
      position: "absolute",
      background: "#1f1f1f",
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
        backgroundColor: "rgba(137,207,240,0.8)",
        borderColor: "#89CFF0",
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

            // --- Build tooltip HTML ---
            let html = `
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                <span style="width:10px;height:10px;background:${raceColors[r1]};display:inline-block;border-radius:2px;"></span>
                <span style="width:10px;height:10px;background:${raceColors[r2]};display:inline-block;border-radius:2px;"></span>
                <strong style="color:#fff;">${e.matchup.toUpperCase()}</strong>
              </div>
              <div style="margin-bottom:6px;">${e.totalWins} wins, ${e.totalGames - e.totalWins} losses (${e.wr.toFixed(1)}%)</div>
              <div style="display:grid;grid-template-columns:1fr auto auto;gap:4px 12px;font-size:12px;align-items:center;">
                <strong>Opponent</strong><strong style="text-align:right;">W–L</strong><strong style="text-align:right;">WR%</strong>
            `;

            // Add colored boxes per opponent
e.sub
  .filter(s => s.games > 0)
  .sort((a, b) => (b.wins / b.games) - (a.wins / a.games))
  .forEach(s => {
    const wr = ((s.wins / s.games) * 100).toFixed(1);
    const races = s.opponent.toLowerCase().split(""); // e.g. "PT" → ["p","t"]

    const boxes = races
      .map(r => `
        <span style="
          width:10px;
          height:10px;
          background:${raceColors[r] || "#999"};
          display:inline-block;
          border-radius:2px;
          flex-shrink:0;
        "></span>
      `)
      .join("");

    html += `
      <div style="display:flex;align-items:center;gap:4px;">
        ${boxes}
        <span>${s.opponent.toUpperCase()}</span>
      </div>
      <span style="text-align:right;">${s.wins}-${s.games - s.wins}</span>
      <span style="text-align:right;">${wr}</span>
    `;
  });

            html += `</div>`;
            tooltipEl.innerHTML = html;

            // --- Position tooltip ---
            const rect = ctx.chart.canvas.getBoundingClientRect();
            const left = rect.left + window.pageXOffset + tooltip.caretX + 12;
            const top = rect.top + window.pageYOffset + tooltip.caretY;
            tooltipEl.style.left = `${left}px`;
            tooltipEl.style.top = `${top}px`;
            tooltipEl.style.opacity = 1;
          }
        }
      }
    }
  });
}







async function loadRaceSelectionChart() {
  const currentSeason = await getCurrentSeason().catch(() => 0);
  const res = await fetch(`/data/seasons/${currentSeason}/statistics_data.json`);
  const data = await res.json();
  const rs = data.rs || {};

  const raceColors = {
    p: "#EBD678",
    t: "#53B3FC",
    z: "#C1A3F5",
    r: "#AABBCB"
  };

  // Compute winrates
  const entries = Object.entries(rs).map(([key, val]) => {
    const [wins, games] = val;
    const wr = games ? (wins / games) * 100 : 0;
    return { key, wins, games, wr };
  });

  // Sort descending by winrate
  entries.sort((a, b) => b.wr - a.wr);

  // Prepare data
  const labels = entries.map(e => e.key.toUpperCase());
  const winrates = entries.map(e => e.wr.toFixed(1));
  const colors = entries.map(e => {
    const [r1, r2] = e.key.split("");
    return `linear-gradient(90deg, ${raceColors[r1]}, ${raceColors[r2]})`;
  });

  // Draw chart
  new Chart(document.getElementById("raceSelectionChart"), {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Winrate %",
        data: winrates,
        backgroundColor: winrates.map(() => "rgba(137,207,240,0.8)"),
        borderColor: "#89CFF0",
        borderWidth: 1,
        borderRadius: 6
      }]
    },
    options: {
      scales: {
        x: {
          grid: { color: "#222" },
          ticks: { color: "#ccc" }
        },
        y: {
          beginAtZero: true,
          max: 100,  
          grid: { color: "#222" },
          ticks: { color: "#ccc" }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const e = entries[ctx.dataIndex];
              return `${e.wins} wins, ${e.games - e.wins} losses (${e.wr.toFixed(1)}%)`;
            }
          }
        }
      }
    }
  });
}


















async function loadWinrateChart() {
  const currentSeason = await getCurrentSeason().catch(() => 0);
  const res = await fetch(`/data/seasons/${currentSeason}/statistics_data.json`);
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
        backgroundColor: "rgba(83,179,252,0.8)",
        borderColor: "#53B3FC",
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
loadIndividualRaceSelectionChart();
loadIRSBarLineChart()
loadMatchupWinrateChart();   // <— new one
loadRaceSelectionChart();
loadWinrateChart();