/**
 * /api/gtm — operator weekly GTM tracker (admin-gated). Replaces ops.html localStorage.
 *   GET               → { weeks: [{week_of, data, updated_at}] }  (most recent first)
 *   POST { week_of, data } → upsert one week's scoreboard blob
 * Operator-private; never exposed to the client portal.
 */
import { rateLimited, clientIp } from '../lib/ratelimit.mjs';
import { withObserve } from '../lib/observe.mjs';
import { authorizeAdmin } from '../lib/admin-auth.mjs';
import { isEnabled, recentWeeks, upsertWeek, normalizeWeek } from '../lib/gtm-db.mjs';

// The scoreboard blob is operator-authored, but we still bound it so a bug or paste
// can't write an unbounded row. Metrics: <=32 short string values; retro: <=8k; evals:
// <=100 short rows. Anything unexpected is dropped, never persisted raw.
function sanitizeData(input) {
  const src = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const metrics = {};
  const m = src.metrics && typeof src.metrics === 'object' && !Array.isArray(src.metrics) ? src.metrics : {};
  for (const k of Object.keys(m).slice(0, 32)) metrics[String(k).slice(0, 40)] = String(m[k] ?? '').slice(0, 40);
  const retro = String(src.retro ?? '').slice(0, 8000);
  const evals = Array.isArray(src.evals) ? src.evals.slice(0, 100).map((e) => ({
    target: String((e && e.target) ?? '').slice(0, 120),
    url: String((e && e.url) ?? '').slice(0, 300),
    status: String((e && e.status) ?? '').slice(0, 24),
  })) : [];
  return { metrics, retro, evals };
}

async function handler(req, res) {
  if (await rateLimited(clientIp(req), 60, 'admin')) return res.status(429).json({ ok: false, error: 'slow_down' });
  if (!(await authorizeAdmin(req))) return res.status(401).json({ ok: false, error: 'unauthorized' });
  if (!isEnabled()) return res.status(200).json({ ok: false, skipped: true, weeks: [] });

  if (req.method === 'GET') {
    const r = await recentWeeks(12);
    if (!r.ok) return res.status(502).json({ ok: false, error: 'gtm_unavailable' });
    return res.status(200).json({ ok: true, weeks: r.data });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const week = normalizeWeek(body.week_of);
    if (!week) return res.status(400).json({ ok: false, error: 'invalid week_of' });
    const r = await upsertWeek(week, sanitizeData(body.data));
    if (!r.ok) { console.error('[gtm] upsert failed', r.error); return res.status(400).json({ ok: false, error: 'save_failed' }); }
    return res.status(200).json({ ok: true, week: r.data });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ ok: false, error: 'method not allowed' });
}

export default withObserve('/api/gtm', handler);
