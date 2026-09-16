import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeQuery } from '../../lib/search-db.mjs';

test('sanitizeQuery keeps normal search terms intact', () => {
  assert.equal(sanitizeQuery('jason@example.com'), 'jason@example.com');
  assert.equal(sanitizeQuery('Acme Corp'), 'Acme Corp');
  assert.equal(sanitizeQuery('  trimmed  '), 'trimmed');
});

test('sanitizeQuery strips PostgREST .or() control chars (injection guard)', () => {
  // commas would add filter clauses; parens/asterisks are PostgREST operators
  assert.equal(sanitizeQuery('a,email.ilike.*@*'), 'aemail.ilike.@');
  assert.equal(sanitizeQuery('x),status.eq.paid,('), 'xstatus.eq.paid');
  assert.equal(sanitizeQuery('*%_'), '_');
  assert.ok(!sanitizeQuery('a,b(c)*').includes(','));
  assert.ok(!sanitizeQuery('a,b(c)*').includes('('));
  assert.ok(!sanitizeQuery('a,b(c)*').includes('*'));
});

test('sanitizeQuery caps length', () => {
  assert.equal(sanitizeQuery('a'.repeat(200)).length, 80);
});
