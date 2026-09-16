import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fromHeader } from '../../lib/notify.mjs';

// fromHeader reads RESEND_FROM at call time, so we can exercise both shapes deterministically.
test('a full "Name <email>" RESEND_FROM is used as-is (no double-wrap) — the prod bug', () => {
  const prev = process.env.RESEND_FROM;
  process.env.RESEND_FROM = 'Jason Teixeira <hello@sageideas.dev>';
  try {
    assert.equal(fromHeader('Scope Studio'), 'Jason Teixeira <hello@sageideas.dev>');
    assert.equal(fromHeader('Jason Teixeira'), 'Jason Teixeira <hello@sageideas.dev>');
    assert.notEqual(fromHeader('Jason Teixeira'), 'Jason Teixeira <Jason Teixeira <hello@sageideas.dev>>');
  } finally { process.env.RESEND_FROM = prev; }
});

test('a bare-address RESEND_FROM still gets the display name added', () => {
  const prev = process.env.RESEND_FROM;
  process.env.RESEND_FROM = 'hello@sageideas.dev';
  try {
    assert.equal(fromHeader('Jason Teixeira'), 'Jason Teixeira <hello@sageideas.dev>');
    assert.equal(fromHeader('Scope Studio'), 'Scope Studio <hello@sageideas.dev>');
  } finally { process.env.RESEND_FROM = prev; }
});
