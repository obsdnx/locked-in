# LockedIn

A Chrome extension that blocks all websites except those you explicitly allow, so you can stay in deep focus without fighting distractions.

## Features

- **One-tap toggle** — activate focus mode with a single click
- **Allowlist** — add exact domains (`wikipedia.org`) or wildcard patterns (`*.edu`)
- **Subdomain-aware matching** — `example.com` automatically covers `www.example.com`
- **Quick-add chips** — common study sites added in one click
- **Blocked page** — clear page with an "Add to Allowlist" shortcut so you can unblock something instantly
- **State persists** — mode and allowlist survive browser restarts via `chrome.storage.sync`
- **Icon changes** — toolbar icon turns blue when active, dark when inactive

## Installation

### 1 — Generate icons (one-time)

```bash
python3 generate-icons.py
```

Requires Python 3 (standard library only — no pip packages needed).

### 2 — Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `locked-in` folder

The LockedIn icon appears in your toolbar.

## Usage

| Action | How |
|---|---|
| Enable focus mode | Click the toolbar icon → flip the toggle |
| Add a site | Type a domain in the input and press **Add** or Enter |
| Quick-add common sites | Click one of the chip buttons below the input |
| Remove a site | Click **×** next to any site in the list |
| Unblock from blocked page | Click **Add to Allowlist** — redirects you instantly |
| Close a blocked tab | Click **Stay Focused** |

## Allowlist pattern syntax

| Pattern | Matches |
|---|---|
| `example.com` | `example.com`, `www.example.com`, `sub.example.com` |
| `docs.google.com` | only `docs.google.com` (not `mail.google.com`) |
| `*.edu` | all `.edu` domains |

## File structure

```
locked-in/
├── manifest.json
├── generate-icons.py
├── icons/
│   ├── icon16.png / icon48.png / icon128.png
│   ├── icon-active16.png / icon-active48.png
│   └── icon-inactive16.png / icon-inactive48.png
├── background/
│   └── background.js        service worker — intercepts navigation
├── popup/
│   ├── popup.html / .css / .js
├── blocked/
│   ├── blocked.html / .css / .js
└── utils/
    └── urlMatcher.js        URL matching shared utility
```

## Permissions used

| Permission | Why |
|---|---|
| `storage` | Persist active state and allowlist |
| `tabs` | Redirect blocked tabs to the blocked page |
| `webNavigation` | Capture the blocked URL before redirect so the blocked page can display it |
| `<all_urls>` | Required to intercept navigation on any site |
