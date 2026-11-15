-- E-stamp builder: private reusable designs, monthly generation quota, and
-- versioned commercial limits. Apply through the normal migration runner.
alter table public.plans add column monthly_stamps integer not null default 0 check (monthly_stamps >= -1);
alter table public.plans add column effective_at timestamptz not null default now();
alter table public.plan_prices add column effective_at timestamptz not null default now();
comment on column public.plans.monthly_stamps is '-1 means unlimited monthly stamp generations.';
comment on column public.plans.effective_at is 'Time at which this immutable plan version enters the catalog.';

-- The initial catalog is provisional and checkout remains disabled. Seed a
-- useful free allowance while retaining immutable, future versions thereafter.
drop trigger if exists plans_immutable on public.plans;
update public.plans set monthly_stamps=case code when 'free' then 5 when 'basic' then 25 when 'premium' then 100 else 0 end;
create trigger plans_immutable before update or delete on public.plans for each row execute function public.protect_saas_billing_snapshot();
drop index if exists public.plans_one_enabled_version;
create index plans_enabled_effective_idx on public.plans(code,effective_at desc,version desc) where enabled;

alter table public.usage_counters drop constraint if exists usage_counters_metric_check;
alter table public.usage_counters add constraint usage_counters_metric_check check(metric in ('active_cards','active_qr_codes','active_groups','storage_bytes','monthly_cards','monthly_qr_codes','monthly_stamps'));
alter table public.usage_events drop constraint if exists usage_events_metric_check;
alter table public.usage_events add constraint usage_events_metric_check check(metric in ('active_cards','active_qr_codes','active_groups','storage_bytes','monthly_cards','monthly_qr_codes','monthly_stamps'));
alter table public.usage_events drop constraint if exists usage_events_resource_type_check;
alter table public.usage_events add constraint usage_events_resource_type_check check(resource_type in ('card','group','qr_code','media','stamp_generation'));
alter table public.usage_events add column plan_id uuid references public.plans(id) on delete restrict;

create table public.stamp_designs(
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.users(id) on delete cascade,
 name text not null check(length(name) between 1 and 64),
 design jsonb not null check(jsonb_typeof(design)='object'),
 revision integer not null default 1 check(revision>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create index stamp_designs_owner_idx on public.stamp_designs(owner_id,updated_at desc) where deleted_at is null;
alter table public.stamp_designs enable row level security;
revoke all on public.stamp_designs from public,anon,authenticated;
grant all on public.stamp_designs to service_role;
create policy stamp_designs_server on public.stamp_designs for all to service_role using(true) with check(true);
create trigger stamp_designs_updated before update on public.stamp_designs for each row execute function public.set_updated_at();
create function public.bump_stamp_design_revision() returns trigger language plpgsql set search_path='' as $$ begin new.revision:=old.revision+1; return new; end $$;
create trigger stamp_designs_revision before update on public.stamp_designs for each row execute function public.bump_stamp_design_revision();

create or replace function public.effective_plan(account_id uuid) returns public.plans language plpgsql stable security invoker set search_path='' as $$
declare result public.plans;
begin
 select p.* into result from public.subscriptions s join public.plans p on p.id=s.plan_id where s.owner_id=account_id and s.status='active' and s.current_period_end>now();
 if found then return result; end if;
 select p.* into result from public.account_trials t join public.plans p on p.id=t.plan_id where t.owner_id=account_id and t.ends_at>now();
 if found then return result; end if;
 select * into result from public.plans where code='free' and enabled and effective_at<=now() order by effective_at desc,version desc limit 1;
 if not found then raise exception 'Free plan unavailable'; end if;
 return result;
end $$;

create or replace function public.ensure_clerk_user(verified_clerk_id text,display_name text default '')
returns public.users language plpgsql security invoker set search_path='' as $$
declare account public.users; free_plan uuid;
begin
 if verified_clerk_id is null or verified_clerk_id !~ '^user_[A-Za-z0-9]+$' then raise exception 'Invalid verified identity' using errcode='22023'; end if;
 insert into public.users(clerk_user_id) values(verified_clerk_id) on conflict(clerk_user_id) do nothing;
 select * into account from public.users where clerk_user_id=verified_clerk_id for update;
 if account.status<>'active' or account.clerk_disabled then raise exception 'Account unavailable' using errcode='42501'; end if;
 insert into public.profiles(user_id,display_name) values(account.id,left(coalesce(display_name,''),200)) on conflict(user_id) do nothing;
 select id into free_plan from public.plans where code='free' and enabled and effective_at<=now() order by effective_at desc,version desc limit 1;
 if free_plan is null then raise exception 'Free plan unavailable'; end if;
 insert into public.subscriptions(owner_id,plan_id) values(account.id,free_plan) on conflict(owner_id) do nothing;
 return account;
end $$;

create or replace function public.admin_commercial_update(actor uuid,action text,target uuid,body jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare next_plan uuid; next_version integer; starts_at timestamptz; previous_terms jsonb;
begin
 perform pg_advisory_xact_lock(70060201);
 if not exists(select 1 from public.users where id=actor and app_role='superadmin' and status='active' and not clerk_disabled) then raise exception 'Superadmin required' using errcode='42501'; end if;
 if action='settings' then
  update public.commercial_settings set quotas_enabled=(body->>'quotas_enabled')::boolean,checkout_enabled=(body->>'checkout_enabled')::boolean,trial_enabled=(body->>'trial_enabled')::boolean,trial_days=(body->>'trial_days')::integer,trial_plan_id=nullif(body->>'trial_plan_id','')::uuid,updated_at=now() where id;
 elsif action='account' then
  if target=actor then raise exception 'You cannot change your own access here' using errcode='23514'; end if;
  if not exists(select 1 from public.users where id=target and status<>'deleted') then raise exception 'Account unavailable'; end if;
  update public.users set app_role=body->>'app_role',status=body->>'status' where id=target;
  if not exists(select 1 from public.users where app_role='superadmin' and status='active' and not clerk_disabled) then raise exception 'Keep an active superadmin' using errcode='23514'; end if;
 elsif action='plan' then
  starts_at:=coalesce(nullif(body->>'effective_at','')::timestamptz,now());
  select to_jsonb(p)||jsonb_build_object('price',to_jsonb(pp)) into previous_terms from public.plans p left join lateral (select x.* from public.plan_prices x where x.plan_id=p.id order by x.effective_at desc limit 1) pp on true where p.code=body->>'code' and p.enabled and p.effective_at<=now() order by p.effective_at desc,p.version desc limit 1;
  select coalesce(max(version),0)+1 into next_version from public.plans where code=body->>'code';
  insert into public.plans(code,version,name,enabled,active_cards,active_groups,active_qr_codes,monthly_cards,monthly_qr_codes,storage_bytes,monthly_stamps,effective_at,features)
   values(body->>'code',next_version,body->>'name',(body->>'enabled')::boolean,(body->>'active_cards')::integer,(body->>'active_groups')::integer,(body->>'active_qr_codes')::integer,(body->>'monthly_cards')::integer,(body->>'monthly_qr_codes')::integer,(body->>'storage_bytes')::bigint,(body->>'monthly_stamps')::integer,starts_at,'{}') returning id into next_plan;
  if body->>'code'<>'free' then
   insert into public.plan_prices(plan_id,currency,currency_exponent,interval,amount_minor,enabled,effective_at) values(next_plan,body->>'currency',(body->>'currency_exponent')::smallint,body->>'interval',(body->>'amount_minor')::bigint,(body->>'enabled')::boolean,starts_at);
  end if;
 else raise exception 'Unknown administrative action'; end if;
 if not exists(select 1 from public.plans where code='free' and enabled and effective_at<=now()) then raise exception 'An effective Free plan is required'; end if;
 insert into public.admin_audit(actor_id,action,target_id,details) values(actor,action,coalesce(next_plan,target)::text,case when action='plan' then jsonb_build_object('before',coalesce(previous_terms,'null'::jsonb),'after',body) else body end);
end $$;

create or replace function public.create_checkout(account_id uuid,selected_price uuid,request_key uuid) returns public.billing_orders language plpgsql security invoker set search_path='' as $$
declare s public.subscriptions;p public.plan_prices; result public.billing_orders;
begin
 perform 1 from public.users where id=account_id and status='active' and not clerk_disabled for update;
 if not found then raise exception 'Account unavailable' using errcode='42501'; end if;
 select * into result from public.billing_orders where owner_id=account_id and idempotency_key=request_key;
 if found then return result; end if;
 if not (select checkout_enabled from public.commercial_settings where id) then raise exception 'Checkout is not enabled'; end if;
 select pp.* into p from public.plan_prices pp join public.plans pl on pl.id=pp.plan_id where pp.id=selected_price and pp.enabled and pl.enabled and pp.effective_at<=now() and pl.effective_at<=now()
  and pl.id=(select current_plan.id from public.plans current_plan where current_plan.code=pl.code and current_plan.enabled and current_plan.effective_at<=now() order by current_plan.effective_at desc,current_plan.version desc limit 1);
 if not found then raise exception 'Price unavailable'; end if;
 select * into s from public.subscriptions where owner_id=account_id for update;
 if not found then raise exception 'Subscription unavailable'; end if;
 if exists(select 1 from public.billing_orders where owner_id=account_id and status='pending' and expires_at>now()) then raise exception 'A checkout is already pending. Open it from your billing history.'; end if;
 insert into public.billing_orders(owner_id,subscription_id,price_id,purpose,amount_minor,currency,currency_exponent,price_snapshot,idempotency_key,subscription_revision,expires_at)
 values(account_id,s.id,p.id,case when s.status='free' then 'initial' when s.plan_id=p.plan_id then 'renewal' else 'upgrade' end,p.amount_minor,p.currency,p.currency_exponent,to_jsonb(p),request_key,s.revision,now()+interval '30 minutes') returning * into result;
 insert into public.payments(owner_id,order_id,provider,merchant_reference,amount_minor,currency,currency_exponent) values(account_id,result.id,'pesapal',result.id::text,p.amount_minor,p.currency,p.currency_exponent);
 return result;
end $$;

create function public.record_stamp_generation(account_id uuid,operation uuid,design uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare account public.users; plan public.plans; cfg public.commercial_settings; period text; operation_period text; operation_plan uuid; next_reset timestamptz; zone text; used bigint; cap integer;
begin
 select * into account from public.users where id=account_id and status='active' and not clerk_disabled for update;
 if not found then raise exception 'Account unavailable' using errcode='42501'; end if;
 if not exists(select 1 from public.stamp_designs where id=design and owner_id=account_id and deleted_at is null) then raise exception 'Stamp design unavailable' using errcode='42501'; end if;
 select period_key,plan_id into operation_period,operation_plan from public.usage_events where operation_id=operation and owner_id=account_id and metric='monthly_stamps';
 if found then
  select value into used from public.usage_counters where owner_id=account_id and metric='monthly_stamps' and period_key=operation_period;
  select * into plan from public.plans where id=operation_plan; cap:=plan.monthly_stamps; if account.app_role='superadmin' then cap:=-1; end if;
  return jsonb_build_object('used',coalesce(used,0),'limit',cap,'period',operation_period);
 end if;
 select * into plan from public.effective_plan(account_id);
 select * into cfg from public.commercial_settings where id;
 select coalesce(nullif(timezone,''),'UTC') into zone from public.profiles where user_id=account_id;
 if zone is null or not exists(select 1 from pg_timezone_names where name=zone) then zone:='UTC'; end if;
 period:=to_char(now() at time zone zone,'YYYY-MM');
 next_reset:=(date_trunc('month',now() at time zone zone)+interval '1 month') at time zone zone;
 insert into public.usage_counters(owner_id,metric,period_key,value) values(account_id,'monthly_stamps',period,0) on conflict do nothing;
 select value into used from public.usage_counters where owner_id=account_id and metric='monthly_stamps' and period_key=period for update;
 cap:=plan.monthly_stamps;
 if account.app_role='superadmin' then cap:=-1; end if;
 if cfg.quotas_enabled and account.app_role<>'superadmin' and cap<>-1 and used>=cap then raise exception 'Monthly stamp generation limit reached.' using errcode='P0001'; end if;
 update public.usage_counters set value=value+1,updated_at=now() where owner_id=account_id and metric='monthly_stamps' and period_key=period;
 insert into public.usage_events(owner_id,operation_id,metric,period_key,delta,resource_type,resource_id,plan_id) values(account_id,operation,'monthly_stamps',period,1,'stamp_generation',design,plan.id);
 return jsonb_build_object('used',used+1,'limit',cap,'period',period,'reset',next_reset);
end $$;

do $$ declare f record; begin
 for f in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace and proname in ('effective_plan','ensure_clerk_user','admin_commercial_update','create_checkout','record_stamp_generation') loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
  execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $$;
