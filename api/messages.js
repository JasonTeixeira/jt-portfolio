/**
 * /api/messages — operator side of the client<->operator project thread (token-gated).
 *
 *   GET  ?projectId=<uuid>  → { messages: [...] }  (also marks client messages read)
 *   POST { projectId, body } → operator posts a message; emails the client a portal link
 *
 * The client side of the same thread lives in /api/portal (action:'message'). Sender is
 * set here to 'operator' — never taken from the request body.
 */
import { rateLimited, clientIp } from '../lib/ratelimit.mjs';
import { withObserve } from '../lib/observe.mjs';
import { checkToken } from '../lib/admin-auth.mjs';
import {
  isEnabled, listMessages, addMessage, markMessagesRead, getProjectById, ensurePortalToken,
} from '../lib/portal-db.mjs';
import { getProposalById } from '../lib/proposal-db.mjs';
import { sendClient } from '../lib/notify.mjs';

const SITE = process.env.SITE_URL || 'https://agency.sageideas.dev';

async function handler(req, res) {
  if (await rateLimited(clientIp(req), 60, 'admin')) return res.status(429).json({ ok: false, error: 'slow_down' });
  if (!checkToken(req)) return res.status(401).json({ ok: false, error: 'unauthorized' });
  if (!isEnabled()) return res.status(200).json({ ok: false, skipped: true, messages: [] });

  if (req.method === 'GET') {
    const projectId = String(req.query.projectId || '');
    if (!projectId) return res.status(400).json({ ok: false, error: 'projectId required' });
    const r = await listMessages(projectId);
    markMessagesRead(projectId, 'operator').catch(() => {});
    return res.status(200).json({ ok: true, messages: r.ok ? r.data : [] });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const projectId = String(body.projectId || '');
    const text = typeof body.body === 'string' ? body.body.trim() : '';
    if (!projectId) return res.status(400).json({ ok: false, error: 'projectId required' });
    if (text.length < 1 || text.length > 5000) return res.status(400).json({ ok: false, error: 'message required' });
    const sent = await addMessage(projectId, 'operator', text);
    if (!sent.ok) { console.error('[messages] addMessage failed', sent.error || ''); return res.status(200).json({ ok: false, reason: 'write_failed' }); }
    // email the client a nudge + their portal link (best-effort; never blocks the reply)
    try {
      const projR = await getProjectById(projectId);
      const proposal = projR.ok && projR.data ? await getProposalById(projR.data.proposal_id) : null;
      const email = proposal && proposal.ok && proposal.data ? proposal.data.client_email : null;
      if (email) {
        const tok = await ensurePortalToken(projectId);
        const link = tok.ok && tok.token ? `${SITE}/portal.html?id=${tok.token}` : `${SITE}`;
        await sendClient({ to: email, subject: 'New message about your project',
          text: `Jason sent you a message about your project:\n\n"${text.slice(0, 800)}"\n\nRead and reply in your project portal: ${link}\n` });
      }
    } catch (e) { console.error('[messages] notify send failed', (e && e.message) || e); }
    return res.status(200).json({ ok: true, sent: true });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ ok: false, error: 'method not allowed' });
}

export default withObserve('/api/messages', handler);
