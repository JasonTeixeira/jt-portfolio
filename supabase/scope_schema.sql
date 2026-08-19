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
