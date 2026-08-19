import { timingSafeEqual } from 'node:crypto';
const TOKEN = process.env.SCOPE_ADMIN_TOKEN;
export function checkToken(req) {
  if (!TOKEN) return false; // fail closed
  const got = String((req.headers && req.headers['x-admin-token']) || (req.query && req.query.key) || '');
  if (got.length !== TOKEN.length) return false;
  try { return timingSafeEqual(Buffer.from(got), Buffer.from(TOKEN)); } catch { return false; }
}
