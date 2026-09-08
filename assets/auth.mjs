// Browser-side auth against Supabase Auth's REST API. No SDK/CDN — plain fetch.
// The URL + anon key are PUBLIC (safe to ship); all real authorization is enforced
// server-side by verifying the returned JWT.
const SUPA_URL = 'https://hocrntqhgvmeaxwlhzwl.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhvY3JudHFoZ3ZtZWF4d2xoendsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4NDQ2NDIsImV4cCI6MjA5MzQyMDY0Mn0.JIOiUMprrKENyBgkkHvwM1ZfZikS4NdA1HpsaQl2DNg';
const LS_KEY = 'jt_auth';
const H = { 'apikey': ANON, 'Content-Type': 'application/json' };

function saveSession(s) {
  if (s && s.access_token) localStorage.setItem(LS_KEY, JSON.stringify({ access_token: s.access_token, refresh_token: s.refresh_token, email: s.user && s.user.email, ts: Date.now() }));
}
export function getSession() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch { return null; }
}
export function clearSession() { localStorage.removeItem(LS_KEY); }

async function post(path, body, token) {
  const headers = { ...H };
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(`${SUPA_URL}/auth/v1${path}`, { method: 'POST', headers, body: JSON.stringify(body || {}) });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}

export async function signUp(email, password, redirectTo) {
  const r = await post(`/signup`, { email, password, options: redirectTo ? { email_redirect_to: redirectTo } : undefined });
  if (r.ok && r.data && r.data.access_token) saveSession(r.data);
  return r;
}
export async function signIn(email, password) {
  const r = await post(`/token?grant_type=password`, { email, password });
  if (r.ok && r.data && r.data.access_token) saveSession(r.data);
  return r;
}
export async function requestReset(email, redirectTo) {
  return post(`/recover`, { email, ...(redirectTo ? { options: { redirect_to: redirectTo } } : {}) });
}
// Signup-confirm + password-reset emails go through our own Resend-backed endpoint
// (Supabase's built-in mailer isn't configured). Always resolves; the endpoint answers
// generically so nothing about account existence leaks.
export async function sendAuthEmail(email, type) {
  try {
    const r = await fetch('/api/auth-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, type }) });
    return r.ok;
  } catch { return false; }
}
export async function updatePassword(accessToken, password) {
  const headers = { ...H, Authorization: `Bearer ${accessToken}` };
  const r = await fetch(`${SUPA_URL}/auth/v1/user`, { method: 'PUT', headers, body: JSON.stringify({ password }) });
  return { ok: r.ok, status: r.status, data: await r.json().catch(() => ({})) };
}
// Exchange the stored refresh_token for a fresh access token. Keeps a returning
// client logged in past the ~1h access-token expiry instead of bouncing them.
export async function refreshSession() {
  const s = getSession();
  if (!s || !s.refresh_token) return null;
  const r = await post(`/token?grant_type=refresh_token`, { refresh_token: s.refresh_token });
  if (r.ok && r.data && r.data.access_token) { saveSession(r.data); return r.data; }
  return null;
}
export async function currentUser() {
  const s = getSession();
  if (!s || !s.access_token) return null;
  let r = await fetch(`${SUPA_URL}/auth/v1/user`, { headers: { ...H, Authorization: `Bearer ${s.access_token}` } });
  if (r.status === 401 && s.refresh_token) {
    // access token expired — try the refresh token before giving up
    const refreshed = await refreshSession();
    if (refreshed && refreshed.access_token) {
      r = await fetch(`${SUPA_URL}/auth/v1/user`, { headers: { ...H, Authorization: `Bearer ${refreshed.access_token}` } });
    }
  }
  if (!r.ok) { if (r.status === 401) clearSession(); return null; }
  return r.json().catch(() => null);
}
export async function signOut() {
  const s = getSession();
  if (s && s.access_token) { try { await post(`/logout`, {}, s.access_token); } catch { /* ignore */ } }
  clearSession();
}

// Enhance any element with [data-auth-nav]: show Login/Sign up when logged out,
// Dashboard/Log out when logged in. Idempotent; safe to call on every page.
export function mountAuthNav(el) {
  if (!el) return;
  const s = getSession();
  el.innerHTML = '';
  const mk = (label, href, cls) => { const a = document.createElement('a'); a.textContent = label; a.href = href; a.className = cls || 'site-nav-link'; return a; };
  if (s && s.email) {
    el.appendChild(mk('Dashboard', 'dashboard.html'));
    const out = document.createElement('button'); out.type = 'button'; out.className = 'site-nav-link'; out.style.cssText = 'background:none;border:none;cursor:pointer;font:inherit;color:inherit'; out.textContent = 'Log out';
    out.addEventListener('click', async () => { await signOut(); location.href = 'index.html'; });
    el.appendChild(out);
  } else {
    el.appendChild(mk('Log in', 'login.html'));
    el.appendChild(mk('Sign up', 'signup.html', 'btn-solid green site-nav-cta'));
  }
}
