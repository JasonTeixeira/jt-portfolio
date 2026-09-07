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
    return { id: u.id, email: (u.email || '').toLowerCase() };
  } catch { return null; }
}

// The operator identity. ADMIN_EMAILS is a comma-separated allowlist (defaults to Jason's).
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'sage@sageideas.org,hello@sageideas.dev')
  .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
export function isAdminEmail(email) { return Boolean(email) && ADMIN_EMAILS.includes(String(email).toLowerCase()); }
