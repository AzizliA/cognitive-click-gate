/* =========================================================
   Cognitive Click Gate – Backend Server
   Node.js + Express  |  run: node server.js
   ========================================================= */

'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;
const DB_PATH = path.join(__dirname, 'db.json');
const DASHBOARD_PATH = path.join(__dirname, '..', 'dashboard');

// ── Middleware ────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Serve dashboard at /dashboard
app.use('/dashboard', express.static(DASHBOARD_PATH));

// ── Persistence helpers ───────────────────────────────────────

function readDb() {
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { events: [] };
  }
}

function writeDb(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

// ── Routes ────────────────────────────────────────────────────

/**
 * POST /log-event
 * Body: { type, url, domain, decision?, decisionTimeSec?, sender?, trust?, timestamp }
 */
app.post('/log-event', (req, res) => {
  const event = req.body;

  if (!event || typeof event !== 'object') {
    return res.status(400).json({ error: 'Invalid event payload.' });
  }

  // Validate required fields
  if (!event.type || !event.url) {
    return res.status(400).json({ error: 'Missing required fields: type, url.' });
  }

  // Sanitise / stamp
  event.receivedAt = new Date().toISOString();

  const db = readDb();
  db.events.push(event);
  writeDb(db);

  res.status(201).json({ ok: true, count: db.events.length });
});

/**
 * GET /stats
 * Returns aggregate statistics over all logged events.
 */
app.get('/stats', (req, res) => {
  const db = readDb();
  const events = db.events || [];

  const attempts = events.filter((e) => e.type === 'click_attempt').length;
  const decisions = events.filter((e) => e.type === 'decision');
  const allows = decisions.filter((e) => e.decision === 'allow').length;
  const blocks = decisions.filter((e) => e.decision === 'block').length;
  const total = decisions.length;

  const times = decisions
    .map((e) => e.decisionTimeSec)
    .filter((t) => typeof t === 'number' && !isNaN(t));
  const avgDecisionTimeSec =
    times.length > 0
      ? parseFloat((times.reduce((a, b) => a + b, 0) / times.length).toFixed(2))
      : null;

  const allowRatio = total > 0 ? parseFloat(((allows / total) * 100).toFixed(1)) : null;

  // Top domains
  const domainMap = {};
  events.forEach((e) => {
    if (e.domain) {
      domainMap[e.domain] = (domainMap[e.domain] || 0) + 1;
    }
  });
  const topDomains = Object.entries(domainMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([domain, count]) => ({ domain, count }));

  // Recent events (last 20)
  const recent = events.slice(-20).reverse();

  res.json({
    attempts,
    totalDecisions: total,
    allows,
    blocks,
    allowRatio,
    avgDecisionTimeSec,
    topDomains,
    recent,
  });
});

/**
 * DELETE /stats
 * Clears all stored events.
 */
app.delete('/stats', (req, res) => {
  writeDb({ events: [] });
  res.json({ ok: true });
});

// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[CCG] Backend running at http://localhost:${PORT}`);
  console.log(`[CCG] Dashboard: http://localhost:${PORT}/dashboard`);
  console.log(`[CCG] Log events: POST http://localhost:${PORT}/log-event`);
  console.log(`[CCG] View stats: GET  http://localhost:${PORT}/stats`);
});
