/* Per-tab chart renderers. Light professional theme,
   restrained axes, hairline grids.

   Performance:
   - parsing: false  (Chart.js skips per-point parsing)
   - decimation plugin (LTTB) — keeps shape, drops ~90% of hit-tests
   - interaction.mode: 'index' + axis:'x' (binary search, not O(n) 2D scan)

   Click resolution still works because Chart.js exposes the original
   data point at chart.data.datasets[i].data[index] (with _record). */

function destroyCharts() {
  Object.values(State.charts).forEach(c => c.destroy());
  State.charts = {};
}

function attachDblClick(chart, kind) {
  const canvas = chart.canvas;
  if (!canvas || canvas._dblBound) return;
  canvas._dblBound = true;
  canvas.addEventListener('dblclick', ev => {
    const els = chart.getElementsAtEventForMode(ev, 'nearest', { intersect: true }, true);
    if (!els.length) return;
    const e = els[0];
    const ds = chart.data.datasets[e.datasetIndex];
    const point = ds.data[e.index];
    if (!point) return;
    if (kind === 'per' && point._window) {
      showPerWindowModal(point, ds.label);
    } else if (point._record) {
      showModal(point._record);
    }
  });
}

function cssV(n) { return getComputedStyle(document.body).getPropertyValue(n).trim(); }

function applyChartDefaults() {
  Chart.defaults.color = cssV('--text-3') || '#71717a';
  Chart.defaults.borderColor = cssV('--border') || '#e7e5e0';
  Chart.defaults.font.family = "'Onest', system-ui, sans-serif";
  Chart.defaults.font.size = 11;
  Chart.defaults.font.weight = 500;
}

function axisOpts() {
  return {
    grid:   { color: cssV('--border'), lineWidth: 1, drawTicks: false },
    ticks:  { color: cssV('--text-3'), padding: 10,
              font: { family: "'JetBrains Mono', monospace", size: 10.5 } },
    border: { color: cssV('--border'), display: true },
  };
}

function commonLegend() {
  return {
    display: false,
    align: 'end',
    labels: {
      color: cssV('--text-2'),
      boxWidth: 16, boxHeight: 1.5,
      padding: 14,
      font: { size: 11, family: "'Onest', sans-serif", weight: 500 },
    },
  };
}

function commonTooltip(extra = {}) {
  return {
    backgroundColor: cssV('--surface'),
    borderColor: cssV('--border-2'),
    borderWidth: 1,
    titleColor: cssV('--text'),
    titleFont: { size: 11, weight: 600, family: "'Onest', sans-serif" },
    bodyColor: cssV('--text-2'),
    bodyFont: { size: 11.5, family: "'JetBrains Mono', monospace" },
    padding: 10,
    cornerRadius: 4,
    displayColors: true,
    boxWidth: 8, boxHeight: 8,
    animation: false,
    ...extra,
  };
}

function decimationPlugin() {
  return { enabled: true, algorithm: 'lttb', samples: 500, threshold: 200 };
}

// Cap mousemove redraws to one per animation frame (~60 fps)
const rafThrottlePlugin = {
  id: 'rafThrottle',
  beforeEvent(chart, args) {
    if (args.event.type !== 'mousemove') return;
    if (chart._rafPending) { args.changed = false; return; }
    chart._rafPending = true;
    requestAnimationFrame(() => { chart._rafPending = false; });
  },
};

/* Apply per-chart Y-axis overrides from State.yLimits */
function applyYLimits(yScale, chartName) {
  const lim = State.yLimits && State.yLimits[chartName];
  if (!lim) return yScale;
  const out = { ...yScale };
  if (lim.min != null) out.min = lim.min;
  if (lim.max != null) out.max = lim.max;
  return out;
}

function timelineScales(yLabel, chartName) {
  const ax = axisOpts();
  return {
    x: { ...ax, type: 'time',
         time: { tooltipFormat: 'yyyy-MM-dd HH:mm:ss',
                 displayFormats: { minute: 'HH:mm', hour: 'HH:mm' } },
         ticks: { ...ax.ticks, maxTicksLimit: 9, padding: 8 } },
    y: applyYLimits({ ...ax,
         grace: '10%',
         title: { display: true, text: yLabel, color: cssV('--text-3'),
                  font: { size: 10.5, family: "'Onest', sans-serif", weight: 500 } } },
         chartName),
  };
}

/* ════════════════════════════════════════════════════════════════════
   01 · RSSI TIMELINE
   ════════════════════════════════════════════════════════════════════ */
function renderRSSI(data) {
  applyChartDefaults();
  const devs = Object.entries(data);
  State.charts.rssi = new Chart(document.getElementById('rssi-chart'), {
    type: 'line',
    data: {
      datasets: devs.map(([dev, d], i) => ({
        label: devLabel(dev),
        data: d.messages.map(m => ({ x: m.ts * 1000, y: m.rssi, _record: m })),
        borderColor: devColor(i),
        backgroundColor: devColor(i, 0.06),
        borderWidth: 1.4, pointRadius: 0,
        pointHoverRadius: 5, pointHoverBackgroundColor: devColor(i),
        pointHoverBorderColor: '#fff', pointHoverBorderWidth: 2,
        tension: 0.12,
        parsing: false,
      }))
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      events: ['mousemove', 'mouseout', 'click', 'touchstart'],
      interaction: { mode: 'index', intersect: false, axis: 'x' },
      plugins: {
        rafThrottle: rafThrottlePlugin,
        decimation: decimationPlugin(),
        legend: commonLegend(),
        tooltip: { enabled: false },
      },
      scales: timelineScales('RSSI · dBm', 'rssi'),
    }
  });
  attachDblClick(State.charts.rssi, 'rssi');
}

/* ════════════════════════════════════════════════════════════════════
   02 · SNR TIMELINE
   ════════════════════════════════════════════════════════════════════ */
function renderSNR(data) {
  applyChartDefaults();
  const devs = Object.entries(data);
  State.charts.snr = new Chart(document.getElementById('snr-chart'), {
    type: 'line',
    data: {
      datasets: devs.map(([dev, d], i) => ({
        label: devLabel(dev),
        data: d.messages.map(m => ({ x: m.ts * 1000, y: m.snr, _record: m })),
        borderColor: devColor(i),
        backgroundColor: devColor(i, 0.06),
        borderWidth: 1.4, pointRadius: 0,
        pointHoverRadius: 5, pointHoverBackgroundColor: devColor(i),
        pointHoverBorderColor: '#fff', pointHoverBorderWidth: 2,
        tension: 0.12,
        parsing: false,
      }))
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      events: ['mousemove', 'mouseout', 'click', 'touchstart'],
      interaction: { mode: 'index', intersect: false, axis: 'x' },
      plugins: {
        rafThrottle: rafThrottlePlugin,
        decimation: decimationPlugin(),
        legend: commonLegend(),
        tooltip: { enabled: false },
      },
      scales: timelineScales('SNR · dB', 'snr'),
    }
  });
  attachDblClick(State.charts.snr, 'snr');
}

/* ════════════════════════════════════════════════════════════════════
   03 · ROLLING PER + threshold line
   ════════════════════════════════════════════════════════════════════ */
function renderPER(data) {
  applyChartDefaults();
  const devs = Object.entries(data);
  const win = perWindowSize();
  const meta = document.getElementById('per-meta');
  if (meta) meta.textContent = `window ${win} msgs · threshold ${State.threshold}%`;

  const errorColor = cssV('--error');
  const datasets = devs.map(([dev, d], i) => ({
    label: devLabel(dev),
    data: rollingPER(d.messages, win),
    borderColor: devColor(i),
    backgroundColor: devColor(i, 0.08),
    borderWidth: 1.5,
    pointRadius: 0,
    pointHoverRadius: 5,
    pointHoverBackgroundColor: devColor(i),
    pointHoverBorderColor: '#fff',
    pointHoverBorderWidth: 2,
    tension: 0.3,
    fill: devs.length === 1,
    parsing: false,
    segment: {
      borderColor: ctx => ctx.p1.parsed.y > State.threshold
        ? errorColor : devColor(i),
    }
  }));

  const allTs = devs.flatMap(([, d]) => d.messages.map(m => m.ts * 1000));
  if (allTs.length) {
    const minT = Math.min(...allTs), maxT = Math.max(...allTs);
    datasets.push({
      label: `Threshold ${State.threshold}%`,
      data: [{ x: minT, y: State.threshold }, { x: maxT, y: State.threshold }],
      borderColor: cssV('--error'),
      borderDash: [5, 4],
      borderWidth: 1.2,
      pointRadius: 0, fill: false, tension: 0,
      parsing: false,
    });
  }

  const ax = axisOpts();
  State.charts.per = new Chart(document.getElementById('per-chart'), {
    type: 'line',
    data: { datasets },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      events: ['mousemove', 'mouseout', 'click', 'touchstart'],
      interaction: { mode: 'index', intersect: false, axis: 'x' },
      plugins: {
        rafThrottle: rafThrottlePlugin,
        decimation: decimationPlugin(),
        legend: commonLegend(),
        tooltip: commonTooltip({
          callbacks: {
            title: items => items[0]
              ? new Date(items[0].parsed.x).toLocaleString(undefined, { hour12: false })
              : '',
            label: ctx => `  ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)}%`,
          }
        }),
      },
      scales: {
        x: { ...ax, type: 'time',
             time: { tooltipFormat: 'yyyy-MM-dd HH:mm:ss',
                     displayFormats: { minute: 'HH:mm', hour: 'HH:mm' } },
             ticks: { ...ax.ticks, maxTicksLimit: 10, padding: 8 } },
        y: applyYLimits({ ...ax, min: 0, grace: '10%',
             title: { display: true, text: 'PER · %', color: cssV('--text-3'),
                      font: { size: 10.5, family: "'Onest', sans-serif", weight: 500 } },
             ticks: { ...ax.ticks, callback: v => v + '%', padding: 10 } }, 'per')
      }
    }
  });
  attachDblClick(State.charts.per, 'per');
}

/* ════════════════════════════════════════════════════════════════════
   04 · RSSI HISTOGRAM — global category bins so bars are full-width
   ════════════════════════════════════════════════════════════════════ */
function renderHist(data) {
  applyChartDefaults();
  const devs = Object.entries(data);
  const ax = axisOpts();

  // Collect all RSSI values across selected devices
  const allVals = devs.flatMap(([, d]) =>
    d.messages.map(m => m.rssi).filter(v => v != null));

  if (!allVals.length) {
    State.charts.hist = new Chart(document.getElementById('rssi-hist-chart'), {
      type: 'bar', data: { labels: [], datasets: [] },
      options: { responsive: true, maintainAspectRatio: false }
    });
    return;
  }

  const min = Math.floor(Math.min(...allVals));
  const max = Math.ceil(Math.max(...allVals));
  const range = Math.max(1, max - min);

  // RSSI is almost always integer dBm. Target ~24 bins; bin width is at least 1.
  const allInt = allVals.every(v => Number.isInteger(v));
  let binW = allInt ? Math.max(1, Math.ceil(range / 24)) : range / 24;
  const binCount = Math.max(1, Math.ceil(range / binW) + 1);

  const labels = [];
  for (let i = 0; i < binCount; i++) {
    const c = min + i * binW;
    labels.push(binW >= 1 ? c.toFixed(0) : c.toFixed(1));
  }

  const meta = document.getElementById('hist-meta');
  if (meta) meta.textContent = `${binCount} bins · ${min} to ${max} dBm`;

  const datasets = devs.map(([dev, d], i) => {
    const vals = d.messages.map(m => m.rssi).filter(v => v != null);
    const counts = Array(binCount).fill(0);
    vals.forEach(v => {
      const idx = Math.min(Math.max(0, Math.floor((v - min) / binW)), binCount - 1);
      counts[idx]++;
    });
    return {
      label: devLabel(dev),
      data: counts,
      backgroundColor: devColor(i, 0.6),
      borderColor: devColor(i),
      borderWidth: 1, borderRadius: 3,
      barPercentage: 0.95, categoryPercentage: 0.85,
    };
  });

  State.charts.hist = new Chart(document.getElementById('rssi-hist-chart'), {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: commonLegend(), tooltip: commonTooltip() },
      scales: {
        x: { ...ax,
             title: { display: true, text: 'RSSI · dBm', color: cssV('--text-3'),
                      font: { size: 10.5, family: "'Onest', sans-serif", weight: 500 } },
             ticks: { ...ax.ticks, autoSkip: true, maxRotation: 0 } },
        y: applyYLimits({ ...ax, beginAtZero: true, grace: '10%',
             title: { display: true, text: 'count', color: cssV('--text-3'),
                      font: { size: 10.5, family: "'Onest', sans-serif", weight: 500 } },
             ticks: { ...ax.ticks, precision: 0, padding: 10 } }, 'hist')
      }
    }
  });
}

/* ════════════════════════════════════════════════════════════════════
   05 · FREQUENCY USAGE
   ════════════════════════════════════════════════════════════════════ */
function renderFreq(data) {
  applyChartDefaults();
  const devs = Object.entries(data);
  const ax = axisOpts();
  const allF = [...new Set(devs.flatMap(([, d]) => d.freqs))].sort((a, b) => a - b);

  renderFreqMap(devs);
  State.charts.freq = new Chart(document.getElementById('freq-chart'), {
    type: 'bar',
    data: {
      labels: allF.map(f => f + ' MHz'),
      datasets: devs.map(([dev, d], i) => ({
        label: devLabel(dev),
        data: allF.map(f => d.messages.filter(m => m.freq === f).length),
        backgroundColor: devColor(i, 0.65),
        borderColor: devColor(i),
        borderWidth: 1, borderRadius: 3,
      }))
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: commonLegend(), tooltip: commonTooltip() },
      scales: {
        x: { ...ax, ticks: { ...ax.ticks, maxRotation: 45, minRotation: 45 } },
        y: applyYLimits({ ...ax, grace: '10%',
             title: { display: true, text: 'messages', color: cssV('--text-3'),
                      font: { size: 10.5, family: "'Onest', sans-serif", weight: 500 } },
             ticks: { ...ax.ticks, precision: 0, padding: 10 } }, 'freq')
      }
    }
  });
}

/* ════════════════════════════════════════════════════════════════════
   06 · LOSS EVENTS
   ════════════════════════════════════════════════════════════════════ */
function renderGaps(data) {
  applyChartDefaults();
  const devs = Object.entries(data);
  const ax = axisOpts();
  State.charts.gaps = new Chart(document.getElementById('gap-chart'), {
    type: 'scatter',
    data: {
      datasets: devs.map(([dev, d], i) => ({
        label: devLabel(dev),
        data: d.gaps.map(g => ({ x: g.ts * 1000, y: g.size, _record: g._record })),
        backgroundColor: devColor(i, 0.5),
        borderColor: devColor(i),
        borderWidth: 1,
        pointRadius: 5, pointHoverRadius: 8,
      }))
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      interaction: { mode: 'nearest', intersect: true },
      plugins: {
        rafThrottle: rafThrottlePlugin,
        legend: commonLegend(),
        tooltip: commonTooltip({
          callbacks: {
            title: items => items[0]
              ? new Date(items[0].parsed.x).toLocaleString(undefined, { hour12: false })
              : '',
            label: ctx => `  Lost ${ctx.parsed.y} message(s)`
          }
        })
      },
      scales: {
        x: { ...ax, type: 'time',
             time: { tooltipFormat: 'yyyy-MM-dd HH:mm:ss',
                     displayFormats: { minute: 'HH:mm', hour: 'HH:mm' } },
             ticks: { ...ax.ticks, maxTicksLimit: 10, padding: 8 } },
        y: applyYLimits({ ...ax, beginAtZero: true, grace: '15%',
             title: { display: true, text: 'gap size · msgs', color: cssV('--text-3'),
                      font: { size: 10.5, family: "'Onest', sans-serif", weight: 500 } },
             ticks: { ...ax.ticks, precision: 0, padding: 10 } }, 'gaps')
      }
    }
  });
  attachDblClick(State.charts.gaps, 'gaps');
}

function renderFreqMap(devs) {
  const tbody = document.getElementById('freq-map-tbody');
  if (!tbody) return;
  const counts = new Map();
  for (const [, d] of devs) {
    for (const m of d.messages) {
      if (m.chan == null || m.freq == null) continue;
      const key = `${m.chan}|${m.freq}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  const rows = [...counts.entries()].map(([k, n]) => {
    const [chan, freq] = k.split('|');
    return { chan: +chan, freq: +freq, n };
  }).sort((a, b) => a.chan - b.chan || a.freq - b.freq);

  tbody.innerHTML = rows.length
    ? rows.map(r => `<td>${r.chan}</td><td>${r.freq}</td><td>${r.n.toLocaleString()}</td>`)
          .map(td => `<tr>${td}</tr>`).join('')
    : `<tr><td colspan="3" style="text-align:center;color:var(--text-3);font-style:italic;padding:18px">no data</td></tr>`;
}

const CHART_RENDERERS = {
  rssi: renderRSSI,
  snr:  renderSNR,
  per:  renderPER,
  hist: renderHist,
  freq: renderFreq,
  gaps: renderGaps,
};

