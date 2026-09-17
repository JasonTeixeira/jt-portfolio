-- Scope Studio persistence — namespaced to coexist in the shared sageideas project.
create extension if not exists "pgcrypto";

create table if not exists scope_prospects (
  id uuid primary key,                    -- equals the client's localStorage prospect_id
  email text,
  name text,
  company text,
  segment text,
  stage text not null default 'new',      -- new | scoped | engaged | won | lost
  qualification jsonb default '{}'::jsonb,
  source text default 'inbound',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists scope_plans (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references scope_prospects(id) on delete cascade,
  keys text[] not null default '{}',
  segment text,
  total_lo int, total_hi int,
  flags jsonb default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists scope_conversations (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references scope_prospects(id) on delete cascade,
  transcript jsonb not null default '[]'::jsonb,
  mode text,
  created_at timestamptz not null default now()
);
create table if not exists scope_events (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references scope_prospects(id) on delete cascade,
  type text not null,                     -- started | questioned | plan_built | lead_captured | handoff_clicked
  meta jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists scope_plans_prospect on scope_plans(prospect_id);
create index if not exists scope_events_prospect on scope_events(prospect_id);
create index if not exists scope_prospects_stage on scope_prospects(stage);

-- RLS: deny anon entirely; only the service role (server-side) may touch these.
alter table scope_prospects enable row level security;
alter table scope_plans enable row level security;
alter table scope_conversations enable row level security;
alter table scope_events enable row level security;
-- (No policies created → anon/authed clients get zero access. Service role bypasses RLS.)

-- ============================================================================
-- P5: Close → Cash (proposals + projects). Money is in CENTS here.
-- ============================================================================
create table if not exists scope_proposals (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique,           -- unguessable client URL slug (>=128 bits)
  prospect_id uuid references scope_prospects(id) on delete set null,
  keys text[] not null default '{}',        -- capability keys (scope snapshot)
  segment text,
  band_lo int, band_hi int,                 -- dollars, from computePlan totalBand at draft time
  firm_cents int not null,                  -- server-computed midpoint; admin-editable
  deposit_pct numeric not null default 0.30,
  deposit_cents int not null,
  balance_cents int not null,               -- recorded; collection is a later plan
  currency text not null default 'usd',
  scope_note text,                          -- Jason's optional note on the offer
  terms_version text not null,
  status text not null default 'draft_pending', -- draft_pending|approved|deposit_paid|expired|declined
  accepted_name text,                       -- acceptance artifact (captured at checkout)
  accepted_at timestamptz,
  accept_ip text,
  accept_terms_version text,
  stripe_session_id text,
  stripe_payment_intent text,
  client_email text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  paid_at timestamptz
);
create table if not exists scope_projects (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references scope_proposals(id) on delete cascade,
  prospect_id uuid references scope_prospects(id) on delete set null,
  status text not null default 'kickoff',
  created_at timestamptz not null default now()
);
create unique index if not exists scope_proposals_public on scope_proposals(public_id);
create index if not exists scope_proposals_status on scope_proposals(status);
create unique index if not exists scope_projects_proposal on scope_projects(proposal_id); -- one project per proposal (idempotency)
alter table scope_proposals enable row level security;
alter table scope_projects enable row level security;
-- (No policies created → deny-all-anon; service role bypasses RLS.)

-- ============================================================================
-- P4: Nurture (suppression flags + idempotent send log). Automated follow-ups.
-- ============================================================================
alter table scope_prospects add column if not exists unsubscribed boolean not null default false;
alter table scope_prospects add column if not exists nurture_suppressed boolean not null default false;
alter table scope_prospects add column if not exists unsubscribe_token text;

create table if not exists scope_nurture_sends (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid references scope_prospects(id) on delete cascade,
  proposal_id uuid references scope_proposals(id) on delete cascade,
  step text not null,
  sent_at timestamptz not null default now()
);
-- Idempotency: one send per (proposal, step) for proposal touches, one per (prospect, step) for lead touches.
create unique index if not exists nurture_send_proposal on scope_nurture_sends(proposal_id, step) where proposal_id is not null;
create unique index if not exists nurture_send_prospect on scope_nurture_sends(prospect_id, step) where proposal_id is null;
create index if not exists nurture_send_prospect_all on scope_nurture_sends(prospect_id);
alter table scope_nurture_sends enable row level security;
-- (No policies created → deny-all-anon; service role bypasses RLS.)

-- ============================================================================
-- P6: Client portal (milestones) + auto-generated contracts. Money in CENTS.
-- ============================================================================
alter table scope_projects add column if not exists portal_token text;
create unique index if not exists scope_projects_portal on scope_projects(portal_token) where portal_token is not null;

create table if not exists scope_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references scope_projects(id) on delete cascade,
  seq int not null default 0,
  title text not null,
  deliverables text,
  amount_cents int not null default 0,
  status text not null default 'pending',   -- pending | in_progress | delivered | approved
  due_at timestamptz,
  delivered_at timestamptz,
  approved_at timestamptz,
  approved_name text,
  created_at timestamptz not null default now()
);
create index if not exists scope_milestones_project on scope_milestones(project_id, seq);

create table if not exists scope_contracts (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique,
  proposal_id uuid references scope_proposals(id) on delete set null,
  project_id uuid references scope_projects(id) on delete set null,
  kind text not null default 'sow',          -- sow | msa
  body jsonb not null,
  terms_version text not null,
  status text not null default 'draft',       -- draft | sent | accepted | declined
  client_email text,
  accepted_name text,
  accepted_at timestamptz,
  accept_ip text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create unique index if not exists scope_contracts_public on scope_contracts(public_id);
alter table scope_milestones enable row level security;
alter table scope_contracts enable row level security;
-- (No policies → deny-all-anon; service role bypasses.)

-- ============================================================================
-- Client <-> operator message thread (per project). Service-role only.
-- ============================================================================
create table if not exists scope_messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references scope_projects(id) on delete cascade,
  sender text not null check (sender in ('client','operator')),
  body text not null,
  created_at timestamptz not null default now(),
  read_by_operator_at timestamptz,
  read_by_client_at timestamptz
);
create index if not exists scope_messages_project on scope_messages(project_id, created_at);
alter table scope_messages enable row level security;

-- ============================================================================
-- Deliverable files (private 'deliverables' bucket; access via signed URLs only).
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit)
values ('deliverables', 'deliverables', false, 52428800)
on conflict (id) do nothing;

-- Client message attachments: a SEPARATE private bucket with a hard 25MB ceiling,
-- enforced by storage itself (the app's own size check is client-reported and advisory).
-- Isolated from 'deliverables' so a casual client upload can never collide with an operator file.
insert into storage.buckets (id, name, public, file_size_limit)
values ('message-uploads', 'message-uploads', false, 26214400)
on conflict (id) do update set file_size_limit = excluded.file_size_limit;

create table if not exists scope_deliverable_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references scope_projects(id) on delete cascade,
  milestone_id uuid references scope_milestones(id) on delete set null,
  name text not null,
  storage_path text not null,
  size_bytes bigint,
  content_type text,
  created_at timestamptz not null default now()
);
create index if not exists scope_deliverable_files_project on scope_deliverable_files(project_id, created_at);
alter table scope_deliverable_files enable row level security;

-- Balance payment (separate from the deposit which uses paid_at/status).
alter table scope_proposals add column if not exists balance_paid_at timestamptz;
alter table scope_proposals add column if not exists balance_stripe_session text;

-- ── Calendar & scheduling (operator cockpit; service-role only, RLS deny-all) ──
create table if not exists scope_calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  kind text not null default 'meeting' check (kind in ('meeting','call','deadline','task','reminder')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  location text,
  url text,
  notes text,
  status text not null default 'scheduled' check (status in ('scheduled','done','canceled')),
  prospect_id uuid references scope_prospects(id) on delete set null,
  project_id uuid references scope_projects(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_scope_cal_starts on scope_calendar_events (starts_at);
create index if not exists idx_scope_cal_prospect on scope_calendar_events (prospect_id);
create index if not exists idx_scope_cal_project on scope_calendar_events (project_id);
alter table scope_calendar_events enable row level security;

-- ── Tasks & budgets (operator cockpit ③; service-role only, RLS deny-all) ──
create table if not exists scope_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  status text not null default 'todo' check (status in ('todo','doing','done','blocked')),
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  due_at timestamptz,
  notes text,
  position double precision not null default 0,
  proposal_id uuid references scope_proposals(id) on delete set null,
  project_id uuid references scope_projects(id) on delete set null,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_scope_tasks_status on scope_tasks (status);
create index if not exists idx_scope_tasks_due on scope_tasks (due_at);
create index if not exists idx_scope_tasks_proposal on scope_tasks (proposal_id);
alter table scope_tasks enable row level security;

create table if not exists scope_project_costs (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references scope_proposals(id) on delete cascade,
  label text not null,
  kind text not null default 'other' check (kind in ('subcontractor','tool','ads','fees','other')),
  amount_cents integer not null default 0 check (amount_cents >= 0),
  incurred_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_scope_costs_proposal on scope_project_costs (proposal_id);
alter table scope_project_costs enable row level security;

-- Fix: scope_prospects.id had no default, so every prospect insert (createProspect,
-- scope-funnel upsert, contact-form capture) failed silently. Match sibling scope_* tables.
alter table scope_prospects alter column id set default gen_random_uuid();

-- ── Content studio (operator cockpit ⑤; service-role only, RLS deny-all) ──
create table if not exists scope_content (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  channel text not null default 'blog' check (channel in ('blog','linkedin','x','instagram','youtube','newsletter','other')),
  status text not null default 'idea' check (status in ('idea','draft','scheduled','published')),
  notes text,
  url text,
  scheduled_for timestamptz,
  published_at timestamptz,
  position double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_scope_content_status on scope_content (status);
create index if not exists idx_scope_content_scheduled on scope_content (scheduled_for);
alter table scope_content enable row level security;

-- Client 360 hub: per-client operator notes + external links (GitHub/Drive/Figma).
alter table scope_prospects add column if not exists notes text;
alter table scope_prospects add column if not exists links jsonb not null default '[]'::jsonb;

-- Per-client manual onboarding-step state (server-persisted, keyed by Supabase Auth
-- user id). Applied 2026-09-08. Service-role only; the /api/client-onboarding endpoint
-- verifies the caller's JWT and scopes every row to their own user_id.
create table if not exists public.scope_client_onboarding (
  user_id uuid primary key,
  steps jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.scope_client_onboarding enable row level security;

-- ── Admin Foundation (2026-09-16): GTM weekly tracker + invoices ─────────────
-- All service-role only, RLS deny-all (operator cockpit surfaces).

-- Weekly GTM scoreboard — replaces the browser-localStorage ops.html sheet with a
-- server-persisted, history-keeping record. One row per week; `data` holds the
-- metric inputs, retro note, and mini-eval queue as a flexible jsonb blob.
create table if not exists scope_gtm_weeks (
  id uuid primary key default gen_random_uuid(),
  week_of date not null unique,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_scope_gtm_week on scope_gtm_weeks (week_of desc);
alter table scope_gtm_weeks enable row level security;

-- Invoices — real numbered records for deposit / balance / full amounts. Payment
-- status is derived from the proposal ledger (paid_at / balance_paid_at), so an
-- invoice never disagrees with what Stripe actually collected. Human-readable
-- number comes from a dedicated sequence (INV-1001, INV-1002, …).
create sequence if not exists scope_invoice_seq start 1001;
create table if not exists scope_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_no bigint not null default nextval('scope_invoice_seq'),
  proposal_id uuid not null references scope_proposals(id) on delete cascade,
  kind text not null check (kind in ('deposit','balance','full')),
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'usd',
  status text not null default 'draft' check (status in ('draft','sent','void')),
  issued_at timestamptz not null default now(),
  sent_at timestamptz,
  due_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_scope_invoices_proposal on scope_invoices (proposal_id);
create index if not exists idx_scope_invoices_status on scope_invoices (status);
alter table scope_invoices enable row level security;

-- ── Email suppression list (2026-09-16): fed by the Resend bounce/complaint webhook ──
-- Address-keyed; blocks ALL mail to a hard-bounced or spam-complained address. Distinct
-- from prospect-level marketing unsubscribe. Service-role only, RLS deny-all.
create table if not exists scope_email_suppressions (
  email text primary key,
  reason text not null check (reason in ('bounce','complaint','manual')),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_scope_suppressions_reason on scope_email_suppressions (reason);
alter table scope_email_suppressions enable row level security;

-- ── Operator audit log (2026-09-16): write-path accountability, service-role only ──
create table if not exists scope_audit (
  id uuid primary key default gen_random_uuid(),
  actor text not null,
  action text not null,
  target_type text,
  target_id text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_scope_audit_created on scope_audit (created_at desc);
create index if not exists idx_scope_audit_action on scope_audit (action);
alter table scope_audit enable row level security;

-- ── Client notification prefs (2026-09-16): keyed by client email, RLS deny-all ──
create table if not exists scope_client_prefs (
  email text primary key,
  notify_updates boolean not null default true,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table scope_client_prefs enable row level security;

-- ── Message attachments (2026-09-16): optional single file per portal message ──
alter table scope_messages
  add column if not exists attachment_path text,
  add column if not exists attachment_name text,
  add column if not exists attachment_size integer,
  add column if not exists attachment_type text;

-- ── Newsletter broadcasts (2026-09-17): operator-sent broadcasts to field-notes subscribers.
-- scope_broadcasts = one row per broadcast; scope_broadcast_sends = per-recipient dedupe/audit.
-- Service-role only, RLS deny-all (subscribers live in scope_prospects source='newsletter').
create table if not exists scope_broadcasts (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  heading text,
  recipient_count int not null default 0,
  sent_count int not null default 0,
  created_at timestamptz not null default now()
);
alter table scope_broadcasts enable row level security;

create table if not exists scope_broadcast_sends (
  broadcast_id uuid not null references scope_broadcasts(id) on delete cascade,
  email text not null,
  sent_at timestamptz not null default now(),
  primary key (broadcast_id, email)
);
alter table scope_broadcast_sends enable row level security;
