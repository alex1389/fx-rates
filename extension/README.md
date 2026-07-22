# Upwork Proposal Assistant

A personal Chrome extension that helps you review and autocomplete Upwork proposals using Claude, directly from your browser — no backend server needed.

## What it does

On any `upwork.com` page it adds a small floating panel (bottom-right corner) with:

- **Set job description** / **Set proposal box** — click these, then click the matching element on the page. Upwork's DOM changes over time, so the extension tries to auto-detect both, but manual picking always works as a fallback.
- **Generate draft** — writes a tailored cover letter using the job posting and your saved profile/background, and inserts it directly into the proposal box.
- **Review draft** — scores your current draft, lists concrete issues, and offers a rewritten version you can insert with one click.

## Setup

1. Go to `chrome://extensions`, enable **Developer mode** (top right), click **Load unpacked**, and select this `extension/` folder.
2. Click the extension icon → **Open settings**.
3. Add your Anthropic API key (from [console.anthropic.com](https://console.anthropic.com)), pick a model, and fill in your background/skills — this context is sent with every generation so drafts aren't generic.
4. Open a job page or the proposal/apply flow on Upwork. The panel appears automatically.

## Notes

- Your API key and profile are stored only in your browser (`chrome.storage.local`) and are sent straight to `api.anthropic.com` — never through any third-party server.
- API calls happen directly from the extension's background service worker; you're billed by Anthropic per the model you pick in settings.
- If Upwork changes its page layout and auto-detect stops finding the right elements, use **Set job description** / **Set proposal box** to point at them manually.
