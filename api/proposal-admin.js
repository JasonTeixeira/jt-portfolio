import { isEnabled, getProposalById, listProposals } from '../lib/proposal-db.mjs';
import { getProjectByProposalId, listMilestones, getContractsForProposal } from '../lib/portal-db.mjs';
import { checkToken } from '../lib/admin-auth.mjs';
export default async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ ok: false, error: 'method not allowed' }); }
  if (!checkToken(req)) return res.status(401).json({ ok: false, error: 'unauthorized' });
  if (!isEnabled()) return res.status(200).json({ ok: false, skipped: true, list: [] });
  if (req.query.list) {
    const r = await listProposals({ limit: 100 });
    return res.status(200).json({ ok: true, list: r.data || [] });
  }
  const id = String(req.query.id || '');
  if (!id) return res.status(400).json({ ok: false, error: 'id required' });
  const r = await getProposalById(id);
  if (!r.ok || !r.data) return res.status(404).json({ ok: false, error: 'not_found' });

  // A project only exists once the deposit is paid; milestones attach to the project, not the proposal.
  let project = null;
  let milestones = [];
  const projGot = await getProjectByProposalId(id);
  if (projGot.ok && projGot.data) {
    project = projGot.data;
    const msGot = await listMilestones(project.id);
    if (msGot.ok) milestones = msGot.data || [];
  }
  const contractsGot = await getContractsForProposal(id);
  const contracts = contractsGot.ok ? (contractsGot.data || []) : [];

  return res.status(200).json({ ok: true, proposal: r.data, project, milestones, contracts });
}
