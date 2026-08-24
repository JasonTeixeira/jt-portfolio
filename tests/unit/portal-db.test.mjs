import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isEnabled, getProjectByPortalToken, getProjectByProposalId, ensurePortalToken,
  listMilestones, upsertMilestone, markDelivered, approveMilestone,
  createContract, getContractByPublicId, getContractsForProposal, sendContract, acceptContract,
} from '../../lib/portal-db.mjs';

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
