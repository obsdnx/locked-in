// ── State ─────────────────────────────────────────────────────────────────────

let isActive = false;
let allowedSites = [];

// ── DOM refs ──────────────────────────────────────────────────────────────────

const toggle      = document.getElementById('main-toggle');
const statusLabel = document.getElementById('status-label');
const siteInput   = document.getElementById('site-input');
const addBtn      = document.getElementById('add-btn');
const siteList    = document.getElementById('site-list');
const emptyState  = document.getElementById('empty-state');
const errorMsg    = document.getElementById('error-msg');
const footerMsg   = document.getElementById('footer-msg');

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  const data = await chrome.storage.sync.get({ isActive: false, allowedSites: [] });
  isActive     = data.isActive;
  allowedSites = data.allowedSites;

  toggle.checked = isActive;
  updateStatusUI();
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

function showError(msg) {
  siteInput.classList.add('invalid');
  errorMsg.textContent = msg;
  errorMsg.hidden = false;
  setTimeout(clearError, 2200);
}

function clearError() {
  siteInput.classList.remove('invalid');
  errorMsg.hidden = true;
  errorMsg.textContent = '';
}

// ── Toggle ────────────────────────────────────────────────────────────────────

toggle.addEventListener('change', async () => {
  isActive = toggle.checked;
  await chrome.storage.sync.set({ isActive });
  updateStatusUI();
});

// ── Allowlist CRUD ────────────────────────────────────────────────────────────

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
  if (allowedSites.includes(domain)) { showError('Already in allowlist'); return false; }

  allowedSites = [...allowedSites, domain];
  await chrome.storage.sync.set({ allowedSites });
  renderList();
  syncChips();
  return true;
}

async function removeSite(domain) {
  allowedSites = allowedSites.filter(s => s !== domain);
  await chrome.storage.sync.set({ allowedSites });
  renderList();
  syncChips();
}

// ── Render list ───────────────────────────────────────────────────────────────

function renderList() {
  // Remove existing items only
  siteList.querySelectorAll('.site-item').forEach(el => el.remove());

  if (allowedSites.length === 0) {
    emptyState.hidden = false;
    return;
  }

  emptyState.hidden = true;

  allowedSites.forEach(domain => {
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

// ── Quick-add chips ───────────────────────────────────────────────────────────

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
