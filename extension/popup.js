/* =========================================================
   Cognitive Click Gate – Popup Script (Behavioral Coach UI)
   ========================================================= */

'use strict';

// ── Helpers ───────────────────────────────────────────────

function todayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function computeStreak(logs) {
  // Streak = consecutive mindful decisions (score >= 70) from the most recent backwards
  const sorted = logs
    .filter((e) => typeof e.score === 'number')
    .sort((a, b) => b.timestamp - a.timestamp);
  let streak = 0;
  for (const entry of sorted) {
    if (entry.score >= 70) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

function generateInsight(logs) {
  if (logs.length === 0) return 'No sessions recorded yet. Start browsing to build your profile.';

  const recent = logs.slice(-10);
  const avgTime = recent.reduce((s, e) => s + (e.decisionTime || 0), 0) / recent.length;
  const avgScore = recent.reduce((s, e) => s + (e.score || 0), 0) / recent.length;
  const allowRate = logs.filter((e) => e.action === 'allow').length / logs.length;

  const gamePlays = logs.filter((e) => e.gameAnswer).length;
  const gameAnswers = logs.map((e) => e.gameAnswer).filter(Boolean);
  const topAnswer = gameAnswers.length > 0
    ? Object.entries(
        gameAnswers.reduce((acc, a) => { acc[a] = (acc[a] || 0) + 1; return acc; }, {})
      ).sort((a, b) => b[1] - a[1])[0][0]
    : null;

  const answerLabels = {
    'phishing': 'phishing attempts',
    'social-media-trap': 'social media traps',
    'spam': 'spam/newsletters',
    'legit': 'legit sources',
  };

  let insight = '';
  if (avgScore >= 70) {
    insight = '✨ Your awareness is improving — you tend to make decisive, confident clicks.';
  } else if (avgTime < 3) {
    insight = '⚡ You tend to click quickly. Try pausing a moment longer to reflect.';
  } else if (avgTime > 8) {
    insight = '🤔 You take time before deciding — a sign of thoughtful browsing.';
  } else {
    insight = '🧠 You show balanced decision behavior. Keep it up!';
  }

  if (allowRate > 0.9) {
    insight += ' You rarely block links.';
  } else if (allowRate < 0.4) {
    insight += ' You block links frequently — good threat awareness.';
  }

  if (topAnswer) {
    insight += ` You most often flag ${answerLabels[topAnswer] || topAnswer}.`;
  }

  const impulseLevel = avgScore >= 70 ? 'Low' : avgScore >= 40 ? 'Medium' : 'High';
  insight += ` Impulse level: ${impulseLevel}.`;

  return insight;
}

// ── Render ────────────────────────────────────────────────

function render(logs) {
  const today = todayStart();
  const todayLogs = logs.filter((e) => e.timestamp >= today);

  // Last session
  const last = logs.length > 0
    ? logs.sort((a, b) => b.timestamp - a.timestamp)[0]
    : null;

  const domainEl = document.getElementById('session-domain');
  const timeEl = document.getElementById('session-time');
  const actionEl = document.getElementById('session-action');
  const statusEl = document.getElementById('gate-status');

  if (last) {
    domainEl.textContent = last.domain || last.url || '—';
    timeEl.textContent = '⏱ ' + (last.decisionTime != null ? last.decisionTime.toFixed(1) + 's' : '—');
    const actionIcon = last.action === 'allow' ? '✅ Allowed' : '❌ Blocked';
    actionEl.textContent = actionIcon;
    statusEl.textContent = 'Active';
    statusEl.className = 'active';
  } else {
    domainEl.textContent = 'No sessions yet';
    timeEl.textContent = '⏱ —';
    actionEl.textContent = '—';
    statusEl.textContent = 'Idle';
    statusEl.className = 'idle';
  }

  // Behavioral insight
  document.getElementById('insight-box').textContent = generateInsight(logs);

  // Today's stats
  const totalToday = todayLogs.length;
  const mindfulToday = todayLogs.filter((e) => e.score >= 70).length;
  const safeRate = totalToday > 0 ? Math.round((mindfulToday / totalToday) * 100) + '%' : '—';
  const times = todayLogs.map((e) => e.decisionTime).filter((t) => typeof t === 'number');
  const avgSpeed = times.length > 0
    ? (times.reduce((a, b) => a + b, 0) / times.length).toFixed(1)
    : '—';
  const streak = computeStreak(logs);

  document.getElementById('today-total').textContent = totalToday;
  document.getElementById('safe-rate').textContent = safeRate;
  document.getElementById('avg-speed').textContent = avgSpeed;
  document.getElementById('streak').textContent = streak > 0 ? streak : '—';
}

function init() {
  chrome.storage.local.get(null, function (items) {
    const logs = Object.keys(items)
      .filter((k) => k.startsWith('ccg_log_'))
      .map((k) => items[k]);
    render(logs);
  });
}

// ── Event listeners ───────────────────────────────────────

document.getElementById('open-admin').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('admin.html') });
});

document.getElementById('clear-stats').addEventListener('click', () => {
  chrome.storage.local.get(null, function (items) {
    const keys = Object.keys(items).filter((k) => k.startsWith('ccg_log_'));
    chrome.storage.local.remove(keys, function () {
      render([]);
      const statusEl = document.getElementById('status');
      statusEl.textContent = 'Data cleared.';
      setTimeout(() => { statusEl.textContent = ''; }, 3000);
    });
  });
});

init();
