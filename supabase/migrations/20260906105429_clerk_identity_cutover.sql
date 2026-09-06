-- Phase 2: apply AFTER saas_foundations and together with the Clerk application
-- cutover. Supabase Auth sessions no longer grant Data API reads after this.
-- Configure Supabase's native Clerk third-party integration before acceptance.
alter table public.users
  add column app_role text not null default 'member' check (app_role in ('member','admin')),
  add column clerk_disabled boolean not null default false,
  add column clerk_event_at bigint not null default -1;

-- Catch accounts created since Phase 1. Preserve all existing owner UUIDs.
-- An anonymous Auth account that owns old content is quarantined, not claimable.
insert into public.users(id,legacy_supabase_user_id,status,created_at)
select a.id,a.id,case when coalesce(a.is_anonymous,false) then 'disabled' else 'active' end,a.created_at
from auth.users a where not coalesce(a.is_anonymous,false)
  or exists(select 1 from public.cards c where c.owner_id=a.id)
  or exists(select 1 from public.groups g where g.owner_id=a.id)
  or exists(select 1 from public.card_studio_media m where m.owner_id=a.id)
on conflict(id) do nothing;
-- Only server-controlled legacy app_metadata can migrate administrator status.
update public.users u set app_role='admin' from auth.users a
where u.legacy_supabase_user_id=a.id and not coalesce(a.is_anonymous,false)
  and a.raw_app_meta_data->>'card_studio_role'='admin';
insert into public.profiles(user_id) select id from public.users on conflict(user_id) do nothing;
insert into public.subscriptions(owner_id,plan_id)
select u.id,p.id from public.users u cross join public.plans p where p.code='free' and p.enabled
on conflict(owner_id) do nothing;

alter table public.cards drop constraint cards_owner_id_fkey;
alter table public.cards add constraint cards_owner_id_fkey foreign key(owner_id) references public.users(id) on delete restrict;
alter table public.groups drop constraint groups_owner_id_fkey;
alter table public.groups add constraint groups_owner_id_fkey foreign key(owner_id) references public.users(id) on delete restrict;
alter table public.card_studio_media drop constraint card_studio_media_owner_id_fkey;
alter table public.card_studio_media add constraint card_studio_media_owner_id_fkey foreign key(owner_id) references public.users(id) on delete restrict;

grant select on public.users to authenticated;
create policy users_clerk_read on public.users for select to authenticated
using (clerk_user_id=(select auth.jwt()->>'sub') and status='active' and not clerk_disabled);

-- SECURITY INVOKER: the users policy above is deliberately direct, avoiding
-- recursive RLS. The trusted Clerk JWT is validated by Supabase, not this SQL.
create function public.current_app_user_id() returns uuid
language sql stable security invoker set search_path='' as $$
  select id from public.users where clerk_user_id=(select auth.jwt()->>'sub')
    and status='active' and not clerk_disabled
$$;
revoke all on function public.current_app_user_id() from public,anon;
grant execute on function public.current_app_user_id() to authenticated,service_role;
drop policy cards_owner_read on public.cards;
drop policy groups_owner_read on public.groups;
drop policy media_owner_read on public.card_studio_media;
do $$ declare t text; begin
  foreach t in array array['cards','groups','card_studio_media','qr_codes','group_cards',
    'subscriptions','billing_orders','payments','subscription_events','usage_counters'] loop
    grant usage on schema public to authenticated;
    execute format('grant select on public.%I to authenticated',t);
    execute format('create policy %I on public.%I for select to authenticated using (owner_id=(select public.current_app_user_id()))',t || '_clerk_read',t);
  end loop;
end $$;
grant select on public.profiles to authenticated;
create policy profiles_clerk_read on public.profiles for select to authenticated
using (user_id=(select public.current_app_user_id()));
-- Catalog is server-read for now; raw webhook/usage event payloads stay private.

create function public.ensure_clerk_user(verified_clerk_id text,display_name text default '')
returns public.users language plpgsql security invoker set search_path='' as $$
declare account public.users; free_plan uuid;
begin
  if verified_clerk_id is null or verified_clerk_id !~ '^user_[A-Za-z0-9]+$' then
    raise exception 'Invalid verified identity' using errcode='22023';
  end if;
  insert into public.users(clerk_user_id) values(verified_clerk_id) on conflict(clerk_user_id) do nothing;
  select * into account from public.users where clerk_user_id=verified_clerk_id for update;
  if account.status <> 'active' or account.clerk_disabled then
    raise exception 'Account unavailable' using errcode='42501';
  end if;
  insert into public.profiles(user_id,display_name) values(account.id,left(coalesce(display_name,''),200))
    on conflict(user_id) do nothing;
  select id into free_plan from public.plans where code='free' and enabled;
  if free_plan is null then raise exception 'Free plan unavailable'; end if;
  insert into public.subscriptions(owner_id,plan_id) values(account.id,free_plan) on conflict(owner_id) do nothing;
  return account;
end $$;
revoke all on function public.ensure_clerk_user(text,text) from public,anon,authenticated;
grant execute on function public.ensure_clerk_user(text,text) to service_role;

create table public.clerk_webhook_events (
  event_id text primary key,
  clerk_user_id text not null,
  event_type text not null check(event_type in ('user.created','user.updated','user.deleted')),
  event_at bigint not null check(event_at >= 0),
  processed_at timestamptz not null default now()
);
alter table public.clerk_webhook_events enable row level security;
revoke all on public.clerk_webhook_events from public,anon,authenticated;
grant all on public.clerk_webhook_events to service_role;
create policy clerk_events_server on public.clerk_webhook_events for all to service_role using(true) with check(true);

-- Signature verification occurs in the server handler BEFORE this service-only
-- RPC. Event receipt and account changes commit atomically, so retry is safe.
create function public.sync_clerk_user_event(event_id text,verified_clerk_id text,event_type text,
  event_at bigint,display_name text default '',provider_disabled boolean default false)
returns boolean language plpgsql security invoker set search_path='' as $$
declare account public.users; inserted integer;
begin
  if verified_clerk_id is null or verified_clerk_id !~ '^user_[A-Za-z0-9]+$'
    or event_type not in ('user.created','user.updated','user.deleted') or event_at < 0
    or event_id is null or length(event_id) not between 1 and 200 then
    raise exception 'Invalid event' using errcode='22023';
  end if;
  insert into public.clerk_webhook_events(event_id,clerk_user_id,event_type,event_at)
    values(event_id,verified_clerk_id,event_type,event_at) on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted=0 then return false; end if;
  insert into public.users(clerk_user_id) values(verified_clerk_id) on conflict(clerk_user_id) do nothing;
  select * into account from public.users where clerk_user_id=verified_clerk_id for update;
  -- A deleted identity is a permanent tombstone, even if create/update arrives
  -- late or first login races with deletion. Local administrative blocks persist.
  if event_type='user.deleted' then
    update public.users set status='deleted',clerk_disabled=true,
      clerk_event_at=greatest(clerk_event_at,event_at) where id=account.id;
  elsif account.status <> 'deleted' and event_at > account.clerk_event_at then
    update public.users set clerk_disabled=coalesce(provider_disabled,false),clerk_event_at=event_at where id=account.id;
    insert into public.profiles(user_id,display_name) values(account.id,left(coalesce(display_name,''),200))
      on conflict(user_id) do update set display_name=excluded.display_name;
  end if;
  -- Webhooks do not resurrect disabled users or delete financial/resource data.
  -- First verified login provisions the Free subscription even without webhooks.
  return true;
end $$;
revoke all on function public.sync_clerk_user_event(text,text,text,bigint,text,boolean) from public,anon,authenticated;
grant execute on function public.sync_clerk_user_event(text,text,text,bigint,text,boolean) to service_role;

-- Administrator-assisted, explicit identity link BEFORE first Clerk login.
-- No email auto-claim and no silent merging of a separately provisioned account.
create function public.link_legacy_clerk_identity(legacy_user_id uuid,verified_clerk_id text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare account public.users;
begin
  if verified_clerk_id is null or verified_clerk_id !~ '^user_[A-Za-z0-9]+$' then
    raise exception 'Invalid verified identity' using errcode='22023';
  end if;
  select * into account from public.users where legacy_supabase_user_id=legacy_user_id for update;
  if not found or account.status <> 'active' then raise exception 'Legacy account unavailable' using errcode='42501'; end if;
  if account.clerk_user_id is not null and account.clerk_user_id <> verified_clerk_id then
    raise exception 'Legacy account already linked' using errcode='23505';
  end if;
  update public.users set clerk_user_id=verified_clerk_id where id=account.id;
  return account.id;
end $$;
revoke all on function public.link_legacy_clerk_identity(uuid,text) from public,anon,authenticated;
grant execute on function public.link_legacy_clerk_identity(uuid,text) to service_role;
