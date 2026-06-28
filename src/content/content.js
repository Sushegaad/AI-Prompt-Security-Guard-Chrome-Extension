/* ============================================================================
 * AI Safety Guard — Content Script
 * ----------------------------------------------------------------------------
 * Phase 2: detection engine is wired in (debug only — logs a local scan of a
 * sample string). No UI yet. Later phases add:
 *   - MutationObserver loop + site adapters                        [Phase 3]
 *   - inline badge (A1) driven by detect()                         [Phase 3]
 *   - pre-submit warning modal (A2), redact (B1), rewrite (B2)     [Phase 3]
 * ========================================================================== */

import { shouldShowBadge, DEFAULT_SENSITIVITY } from '../shared/constants.js';
import { detect } from './detector.js';

(function bootstrap() {
  const demo = shouldShowBadge('safe', DEFAULT_SENSITIVITY);
  console.log(
    `[AI Safety Guard] content script active on ${location.host} ` +
      `(badge-on-safe under ${DEFAULT_SENSITIVITY}: ${demo})`
  );
  // Phase 2 smoke test — proves the on-device detector runs in-page. No prompt
  // text is ever sent anywhere; this is a fixed sample string.
  const sample = detect('demo: account #88291 sk-live-9fK2pQ7xR4mZ8vB1');
  console.log(
    `[AI Safety Guard] detector online — sample risk: ${sample.riskLevel}, ` +
      `findings: ${sample.summary || 'none'} (scanned locally · ${sample.scanMs}ms)`
  );
})();
