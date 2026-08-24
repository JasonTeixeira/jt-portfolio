import {
  isEnabled, getProjectByPortalToken, listMilestones, approveMilestone, getContractsForProposal,
} from '../lib/portal-db.mjs';
import { getProposalById } from '../lib/proposal-db.mjs';

// Only a sent/accepted contract is worth surfacing to the client — a draft is invisible.
const VISIBLE_CONTRACT_STATUSES = new Set(['sent', 'accepted']);

export function validate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'bad body' };
  if (typeof body.portalToken !== 'string' || !body.portalToken.trim()) return { ok: false, error: 'portalToken required' };
  if (typeof body.milestoneId !== 'string' || !body.milestoneId.trim()) return { ok: false, error: 'milestoneId required' };
  const n = typeof body.name === 'string' ? body.name.trim() : '';
  if (n.length < 2 || n.length > 120) return { ok: false, error: 'name required' };
  return { ok: true };
}

// True only when milestoneId is one of THIS project's own milestones. The client sends a
// portal token (proves the project) and a milestone id (must be checked, not trusted) —
// this stops a client from approving a milestone that belongs to a different project.
export function milestoneBelongsToProject(milestones, milestoneId) {
  return Array.isArray(milestones) && milestones.some((m) => m && m.id === milestoneId);
}

// Pure whitelist: turns raw DB rows into exactly what the client is allowed to see.
// No client_email, ip, tokens, or internal proposal id — the milestone `id` IS included
// so the client can send it back on approve.
export function clientView(project, proposal, milestones, contract) {
  if (!project) return null;
  const plan = proposal ? {
    keys: Array.isArray(proposal.keys) ? proposal.keys : [],
    segment: proposal.segment || null,
    firm_cents: proposal.firm_cents,
    deposit_cents: proposal.deposit_cents,
    balance_cents: proposal.balance_cents,
    paid_at: proposal.paid_at || null,
  } : null;
  const ms = Array.isArray(milestones) ? milestones.map((m) => ({
    id: m.id, seq: m.seq, title: m.title, deliverables: m.deliverables,
    amount_cents: m.amount_cents, status: m.status, due_at: m.due_at,
  })) : [];
  const contractOut = (contract && VISIBLE_CONTRACT_STATUSES.has(contract.status))
    ? { public_id: contract.public_id, status: contract.status } : null;
  return { project: { status: project.status }, plan, milestones: ms, contract: contractOut };
}

async function loadContractSummary(proposalId) {
  if (!proposalId) return null;
  const r = await getContractsForProposal(proposalId);
  if (!r.ok || !Array.isArray(r.data)) return null;
  return r.data.find((c) => VISIBLE_CONTRACT_STATUSES.has(c.status)) || null;
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    // GET always answers 200 — an invalid/expired portal link is a normal visitor state,
    // not an HTTP error. Matches api/proposal.js / api/contract.js.
    if (!isEnabled()) return res.status(200).json({ ok: false, reason: 'not_configured' });
    const token = String(req.query.id || '');
    if (!token) return res.status(200).json({ ok: false, reason: 'bad_request' });
    const projR = await getProjectByPortalToken(token);
    if (!projR.ok || !projR.data) return res.status(200).json({ ok: false, reason: 'not_found' });
    const project = projR.data;
    const [proposalR, milestonesR, contract] = await Promise.all([
      getProposalById(project.proposal_id),
      listMilestones(project.id),
      loadContractSummary(project.proposal_id),
    ]);
    const proposal = proposalR.ok ? proposalR.data : null;
    const milestones = milestonesR.ok ? milestonesR.data : [];
    const view = clientView(project, proposal, milestones, contract);
    if (!view) return res.status(200).json({ ok: false, reason: 'not_found' });
    return res.status(200).json({ ok: true, ...view });
  }
  if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ ok: false, error: 'method not allowed' }); }
  const body = req.body || {};
  if (body.action && body.action !== 'approve_milestone') return res.status(400).json({ ok: false, error: 'unknown action' });
  const v = validate(body); if (!v.ok) return res.status(400).json({ ok: false, error: v.error });
  if (!isEnabled()) return res.status(200).json({ ok: false, skipped: true, reason: 'not_configured' });
  const projR = await getProjectByPortalToken(body.portalToken.trim());
  if (!projR.ok || !projR.data) return res.status(404).json({ ok: false, error: 'not_found' });
  const project = projR.data;
  const msR = await listMilestones(project.id);
  const milestones = msR.ok ? msR.data : [];
  const milestoneId = body.milestoneId.trim();
  // Membership check BEFORE approving — a client only approves their own project's milestone.
  if (!milestoneBelongsToProject(milestones, milestoneId)) return res.status(404).json({ ok: false, error: 'not_found' });
  const approved = await approveMilestone(milestoneId, body.name.trim());
  if (!approved.ok) return res.status(200).json({ ok: false, skipped: true });
  return res.status(200).json({ ok: true, approved: Boolean(approved.approved) });
}
