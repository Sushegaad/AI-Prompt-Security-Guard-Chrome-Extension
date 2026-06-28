/* ============================================================================
 * AI Safety Guard — Toolbar Popup (Screen D)
 * ----------------------------------------------------------------------------
 * Phase 1 skeleton. Full popup (segmented sensitivity control, per-site
 * toggles, '142 risky sends caught' counter, custom-domain input) is built in
 * Phase 4, reading/writing settings via the service worker.
 * ========================================================================== */

import { SENSITIVITY, DEFAULT_SENSITIVITY } from '../shared/constants.js';

console.log(
  '[AI Safety Guard] popup loaded. Modes:',
  Object.keys(SENSITIVITY).join(', '),
  '· default:',
  DEFAULT_SENSITIVITY
);
