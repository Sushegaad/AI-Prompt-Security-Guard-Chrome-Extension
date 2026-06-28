/* ============================================================================
 * AI Safety Guard — Background Service Worker (MV3)
 * ----------------------------------------------------------------------------
 * Phase 1 skeleton. Responsibilities grow in later phases:
 *   - settings hub (single owner of chrome.storage reads/writes)   [Phase 4]
 *   - stats tracking (riskySubmissionsCaught counter)              [Phase 4]
 *   - first-run onboarding redirect                                [Phase 4]
 *
 * MV3 service workers are EPHEMERAL — they shut down when idle. Never store
 * state in memory here; read from chrome.storage.local on every message.
 * ========================================================================== */

import { DEFAULT_SENSITIVITY } from '../shared/constants.js';

// First-run: open the onboarding tab. (Full 3-step flow lands in Phase 4.)
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/onboarding/onboarding.html') });
  }
  console.log('[AI Safety Guard] installed. Default sensitivity:', DEFAULT_SENSITIVITY);
});

// Message hub stub — handlers (GET_SETTINGS, SETTINGS_UPDATED, RECORD_CATCH)
// are implemented in Phase 4.
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('[AI Safety Guard] message received:', message?.type);
  sendResponse({ ok: true });
  return true;
});
