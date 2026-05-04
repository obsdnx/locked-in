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
    const mode = getMode();

    if (mode === 'blocklist') {
      const data = await chrome.storage.sync.get({ blockedSites: [] });
      await chrome.storage.sync.set({
        blockedSites: data.blockedSites.filter(s => s !== hostname),
      });
    } else {
      const data = await chrome.storage.sync.get({ allowedSites: [] });
      if (!data.allowedSites.includes(hostname)) {
        await chrome.storage.sync.set({ allowedSites: [...data.allowedSites, hostname] });
      }
    }

    await new Promise(r => setTimeout(r, 120));
    window.location.href = url;
  } catch (err) {
    console.error('LockedIn:', err);
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

// ── Mode-aware UI ─────────────────────────────────────────────────────────────

function getMode() {
  return new URLSearchParams(window.location.search).get('mode') ?? 'allowlist';
}

function applyModeUI() {
  const mode = getMode();
  if (mode === 'blocklist') {
    document.querySelector('.sub').textContent = 'This site is on your blocklist';
    // No quick-unblock from the blocked page — remove it from the popup instead
    document.getElementById('btn-allow').hidden = true;
  }
}

// ── Boot ──────────────────────────────────────────────────────────────────────

(async () => {
  showQuote();
  applyModeUI();
  const url = await getBlockedUrl();
  displayUrl(url);
})();
