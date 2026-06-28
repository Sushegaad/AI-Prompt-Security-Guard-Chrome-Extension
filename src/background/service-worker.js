/* ============================================================================
 * AI Safety Guard — Background Service Worker (MV3)
 * ----------------------------------------------------------------------------
 * The single owner of chrome.storage reads/writes and the message hub for
 * content scripts / popup / onboarding.
 *
 * MV3 service workers are EPHEMERAL — they shut down when idle. We never hold
 * settings in memory; every handler reads from chrome.storage fresh.
 * ========================================================================== */

import { MSG, readSettings, writeSettings, bumpCatch } from '../shared/storage.js';

/* --- First run: open onboarding ------------------------------------------ */
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/onboarding/onboarding.html') });
  }
});

/* --- Broadcast settings to every content script -------------------------- */
async function broadcastSettings(settings) {
  let tabs = [];
  try {
    tabs = await chrome.tabs.query({});
  } catch {
    return;
  }
  for (const tab of tabs) {
    if (!tab.id) continue;
    // Tabs without our content script will reject — ignore those.
    chrome.tabs.sendMessage(tab.id, { type: MSG.SETTINGS_UPDATED, settings }).catch(() => {});
  }
}

/**
 * Pure-ish message router (exported for tests). Calls the injected storage
 * helpers and returns the response object to send back.
 */
export async function routeMessage(msg, deps = {}) {
  const read = deps.readSettings || readSettings;
  const write = deps.writeSettings || writeSettings;
  const bump = deps.bumpCatch || bumpCatch;
  const broadcast = deps.broadcast || broadcastSettings;

  switch (msg && msg.type) {
    case MSG.GET_SETTINGS:
      return read();
    case MSG.SET_SETTINGS: {
      const settings = await write(msg.patch || {});
      await broadcast(settings);
      return settings;
    }
    case MSG.RECORD_CATCH: {
      const riskySubmissionsCaught = await bump();
      return { riskySubmissionsCaught };
    }
    default:
      return { ok: false, error: 'unknown_message' };
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Defense-in-depth: only accept messages originating from THIS extension
  // (our content scripts / popup / onboarding). Reject anything else.
  if (sender && sender.id && sender.id !== chrome.runtime.id) {
    sendResponse({ ok: false, error: 'forbidden_sender' });
    return false;
  }
  routeMessage(msg)
    .then(sendResponse)
    .catch((err) => sendResponse({ ok: false, error: String(err) }));
  return true; // keep the channel open for the async response
});
