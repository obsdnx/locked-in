/**
 * Returns true if the given URL matches any pattern in the allowlist.
 *
 * Supported pattern formats:
 *   example.com        — matches example.com and www.example.com
 *   *.example.com      — matches any subdomain of example.com
 *   docs.google.com    — exact subdomain match
 */
function isUrlAllowed(url, allowedSites) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();

    for (const raw of allowedSites) {
      const pattern = raw.toLowerCase().trim();
      if (!pattern) continue;

      if (pattern.startsWith('*.')) {
        const domain = pattern.slice(2);
        if (hostname === domain || hostname.endsWith('.' + domain)) return true;
        continue;
      }

      // Match exact hostname or www-prefixed variant
      if (hostname === pattern || hostname.endsWith('.' + pattern)) return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Normalizes a user-typed input into a canonical domain pattern.
 * Strips protocol, path, and trailing punctuation.
 * Returns null for invalid input.
 */
function normalizePattern(input) {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;

  const hasWildcard = trimmed.startsWith('*.');
  const base = hasWildcard ? trimmed.slice(2) : trimmed;
  const withoutProtocol = base.replace(/^https?:\/\//, '');
  const domain = withoutProtocol.split('/')[0].replace(/\.+$/, '');

  if (!isValidDomain(domain)) return null;

  return hasWildcard ? `*.${domain}` : domain;
}

function isValidDomain(domain) {
  return /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(domain);
}
