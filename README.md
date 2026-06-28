# AI Safety Guard

A free Chrome extension that warns you before you send private information to an AI tool. Calm, plain English, and helpful, never punitive. Scanning happens on your device.

## What this does

AI Safety Guard watches the message box on AI tools like ChatGPT, Claude, Gemini, Perplexity, and Microsoft Copilot. As you type, it scans your text on your own device for sensitive information such as emails, phone numbers, credit cards, Social Security numbers, API keys, passwords, and confidential business, legal, financial, or health language.

If you try to send something risky, it pauses and shows a clear warning with the exact items it found (always masked, never the raw secret). You can then redact the sensitive values, send anyway, or keep editing. Your prompt text never leaves your device.

## Why you should use this

It is easy to paste a customer email, a contract, an API key, or internal data into an AI tool without thinking. Once it is sent, you cannot take it back. AI Safety Guard gives you a quiet heads up at the one moment that matters, right before you hit send, so a slip does not turn into a leak. It is local first, so using it does not mean trusting yet another company with your data.

## Who is this for

- Everyday AI users who want a simple safety net
- Employees using AI at work without formal data loss tooling
- Students, researchers, freelancers, and consultants
- Developers who do not want to paste keys or source into a chat box
- Small teams and security conscious individuals

## Features

- On device scanning. Your prompts are analyzed locally and are not stored or uploaded.
- Pre send warning that lists what was found, with masked values only.
- Risk badge near the input box that updates as you type.
- One click redaction that replaces sensitive values with labels like [EMAIL] and [API_KEY].
- Three sensitivity modes: Basic, Balanced, and Strict.
- Per site control and custom domains, all managed from a small popup.
- No accounts, no ads, no prompt logging, and no network calls at all.

## Getting started

1. Run `npm install` then `npm run build`.
2. Open `chrome://extensions`, turn on Developer mode.
3. Click "Load unpacked" and select the `dist` folder.
4. The setup screen opens on first install. Choose your sensitivity and the sites to watch.

## How to handle common installation issues

**The fonts look wrong on some sites.** A few AI sites use a strict Content Security Policy. The extension loads its own fonts in a way that works around this, but if you ever see a system font, reload the tab once after install.

**The badge or warning does not appear.** AI sites change their page layout often. Open the page, then reopen the extension popup and confirm the site toggle is on. If it still does not appear, the site may have changed its input box. Check the browser console for a message that begins with `[AI Safety Guard]`.

**Nothing is being saved.** Settings live in your browser local storage. If you use a locked down or guest profile that blocks extension storage, preferences will not persist.

## Privacy

Scanning is local. The extension stores only your settings and a single "risky sends caught" counter, never your prompt text. The full policy is in [PRIVACY.md](PRIVACY.md).

## Author

Hemant Naik [LinkedIn](https://www.linkedin.com/in/tanaji-naik/) · [hemant.naik@gmail.com](mailto:hemant.naik@gmail.com)

Built March 2026
