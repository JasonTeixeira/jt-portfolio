import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projectDisplayName } from '../../assets/scope-core.mjs';

test('projectDisplayName uses the lead capability name', () => {
  assert.equal(projectDisplayName({ keys: ['chatbot'] }), 'Conversational assistant');
});

test('projectDisplayName summarizes multiple capabilities', () => {
  assert.equal(projectDisplayName({ keys: ['llm-eval', 'ci-gate'] }), 'LLM evaluation harness + 1 more');
});

test('projectDisplayName falls back to the segment label, then a generic name', () => {
  assert.equal(projectDisplayName({ segment: 'ai-product' }), 'AI product / feature project');
  assert.equal(projectDisplayName({}), 'Your project');
  assert.equal(projectDisplayName(null), 'Your project');
});

test('projectDisplayName ignores unknown capability keys', () => {
  assert.equal(projectDisplayName({ keys: ['not-a-real-key'] }), 'Your project');
});
