/* ============================================================================
 * AI Safety Guard — Settings storage & message protocol
 * ----------------------------------------------------------------------------
 * Single source of truth for the settings schema and the message types used
 * between content scripts / popup / onboarding and the service worker.
 *
 * The SERVICE WORKER owns all chrome.storage reads/writes (the read/write
 * helpers below run there). MV3 service workers are ephemeral, so every handler
 * reads from storage fresh — never from memory.
 * ========================================================================== */

import { DEFAULT_SENSITIVITY, DEFAULT_REWRITE_ENDPOINT } from './constants.js';

/** Full settings schema with defaults. */
export const DEFAULT_SETTINGS = Object.freeze({
  enabled: true,
  sensitivity: DEFAULT_SENSITIVITY, // "balanced"
  enabledSites: { chatgpt: true, claude: true, gemini: true, perplexity: true, copilot: true },
  customDomains: [],
  disabledCategories: [],
  allowRewrite: false, // true only after explicit B2 consent
  rewriteApiEndpoint: DEFAULT_REWRITE_ENDPOINT,
  analyticsEnabled: true, // opt-out
  onboardingComplete: false,
  riskySubmissionsCaught: 0, // lifetime counter shown in popup
});

/** Message types exchanged with the service worker. */
export const MSG = Object.freeze({
  GET_SETTINGS: 'GET_SETTINGS',
  SET_SETTINGS: 'SET_SETTINGS',
  SETTINGS_UPDATED: 'SETTINGS_UPDATED',
  RECORD_CATCH: 'RECORD_CATCH',
});

/** Deep-ish merge of stored values over defaults (enabledSites merged by key). */
export function withDefaults(stored = {}) {
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    enabledSites: { ...DEFAULT_SETTINGS.enabledSites, ...(stored.enabledSites || {}) },
  };
}

/* --- service-worker-side helpers (require chrome.storage.local) ----------- */

export async function readSettings(area) {
  const storage = area || chrome.storage.local;
  const stored = await storage.get(DEFAULT_SETTINGS);
  return withDefaults(stored);
}

export async function writeSettings(patch, area) {
  const storage = area || chrome.storage.local;
  await storage.set(patch);
  return readSettings(storage);
}

/** Increment the lifetime "risky sends caught" counter; returns the new value. */
export async function bumpCatch(area) {
  const storage = area || chrome.storage.local;
  const { riskySubmissionsCaught } = await storage.get({ riskySubmissionsCaught: 0 });
  const next = (riskySubmissionsCaught || 0) + 1;
  await storage.set({ riskySubmissionsCaught: next });
  return next;
}
