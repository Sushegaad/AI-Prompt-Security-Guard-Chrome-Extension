/* ============================================================================
 * AI Safety Guard — First-Run Onboarding (Screen E)
 * ----------------------------------------------------------------------------
 * 3 steps: intro → sensitivity → sites. On "Start protecting me" we persist the
 * chosen settings (via the service worker) with onboardingComplete:true and
 * close the tab. Site toggles are grouped per the design: ChatGPT (standalone),
 * Claude & Gemini, Perplexity & Copilot.
 * ========================================================================== */

import { MSG } from '../shared/storage.js';
import { SENSITIVITY, DEFAULT_SENSITIVITY } from '../shared/constants.js';

function el(tag, attrs = {}, kids = []) {
  const [t, ...cls] = tag.split('.');
  const n = document.createElement(t);
  if (cls.length) n.className = cls.join(' ');
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else if (k === 'text') n.textContent = v;
    else if (k === 'checked') n.checked = !!v;
    else n.setAttribute(k, v);
  }
  for (const c of [].concat(kids)) {
    if (c == null || c === false) continue;
    n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return n;
}

export function initOnboarding(opts = {}) {
  const doc = opts.doc || document;
  const send = opts.send || ((m) => chrome.runtime.sendMessage(m));
  const onDone = opts.onDone || (() => window.close());
  const root = doc.getElementById('onboarding');

  const state = {
    step: 1,
    sensitivity: DEFAULT_SENSITIVITY,
    groups: { chatgpt: true, claudeGemini: true, perplexityCopilot: true },
    customDomains: [],
  };

  function meta(n) {
    return el('div.step-meta', { text: `Step ${n} of 3` });
  }

  function step1() {
    return [
      meta(1),
      el('h1', { text: 'A safety net for AI' }),
      el('div.benefit', {}, [el('span.tick', { text: '✓' }), 'Scans on your device']),
      el('div.benefit', {}, [el('span.tick', { text: '✓' }), 'Nothing stored, ever']),
      el('div.benefit', {}, [el('span.tick', { text: '✓' }), "You're always in control"]),
      el('button.asg-btn.asg-btn--primary.cta', {
        type: 'button',
        text: 'Continue',
        onclick: () => go(2),
      }),
    ];
  }

  function step2() {
    const cards = Object.values(SENSITIVITY).map((mode) => {
      const selected = state.sensitivity === mode.id;
      return el('div' + (selected ? '.opt-card.opt-card--selected' : '.opt-card'), {
        role: 'button',
        'data-mode': mode.id,
        onclick: () => {
          state.sensitivity = mode.id;
          render();
        },
      }, [
        el('div.opt-card__name', {}, [
          mode.label,
          mode.recommended ? el('span.opt-card__rec', { text: 'Recommended' }) : null,
        ]),
        el('div.opt-card__desc', { text: mode.description }),
      ]);
    });
    return [
      meta(2),
      el('h1', { text: 'How careful should we be?' }),
      el('p.sub', { text: 'You can change this anytime.' }),
      ...cards,
      el('button.asg-btn.asg-btn--primary.cta', {
        type: 'button',
        text: 'Continue',
        onclick: () => go(3),
      }),
    ];
  }

  function siteToggle(label, key) {
    return el('label.toggle-row', {}, [
      el('span.toggle-row__label', { text: label }),
      el('input.switch', {
        type: 'checkbox',
        'data-group': key,
        checked: state.groups[key],
        onchange: (e) => {
          state.groups[key] = e.target.checked;
        },
      }),
    ]);
  }

  function step3() {
    const domain = el('input.domain-input', {
      type: 'text',
      placeholder: '+ Add a custom domain',
      'aria-label': 'Add a custom domain',
    });
    return [
      meta(3),
      el('h1', { text: 'Where should we watch?' }),
      el('p.sub', { text: 'On by default for the major AI tools.' }),
      siteToggle('ChatGPT', 'chatgpt'),
      siteToggle('Claude & Gemini', 'claudeGemini'),
      siteToggle('Perplexity & Copilot', 'perplexityCopilot'),
      domain,
      el('button.asg-btn.asg-btn--primary.cta', {
        type: 'button',
        text: 'Start protecting me',
        onclick: () => finish(domain.value),
      }),
    ];
  }

  function go(n) {
    state.step = n;
    render();
  }

  async function finish(domainValue) {
    const g = state.groups;
    const enabledSites = {
      chatgpt: g.chatgpt,
      claude: g.claudeGemini,
      gemini: g.claudeGemini,
      perplexity: g.perplexityCopilot,
      copilot: g.perplexityCopilot,
    };
    const customDomains = [];
    const v = (domainValue || '').trim().toLowerCase().replace(/^https?:\/\//, '');
    if (v) customDomains.push(v);

    await send({
      type: MSG.SET_SETTINGS,
      patch: {
        sensitivity: state.sensitivity,
        enabledSites,
        customDomains,
        onboardingComplete: true,
      },
    });
    onDone();
  }

  function render() {
    root.textContent = '';
    const view = state.step === 1 ? step1() : state.step === 2 ? step2() : step3();
    for (const node of view) if (node) root.appendChild(node);
  }

  render();
  return { render, getState: () => state, finish };
}

// Auto-init only as a real extension page (where chrome.runtime.sendMessage
// exists). Tests import the module and call initOnboarding() with injected deps.
if (
  typeof document !== 'undefined' &&
  document.getElementById('onboarding') &&
  typeof chrome !== 'undefined' &&
  chrome.runtime &&
  typeof chrome.runtime.sendMessage === 'function'
) {
  initOnboarding();
}
