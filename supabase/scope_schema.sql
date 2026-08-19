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
