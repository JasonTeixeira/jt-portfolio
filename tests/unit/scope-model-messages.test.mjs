import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scopeModelMessages } from '../../api/chat.js';

test('wraps assistant turns as JSON, leaves user turns untouched', () => {
  const out = scopeModelMessages([
    { role: 'user', content: 'we have no evals' },
    { role: 'assistant', content: 'What kind of chatbot is it?' },
    { role: 'user', content: 'a support bot' },
  ]);
  assert.equal(out[0].content, 'we have no evals');
  assert.deepEqual(JSON.parse(out[1].content), { reply: 'What kind of chatbot is it?' });
  assert.equal(out[2].role, 'user');
  assert.equal(out[2].content, 'a support bot');
});

test('non-string assistant content becomes an empty reply, never throws', () => {
  const out = scopeModelMessages([{ role: 'assistant', content: null }]);
  assert.deepEqual(JSON.parse(out[0].content), { reply: '' });
});

test('non-array input is safe', () => {
  assert.deepEqual(scopeModelMessages(null), []);
});
