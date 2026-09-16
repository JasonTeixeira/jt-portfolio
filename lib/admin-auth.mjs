import { timingSafeEqual } from 'node:crypto';
import { userFromRequest, isAdminEmail } from './auth-user.mjs';
const TOKEN = process.env.SCOPE_ADMIN_TOKEN;
// Optional: once the operator has enrolled TOTP, flip ADMIN_REQUIRE_MFA=true to require an
// aal2 (MFA-elevated) session for all JWT-based admin access. Default OFF so enabling MFA
// never locks anyone out mid-flight; the break-glass ?key token always bypasses (recovery
// path if the authenticator device is lost).
const REQUIRE_MFA = /^(1|true|yes)$/i.test(String(process.env.ADMIN_REQUIRE_MFA || ''));
export function checkToken(req) {
  if (!TOKEN) return false; // fail closed
  const got = String((req.headers && req.headers['x-admin-token']) || (req.query && req.query.key) || '');
  if (got.length !== TOKEN.length) return false;
  try { return timingSafeEqual(Buffer.from(got), Buffer.from(TOKEN)); } catch { return false; }
}

// Admin access = the break-glass token (x-admin-token / ?key) OR a logged-in operator
// (a valid Supabase JWT whose confirmed email is on the ADMIN_EMAILS allowlist).
export async function authorizeAdmin(req) {
  if (checkToken(req)) return true; // break-glass token — bypasses MFA (device-loss recovery)
  const u = await userFromRequest(req);
  if (!u || !isAdminEmail(u.email)) return false;
  if (REQUIRE_MFA && u.aal !== 'aal2') return false; // enrolled operator must present MFA
  return true;
}
