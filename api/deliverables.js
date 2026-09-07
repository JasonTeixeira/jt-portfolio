/**
 * /api/deliverables — operator-side file deliverables (token-gated).
 *
 *   GET  ?projectId=<uuid>              → { files:[{..., url}] }  (fresh signed download URLs)
 *   POST { action:'signUpload', projectId, filename } → { path, signedUrl, token }  (direct-to-storage)
 *   POST { action:'register', projectId, milestoneId?, name, storagePath, sizeBytes?, contentType? }
 *   POST { action:'delete', projectId, id }
 *
 * Files live in a PRIVATE Supabase Storage bucket; nothing is ever public. The client
 * (api/portal.js) only receives short-lived signed download URLs, never upload access.
 */
import { rateLimited, clientIp } from '../lib/ratelimit.mjs';
import { withObserve } from '../lib/observe.mjs';
import { checkToken } from '../lib/admin-auth.mjs';
import {
  isEnabled, signDeliverableUpload, registerDeliverable, listDeliverables,
  signDeliverableDownload, deleteDeliverable,
} from '../lib/portal-db.mjs';

const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max);

async function handler(req, res) {
  if (await rateLimited(clientIp(req), 60, 'admin')) return res.status(429).json({ ok: false, error: 'slow_down' });
  if (!checkToken(req)) return res.status(401).json({ ok: false, error: 'unauthorized' });
  if (!isEnabled()) return res.status(200).json({ ok: false, skipped: true, files: [] });

  if (req.method === 'GET') {
    const projectId = str(req.query.projectId, 64);
    if (!projectId) return res.status(400).json({ ok: false, error: 'projectId required' });
    const r = await listDeliverables(projectId);
    const files = r.ok ? r.data : [];
    // attach a fresh signed download URL to each (short-lived)
    const out = await Promise.all(files.map(async (f) => {
      const s = await signDeliverableDownload(f.storage_path, 300);
      return { id: f.id, milestone_id: f.milestone_id, name: f.name, size_bytes: f.size_bytes,
        content_type: f.content_type, created_at: f.created_at, url: s.ok ? s.url : null };
    }));
    return res.status(200).json({ ok: true, files: out });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const action = str(body.action, 20);
    const projectId = str(body.projectId, 64);
    if (!projectId) return res.status(400).json({ ok: false, error: 'projectId required' });

    if (action === 'signUpload') {
      const filename = str(body.filename, 200) || 'file';
      const r = await signDeliverableUpload(projectId, filename);
      if (!r.ok) return res.status(200).json({ ok: false, reason: 'sign_failed' });
      return res.status(200).json({ ok: true, path: r.path, signedUrl: r.signedUrl, token: r.token });
    }

    if (action === 'register') {
      const storagePath = str(body.storagePath, 300);
      // the path MUST be `${projectId}/<safe-name>` with no slashes/traversal in the remainder —
      // strict allowlist rather than a loose prefix check (defense-in-depth).
      const prefix = `${projectId}/`;
      const rest = storagePath.startsWith(prefix) ? storagePath.slice(prefix.length) : '';
      if (!rest || !/^[A-Za-z0-9._-]+$/.test(rest)) return res.status(400).json({ ok: false, error: 'bad path' });
      const r = await registerDeliverable({
        project_id: projectId, milestone_id: str(body.milestoneId, 64) || null,
        name: str(body.name, 200) || 'file', storage_path: storagePath,
        size_bytes: typeof body.sizeBytes === 'number' ? body.sizeBytes : null,
        content_type: str(body.contentType, 120) || null,
      });
      if (!r.ok) return res.status(200).json({ ok: false, reason: 'write_failed' });
      return res.status(200).json({ ok: true, file: r.data });
    }

    if (action === 'delete') {
      const id = str(body.id, 64);
      if (!id) return res.status(400).json({ ok: false, error: 'id required' });
      const r = await deleteDeliverable(id, projectId);
      if (!r.ok) return res.status(200).json({ ok: false, reason: r.error === 'not_found' ? 'not_found' : 'delete_failed' });
      return res.status(200).json({ ok: true, deleted: true });
    }

    return res.status(400).json({ ok: false, error: 'unknown action' });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ ok: false, error: 'method not allowed' });
}

export default withObserve('/api/deliverables', handler);
