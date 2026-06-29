# AI Safety Guard — Federal Security Overview

One-page summary for agency security reviewers (ISSO / Authorizing Official). Version 1.0.0, June 2026.

## What it is

A free, open-source Chrome extension (Manifest V3) that warns a user before they send sensitive information to an AI chat tool (ChatGPT, Claude, Gemini, Perplexity, Microsoft Copilot). It scans the message box as the user types, interrupts a risky send with a warning, lets the user redact, and scans attached PDF and Word files. All detection runs on the user's device.

## Why the FedRAMP question usually does not apply

FedRAMP authorizes cloud service offerings that store, process, or transmit federal data on a vendor-operated backend. AI Safety Guard has no backend, no server, no account system, and makes no network calls with user content. There is no cloud system to place inside an authorization boundary. The extension runs entirely within the agency's own managed browser, so the relevant path is the agency's standard endpoint software review and ATO under FISMA / NIST SP 800-53, not a FedRAMP package. If a hosted component is ever added, that calculus changes and FedRAMP (likely the Low or LI-SaaS baseline) would re-enter scope.

## Data flow and the no-egress guarantee

The only data the extension persists is the user's own settings (sensitivity level, which sites are watched, custom domains) and a single local counter of how many risky sends were caught. These live in `chrome.storage` on the device. No prompt text, file content, or detected value is ever stored or transmitted.

Detection is a pure, synchronous function over the text in the page. Attached PDFs are parsed locally in an offscreen document running the bundled pdf.js on the extension's own origin; Word files are parsed inline. The only network request the extension makes is loading its own bundled woff2 fonts from within the extension package. Raw secrets never reach the UI: the warning shows only masked values (for example `sk-live-****`).

This claim is enforced in the codebase, not just asserted. A static no-egress audit (`npm run audit:privacy`) runs in CI and fails the build if any content-exfiltration pattern is introduced. Reviewers can run it themselves against the public source.

## Permissions and least privilege

The manifest requests only what it uses:

- `storage` — persist the user's settings and the local caught-count. No user content.
- `offscreen` — run the local PDF text extractor in an offscreen document that makes no network requests.
- `host_permissions` — limited to the supported AI tools only, six hosts across five providers (chatgpt.com, chat.openai.com, claude.ai, gemini.google.com, www.perplexity.ai, copilot.microsoft.com). The extension does not run on any other site and never requests `<all_urls>`.

There is no `externally_connectable`, no remote code, and no dynamic code execution. The previously present `scripting` and `activeTab` permissions were removed because the code does not use them.

## Secure development (NIST SSDF / SP 800-218 alignment)

- Source is public and version-controlled; every change is reviewed and built through a reproducible pipeline (`npm run build`).
- Continuous integration runs lint, the full automated test suite, the privacy audit, a performance benchmark, and the build on every push and pull request.
- Dependencies are pinned via lockfile and monitored for vulnerabilities by Dependabot; the runtime dependency set is intentionally tiny (see SBOM).
- No secrets are stored in the repository; the extension neither holds nor needs credentials.
- This supports a CISA Secure Software Development Attestation Form (derived from SP 800-218) if an agency requires one.

## Software Bill of Materials

A CycloneDX 1.6 SBOM of the production dependency closure is provided at `docs/sbom.cyclonedx.json`, with the application itself as the root component (MIT). Regenerate it with `npm run gen:sbom`. The shipped runtime footprint is two direct dependencies: `pdfjs-dist` (Apache-2.0) for local PDF text extraction and `fflate` (MIT) for local DOCX unzip. The SBOM also lists pdf.js's optional `@napi-rs/canvas` dependency and its platform-specific prebuilt binary; this is a Node-only module that is not included in the shipped browser bundle (text extraction does not use it), and the binary entry reflects the platform the SBOM was generated on, so regenerate on the target or CI platform for a host-matched artifact. All build and test tooling is dev-only and is excluded from the SBOM and from the extension package.

## Section 508 / accessibility status

A WCAG 2.1 AA self-assessment (`VPAT.md`) and a detailed audit (`ACCESSIBILITY-AUDIT.md`) are included. The core warning dialog implements a correct accessible dialog (focus trap, Escape, focus restoration) and risk is never conveyed by color alone. The items found in the audit (keyboard operability of the onboarding sensitivity options, risk-pill text contrast, explicit focus indicators, dialog labeling, focus management, and grouping semantics) have been remediated and are guarded by automated tests, and the VPAT reports "Supports" across the WCAG 2.1 A and AA criteria. A manual screen-reader pass (NVDA or VoiceOver) on the live extension is recommended as a final check before submission, and an independent evaluation can be arranged on request.

## How an agency can adopt it

The extension can be deployed to managed browsers by force-install or allowlist by extension ID through Chrome Enterprise policy, rather than ad-hoc store installs. A single sponsoring office can pilot it under its existing ATO; because the extension collects and transmits no data, the security review is substantially lighter than for a SaaS product. Source, privacy policy, SBOM, and this overview are available for that review.

## Contact

Hemant Naik — hemant.naik@gmail.com. Source repository and full documentation accompany this overview.
