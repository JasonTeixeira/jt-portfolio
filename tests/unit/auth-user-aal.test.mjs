import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aalFromToken } from '../../lib/auth-user.mjs';

// Build a JWT-shaped string (header.payload.sig) with a base64url payload — aalFromToken
// only decodes the claim, it does NOT verify the signature (the token is already proven
// valid by the /auth/v1/user round-trip before this is called).
function jwt(claims) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(claims)}.sig`;
}

test('aalFromToken reads aal2 (MFA-elevated) and aal1', () => {
  assert.equal(aalFromToken(jwt({ sub: 'u1', aal: 'aal2' })), 'aal2');
  assert.equal(aalFromToken(jwt({ sub: 'u1', aal: 'aal1' })), 'aal1');
});

test('aalFromToken returns null when the claim is absent or the token is malformed', () => {
  assert.equal(aalFromToken(jwt({ sub: 'u1' })), null);
  assert.equal(aalFromToken('not-a-jwt'), null);
  assert.equal(aalFromToken(''), null);
  assert.equal(aalFromToken(null), null);
  assert.equal(aalFromToken('a.b'), null); // 'b' is not valid base64 JSON → null
});

test('aalFromToken tolerates base64url padding variations', () => {
  // a payload whose base64 length is not a multiple of 4 must still decode
  const t = aalFromToken(jwt({ aal: 'aal2', extra: 'x' }));
  assert.equal(t, 'aal2');
});
