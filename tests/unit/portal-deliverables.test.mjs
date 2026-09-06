import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyUrl, deliverableTokens } from '../../assets/portal-core.mjs';

test('classifyUrl accepts http/https and normalizes a readable display', () => {
  assert.deepEqual(classifyUrl('https://loom.com/share/abc'), { href: 'https://loom.com/share/abc', display: 'loom.com/share/abc' });
  assert.equal(classifyUrl('http://example.com/').display, 'example.com');
  assert.equal(classifyUrl('HTTPS://Example.com/Report').href, 'https://example.com/Report');
});

test('classifyUrl rejects every non-http(s) scheme (the XSS gate)', () => {
  for (const bad of [
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    'mailto:x@y.co',
    '//evil.com/x',        // scheme-relative, not absolute -> not linkable
    'ftp://host/x',
    'not a url',
    '',
  ]) {
    assert.equal(classifyUrl(bad), null, `must reject: ${bad}`);
  }
});

test('deliverableTokens linkifies a labelled URL and keeps the label as text', () => {
  const { tokens, hasLink } = deliverableTokens('Loom walkthrough — https://loom.com/share/abc');
  assert.equal(hasLink, true);
  const link = tokens.find((t) => t.type === 'link');
  assert.equal(link.href, 'https://loom.com/share/abc');
  assert.ok(tokens.some((t) => t.type === 'text' && t.text.includes('Loom')));
});

test('deliverableTokens leaves a plain line with no URL entirely as text', () => {
  const { tokens, hasLink } = deliverableTokens('Custom chatbot integration, 2 weeks');
  assert.equal(hasLink, false);
  assert.ok(tokens.every((t) => t.type === 'text'));
});

test('deliverableTokens peels trailing punctuation off a URL', () => {
  const { tokens } = deliverableTokens('See the report at https://example.com/r.');
  const link = tokens.find((t) => t.type === 'link');
  assert.equal(link.href, 'https://example.com/r');
  // the trailing period survives as its own text token
  assert.ok(tokens.some((t) => t.type === 'text' && t.text === '.'));
});

test('deliverableTokens does NOT linkify a javascript: token even mid-line', () => {
  const { tokens, hasLink } = deliverableTokens('click javascript:alert(1) now');
  assert.equal(hasLink, false);
  assert.ok(tokens.every((t) => t.type === 'text'));
});
