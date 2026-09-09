/**
 * /api/my-documents — every document across a logged-in client's projects: their
 * agreements + deliverable files, aggregated for a unified, searchable view.
 *   GET (Bearer <supabase jwt>) -> { ok, documents:[{ kind, name, href, ... }] }
 *
 * Scoped to the caller's VERIFIED email (listClientProjectsByEmail) exactly like
 * /api/my-projects — a client only ever sees documents from their own projects. File
 * links are short-lived signed URLs (the storage path never leaves the server).
 */
import { withObserve } from '../lib/observe.mjs';
import { rateLimited, clientIp } from '../lib/ratelimit.mjs';
import { userFromRequest } from '../lib/auth-user.mjs';
import { isEnabled, listClientProjectsByEmail, contractSummariesForProposals, getProjectByPortalToken, listDeliverables, signDeliverableDownload } from '../lib/portal-db.mjs';

const VISIBLE_CONTRACT = new Set(['sent', 'accepted']);
const MAX_PROJECTS = 20;
const MAX_FILES_PER_PROJECT = 50;

async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ ok: false, error: 'method not allowed' }); }
  if (await rateLimited(clientIp(req), 40, 'my-documents')) return res.status(429).json({ ok: false, error: 'slow_down' });
  const user = await userFromRequest(req);
  if (!user) return res.status(401).json({ ok: false, error: 'unauthorized' });
  if (!isEnabled()) return res.status(200).json({ ok: true, documents: [] });

  const pr = await listClientProjectsByEmail(user.email);
  const rows = (pr.ok ? pr.data : []).slice(0, MAX_PROJECTS);

  // agreements (batched)
  const proposalIds = rows.map((r) => (r.scope_proposals || {}).id).filter(Boolean);
  const cR = proposalIds.length ? await contractSummariesForProposals(proposalIds) : { ok: true, data: [] };
  const contractByProp = {};
  if (cR.ok) for (const c of cR.data) {
    if (VISIBLE_CONTRACT.has(c.status) && !contractByProp[c.proposal_id]) contractByProp[c.proposal_id] = c;
  }

  const documents = [];
  let n = 0;
  for (const row of rows) {
    n += 1;
    const token = row.portal_token;
    const prop = row.scope_proposals || {};
    const projectLabel = `Project ${n}`;

    const c = contractByProp[prop.id];
    if (c && c.public_id) {
      documents.push({ kind: 'agreement', name: c.status === 'accepted' ? 'Signed agreement' : 'Agreement (awaiting signature)',
        href: `contract.html?id=${encodeURIComponent(c.public_id)}`, project: projectLabel, projectToken: token, status: c.status });
    }

    // deliverable files — need the project's own id (not exposed by the list query)
    const projGet = await getProjectByPortalToken(token);
    const project = projGet.ok ? projGet.data : null;
    if (project) {
      const filesR = await listDeliverables(project.id);
      const files = (filesR.ok ? filesR.data : []).slice(0, MAX_FILES_PER_PROJECT);
      for (const f of files) {
        const s = await signDeliverableDownload(f.storage_path, 300);
        documents.push({ kind: 'file', name: f.name, href: s.ok ? s.url : null, size: f.size_bytes || null, project: projectLabel, projectToken: token, created_at: f.created_at || null });
      }
    }
  }

  return res.status(200).json({ ok: true, documents });
}

export default withObserve('/api/my-documents', handler);
