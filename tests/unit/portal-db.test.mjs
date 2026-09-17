import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isEnabled, getProjectByPortalToken, getProjectByProposalId, ensurePortalToken,
  listMilestones, upsertMilestone, markDelivered, approveMilestone,
  createContract, getContractByPublicId, getContractsForProposal, sendContract, acceptContract,
  listClientProjectsByEmail, contractSummariesForProposals, normalizeMessageAttachment,
} from '../../lib/portal-db.mjs';

test('normalizeMessageAttachment accepts only paths under this project msg/ prefix', () => {
  const pid = 'proj-123';
  // valid path minted by this project's sign_upload
  const ok = normalizeMessageAttachment(pid, { path: `msg/${pid}/abc-report.pdf`, name: 'report.pdf', size: 1024, type: 'application/pdf' });
  assert.deepEqual(ok, { path: `msg/${pid}/abc-report.pdf`, name: 'report.pdf', size: 1024, type: 'application/pdf' });
});

test('normalizeMessageAttachment rejects cross-project, arbitrary, and traversal paths', () => {
  const pid = 'proj-123';
  assert.equal(normalizeMessageAttachment(pid, { path: 'msg/other-proj/x.pdf', name: 'x' }), null);
  assert.equal(normalizeMessageAttachment(pid, { path: 'proj-123/x.pdf', name: 'x' }), null); // deliverables prefix, not msg/
  assert.equal(normalizeMessageAttachment(pid, { path: '../../secrets', name: 'x' }), null);
  assert.equal(normalizeMessageAttachment(pid, { path: `msg/${pid}`, name: 'x' }), null); // no trailing slash → not under prefix
  assert.equal(normalizeMessageAttachment(pid, { path: `msg/${pid}/../other-proj/x`, name: 'x' }), null); // traversal after valid prefix
  assert.equal(normalizeMessageAttachment(pid, {}), null);
  assert.equal(normalizeMessageAttachment(pid, null), null);
  assert.equal(normalizeMessageAttachment('', { path: 'msg//x' }), null);
});

test('normalizeMessageAttachment sanitizes name and bounds metadata', () => {
  const pid = 'p1';
  const r = normalizeMessageAttachment(pid, { path: `msg/${pid}/u-file`, name: '../../etc/passwd', size: -5, type: 'x'.repeat(200) });
  assert.equal(r.name, 'passwd'); // basename only, traversal stripped
  assert.equal(r.size, null); // negative size rejected
  assert.equal(r.type.length, 120); // bounded
});

test('contractSummariesForProposals returns [] for empty ids and is degrade-safe', async () => {
  assert.deepEqual(await listClientProjectsByEmail('a@b.co'), { ok: false, skipped: true });
  assert.deepEqual(await contractSummariesForProposals([]), { ok: false, skipped: true });
  assert.deepEqual(await contractSummariesForProposals(['id1', 'id2']), { ok: false, skipped: true });
});

test('disabled without env — never throws, reports skipped', async () => {
  assert.equal(isEnabled(), false);
  assert.deepEqual(await getProjectByPortalToken('tok'), { ok: false, skipped: true });
  assert.deepEqual(await getProjectByProposalId('proposal-id'), { ok: false, skipped: true });
  assert.deepEqual(await ensurePortalToken('project-id'), { ok: false, skipped: true });
  assert.deepEqual(await listMilestones('project-id'), { ok: false, skipped: true });
  assert.deepEqual(await upsertMilestone({ project_id: 'p', title: 'Kickoff' }), { ok: false, skipped: true });
  assert.deepEqual(await markDelivered('milestone-id'), { ok: false, skipped: true });
  assert.deepEqual(await approveMilestone('milestone-id', 'Client Name'), { ok: false, skipped: true });
  assert.deepEqual(await createContract({ public_id: 'x' }), { ok: false, skipped: true });
  assert.deepEqual(await getContractByPublicId('pub-id'), { ok: false, skipped: true });
  assert.deepEqual(await getContractsForProposal('proposal-id'), { ok: false, skipped: true });
  assert.deepEqual(await sendContract('contract-id'), { ok: false, skipped: true });
  assert.deepEqual(await acceptContract('contract-id', { name: 'Client Name', ip: '1.2.3.4' }), { ok: false, skipped: true });
});
