-- Private application interaction deadlines; token refresh does not extend them.
create table public.app_sessions(session_id text primary key, clerk_user_id text not null, last_activity timestamptz not null default now(), expired boolean not null default false);
alter table public.app_sessions enable row level security;
revoke all on public.app_sessions from anon,authenticated;
grant all on public.app_sessions to service_role;
create function public.check_app_session(sid text, subject text, touch boolean default false) returns jsonb language plpgsql security invoker set search_path=public as $$
declare s public.app_sessions;
begin
 insert into public.app_sessions(session_id,clerk_user_id) values(sid,subject) on conflict do nothing;
 select * into s from public.app_sessions where session_id=sid for update;
 if s.clerk_user_id<>subject then return jsonb_build_object('active',false); end if;
 if s.expired or s.last_activity <= clock_timestamp()-interval '15 minutes' then
  update public.app_sessions set expired=true where session_id=sid;
  return jsonb_build_object('active',false);
 end if;
 if touch then update public.app_sessions set last_activity=clock_timestamp() where session_id=sid returning * into s; end if;
 return jsonb_build_object('active',true,'remaining',greatest(0,extract(epoch from (s.last_activity+interval '15 minutes'-clock_timestamp()))));
end $$;
revoke all on function public.check_app_session(text,text,boolean) from public,anon,authenticated;
grant execute on function public.check_app_session(text,text,boolean) to service_role;

alter table public.users add column onboarding_complete boolean not null default false;
update public.users set onboarding_complete=true;
create table public.draft_recovery(owner_id uuid references public.users(id) on delete cascade, draft_key text not null check(length(draft_key)<80), snapshot jsonb not null check(octet_length(snapshot::text)<=1500000), updated_at timestamptz not null default now(),primary key(owner_id,draft_key));
alter table public.draft_recovery enable row level security;
revoke all on public.draft_recovery from anon,authenticated;
grant all on public.draft_recovery to service_role;

alter table public.commercial_settings add column upgrade_threshold integer not null default 80 check(upgrade_threshold between 1 and 100);
create table public.plan_presentation(plan_id uuid primary key references public.plans(id), audience text not null default '' check(length(audience)<=200), description text not null default '' check(length(description)<=600), display_order integer not null default 0, recommended boolean not null default false, upgrade_codes text[] not null default '{}', features text[] not null default '{}');
alter table public.plan_presentation enable row level security;
revoke all on public.plan_presentation from anon,authenticated;
grant all on public.plan_presentation to service_role;
insert into public.plan_presentation(plan_id,audience,display_order,upgrade_codes) select id,case code when 'free' then 'For your first introductions' when 'basic' then 'For growing professional networks' else 'For larger contact collections' end,case code when 'free' then 0 when 'basic' then 1 else 2 end,case code when 'free' then array['basic','premium'] when 'basic' then array['premium'] else array[]::text[] end from public.plans;

-- A server-only combined search, scoped before filtering and pagination.
create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;
create function public.normalize_card_search(value text) returns text language sql immutable parallel safe set search_path=public as $$
 select trim(regexp_replace(translate(lower(value),'àáâãäåèéêëìíîïòóôõöùúûüñç','aaaaaaeeeeiiiiooooouuuunc'),'[^[:alnum:]@]+',' ','g'))
$$;
create function public.card_search_text(content jsonb) returns text language sql immutable parallel safe set search_path=public as $$
 select public.normalize_card_search(coalesce(string_agg((value #>> '{}') || ' ' || case when (value #>> '{}') ~ '^\+?[0-9 () .-]+$' then regexp_replace(value #>> '{}','[^0-9]','','g') else '' end,' '),'')) from jsonb_path_query(content - 'photo' - 'logo' - 'orientation' - 'accent', '$.** ? (@.type() == "string")') v(value)
$$;
alter table public.cards add column search_text text generated always as (public.card_search_text(data)) stored;
alter table public.groups add column search_text text generated always as (public.card_search_text(data)) stored;
create index cards_search_idx on public.cards using gin(search_text extensions.gin_trgm_ops);
create index groups_search_idx on public.groups using gin(search_text extensions.gin_trgm_ops);
create index cards_owner_updated_idx on public.cards(owner_id,updated_at desc,id);
create index groups_owner_updated_idx on public.groups(owner_id,updated_at desc,id);
create function public.search_owned_cards(account_id uuid, query text default '', trash boolean default false, page_number integer default 1) returns jsonb language sql stable security invoker set search_path=public as $$
 with tokens as (select regexp_split_to_array(public.normalize_card_search(left(query,120)),'\s+') terms), matches as (
 select 'cards'::text kind,to_jsonb(c)-'search_text' record,c.updated_at,c.id from public.cards c,tokens t where c.owner_id=account_id and (c.deleted_at is not null)=trash and c.search_text like all(array(select '%'||term||'%' from unnest(t.terms) term))
 union all
 select 'groups',to_jsonb(g)-'search_text',g.updated_at,g.id from public.groups g,tokens t where g.owner_id=account_id and (g.deleted_at is not null)=trash and g.search_text like all(array(select '%'||term||'%' from unnest(t.terms) term))
 ), paged as(select record||jsonb_build_object('kind',kind) item from matches order by updated_at desc,id,kind limit 24 offset (greatest(1,least(page_number,10000))-1)*24)
 select jsonb_build_object('total',(select count(*) from matches),'items',coalesce((select jsonb_agg(item) from paged),'[]'::jsonb))
$$;
revoke all on function public.search_owned_cards(uuid,text,boolean,integer) from public,anon,authenticated;
grant execute on function public.search_owned_cards(uuid,text,boolean,integer) to service_role;
revoke all on function public.card_search_text(jsonb) from public,anon,authenticated;
grant execute on function public.card_search_text(jsonb) to service_role;

create function public.complete_entitled_onboarding() returns trigger language plpgsql security invoker set search_path=public as $$
begin
 if tg_table_name='account_trials' then update public.users set onboarding_complete=true where id=new.owner_id;
 elsif new.status='active' then update public.users set onboarding_complete=true where id=new.owner_id;
 end if;
 return new;
end $$;
create trigger trial_onboarding after insert on public.account_trials for each row execute function public.complete_entitled_onboarding();
create trigger paid_onboarding after update of status on public.subscriptions for each row execute function public.complete_entitled_onboarding();
revoke all on function public.complete_entitled_onboarding() from public,anon,authenticated;
grant execute on function public.complete_entitled_onboarding() to service_role;
create function public.update_plan_presentation(actor uuid, pid uuid, body jsonb) returns void language plpgsql security invoker set search_path=public as $$
begin
 if not exists(select 1 from public.users where id=actor and app_role='superadmin' and status='active' and not clerk_disabled) then raise insufficient_privilege; end if;
 if pid is null then update public.commercial_settings set upgrade_threshold=(body->>'upgrade_threshold')::integer;
 else insert into public.plan_presentation(plan_id,audience,description,display_order,recommended,upgrade_codes,features) values(pid,body->>'audience',body->>'description',(body->>'display_order')::integer,(body->>'recommended')::boolean,array(select jsonb_array_elements_text(body->'upgrade_codes')),array(select jsonb_array_elements_text(body->'features'))) on conflict(plan_id) do update set audience=excluded.audience,description=excluded.description,display_order=excluded.display_order,recommended=excluded.recommended,upgrade_codes=excluded.upgrade_codes,features=excluded.features;
 end if;
 insert into public.admin_audit(actor_id,action,target_id,details) values(actor,'plan_presentation',pid::text,body);
end $$;
revoke all on function public.update_plan_presentation(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.update_plan_presentation(uuid,uuid,jsonb) to service_role;

revoke all on function public.normalize_card_search(text) from public,anon,authenticated;
grant execute on function public.normalize_card_search(text) to service_role;
