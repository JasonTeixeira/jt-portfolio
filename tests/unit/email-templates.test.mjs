import { test } from 'node:test';
import assert from 'node:assert/strict';
import { invoiceEmail, receiptEmail, resetEmail, confirmEmail, contractEmail, messageEmail, proposalReadyEmail } from '../../lib/email-templates.mjs';

test('every builder returns subject + text + html with the link present', () => {
  const link = 'https://agency.sageideas.dev/portal.html?id=TOKEN123';
  const builds = [
    invoiceEmail({ invoiceNo: 1001, amountCents: 70000, kind: 'balance', link }),
    receiptEmail({ kind: 'deposit', amountCents: 30000, totalCents: 70000, link }),
    receiptEmail({ kind: 'balance', amountCents: 70000, totalCents: 100000, link }),
    resetEmail({ link }),
    confirmEmail({ link }),
    contractEmail({ link }),
    messageEmail({ body: 'hello there', link }),
    proposalReadyEmail({ link, depositCents: 30000 }),
  ];
  for (const b of builds) {
    assert.ok(b.subject && typeof b.subject === 'string', 'has subject');
    assert.ok(b.text.includes(link), 'text carries the link');
    assert.ok(b.html.includes(link), 'html carries the link');
    assert.ok(b.html.startsWith('<!doctype html>'), 'html is a full document');
  }
});

test('invoiceEmail shows the money amount and invoice number', () => {
  const b = invoiceEmail({ invoiceNo: 1042, amountCents: 149900, kind: 'balance', link: 'https://x' });
  assert.match(b.subject, /INV-1042/);
  assert.match(b.html, /\$1,499/);
  assert.match(b.text, /\$1,499/);
});

test('messageEmail ESCAPES client-authored content in the HTML (no XSS)', () => {
  const b = messageEmail({ body: '<script>alert(1)</script>&"hi"', link: 'https://x' });
  assert.ok(!b.html.includes('<script>alert(1)'), 'raw script tag must not appear');
  assert.match(b.html, /&lt;script&gt;/, 'angle brackets are escaped');
  assert.match(b.html, /&amp;/, 'ampersand is escaped');
});

test('a malicious link cannot break out of the href attribute', () => {
  const b = resetEmail({ link: 'https://x"><script>alert(1)</script>' });
  assert.ok(!b.html.includes('"><script>'), 'quote/bracket in URL is escaped');
  assert.match(b.html, /&quot;&gt;&lt;script&gt;/);
});

test('receiptEmail distinguishes deposit vs paid-in-full', () => {
  const dep = receiptEmail({ kind: 'deposit', amountCents: 30000, totalCents: 70000, link: 'https://x' });
  assert.match(dep.subject, /Deposit received/);
  const full = receiptEmail({ kind: 'balance', amountCents: 70000, totalCents: 100000, link: 'https://x' });
  assert.match(full.subject, /paid in full/i);
});
