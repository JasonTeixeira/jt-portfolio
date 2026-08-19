import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate } from '../../api/lead.js';

test('rejects a missing email', () => {
  assert.equal(validate({}).ok, false);
});

test('rejects a malformed email', () => {
  assert.equal(validate({ email: 'not-an-email' }).ok, false);
});

test('accepts a well-formed email with no prospectId or plan (existing behavior)', () => {
  assert.equal(validate({ email: 'lead@company.com' }).ok, true);
});

test('accepts a well-formed email with prospectId and plan', () => {
  const r = validate({
    email: 'lead@company.com',
    prospectId: 'a1b2',
    plan: { keys: ['rag'], segment: 'ai-product', total: [4000, 8000] },
  });
  assert.equal(r.ok, true);
});

test('rejects a non-string, non-empty prospectId', () => {
  assert.equal(validate({ email: 'lead@company.com', prospectId: 42 }).ok, false);
});

test('rejects a blank prospectId', () => {
  assert.equal(validate({ email: 'lead@company.com', prospectId: '   ' }).ok, false);
});

test('rejects a non-object plan', () => {
  assert.equal(validate({ email: 'lead@company.com', prospectId: 'a1b2', plan: 'nope' }).ok, false);
});

test('rejects an array plan', () => {
  assert.equal(validate({ email: 'lead@company.com', prospectId: 'a1b2', plan: [] }).ok, false);
});

test('rejects a bad request shape', () => {
  assert.equal(validate(null).ok, false);
  assert.equal(validate('x').ok, false);
  assert.equal(validate([]).ok, false);
});
