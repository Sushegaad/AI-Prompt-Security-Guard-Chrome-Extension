/* ============================================================================
 * AI Safety Guard — First-Run Onboarding (Screen E)
 * ----------------------------------------------------------------------------
 * Phase 1 skeleton. The 3-step flow (safety-net intro → sensitivity cards →
 * site toggles) and "Start protecting me" persistence are built in Phase 4.
 * ========================================================================== */

import { SENSITIVITY } from '../shared/constants.js';

const recommended = Object.values(SENSITIVITY).find((m) => m.recommended);
console.log('[AI Safety Guard] onboarding loaded. Recommended mode:', recommended?.label);
