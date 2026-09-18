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

// Anonymous Scope Studio telemetry (a `track('started')` beacon) mints a prospect
// row with NO email so its funnel events have an FK to attach to. Those rows are not
// leads — nobody can be contacted — so every operator-facing "who are my prospects"
// surface filters them out with `.not('email','is',null)`. The rows still exist to
// carry the anonymous funnel events; they just never pollute the pipeline/marketing
// views. (A future retention job can prune stale contactless rows — see batch 2.)
export const listProspects = ({ stage, limit = 200 } = {}) =>
  guard((c) => {
    let q = c.from('scope_prospects')
      .select('id,email,name,company,segment,stage,source,qualification,created_at,updated_at')
      .not('email', 'is', null)
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

    // weekly collected (Monday-keyed, last 12 weeks) for the Overview hero chart + a real
    // week-over-week delta. Zero-filled so the series is continuous, never gappy.
    const mondayOf = (d) => { const x = new Date(d); if (Number.isNaN(x.getTime())) return null; const off = (x.getUTCDay() + 6) % 7; x.setUTCDate(x.getUTCDate() - off); x.setUTCHours(0, 0, 0, 0); return x; };
    const weekBucket = {};
    const bumpW = (iso, cents) => { const m = iso && mondayOf(iso); if (m) { const k = m.toISOString().slice(0, 10); weekBucket[k] = (weekBucket[k] || 0) + (Number(cents) || 0); } };
    paid.forEach((r) => bumpW(r.paid_at, r.deposit_cents));
    balancePaid.forEach((r) => bumpW(r.balance_paid_at, r.balance_cents));
    const thisMon = mondayOf(new Date());
    const weekly = [];
    for (let i = 11; i >= 0; i -= 1) {
      const d = new Date(thisMon); d.setUTCDate(d.getUTCDate() - i * 7);
      const k = d.toISOString().slice(0, 10);
      weekly.push({ week: k, cents: weekBucket[k] || 0 });
    }
    const thisWeekCents = weekly[weekly.length - 1].cents;
    const prevWeekCents = weekly.length > 1 ? weekly[weekly.length - 2].cents : 0;

    return {
      collectedCents, outstandingCents, pipelineCents,
      wonCount, openCount: open.length, avgDealCents,
      monthly, // { 'YYYY-MM': cents }
      weekly, thisWeekCents, prevWeekCents, // weekly series + WoW delta
    };
  });

// Cross-prospect activity feed for the Overview. Embeds the prospect (name/email) for
// context — a default PostgREST left join, so it's resilient even though the schema
// currently requires prospect_id. Newest first.
export const recentActivity = (limit = 24) =>
  guard((c) => {
    const cap = Math.min(Math.max(1, limit | 0), 60);
    // Exclude anonymous-telemetry events (their prospect has no email) at the QUERY level:
    // `!inner` makes the prospect join mandatory and `.not('scope_prospects.email','is',null)`
    // filters on the embedded table, so `limit(cap)` always returns up to `cap` REAL rows —
    // a JS post-filter on an over-fetch could under-return when bot page-loads dominate.
    return c.from('scope_events')
      .select('id,type,meta,created_at,scope_prospects!inner(name,email)')
      .not('scope_prospects.email', 'is', null)
      .order('created_at', { ascending: false }).limit(cap).then(list);
  });

// New leads this week vs last week (by prospect created_at), for a WoW delta.
export const newLeadsWeekDelta = () =>
  guard(async (c) => {
    const mondayOf = (d) => { const x = new Date(d); const off = (x.getUTCDay() + 6) % 7; x.setUTCDate(x.getUTCDate() - off); x.setUTCHours(0, 0, 0, 0); return x; };
    const thisMon = mondayOf(new Date());
    const prevMon = new Date(thisMon); prevMon.setUTCDate(prevMon.getUTCDate() - 7);
    const rows = await c.from('scope_prospects').select('created_at')
      .not('email', 'is', null) // count real leads, not anonymous telemetry rows
      .gte('created_at', prevMon.toISOString()).then(list);
    let now = 0; let prev = 0;
    for (const r of rows) { if (new Date(r.created_at) >= thisMon) now += 1; else prev += 1; }
    return { now, prev };
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

// Outbound engine sink: upsert a SOURCED cold lead (Apollo → verified → AI-scored) into the
// CRM. Deduped by email (find-or-create) so re-running the sourcer is idempotent. Stores the
// fit score + personalized opener + verification status in the `qualification` jsonb so the
// operator board can rank by fit and the outbound sequencer can use the opener. Never
// downgrades an existing prospect's stage, and never overwrites identity fields an operator
// may have edited — only fills blanks (same trust rule as captureInboundLead).
export const upsertOutboundProspect = ({ email, name, company, title, score, tier, reason, opener, verifyStatus, phone, vertical, channel } = {}) =>
  guard(async (c) => {
    const em = String(email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) throw new Error('valid email required');
    const qualification = {
      source: 'outbound', channel: channel ? String(channel).slice(0, 20) : 'apollo', // apollo | places
      score: Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : null,
      tier: ['A', 'B', 'C'].includes(tier) ? tier : null,
      reason: reason ? String(reason).slice(0, 200) : null,
      opener: opener ? String(opener).slice(0, 600) : null,
      title: title ? String(title).slice(0, 160) : null,
      vertical: vertical ? String(vertical).slice(0, 80) : null,
      phone: phone ? String(phone).slice(0, 40) : null,
      verify_status: verifyStatus ? String(verifyStatus).slice(0, 40) : null,
      sourced_at: new Date().toISOString(),
    };
    const existing = await c.from('scope_prospects').select('id,name,company,stage,qualification')
      .eq('email', em).order('created_at', { ascending: false }).limit(1).then(list);
    if (existing.length) {
      const cur = existing[0];
      const patch = { updated_at: new Date().toISOString() };
      if (name && !cur.name) patch.name = String(name).slice(0, 200);
      if (company && !cur.company) patch.company = String(company).slice(0, 200);
      // merge the fresh score over any prior qualification; never touch stage.
      patch.qualification = { ...((cur.qualification && typeof cur.qualification === 'object') ? cur.qualification : {}), ...qualification };
      await c.from('scope_prospects').update(patch).eq('id', cur.id);
      return { prospectId: cur.id, existed: true };
    }
    const created = await c.from('scope_prospects').insert({
      email: em,
      name: name ? String(name).slice(0, 200) : null,
      company: company ? String(company).slice(0, 200) : null,
      stage: 'new',
      source: 'outbound',
      qualification,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).select('id').then(first);
    return { prospectId: created && created.id, existed: false };
  });

// Marketing/outreach cockpit: actionable leads (open stages) ranked by staleness,
// each with a suggested next step, plus recent nurture-send volume. Manual-assist —
// the operator does the sending; this just surfaces who needs a touch and when.
export const marketingSummary = ({ staleDays = 3, limit = 200 } = {}) =>
  guard(async (c) => {
    const now = Date.now();
    const open = await c.from('scope_prospects')
      .select('id,email,name,company,segment,stage,source,created_at,updated_at')
      .not('email', 'is', null) // anonymous telemetry rows are not actionable leads
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
    .not('email', 'is', null) // exclude anonymous telemetry rows (see listProspects)
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
    const [byId, byEmail, events, plans, conversations] = await Promise.all([
      c.from('scope_proposals').select(PSEL).eq('prospect_id', id).then(list),
      email ? c.from('scope_proposals').select(PSEL).eq('client_email', email).then(list) : Promise.resolve([]),
      c.from('scope_events').select('type,meta,created_at').eq('prospect_id', id).order('created_at', { ascending: false }).limit(50).then(list),
      // Dormant scope intelligence — what they scoped + the studio conversation, finally surfaced.
      c.from('scope_plans').select('id,keys,segment,total_lo,total_hi,flags,created_at').eq('prospect_id', id).order('created_at', { ascending: false }).limit(5).then(list),
      c.from('scope_conversations').select('id,transcript,mode,created_at').eq('prospect_id', id).order('created_at', { ascending: false }).limit(1).then(list),
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
    return { prospect, proposals, projects, contracts, files, events, plans, conversations, money: moneySummary };
  });

// Cockpit intelligence: computed at-risk signals + next-best-actions + a weighted pipeline
// forecast, all from the real ledger. Everything here is measured or explicitly an estimate.
export const intelligence = () =>
  guard(async (c) => {
    const now = Date.now();
    const days = (iso) => (iso ? Math.floor((now - new Date(iso).getTime()) / 864e5) : null);
    const [props, prospects] = await Promise.all([
      c.from('scope_proposals').select('public_id,client_email,status,firm_cents,balance_cents,accepted_at,paid_at,balance_paid_at,expires_at,created_at').then(list),
      c.from('scope_prospects').select('name,email,company,stage,updated_at').then(list),
    ]);
    const actions = [];
    // Balance overdue: deposit paid, balance still owed, aged past 14 days.
    for (const p of props) {
      if (p.paid_at && !p.balance_paid_at && (p.balance_cents | 0) > 0) {
        const d = days(p.accepted_at || p.paid_at);
        if (d != null && d >= 14) actions.push({ kind: 'balance', severity: d >= 45 ? 'high' : 'med', label: `Chase balance — ${p.client_email || p.public_id}`, sublabel: `${d}d since booked · balance owed`, cents: p.balance_cents | 0 });
      }
    }
    // Proposal expiring: approved, unpaid, expiry within 7 days (or just lapsed).
    for (const p of props) {
      if (p.status === 'approved' && !p.paid_at && p.expires_at) {
        const left = Math.ceil((new Date(p.expires_at).getTime() - now) / 864e5);
        if (left <= 7) actions.push({ kind: 'expiring', severity: left < 0 ? 'high' : 'med', label: `Proposal ${left < 0 ? 'expired' : 'expiring'} — ${p.client_email || p.public_id}`, sublabel: left < 0 ? `lapsed ${Math.abs(left)}d ago` : `${left}d left · nudge to close`, cents: p.firm_cents | 0 });
      }
    }
    // Engaged prospect gone cold (>14 days no activity).
    for (const pr of prospects) {
      if (pr.stage === 'engaged') {
        const d = days(pr.updated_at);
        if (d != null && d >= 14) actions.push({ kind: 'cold', severity: d >= 30 ? 'high' : 'low', label: `Re-engage — ${pr.name || pr.email || pr.company || 'lead'}`, sublabel: `cold ${d}d · was engaged` });
      }
    }
    // Rank: high → med → low, then by cents desc.
    const rank = { high: 0, med: 1, low: 2 };
    actions.sort((a, b) => (rank[a.severity] - rank[b.severity]) || ((b.cents || 0) - (a.cents || 0)));

    // Weighted pipeline forecast (estimate): open proposals × a coarse close-probability by
    // status. Approved-unpaid weight higher than a raw draft. Labeled as an estimate in the UI.
    const WEIGHT = { approved: 0.5, draft_pending: 0.2 };
    let forecastCents = 0; const fb = {};
    for (const p of props) {
      if (p.paid_at) continue;
      const w = WEIGHT[p.status]; if (!w) continue;
      const c2 = Math.round((p.firm_cents | 0) * w);
      forecastCents += c2; fb[p.status] = (fb[p.status] || 0) + c2;
    }
    return { actions: actions.slice(0, 12), atRiskCount: actions.filter((a) => a.severity === 'high').length, forecastCents, forecastBreakdown: fb };
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

// Server-side conversion funnel over the last `days`, computed from the DURABLE tables
// (not client GA4 — this is ad-block-proof server truth). Each rung is an exact count()
// done server-side (head:true), so it scales without transferring rows:
//   Visited      = every session (each visitor gets one scope_prospects row)
//   Scoped plan  = scope_plans rows (a plan was built)
//   Left email   = scope_prospects with a non-null email (became a contactable lead)
//   Booked       = scope_proposals with a deposit paid
// ofPrev = conversion % from the previous rung; overall = booked / visited.
export const funnelSummary = ({ days = 30 } = {}) =>
  guard(async (c) => {
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const countOf = async (table, build) => {
      let q = c.from(table).select('*', { count: 'exact', head: true }).gte('created_at', since);
      if (build) q = build(q);
      const { count, error } = await q;
      if (error) throw new Error(error.message);
      return count || 0;
    };
    const [visited, scoped, leads, booked] = await Promise.all([
      countOf('scope_prospects'),
      countOf('scope_plans'),
      countOf('scope_prospects', (q) => q.not('email', 'is', null)),
      countOf('scope_proposals', (q) => q.not('paid_at', 'is', null)),
    ]);
    const pct = (num, den) => (den > 0 ? Math.round((num / den) * 1000) / 10 : 0);
    return {
      days,
      stages: [
        { key: 'visited', label: 'Visited', count: visited },
        { key: 'scoped', label: 'Scoped a plan', count: scoped, ofPrev: pct(scoped, visited) },
        { key: 'lead', label: 'Left email', count: leads, ofPrev: pct(leads, scoped) },
        { key: 'booked', label: 'Booked deposit', count: booked, ofPrev: pct(booked, leads) },
      ],
      overall: pct(booked, visited),
    };
  });

// Pipeline counts by stage, for the operator dashboard header.
export const prospectStageCounts = () =>
  guard(async (c) => {
    const stageRows = await c.from('scope_prospects').select('stage')
      .not('email', 'is', null).then(list); // exclude anonymous telemetry rows
    const counts = { new: 0, scoped: 0, engaged: 0, won: 0, lost: 0 };
    stageRows.forEach((r) => { if (counts[r.stage] != null) counts[r.stage]++; });
    return counts;
  });
