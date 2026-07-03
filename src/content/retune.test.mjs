/* ============================================================================
 * AI Safety Guard — v1.1 sensitivity-retune tests (Workstream 2)
 * Run: node src/content/retune.test.mjs
 * Covers: balanced threshold change, source_code interrupt:false gate,
 * labeledId strong/weak split, per-category mute (filter + storage guards +
 * modal button), and outcome counters.
 * ========================================================================== */

import { JSDOM } from 'jsdom';

// --- jsdom + chrome stub global setup (before importing UI modules) ---------
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'https://chatgpt.com/',
  pretendToBeVisual: true,
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.Event = dom.window.Event;
globalThis.KeyboardEvent = dom.window.KeyboardEvent;
globalThis.Node = dom.window.Node;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.chrome = { runtime: { getURL: (p) => 'chrome-extension://test/' + p } };

const { detect, filterMatches, CATEGORY } = await import('./detector.js');
const { redact } = await import('./redactor.js');
const { createModal } = await import('./ui/modal.js');
const { shouldInterrupt, shouldShowBadge, SENSITIVITY } = await import('../shared/constants.js');
const {
  withDefaults,
  sanitizePatch,
  bumpOutcome,
  muteCategory,
  recordCatch,
  shouldShowNoiseHint,
  UNMUTABLE_CATEGORIES,
  OUTCOME_ACTIONS,
  RECENT_CATCHES_MAX,
} = await import('../shared/storage.js');

let pass = 0;
let fail = 0;
const fails = [];
const ok = (n, c) => (c ? pass++ : (fail++, fails.push(n)));
const has = (text, category) => new Set(detect(text).categories).has(category);

// Fake chrome.storage.local area (same shape as phase4 tests).
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

/* ------------------------------------------ 2.1 threshold matrix (balanced) */
ok('balanced: medium no longer interrupts', shouldInterrupt('medium', 'balanced') === false);
ok('balanced: high interrupts', shouldInterrupt('high', 'balanced') === true);
ok('balanced: critical interrupts', shouldInterrupt('critical', 'balanced') === true);
ok('strict: medium still interrupts', shouldInterrupt('medium', 'strict') === true);
ok('basic: high does NOT interrupt', shouldInterrupt('high', 'basic') === false);
ok('basic: critical ALWAYS interrupts', shouldInterrupt('critical', 'basic') === true);
ok('unknown mode falls back to balanced', shouldInterrupt('medium', 'nope') === false);
ok('balanced: medium still shows the badge', shouldShowBadge('medium', 'balanced') === true);
ok('balanced interruptsOn is exactly high+critical',
  JSON.stringify(SENSITIVITY.balanced.interruptsOn) === JSON.stringify(['high', 'critical']));

// Concrete consequences of the retune (via the same gate content.js uses):
function wouldInterrupt(text, mode) {
  const r = detect(text);
  return (
    shouldInterrupt(r.riskLevel, mode) &&
    r.matches.some((m) => m.showInModal && CATEGORY[m.category].interrupt !== false)
  );
}
ok('email-only prompt: badge-only under balanced', wouldInterrupt('mail me at a@b.com', 'balanced') === false);
ok('email-only prompt: interrupts under strict', wouldInterrupt('mail me at a@b.com', 'strict') === true);
ok('api key: interrupts under every mode', ['basic', 'balanced', 'strict'].every((m) => wouldInterrupt('sk-live-9fK2pQ7xR4mZ8vB1', m)));

/* ------------------------------------------------ 2.2 source_code gate ---- */
ok('source_code carries interrupt:false', CATEGORY.source_code.interrupt === false);
ok('every other category defaults to interruptible',
  Object.entries(CATEGORY).every(([k, v]) => k === 'source_code' || v.interrupt !== false));
const CODE = 'function foo() { return bar; }';
ok('code paste: still detected (badge)', has(CODE, 'source_code'));
ok('code paste: never interrupts, even strict', wouldInterrupt(CODE, 'strict') === false);
ok('code WITH a secret still interrupts', wouldInterrupt('const k = "sk-live-9fK2pQ7xR4mZ8vB1"; function f() { return k; }', 'balanced') === true);

/* -------------------------------------------- 2.3 labeledId strong/weak --- */
ok('weak: order number alone is safe', detect('order #12345 shipped').riskLevel === 'safe');
ok('weak: bare # number alone is safe', detect('see #12345 for details').riskLevel === 'safe');
ok('weak: ticket number alone is safe', !has('ticket 55123 raised', 'account_number'));
ok('strong: patient id still fires', has('patient #88291 admitted', 'account_number'));
ok('strong: account # still fires', has('account #88291 is overdue', 'account_number'));
ok('strong: customer id still fires', has('Customer account #A83921 reported fraud', 'account_number'));
ok('strong: student id still fires', has('Student ID 004921 on file', 'account_number'));
ok('weak + identifier: order # fires next to an email', has('order #12345 for jane@x.com', 'account_number'));
ok('weak + long mixed id: fires on its own', has('order #AB12CD34EF placed', 'account_number'));
ok('weak + identifier: risk is high', detect('order #12345 for jane@x.com').riskLevel === 'high');

/* --------------------------------------------------- 2.4 mute machinery --- */
// filterMatches: pure post-detect mute application
{
  const FIXTURE = 'Sarah Chen (sarah.chen@northwind.io), account #88291, key sk-live-9fK2pQ7xR4mZ8vB1';
  const r = detect(FIXTURE);
  const muted = filterMatches(r, ['email']);
  ok('filter: muted category removed', !muted.categories.includes('email'));
  ok('filter: other findings kept', muted.categories.includes('api_key') && muted.categories.includes('account_number'));
  ok('filter: riskLevel recomputed', muted.riskLevel === 'critical');
  ok('filter: summary recomputed without muted', !muted.summary.includes('email'));
  ok('filter: no mutes returns same object', filterMatches(r, []) === r);
  const all = filterMatches(detect('a@b.com'), ['email']);
  ok('filter: all muted -> safe', all.riskLevel === 'safe' && all.matches.length === 0);
}
// storage guards
ok('unmutable list covers exactly the critical secret categories',
  JSON.stringify([...UNMUTABLE_CATEGORIES].sort()) ===
  JSON.stringify(Object.keys(CATEGORY).filter((k) => CATEGORY[k].risk === 'critical').sort()));
{
  const dirty = sanitizePatch({ disabledCategories: ['email', 'ssn', 'api_key', 'phone'] });
  ok('sanitize: strips unmutable categories', JSON.stringify(dirty.disabledCategories) === JSON.stringify(['email', 'phone']));
}
{
  const area = makeStorageArea();
  await muteCategory('email', area);
  ok('muteCategory: persists', area._data.disabledCategories.includes('email'));
  await muteCategory('email', area);
  ok('muteCategory: idempotent', area._data.disabledCategories.filter((c) => c === 'email').length === 1);
  const after = await muteCategory('ssn', area);
  ok('muteCategory: rejects critical secrets', !(area._data.disabledCategories || []).includes('ssn'));
  ok('muteCategory: returns settings', after && after.sensitivity === 'balanced');
}
ok('withDefaults merges outcomes by key', withDefaults({ outcomes: { redacted: 3 } }).outcomes.sentAnyway === 0);

/* ------------------------------------------------ 2.5 outcome counters ---- */
{
  const area = makeStorageArea();
  await bumpOutcome('redacted', area);
  await bumpOutcome('redacted', area);
  await bumpOutcome('sentAnyway', area);
  const bad = await bumpOutcome('evil', area);
  ok('bumpOutcome: increments per action', area._data.outcomes.redacted === 2 && area._data.outcomes.sentAnyway === 1);
  ok('bumpOutcome: untouched action stays 0', area._data.outcomes.edited === 0);
  ok('bumpOutcome: rejects unknown action', bad === null);
  ok('outcome actions are the documented three', JSON.stringify(OUTCOME_ACTIONS) === JSON.stringify(['redacted', 'sentAnyway', 'edited']));
}

/* ----------------------------------- modal: mute buttons + outcome wiring - */
{
  const FIXTURE =
    'Draft a reply to this customer — Sarah Chen (sarah.chen@northwind.io), ' +
    'account #88291, whose API key sk-live-9fK2pQ7xR4mZ8vB1 stopped working.';
  const outcomes = [];
  const mutes = [];
  const services = {
    redact: (t, m) => redact(t, m),
    rescan: (t) => detect(t),
    applyText: () => {},
    submit: () => {},
    onCatch: () => {},
    onOutcome: (a) => outcomes.push(a),
    mute: (c) => mutes.push(c),
  };
  const modal = createModal();
  const open = () => modal.open({ result: detect(FIXTURE), text: FIXTURE, sensitivity: 'balanced', services });
  const root = () => document.getElementById('asg-modal-host').shadowRoot;
  const btn = (label) => [...root().querySelectorAll('button')].find((b) => b.textContent.trim() === label);

  // Mute buttons: present on non-critical rows only
  open();
  const muteButtons = [...root().querySelectorAll('.asg-mute')];
  ok('modal: mute buttons on non-critical rows (2)', muteButtons.length === 2); // account + email, not api_key
  const rows = [...root().querySelectorAll('.asg-find')];
  const apiRow = rows.find((r) => r.textContent.includes('API key'));
  ok('modal: critical row has NO mute button', apiRow && !apiRow.querySelector('.asg-mute'));

  // Muting the email row: calls services.mute, row disappears, modal stays
  const emailRow = rows.find((r) => r.textContent.includes('Email address'));
  emailRow.querySelector('.asg-mute').click();
  ok('modal: mute callback got the category', JSON.stringify(mutes) === JSON.stringify(['email']));
  ok('modal: muted row removed', root().querySelectorAll('.asg-find').length === 2);
  ok('modal: still open with remaining findings', !!document.getElementById('asg-modal-host'));

  // Send anyway → sentAnyway outcome (once)
  btn('Send anyway').click();
  ok('outcome: send anyway recorded', JSON.stringify(outcomes) === JSON.stringify(['sentAnyway']));
  ok('outcome: recorded exactly once', outcomes.length === 1);

  // Keep editing → edited
  outcomes.length = 0;
  open();
  btn('Keep editing').click();
  ok('outcome: keep editing -> edited', JSON.stringify(outcomes) === JSON.stringify(['edited']));

  // Redact → Looks good — send → redacted (close() must NOT also add "edited")
  outcomes.length = 0;
  open();
  btn('Redact sensitive data').click();
  const looksGood = [...root().querySelectorAll('button')].find((b) => b.textContent.trim() === 'Looks good — send');
  looksGood.click();
  ok('outcome: redact flow -> redacted only', JSON.stringify(outcomes) === JSON.stringify(['redacted']));

  // Escape/dismiss → edited
  outcomes.length = 0;
  open();
  modal.close();
  ok('outcome: dismiss -> edited', JSON.stringify(outcomes) === JSON.stringify(['edited']));
}

/* -------------------------------------- feedback loop (noise hint) ------- */
ok('hint: silent below sample size', !shouldShowNoiseHint(withDefaults({ outcomes: { redacted: 1, sentAnyway: 10, edited: 2 } })));
ok('hint: fires when sentAnyway dominates 20+', shouldShowNoiseHint(withDefaults({ outcomes: { redacted: 3, sentAnyway: 15, edited: 2 } })));
ok('hint: silent when redaction dominates', !shouldShowNoiseHint(withDefaults({ outcomes: { redacted: 18, sentAnyway: 4, edited: 2 } })));
ok('hint: respects dismissal', !shouldShowNoiseHint(withDefaults({ noiseHintDismissed: true, outcomes: { redacted: 0, sentAnyway: 25, edited: 0 } })));
ok('hint: exact 60% does not fire (strictly greater)', !shouldShowNoiseHint(withDefaults({ outcomes: { redacted: 8, sentAnyway: 12, edited: 0 } })));
{
  const dirty = sanitizePatch({ noiseHintDismissed: 'yes', catchHistory: 1 });
  ok('sanitize: hint/history flags coerced to bool', dirty.noiseHintDismissed === true && dirty.catchHistory === true);
}

/* -------------------------------------- catch history (local, masked) ---- */
{
  const area = makeStorageArea();
  // History off (default): counter bumps, nothing stored.
  const r1 = await recordCatch([{ category: 'email', masked: 'a@…' }], area);
  ok('history: counter bumps with history off', r1.riskySubmissionsCaught === 1);
  ok('history: nothing stored when off', !(area._data.recentCatches || []).length);

  // History on: masked entries stored, newest first, validated.
  await area.set({ catchHistory: true });
  await recordCatch([{ category: 'email', masked: 'sarah.chen@…' }, { category: 'api_key', masked: 'sk-live-••••' }], area);
  await recordCatch([{ category: 'ssn', masked: '•••-••-6789' }], area);
  const list = area._data.recentCatches;
  ok('history: entries stored newest-first', list.length === 2 && list[0].items[0].category === 'ssn');
  ok('history: masked values only, as given', list[1].items[1].masked === 'sk-live-••••');
  ok('history: entries carry timestamps', typeof list[0].t === 'number' && list[0].t > 0);

  // Defensive validation: junk findings dropped, lengths capped.
  await recordCatch([{ category: 42, masked: 'x' }, { category: 'phone', masked: 'y'.repeat(100) }, 'junk'], area);
  const top = area._data.recentCatches[0];
  ok('history: junk items dropped, strings capped', top.items.length === 1 && top.items[0].masked.length === 40);

  // Cap at RECENT_CATCHES_MAX.
  for (let i = 0; i < 30; i++) await recordCatch([{ category: 'email', masked: `e${i}@…` }], area);
  ok('history: capped at max', area._data.recentCatches.length === RECENT_CATCHES_MAX);

  // Callers can only CLEAR the list, never inject entries.
  const inject = sanitizePatch({ recentCatches: [{ t: 1, items: [{ category: 'email', masked: 'evil' }] }] });
  ok('sanitize: history injection rejected', !('recentCatches' in inject));
  const clear = sanitizePatch({ recentCatches: [] });
  ok('sanitize: history clear allowed', Array.isArray(clear.recentCatches) && clear.recentCatches.length === 0);
}

/* ----------------------------------------------------------------- report */
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) {
  console.log('\nFailures:');
  fails.forEach((f) => console.log('  ✗ ' + f));
  process.exit(1);
}
console.log('All retune tests passed ✓');
