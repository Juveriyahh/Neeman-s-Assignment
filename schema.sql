-- Landing Page Pre-Flight Auditor -- Supabase schema
--
-- The server writes with the service-role key and therefore bypasses RLS.
-- The policies below govern client-side reads by authenticated users.

create extension if not exists "pgcrypto";

create table if not exists public.audit_runs (
  id                      uuid primary key default gen_random_uuid(),
  created_at              timestamptz not null default now(),
  user_id                 uuid references auth.users(id) on delete set null,

  target_url              text not null,
  started_at              timestamptz not null,
  finished_at             timestamptz,
  duration_ms             integer,

  verdict                 text not null check (verdict in ('READY', 'READY_WITH_FIXES', 'NOT_READY')),
  readiness_score         integer not null check (readiness_score between 0 and 100),

  high_count              integer not null default 0,
  medium_count            integer not null default 0,
  low_count               integer not null default 0,

  total_tracking_requests integer not null default 0,
  vendors_detected        text[] not null default '{}',

  ai_available            boolean not null default false,
  headline                text,

  -- The whole report, verbatim. Strings are scrubbed of null bytes and lone
  -- UTF-16 surrogates before insert; jsonb rejects them outright.
  report                  jsonb not null
);

create index if not exists audit_runs_started_at_idx  on public.audit_runs (started_at desc);
create index if not exists audit_runs_user_id_idx     on public.audit_runs (user_id);
create index if not exists audit_runs_target_url_idx  on public.audit_runs (target_url);
create index if not exists audit_runs_verdict_idx     on public.audit_runs (verdict);

alter table public.audit_runs enable row level security;

drop policy if exists "read own audit runs" on public.audit_runs;
create policy "read own audit runs"
  on public.audit_runs for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "insert own audit runs" on public.audit_runs;
create policy "insert own audit runs"
  on public.audit_runs for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "delete own audit runs" on public.audit_runs;
create policy "delete own audit runs"
  on public.audit_runs for delete
  to authenticated
  using (user_id = auth.uid());
