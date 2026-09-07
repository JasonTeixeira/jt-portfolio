import { withObserve } from '../lib/observe.mjs';
import {
  isEnabled, getProjectByPortalToken, listMilestones, approveMilestone, getContractsForProposal,
  listMessages, addMessage, markMessagesRead, listDeliverables, signDeliverableDownload,
} from '../lib/portal-db.mjs';
import { getProposalById } from '../lib/proposal-db.mjs';
import { sendOperator } from '../lib/notify.mjs';
import { rateLimited, clientIp } from '../lib/ratelimit.mjs';

const SITE = process.env.SITE_URL || 'https://agency.sageideas.dev';

// A client message needs a token + a non-empty body (kept separate from the approve validator).
export function validateMessage(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'bad body' };
  if (typeof body.portalToken !== 'string' || !body.portalToken.trim()) return { ok: false, error: 'portalToken required' };
  const t = typeof body.body === 'string' ? body.body.trim() : '';
  if (t.length < 1 || t.length > 5000) return { ok: false, error: 'message required' };
  return { ok: true };
}

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
export function clientView(project, proposal, milestones, contract, messages) {
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
  const msgs = Array.isArray(messages) ? messages.map((m) => ({
    sender: m.sender, body: m.body, created_at: m.created_at,
  })) : [];
  return { project: { status: project.status }, plan, milestones: ms, contract: contractOut, messages: msgs };
}

async function loadContractSummary(proposalId) {
  if (!proposalId) return null;
  const r = await getContractsForProposal(proposalId);
  if (!r.ok || !Array.isArray(r.data)) return null;
  return r.data.find((c) => VISIBLE_CONTRACT_STATUSES.has(c.status)) || null;
}

async function handler(req, res) {
  if (req.method === 'GET') {
    // GET always answers 200 — an invalid/expired portal link is a normal visitor state,
    // not an HTTP error. Matches api/proposal.js / api/contract.js.
    if (!isEnabled()) return res.status(200).json({ ok: false, reason: 'not_configured' });
    const token = String(req.query.id || '');
    if (!token) return res.status(200).json({ ok: false, reason: 'bad_request' });
    const projR = await getProjectByPortalToken(token);
    if (!projR.ok || !projR.data) return res.status(200).json({ ok: false, reason: 'not_found' });
    const project = projR.data;
    const [proposalR, milestonesR, contract, messagesR] = await Promise.all([
      getProposalById(project.proposal_id),
      listMilestones(project.id),
      loadContractSummary(project.proposal_id),
      listMessages(project.id),
    ]);
    const proposal = proposalR.ok ? proposalR.data : null;
    const milestones = milestonesR.ok ? milestonesR.data : [];
    const messages = messagesR.ok ? messagesR.data : [];
    // client is looking at the thread now — mark operator messages read (fire-and-forget)
    markMessagesRead(project.id, 'client').catch(() => {});
    const view = clientView(project, proposal, milestones, contract, messages);
    if (!view) return res.status(200).json({ ok: false, reason: 'not_found' });
    // deliverable files: mint a fresh short-lived signed download URL per file (no storage_path leak)
    const filesR = await listDeliverables(project.id);
    const files = filesR.ok ? filesR.data : [];
    const deliverables = await Promise.all(files.map(async (f) => {
      const s = await signDeliverableDownload(f.storage_path, 300);
      return { name: f.name, size_bytes: f.size_bytes, content_type: f.content_type,
        milestone_id: f.milestone_id, created_at: f.created_at, url: s.ok ? s.url : null };
    }));
    return res.status(200).json({ ok: true, ...view, deliverables });
  }
  if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ ok: false, error: 'method not allowed' }); }
  // Rate-limit every client POST (message + approve). The message branch fires an operator
  // email per call, so a leaked/forwarded portal token must not be able to email-bomb.
  if (await rateLimited(clientIp(req), 20, 'portal-post')) return res.status(429).json({ ok: false, error: 'slow_down' });
  const body = req.body || {};

  // client posts a message to the project thread
  if (body.action === 'message') {
    const mv = validateMessage(body); if (!mv.ok) return res.status(400).json({ ok: false, error: mv.error });
    if (!isEnabled()) return res.status(200).json({ ok: false, skipped: true, reason: 'not_configured' });
    const pR = await getProjectByPortalToken(body.portalToken.trim());
    if (!pR.ok || !pR.data) return res.status(404).json({ ok: false, error: 'not_found' });
    const sent = await addMessage(pR.data.id, 'client', body.body.trim());
    if (!sent.ok) { console.error('[portal] addMessage failed', sent.error || ''); return res.status(200).json({ ok: false, reason: 'write_failed' }); }
    try {
      await sendOperator({ subject: 'New message from a client — project portal',
        text: `A client sent you a message in their project portal:\n\n"${body.body.trim().slice(0, 800)}"\n\nReply in the admin: ${SITE}/proposal-admin.html\n` });
    } catch (e) { console.error('[portal] notify send failed', (e && e.message) || e); }
    return res.status(200).json({ ok: true, sent: true });
  }

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
  const approved = await approveMilestone(milestoneId, body.name.trim(), project.id);
  if (!approved.ok) {
    // Past the isEnabled() gate, so this is a REAL write failure — not "not configured".
    // Don't send skipped:true (the client shows "approvals aren't switched on yet" for that);
    // log it and let the client show the honest "something went wrong" path.
    console.error('[portal] approveMilestone failed', approved.error || '');
    return res.status(200).json({ ok: false, reason: 'write_failed' });
  }
  return res.status(200).json({ ok: true, approved: Boolean(approved.approved) });
}

export default withObserve('/api/portal', handler);
