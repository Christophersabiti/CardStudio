-- Card Studio · group (bulk contacts) schema
-- Run this in the Supabase SQL editor, or via `supabase db push` with the CLI.
-- Requires 0001_init.sql to have already run (uses the same pgcrypto extension).

create table if not exists public.groups (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  data        jsonb not null,
  view_count  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists groups_slug_idx on public.groups (slug);

-- Same access model as `cards`: RLS on, no anon/authenticated policies. The
-- MVP reads and writes only through the server using the service-role key.
alter table public.groups enable row level security;

create or replace function public.increment_group_views(group_slug text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.groups set view_count = view_count + 1 where slug = group_slug;
$$;

drop trigger if exists groups_set_updated_at on public.groups;
create trigger groups_set_updated_at
  before update on public.groups
  for each row execute function public.set_updated_at();
