/* =========================================================
   Cognitive Click Gate – Stats Page Script
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
  const avgTimeSec =
    times.length > 0
      ? (times.reduce((a, b) => a + b, 0) / times.length / 1000).toFixed(1)
      : null;

  return { total, allows, blocks, avgTimeSec };
}

function render(stats) {
  document.getElementById('total').textContent = stats.total;
  document.getElementById('allows').textContent = stats.allows;
  document.getElementById('blocks').textContent = stats.blocks;
  document.getElementById('avg-time').textContent =
    stats.avgTimeSec !== null ? stats.avgTimeSec : '—';
}

function loadAndRender() {
  chrome.storage.local.get(null, function (items) {
    const logs = Object.keys(items)
      .filter((k) => k.startsWith('ccg_log_'))
      .map((k) => items[k]);
    render(computeStats(logs));
  });
}

document.getElementById('clear-btn').addEventListener('click', function () {
  chrome.storage.local.get(null, function (items) {
    const keys = Object.keys(items).filter((k) => k.startsWith('ccg_log_'));
    chrome.storage.local.remove(keys, function () {
      render(computeStats([]));
      const statusEl = document.getElementById('status');
      statusEl.textContent = 'Logs cleared.';
      setTimeout(() => { statusEl.textContent = ''; }, 3000);
    });
  });
});

loadAndRender();
