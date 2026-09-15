import { test } from 'node:test';
import assert from 'node:assert/strict';

// The session helpers key off an env secret; set one before importing.
process.env.PORTAL_SESSION_SECRET = 'test-secret-for-portal-sessions-0123456789';
const { signSession, verifySession, maskEmail } = await import('../../lib/portal-session.mjs');

test('signSession → verifySession round-trips for the same token', () => {
  const s = signSession('tokenABC');
  assert.ok(s, 'a session string is produced');
  assert.equal(verifySession('tokenABC', s), true);
});

test('a session is bound to its token (cannot be replayed on another project)', () => {
  const s = signSession('tokenABC');
  assert.equal(verifySession('tokenXYZ', s), false);
});

test('a tampered mac fails', () => {
  const s = signSession('tokenABC');
  const tampered = s.slice(0, -1) + (s.endsWith('a') ? 'b' : 'a');
  assert.equal(verifySession('tokenABC', tampered), false);
});

test('an expired session fails', () => {
  // hand-craft an already-expired exp with a valid-looking (but wrong) mac — must fail on both counts
  assert.equal(verifySession('tokenABC', `${Date.now() - 1000}.deadbeef`), false);
});

test('garbage / missing session fails closed', () => {
  assert.equal(verifySession('tokenABC', ''), false);
  assert.equal(verifySession('tokenABC', 'nope'), false);
  assert.equal(verifySession('tokenABC', undefined), false);
  assert.equal(verifySession('', signSession('x')), false);
});

test('no secret → cannot sign or verify (fails closed)', () => {
  // key() reads env at call time, so just clear the sources and call the same module.
  const saved = { p: process.env.PORTAL_SESSION_SECRET, a: process.env.SCOPE_ADMIN_TOKEN, s: process.env.SUPABASE_SERVICE_KEY };
  delete process.env.PORTAL_SESSION_SECRET; delete process.env.SCOPE_ADMIN_TOKEN; delete process.env.SUPABASE_SERVICE_KEY;
  try {
    assert.equal(signSession('t'), null);
    assert.equal(verifySession('t', 'anything'), false);
  } finally {
    if (saved.p) process.env.PORTAL_SESSION_SECRET = saved.p;
    if (saved.a) process.env.SCOPE_ADMIN_TOKEN = saved.a;
    if (saved.s) process.env.SUPABASE_SERVICE_KEY = saved.s;
  }
});

test('maskEmail hides the local part but keeps the domain', () => {
  assert.equal(maskEmail('jason@example.com'), 'j••••@example.com');
  assert.equal(maskEmail('a@b.co'), 'a•@b.co'); // single-char local → head + one bullet
  assert.equal(maskEmail('not-an-email'), null);
  assert.equal(maskEmail(null), null);
});
