// Verify a Supabase Auth JWT server-side by asking Supabase who it belongs to.
// (No JWT-secret handling here; we let Supabase validate the token.) Returns the
// authenticated user's {id, email} or null. Anon key is public.
const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhvY3JudHFoZ3ZtZWF4d2xoendsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4NDQ2NDIsImV4cCI6MjA5MzQyMDY0Mn0.JIOiUMprrKENyBgkkHvwM1ZfZikS4NdA1HpsaQl2DNg';

export function authEnabled() { return Boolean(URL); }

function bearer(req) {
  const h = (req.headers && (req.headers.authorization || req.headers.Authorization)) || '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : '';
}

// Read the `aal` (assurance level: 'aal1' | 'aal2') from a JWT.
//
// SECURITY INVARIANT — this is DECODE-ONLY (no signature check). It returns whatever the
// payload claims, including an attacker-tampered value. It is ONLY safe to trust the result
// when called with a token that has ALREADY been proven valid by the /auth/v1/user
// round-trip (which verifies the signature server-side). userFromRequest() is the only
// caller and enforces this: it rejects (returns null) on a non-200 /user response BEFORE
// this runs, and passes the exact same token string it validated. Do not call this on an
// unvalidated token, and do not read `aal` from any other source.
export function aalFromToken(token) {
  try {
    const payload = String(token).split('.')[1];
    if (!payload) return null;
    const json = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    return json && typeof json.aal === 'string' ? json.aal : null;
  } catch { return null; }
}

export async function userFromRequest(req) {
  const token = bearer(req);
  if (!token || !URL) return null;
  try {
    const r = await fetch(`${URL}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } });
    if (!r.ok) return null;
    const u = await r.json().catch(() => null);
    if (!u || !u.id) return null;
    // Only trust an email that Supabase says is CONFIRMED — otherwise a signup as
    // victim@realclient.com could read that client's projects. Defense-in-depth on top
    // of the project's "Confirm email" setting (which must also be ON).
    const confirmed = Boolean(u.email_confirmed_at || u.confirmed_at);
    if (!confirmed) return null;
    return { id: u.id, email: (u.email || '').toLowerCase(), aal: aalFromToken(token) };
  } catch { return null; }
}

// Decode-only email from a JWT payload (no signature check) — same caveat as aalFromToken:
// only trust it for a token already validated by the /auth/v1/user round-trip. Used to label
// audit rows with the acting operator without a second network call.
export function emailFromToken(token) {
  try {
    const payload = String(token).split('.')[1];
    if (!payload) return null;
    const json = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    return json && typeof json.email === 'string' ? json.email.toLowerCase() : null;
  } catch { return null; }
}

// The operator identity. ADMIN_EMAILS is a comma-separated allowlist (defaults to Jason's).
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'sage@sageideas.org,hello@sageideas.dev')
  .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
export function isAdminEmail(email) { return Boolean(email) && ADMIN_EMAILS.includes(String(email).toLowerCase()); }
