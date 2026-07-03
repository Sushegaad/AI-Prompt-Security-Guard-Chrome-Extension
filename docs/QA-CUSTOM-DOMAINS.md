# Manual QA — Custom Domains (Workstream 3)

Browser-only behavior that automated tests can't cover. Run against a fresh
`npm run build` loaded unpacked from `dist/`, using any https chat-style site
you don't support natively (e.g. `huggingface.co/chat`, `chat.mistral.ai`).

## Grant flow

- [ ] Popup → type `chat.mistral.ai` → Add. Chrome shows a permission prompt naming **only that site**.
- [ ] Approve. Status line reads "Watching chat.mistral.ai…". Domain chip appears.
- [ ] `chrome://extensions` → AI Safety Guard → Details → Site access lists the new site alongside the six static ones.
- [ ] Open the site (fresh tab). Type `my ssn is 123456789` — badge appears; pressing send opens the warning modal.
- [ ] Badge sits on the main composer, not a search box (largest-visible heuristic).

## Deny flow

- [ ] Add another domain but **dismiss/deny** the Chrome prompt.
- [ ] Status shows "Permission declined — … was not added." No chip, no settings entry, Site access unchanged.

## Removal flow

- [ ] Remove the domain chip (×). Site access entry disappears (grant revoked) and a reload of the site shows no badge.

## Revocation healing (the Chrome quirk)

- [ ] Re-add the domain. Then revoke it from `chrome://extensions` → Site access (not the popup).
- [ ] The service worker prunes the orphaned registration (immediately via permissions.onRemoved, or at next browser start). The site shows no badge; no console errors.
- [ ] Re-adding the domain in the popup re-prompts and restores the badge.

## Lifecycle

- [ ] With a custom domain active: quit and reopen Chrome → badge still works (persistAcrossSessions + onStartup reconcile).
- [ ] Reload the extension (Update button) → badge still works after a tab refresh.
- [ ] Existing users: updating from a build without `scripting` must NOT disable the extension or re-prompt (scripting is a no-warning permission — verify on an unpacked update).

## Regression spot-checks

- [ ] The six static sites still scan with no new prompts.
- [ ] Popup input rejects `http://foo.com`, `192.168.0.1`, `foo`, `claude.ai` with inline errors.
- [ ] Enter key in the domain input behaves like clicking Add.
