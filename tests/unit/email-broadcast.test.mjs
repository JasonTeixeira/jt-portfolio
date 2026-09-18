import { test } from 'node:test';
import assert from 'node:assert/strict';
import { broadcastEmail } from '../../lib/email-templates.mjs';

test('broadcastEmail escapes body content (no markup injection)', () => {
  const m = broadcastEmail({ subject: 'Hi', heading: 'Hi', bodyText: 'Hello <script>alert(1)</script> and <b>bold</b>', unsubscribeUrl: 'https://x.co/api/unsubscribe?token=t' });
  assert.ok(m.html.includes('&lt;script&gt;'), 'script tag escaped');
  assert.ok(!m.html.includes('<script>alert'), 'no live script tag');
  assert.ok(m.html.includes('&lt;b&gt;bold'), 'user b tag escaped, not rendered');
});

test('broadcastEmail includes a visible unsubscribe link + List-Unsubscribe header', () => {
  const url = 'https://agency.sageideas.dev/api/unsubscribe?token=abc123';
  const m = broadcastEmail({ subject: 'S', heading: 'H', bodyText: 'body', unsubscribeUrl: url });
  assert.ok(m.html.includes(url), 'unsub link in html');
  assert.ok(m.text.includes(url), 'unsub link in text');
  assert.equal(m.headers['List-Unsubscribe'], `<${url}>`);
  assert.equal(m.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
});

test('broadcastEmail renders paragraphs from blank-line breaks', () => {
  const m = broadcastEmail({ subject: 'S', heading: 'H', bodyText: 'Para one.\n\nPara two.', unsubscribeUrl: 'https://x.co/u?token=t' });
  const paraCount = (m.html.match(/font-size:15px;line-height:1\.6/g) || []).length;
  assert.equal(paraCount, 2, 'two paragraphs rendered');
});

test('broadcastEmail only renders an http(s) CTA (no javascript: URIs)', () => {
  const bad = broadcastEmail({ subject: 'S', heading: 'H', bodyText: 'b', ctaLabel: 'Go', ctaUrl: 'javascript:alert(1)', unsubscribeUrl: 'https://x.co/u?token=t' });
  assert.ok(!bad.html.includes('javascript:'), 'javascript: CTA rejected');
  const good = broadcastEmail({ subject: 'S', heading: 'H', bodyText: 'b', ctaLabel: 'Go', ctaUrl: 'https://x.co/learn', unsubscribeUrl: 'https://x.co/u?token=t' });
  assert.ok(good.html.includes('https://x.co/learn'), 'http CTA rendered');
});

test('broadcastEmail omits List-Unsubscribe header when no unsub url', () => {
  const m = broadcastEmail({ subject: 'S', heading: 'H', bodyText: 'b' });
  assert.equal(m.headers, undefined);
});

// CAN-SPAM §5 requires a physical postal address in every commercial email.
test('broadcastEmail includes a physical postal address (CAN-SPAM)', () => {
  const m = broadcastEmail({ subject: 'S', heading: 'H', bodyText: 'b', unsubscribeUrl: 'https://x.co/u?token=t' });
  assert.ok(m.html.includes('Orlando, FL'), 'postal address present in html');
  assert.ok(m.text.includes('Orlando, FL'), 'postal address present in text');
  assert.ok(m.html.includes('Sage Ideas LLC'), 'legal entity present in html');
});
