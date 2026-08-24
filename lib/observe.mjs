/**
 * Minimal, dependency-free error reporting to Sentry.
 *
 * Dormant until `SENTRY_DSN` is set — with no DSN, `captureError` is a no-op,
 * so nothing changes for the current deployment. Once the DSN env var exists,
 * unhandled errors in the API handlers get shipped to Sentry.
 *
 * Fire-and-forget by design: reporting never blocks the response and never
 * throws back into the request path. We don't pull in @sentry/node — a single
 * fetch to the store endpoint keeps the function bundle small and cold starts
 * fast.
 */

const TIMEOUT_MS = 1200;

// Light PII scrub so a raw provider error (e.g. a Stripe validation message
// that echoes a customer email) can't ship untouched to Sentry once a DSN is
// enabled on a payment endpoint. Not exhaustive — Sentry server-side scrubbing
// remains the belt to this suspenders.
export function scrubPii(s) {
  return String(s)
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[email]')
    .replace(/\b\d(?:[ -]?\d){12,18}\b/g, '[card]')
    .slice(0, 1000);
}

// Parse a DSN (https://<publicKey>@<host>/<projectId>) into the ingest URL
// and auth header. Returns null if the DSN is missing or malformed.
function parseDsn(dsn) {
  try {
    const u = new URL(dsn);
    const projectId = u.pathname.replace(/^\//, '');
    if (!u.username || !projectId) return null;
    return {
      storeUrl: `${u.protocol}//${u.host}/api/${projectId}/store/`,
      publicKey: u.username,
    };
  } catch (_) {
    return null;
  }
}

/**
 * Report an error to Sentry if configured. Never throws.
 * @param {unknown} err - the caught error.
 * @param {{ route?: string, [k: string]: unknown }} [context] - tags/extra.
 */
export function captureError(err, context = {}) {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return; // dormant

  const parsed = parseDsn(dsn);
  if (!parsed) return;

  const message = scrubPii(err instanceof Error ? err.message : String(err));
  const type = err instanceof Error ? err.name : 'Error';
  const event = {
    event_id: (globalThis.crypto?.randomUUID?.() || '').replace(/-/g, ''),
    timestamp: new Date().toISOString(),
    platform: 'node',
    level: 'error',
    logger: 'api',
    environment: process.env.VERCEL_ENV || 'production',
    release: process.env.VERCEL_GIT_COMMIT_SHA || undefined,
    tags: { route: context.route || 'unknown' },
    extra: context,
    exception: {
      values: [
        {
          type,
          value: message,
          stacktrace:
            err instanceof Error && err.stack
              ? { frames: [{ filename: 'api', function: err.stack.split('\n')[1]?.trim() }] }
              : undefined,
        },
      ],
    },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  // Fire-and-forget: swallow every failure, clear the timer regardless.
  fetch(parsed.storeUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Sentry-Auth': `Sentry sentry_version=7, sentry_client=sage-observe/1.0, sentry_key=${parsed.publicKey}`,
    },
    body: JSON.stringify(event),
    signal: controller.signal,
  })
    .catch(() => {})
    .finally(() => clearTimeout(timer));
}

/**
 * Wrap a serverless handler so any UNHANDLED throw is reported (dormant
 * without a DSN) and the client still gets a clean 500 instead of a raw
 * platform error. Handlers that catch their own errors are unaffected —
 * this only fires for what escapes them.
 * @param {string} route - stable route label for the Sentry tag.
 * @param {(req: any, res: any) => any} handler
 */
export function withObserve(route, handler) {
  return async function observed(req, res) {
    try {
      return await handler(req, res);
    } catch (err) {
      captureError(err, { route });
      console.error(`[${route}] unhandled`, err instanceof Error ? err.message : err);
      if (!res.headersSent) {
        return res.status(500).json({ ok: false, error: 'server_error' });
      }
    }
  };
}
