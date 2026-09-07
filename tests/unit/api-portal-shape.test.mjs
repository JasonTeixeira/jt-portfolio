import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate, clientView, milestoneBelongsToProject, validateMessage } from '../../api/portal.js';
import { validate as validateMilestone } from '../../api/milestone.js';
import portalHandler from '../../api/portal.js';
import milestoneHandler from '../../api/milestone.js';

function mockRes() {
  return {
    code: 0, body: null, headers: {},
    status(c) { this.code = c; return this; },
    json(b) { this.body = b; return this; },
    setHeader(k, v) { this.headers[k] = v; },
  };
}

test('portal approve validate requires portalToken, milestoneId, a real name', () => {
  assert.equal(validate({ portalToken: 't', milestoneId: 'm1', name: 'Dana Lee' }).ok, true);
  assert.equal(validate({ milestoneId: 'm1', name: 'Dana Lee' }).ok, false);
  assert.equal(validate({ portalToken: 't', name: 'Dana Lee' }).ok, false);
  assert.equal(validate({ portalToken: 't', milestoneId: 'm1', name: 'D' }).ok, false);
  assert.equal(validate(null).ok, false);
});

test('clientView whitelists fields — no email/ip/internal-proposal-id leak, milestone id present', () => {
  const project = { id: 'PROJECT-UUID', proposal_id: 'PROPOSAL-UUID', status: 'kickoff', portal_token: 'SECRET-TOKEN' };
  const proposal = {
    id: 'PROPOSAL-UUID', keys: ['chatbot'], segment: 'ai-product',
    firm_cents: 650000, deposit_cents: 195000, balance_cents: 455000, paid_at: '2026-08-20T00:00:00Z',
    client_email: 'client@example.com', accept_ip: '1.2.3.4', public_id: 'PROPOSAL-PUB',
  };
  const milestones = [
    { id: 'M1', seq: 1, title: 'Kickoff', deliverables: 'Discovery doc', amount_cents: 100000, status: 'delivered', due_at: '2026-09-01T00:00:00Z' },
  ];
  const contract = { id: 'CONTRACT-UUID', public_id: 'CONTRACT-PUB', status: 'sent', client_email: 'client@example.com' };
  const v = clientView(project, proposal, milestones, contract);

  assert.equal(v.project.status, 'kickoff');
  assert.equal(v.plan.firm_cents, 650000);
  assert.equal(v.plan.paid_at, '2026-08-20T00:00:00Z');
  assert.equal(v.milestones[0].id, 'M1', 'milestone id must be present so the client can approve');
  assert.equal(v.contract.public_id, 'CONTRACT-PUB');
  assert.equal(v.contract.status, 'sent');

  const joined = JSON.stringify(v);
  assert.ok(!joined.includes('client@example.com'), 'client_email must not leak');
  assert.ok(!joined.includes('1.2.3.4'), 'accept_ip must not leak');
  assert.ok(!joined.includes('SECRET-TOKEN'), 'portal_token must not leak');
  assert.ok(!joined.includes('PROPOSAL-UUID'), 'internal proposal id must not leak');
  assert.ok(!joined.includes('CONTRACT-UUID'), 'internal contract id must not leak');
});

test('clientView hides a draft contract (not sent/accepted yet)', () => {
  const project = { id: 'p', proposal_id: 'pr', status: 'kickoff' };
  const draft = { public_id: 'x', status: 'draft' };
  const v = clientView(project, null, [], draft);
  assert.equal(v.contract, null);
});

test('clientView returns null for a missing project', () => {
  assert.equal(clientView(null, null, [], null), null);
});

test('milestoneBelongsToProject: only true when the id is in this project\'s own milestone list', () => {
  const milestones = [{ id: 'M1' }, { id: 'M2' }];
  assert.equal(milestoneBelongsToProject(milestones, 'M1'), true);
  assert.equal(milestoneBelongsToProject(milestones, 'FROM-ANOTHER-PROJECT'), false);
  assert.equal(milestoneBelongsToProject([], 'M1'), false);
  assert.equal(milestoneBelongsToProject(null, 'M1'), false);
});

test('milestone upsert validate requires projectId (or an existing id) + a title', () => {
  assert.equal(validateMilestone({ projectId: 'p1', title: 'Kickoff' }).ok, true);
  assert.equal(validateMilestone({ id: 'm1', title: 'Kickoff' }).ok, true, 'an existing id substitutes for projectId on update');
  assert.equal(validateMilestone({ title: 'Kickoff' }).ok, false);
  assert.equal(validateMilestone({ projectId: 'p1' }).ok, false);
  assert.equal(validateMilestone({ id: 'm1', action: 'deliver' }).ok, true);
  assert.equal(validateMilestone({ action: 'deliver' }).ok, false);
});

test('portal POST fails closed shape check before DB (bad body -> 400, not 200-skip)', async () => {
  const res = mockRes();
  await portalHandler({ method: 'POST', headers: {}, body: {} }, res);
  assert.equal(res.code, 400);
});

test('portal GET/POST reject bad methods gracefully', async () => {
  const res = mockRes();
  await portalHandler({ method: 'DELETE', headers: {}, query: {} }, res);
  assert.equal(res.code, 405);
});

test('milestone endpoint fails closed without admin token (no DB work happens)', async () => {
  const res = mockRes();
  await milestoneHandler({ method: 'POST', headers: {}, body: { projectId: 'p1', title: 'Kickoff' } }, res);
  assert.equal(res.code, 401);
});

test('milestone endpoint rejects non-POST', async () => {
  const res = mockRes();
  await milestoneHandler({ method: 'GET', headers: {}, query: {} }, res);
  assert.equal(res.code, 405);
});

test('validateMessage requires a portalToken and a 1..5000 char body', () => {
  assert.equal(validateMessage({ portalToken: 't', body: 'hello' }).ok, true);
  assert.equal(validateMessage({ body: 'hello' }).ok, false);           // no token
  assert.equal(validateMessage({ portalToken: 't', body: '' }).ok, false); // empty
  assert.equal(validateMessage({ portalToken: 't' }).ok, false);         // no body
  assert.equal(validateMessage({ portalToken: 't', body: 'x'.repeat(5001) }).ok, false); // too long
  assert.equal(validateMessage(null).ok, false);
});

test('clientView includes a messages array (whitelisted to sender/body/created_at)', () => {
  const v = clientView({ status: 'kickoff' }, null, [], null, [
    { sender: 'client', body: 'hi', created_at: '2026-09-07T00:00:00Z', read_by_operator_at: null, id: 'secret' },
  ]);
  assert.equal(v.messages.length, 1);
  assert.equal(v.messages[0].body, 'hi');
  assert.equal(v.messages[0].id, undefined);   // internal id not leaked
  assert.equal(v.messages[0].read_by_operator_at, undefined);
});

test('portal pay_balance requires a portalToken (400) and never throws', async () => {
  const res = mockRes();
  await portalHandler({ method: 'POST', headers: {}, body: { action: 'pay_balance' } }, res);
  assert.ok([400, 429].includes(res.code));
  assert.equal(typeof res.body.ok, 'boolean');
});

test('clientView exposes balance_paid_at so the portal can show paid vs pay-balance', () => {
  const paid = clientView({ status: 'active' }, { firm_cents: 1000, deposit_cents: 300, balance_cents: 700, paid_at: 'x', balance_paid_at: '2026-09-07T00:00:00Z' }, [], null);
  assert.equal(paid.plan.balance_paid_at, '2026-09-07T00:00:00Z');
  const unpaid = clientView({ status: 'active' }, { firm_cents: 1000, deposit_cents: 300, balance_cents: 700, paid_at: 'x' }, [], null);
  assert.equal(unpaid.plan.balance_paid_at, null);
});
