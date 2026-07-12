/* ============================================================================
 * AI Prompt - Security Guard — Shield Mode overlay (content-script side)
 * ----------------------------------------------------------------------------
 * When Shield Mode is ON for a site, an always-visible "Shield" chip sits on
 * the provider's composer. Clicking it (deliberate, never automatic) opens an
 * extension-origin iframe (the secure composer) over the real composer. The
 * user types inside the iframe — the provider's page scripts cannot read it.
 * On approval, the secure composer sends the approved text to the service
 * worker, which relays it here (SHIELD_INJECT); we write it into the real
 * composer with the existing writeInput() and optionally trigger the site's
 * send. Any draft already in the real composer is preserved (appended to),
 * never wiped — it was typed knowingly outside the shield.
 *
 * Boundary summary: raw text lives only in the iframe (extension origin).
 * Approved text reaches this content script via the SW relay — never through
 * the provider page's window. It touches the provider only at writeInput().
 * ========================================================================== */

import { readInput, writeInput } from '../dom-utils.js';
import { createShadowHost } from '../ui/shadow-style.js';
import { MSG } from '../../shared/storage.js';
import { log } from '../../shared/log.js';

const IFRAME_ID = 'asg-shield-frame';
const EXT_ORIGIN = (() => {
  try {
    return chrome.runtime.getURL('').replace(/\/$/, '');
  } catch {
    return '';
  }
})();

function randomNonce() {
  const a = new Uint8Array(16);
  (crypto || {}).getRandomValues?.(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function createShieldOverlay({ getComposer, getSubmitButton, doSubmit, settingsRef }) {
  let frame = null;
  let nonce = '';
  let active = false;
  let relayHandler = null;
  let resizeObserver = null;
  let repositionTimer = null;

  // The secure composer needs room for its header, findings list and action
  // bar even when the underlying composer has collapsed to a single row.
  const MIN_HEIGHT = 220;
  // Height the secure composer reported it needs for its current content
  // (SHIELD_RESIZE relay). 0 = no report yet.
  let contentHeight = 0;

  function positionOver(el) {
    if (!frame || !el) return;
    const r = el.getBoundingClientRect();
    // Cover the composer; grow with the iframe's reported content needs so the
    // typed text and findings stay readable (fixed positioning, viewport coords).
    const desired = Math.max(Math.max(r.height, 44) + 96, contentHeight);
    const height = Math.max(MIN_HEIGHT, Math.min(desired, window.innerHeight - 16));
    // Keep the frame fully on-screen: when the composer sits near the bottom
    // of the viewport (in-conversation layout), extend upward instead of
    // getting squashed against the bottom edge.
    const top = Math.max(8, Math.min(r.top, window.innerHeight - height - 8));
    Object.assign(frame.style, {
      position: 'fixed',
      left: r.left + 'px',
      top: top + 'px',
      width: r.width + 'px',
      height: height + 'px',
      zIndex: '2147483646',
      border: '0',
      colorScheme: 'normal',
    });
  }

  function open() {
    const composer = getComposer();
    if (!composer || active) return;
    active = true;
    nonce = randomNonce();
    syncChip(); // hide the chip while the shield is up

    const muted = (settingsRef().disabledCategories || []).join(',');
    const s = settingsRef().sensitivity || 'balanced';
    frame = document.createElement('iframe');
    frame.id = IFRAME_ID;
    frame.setAttribute('title', 'AI Prompt - Security Guard secure composer');
    frame.setAttribute('allow', ''); // no powerful features
    frame.src = chrome.runtime.getURL(
      `src/secure-composer/secure-composer.html?n=${nonce}&s=${encodeURIComponent(s)}&m=${encodeURIComponent(muted)}`
    );
    positionOver(composer);
    document.documentElement.appendChild(frame);

    // Move focus to the iframe (which focuses itself on load). Any draft in
    // the real composer stays put — it was typed deliberately outside the
    // shield, and approved text is APPENDED to it on injection.
    try {
      if (typeof composer.blur === 'function') composer.blur();
    } catch {
      /* ignore */
    }

    window.addEventListener('resize', reposition, true);
    window.addEventListener('scroll', reposition, true);
    // Follow composer size changes (multi-line growth, post-send collapse)…
    if (typeof ResizeObserver === 'function') {
      resizeObserver = new ResizeObserver(reposition);
      resizeObserver.observe(composer);
    }
    // …and position changes from SPA layout shifts, which fire neither
    // resize nor scroll (messages streaming in above the composer).
    repositionTimer = setInterval(reposition, 300);
  }

  function reposition() {
    if (active) positionOver(getComposer());
  }

  function close({ refocus = true } = {}) {
    if (!active) return;
    active = false;
    window.removeEventListener('resize', reposition, true);
    window.removeEventListener('scroll', reposition, true);
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
    if (repositionTimer) {
      clearInterval(repositionTimer);
      repositionTimer = null;
    }
    if (frame && frame.parentNode) frame.parentNode.removeChild(frame);
    frame = null;
    nonce = '';
    contentHeight = 0;
    syncChip(); // chip returns as soon as the shield is down
    if (refocus) {
      // Return focus to the real composer so the user can keep working.
      // Opening again is always deliberate (the chip), so no reopen loop.
      const c = getComposer();
      if (c && typeof c.focus === 'function') c.focus();
    }
  }

  // Approved text arrives from the SW relay (SHIELD_INJECT). Validate the nonce.
  function handleRelay(msg) {
    if (!active || !msg || msg.nonce !== nonce) return;
    if (msg.type === MSG.SHIELD_RESIZE) {
      contentHeight = Math.max(0, Number(msg.height) || 0);
      reposition();
      return;
    }
    if (msg.type === MSG.SHIELD_CANCEL) {
      close();
      return;
    }
    if (msg.type === MSG.SHIELD_INJECT) {
      const composer = getComposer();
      if (composer) {
        // Preserve any pre-existing draft: append, never overwrite.
        let existing = '';
        try {
          existing = readInput(composer) || '';
        } catch {
          /* treat as empty */
        }
        const approved = String(msg.text || '');
        writeInput(composer, existing.trim() ? existing + '\n' + approved : approved);
        if (msg.send) {
          // Let the site's framework register the value, then submit.
          setTimeout(() => {
            try {
              doSubmit ? doSubmit() : (getSubmitButton() && getSubmitButton().click());
            } catch {
              /* ignore */
            }
          }, 30);
        }
      }
      // On send, leave focus where the site puts it (refocusing mid-submit
      // can steal focus from the streaming response).
      close({ refocus: !msg.send });
    }
  }

  /* ---- The chip: always-visible, deliberate entry point ------------------ */
  // A small "Shield" pill pinned to the composer's top-right corner whenever
  // Shield Mode is ON for this site and the shield isn't already open.
  // Clicking it is the ONLY way the secure composer opens — nothing automatic,
  // so it can never surprise the user or race the site's own focus handling.
  let chipHost = null;
  let chipTimer = null;

  function ensureChip() {
    if (chipHost) return chipHost;
    const { host, root } = createShadowHost(document, 'asg-shield-chip-host');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'asg-shieldchip';
    btn.setAttribute(
      'aria-label',
      'Open the AI Prompt - Security Guard secure composer — type privately, the site cannot read it until you approve'
    );
    btn.title = 'Type privately — the site cannot read your text until you approve it';
    const dot = document.createElement('span');
    dot.className = 'asg-shieldchip__dot';
    dot.setAttribute('aria-hidden', 'true');
    btn.append(dot, document.createTextNode('Shield'));
    btn.addEventListener('click', open);
    root.appendChild(btn);
    Object.assign(host.style, {
      position: 'fixed',
      zIndex: '2147483645', // just under the shield frame
      display: 'none',
    });
    document.documentElement.appendChild(host);
    chipHost = host;
    return chipHost;
  }

  function syncChip() {
    const composer = getComposer();
    const show = shieldEnabled() && !active && composer && document.contains(composer);
    if (!show) {
      if (chipHost) chipHost.style.display = 'none';
      return;
    }
    const host = ensureChip();
    host.style.display = 'block';
    const r = composer.getBoundingClientRect();
    if (!r.width && !r.height) {
      host.style.display = 'none';
      return;
    }
    const w = host.offsetWidth || 72;
    const h = host.offsetHeight || 24;
    // Straddle the composer's top-right corner; clamp to the viewport.
    const left = Math.max(4, Math.min(r.right - w - 10, window.innerWidth - w - 4));
    const top = Math.max(4, r.top - h / 2);
    host.style.left = left + 'px';
    host.style.top = top + 'px';
  }

  function shieldEnabled() {
    const s = settingsRef();
    // Resolved per active site by the caller via settingsRef().__shieldOn.
    return !!s.__shieldOn;
  }

  function attach() {
    // Keep the chip glued to the composer across SPA layout shifts, scrolls,
    // resizes, and settings toggles (per-site Shield on/off from the popup).
    chipTimer = chipTimer || setInterval(syncChip, 400);
    window.addEventListener('resize', syncChip, true);
    window.addEventListener('scroll', syncChip, true);
    syncChip();

    relayHandler = (msg) => handleRelay(msg);
    try {
      chrome.runtime.onMessage.addListener((msg) => {
        if (
          msg &&
          (msg.type === MSG.SHIELD_INJECT || msg.type === MSG.SHIELD_CANCEL || msg.type === MSG.SHIELD_RESIZE)
        ) {
          relayHandler(msg);
        }
      });
    } catch {
      log.warn('shield: runtime messaging unavailable');
    }
  }

  return { attach, open, close, isActive: () => active, EXT_ORIGIN };
}
