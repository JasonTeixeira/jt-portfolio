/**
 * /api/tasks — operator tasks + per-deal costs/budget (admin-gated).
 *
 *   GET                     → { tasks: [...] }        (optional ?status=)
 *   GET ?budget=1           → { budget: {rows, totals} }
 *   GET ?costs=<proposalId> → { costs: [...] }
 *   POST { action:'task_create'|'task_update'|'task_delete'|'cost_add'|'cost_delete', ... }
 *
 * Operator-private; never exposed to the client portal.
 */
import { rateLimited, clientIp } from '../lib/ratelimit.mjs';
import { withObserve } from '../lib/observe.mjs';
import { authorizeAdmin } from '../lib/admin-auth.mjs';
import {
  isEnabled, listTasks, createTask, updateTask, deleteTask,
  listCosts, addCost, deleteCost, budgetSummary,
} from '../lib/tasks-db.mjs';

const SAFE_ERRORS = new Set([
  'title required', 'invalid status', 'invalid priority', 'invalid due_at',
  'invalid proposal_id', 'invalid project_id', 'label required', 'invalid amount',
  'invalid kind', 'id required', 'not_found',
]);
function failPost(res, err, op) {
  if (err && !SAFE_ERRORS.has(err)) console.error(`[tasks] ${op} failed`, err);
  if (err === 'not_found') return res.status(404).json({ ok: false, error: 'not_found' });
  return res.status(400).json({ ok: false, error: err && SAFE_ERRORS.has(err) ? err : 'save_failed' });
}

async function handler(req, res) {
  if (await rateLimited(clientIp(req), 60, 'admin')) return res.status(429).json({ ok: false, error: 'slow_down' });
  if (!(await authorizeAdmin(req))) return res.status(401).json({ ok: false, error: 'unauthorized' });
  if (!isEnabled()) return res.status(200).json({ ok: false, skipped: true, tasks: [] });

  if (req.method === 'GET') {
    if (String(req.query.budget || '') === '1') {
      const r = await budgetSummary();
      if (!r.ok) return res.status(502).json({ ok: false, error: 'budget_unavailable' });
      return res.status(200).json({ ok: true, budget: r.data });
    }
    if (req.query.costs) {
      const r = await listCosts(String(req.query.costs));
      if (!r.ok) return failPost(res, r.error, 'costs');
      return res.status(200).json({ ok: true, costs: r.data });
    }
    const r = await listTasks({ status: req.query.status });
    if (!r.ok) return res.status(502).json({ ok: false, error: 'tasks_unavailable' });
    return res.status(200).json({ ok: true, tasks: r.data });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const action = String(body.action || '');
    if (action === 'task_create') {
      const r = await createTask(body);
      return r.ok ? res.status(200).json({ ok: true, task: r.data }) : failPost(res, r.error, 'task_create');
    }
    if (action === 'task_update') {
      if (!body.id) return res.status(400).json({ ok: false, error: 'id required' });
      const r = await updateTask(String(body.id), body);
      return r.ok ? res.status(200).json({ ok: true, task: r.data }) : failPost(res, r.error, 'task_update');
    }
    if (action === 'task_delete') {
      if (!body.id) return res.status(400).json({ ok: false, error: 'id required' });
      const r = await deleteTask(String(body.id));
      return r.ok ? res.status(200).json({ ok: true }) : failPost(res, r.error, 'task_delete');
    }
    if (action === 'cost_add') {
      const r = await addCost(body);
      return r.ok ? res.status(200).json({ ok: true, cost: r.data }) : failPost(res, r.error, 'cost_add');
    }
    if (action === 'cost_delete') {
      if (!body.id) return res.status(400).json({ ok: false, error: 'id required' });
      const r = await deleteCost(String(body.id));
      return r.ok ? res.status(200).json({ ok: true }) : failPost(res, r.error, 'cost_delete');
    }
    return res.status(400).json({ ok: false, error: 'unknown action' });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ ok: false, error: 'method not allowed' });
}

export default withObserve('/api/tasks', handler);
