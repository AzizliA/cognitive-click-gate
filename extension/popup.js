/* =========================================================
   Cognitive Click Gate – Popup Script
   ========================================================= */

'use strict';

function computeStats(logs) {
  const decisions = logs.filter(
    (e) => e.action === 'allow' || e.action === 'block'
  );
  const total = decisions.length;
  const allows = decisions.filter((e) => e.action === 'allow').length;
  const blocks = decisions.filter((e) => e.action === 'block').length;

  const times = decisions
    .map((e) => e.time)
    .filter((t) => typeof t === 'number' && !isNaN(t));
  const avgTime =
    times.length > 0
      ? (times.reduce((a, b) => a + b, 0) / times.length / 1000).toFixed(1)
      : null;

  const scores = decisions
    .map((e) => e.score)
    .filter((s) => typeof s === 'number' && !isNaN(s));
  const avgScore =
    scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : null;

  const ratio = total > 0 ? ((allows / total) * 100).toFixed(0) + '%' : '—';

  return { total, allows, blocks, avgTime, avgScore, ratio };
}

function render(stats) {
  document.getElementById('total').textContent = stats.total;
  document.getElementById('allows').textContent = stats.allows;
  document.getElementById('blocks').textContent = stats.blocks;
  document.getElementById('avg-time').textContent =
    stats.avgTime !== null ? stats.avgTime : '—';
  document.getElementById('avg-score').textContent =
    stats.avgScore !== null ? stats.avgScore : '—';
  document.getElementById('ratio').textContent = stats.ratio;
}

function init() {
  chrome.storage.local.get(null, function (items) {
    const logs = Object.keys(items)
      .filter((k) => k.startsWith('ccg_log_'))
      .map((k) => items[k]);
    render(computeStats(logs));
  });
}

// ── Event listeners ───────────────────────────────────────────

document.getElementById('open-stats').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('stats.html') });
});

document.getElementById('clear-stats').addEventListener('click', () => {
  chrome.storage.local.get(null, function (items) {
    const keys = Object.keys(items).filter((k) => k.startsWith('ccg_log_'));
    chrome.storage.local.remove(keys, function () {
      render(computeStats([]));
      const statusEl = document.getElementById('status');
      statusEl.textContent = 'Stats cleared.';
      setTimeout(() => { statusEl.textContent = ''; }, 3000);
    });
  });
});

init();
