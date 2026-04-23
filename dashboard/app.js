/* =========================================================
   Cognitive Click Gate – Dashboard App
   ========================================================= */

'use strict';

const API = 'http://localhost:3000';

// ── Data fetching ─────────────────────────────────────────────

async function fetchStats() {
  const res = await fetch(`${API}/stats`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── Rendering ─────────────────────────────────────────────────

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value !== null && value !== undefined ? value : '—';
}

function renderSummaryCards(data) {
  setText('stat-attempts', data.attempts ?? 0);
  setText('stat-allows',   data.allows   ?? 0);
  setText('stat-blocks',   data.blocks   ?? 0);
  setText('stat-ratio',    data.allowRatio !== null ? data.allowRatio + '%' : '—');
  setText('stat-avg-time', data.avgDecisionTimeSec !== null ? data.avgDecisionTimeSec : '—');
}

function renderBehaviorSummary(data) {
  const el = document.getElementById('behavior-summary');
  if (!el) return;

  const total   = data.totalDecisions || 0;
  const allows  = data.allows || 0;
  const blocks  = data.blocks || 0;
  const ratio   = data.allowRatio;
  const avgTime = data.avgDecisionTimeSec;

  if (total === 0) {
    el.innerHTML = '<em>No decisions recorded yet. Click an external link to get started.</em>';
    return;
  }

  let tendency = ratio >= 70
    ? '⚠ High allow rate — consider evaluating links more critically.'
    : ratio <= 30
    ? '✅ Cautious behavior — most links are being blocked.'
    : '📊 Balanced behavior — roughly equal allow and block decisions.';

  let speed = avgTime === null ? ''
    : avgTime < 3
    ? ' Decisions are made very quickly — consider pausing longer to reflect.'
    : avgTime > 10
    ? ' Decisions take significant time — you are reflecting carefully.'
    : ' Decision time is in a healthy deliberate range.';

  el.innerHTML = `
    <strong>${total}</strong> decision${total !== 1 ? 's' : ''} recorded across
    <strong>${data.attempts}</strong> click attempt${data.attempts !== 1 ? 's' : ''}.
    <strong>${allows}</strong> allowed, <strong>${blocks}</strong> blocked
    (allow ratio: <strong>${ratio !== null ? ratio + '%' : '—'}</strong>).
    ${avgTime !== null ? `Average decision time: <strong>${avgTime}s</strong>.` : ''}
    <br /><br />
    ${tendency}${speed}
  `;
}

function renderBar(data) {
  const total  = data.totalDecisions || 0;
  const allows = data.allows || 0;
  const blocks = data.blocks || 0;

  const allowPct = total > 0 ? ((allows / total) * 100).toFixed(1) : 0;
  const blockPct = total > 0 ? ((blocks / total) * 100).toFixed(1) : 0;

  const barAllow = document.getElementById('bar-allow');
  const barBlock = document.getElementById('bar-block');
  if (barAllow) {
    barAllow.style.width = allowPct + '%';
    document.getElementById('bar-allow-label').textContent =
      allowPct > 10 ? `${allowPct}%` : '';
  }
  if (barBlock) {
    barBlock.style.width = blockPct + '%';
    document.getElementById('bar-block-label').textContent =
      blockPct > 10 ? `${blockPct}%` : '';
  }
}

function renderTopDomains(data) {
  const container = document.getElementById('top-domains');
  if (!container) return;

  const domains = data.topDomains || [];
  if (domains.length === 0) {
    container.innerHTML = '<p class="empty-msg">No domain data yet.</p>';
    return;
  }

  const maxCount = domains[0].count;
  container.innerHTML = domains.map((d) => {
    const pct = ((d.count / maxCount) * 100).toFixed(0);
    return `
      <div class="domain-row">
        <span class="domain-name" title="${escapeHtml(d.domain)}">${escapeHtml(d.domain)}</span>
        <div class="domain-bar-wrap">
          <div class="domain-bar-fill" style="width:${pct}%"></div>
        </div>
        <span class="domain-count">${d.count}</span>
      </div>
    `;
  }).join('');
}

function renderEvents(data) {
  const tbody = document.getElementById('events-body');
  if (!tbody) return;

  const events = data.recent || [];
  if (events.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-msg">No events yet.</td></tr>';
    return;
  }

  tbody.innerHTML = events.map((e) => {
    const time = e.timestamp ? new Date(e.timestamp).toLocaleTimeString() : '—';
    const type = e.type === 'decision' ? 'Decision' : 'Attempt';
    const decision = e.decision
      ? `<span class="badge badge-${e.decision}">${e.decision}</span>`
      : `<span class="badge badge-attempt">—</span>`;
    const domain = escapeHtml(e.domain || '—');
    const dur = typeof e.decisionTimeSec === 'number' ? e.decisionTimeSec : '—';
    const sender = escapeHtml(e.sender || '—');
    const trust = escapeHtml(e.trust || '—');

    return `
      <tr>
        <td>${time}</td>
        <td>${type}</td>
        <td>${decision}</td>
        <td><code>${domain}</code></td>
        <td>${dur}</td>
        <td>${sender}</td>
        <td>${trust}</td>
      </tr>
    `;
  }).join('');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Main refresh cycle ────────────────────────────────────────

async function refresh() {
  try {
    const data = await fetchStats();
    renderSummaryCards(data);
    renderBehaviorSummary(data);
    renderBar(data);
    renderTopDomains(data);
    renderEvents(data);
    const lu = document.getElementById('last-updated');
    if (lu) lu.textContent = 'Last updated: ' + new Date().toLocaleTimeString();
  } catch (err) {
    const lu = document.getElementById('last-updated');
    if (lu) lu.textContent = '⚠ Cannot reach backend (http://localhost:3000). Is it running?';
  }
}

// ── Button handlers ───────────────────────────────────────────

document.getElementById('btn-refresh').addEventListener('click', refresh);

document.getElementById('btn-clear').addEventListener('click', async () => {
  if (!confirm('Clear all logged events? This cannot be undone.')) return;
  try {
    await fetch(`${API}/stats`, { method: 'DELETE' });
    await refresh();
  } catch {
    alert('Could not clear data — is the backend running?');
  }
});

// ── Auto-refresh every 10 seconds ────────────────────────────
refresh();
setInterval(refresh, 10000);
