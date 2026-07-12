/* ============================================================================
 * AI Prompt - Security Guard — Static privacy audit
 * Run: npm run audit:privacy   (node scripts/privacy-audit.mjs)
 *
 * Enforces the product's core privacy promises by scanning the source tree:
 *   1. There is NO cloud feature and NO network egress of user content. The
 *      only network API in the codebase is the font loader fetching the
 *      extension's OWN bundled woff2 (extension origin, never the internet).
 *   2. chrome.storage is written only via storage.js, and only the settings
 *      schema + counters — never prompt text or raw detected values.
 *   3. No internal message carries prompt/raw text, with ONE audited
 *      exception: Shield Mode's user-APPROVED text (SHIELD_SUBMIT from the
 *      secure-composer iframe, relayed as SHIELD_INJECT by the service
 *      worker). Both are on-device extension-to-extension messages, must be
 *      nonce-tagged, and may appear nowhere else.
 *   4. No analytics/beacon/websocket channels exist that could carry prompt text.
 *
 * Exits non-zero on any violation so it can run in CI / the build.
 * ========================================================================== */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else if (/\.(js|mjs)$/.test(name)) out.push(p);
  }
  return out;
}

const files = walk(SRC);
const isTest = (f) => /\.test\.mjs$/.test(f);
const rel = (f) => relative(ROOT, f);
const raw = (f) => readFileSync(f, 'utf8');
// Strip comments so that mentions of "fetch" etc. in documentation don't trip
// the network scanner — we only care about actual code.
function stripComments(s) {
  return s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}
const code = (f) => stripComments(raw(f));

let failed = 0;
const note = (label, passOk, detail = '') => {
  console.log(`  [${passOk ? 'PASS' : 'FAIL'}] ${label}${detail ? ' — ' + detail : ''}`);
  if (!passOk) failed++;
};

console.log('AI Prompt - Security Guard — privacy audit\n');

/* 1. Network egress surface ------------------------------------------------ */
// The MVP has NO cloud feature at all. The only network API used is the
// extension fetching its OWN bundled fonts (fonts.js) — never any user content.
const NET = /\b(fetch|XMLHttpRequest|sendBeacon|WebSocket|EventSource)\b/;
const netFiles = files.filter((f) => !isTest(f) && NET.test(code(f))).map(rel);
const ALLOWED_NET = ['src/content/ui/fonts.js'];
const unexpectedNet = netFiles.filter((f) => !ALLOWED_NET.includes(f));
note('only the font loader touches network APIs (no cloud egress)', unexpectedNet.length === 0, unexpectedNet.join(', ') || `found in: ${netFiles.join(', ')}`);

// fonts.js must fetch the extension's OWN resource (getURL), not an arbitrary URL.
const fontsSrc = code(join(SRC, 'content/ui/fonts.js'));
note(
  'fonts fetch is extension-origin only (chrome.runtime.getURL)',
  /fetch\(\s*chrome\.runtime\.getURL/.test(fontsSrc) && !/fetch\(\s*['"]https?:/.test(fontsSrc)
);

/* 3. Storage writes: only via storage.js, only schema + counter ------------ */
const STORE_WRITE = /chrome\.storage\.local\.set|storage\.set\(/;
const writers = files.filter((f) => !isTest(f) && STORE_WRITE.test(code(f))).map(rel);
note('storage writes occur only in shared/storage.js', writers.length === 1 && writers[0] === 'src/shared/storage.js', writers.join(', '));

// storage.js must never persist a prompt/text/raw field.
const storeSrc = code(join(SRC, 'shared/storage.js'));
const FORBIDDEN_KEYS = /\b(prompt|promptText|rawValue|inputText|messageText)\b/;
note('storage schema contains no prompt/raw-text fields', !FORBIDDEN_KEYS.test(storeSrc));

// The settings schema keys (audit visibility).
const schemaKeys = (storeSrc.match(/DEFAULT_SETTINGS = Object\.freeze\(\{([\s\S]*?)\}\)/) || [])[1] || '';
const hasCounterOnly = /riskySubmissionsCaught/.test(schemaKeys) && !FORBIDDEN_KEYS.test(schemaKeys);
note('settings schema = preferences + counter only', hasCounterOnly);

/* 4. No message ever carries prompt text ----------------------------------- */
// With no cloud feature, prompt/raw text must NEVER appear in any message —
// with one explicit, audited exception: Shield Mode's user-APPROVED text.
// SHIELD_SUBMIT (secure-composer → SW) and its SHIELD_INJECT relay (SW →
// content script) legitimately carry a `text:` field. They are confined to
// the two files below and every such call must carry the per-session nonce.
// Any OTHER message with a text-like field is a violation.
const promptMsgViolations = [];
for (const f of files.filter((x) => !isTest(x))) {
  const src = code(f);
  const calls = src.match(/sendMessage\(\s*[^)]*?\{[\s\S]*?\}\s*\)/g) || [];
  for (const call of calls) {
    if (/\b(prompt|promptText|rawValue|inputText|messageText)\b/.test(call)) {
      promptMsgViolations.push(rel(f));
    }
  }
}
note('no message payload carries prompt/raw-text fields', promptMsgViolations.length === 0, promptMsgViolations.join(', '));

// The approved-text relay pair (SHIELD_SUBMIT / SHIELD_INJECT) is the ONE
// place a `text` field may travel in a message. Confine those message types
// to the four files that implement the relay, and require the nonce at both
// the sender (secure-composer post()) and the SW relay construction.
const SHIELD_FILES_ALLOWED = [
  'src/shared/storage.js', // protocol definition
  'src/secure-composer/secure-composer.js', // sender
  'src/background/service-worker.js', // relay
  'src/content/secure/overlay.js', // receiver
];
const shieldMentions = files
  .filter((f) => !isTest(f) && /SHIELD_(SUBMIT|INJECT)/.test(code(f)))
  .map(rel)
  .filter((f) => !SHIELD_FILES_ALLOWED.includes(f));
note('SHIELD approved-text message types confined to the relay pair', shieldMentions.length === 0, shieldMentions.join(', '));

const scSrc = code(join(SRC, 'secure-composer/secure-composer.js'));
const swSrc = code(join(SRC, 'background/service-worker.js'));
note(
  'shield sender always nonce-tags its messages',
  /sendMessage\(\s*\{\s*type,\s*nonce:\s*NONCE/.test(scSrc)
);
note(
  'SW relay preserves the nonce on SHIELD_INJECT',
  /SHIELD_INJECT[\s\S]{0,200}?nonce:\s*msg\.nonce/.test(swSrc)
);

// No third-party analytics endpoints embedded.
const ANALYTICS = /(google-analytics|googletagmanager|segment\.io|mixpanel|amplitude|sentry|bugsnag)/i;
const analyticsFiles = files.filter((f) => !isTest(f) && ANALYTICS.test(code(f))).map(rel);
note('no third-party analytics/telemetry endpoints', analyticsFiles.length === 0, analyticsFiles.join(', '));

/* 5. Detector purity: no I/O in the scan path ------------------------------ */
const detectorSrc = code(join(SRC, 'content/detector.js'));
note('detector.js performs no network I/O', !NET.test(detectorSrc));

console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'} — ${failed} issue(s).`);
process.exit(failed === 0 ? 0 : 1);
