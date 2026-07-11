# Changelog

All notable changes to AI Prompt - Security Guard. Selector bumps get their own lines so
store reviewers can see exactly what changed and why.

## Unreleased — ships with the Chrome Web Store submission

### Product rename
- "AI Safety Guard" → "AI Prompt - Security Guard" across manifest, all UI
  surfaces (popup, onboarding, modal wordmark, secure composer), log prefix,
  docs, site copy and package name. Internal `asg-`/`.asg` prefixes and
  element ids unchanged (not user-facing; avoids breaking selectors/tests).

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
