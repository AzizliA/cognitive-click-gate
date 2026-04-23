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

    // (click attempt is recorded when the decision is made)

    // Focus the first input for accessibility
    setTimeout(() => {
      const input = document.getElementById('ccg-sender');
      if (input) input.focus();
    }, 50);

    function closeGate() {
      gateOpen = false;
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    }

    function recordDecision(decision) {
      const decidedAt = Date.now();
      const sender = (document.getElementById('ccg-sender') || {}).value || '';
      const trustEl = document.querySelector('input[name="ccg-trust"]:checked');
      const trust = trustEl ? trustEl.value : 'unanswered';

      const entry = {
        url: href,
        action: decision,
        time: decidedAt - clickedAt, // milliseconds
        timestamp: decidedAt,
      };
      saveLog(entry);

      return entry;
    }

    document.getElementById('ccg-allow').addEventListener('click', () => {
      recordDecision('allow');
      closeGate();
      window.location.href = href;
    });

    document.getElementById('ccg-block').addEventListener('click', () => {
      recordDecision('block');
      closeGate();
    });

    // Keyboard: Escape = block
    function handleKey(e) {
      if (e.key === 'Escape') {
        recordDecision('block');
        closeGate();
        document.removeEventListener('keydown', handleKey);
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
