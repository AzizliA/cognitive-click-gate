/* =========================================================
   Cognitive Click Gate – Admin Dashboard Script
   ========================================================= */

'use strict';

const MINDFUL_SCORE_THRESHOLD = 70;

const GAME_ANSWER_LABELS = {
  'phishing': '🎣 Phishing attempt',
  'social-media-trap': '📱 Social media trap',
  'spam': '📧 Spam / newsletter',
  'legit': '✅ Legit source',
};

// ── Data loading ──────────────────────────────────────────

function loadLogs(callback) {
  chrome.storage.local.get(null, function (items) {
    const logs = Object.keys(items)
      .filter((k) => k.startsWith('ccg_log_'))
      .map((k) => items[k])
      .sort((a, b) => b.timestamp - a.timestamp);
    callback(logs);
  });
}

// ── Summary ───────────────────────────────────────────────

function renderSummary(logs) {
  const total = logs.length;
  const allows = logs.filter((e) => e.action === 'allow').length;
  const blocks = logs.filter((e) => e.action === 'block').length;

  const times = logs.map((e) => e.decisionTime).filter((t) => typeof t === 'number' && !isNaN(t));
  const avgTime = times.length > 0
    ? (times.reduce((a, b) => a + b, 0) / times.length).toFixed(1)
    : '—';

  const scores = logs.map((e) => e.score).filter((s) => typeof s === 'number' && !isNaN(s));
  const avgScore = scores.length > 0
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : '—';

  const mindfulCount = scores.filter((s) => s >= MINDFUL_SCORE_THRESHOLD).length;
  const safeRate = scores.length > 0 ? Math.round((mindfulCount / scores.length) * 100) + '%' : '—';

  const gameCount = logs.filter((e) => e.gameAnswer).length;
  const gameRate = total > 0 ? Math.round((gameCount / total) * 100) + '%' : '—';

  const allowRatio = total > 0 ? Math.round((allows / total) * 100) + '%' : '—';

  document.getElementById('sum-total').textContent = total;
  document.getElementById('sum-allows').textContent = allows;
  document.getElementById('sum-blocks').textContent = blocks;
  document.getElementById('sum-avg-time').textContent = avgTime;
  document.getElementById('sum-avg-score').textContent = avgScore;
  document.getElementById('sum-safe-rate').textContent = safeRate;
  document.getElementById('sum-game-rate').textContent = gameRate;
  document.getElementById('sum-allow-ratio').textContent = allowRatio;
}

// ── Game answer chart ─────────────────────────────────────

function renderGameChart(logs) {
  const container = document.getElementById('game-chart');
  const gameAnswers = logs.map((e) => e.gameAnswer).filter(Boolean);

  if (gameAnswers.length === 0) {
    container.innerHTML = '<p class="empty-msg">No game data yet.</p>';
    return;
  }

  const counts = {};
  for (const a of gameAnswers) {
    counts[a] = (counts[a] || 0) + 1;
  }

  const max = Math.max(...Object.values(counts));
  const ordered = ['phishing', 'social-media-trap', 'spam', 'legit'];

  container.innerHTML = ordered
    .filter((key) => counts[key] > 0)
    .map((key) => {
      const count = counts[key] || 0;
      const pct = max > 0 ? Math.round((count / max) * 100) : 0;
      const label = GAME_ANSWER_LABELS[key] || key;
      return `
        <div class="insight-row">
          <span class="insight-label">${label}</span>
          <div class="insight-bar-wrap">
            <div class="insight-bar" style="width:${pct}%"></div>
          </div>
          <span class="insight-count">${count}</span>
        </div>`;
    })
    .join('');
}

// ── Risk pattern trend ────────────────────────────────────

function renderRiskTrend(logs) {
  const el = document.getElementById('risk-trend');
  if (logs.length === 0) {
    el.textContent = 'No data yet. Start browsing to generate trend analysis.';
    return;
  }

  const gameAnswers = logs.map((e) => e.gameAnswer).filter(Boolean);
  const counts = {};
  for (const a of gameAnswers) {
    counts[a] = (counts[a] || 0) + 1;
  }

  const recentScores = logs.slice(0, 10).map((e) => e.score).filter((s) => typeof s === 'number');
  const recentAvg = recentScores.length > 0
    ? recentScores.reduce((a, b) => a + b, 0) / recentScores.length
    : null;

  const olderScores = logs.slice(10, 20).map((e) => e.score).filter((s) => typeof s === 'number');
  const olderAvg = olderScores.length > 0
    ? olderScores.reduce((a, b) => a + b, 0) / olderScores.length
    : null;

  const lines = [];

  if (gameAnswers.length > 0) {
    const topAnswer = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    const topLabel = GAME_ANSWER_LABELS[topAnswer[0]] || topAnswer[0];
    lines.push(`🔝 Most flagged risk type: ${topLabel} (${topAnswer[1]} times)`);

    const phishingRate = (counts['phishing'] || 0) / gameAnswers.length;
    if (phishingRate > 0.4) {
      lines.push('⚠️ High phishing awareness — you frequently identify phishing risks.');
    }
    if ((counts['legit'] || 0) / gameAnswers.length > 0.6) {
      lines.push('✅ Most links are identified as legitimate sources.');
    }
  } else {
    lines.push('🎮 No game answers recorded yet. Try the Threat Awareness Check next time.');
  }

  if (recentAvg !== null && olderAvg !== null) {
    if (recentAvg > olderAvg + 5) {
      lines.push('📈 Your impulse score is increasing — you are making faster decisions recently.');
    } else if (recentAvg < olderAvg - 5) {
      lines.push('📉 Your impulse score is decreasing — you are becoming more deliberate.');
    } else {
      lines.push('📊 Your decision behavior has been consistent recently.');
    }
  }

  const blockRate = logs.filter((e) => e.action === 'block').length / logs.length;
  if (blockRate > 0.5) {
    lines.push('🛡️ You block more than half of flagged links — strong protective behavior.');
  } else if (blockRate < 0.1) {
    lines.push('🔓 You rarely block links. Consider reviewing suspicious destinations.');
  }

  el.innerHTML = lines.map((l) => `<div style="margin-bottom:6px">${l}</div>`).join('');
}

// ── History table ─────────────────────────────────────────

function renderHistory(logs) {
  const tbody = document.getElementById('history-body');
  const recent = logs.slice(0, 20);

  if (recent.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-msg">No sessions recorded.</td></tr>';
    return;
  }

  tbody.innerHTML = recent.map((entry, i) => {
    const ts = entry.timestamp
      ? new Date(entry.timestamp).toLocaleString()
      : '—';
    const domain = entry.domain || (entry.url ? new URL(entry.url).hostname : '—');
    const dt = entry.decisionTime != null ? entry.decisionTime.toFixed(1) + 's' : '—';
    const score = typeof entry.score === 'number' ? entry.score : '—';
    const scoreCls = typeof entry.score === 'number' && entry.score >= MINDFUL_SCORE_THRESHOLD
      ? 'score-mindful'
      : 'score-impulsive';
    const actionTag = entry.action === 'allow'
      ? '<span class="tag tag-allow">✅ Allow</span>'
      : '<span class="tag tag-block">❌ Block</span>';
    const gameLabel = entry.gameAnswer
      ? (GAME_ANSWER_LABELS[entry.gameAnswer] || entry.gameAnswer)
      : '<span style="color:#303060">—</span>';

    return `
      <tr>
        <td style="color:#303060">${i + 1}</td>
        <td>${ts}</td>
        <td style="font-family:'Courier New',monospace;color:#8080c0">${escapeHtml(String(domain))}</td>
        <td>${dt}</td>
        <td><span class="score-badge ${scoreCls}">${score}</span></td>
        <td>${actionTag}</td>
        <td style="color:#7070a8">${gameLabel}</td>
      </tr>`;
  }).join('');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Render all ────────────────────────────────────────────

function renderAll(logs) {
  renderSummary(logs);
  renderGameChart(logs);
  renderRiskTrend(logs);
  renderHistory(logs);
}

function init() {
  loadLogs(renderAll);
}

// ── Event listeners ───────────────────────────────────────

document.getElementById('clear-btn').addEventListener('click', () => {
  if (!confirm('Clear all behavioral logs? This cannot be undone.')) return;
  chrome.storage.local.get(null, function (items) {
    const keys = Object.keys(items).filter((k) => k.startsWith('ccg_log_'));
    chrome.storage.local.remove(keys, function () {
      renderAll([]);
      const bar = document.getElementById('status-bar');
      bar.textContent = 'All logs cleared.';
      setTimeout(() => { bar.textContent = ''; }, 4000);
    });
  });
});

document.getElementById('export-btn').addEventListener('click', () => {
  loadLogs((logs) => {
    const json = JSON.stringify(logs, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ccg-logs-' + Date.now() + '.json';
    a.click();
    URL.revokeObjectURL(url);
  });
});

init();
