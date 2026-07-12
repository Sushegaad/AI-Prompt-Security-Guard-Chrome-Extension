# Changelog

All notable changes to AI Prompt - Security Guard. Selector bumps get their own lines so
store reviewers can see exactly what changed and why.

## Unreleased — ships with the Chrome Web Store submission

### Product rename
- "AI Safety Guard" → "AI Prompt - Security Guard" across manifest, all UI
  surfaces (popup, onboarding, modal wordmark, secure composer), log prefix,
  docs, site copy and package name. Internal `asg-`/`.asg` prefixes and
  element ids unchanged (not user-facing; avoids breaking selectors/tests).

### Internals & security hygiene
- Privacy audit rewritten to match reality: stale "cloud rewrite" spec text
  removed; Shield's approved-text relay is now an EXPLICIT audited exception —
  new checks confine `SHIELD_SUBMIT`/`SHIELD_INJECT` to the four relay files
  and assert nonce-tagging at the sender and the SW relay.
- CI gains a production-dependency vulnerability gate
  (`npm audit --omit=dev --audit-level=high`).
- Category metadata single-sourced in `src/shared/categories.js`;
  `UNMUTABLE_CATEGORIES` is now derived from the `risk:'critical'` entries
  (DRY by construction; the retune test snapshots the expected set).
- Settings reads simplified: contexts read `chrome.storage` natively via
  `readSettings()` and subscribe with `storage.onChanged`. `GET_SETTINGS`,
  `SETTINGS_UPDATED` and the all-tabs broadcast are gone; writes still route
  through the SW's `sanitizePatch` boundary. Late-loading tabs can no longer
  miss a settings update.
- The marketing site self-hosts its fonts (was Google Fonts) — no third-party
  requests from the site, matching the product's privacy posture.

### Shield Mode: deliberate invocation via chip
- The secure composer now opens ONLY from an always-visible "Shield" chip
  pinned to the composer's top-right corner (shown when Shield Mode is on for
  the site). The focusin/keydown auto-open — and the reopen races it caused —
  is gone. Cancel/Esc closes until the chip is clicked again.
- Drafts in the real composer are preserved: approved text is appended on
  injection, never overwritten (auto-open used to clear the box on the way up).

### Shield Mode composer actions
- Four actions, always visible, mirroring the warning modal's choices:
  "Redact & send safely" (reads "Insert & send" while safe), "Insert into
  chat" (redacted if risky, no send), "No change" (insert exactly as typed —
  Shield Mode's "send anyway"), and "Cancel". Action bar wraps in narrow
  composers.

### Brand & site
- New logo mark: a shield built from a chat bubble with a keyhole (spec in
  `Plans/AI Prompt - Security Guard Logo.pdf`). Single source in
  `src/shared/logo.js`; toolbar/store PNGs regenerated, with a simplified
  keyhole-as-dot variant at 16px per the scale-down rule.
- Landing page rewritten to the new design (`Plans/AI Prompt - Security
  Guard.pdf`): hand-written, zero-JS, ~29KB (was a 742KB bundled export).
  Permissions panel now also lists `scripting`; Shield Mode added to the
  features grid. Google site-verification tag preserved.

### EU / multilingual detection
- French, German and Spanish keyword packs across health, workplace,
  special-category, legal, restriction, financial, education and children lists.
- Checksum-validated EU identifiers: French NIR (mod-97 key), German Steuer-ID
  (ISO 7064, keyword-anchored), Spanish DNI (control letter) — all `gov_id`,
  critical. New suite: `detector.i18n.test.mjs` (53 assertions).

### Screenshots & images
- Pasted or attached images now trigger a tailored nudge (screenshots often
  carry secrets no text scanner can read). New capture-phase paste listener;
  no OCR, no image content is read.

### Feedback loop
- One-time popup hint when "sent anyway" exceeds 60% of 20+ outcomes.
- Optional local catch history (off by default): last 20 warnings, masked
  values only, clearable, documented in PRIVACY.md.

### CI
- Tier A e2e now also runs on every push to main (was PR/schedule only).
- New `docs/VERIFICATION-CHECKLIST.md` for the pre-submission browser pass.

### Detection
- Fixed systematic misses: hex-only API keys (charset-relative entropy), PEM
  private keys, JWTs, credential-bearing webhook URLs, dash-less/spaced SSNs
  (keyword-anchored), bare IBANs (mod-97 validated), dot-separated card numbers.
- Redaction completeness: keyword and name detectors now emit a span for EVERY
  occurrence (one modal row per category; the rest are hidden redaction spans),
  and redaction labels like `[IBAN]` no longer re-trigger keyword detection —
  previously a leftover second occurrence kept the post-redact rescan unsafe
  and "Looks good — send" permanently disabled.
- Stale badge fix: the composer is re-scanned when the page settles and after a
  send, so a site clearing the input programmatically (no `input` event) no
  longer leaves a "High risk" badge over an empty box.
- Input normalization: zero-width characters stripped and line-wrapped secrets
  joined before scanning; match offsets still map to the original text.

### Sensitivity retune
- Balanced (default) now interrupts on high + critical only; medium findings
  (emails, phones, code) show the amber badge without a modal.
- Source-code detection never interrupts — badge only. Secrets inside code
  still interrupt via their own categories.
- "Order/ticket/invoice #" style identifiers require a corroborating personal
  identifier before flagging.
- Per-category "Don't warn about this" mute (never for critical secrets), with
  unmute controls in the popup.
- Popup shows outcome counters (redacted / sent anyway) — local only.

### Custom domains
- Implemented properly: per-site optional host permission requested on add,
  dynamic content-script registration, service-worker reconciliation heals
  revoked grants. Labelled experimental.
- New `scripting` permission (no install warning) and
  `optional_host_permissions: ["https://*/*"]` (granted per-origin, on demand).

### Drift resilience
- Degraded mode: if a supported site's selectors stop matching, the content
  script falls back to generic composer heuristics after 4 s instead of
  silently doing nothing.
- `selectorVersion` added per site in `src/shared/sites.js`.
- Two-tier Playwright e2e: hermetic fixtures on every PR, weekly live-site
  drift probe that files a GitHub issue on drift.

### Documentation & compliance
- Federal security overview rewritten for the new permission model (scripting +
  per-origin optional grants, enterprise policy note).
- VPAT re-issued: 3.3.1 and 3.3.3 move from Not Applicable to
  Supports (inline, live-region-announced domain validation errors).
- Accessibility audit addendum covering the v1.1 surfaces (mute buttons,
  domain status messages, unmute section). No new A/AA findings; F7 advisory
  remains open.
- SBOM regenerated; PRIVACY.md and site copy updated (counters,
  per-site permissions).

### Selector versions
- chatgpt 1 · claude 1 · gemini 1 · perplexity 1 · copilot 1 (baseline)

## v1.0.0 — March 2026

- Initial release.
