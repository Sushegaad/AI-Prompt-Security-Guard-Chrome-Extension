/* ============================================================================
 * AI Prompt - Security Guard — Logo mark (single source)
 * ----------------------------------------------------------------------------
 * A shield built from a chat bubble: protection meets conversation. The notch
 * at the base reads as a speech tail; the keyhole inside signals privacy.
 * Built from brand tokens so there are no hardcoded colors — the toolbar/store
 * icons (rendered to PNG) and the in-UI wordmark all come from this one mark.
 * Spec: Plans/AI Prompt - Security Guard Logo.pdf (200-unit grid, 12% inset).
 * ========================================================================== */

import { BRAND } from './constants.js';

/**
 * The bubble-shield + keyhole mark as an SVG string (64x64 viewBox,
 * transparent bg). Two facets (light left / trust right) split on the axis.
 *
 * @param {object} [opts]
 * @param {boolean} [opts.simple] At tiny sizes (16px toolbar icon) the keyhole
 *   simplifies to a solid dot — the shield silhouette still reads.
 */
export function logoSvg({ simple = false } = {}) {
  const keyhole = simple
    ? `<circle cx="32" cy="29" r="7.5" fill="${BRAND.onTrust}"/>`
    : `<circle cx="32" cy="26" r="6.2" fill="${BRAND.onTrust}"/>` +
      `<path d="M29.3 29.5 L34.7 29.5 L36.6 42 L27.4 42 Z" fill="${BRAND.onTrust}"/>`;
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
    // chat-bubble shield, left facet (the bottom point doubles as the speech tail)
    `<path d="M32 6 L17 6 Q11 6 11 12 L11 31 Q11 42.5 21 48.5 L32 57 Z" fill="${BRAND.trustLight}"/>` +
    // right facet
    `<path d="M32 6 L47 6 Q53 6 53 12 L53 31 Q53 42.5 43 48.5 L32 57 Z" fill="${BRAND.trust}"/>` +
    keyhole +
    '</svg>'
  );
}

/** The mark as a data: URI for use in CSS url(...) / background-image. */
export function logoDataUri() {
  return 'data:image/svg+xml,' + encodeURIComponent(logoSvg());
}
