/* ============================================================================
 * AI Prompt - Security Guard — Logo mark (single source)
 * ----------------------------------------------------------------------------
 * A shield (chat-bubble silhouette) with a keyhole inside: protection + privacy.
 * Built from brand tokens so there are no hardcoded colors — the toolbar/store
 * icons (rendered to PNG) and the in-UI wordmark all come from this one mark.
 * ========================================================================== */

import { BRAND } from './constants.js';

/** The shield+keyhole mark as an SVG string (64x64 viewBox, transparent bg). */
export function logoSvg() {
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
    `<path d="M32 8 L18.6 12.8 C17.7 13.1 17.1 13.9 17.1 14.9 L17.1 30.4 C17.1 41.3 23.4 49 32 53.6 Z" fill="${BRAND.trustLight}"/>` +
    `<path d="M32 8 L45.4 12.8 C46.3 13.1 46.9 13.9 46.9 14.9 L46.9 30.4 C46.9 41.3 40.6 49 32 53.6 Z" fill="${BRAND.trust}"/>` +
    `<circle cx="32" cy="25.5" r="5.2" fill="${BRAND.onTrust}"/>` +
    `<path d="M29.6 27.5 L34.4 27.5 L35.9 40 L28.1 40 Z" fill="${BRAND.onTrust}"/>` +
    '</svg>'
  );
}

/** The mark as a data: URI for use in CSS url(...) / background-image. */
export function logoDataUri() {
  return 'data:image/svg+xml,' + encodeURIComponent(logoSvg());
}
