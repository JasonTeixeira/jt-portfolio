import { checkToken } from '../lib/admin-auth.mjs';
import { isEnabled, createContract } from '../lib/portal-db.mjs';
import { getProposalById } from '../lib/proposal-db.mjs';
import { buildSow, buildMsa, publicId, CONTRACT_TERMS_VERSION } from '../assets/contract-core.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false, error: 'method not allowed' }); }
  // Fail-closed admin gate BEFORE any DB work.
  if (!checkToken(req)) return res.status(401).json({ ok: false, error: 'unauthorized' });
  if (!isEnabled()) return res.status(200).json({ ok: false, skipped: true });
  const { proposalId, kind: kindIn } = req.body || {};
  if (typeof proposalId !== 'string' || !proposalId.trim()) return res.status(400).json({ ok: false, error: 'proposalId required' });
  const kind = kindIn === 'msa' ? 'msa' : 'sow';
  const got = await getProposalById(proposalId);
  if (!got.ok || !got.data) return res.status(404).json({ ok: false, error: 'not_found' });
  const proposal = got.data;
  const nowIso = new Date().toISOString();
  const projectName = proposal.segment || 'Engagement';
  // No invented figures — everything comes off the persisted proposal.
  const built = kind === 'msa'
    ? buildMsa({ clientName: null, nowIso })
    : buildSow({
      clientName: null, projectName, keys: proposal.keys,
      firmCents: proposal.firm_cents, depositCents: proposal.deposit_cents, balanceCents: proposal.balance_cents,
      nowIso,
    });
  const pid = publicId();
  const created = await createContract({
    public_id: pid, proposal_id: proposal.id, project_id: null, kind, body: built,
    terms_version: CONTRACT_TERMS_VERSION, client_email: proposal.client_email || null, status: 'draft',
  });
  if (!created.ok) return res.status(200).json({ ok: false, skipped: true });
  return res.status(200).json({ ok: true, publicId: pid });
}
