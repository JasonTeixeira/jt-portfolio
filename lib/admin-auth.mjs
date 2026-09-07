import { timingSafeEqual } from 'node:crypto';
import { userFromRequest, isAdminEmail } from './auth-user.mjs';
const TOKEN = process.env.SCOPE_ADMIN_TOKEN;
export function checkToken(req) {
  if (!TOKEN) return false; // fail closed
  const got = String((req.headers && req.headers['x-admin-token']) || (req.query && req.query.key) || '');
  if (got.length !== TOKEN.length) return false;
  try { return timingSafeEqual(Buffer.from(got), Buffer.from(TOKEN)); } catch { return false; }
}

// Admin access = the break-glass token (x-admin-token / ?key) OR a logged-in operator
// (a valid Supabase JWT whose confirmed email is on the ADMIN_EMAILS allowlist).
export async function authorizeAdmin(req) {
  if (checkToken(req)) return true;
  const u = await userFromRequest(req);
  return Boolean(u && isAdminEmail(u.email));
}
