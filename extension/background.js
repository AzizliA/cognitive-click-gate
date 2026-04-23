/* =========================================================
   Cognitive Click Gate – Background Service Worker (MV3)
   ========================================================= */

'use strict';

// Listen for messages from popup or content scripts if needed.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_STATS') {
    // Relay to popup – handled in popup.js via storage
    sendResponse({ ok: true });
  }
  return false;
});

// On extension install / update
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[CCG] Cognitive Click Gate installed.');
  }
});
