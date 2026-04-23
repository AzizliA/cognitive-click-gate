/* =========================================================
   Cognitive Click Gate – Popup Script
   ========================================================= */

'use strict';

const DASHBOARD_URL = 'http://localhost:3000/dashboard';

// ── Read stats from all open tabs via executeScript ──────────

async function gatherStatsFromTabs() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return null;

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        try {
          const raw = localStorage.getItem('ccg_stats');
          return raw ? JSON.parse(raw) : { events: [] };
        } catch {
          return { events: [] };
        }
      },
    });
    return results && results[0] ? results[0].result : null;
  } catch {
    return null;
  }
}

function computeStats(data) {
  const events = (data && data.events) ? data.events : [];
  const decisions = events.filter((e) => e.type === 'decision');
  const allows = decisions.filter((e) => e.decision === 'allow').length;
  const blocks = decisions.filter((e) => e.decision === 'block').length;
  const total = decisions.length;
  const attempts = events.filter((e) => e.type === 'click_attempt').length;

  const times = decisions
    .map((e) => e.decisionTimeSec)
    .filter((t) => typeof t === 'number' && !isNaN(t));
  const avgTime =
    times.length > 0
      ? (times.reduce((a, b) => a + b, 0) / times.length).toFixed(1)
      : null;

  const ratio = total > 0 ? ((allows / total) * 100).toFixed(0) + '%' : '—';

  return { attempts, total, allows, blocks, avgTime, ratio };
}

function render(stats) {
  document.getElementById('total').textContent = stats.attempts || 0;
  document.getElementById('allows').textContent = stats.allows;
  document.getElementById('blocks').textContent = stats.blocks;
  document.getElementById('avg-time').textContent =
    stats.avgTime !== null ? stats.avgTime : '—';
  document.getElementById('ratio').textContent = stats.ratio;
}

async function init() {
  const data = await gatherStatsFromTabs();
  const stats = computeStats(data);
  render(stats);
}

// ── Event listeners ───────────────────────────────────────────

document.getElementById('open-dashboard').addEventListener('click', () => {
  chrome.tabs.create({ url: DASHBOARD_URL });
});

document.getElementById('clear-stats').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => localStorage.removeItem('ccg_stats'),
    });
    document.getElementById('status').textContent = 'Stats cleared.';
    render(computeStats(null));
  } catch {
    document.getElementById('status').textContent = 'Could not clear (restricted page).';
  }
});

init();
