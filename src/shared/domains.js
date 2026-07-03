/* ============================================================================
 * AI Safety Guard — Custom-domain helpers (single source)
 * ----------------------------------------------------------------------------
 * Validation/normalization of user-entered custom domains, plus the derived
 * origin patterns and dynamic-content-script ids. Used by the popup (input
 * validation + permission request), storage (sanitization), and the service
 * worker (registration reconciliation) so all three can never disagree.
 * ========================================================================== */

import { siteForHost } from './sites.js';

/** Dynamic content-script registration id for a host. */
export function scriptIdFor(host) {
  return 'aisg-' + host;
}

/** Chrome origin match pattern for a host. */
export function originFor(host) {
  return `https://${host}/*`;
}

const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;

/**
 * Normalize free-text input to a bare https hostname.
 * Returns { host } on success or { error } with a human-readable reason.
 *
 * Accepted:  "chat.example.com", "https://chat.example.com/path", "Foo.AI"
 * Rejected:  http:// URLs (extension only runs on https), bare IPs,
 *            localhost, single-label names, wildcards, ports.
 */
export function normalizeHostname(input) {
  const raw = String(input || '').trim();
  if (!raw) return { error: 'Enter a domain, like chat.example.com' };
  if (/^http:\/\//i.test(raw)) return { error: 'Only https:// sites are supported' };
  if (raw.includes('*')) return { error: 'Wildcards aren’t supported — enter one domain' };

  // Lean on the URL parser for scheme/path/userinfo handling + punycode.
  let host;
  try {
    const candidate = /^https:\/\//i.test(raw) ? raw : 'https://' + raw;
    const u = new URL(candidate);
    if (u.username || u.password) return { error: 'That doesn’t look like a plain domain' };
    if (u.port) return { error: 'Leave the port off — just the domain' };
    host = u.hostname.toLowerCase();
  } catch {
    return { error: 'That doesn’t look like a valid domain' };
  }

  if (host.length > 253) return { error: 'That domain is too long' };
  if (host === 'localhost' || IPV4.test(host) || host.startsWith('[')) {
    return { error: 'IP addresses and localhost aren’t supported' };
  }
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)) {
    return { error: 'Enter a full domain, like chat.example.com' };
  }
  if (siteForHost(host)) {
    return { error: 'That site is already supported — toggle it above' };
  }
  return { host };
}
