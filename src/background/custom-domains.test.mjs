/* ============================================================================
 * AI Prompt - Security Guard — Custom-domain tests (Workstream 3)
 * Run: node src/background/custom-domains.test.mjs
 * Covers: hostname validation/normalization, storage sanitization via the
 * shared validator, service-worker registration reconciliation, and the
 * generic adapter's largest-visible-input heuristic.
 * ========================================================================== */

import { JSDOM } from 'jsdom';

let pass = 0;
let fail = 0;
const fails = [];
const ok = (n, c) => (c ? pass++ : (fail++, fails.push(n)));

// service-worker.js registers chrome listeners at import time — stub first.
globalThis.chrome = {
  runtime: { onInstalled: { addListener() {} }, onMessage: { addListener() {} } },
  tabs: {
    async query() {
      return [];
    },
    async sendMessage() {},
  },
};

const { normalizeHostname, originFor, scriptIdFor } = await import('../shared/domains.js');
const { sanitizePatch, MSG, readSettings, writeSettings, bumpCatch } = await import('../shared/storage.js');
const { reconcileCustomDomains, routeMessage } = await import('./service-worker.js');

/* ----------------------------------------- hostname validation table ----- */
const VALID = [
  ['chat.example.com', 'chat.example.com'],
  ['  Chat.Example.COM  ', 'chat.example.com'],
  ['https://chat.example.com', 'chat.example.com'],
  ['https://chat.example.com/some/path?q=1', 'chat.example.com'],
  ['deep.sub.domain.example.co.uk', 'deep.sub.domain.example.co.uk'],
  ['xn--bcher-kva.example', 'xn--bcher-kva.example'], // punycode passes through
];
for (const [input, expected] of VALID) {
  const r = normalizeHostname(input);
  ok(`valid: ${JSON.stringify(input)} -> ${expected}`, r.host === expected && !r.error);
}
const INVALID = [
  ['', 'empty'],
  ['http://chat.example.com', 'http scheme'],
  ['chat.example.com:8080', 'port'],
  ['https://user:pass@chat.example.com', 'userinfo'],
  ['192.168.1.10', 'ipv4'],
  ['localhost', 'localhost'],
  ['*.example.com', 'wildcard'],
  ['intranet', 'single label'],
  ['example.x', 'one-char tld'],
  ['claude.ai', 'already supported'],
  ['www.perplexity.ai', 'already supported (www)'],
];
for (const [input, why] of INVALID) {
  const r = normalizeHostname(input);
  ok(`invalid (${why}): ${JSON.stringify(input)}`, !r.host && !!r.error);
}
// Unicode input: URL parser punycodes it — accept either encoded form or rejection,
// but never a raw-unicode host (Chrome match patterns need ASCII).
{
  const r = normalizeHostname('bücher.example');
  ok('unicode: never returns a raw-unicode host', !r.host || /^[\x21-\x7e]+$/.test(r.host));
}

ok('originFor shape', originFor('a.example.com') === 'https://a.example.com/*');
ok('scriptIdFor shape', scriptIdFor('a.example.com') === 'aisg-a.example.com');

/* ---------------------------------- storage uses the same validator ------- */
{
  const clean = sanitizePatch({
    customDomains: ['HTTPS://Foo.AI/x', 'http://bad.com', 'claude.ai', 'foo.ai', 123, 'localhost'],
  });
  ok('sanitize: normalizes + dedupes + drops invalid', JSON.stringify(clean.customDomains) === JSON.stringify(['foo.ai']));
}

/* --------------------------------------------- reconciliation ------------ */
function makeFakeChromeBits({ granted = [], registered = [] } = {}) {
  const state = {
    granted: new Set(granted),
    registered: new Map(registered.map((r) => [r.id, r])),
    removedOrigins: [],
  };
  return {
    state,
    permissions: {
      async getAll() {
        return { origins: [...state.granted] };
      },
      async remove({ origins }) {
        for (const o of origins) {
          state.granted.delete(o);
          state.removedOrigins.push(o);
        }
        return true;
      },
    },
    scripting: {
      async getRegisteredContentScripts() {
        return [...state.registered.values()];
      },
      async registerContentScripts(scripts) {
        for (const s of scripts) state.registered.set(s.id, s);
      },
      async unregisterContentScripts({ ids }) {
        for (const id of ids) state.registered.delete(id);
      },
    },
  };
}
function makeStorageArea(initial = {}) {
  const data = { ...initial };
  return {
    _data: data,
    async get(defaults) {
      if (typeof defaults === 'string') return { [defaults]: data[defaults] };
      const out = {};
      for (const [k, v] of Object.entries(defaults || {})) out[k] = k in data ? data[k] : v;
      return out;
    },
    async set(patch) {
      Object.assign(data, patch);
    },
  };
}

// 1. Grant present, nothing registered -> registers with the right shape.
{
  const bits = makeFakeChromeBits({ granted: [originFor('foo.ai')] });
  const r = await reconcileCustomDomains({
    readSettings: async () => ({ customDomains: ['foo.ai'], enabledSites: {} }),
    ...bits,
  });
  const reg = bits.state.registered.get('aisg-foo.ai');
  ok('reconcile: registers granted domain', r.registered.includes('foo.ai') && !!reg);
  ok('reconcile: registration matches origin', JSON.stringify(reg.matches) === JSON.stringify(['https://foo.ai/*']));
  ok('reconcile: registration uses built bundle path', JSON.stringify(reg.js) === JSON.stringify(['src/content/content.js']));
  ok('reconcile: persists across sessions', reg.persistAcrossSessions === true && reg.runAt === 'document_idle');
}

// 2. Wanted but NOT granted -> stays unregistered (no sneaky access).
{
  const bits = makeFakeChromeBits();
  const r = await reconcileCustomDomains({
    readSettings: async () => ({ customDomains: ['foo.ai'], enabledSites: {} }),
    ...bits,
  });
  ok('reconcile: never registers without a grant', r.registered.length === 0 && bits.state.registered.size === 0);
}

// 3. Domain removed from settings -> unregisters AND revokes the grant.
{
  const bits = makeFakeChromeBits({
    granted: [originFor('foo.ai')],
    registered: [{ id: 'aisg-foo.ai', matches: [originFor('foo.ai')] }],
  });
  const r = await reconcileCustomDomains({ readSettings: async () => ({ customDomains: [] }), ...bits });
  ok('reconcile: unregisters removed domain', r.unregistered.includes('foo.ai') && bits.state.registered.size === 0);
  ok('reconcile: revokes removed domain grant', bits.state.removedOrigins.includes('https://foo.ai/*'));
}

// 4. Grant revoked via chrome://extensions -> stale registration pruned.
{
  const bits = makeFakeChromeBits({
    granted: [],
    registered: [{ id: 'aisg-foo.ai', matches: [originFor('foo.ai')] }],
  });
  const r = await reconcileCustomDomains({
    readSettings: async () => ({ customDomains: ['foo.ai'] }),
    ...bits,
  });
  ok('reconcile: prunes registration after revoked grant', r.unregistered.includes('foo.ai') && bits.state.registered.size === 0);
}

// 5. Static site grants are NEVER revoked; foreign registrations untouched.
{
  const bits = makeFakeChromeBits({
    granted: ['https://claude.ai/*', 'https://chatgpt.com/*'],
    registered: [{ id: 'other-extension-script', matches: ['https://claude.ai/*'] }],
  });
  const r = await reconcileCustomDomains({ readSettings: async () => ({ customDomains: [] }), ...bits });
  ok('reconcile: static grants untouched', r.revoked.length === 0 && bits.state.granted.size === 2);
  ok('reconcile: non-aisg registrations untouched', bits.state.registered.has('other-extension-script'));
}

// 6. SET_SETTINGS with customDomains triggers reconcile through the router.
{
  const area = makeStorageArea();
  let reconciled = 0;
  const deps = {
    readSettings: () => readSettings(area),
    writeSettings: (p) => writeSettings(p, area),
    bumpCatch: () => bumpCatch(area),
    broadcast: async () => {},
    reconcile: async () => {
      reconciled++;
    },
  };
  await routeMessage({ type: MSG.SET_SETTINGS, patch: { customDomains: ['foo.ai'] } }, deps);
  ok('router: customDomains change reconciles', reconciled === 1);
  await routeMessage({ type: MSG.SET_SETTINGS, patch: { sensitivity: 'strict' } }, deps);
  ok('router: unrelated change does NOT reconcile', reconciled === 1);
}

/* ------------------------------- generic adapter (largest visible) ------- */
{
  const dom = new JSDOM('<!DOCTYPE html><body></body></html>', { url: 'https://custom.example/' });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.location = { hostname: 'custom.example' };

  const { getAdapter } = await import('../content/sites/index.js');
  const adapter = getAdapter('custom.example');
  ok('generic: unknown host -> custom adapter', adapter.id === 'custom');

  document.body.innerHTML =
    '<textarea id="search" placeholder="search"></textarea>' +
    '<div id="composer" contenteditable="true"></div>' +
    '<button type="submit">Send</button>';
  const rect = (w, h) => () => ({ width: w, height: h });
  document.getElementById('search').getBoundingClientRect = rect(200, 24);
  document.getElementById('composer').getBoundingClientRect = rect(600, 120);
  ok('generic: picks the LARGEST visible input', adapter.getInputElement(document).id === 'composer');
  ok('generic: badge anchors on the input itself', adapter.getBadgeAnchor(document).id === 'composer');
  ok('generic: finds a submit control', adapter.getSubmitButton(document).textContent === 'Send');

  // Unmeasurable DOM (all rects zero) -> falls back to the first candidate.
  document.getElementById('search').getBoundingClientRect = rect(0, 0);
  document.getElementById('composer').getBoundingClientRect = rect(0, 0);
  ok('generic: zero-rect fallback -> first candidate', adapter.getInputElement(document).id === 'search');

  // No candidates at all -> null (content.js logs its diagnostic).
  document.body.innerHTML = '<p>nothing here</p>';
  ok('generic: no candidates -> null', adapter.getInputElement(document) === null);
}

/* ----------------------------------------------------------------- report */
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) {
  console.log('\nFailures:');
  fails.forEach((f) => console.log('  ✗ ' + f));
  process.exit(1);
}
console.log('All custom-domain tests passed ✓');
