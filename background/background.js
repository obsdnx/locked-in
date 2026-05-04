importScripts('../utils/urlMatcher.js');

// In-memory state — kept in sync with chrome.storage.sync via onChanged
const state = {
  isActive: false,
  mode: 'allowlist',
  allowedSites: [],
  blockedSites: [],
};

// Map of tabId -> original URL, populated by webNavigation.onBeforeNavigate
// so the blocked page can retrieve what site was blocked.
const pendingBlocked = new Map();

// ─── Initialisation ───────────────────────────────────────────────────────────

async function loadState() {
  const data = await chrome.storage.sync.get({ isActive: false, mode: 'allowlist', allowedSites: [], blockedSites: [] });
  state.isActive    = data.isActive;
  state.mode        = data.mode;
  state.allowedSites = data.allowedSites;
  state.blockedSites = data.blockedSites;
  setIcon(state.isActive);
}

chrome.runtime.onInstalled.addListener(async () => {
  // Migration: seed new fields for existing installs
  const data = await chrome.storage.sync.get(['mode', 'blockedSites']);
  if (!data.mode) chrome.storage.sync.set({ mode: 'allowlist', blockedSites: [] });
  loadState();
});

// Reload state whenever the service worker wakes up
loadState();

// ─── Icon ─────────────────────────────────────────────────────────────────────

function setIcon(active) {
  const suffix = active ? 'active' : 'inactive';
  chrome.action.setIcon({
    path: {
      16: chrome.runtime.getURL(`icons/icon-${suffix}16.png`),
      48: chrome.runtime.getURL(`icons/icon-${suffix}48.png`),
      128: chrome.runtime.getURL('icons/icon128.png'),
    },
  });
}

// ─── Storage sync ─────────────────────────────────────────────────────────────

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') return;
  if ('isActive' in changes) {
    state.isActive = changes.isActive.newValue;
    setIcon(state.isActive);
  }
  if ('mode' in changes)         state.mode         = changes.mode.newValue;
  if ('allowedSites' in changes) state.allowedSites = changes.allowedSites.newValue ?? [];
  if ('blockedSites' in changes) state.blockedSites = changes.blockedSites.newValue ?? [];
});

// ─── Blocking logic ───────────────────────────────────────────────────────────

function isWebUrl(url) {
  return url.startsWith('http://') || url.startsWith('https://');
}

function shouldBlock(url) {
  if (!state.isActive) return false;
  if (!isWebUrl(url)) return false;
  if (state.mode === 'blocklist') return isUrlAllowed(url, state.blockedSites);
  return !isUrlAllowed(url, state.allowedSites);
}

// Capture the original URL early (before the redirect fires) so the blocked
// page can ask us what was blocked.
chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (details.frameId !== 0) return; // main frame only
  const { tabId, url } = details;

  if (shouldBlock(url)) {
    pendingBlocked.set(tabId, url);
  } else {
    pendingBlocked.delete(tabId);
  }
});

// Redirect blocked navigations to the blocked page.
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (!changeInfo.url) return;
  const url = changeInfo.url;

  if (shouldBlock(url)) {
    const blocked = chrome.runtime.getURL('blocked/blocked.html') +
                    '?url=' + encodeURIComponent(url) +
                    '&mode=' + state.mode;
    try {
      await chrome.tabs.update(tabId, { url: blocked });
    } catch {
      // Tab was closed before we could redirect
    }
  }
});

// ─── Message bridge ───────────────────────────────────────────────────────────

// The blocked page asks for the URL that triggered the block.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type !== 'GET_BLOCKED_URL') return false;

  const tabId = sender.tab?.id;
  const url = tabId != null ? (pendingBlocked.get(tabId) ?? '') : '';
  sendResponse({ url });

  // Keep entry around briefly for page re-renders / back-forward cache
  setTimeout(() => pendingBlocked.delete(tabId), 10_000);
  return true;
});
