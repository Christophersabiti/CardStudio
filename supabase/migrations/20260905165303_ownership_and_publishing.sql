-- Additive migration. Existing anonymous links retain their published content.
-- User mutations go through validated, rate-limited server endpoints. Browser
-- clients receive SELECT only, with ownership RLS; no direct write bypass.
alter table public.cards
  add column owner_id uuid references auth.users(id) on delete restrict,
  add column published boolean not null default false,
  add column published_data jsonb,
  add column deleted_at timestamptz,
  add column revision integer not null default 0;
alter table public.groups
  add column owner_id uuid references auth.users(id) on delete restrict,
  add column published boolean not null default false,
  add column published_data jsonb,
  add column deleted_at timestamptz,
  add column revision integer not null default 0;
update public.cards set published = true, published_data = data;
update public.groups set published = true, published_data = data;
alter table public.cards add constraint cards_public_snapshot check (not published or (published_data is not null and deleted_at is null));
alter table public.groups add constraint groups_public_snapshot check (not published or (published_data is not null and deleted_at is null));
create index cards_owner_idx on public.cards(owner_id, created_at desc);
create index groups_owner_idx on public.groups(owner_id, created_at desc);
create index cards_public_photo_idx on public.cards((published_data->>'photo')) where published and deleted_at is null;
create index cards_public_logo_idx on public.cards((published_data->>'logo')) where published and deleted_at is null;
revoke all on public.cards, public.groups from anon, authenticated;
grant select on public.cards, public.groups to authenticated;
grant all on public.cards, public.groups to service_role;
create policy cards_owner_read on public.cards for select to authenticated using ((select auth.uid()) = owner_id);
create policy groups_owner_read on public.groups for select to authenticated using ((select auth.uid()) = owner_id);

-- No public execution of privileged counters.
revoke all on function public.increment_card_views(text) from public, anon, authenticated;
revoke all on function public.increment_group_views(text) from public, anon, authenticated;
grant execute on function public.increment_card_views(text), public.increment_group_views(text) to service_role;
alter function public.set_updated_at() set search_path = '';

create table public.card_studio_limits (
  key text primary key,
  hits integer not null,
  expires_at timestamptz not null
);
alter table public.card_studio_limits enable row level security;
revoke all on public.card_studio_limits from anon, authenticated;
grant all on public.card_studio_limits to service_role;
create index card_studio_limits_expiry_idx on public.card_studio_limits(expires_at);
create function public.consume_card_studio_limit(bucket_key text, max_requests integer, window_seconds integer)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare used integer;
begin
  if max_requests < 1 or window_seconds < 1 or window_seconds > 86400 then raise exception 'Invalid limit'; end if;
  delete from public.card_studio_limits where expires_at < now() - interval '1 day';
  insert into public.card_studio_limits as limits(key,hits,expires_at)
    values(bucket_key,1,now() + make_interval(secs => window_seconds))
  on conflict(key) do update set
    hits = case when limits.expires_at <= now() then 1 else least(limits.hits + 1, max_requests + 1) end,
    expires_at = case when limits.expires_at <= now() then now() + make_interval(secs => window_seconds) else limits.expires_at end
  returning hits into used;
  return used <= max_requests;
end;
$$;
revoke all on function public.consume_card_studio_limit(text,integer,integer) from public,anon,authenticated;
grant execute on function public.consume_card_studio_limit(text,integer,integer) to service_role;

create table public.card_studio_media (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  path text unique not null,
  created_at timestamptz not null default now()
);
create index card_studio_media_owner_idx on public.card_studio_media(owner_id);
alter table public.card_studio_media enable row level security;
revoke all on public.card_studio_media from anon,authenticated;
grant select on public.card_studio_media to authenticated;
grant all on public.card_studio_media to service_role;
create policy media_owner_read on public.card_studio_media for select to authenticated using ((select auth.uid()) = owner_id);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('card-studio-private','card-studio-private',false,1000000,array['image/png','image/jpeg','image/webp']);
-- No anon/authenticated storage policies: media is served through a revocable
-- application endpoint which checks ownership or a published card reference.
