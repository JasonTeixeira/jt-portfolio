/**
 * Shared rate limiter for the API endpoints.
 *
 * Two backends, chosen at call time by whether Upstash is configured:
 *  - DURABLE (production): Upstash Redis REST, a fixed-window counter that is
 *    shared across every serverless instance. Survives cold starts, so a
 *    burst can't reset its own counter by landing on a fresh instance.
 *  - IN-MEMORY (fallback): a per-instance sliding window — the exact behavior
 *    the endpoints had before, best-effort and reset on cold start.
 *
 * The endpoint just calls `await rateLimited(ip, max, 'chat')` and treats a
 * truthy result as "over the limit → 429". Same boolean sense as the old
 * local `throttled()` helpers, so wiring is a one-line swap per endpoint.
 *
 * Degrade-safe: if Upstash is configured but erroring or slow, we fall back
 * to the in-memory limiter rather than failing open (some protection beats
 * none) and never throw into the request path.
 */

const WINDOW_MS = 60_000;
const UPSTASH_TIMEOUT_MS = 800; // never add more than this to a request

// ── in-memory sliding window (fallback + pre-config behavior) ──────────────
const mem = new Map();
function memLimited(memKey, max, windowMs) {
  const now = Date.now();
  const arr = (mem.get(memKey) || []).filter((t) => now - t < windowMs);
  arr.push(now);
  mem.set(memKey, arr);
  return arr.length > max;
}

// Opportunistic sweep so the Map can't grow unbounded on a long-lived instance.
function sweep(windowMs) {
  if (mem.size < 5000) return;
  const now = Date.now();
  for (const [k, arr] of mem) {
    const live = arr.filter((t) => now - t < windowMs);
    if (live.length) mem.set(k, live);
    else mem.delete(k);
  }
}

// ── durable fixed window via Upstash Redis REST ────────────────────────────
async function upstashLimited(url, token, memKey, max, windowMs) {
  // Fixed window: a caller can burst up to ~2x `max` across a window boundary
  // (max at the end of one bucket, max at the start of the next). Accepted
  // tradeoff vs. sliding-window complexity — this is abuse/cost protection,
  // not a precise quota, and the caps are set with headroom for that.
  const bucket = Math.floor(Date.now() / windowMs);
  const redisKey = `rl:${memKey}:${bucket}`;
  const ttl = Math.ceil(windowMs / 1000) + 1;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTASH_TIMEOUT_MS);
  try {
    const resp = await fetch(`${url.replace(/\/$/, '')}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', redisKey],
        ['EXPIRE', redisKey, ttl],
      ]),
      signal: controller.signal,
    });
    if (!resp.ok) throw new Error(`upstash ${resp.status}`);
    const out = await resp.json();
    const count = Number(out?.[0]?.result);
    if (!Number.isFinite(count)) throw new Error('upstash bad response');
    return count > max;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {string} key - caller identity (usually client IP).
 * @param {number} max - max requests allowed per window (inclusive).
 * @param {string} prefix - per-endpoint namespace, e.g. 'chat'.
 * @param {number} [windowMs] - window length; defaults to 60s.
 * @returns {Promise<boolean>} true when the caller is OVER the limit.
 */
export async function rateLimited(key, max, prefix, windowMs = WINDOW_MS) {
  const memKey = `${prefix}:${key || 'unknown'}`;
  sweep(windowMs);

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    try {
      return await upstashLimited(url, token, memKey, max, windowMs);
    } catch (_) {
      // Redis hiccup, timeout, or misconfig → still enforce something.
      return memLimited(memKey, max, windowMs);
    }
  }
  return memLimited(memKey, max, windowMs);
}

// IPv4/IPv6 characters only, bounded length. IPv6 maxes at 45 chars.
const IP_SHAPE = /^[0-9a-fA-F:.]{3,45}$/;

/**
 * Pull the client IP off a request, validated and length-bounded so a
 * malformed header can never bloat a Redis/Map key.
 *
 * Trust note: on Vercel, `x-forwarded-for` is OVERWRITTEN at the edge with the
 * true client IP and client-supplied values are NOT forwarded — spoofing
 * protection is on by default (per Vercel request-headers docs), disabled only
 * for Enterprise "trusted proxy", which is not enabled here. So the first hop
 * is the real client on this platform, not an attacker-controlled value.
 */
export function clientIp(req) {
  const raw = (
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.headers['x-real-ip'] ||
    ''
  ).slice(0, 45);
  return IP_SHAPE.test(raw) ? raw : 'unknown';
}
