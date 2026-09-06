// Pure (no-DOM) helpers for the client portal, so the security-critical bits are
// unit-testable in node. The DOM layer (portal.mjs) imports these.

// Classify a token as a safe, clickable link ONLY if it parses as an absolute
// http/https URL. Everything else (javascript:, data:, mailto:, file:, bare
// words, scheme-relative //host) returns null and is rendered as inert text.
// This is the sole gate that decides what becomes an <a href> in the portal.
export function classifyUrl(token) {
  try {
    const u = new URL(String(token));
    if (u.protocol === 'http:' || u.protocol === 'https:') {
      const display = (u.host + u.pathname + u.search).replace(/\/+$/, '') || u.host;
      return { href: u.href, display };
    }
  } catch {
    // not an absolute URL — treat as text
  }
  return null;
}

// Turn one deliverable line into ordered tokens: { type:'text', text } or
// { type:'link', href, text }. Whitespace is preserved as text tokens so the
// rebuilt line reads exactly as the operator wrote it, just with any http(s)
// URL turned into a link. Trailing sentence punctuation on a URL is peeled off
// and kept as text so "see https://x.co/y." doesn't swallow the period.
export function deliverableTokens(line) {
  const parts = String(line == null ? '' : line).split(/(\s+)/).filter((p) => p !== '');
  const tokens = [];
  let hasLink = false;
  for (const p of parts) {
    // Peel trailing sentence punctuation so "see https://x.co/y." doesn't swallow
    // the period. Tradeoff: a URL that legitimately ends in one of these chars
    // (rare) loses it — acceptable since deliverable text is operator-authored.
    const stripped = p.replace(/[)\].,;!?]+$/, '');
    const trail = p.slice(stripped.length);
    const u = classifyUrl(stripped);
    if (u) {
      tokens.push({ type: 'link', href: u.href, text: u.display });
      if (trail) tokens.push({ type: 'text', text: trail });
      hasLink = true;
    } else {
      tokens.push({ type: 'text', text: p });
    }
  }
  return { tokens, hasLink };
}
