import { createClient } from '@supabase/supabase-js';
import { first, rows, list } from './db-result.mjs';

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;
let _client = null;

export function isEnabled() { return Boolean(URL && KEY); }
export function getClient() {
  if (!isEnabled()) return null;
  if (!_client) _client = createClient(URL, KEY, { auth: { persistSession: false } });
  return _client;
}
async function guard(fn) {
  if (!isEnabled()) return { ok: false, skipped: true };
  try { return { ok: true, data: await fn(getClient()) }; }
  catch (e) { return { ok: false, error: String(e && e.message || e) }; }
}
export const upsertProspect = (row) => guard((c) => c.from('scope_prospects').upsert({ ...row, updated_at: new Date().toISOString() }).select().then(rows));
export const insertPlan = (row) => guard((c) => c.from('scope_plans').insert(row).then(rows));
export const appendEvent = (row) => guard(async (c) => {
  const out = await c.from('scope_events').insert(row).then(rows);
  // bump the prospect's last touch so the pipeline board sorts by real activity
  if (row && row.prospect_id) {
    await c.from('scope_prospects').update({ updated_at: new Date().toISOString() }).eq('id', row.prospect_id);
  }
  return out;
});
export const appendConversation = (row) => guard((c) => c.from('scope_conversations').insert(row).then(rows));

/* ── CRM read/write layer (operator pipeline over scope_prospects + scope_events) ── */
const PROSPECT_STAGES = ['new', 'scoped', 'engaged', 'won', 'lost'];
export function isValidStage(s) { return PROSPECT_STAGES.includes(s); }

export const listProspects = ({ stage, limit = 200 } = {}) =>
  guard((c) => {
    let q = c.from('scope_prospects')
      .select('id,email,name,company,segment,stage,source,qualification,created_at,updated_at')
      .order('updated_at', { ascending: false }).limit(limit);
    if (stage && isValidStage(stage)) q = q.eq('stage', stage);
    return q.then(list);
  });

export const getProspect = (id) =>
  guard((c) => c.from('scope_prospects').select('*').eq('id', id).maybeSingle().then(rows));

export const listProspectEvents = (prospectId, limit = 100) =>
  guard((c) => c.from('scope_events').select('id,type,meta,created_at')
    .eq('prospect_id', prospectId).order('created_at', { ascending: false }).limit(limit).then(list));

// Operator moves a prospect through the stage machine. lost_reason stored in qualification jsonb (no schema change).
export const setProspectStage = (id, stage, lostReason) =>
  guard(async (c) => {
    if (!isValidStage(stage)) throw new Error('invalid stage');
    const patch = { stage, updated_at: new Date().toISOString() };
    if (stage === 'lost' && lostReason) {
      const cur = await c.from('scope_prospects').select('qualification').eq('id', id).maybeSingle().then(rows);
      patch.qualification = { ...((cur && cur.qualification) || {}), lost_reason: String(lostReason).slice(0, 300) };
    }
    return c.from('scope_prospects').update(patch).eq('id', id).select().then(rows);
  });

// Outbound: operator manually logs a cold-reached lead into the pipeline.
export const createProspect = (row) =>
  guard((c) => c.from('scope_prospects').insert({
    email: row.email,
    name: row.name || null,
    company: row.company || null,
    segment: row.segment || null,
    stage: isValidStage(row.stage) ? row.stage : 'new',
    // defense-in-depth: clamp source even though the route never forwards caller input here
    source: String(row.source || 'outbound').slice(0, 40),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).select().then(rows));

// Bulk import: operator loads a scored shortlist (CSV) into the pipeline in one shot.
// Deduped by email (find-or-create) so re-importing the same list is idempotent —
// existing prospects get their blank identity fields filled (trusted operator input),
// new ones are inserted at stage 'new'. Returns a summary; never partial-throws.
const BULK_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const bulkImportProspects = (rawRows) =>
  guard(async (c) => {
    // normalize + validate + dedupe within the batch (last occurrence wins)
    const byEmail = new Map();
    let invalid = 0;
    for (const row of Array.isArray(rawRows) ? rawRows : []) {
      const em = String((row && row.email) || '').trim().toLowerCase();
      if (!BULK_EMAIL_RE.test(em) || em.length > 200) { invalid++; continue; }
      byEmail.set(em, {
        email: em,
        name: row.name ? String(row.name).slice(0, 200) : null,
        company: row.company ? String(row.company).slice(0, 200) : null,
        segment: row.segment ? String(row.segment).slice(0, 60) : null,
        source: 'import', // hard-locked here (not caller-controlled), like stage below
      });
    }
    const emails = [...byEmail.keys()];
    if (!emails.length) return { created: 0, updated: 0, invalid };
    const existing = await c.from('scope_prospects').select('id,email').in('email', emails).then(list);
    const existingMap = new Map(existing.map((r) => [String(r.email).toLowerCase(), r.id]));
    const now = new Date().toISOString();
    let updated = 0;
    for (const [em, id] of existingMap) {
      const r = byEmail.get(em);
      if (!r) continue;
      const patch = { updated_at: now };
      if (r.name) patch.name = r.name;
      if (r.company) patch.company = r.company;
      if (r.segment) patch.segment = r.segment;
      await c.from('scope_prospects').update(patch).eq('id', id);
      updated++;
    }
    const toInsert = emails.filter((em) => !existingMap.has(em)).map((em) => {
      const r = byEmail.get(em);
      return { email: r.email, name: r.name, company: r.company, segment: r.segment, stage: 'new', source: r.source, created_at: now, updated_at: now };
    });
    if (toInsert.length) await c.from('scope_prospects').insert(toInsert);
    return { created: toInsert.length, updated, invalid };
  });

// Outreach touches recorded as timeline events. appendEvent also bumps the
// prospect's updated_at so the board sorts by real last-contact activity.
const TOUCH_KINDS = ['email', 'dm', 'call', 'meeting', 'note', 'follow_up'];
export function isValidTouch(k) { return TOUCH_KINDS.includes(k); }
export const logTouch = (prospectId, kind, note) =>
  guard(async (c) => {
    if (!isValidTouch(kind)) throw new Error('invalid touch kind');
    const meta = note ? { note: String(note).slice(0, 1000) } : {};
    const out = await c.from('scope_events').insert({ prospect_id: prospectId, type: `touch_${kind}`, meta }).then(rows);
    await c.from('scope_prospects').update({ updated_at: new Date().toISOString() }).eq('id', prospectId);
    return out;
  });

// Per-client onboarding: the MANUAL steps a client ticks off, persisted server-side
// per Supabase-Auth user (auto steps like "agreement accepted" are derived live from
// the proposal/contract, never stored here). Keyed by user_id; the API scopes every
// call to the caller's own verified id, so a client can only ever touch their own row.
export const CLIENT_ONBOARDING_STEPS = ['repo_access', 'shared_feature', 'kickoff_booked', 'billing_contact'];
const ONBOARDING_SET = new Set(CLIENT_ONBOARDING_STEPS);
export const getClientOnboarding = (userId) =>
  guard(async (c) => {
    const rows = await c.from('scope_client_onboarding').select('steps').eq('user_id', userId).limit(1).then(list);
    return rows.length ? (rows[0].steps || {}) : {};
  });
export const setClientOnboardingStep = (userId, step, done) =>
  guard(async (c) => {
    if (!ONBOARDING_SET.has(step)) throw new Error('invalid onboarding step');
    const rows = await c.from('scope_client_onboarding').select('steps').eq('user_id', userId).limit(1).then(list);
    const steps = rows.length ? { ...(rows[0].steps || {}) } : {};
    // only persist whitelisted keys — never let an arbitrary blob land in the jsonb
    const clean = {};
    for (const k of CLIENT_ONBOARDING_STEPS) if (steps[k]) clean[k] = true;
    if (done) clean[step] = true; else delete clean[step];
    await c.from('scope_client_onboarding').upsert({ user_id: userId, steps: clean, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    return clean;
  });

// Revenue command center: real money numbers computed from the proposals ledger.
// Volumes for a solo shop are small, so we fetch the columns and aggregate in JS.
export const revenueSummary = () =>
  guard(async (c) => {
    const rows = await c.from('scope_proposals')
      .select('status,firm_cents,deposit_cents,balance_cents,paid_at,balance_paid_at,created_at,client_email')
      .then(list);
    const sum = (arr, f) => arr.reduce((a, r) => a + (Number(f(r)) || 0), 0);
    const paid = rows.filter((r) => r.paid_at);
    const balancePaid = rows.filter((r) => r.balance_paid_at);
    const depositOnly = paid.filter((r) => !r.balance_paid_at);
    const open = rows.filter((r) => ['draft_pending', 'approved'].includes(r.status) && !r.paid_at);
    // collected = deposits taken + balances taken
    const collectedCents = sum(paid, (r) => r.deposit_cents) + sum(balancePaid, (r) => r.balance_cents);
    const outstandingCents = sum(depositOnly, (r) => r.balance_cents); // deposit paid, balance still due
    const pipelineCents = sum(open, (r) => r.firm_cents); // proposals out, not yet paid
    const wonCount = paid.length;
    const avgDealCents = wonCount ? Math.round(sum(paid, (r) => r.firm_cents) / wonCount) : 0;
    // last 6 calendar months of collected revenue (by paid_at / balance_paid_at), for a trend
    const monthly = {};
    const bump = (iso, cents) => { if (!iso) return; const k = String(iso).slice(0, 7); monthly[k] = (monthly[k] || 0) + (Number(cents) || 0); };
    paid.forEach((r) => bump(r.paid_at, r.deposit_cents));
    balancePaid.forEach((r) => bump(r.balance_paid_at, r.balance_cents));
    return {
      collectedCents, outstandingCents, pipelineCents,
      wonCount, openCount: open.length, avgDealCents,
      monthly, // { 'YYYY-MM': cents }
    };
  });

// Persist an inbound lead (contact form, etc.) into the CRM so it's never dropped:
// attach to an existing prospect by email or create one, then log a timeline event.
// Never downgrades an existing stage. Callers treat failure as non-fatal.
export const captureInboundLead = ({ email, name, company, source = 'inbound', note, stage = 'engaged' } = {}) =>
  guard(async (c) => {
    const em = String(email || '').trim().toLowerCase();
    if (!em) throw new Error('email required');
    // limit(1) rather than maybeSingle: email has no unique constraint, so tolerate dupes.
    const existing = await c.from('scope_prospects').select('id,name,company')
      .eq('email', em).order('created_at', { ascending: false }).limit(1).then(list);
    let prospectId = existing.length ? existing[0].id : null;
    if (prospectId) {
      // This is an UNAUTHENTICATED caller (the public contact form). Only fill BLANK
      // identity fields — never let a submitter overwrite an existing prospect's
      // name/company just by knowing their email. Operator edits identity via the UI.
      const cur = existing[0];
      const patch = { updated_at: new Date().toISOString() };
      if (name && !cur.name) patch.name = String(name).slice(0, 200);
      if (company && !cur.company) patch.company = String(company).slice(0, 200);
      await c.from('scope_prospects').update(patch).eq('id', prospectId);
    } else {
      const created = await c.from('scope_prospects').insert({
        email: em,
        name: name ? String(name).slice(0, 200) : null,
        company: company ? String(company).slice(0, 200) : null,
        stage: isValidStage(stage) ? stage : 'engaged',
        source: String(source).slice(0, 40),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).select('id').then(first);
      prospectId = created && created.id;
    }
    if (prospectId) {
      await c.from('scope_events').insert({
        prospect_id: prospectId,
        type: String(source).slice(0, 40),
        meta: note ? { note: String(note).slice(0, 5000) } : {},
      });
    }
    return { prospectId, existed: existing.length > 0 };
  });

// Marketing/outreach cockpit: actionable leads (open stages) ranked by staleness,
// each with a suggested next step, plus recent nurture-send volume. Manual-assist —
// the operator does the sending; this just surfaces who needs a touch and when.
export const marketingSummary = ({ staleDays = 3, limit = 200 } = {}) =>
  guard(async (c) => {
    const now = Date.now();
    const open = await c.from('scope_prospects')
      .select('id,email,name,company,segment,stage,source,created_at,updated_at')
      .in('stage', ['new', 'scoped', 'engaged'])
      .order('updated_at', { ascending: true }).limit(limit).then(list);
    const leads = open.map((p) => {
      const last = new Date(p.updated_at || p.created_at).getTime();
      const days = Number.isFinite(last) ? Math.floor((now - last) / 86400000) : 0;
      let action = 'Follow up';
      if (p.stage === 'new') action = 'First outreach';
      else if (p.stage === 'scoped') action = 'Send proposal / nudge';
      else if (p.stage === 'engaged') action = days >= staleDays ? 'Follow up — going cold' : 'Awaiting reply';
      const needsAction = p.stage === 'new' || days >= staleDays;
      return {
        id: p.id, email: p.email, name: p.name, company: p.company, segment: p.segment,
        stage: p.stage, source: p.source, daysSinceActivity: days, needsAction, suggestedAction: action,
      };
    });
    const since = new Date(now - 7 * 86400000).toISOString();
    const sends = await c.from('scope_nurture_sends').select('id').gte('sent_at', since).then(list);
    return {
      leads,
      needsActionCount: leads.filter((l) => l.needsAction).length,
      nurture: { recentSends7d: sends.length },
    };
  });

// ── Client 360 (per-client hub) ──────────────────────────────────────────────
const CLIENT_LINK_MAX = 12;

// Every person in the CRM, newest activity first — the Clients list.
export const clientList = ({ limit = 300 } = {}) =>
  guard((c) => c.from('scope_prospects')
    .select('id,email,name,company,segment,stage,updated_at,created_at')
    .order('updated_at', { ascending: false }).limit(limit).then(list));

// One client's whole world: profile + deals + projects + contracts + files + timeline + money.
export const clientDetail = (id) =>
  guard(async (c) => {
    // Explicit column list (not select('*')) so a future internal-only column can't
    // silently round-trip to the browser via this endpoint.
    const prospect = await c.from('scope_prospects')
      .select('id,email,name,company,segment,stage,source,notes,links,created_at,updated_at')
      .eq('id', id).maybeSingle().then(rows);
    if (!prospect) throw new Error('not_found');
    const email = String(prospect.email || '').toLowerCase();
    const PSEL = 'id,public_id,status,firm_cents,deposit_cents,balance_cents,paid_at,balance_paid_at,client_email,created_at';
    // Match proposals by the CRM link OR the client email — two safe queries, merged (no .or
    // filter-string injection). Parallelize the independent reads to keep the 360 snappy.
    const [byId, byEmail, events] = await Promise.all([
      c.from('scope_proposals').select(PSEL).eq('prospect_id', id).then(list),
      email ? c.from('scope_proposals').select(PSEL).eq('client_email', email).then(list) : Promise.resolve([]),
      c.from('scope_events').select('type,meta,created_at').eq('prospect_id', id).order('created_at', { ascending: false }).limit(50).then(list),
    ]);
    const pmap = new Map(); [...byId, ...byEmail].forEach((p) => pmap.set(p.id, p));
    const proposals = [...pmap.values()].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const propIds = proposals.map((p) => p.id);
    const [projects, contracts] = propIds.length ? await Promise.all([
      c.from('scope_projects').select('id,proposal_id,status,portal_token,created_at').in('proposal_id', propIds).then(list),
      c.from('scope_contracts').select('public_id,proposal_id,status,accepted_at').in('proposal_id', propIds).then(list),
    ]) : [[], []];
    const projIds = projects.map((p) => p.id);
    const files = projIds.length ? await c.from('scope_deliverable_files').select('id,project_id,name,created_at').in('project_id', projIds).order('created_at', { ascending: false }).then(list) : [];
    const sum = (arr, f) => arr.reduce((a, r) => a + (Number(f(r)) || 0), 0);
    const paid = proposals.filter((p) => p.paid_at);
    const balPaid = proposals.filter((p) => p.balance_paid_at);
    const depOnly = paid.filter((p) => !p.balance_paid_at);
    const moneySummary = {
      collectedCents: sum(paid, (r) => r.deposit_cents) + sum(balPaid, (r) => r.balance_cents),
      outstandingCents: sum(depOnly, (r) => r.balance_cents),
      wonCount: paid.length,
    };
    return { prospect, proposals, projects, contracts, files, events, money: moneySummary };
  });

// Save per-client operator notes + external links (validated http(s), clamped).
export const updateClientMeta = (id, { notes, links } = {}) =>
  guard(async (c) => {
    if (!id) throw new Error('id required');
    const patch = { updated_at: new Date().toISOString() };
    if (notes !== undefined) patch.notes = notes ? String(notes).slice(0, 20000) : null;
    if (links !== undefined) {
      if (!Array.isArray(links)) throw new Error('invalid links');
      patch.links = links.slice(0, CLIENT_LINK_MAX)
        .map((l) => ({ label: String((l && l.label) || '').slice(0, 60), url: String((l && l.url) || '').slice(0, 500) }))
        .filter((l) => l.label && /^https?:\/\//i.test(l.url));
    }
    const row = await c.from('scope_prospects').update(patch).eq('id', id).select('id').then(first);
    if (!row) throw new Error('not_found');
    return { id };
  });

// Pipeline counts by stage, for the operator dashboard header.
export const prospectStageCounts = () =>
  guard(async (c) => {
    const stageRows = await c.from('scope_prospects').select('stage').then(list);
    const counts = { new: 0, scoped: 0, engaged: 0, won: 0, lost: 0 };
    stageRows.forEach((r) => { if (counts[r.stage] != null) counts[r.stage]++; });
    return counts;
  });
