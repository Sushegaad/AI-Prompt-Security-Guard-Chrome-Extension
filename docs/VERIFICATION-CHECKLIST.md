# Pre-submission verification checklist

The browser-only surface that automated CI can't fully cover, plus first-run
confirmations. Do this once before the Chrome Web Store submission. Status of
what's already verified is noted.

## Already verified (no action)

- [x] Unit/integration suites: 8 suites green in CI on every push (52 runs, all successful).
- [x] Privacy audit + lint + build: green in CI.
- [x] GitHub Pages deploy: green; live site links resolve (repo now public).

## 1. Tier A e2e — first run in a real browser (~10 min)

The harness has only been syntax/logic-verified; it has never launched Chromium.

```
npm ci
npm run build
npx playwright install chromium
npm run e2e
```

Expected: `[tier-a] all green ✓` — 5 sites × 7 assertions (badge, Critical label,
Enter interception, blocked send, masked modal, send-anyway completion, badge
clear after programmatic input clear). If headless fails on macOS, retry with
`HEADED=1 npm run e2e`.

- [ ] Tier A green locally
- [ ] After the next push: the `e2e / Tier A` job appears and passes in GitHub
      Actions (a `push: main` trigger is now in the workflow)
- [ ] Next Monday ≥ 06:00 UTC (or `workflow_dispatch` now): `Tier B — live
      drift probe` runs; check `tier-b-results` artifact. `unverifiable` for
      Claude/Gemini is expected (login walls); `drift`/`no-composer` files an
      issue automatically

## 2. Custom domains manual QA (~20 min)

Run `docs/QA-CUSTOM-DOMAINS.md` top to bottom (grant / deny / removal /
out-of-band revocation / browser restart / update-in-place). These are the
flows a store reviewer is most likely to poke at.

- [ ] All checklist items pass

## 3. New-feature spot checks (~10 min, load unpacked from dist/)

- [ ] Paste a screenshot (Cmd-Ctrl-Shift-4 → Cmd-V) into ChatGPT — the image
      nudge appears ("Screenshots often contain names, keys…")
- [ ] Type `meine Steuer-ID: 86574432857` — badge Critical, Government ID row
- [ ] Type `mi DNI es 12345678Z` — badge Critical
- [ ] Type `adjunto la nómina de Alex` — badge High (workplace)
- [ ] Popup → enable "Keep a local history of catches" → trigger a warning →
      entry appears masked; Clear history empties it
- [ ] Noise hint: not realistically testable by hand (needs 20+ outcomes) —
      covered by unit tests; skip

## 4. Screen-reader pass (optional but recommended pre-submission)

VoiceOver (Cmd-F5) over: warning modal (named by heading, focus trapped, mute
buttons announced), popup domain add (status announced without focus steal),
onboarding steps (focus follows). Log anything odd against the audit's F7.
