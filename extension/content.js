/* =========================================================
   Cognitive Click Gate – Content Script
   Intercepts external link clicks and shows the gate UI.
   ========================================================= */

(function () {
  'use strict';

  const CURRENT_HOST = location.hostname;

  // ── Utility ──────────────────────────────────────────────

  function isExternal(href) {
    try {
      const url = new URL(href, location.href);
      return (
        url.protocol.startsWith('http') &&
        url.hostname !== CURRENT_HOST &&
        url.hostname !== ''
      );
    } catch {
      return false;
    }
  }

  function resolveHref(target) {
    let el = target;
    while (el && el.tagName !== 'A') {
      el = el.parentElement;
    }
    return el ? el.href : null;
  }

  function getDomain(href) {
    try {
      return new URL(href).hostname;
    } catch {
      return href;
    }
  }

  // ── chrome.storage.local helpers ─────────────────────────

  let _logCounter = 0;

  function saveLog(entry) {
    // Use timestamp + incrementing counter per tab to guarantee unique keys
    // across concurrent tabs writing at the same millisecond.
    const key = 'ccg_log_' + entry.timestamp + '_' + (++_logCounter);
    chrome.storage.local.set({ [key]: entry });
  }

  // ── Gate UI ───────────────────────────────────────────────

  let gateOpen = false;

  function buildGate(href, clickedAt) {
    const domain = getDomain(href);

    const overlay = document.createElement('div');
    overlay.id = 'ccg-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Cognitive Click Gate');

    overlay.innerHTML = `
      <div id="ccg-gate">
        <div id="ccg-header">
          <div id="ccg-icon">⚠</div>
          <h1 id="ccg-title">Pause. Reflect. Decide.</h1>
          <p id="ccg-subtitle">You are about to leave this page.</p>
        </div>

        <div id="ccg-quick-check">
          <span id="ccg-qc-label">🎮 Quick Check</span>
          <div id="ccg-qc-row">
            <span id="ccg-countdown" title="Countdown">3</span>
            <span id="ccg-timer" title="Decision time">0.0s</span>
          </div>
        </div>

        <div id="ccg-body">
          <div class="ccg-question">
            <label class="ccg-label">Who is the sender of this link?</label>
            <input
              id="ccg-sender"
              class="ccg-input"
              type="text"
              placeholder="e.g. a colleague, social media, newsletter…"
              autocomplete="off"
            />
          </div>

          <div class="ccg-question">
            <label class="ccg-label">What domain are you visiting?</label>
            <div id="ccg-domain" class="ccg-domain-box">${escapeHtml(domain)}</div>
          </div>

          <div class="ccg-question">
            <label class="ccg-label">Do you trust this destination?</label>
            <div id="ccg-trust-group" class="ccg-trust-group">
              <label class="ccg-trust-option">
                <input type="radio" name="ccg-trust" value="yes" />
                <span>Yes, I trust it</span>
              </label>
              <label class="ccg-trust-option">
                <input type="radio" name="ccg-trust" value="no" />
                <span>No / I'm not sure</span>
              </label>
            </div>
          </div>
        </div>

        <div id="ccg-actions">
          <button id="ccg-allow" class="ccg-btn ccg-btn-allow" type="button">
            ✅ Allow &amp; Continue
          </button>
          <button id="ccg-block" class="ccg-btn ccg-btn-block" type="button">
            ❌ Block &amp; Stay
          </button>
        </div>

        <div id="ccg-url-preview">${escapeHtml(href)}</div>
      </div>
    `;

    return overlay;
  }

  function computeScore(decisionTimeSec) {
    // Higher impulse score = faster, more impulsive decision (0–100).
    // Coefficient 6 means score reaches 0 at ~16.7 s (a very deliberate decision).
    return Math.max(0, Math.min(100, Math.round(100 - decisionTimeSec * 6)));
  }

  function buildResultPanel(decisionTimeSec, score, action) {
    const isMindful = score < 60;
    const feedback = isMindful
      ? '🟢 Mindful decision'
      : '🟡 Impulsive click detected';
    const actionLabel = action === 'allow' ? '✅ Allowed' : '❌ Blocked';
    return `
      <div id="ccg-result">
        <div id="ccg-result-feedback">${feedback}</div>
        <div id="ccg-result-action">${actionLabel}</div>
        <div id="ccg-result-stats">
          <div class="ccg-result-stat">
            <span class="ccg-result-stat-value">${decisionTimeSec.toFixed(1)}s</span>
            <span class="ccg-result-stat-label">Decision Time</span>
          </div>
          <div class="ccg-result-stat">
            <span class="ccg-result-stat-value">${score}</span>
            <span class="ccg-result-stat-label">Impulse Score</span>
          </div>
        </div>
      </div>
    `;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function showGate(href) {
    if (gateOpen) return;
    gateOpen = true;

    const clickedAt = Date.now();
    const overlay = buildGate(href, clickedAt);
    document.body.appendChild(overlay);

    // ── Quick Check timer ─────────────────────────────────────
    let decided = false;
    const timerEl = document.getElementById('ccg-timer');
    const countdownEl = document.getElementById('ccg-countdown');

    const tickInterval = setInterval(() => {
      const elapsed = (Date.now() - clickedAt) / 1000;
      if (timerEl) timerEl.textContent = elapsed.toFixed(1) + 's';
      const remaining = Math.max(0, 3 - Math.floor(elapsed));
      if (countdownEl) {
        countdownEl.textContent = remaining > 0 ? remaining : '⏱';
      }
    }, 100);

    // Focus the first input for accessibility
    setTimeout(() => {
      const input = document.getElementById('ccg-sender');
      if (input) input.focus();
    }, 50);

    function closeGate() {
      gateOpen = false;
      clearInterval(tickInterval);
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    }

    function showResult(action, decisionTimeSec, score) {
      const gate = document.getElementById('ccg-gate');
      if (gate) {
        gate.innerHTML = buildResultPanel(decisionTimeSec, score, action);
      }
    }

    function recordDecision(decision) {
      if (decided) return null;
      decided = true;
      clearInterval(tickInterval);

      const decidedAt = Date.now();
      const decisionTimeSec = (decidedAt - clickedAt) / 1000;
      const score = computeScore(decisionTimeSec);

      const entry = {
        url: href,
        action: decision,
        time: decidedAt - clickedAt, // milliseconds (kept for backward compat)
        decisionTime: parseFloat(decisionTimeSec.toFixed(2)),
        score: score,
        timestamp: decidedAt,
      };
      saveLog(entry);

      return { decisionTimeSec, score };
    }

    document.getElementById('ccg-allow').addEventListener('click', () => {
      const result = recordDecision('allow');
      if (!result) return;
      showResult('allow', result.decisionTimeSec, result.score);
      setTimeout(() => {
        closeGate();
        window.location.href = href;
      }, 2000);
    });

    document.getElementById('ccg-block').addEventListener('click', () => {
      const result = recordDecision('block');
      if (!result) return;
      showResult('block', result.decisionTimeSec, result.score);
      setTimeout(closeGate, 2000);
    });

    // Keyboard: Escape = block
    function handleKey(e) {
      if (e.key === 'Escape') {
        const result = recordDecision('block');
        document.removeEventListener('keydown', handleKey);
        if (!result) return;
        showResult('block', result.decisionTimeSec, result.score);
        setTimeout(closeGate, 2000);
      }
    }
    document.addEventListener('keydown', handleKey);
  }

  // ── Click Interception ────────────────────────────────────

  document.addEventListener(
    'click',
    function (e) {
      const href = resolveHref(e.target);
      if (!href) return;
      if (!isExternal(href)) return;

      e.preventDefault();
      e.stopImmediatePropagation();

      showGate(href);
    },
    true // capture phase – runs before page handlers
  );
})();
