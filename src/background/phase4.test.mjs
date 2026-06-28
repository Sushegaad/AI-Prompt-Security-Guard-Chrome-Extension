/* ============================================================================
 * AI Safety Guard — Phase 4 tests (storage, message router, popup, onboarding)
 * Run: node src/background/phase4.test.mjs
 * ========================================================================== */

import { JSDOM } from 'jsdom';

let pass = 0;
let fail = 0;
const fails = [];
const ok = (n, c) => (c ? pass++ : (fail++, fails.push(n)));
const tick = () => new Promise((r) => setTimeout(r, 0));

// --- Fake chrome.storage.local backed by a plain object ---------------------
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

// service-worker.js registers chrome listeners at import time — stub chrome first.
globalThis.chrome = {
  runtime: { onInstalled: { addListener() {} }, onMessage: { addListener() {} } },
  tabs: {
    async query() {
      return [];
    },
    async sendMessage() {},
  },
};

const { DEFAULT_SETTINGS, MSG, withDefaults, readSettings, writeSettings, bumpCatch } =
  await import('../shared/storage.js');
const { routeMessage } = await import('./service-worker.js');

/* --------------------------------------------------------- storage schema */
ok('schema: sensitivity default balanced', DEFAULT_SETTINGS.sensitivity === 'balanced');
ok('schema: allowRewrite false by default', DEFAULT_SETTINGS.allowRewrite === false);
ok('schema: analytics on by default', DEFAULT_SETTINGS.analyticsEnabled === true);
ok('schema: onboarding incomplete by default', DEFAULT_SETTINGS.onboardingComplete === false);
ok('schema: counter starts at 0', DEFAULT_SETTINGS.riskySubmissionsCaught === 0);
ok('schema: all sites enabled by default', Object.values(DEFAULT_SETTINGS.enabledSites).every(Boolean));
ok('withDefaults merges enabledSites by key', withDefaults({ enabledSites: { claude: false } }).enabledSites.chatgpt === true);
ok('withDefaults keeps override', withDefaults({ enabledSites: { claude: false } }).enabledSites.claude === false);

/* ------------------------------------------------------- storage helpers */
{
  const area = makeStorageArea();
  const s = await readSettings(area);
  ok('readSettings returns defaults', s.sensitivity === 'balanced' && s.riskySubmissionsCaught === 0);
  await writeSettings({ sensitivity: 'strict' }, area);
  ok('writeSettings persists', (await readSettings(area)).sensitivity === 'strict');
  const n1 = await bumpCatch(area);
  const n2 = await bumpCatch(area);
  ok('bumpCatch increments', n1 === 1 && n2 === 2);
  ok('bumpCatch persisted', (await readSettings(area)).riskySubmissionsCaught === 2);
}

/* ------------------------------------------------------- message router */
{
  const area = makeStorageArea();
  const deps = {
    readSettings: () => readSettings(area),
    writeSettings: (p) => writeSettings(p, area),
    bumpCatch: () => bumpCatch(area),
    broadcast: () => (deps._broadcasts = (deps._broadcasts || 0) + 1),
  };
  const got = await routeMessage({ type: MSG.GET_SETTINGS }, deps);
  ok('router GET_SETTINGS returns settings', got.sensitivity === 'balanced');

  const set = await routeMessage({ type: MSG.SET_SETTINGS, patch: { sensitivity: 'basic' } }, deps);
  ok('router SET_SETTINGS writes', set.sensitivity === 'basic');
  ok('router SET_SETTINGS broadcasts', deps._broadcasts === 1);

  const caught = await routeMessage({ type: MSG.RECORD_CATCH }, deps);
  ok('router RECORD_CATCH increments', caught.riskySubmissionsCaught === 1);

  const bad = await routeMessage({ type: 'NONSENSE' }, deps);
  ok('router unknown message -> error', bad.ok === false);
}

/* ------------------------------------------------- popup (jsdom) -------- */
{
  const dom = new JSDOM(
    '<!DOCTYPE html><body><div id="popup-body"></div><span id="version"></span></body>',
    { url: 'https://example.com/' }
  );
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.Event = dom.window.Event;

  const sent = [];
  const settings = withDefaults({ riskySubmissionsCaught: 142 });
  const send = async (m) => {
    sent.push(m);
    if (m.type === MSG.GET_SETTINGS) return settings;
    if (m.type === MSG.SET_SETTINGS) return withDefaults({ ...settings, ...m.patch });
    return { ok: true };
  };

  const { initPopup } = await import('../popup/popup.js');
  const popup = initPopup({ doc: document, send });
  await tick();

  const body = document.getElementById('popup-body');
  ok('popup: 3 sensitivity buttons', body.querySelectorAll('.segmented__btn').length === 3);
  ok(
    'popup: balanced pressed by default',
    body.querySelector('.segmented__btn[data-mode="balanced"]').getAttribute('aria-pressed') === 'true'
  );
  ok('popup: 4 site toggles', body.querySelectorAll('.switch').length === 4);
  ok('popup: counter shows 142', body.querySelector('.stat__num').textContent === '142');

  // click Strict -> persists SET_SETTINGS
  body.querySelector('.segmented__btn[data-mode="strict"]').click();
  await tick();
  const setMsg = sent.find((m) => m.type === MSG.SET_SETTINGS && m.patch.sensitivity);
  ok('popup: clicking sensitivity persists', setMsg && setMsg.patch.sensitivity === 'strict');

  // toggle a site off
  const claudeToggle = body.querySelector('.switch[data-site="claude"]');
  claudeToggle.checked = false;
  claudeToggle.dispatchEvent(new dom.window.Event('change'));
  await tick();
  const siteMsg = sent.find((m) => m.type === MSG.SET_SETTINGS && m.patch.enabledSites);
  ok('popup: toggling site persists enabledSites', siteMsg && siteMsg.patch.enabledSites.claude === false);
  ok('popup api exposes settings', !!popup.getSettings());
}

/* --------------------------------------------- onboarding (jsdom) ------ */
{
  const dom = new JSDOM('<!DOCTYPE html><body><div id="onboarding"></div></body>', {
    url: 'https://example.com/',
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.Event = dom.window.Event;

  const sent = [];
  let doneCalled = false;
  const send = async (m) => {
    sent.push(m);
    return withDefaults({});
  };

  const { initOnboarding } = await import('../onboarding/onboarding.js');
  const ob = initOnboarding({ doc: document, send, onDone: () => (doneCalled = true) });
  const root = document.getElementById('onboarding');

  ok('onboarding: step 1 title', root.textContent.includes('A safety net for AI'));
  ok('onboarding: step 1 has 3 benefits', root.querySelectorAll('.benefit').length === 3);

  // Continue -> step 2
  root.querySelector('.cta').click();
  ok('onboarding: step 2 title', root.textContent.includes('How careful should we be?'));
  ok('onboarding: 3 sensitivity cards', root.querySelectorAll('.opt-card').length === 3);
  ok(
    'onboarding: balanced preselected + RECOMMENDED',
    !!root.querySelector('.opt-card--selected .opt-card__rec')
  );

  // pick Strict, Continue -> step 3
  root.querySelector('.opt-card[data-mode="strict"]').click();
  root.querySelector('.cta').click();
  ok('onboarding: step 3 title', root.textContent.includes('Where should we watch?'));
  ok('onboarding: grouped toggles present', root.textContent.includes('Claude & Gemini') && root.textContent.includes('Perplexity & Copilot'));

  // turn Perplexity & Copilot off
  const grp = root.querySelector('.switch[data-group="perplexityCopilot"]');
  grp.checked = false;
  grp.dispatchEvent(new dom.window.Event('change'));

  // Start protecting me
  root.querySelector('.cta').click();
  await tick();
  const fin = sent.find((m) => m.type === MSG.SET_SETTINGS);
  ok('onboarding: finish persists settings', !!fin);
  ok('onboarding: sensitivity chosen saved', fin.patch.sensitivity === 'strict');
  ok('onboarding: onboardingComplete true', fin.patch.onboardingComplete === true);
  ok('onboarding: group expands to enabledSites', fin.patch.enabledSites.perplexity === false && fin.patch.enabledSites.copilot === false);
  ok('onboarding: claude+gemini still on', fin.patch.enabledSites.claude === true && fin.patch.enabledSites.gemini === true);
  ok('onboarding: onDone (close tab) called', doneCalled === true);
  ok('onboarding api exposes state', ob.getState().step === 3);
}

/* ---------------------------------------------------------------- report */
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) {
  console.log('\nFailures:');
  fails.forEach((f) => console.log('  ✗ ' + f));
  process.exit(1);
}
console.log('All Phase 4 tests passed ✓');
