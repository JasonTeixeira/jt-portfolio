import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate } from '../../api/scope.js';

test('rejects missing prospectId or type', () => {
  assert.equal(validate({ type: 'started' }).ok, false);
  assert.equal(validate({ prospectId: 'a' }).ok, false);
});

test('accepts a well-formed event', () => {
  assert.equal(validate({ prospectId: 'a1b2', type: 'plan_built', plan: { keys: ['rag'] } }).ok, true);
});

test('rejects unknown event type', () => {
  assert.equal(validate({ prospectId: 'a', type: 'nope' }).ok, false);
});

test('accepts an event with no plan', () => {
  assert.equal(validate({ prospectId: 'a1b2', type: 'started' }).ok, true);
});

test('rejects a non-object plan', () => {
  assert.equal(validate({ prospectId: 'a1b2', type: 'plan_built', plan: 'nope' }).ok, false);
});

test('rejects a malformed email when present', () => {
  assert.equal(validate({ prospectId: 'a1b2', type: 'lead_captured', email: 'not-an-email' }).ok, false);
});

test('accepts a well-formed email when present', () => {
  assert.equal(validate({ prospectId: 'a1b2', type: 'lead_captured', email: 'a@b.com' }).ok, true);
});
