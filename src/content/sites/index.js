/* ============================================================================
 * AI Safety Guard — Site adapter dispatcher
 * ----------------------------------------------------------------------------
 * Builds one adapter per registry entry (shared/sites.js) and resolves the
 * adapter for the current hostname. Custom domains added by the user fall back
 * to a generic adapter.
 * ========================================================================== */

import { makeAdapter } from './adapter-base.js';
import { SITES, siteForHost } from '../../shared/sites.js';

const generic = makeAdapter({
  id: 'custom',
  input: ['div[contenteditable="true"]', 'textarea[placeholder]', 'main textarea', 'textarea'],
  submit: ['button[type="submit"]', 'button[aria-label*="Send" i]', 'button[aria-label*="Submit" i]'],
});

// One adapter per registry site, keyed by id.
export const ADAPTERS = Object.fromEntries(
  SITES.map((s) => [
    s.id,
    makeAdapter({
      id: s.id,
      input: s.selectors.input,
      submit: s.selectors.submit,
      badgeAnchor: s.selectors.badgeAnchor,
    }),
  ])
);

/** Resolve the adapter for a hostname (default: current location host). */
export function getAdapter(host = location.hostname) {
  const site = siteForHost(host);
  return site ? ADAPTERS[site.id] : generic;
}
