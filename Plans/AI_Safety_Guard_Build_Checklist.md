# AI Safety Guard — Build Checklist

A trackable checklist derived from the Implementation Plan (PRD v1.0 • Design v1).
Check items off as you build. Estimated total: **5–6.5 weeks**.

Principle to hold throughout: *calm, plain-English, helpful — never punitive. All scanning happens on-device.*

---

## Phase 0 — Design System (do this first)

Every UI component must reuse these tokens. Hardcoding other values is a bug.

- [x] Embed fonts in the extension, no runtime CDN — Hanken Grotesk (all UI text), Spline Sans Mono (masked data values only)
- [x] Restrict font weights to 400 (regular) and 500 (medium) — never 600/700
- [x] Define brand palette constants: trust `#3B5BDB`, ink `#1A1A2E`, paper `#F8F7F4`, muted `#6B7280`
- [x] Define **desaturated** risk palette (Safe / Medium / High / Critical) — no saturated reds or yellows
- [x] Encode the 3 sensitivity modes + interrupt thresholds: Basic (Critical only), Balanced★ (Medium+), Strict (Medium+, badge always visible)

---

## Phase 1 — Project Setup & Scaffolding  (3–4 days)

**Deliverable:** skeleton extension that loads in Chrome.

- [x] Create repo `ai-safety-guard`; add Node `.gitignore` (`node_modules`, `dist/`, `.env`)
- [x] `npm init`; install dev deps: webpack, webpack-cli, copy-webpack-plugin, eslint, prettier, web-ext
- [x] Build directory structure (`src/background`, `src/content`, `src/content/ui`, `src/content/sites`, `src/popup`, `src/onboarding`, `src/shared`, `assets/icons`)
- [x] Write `manifest.json` (MV3): permissions `storage`, `activeTab`, `scripting`
- [x] `host_permissions`: explicit URL patterns per AI site — **never** `<all_urls>`
- [x] Wire `background.service_worker`, `content_scripts`, `action` → popup, `web_accessible_resources` (fonts/CSS/icons)
- [x] Configure Webpack: entry points (service-worker, content, popup, onboarding); CopyWebpackPlugin → `dist/`; npm scripts `build` / `watch` / `lint`
- [x] Verify the extension loads unpacked from `dist/` in Chrome *(build verified; final "Load unpacked" click is manual)*

---

## Phase 2 — Detection Engine  (1–1.5 weeks)

**Deliverable:** all detectors, entropy checks, risk levels. 100% local.

- [ ] Build `detector.js` as a pure, synchronous function: string in → `{ riskLevel, categories, matches[], summary, scanMs }`
- [ ] Email addresses (RFC-5321 regex) — MEDIUM
- [ ] Phone numbers (US/international) — MEDIUM
- [ ] Physical addresses (street/ave/blvd + zip) — MEDIUM
- [ ] Credit card numbers (13–16 digit + Luhn validation) — CRITICAL
- [ ] Social security numbers (`XXX-XX-XXXX`, exclude 000/666) — CRITICAL
- [ ] API keys / tokens (Shannon entropy > 4.0, len ≥ 20, prefixes `sk-`/`ghp_`/`AKIA`/`xoxb-`/`Bearer`/`token=`) — CRITICAL
- [ ] Passwords / credentials (keyword proximity + entropy after assignment) — CRITICAL
- [ ] Account numbers (`account #`, `#NNNNN`) — HIGH
- [ ] Health info (patient, diagnosis, prescription, ICD, DOB, MRN) — HIGH
- [ ] Financial data (invoice, revenue, EBITDA, routing + currency patterns) — HIGH
- [ ] Legal language (confidential, attorney-client, privileged, NDA; 2+ terms = HIGH)
- [ ] Customer data (names in context with account IDs/emails/tickets) — HIGH
- [ ] Source code (backtick blocks, indented code, language keywords) — MEDIUM→HIGH
- [ ] Internal URLs (private IP ranges, `.internal`/`.local`/`.corp`) — HIGH
- [ ] Masking per category: API key `sk-live-9fK2••••`, email `sarah.chen@…`, account `#88•••`, cards/SSNs last-4, address → street only
- [ ] Set `maskedValue` on every match (modal must never receive raw values)
- [ ] Risk aggregation: highest-severity category always wins
- [ ] Performance: < 50ms for 4,000 chars; 300ms input debounce; async path for pastes > 10,000 chars; always record `scanMs`
- [ ] Unit tests: each regex (good/bad), masking functions, entropy checker, risk aggregation
- [ ] Regression fixture: `sarah.chen@northwind.io`, `#88291`, `sk-live-9fK2pQ7xR4mZ8vB1`

---

## Phase 3 — Content Scripts & UI  (1.5–2 weeks)

**Deliverable:** all four screens (A1/A2/B1/B2) + site adapters. Build in order.

### A1 — Inline Badge
- [ ] Inject a shadow-DOM element anchored just outside the input area
- [ ] Load both fonts inside the shadow root (`@font-face` via `web_accessible_resources` URL)
- [ ] Show risk label + `scanned locally · Nms` on every scan (`N` from `scanMs`)
- [ ] Critical state shows finding count: `Critical risk · 3 findings`
- [ ] Hidden when input is empty; updates within 300ms of typing

### A2 — Pre-Submit Warning Modal (centerpiece)
- [ ] Intercept submit with `e.preventDefault()` in **capture phase**
- [ ] Header: wordmark + × close; Title: "Before you send this"
- [ ] Subtitle about possible private info exposure
- [ ] Findings list, Critical first: type label + masked value (Spline Sans Mono) + desaturated pill
- [ ] Footer: "Scanned on your device. Nothing has been sent or stored."
- [ ] Four buttons in order: Redact sensitive data / Rewrite it safely / Send anyway / Keep editing
- [ ] Confirm raw sensitive values never appear in any UI element

### B1 — Redact & Review
- [ ] Store original text before redacting
- [ ] Replace each `match.rawValue` in-place with a `[TYPE]` chip (`[NAME]`/`[EMAIL]`/`[ACCOUNT]`/`[API_KEY]`/`[CARD]`/`[SSN]`/`[PHONE]`)
- [ ] Re-run detector; confirm risk dropped to Safe before enabling send; show Safe badge
- [ ] "Looks good — send" triggers the original submit action programmatically
- [ ] "Undo" restores the original text exactly

### B2 — Rewrite Safely (the only cloud step)
- [ ] Two-column layout: YOUR VERSION (read-only) vs SAFER VERSION
- [ ] Removal note (e.g. "Removed: names, emails, account IDs, API key")
- [ ] Cloud disclosure copy + configurable endpoint, off by default
- [ ] Consent gate on first use; store consent in `chrome.storage` (don't ask twice)
- [ ] API payload `{ prompt, categories, instruction: "Remove or generalize all sensitive details" }`
- [ ] "Use safer version" replaces input text; "Back" returns to A2 with no network call

### Site Adapters (`src/content/sites/`)
- [ ] One file per site exporting `getInputElement()`, `getSubmitButton()`, `getBadgeAnchor()`
- [ ] ChatGPT — `#prompt-textarea` / `div[contenteditable]`, `button[data-testid='send-button']`
- [ ] Claude — `div[contenteditable='true']`, `button[aria-label='Send message']`
- [ ] Gemini — `div[contenteditable='true'].ql-editor`, `button.send-button`
- [ ] Perplexity — `textarea[placeholder]`, `button[aria-label='Submit']`
- [ ] Copilot — `textarea` / `div[contenteditable]`, `button[type='submit']`
- [ ] Fallback selector lists per site + console warning when nothing is found
- [ ] MutationObserver on `document.body` to re-attach on SPA navigation

### Token Enforcement (lint gate — "hardcoding other values is a bug")
- [ ] Add stylelint with `color-no-hex` (or `declaration-property-value-disallowed-list` for color/background/border) forbidding raw hex/rgb literals everywhere except `src/shared/tokens.css`
- [ ] Add an ESLint rule (e.g. `no-restricted-syntax` / regex on string literals) flagging hardcoded hex colors and font weights in JS — values must come from `constants.js`
- [ ] Wire both into the `npm run lint` script and the build so token violations **fail the build**, not just warn

---

## Phase 4 — Settings, Onboarding & Storage  (1 week)

**Deliverable:** popup (D), 3-step onboarding (E), persistent preferences.

### Storage Schema (`shared/storage.js`, `chrome.storage.local`)
- [ ] `enabled`, `sensitivity` (default "balanced"), `enabledSites` (all true), `customDomains[]`
- [ ] `disabledCategories[]`, `allowRewrite` (false until consent), `rewriteApiEndpoint` (configurable)
- [ ] `analyticsEnabled` (default true, opt-out), `onboardingComplete`, `riskySubmissionsCaught`

### Screen E — Onboarding (3 steps)
- [ ] Trigger on `chrome.runtime.onInstalled`; open `onboarding.html` in new tab (paper bg, Hanken Grotesk)
- [ ] Step 1 "A safety net for AI" — 3 benefit lines + Continue
- [ ] Step 2 "How careful should we be?" — sensitivity cards, Balanced pre-selected + RECOMMENDED
- [ ] Step 3 "Where should we watch?" — site toggles grouped "Claude & Gemini", "Perplexity & Copilot" + custom domain field
- [ ] On "Start protecting me": save settings, set `onboardingComplete: true`, close tab

### Screen D — Toolbar Popup
- [ ] ~320px wide, paper bg, Hanken Grotesk; header wordmark + "Protecting this tab"
- [ ] Sensitivity segmented control (Basic / Balanced / Strict)
- [ ] Per-site toggles (ChatGPT, Claude, Gemini, Perplexity) + "+ Add a custom AI domain"
- [ ] Stat line `NNN risky sends caught` from `riskySubmissionsCaught`; footer version + Privacy link
- [ ] Save on change immediately (no Save button)

### Message Passing
- [ ] Content script sends `GET_SETTINGS` on startup → service worker returns settings
- [ ] Popup changes broadcast `SETTINGS_UPDATED` → content scripts update local copy
- [ ] Each A2 modal show fires `RECORD_CATCH` → increment `riskySubmissionsCaught`
- [ ] Service worker owns all storage reads/writes; reads from storage on every message (MV3 workers are ephemeral)

---

## Phase 5 — Testing, Privacy Audit & Ship  (1–1.5 weeks)

**Deliverable:** ship with confidence.

### Design QA (verify each screen against the design file)
- [ ] A1 badge: appears on all 5 sites, updates < 300ms, shows `scanned locally · Nms`, Critical count, hidden when empty
- [ ] A2 modal: correct title, masked values only, desaturated pills, footer copy, button order
- [ ] B1 redact: `[LABEL]` chips, Looks good / Undo present, Safe badge, exact undo, post-redact re-scan Safe
- [ ] B2 rewrite: two-column layout, removal note, cloud disclosure + configurable endpoint, consent gate, clean Back
- [ ] D popup: controls reflect storage, accurate counter, custom domain saves
- [ ] E onboarding: opens on fresh install only, Balanced pre-selected, correct groupings, settings save
- [ ] Typography: Hanken Grotesk for UI, Spline Sans Mono for masked values, no fallback fonts visible
- [ ] Colors: desaturated palette throughout, no saturated reds/yellows, paper bg on modal/popup/onboarding

### Privacy Audit
- [ ] DevTools: zero network calls during normal scanning
- [ ] B2 rewrite is the ONLY network call, and only when explicitly triggered
- [ ] `chrome.storage` contains only settings + counter — no prompt text ever
- [ ] Analytics events contain zero prompt content
- [ ] Consent gate: rewrite API never called before consent
- [ ] Write Privacy Policy (required by CWS) — what is collected and when

### Performance Testing
- [ ] Time detector on 100 / 1,000 / 5,000 / 10,000 char inputs
- [ ] Badge under 50ms on typical inputs (target 18ms); no input jank on any of the 5 sites
- [ ] Run alongside heavy ChatGPT sessions with long history

### Chrome Web Store Submission
- [ ] Register CWS developer account (one-time $5 fee)
- [ ] Store listing: name, 132-char description, 1280×800 screenshots, category Productivity
- [ ] Permission justifications: each host permission + storage + scripting (never `<all_urls>`)
- [ ] Package: `npm run build`, then zip `dist/` (not the repo root)
- [ ] Submit (typical review 1–3 business days); prepare for permission clarifications

---

## Development Gotchas (keep in view)

- [ ] **contenteditable inputs** — ChatGPT/Claude use `div[contenteditable]`; read `innerText`, write by setting `innerText` + dispatching an `input` event
- [ ] **SPA navigation** — new chats don't reload; MutationObserver to re-attach listeners
- [ ] **Capture phase** — `addEventListener('click', handler, true)`; bubble-phase fires too late
- [ ] **Shadow DOM** — inject all UI inside a shadow root to isolate from host CSS
- [ ] **CSP on AI sites** — use `chrome.scripting.insertCSS`; embed fonts rather than runtime Google Fonts
- [ ] **MV3 ephemeral workers** — never store state in memory; read `chrome.storage` in every handler
- [ ] **Fonts in shadow DOM** — `@font-face` inside the shadow root's `<style>` via `chrome.runtime.getURL('fonts/hanken.woff2')`

---

## Privacy-Safe Analytics (aggregate, non-identifying only)

- [ ] `extension_installed`
- [ ] `warning_shown` — `{ risk_level, sensitivity_mode }`
- [ ] `redaction_completed` — `{ categories_redacted[] }`
- [ ] `rewrite_requested` — `{ categories_present[] }`
- [ ] `send_anyway_clicked` — `{ risk_level }`
- [ ] `onboarding_completed` — `{ sensitivity_chosen }`
