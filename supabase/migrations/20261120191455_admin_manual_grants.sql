-- Manual plan grants for payments collected outside Card Studio, an administrator
-- account directory, and product feature switches. All functions are callable by
-- the service role only and re-check that the actor is an active superadmin.

-- 1. Administrator-granted periods have no catalog price or payment provider record.
do $$ declare c record; begin
 for c in select conname, pg_get_constraintdef(oid) def from pg_constraint
   where conrelid='public.subscriptions'::regclass and contype='c' loop
  if c.def like '%provider%pesapal%' or c.def like '%price_id IS NOT NULL%' then
   execute format('alter table public.subscriptions drop constraint %I', c.conname);
  end if;
 end loop;
end $$;
alter table public.subscriptions add constraint subscriptions_provider_check
 check (provider in ('pesapal','paypal','manual'));
alter table public.subscriptions add constraint subscriptions_period_check
 check ((status = 'free' and price_id is null and current_period_start is null and current_period_end is null)
   or (status <> 'free' and (price_id is not null or provider = 'manual')
     and current_period_start is not null and current_period_end is not null
     and current_period_end > current_period_start));

create table public.manual_grants(
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.users(id) on delete restrict,
 subscription_id uuid not null,
 plan_id uuid not null references public.plans(id) on delete restrict,
 granted_by uuid not null references public.users(id) on delete restrict,
 months integer not null check (months between 1 and 24),
 period_start timestamptz not null,
 period_end timestamptz not null,
 payment_reference text not null check (length(payment_reference) between 2 and 120),
 note text not null default '' check (length(note) <= 500),
 amount_minor bigint check (amount_minor is null or amount_minor >= 0),
 currency text check (currency is null or currency in ('UGX','KES','USD')),
 -- What the subscription looked like before, so revoking the latest grant can restore it.
 previous jsonb not null,
 revoked_at timestamptz,
 revoked_by uuid references public.users(id) on delete restrict,
 revoke_reason text check (revoke_reason is null or length(revoke_reason) between 5 and 300),
 created_at timestamptz not null default now(),
 foreign key(subscription_id, owner_id) references public.subscriptions(id, owner_id) on delete restrict,
 check (period_end > period_start),
 check ((amount_minor is null) = (currency is null)),
 check ((revoked_at is null) = (revoked_by is null) and (revoked_at is null) = (revoke_reason is null))
);
create index manual_grants_owner_idx on public.manual_grants(owner_id, created_at desc);
create index manual_grants_end_idx on public.manual_grants(period_end) where revoked_at is null;

create table public.feature_flags(
 key text primary key check (key in ('cards','groups','qr_codes','email_signature','stamps','print_package')),
 enabled boolean not null default true,
 updated_by uuid references public.users(id) on delete restrict,
 updated_at timestamptz not null default now()
);
insert into public.feature_flags(key) values ('cards'),('groups'),('qr_codes'),('email_signature'),('stamps'),('print_package');

do $$ declare t text; begin
 foreach t in array array['manual_grants','feature_flags'] loop
  execute format('alter table public.%I enable row level security', t);
  execute format('revoke all on public.%I from public, anon, authenticated', t);
  execute format('grant all on public.%I to service_role', t);
  execute format('create policy %I on public.%I for all to service_role using (true) with check (true)', t||'_server', t);
 end loop;
end $$;

create function public.require_superadmin(actor uuid) returns void language plpgsql stable security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.users where id=actor and app_role='superadmin' and status='active' and not clerk_disabled) then
  raise exception 'Superadmin required' using errcode='42501';
 end if;
end $$;

-- 2. Grant a plan. The same plan extends from the current end date; a different plan starts now.
create function public.admin_grant_plan(actor uuid, target uuid, selected_plan uuid, months integer,
  reference text, note text default '', amount bigint default null, amount_currency text default null)
returns public.manual_grants language plpgsql security invoker set search_path='' as $$
declare s public.subscriptions; p public.plans; starts timestamptz; finish timestamptz; extending boolean; result public.manual_grants;
begin
 perform public.require_superadmin(actor);
 if months is null or months not between 1 and 24 then raise exception 'Choose between 1 and 24 months' using errcode='23514'; end if;
 if length(trim(coalesce(reference,''))) < 2 then raise exception 'Enter the payment reference' using errcode='23514'; end if;
 perform 1 from public.users where id=target and status='active' and not clerk_disabled for update;
 if not found then raise exception 'Account unavailable'; end if;
 select pl.* into p from public.plans pl where pl.id=selected_plan and pl.code in ('basic','premium') and pl.enabled and pl.effective_at<=now()
  and pl.id=(select c.id from public.plans c where c.code=pl.code and c.enabled and c.effective_at<=now() order by c.effective_at desc, c.version desc limit 1);
 if not found then raise exception 'Choose a current Basic or Premium plan'; end if;
 select * into s from public.subscriptions where owner_id=target for update;
 if not found then raise exception 'Subscription unavailable'; end if;
 extending := s.status='active' and s.current_period_end>now() and s.plan_id=p.id;
 starts := case when extending then s.current_period_end else now() end;
 finish := starts + make_interval(months => months);
 insert into public.manual_grants(owner_id, subscription_id, plan_id, granted_by, months, period_start, period_end,
   payment_reference, note, amount_minor, currency, previous)
 values(target, s.id, p.id, actor, months, starts, finish, trim(reference), left(coalesce(note,''),500), amount, amount_currency,
   jsonb_build_object('plan_id',s.plan_id,'price_id',s.price_id,'status',s.status,'provider',s.provider,
     'provider_subscription_id',s.provider_subscription_id,'renewal_mode',s.renewal_mode,
     'current_period_start',s.current_period_start,'current_period_end',s.current_period_end))
 returning * into result;
 update public.subscriptions set plan_id=p.id, price_id=null, status='active',
   current_period_start=case when extending then s.current_period_start else now() end, current_period_end=finish,
   provider='manual', provider_subscription_id=null, renewal_mode='manual', cancel_at_period_end=false,
   revision=revision+1, updated_at=now()
  where id=s.id;
 insert into public.subscription_events(owner_id, subscription_id, event_key, event_type, details)
  values(target, s.id, 'manual:'||result.id::text, 'manual_grant', jsonb_build_object('plan_id',p.id,'months',months,'period_end',finish,'granted_by',actor));
 insert into public.admin_audit(actor_id, action, target_id, details)
  values(actor, 'grant_plan', target::text, jsonb_build_object('grant_id',result.id,'plan',p.code,'months',months,'period_end',finish,
   'reference',result.payment_reference,'amount_minor',amount,'currency',amount_currency,'extended',extending));
 return result;
end $$;

-- 3. Revoke a grant. If it is still the latest change, restore the earlier period when that
-- has time left; otherwise end the paid period now and fall back to Free.
create function public.admin_revoke_grant(actor uuid, grant_id uuid, reason text) returns void language plpgsql security invoker set search_path='' as $$
declare g public.manual_grants; s public.subscriptions; prev jsonb; restore boolean;
begin
 perform public.require_superadmin(actor);
 if length(trim(coalesce(reason,''))) not between 5 and 300 then raise exception 'Give a reason (5 to 300 characters)' using errcode='23514'; end if;
 select * into g from public.manual_grants where id=grant_id for update;
 if not found or g.revoked_at is not null then raise exception 'Grant unavailable or already revoked'; end if;
 select * into s from public.subscriptions where id=g.subscription_id for update;
 if s.provider='manual' and s.current_period_end=g.period_end then
  prev := g.previous;
  restore := prev->>'status'='active' and (prev->>'current_period_end')::timestamptz>now();
  if restore then
   update public.subscriptions set plan_id=(prev->>'plan_id')::uuid, price_id=(prev->>'price_id')::uuid, status='active',
     provider=prev->>'provider', provider_subscription_id=prev->>'provider_subscription_id', renewal_mode=prev->>'renewal_mode',
     current_period_start=(prev->>'current_period_start')::timestamptz, current_period_end=(prev->>'current_period_end')::timestamptz,
     revision=revision+1, updated_at=now()
    where id=s.id;
  else
   update public.subscriptions set status='canceled',
     current_period_end=greatest(current_period_start+interval '1 second', now()), revision=revision+1, updated_at=now()
    where id=s.id;
  end if;
 end if;
 update public.manual_grants set revoked_at=now(), revoked_by=actor, revoke_reason=trim(reason) where id=g.id;
 insert into public.subscription_events(owner_id, subscription_id, event_key, event_type, details)
  values(g.owner_id, g.subscription_id, 'manual-revoke:'||g.id::text, 'manual_grant_revoked', jsonb_build_object('grant_id',g.id,'revoked_by',actor));
 insert into public.admin_audit(actor_id, action, target_id, details)
  values(actor, 'revoke_grant', g.owner_id::text, jsonb_build_object('grant_id',g.id,'reason',trim(reason)));
end $$;

-- 4. Feature switches.
create function public.admin_set_feature(actor uuid, feature text, is_enabled boolean) returns void language plpgsql security invoker set search_path='' as $$
begin
 perform public.require_superadmin(actor);
 update public.feature_flags set enabled=is_enabled, updated_by=actor, updated_at=now() where key=feature;
 if not found then raise exception 'Unknown feature'; end if;
 insert into public.admin_audit(actor_id, action, target_id, details) values(actor, 'feature', feature, jsonb_build_object('enabled',is_enabled));
end $$;

-- 5. Account directory: plan, period end and content counts, with search and segments.
-- clerk_ids carries the accounts whose email matched a search in Clerk.
create function public.admin_list_accounts(actor uuid, query text default '', clerk_ids text[] default '{}',
  segment text default 'all', page_number integer default 1)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare q text := lower(trim(coalesce(query,''))); result jsonb;
begin
 perform public.require_superadmin(actor);
 if segment not in ('all','paid','expiring','free','admins','disabled') then raise exception 'Unknown segment'; end if;
 with base as (
  select u.id, u.clerk_user_id, u.app_role, u.status, u.created_at, coalesce(pr.display_name,'') display_name,
   case when s.status='active' and s.current_period_end>now() then s.plan_id
        when t.ends_at>now() then t.plan_id end entitled_plan,
   case when s.status='active' and s.current_period_end>now() then case when s.provider='manual' then 'manual' else 'paid' end
        when t.ends_at>now() then 'trial' else 'free' end source,
   case when s.status='active' and s.current_period_end>now() then s.current_period_end
        when t.ends_at>now() then t.ends_at end period_end
  from public.users u
  left join public.profiles pr on pr.user_id=u.id
  left join public.subscriptions s on s.owner_id=u.id
  left join public.account_trials t on t.owner_id=u.id
  where u.status<>'deleted'
 ), filtered as (
  select b.*, coalesce(pl.code,'free') plan_code, coalesce(pl.name,'Free') plan_name from base b
  left join public.plans pl on pl.id=b.entitled_plan
  where (q='' or lower(b.display_name) like '%'||q||'%' or b.clerk_user_id=any(clerk_ids) or b.id::text=q)
   and case segment
    when 'paid' then b.source in ('paid','manual','trial')
    when 'expiring' then b.period_end is not null and b.period_end<=now()+interval '7 days'
    when 'free' then b.source='free'
    when 'admins' then b.app_role in ('admin','superadmin')
    when 'disabled' then b.status='disabled'
    else true end
 ), paged as (
  select f.* from filtered f
  order by case when segment in ('paid','expiring') then f.period_end end asc nulls last, f.created_at desc, f.id
  limit 25 offset (greatest(1, least(page_number, 10000))-1)*25
 )
 select jsonb_build_object('total', (select count(*) from filtered), 'items', coalesce(jsonb_agg(jsonb_build_object(
   'id',p.id,'clerk_user_id',p.clerk_user_id,'app_role',p.app_role,'status',p.status,'created_at',p.created_at,
   'display_name',p.display_name,'plan_code',p.plan_code,'plan_name',p.plan_name,'source',p.source,'period_end',p.period_end,
   'cards',(select count(*) from public.cards c where c.owner_id=p.id and c.deleted_at is null),
   'groups',(select count(*) from public.groups g where g.owner_id=p.id and g.deleted_at is null),
   'qr_codes',(select count(*) from public.qr_codes x where x.owner_id=p.id and x.deleted_at is null)
  ) order by case when segment in ('paid','expiring') then p.period_end end asc nulls last, p.created_at desc, p.id), '[]'::jsonb))
 into result from paged p;
 return result;
end $$;

-- 6. Headline numbers for the overview.
create function public.admin_overview(actor uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin
 perform public.require_superadmin(actor);
 return jsonb_build_object(
  'accounts', (select count(*) from public.users where status<>'deleted'),
  'new_7d', (select count(*) from public.users where status<>'deleted' and created_at>now()-interval '7 days'),
  'new_30d', (select count(*) from public.users where status<>'deleted' and created_at>now()-interval '30 days'),
  'paid', (select count(*) from public.subscriptions where status='active' and current_period_end>now() and provider is distinct from 'manual'),
  'manual', (select count(*) from public.subscriptions where status='active' and current_period_end>now() and provider='manual'),
  'trials', (select count(*) from public.account_trials t where t.ends_at>now()
     and not exists(select 1 from public.subscriptions s where s.owner_id=t.owner_id and s.status='active' and s.current_period_end>now())),
  'expiring_7d', (select count(*) from public.subscriptions where status='active' and current_period_end between now() and now()+interval '7 days'),
  'by_plan', (select coalesce(jsonb_object_agg(code, n), '{}'::jsonb) from (
     select pl.code, count(*) n from public.subscriptions s join public.plans pl on pl.id=s.plan_id
     where s.status='active' and s.current_period_end>now() group by pl.code) x),
  'manual_revenue_30d', (select coalesce(jsonb_object_agg(currency, total), '{}'::jsonb) from (
     select currency, sum(amount_minor) total from public.manual_grants
     where revoked_at is null and currency is not null and created_at>now()-interval '30 days' group by currency) y)
 );
end $$;

do $$ declare f text; begin
 foreach f in array array['public.require_superadmin(uuid)',
  'public.admin_grant_plan(uuid,uuid,uuid,integer,text,text,bigint,text)',
  'public.admin_revoke_grant(uuid,uuid,text)',
  'public.admin_set_feature(uuid,text,boolean)',
  'public.admin_list_accounts(uuid,text,text[],text,integer)',
  'public.admin_overview(uuid)'] loop
  execute format('revoke all on function %s from public, anon, authenticated', f);
  execute format('grant execute on function %s to service_role', f);
 end loop;
end $$;
