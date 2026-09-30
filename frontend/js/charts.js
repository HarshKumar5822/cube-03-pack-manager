/* Themed Chart.js helpers. Every function tolerates a missing canvas/Chart global and returns null. */
const C = { seal: '#0F8A52', stop: '#D5351E', unsure: '#5648D0', pending: '#62707A', ink: '#1B2127', ink3: '#74818B', rule: '#DCE1E5', tape: '#F4C20D' };
const live = new Set();

export function destroyCharts() { live.forEach((c) => { try { c.destroy(); } catch { /* gone */ } }); live.clear(); }

function make(canvas, config) {
  if (!canvas || typeof Chart === 'undefined') return null;
  let ctx;
  try { ctx = canvas.getContext('2d'); } catch { return null; }
  if (!ctx) return null;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  Chart.defaults.font.family = "'IBM Plex Sans', system-ui, sans-serif";
  Chart.defaults.color = '#48535D';
  const chart = new Chart(ctx, { ...config, options: { responsive: true, maintainAspectRatio: false, animation: reduce ? false : { duration: 800, easing: 'easeOutCubic' }, ...config.options } });
  live.add(chart);
  return chart;
}
const grid = { color: C.rule, drawTicks: false };
const tip = { backgroundColor: C.ink, padding: 10, cornerRadius: 4, titleFont: { weight: '700' } };

/** Doughnut with the total written in the hole. */
export function verdictDoughnut(canvas, byVerdict, total) {
  const labels = ['Seal', 'Stop & fix', 'Uncertain', 'Manual check'];
  const data = [byVerdict.SEAL, byVerdict.STOP_AND_FIX, byVerdict.UNCERTAIN, byVerdict.PENDING_REVIEW];
  const centre = {
    id: 'centre',
    afterDraw(chart) {
      const { ctx, chartArea: a } = chart; if (!a) return;
      const x = (a.left + a.right) / 2; const y = (a.top + a.bottom) / 2;
      ctx.save(); ctx.textAlign = 'center'; ctx.fillStyle = C.ink;
      ctx.font = "900 34px 'Archivo', sans-serif"; ctx.fillText(String(total), x, y + 6);
      ctx.font = "500 12px 'IBM Plex Sans', sans-serif"; ctx.fillStyle = C.ink3; ctx.fillText('boxes checked', x, y + 26); ctx.restore();
    },
  };
  return make(canvas, { type: 'doughnut', data: { labels, datasets: [{ data, backgroundColor: [C.seal, C.stop, C.unsure, C.pending], borderColor: '#FBFCFC', borderWidth: 3, hoverOffset: 6 }] }, options: { cutout: '66%', plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } }, tooltip: tip } }, plugins: [centre] });
}

/** Daily counts per verdict (lines) plus cumulative first-pass yield on the right axis. */
export function dailyLine(canvas, daily) {
  const labels = daily.map((d) => d.date.slice(5));
  const line = (label, key, color) => ({ label, data: daily.map((d) => d[key]), borderColor: color, backgroundColor: color, tension: 0.3, borderWidth: 2.5, pointRadius: 3, pointHoverRadius: 6, yAxisID: 'y' });
  return make(canvas, {
    type: 'line',
    data: { labels, datasets: [line('Seal', 'seal', C.seal), line('Stop & fix', 'stop', C.stop), line('Uncertain', 'uncertain', C.unsure), { label: 'Cumulative seal rate %', data: daily.map((d) => d.cumulativeFpy), borderColor: C.ink, borderDash: [6, 5], borderWidth: 2, pointRadius: 0, tension: 0.3, yAxisID: 'y2' }] },
    options: { interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } }, tooltip: tip }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grid, ticks: { precision: 0 }, title: { display: true, text: 'Boxes per day' } }, y2: { position: 'right', min: 0, max: 100, grid: { display: false }, title: { display: true, text: 'Seal rate %' } } } },
  });
}

export function defectBar(canvas, defects, labelsMap) {
  const keys = Object.keys(defects).filter((k) => defects[k] > 0);
  return make(canvas, { type: 'bar', data: { labels: keys.map((k) => labelsMap[k] || k), datasets: [{ data: keys.map((k) => defects[k]), backgroundColor: keys.map((k) => (k === 'VISUAL_AMBIGUITY' ? C.unsure : k === 'NETWORK_TIMEOUT' ? C.pending : C.stop)), borderRadius: 3 }] }, options: { plugins: { legend: { display: false }, tooltip: tip }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grid, ticks: { precision: 0 } } } } });
}

export function topSkusBar(canvas, topSkus) {
  return make(canvas, { type: 'bar', data: { labels: topSkus.map((s) => s.name), datasets: [{ data: topSkus.map((s) => s.count), backgroundColor: C.tape, borderColor: C.ink, borderWidth: 1.5, borderRadius: 3 }] }, options: { indexAxis: 'y', plugins: { legend: { display: false }, tooltip: tip }, scales: { x: { beginAtZero: true, grid, ticks: { precision: 0 } }, y: { grid: { display: false } } } } });
}

export function confidenceHistogram(canvas, bins) {
  return make(canvas, { type: 'bar', data: { labels: bins.map((b) => b.bin), datasets: [{ data: bins.map((b) => b.count), backgroundColor: [C.stop, '#E3762A', C.tape, '#6BB98B', C.seal], borderRadius: 3 }] }, options: { plugins: { legend: { display: false }, tooltip: tip }, scales: { x: { grid: { display: false }, title: { display: true, text: 'AI confidence' } }, y: { beginAtZero: true, grid, ticks: { precision: 0 } } } } });
}

export function channelStack(canvas, channels, names) {
  const ds = (label, key, color) => ({ label, data: channels.map((c) => c[key]), backgroundColor: color, borderRadius: 2 });
  return make(canvas, { type: 'bar', data: { labels: channels.map((c) => names[c.channel] || c.channel), datasets: [ds('Seal', 'seal', C.seal), ds('Stop & fix', 'stop', C.stop), ds('Uncertain', 'uncertain', C.unsure)] }, options: { plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } }, tooltip: tip }, scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, beginAtZero: true, grid, ticks: { precision: 0 } } } } });
}

/** Two-class bar for the benchmark: agent vs label agreement. */
export function agreementDoughnut(canvas, ok, total) {
  return make(canvas, { type: 'doughnut', data: { labels: ['Agrees with label', 'Differs'], datasets: [{ data: [ok, total - ok], backgroundColor: [C.seal, C.stop], borderColor: '#FBFCFC', borderWidth: 3 }] }, options: { cutout: '68%', plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } }, tooltip: tip } } });
}
