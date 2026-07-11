/* ============================================================================
 * AI Prompt - Security Guard — Phase 3 UI & adapter tests (jsdom)
 * Run: node src/content/ui.test.mjs
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

const { detect } = await import('./detector.js');
const { redact } = await import('./redactor.js');
const { getAdapter } = await import('./sites/index.js');
const { createBadge } = await import('./ui/badge.js');
const { createModal } = await import('./ui/modal.js');
const { writeInput } = await import('./dom-utils.js');
const { getShadowCss } = await import('./ui/shadow-style.js');

let pass = 0;
let fail = 0;
const fails = [];
const ok = (n, c) => (c ? pass++ : (fail++, fails.push(n)));

const FIXTURE =
  'Draft a reply to this customer — Sarah Chen (sarah.chen@northwind.io), ' +
  'account #88291, whose API key sk-live-9fK2pQ7xR4mZ8vB1 stopped working.';

/* ----------------------------------------------------------- redactor ---- */
{
  const r = detect(FIXTURE);
  const { redactedText } = redact(FIXTURE, r.matches);
  ok('redact: [API_KEY] chip present', redactedText.includes('[API_KEY]'));
  ok('redact: [ACCOUNT] chip present', redactedText.includes('[ACCOUNT]'));
  ok('redact: [EMAIL] chip present', redactedText.includes('[EMAIL]'));
  ok('redact: [NAME] chip present', redactedText.includes('[NAME]'));
  ok('redact: raw secret removed', !redactedText.includes('sk-live-9fK2pQ7xR4mZ8vB1'));
  ok('redact: raw email removed', !redactedText.includes('northwind.io'));
  ok('redact: re-scan is safe', detect(redactedText).riskLevel === 'safe');
}

/* ----------------------------------------------------------- adapters ---- */
{
  ok('adapter: chatgpt host', getAdapter('chatgpt.com').id === 'chatgpt');
  ok('adapter: openai host', getAdapter('chat.openai.com').id === 'chatgpt');
  ok('adapter: claude host', getAdapter('claude.ai').id === 'claude');
  ok('adapter: gemini host', getAdapter('gemini.google.com').id === 'gemini');
  ok('adapter: perplexity host', getAdapter('www.perplexity.ai').id === 'perplexity');
  ok('adapter: copilot host', getAdapter('copilot.microsoft.com').id === 'copilot');
  ok('adapter: unknown host -> custom', getAdapter('example.com').id === 'custom');

  // selector resolution in a constructed DOM
  document.body.innerHTML =
    '<form><textarea id="prompt-textarea"></textarea>' +
    '<button data-testid="send-button">Send</button></form>';
  const a = getAdapter('chatgpt.com');
  ok('adapter: finds input', a.getInputElement(document).id === 'prompt-textarea');
  ok(
    'adapter: finds submit',
    a.getSubmitButton(document).getAttribute('data-testid') === 'send-button'
  );
  document.body.innerHTML = '';
}

/* ------------------------------------------------------------- A1 badge -- */
{
  const anchor = document.createElement('div');
  document.body.appendChild(anchor);
  const badge = createBadge(anchor);
  const host = document.getElementById('asg-badge-host');

  badge.update(detect('hello world'), 'balanced');
  ok('badge: hidden on safe (balanced)', host.style.display === 'none');

  badge.update(detect('hello world'), 'strict');
  ok('badge: visible on safe (strict)', host.style.display !== 'none');

  const crit = detect(FIXTURE);
  badge.update(crit, 'balanced');
  const root = host.shadowRoot;
  ok('badge: shows critical label', root.textContent.includes('Critical risk'));
  ok('badge: shows finding count', /·\s*\d+\s*finding/.test(root.textContent));
  ok('badge: shows scanned locally + ms', /scanned locally · \d/.test(root.textContent));
  badge.destroy();
  document.body.innerHTML = '';
}

/* --------------------------------------------------- A2 modal centerpiece */
let submitted = false;
let appliedText = null;
const services = {
  redact: (t, m) => redact(t, m),
  rescan: (t) => detect(t),
  applyText: (t) => {
    appliedText = t;
  },
  submit: () => {
    submitted = true;
  },
  onCatch: () => {},
};

const modal = createModal();
const result = detect(FIXTURE);
modal.open({ result, text: FIXTURE, sensitivity: 'balanced', services });
const mhost = document.getElementById('asg-modal-host');
const mroot = mhost.shadowRoot;
const txt = () => mroot.textContent;
const buttons = () => [...mroot.querySelectorAll('button')];
const btn = (label) => buttons().find((b) => b.textContent.trim() === label);

// a11y (hardening #5)
ok('a11y: role=dialog', mroot.querySelector('.asg-card').getAttribute('role') === 'dialog');
ok('a11y: aria-modal', mroot.querySelector('.asg-card').getAttribute('aria-modal') === 'true');
ok('a11y: card focusable (tabindex -1)', mroot.querySelector('.asg-card').getAttribute('tabindex') === '-1');
// a11y (508 remediation F4): dialog is named by its visible heading, not the brand
{
  const card = mroot.querySelector('.asg-card');
  const labelId = card.getAttribute('aria-labelledby');
  const labelEl = labelId && mroot.querySelector('#' + labelId);
  ok('a11y: dialog labelled by its heading', !!labelEl && labelEl.textContent.includes('Before you send this'));
  ok('a11y: dialog has no competing aria-label', !card.getAttribute('aria-label'));
}
// a11y (508 remediation F6): findings expose list semantics
ok('a11y: findings container is a list', mroot.querySelector('.asg-findings').getAttribute('role') === 'list');
ok('a11y: finding rows are listitems', [...mroot.querySelectorAll('.asg-find')].every((r) => r.getAttribute('role') === 'listitem'));

ok('modal: title', txt().includes('Before you send this'));
ok('modal: subtitle', txt().includes('could expose confidential data'));
ok('modal: footer copy', txt().includes('Scanned on your device. Nothing has been sent or stored.'));
// findings masked values present
ok('modal: masked api key shown', txt().includes('sk-live-••••'));
ok('modal: masked account shown', txt().includes('#88•••'));
ok('modal: masked email shown', txt().includes('sarah.chen@…'));
// RAW values never present — the core security guarantee
ok('modal: raw api key NEVER shown', !txt().includes('sk-live-9fK2pQ7xR4mZ8vB1'));
ok('modal: raw account NEVER shown', !txt().includes('88291'));
ok('modal: raw email NEVER shown', !txt().includes('northwind.io'));
ok('modal: customer name NOT a finding row', !txt().includes('Sarah Chen'));
// exactly 3 finding rows
ok('modal: exactly 3 findings', mroot.querySelectorAll('.asg-find').length === 3);
// button order (B2 "Rewrite it safely" removed for MVP)
const order = ['Redact sensitive data', 'Send anyway', 'Keep editing'];
ok('modal: 3 buttons in order', order.every((l) => !!btn(l)));
ok('modal: no Rewrite button', !btn('Rewrite it safely'));
// pills use desaturated palette classes
ok('modal: critical pill present', !!mroot.querySelector('.asg-pill--critical'));

// typography (Design QA): masked values render in Spline Sans Mono (.asg-data)
ok('type: masked value carries mono class', !!mroot.querySelector('.asg-find__val.asg-data'));
{
  const css = getShadowCss();
  ok('type: shadow CSS declares Hanken Grotesk UI font', css.includes('Hanken Grotesk') && css.includes('--font-ui'));
  ok('type: shadow CSS maps .asg-data to Spline mono', /--font-data:\s*"Spline Sans Mono"/.test(css) && /\.asg-data\s*\{[^}]*var\(--font-data\)/.test(css));
  ok('type: no raw system-font fallback hardcoded on components', !/font-family:\s*(Arial|Helvetica|sans-serif)\s*;/.test(css.replace(/--font-(ui|data):[^;]+;/g, '')));
}

/* ------- Send anyway -> submit + close ------- */
btn('Send anyway').click();
ok('modal: send anyway submits', submitted === true);
ok('modal: closes after send', !document.getElementById('asg-modal-host'));

/* ------- B1 redact flow ------- */
submitted = false;
modal.open({ result, text: FIXTURE, sensitivity: 'balanced', services });
let r2 = document.getElementById('asg-modal-host').shadowRoot;
r2.querySelectorAll('button').forEach((b) => {
  if (b.textContent.trim() === 'Redact sensitive data') b.click();
});
ok('B1: input got redacted text', appliedText && appliedText.includes('[API_KEY]'));
ok('B1: shows Safe state', r2.textContent.includes('Safe'));
ok('B1: chips rendered', !!r2.querySelector('.asg-chip'));
const looksGood = [...r2.querySelectorAll('button')].find(
  (b) => b.textContent.trim() === 'Looks good — send'
);
ok('B1: Looks good button present & enabled', looksGood && !looksGood.hasAttribute('disabled'));
looksGood.click();
ok('B1: Looks good triggers submit', submitted === true);
modal.close();

/* ------------------------------------------------ writeback (hardening #4) */
{
  // textarea: value set + input event fired
  const ta = document.createElement('textarea');
  document.body.appendChild(ta);
  let taFired = false;
  ta.addEventListener('input', () => (taFired = true));
  writeInput(ta, 'hello world');
  ok('writeInput: textarea value set', ta.value === 'hello world');
  ok('writeInput: textarea input event fired', taFired === true);

  // contenteditable: must not throw, must dispatch an input event (the signal
  // ProseMirror/Quill listen to). execCommand is unavailable in jsdom so this
  // exercises the fallback path.
  const ce = document.createElement('div');
  ce.setAttribute('contenteditable', 'true');
  document.body.appendChild(ce);
  let ceFired = false;
  ce.addEventListener('input', () => (ceFired = true));
  let threw = false;
  try {
    writeInput(ce, 'redacted [EMAIL]');
  } catch {
    threw = true;
  }
  ok('writeInput: contenteditable no throw', threw === false);
  ok('writeInput: contenteditable input event fired', ceFired === true);
  document.body.innerHTML = '';
}

/* ----------------------------------------------------------------- report */
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) {
  console.log('\nFailures:');
  fails.forEach((f) => console.log('  ✗ ' + f));
  process.exit(1);
}
console.log('All Phase 3 UI tests passed ✓');
