-- Card Studio · initial schema
-- Run this in the Supabase SQL editor, or via `supabase db push` with the CLI.

create extension if not exists "pgcrypto";

create table if not exists public.cards (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  data        jsonb not null,
  view_count  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists cards_slug_idx on public.cards (slug);

-- Row Level Security is ENABLED with no anon/authenticated policies on purpose.
-- The MVP reads and writes only through the server using the service-role key,
-- which bypasses RLS. That keeps the table unreachable from the browser and gives
-- you a clean base: when you add auth, add an `owner_id uuid` column and policies
-- like "owners can read/update their own cards" plus a public read policy for
-- published cards.
alter table public.cards enable row level security;

-- Atomic view counter, callable from the server via rpc('increment_card_views').
create or replace function public.increment_card_views(card_slug text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.cards set view_count = view_count + 1 where slug = card_slug;
$$;

-- Keep updated_at fresh on every update.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists cards_set_updated_at on public.cards;
create trigger cards_set_updated_at
  before update on public.cards
  for each row execute function public.set_updated_at();
