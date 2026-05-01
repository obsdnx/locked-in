const QUOTES = [
  'The secret of getting ahead is getting started.',
  'Focus is the art of knowing what to ignore.',
  'Deep work is the ability to focus without distraction.',
  'Your future self is counting on you right now.',
  'One hour of focused work beats four hours of distraction.',
  'Discipline is choosing what you want most over what you want now.',
  'The successful warrior is the average person with laser-like focus.',
  'Either you run the day, or the day runs you.',
  'You don\'t have to be great to start, but you have to start to be great.',
  'Concentrate all your thoughts upon the work at hand.',
];

// ── Get blocked URL ───────────────────────────────────────────────────────────

async function getBlockedUrl() {
  // Primary: URL passed as query param by the background redirect
  const params = new URLSearchParams(window.location.search);
  const fromParam = params.get('url');
  if (fromParam) return fromParam;

  // Fallback: ask the background service worker
  try {
    const res = await chrome.runtime.sendMessage({ type: 'GET_BLOCKED_URL' });
    return res?.url ?? '';
  } catch {
    return '';
  }
}

// ── Display URL ───────────────────────────────────────────────────────────────

function displayUrl(url) {
  const el = document.getElementById('url-display');
  if (!url) { el.textContent = 'Unknown site'; return; }
  try {
    el.textContent = new URL(url).hostname;
    el.title = url;
  } catch {
    el.textContent = url;
  }
}

// ── Quote ─────────────────────────────────────────────────────────────────────

function showQuote() {
  const el = document.getElementById('quote');
  el.textContent = '“' + QUOTES[Math.floor(Math.random() * QUOTES.length)] + '”';
}

// ── Buttons ───────────────────────────────────────────────────────────────────

document.getElementById('btn-allow').addEventListener('click', async () => {
  const url = await getBlockedUrl();
  if (!url) return;

  try {
    const hostname = new URL(url).hostname;
    const data = await chrome.storage.sync.get({ allowedSites: [] });
    const sites = data.allowedSites;

    if (!sites.includes(hostname)) {
      await chrome.storage.sync.set({ allowedSites: [...sites, hostname] });
    }

    // Brief pause lets the background script pick up the storage change
    // before we navigate to the now-allowed URL.
    await new Promise(r => setTimeout(r, 120));
    window.location.href = url;
  } catch (err) {
    console.error('LockedIn: failed to add to allowlist', err);
  }
});

document.getElementById('btn-close').addEventListener('click', () => {
  // Close tab; fallback to opening the new-tab page
  chrome.tabs.getCurrent(tab => {
    if (tab) {
      chrome.tabs.remove(tab.id);
    } else {
      window.close();
    }
  });
});

// ── Boot ──────────────────────────────────────────────────────────────────────

(async () => {
  showQuote();
  const url = await getBlockedUrl();
  displayUrl(url);
})();
