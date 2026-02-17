# Installation Guide

This extension is **Chrome only** and portable (no build step, no npm).

## Load in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select this project folder (the one containing `manifest.json`)

## Clone / Copy

- **Git:** `git clone <repo-url>` then load the folder as above.
- **Copy:** Copy the whole project folder; all paths are relative. Requires `manifest.json`, `popup.*`, `background.js`, `inline.js`/`inline.css`, `account-details-window.*`, `assets/`, and `icons/`.

## Notes

- No external dependencies; works on Windows, Mac, and Linux.
- Reload the extension (Extensions page → refresh icon) after code changes.

