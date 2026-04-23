# Cognitive Click Gate

> **Pause. Reflect. Decide.**  
> A behavioral Chrome Extension that interrupts reflex clicking and forces a short cognitive reflection step before navigating to external links.

---

## Table of Contents

1. [Overview](#overview)
2. [Project Structure](#project-structure)
3. [Installation – Chrome Extension](#installation--chrome-extension)
4. [Running the Backend](#running-the-backend)
5. [Opening the Dashboard](#opening-the-dashboard)
6. [Step-by-Step Testing Guide](#step-by-step-testing-guide)
7. [Example Usage Scenario](#example-usage-scenario)
8. [Expected Behavior](#expected-behavior)
9. [Architecture](#architecture)

---

## Overview

**Cognitive Click Gate** intercepts every external link click in the browser. Instead of navigating immediately, a full-screen **Cognitive Gate** overlay appears and asks three reflective questions:

1. Who is the sender of this link?
2. What domain are you visiting?
3. Do you trust this destination?

The user then chooses **Allow** (proceed) or **Block** (stay on page). Every event is logged locally and optionally sent to a Node.js backend for analytics.

---

## Project Structure

```
cognitive-click-gate/
  extension/
    manifest.json      ← Chrome Extension MV3 manifest
    content.js         ← Intercepts clicks, shows Gate UI
    background.js      ← Service worker (MV3)
    popup.html         ← Extension toolbar popup
    popup.js           ← Popup stats + controls
    styles.css         ← Gate overlay styles (injected by content script)
    icons/
      icon16.png
      icon48.png
      icon128.png

  backend/
    server.js          ← Node.js + Express API server
    db.json            ← JSON flat-file event store
    package.json

  dashboard/
    index.html         ← Analytics dashboard
    app.js             ← Dashboard JS (fetches /stats)
    styles.css         ← Dashboard styles

  README.md
```

---

## Installation – Chrome Extension

**No build step required.**

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle, top-right corner)
3. Click **"Load unpacked"**
4. Select the `extension/` folder inside this repository
5. The **Cognitive Click Gate** extension will appear in your extensions list
6. Pin it to the toolbar for easy access to the popup

> ✅ The extension is now active on all pages.

---

## Running the Backend

The backend is optional — the extension works standalone. Run it to enable dashboard analytics.

### Prerequisites

- [Node.js](https://nodejs.org/) v16 or later

### Steps

```bash
cd backend
npm install
node server.js
```

You should see:

```
[CCG] Backend running at http://localhost:3000
[CCG] Dashboard: http://localhost:3000/dashboard
[CCG] Log events: POST http://localhost:3000/log-event
[CCG] View stats: GET  http://localhost:3000/stats
```

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/log-event` | Log a click attempt or decision event |
| `GET`  | `/stats` | Retrieve aggregated statistics |
| `DELETE` | `/stats` | Clear all stored events |

**POST `/log-event` body example:**
```json
{
  "type": "decision",
  "decision": "allow",
  "url": "https://github.com",
  "domain": "github.com",
  "sender": "colleague email",
  "trust": "yes",
  "decisionTimeSec": 4.2,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

## Opening the Dashboard

### Via the backend (recommended)

With the backend running, open:

```
http://localhost:3000/dashboard
```

### Direct file open (no backend)

Open `dashboard/index.html` directly in Chrome. Stats won't load without the backend, but the UI will render.

### Via extension popup

Click the **Cognitive Click Gate** icon in Chrome's toolbar → click **📊 Dashboard**.

---

## Step-by-Step Testing Guide

### Quick Test (Extension Only)

1. Load the extension (see [Installation](#installation--chrome-extension))
2. Open any website, e.g. `https://wikipedia.org`
3. Click **any link that goes to a different domain**  
   (e.g., a link from Google's homepage to another site, or any news article link)
4. The Cognitive Gate overlay appears **immediately**
5. Fill in the sender field, check the domain, select trust level
6. Click **✅ Allow & Continue** → you navigate to the destination
7. Or click **❌ Block & Stay** → you remain on the current page
8. Press **Escape** to block and dismiss

### Full Test (Extension + Backend + Dashboard)

1. Start the backend: `cd backend && npm install && node server.js`
2. Load the extension in Chrome
3. Open `http://localhost:3000/dashboard` in a second tab
4. Navigate to any website and click external links
5. Watch the dashboard update (auto-refreshes every 10 seconds, or click **↻ Refresh**)

### Test URLs to Try

Start on one of these pages, then click links that go to external domains:

| Starting Page | External Links Available |
|---------------|--------------------------|
| `https://news.ycombinator.com` | Many links to various domains |
| `https://reddit.com` | Links to articles across the web |
| `https://github.com/trending` | Links to external repos/docs |
| `https://duckduckgo.com/?q=test` | Search result links |
| Any Google search results page | Organic search links |

### Check the Extension Popup

Click the **Cognitive Click Gate** toolbar icon to view:
- Total click attempts (current tab session)
- Allow / Block counts
- Average decision time
- Click **📊 Dashboard** to open the analytics dashboard

---

## Example Usage Scenario

> Alice reads her morning email and sees a link claiming to be from her bank.
>
> She clicks the link — instead of being taken there immediately, **Cognitive Click Gate** shows the full-screen gate.
>
> The gate asks:
> - **Sender**: She types "Email from 'bank-alerts@secure-login.ru'"
> - **Domain**: The gate shows `secure-login.ru` (not her bank's real domain)
> - **Trust**: She selects "No / I'm not sure"
>
> Alice clicks **❌ Block & Stay** — the phishing attempt is prevented.
>
> Later, Alice checks the dashboard and sees a "high block rate" behavior summary, indicating she's been cautious about external links.

---

## Expected Behavior

| Action | Expected Result |
|--------|----------------|
| Click link to same domain | No gate — navigation proceeds normally |
| Click link to external domain | Cognitive Gate overlay appears |
| Click **Allow** | Gate closes, browser navigates to target URL |
| Click **Block** | Gate closes, browser stays on current page |
| Press **Escape** | Same as Block |
| Backend offline | Extension works normally, events saved to `localStorage` only |
| Backend online | Events sent to `POST /log-event` and stored in `db.json` |
| Dashboard refresh | Fetches fresh data from `GET /stats` and re-renders all panels |

### Behavior Summary Logic (Dashboard)

| Allow Ratio | Interpretation |
|-------------|---------------|
| ≥ 70% | ⚠ High allow rate — consider evaluating links more critically |
| ≤ 30% | ✅ Cautious behavior |
| 30–70% | 📊 Balanced behavior |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Chrome Browser                    │
│                                                     │
│  ┌──────────────┐     ┌──────────────────────────┐  │
│  │ content.js   │────▶│  Cognitive Gate Overlay  │  │
│  │ (all pages)  │     │  (full-screen, MV3)      │  │
│  └──────┬───────┘     └──────────────────────────┘  │
│         │ localStorage (ccg_stats)                   │
│         │ fetch (best-effort)                        │
│  ┌──────▼───────┐     ┌──────────────────────────┐  │
│  │  popup.js    │     │  background.js           │  │
│  │  (toolbar)   │     │  (service worker)        │  │
│  └──────────────┘     └──────────────────────────┘  │
└─────────────┬───────────────────────────────────────┘
              │ HTTP (optional)
              ▼
┌─────────────────────────┐
│  Node.js + Express      │
│  POST /log-event        │
│  GET  /stats            │
│  DELETE /stats          │
│  Serves /dashboard      │
│  ── db.json (flat) ──   │
└────────────┬────────────┘
             │ static files
             ▼
┌─────────────────────────┐
│  Dashboard (plain HTML) │
│  Auto-refreshes 10s     │
│  Allow/Block ratio bar  │
│  Top domains chart      │
│  Recent events table    │
└─────────────────────────┘
```

---

**License:** MIT
