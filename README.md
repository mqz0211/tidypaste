# TidyPaste

Paste messy text or links, get a clean version back, already copied to your clipboard.

## The problem
Links arrive full of tracking junk (`utm_*`, `fbclid`) or wrapped in redirect URLs. Text copied from a PDF breaks mid-sentence and splits words with hyphens. Cleaning that by hand takes a minute every time.

## What it does
1. Removes tracking parameters and unwraps redirect links, and lists what it removed.
2. Repairs PDF line breaks and split words, and removes hidden characters and extra spaces.
3. Copies the clean result automatically on paste and keeps a history to restore or copy again.

Everything runs in your browser. Nothing you paste leaves the page. Each cleaning step can be switched off.

## Run it
Open `index.html` in a browser. No build step. Fonts load from Google Fonts.

## Files
- `index.html` page structure
- `style.css` design
- `app.js` cleaning logic and UI
