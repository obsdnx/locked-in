// ── State ─────────────────────────────────────────────────────────────────────

let isActive     = false;
let mode         = 'allowlist';
let allowedSites = [];
let blockedSites = [];

// ── DOM refs ──────────────────────────────────────────────────────────────────

const toggle       = document.getElementById('main-toggle');
const statusLabel  = document.getElementById('status-label');
const listHeading  = document.getElementById('list-heading');
const siteInput    = document.getElementById('site-input');
const addBtn       = document.getElementById('add-btn');
const siteList     = document.getElementById('site-list');
const emptyState   = document.getElementById('empty-state');
const emptyPrimary = document.getElementById('empty-primary');
const emptySec     = document.getElementById('empty-secondary');
const errorMsg     = document.getElementById('error-msg');
const footerMsg    = document.getElementById('footer-msg');
const quickAdd     = document.querySelector('.quick-add');

// ── Helpers ───────────────────────────────────────────────────────────────────

const activeList = () => mode === 'allowlist' ? allowedSites : blockedSites;
const activeKey  = () => mode === 'allowlist' ? 'allowedSites' : 'blockedSites';

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  const data = await chrome.storage.sync.get({
    isActive: false, mode: 'allowlist', allowedSites: [], blockedSites: [],
  });
  isActive     = data.isActive;
  mode         = data.mode;
  allowedSites = data.allowedSites;
  blockedSites = data.blockedSites;

  toggle.checked = isActive;
  document.querySelector(`input[value="${mode}"]`).checked = true;
  updateStatusUI();
  updateModeUI();
  renderList();
  syncChips();
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function updateStatusUI() {
  if (isActive) {
    statusLabel.textContent = 'On';
    statusLabel.classList.add('on');
    footerMsg.textContent = 'Focus mode on';
  } else {
    statusLabel.textContent = 'Off';
    statusLabel.classList.remove('on');
    footerMsg.textContent = 'Ready to focus';
  }
}

function updateModeUI() {
  if (mode === 'allowlist') {
    listHeading.textContent  = 'Allowed Sites';
    emptyPrimary.textContent = 'No sites allowed yet.';
    emptySec.textContent     = 'All websites will be blocked.';
    quickAdd.hidden          = false;
  } else {
    listHeading.textContent  = 'Blocked Sites';
    emptyPrimary.textContent = 'No sites blocked yet.';
    emptySec.textContent     = 'All websites will be accessible.';
    quickAdd.hidden          = true;
  }
}

function showError(msg) {
  siteInput.classList.add('invalid');
  errorMsg.classList.remove('info');
  errorMsg.textContent = msg;
  errorMsg.hidden = false;
  setTimeout(clearError, 2200);
}

function showInfo(msg) {
  errorMsg.classList.add('info');
  errorMsg.textContent = msg;
  errorMsg.hidden = false;
  setTimeout(clearError, 2500);
}

function clearError() {
  siteInput.classList.remove('invalid');
  errorMsg.classList.remove('info');
  errorMsg.hidden = true;
  errorMsg.textContent = '';
}

// ── Toggle ────────────────────────────────────────────────────────────────────

toggle.addEventListener('change', async () => {
  isActive = toggle.checked;
  await chrome.storage.sync.set({ isActive });
  updateStatusUI();
});

// ── Mode selector ─────────────────────────────────────────────────────────────

document.querySelectorAll('input[name="mode"]').forEach(radio => {
  radio.addEventListener('change', async e => {
    mode = e.target.value;
    await chrome.storage.sync.set({ mode });
    updateModeUI();
    renderList();
    syncChips();
  });
});

// ── Allowlist/Blocklist CRUD ──────────────────────────────────────────────────

function normalizeDomain(raw) {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;

  const hasWildcard = trimmed.startsWith('*.');
  const base = hasWildcard ? trimmed.slice(2) : trimmed;
  const withoutProto = base.replace(/^https?:\/\//, '');
  const domain = withoutProto.split('/')[0].replace(/\.+$/, '');

  if (!/^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(domain)) return null;

  return hasWildcard ? `*.${domain}` : domain;
}

async function addSite(raw) {
  const domain = normalizeDomain(raw);
  if (!domain) { showError('Invalid domain — try: example.com'); return false; }
  if (activeList().includes(domain)) { showError('Already in list'); return false; }

  // If the site exists in the opposite list, remove it from there first
  const inOther = mode === 'allowlist' ? blockedSites.includes(domain) : allowedSites.includes(domain);
  if (inOther) {
    if (mode === 'allowlist') {
      blockedSites = blockedSites.filter(s => s !== domain);
      await chrome.storage.sync.set({ blockedSites });
    } else {
      allowedSites = allowedSites.filter(s => s !== domain);
      await chrome.storage.sync.set({ allowedSites });
    }
    showInfo(`Removed from your ${mode === 'allowlist' ? 'blocklist' : 'allowlist'}`);
  }

  const updated = [...activeList(), domain];
  if (mode === 'allowlist') allowedSites = updated; else blockedSites = updated;
  await chrome.storage.sync.set({ [activeKey()]: updated });
  renderList();
  syncChips();
  return true;
}

async function removeSite(domain) {
  const updated = activeList().filter(s => s !== domain);
  if (mode === 'allowlist') allowedSites = updated; else blockedSites = updated;
  await chrome.storage.sync.set({ [activeKey()]: updated });
  renderList();
  syncChips();
}

// ── Render list ───────────────────────────────────────────────────────────────

function renderList() {
  siteList.querySelectorAll('.site-item').forEach(el => el.remove());

  if (activeList().length === 0) {
    emptyState.hidden = false;
    return;
  }

  emptyState.hidden = true;

  activeList().forEach(domain => {
    const item = document.createElement('div');
    item.className = 'site-item';

    const label = document.createElement('span');
    label.className = 'site-domain';
    label.textContent = domain;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'site-remove';
    removeBtn.setAttribute('aria-label', `Remove ${domain}`);
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', () => removeSite(domain));

    item.appendChild(label);
    item.appendChild(removeBtn);
    siteList.appendChild(item);
  });
}

// ── Quick-add chips (allowlist mode only) ─────────────────────────────────────

function syncChips() {
  document.querySelectorAll('.chip').forEach(chip => {
    chip.classList.toggle('added', allowedSites.includes(chip.dataset.domain));
  });
}

document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', async () => {
    if (!allowedSites.includes(chip.dataset.domain)) {
      await addSite(chip.dataset.domain);
    }
  });
});

// ── Add button / Enter key ────────────────────────────────────────────────────

addBtn.addEventListener('click', async () => {
  const val = siteInput.value.trim();
  if (!val) return;
  const ok = await addSite(val);
  if (ok) { siteInput.value = ''; siteInput.focus(); }
});

siteInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') addBtn.click();
});

siteInput.addEventListener('input', clearError);

// ── Boot ──────────────────────────────────────────────────────────────────────

init();
