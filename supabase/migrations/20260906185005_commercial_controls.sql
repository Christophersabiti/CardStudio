-- Server-controlled commercial settings; catalog prices remain immutable versions.
alter table public.users drop constraint users_app_role_check;
alter table public.users add constraint users_app_role_check check(app_role in ('member','admin','superadmin'));
create table public.commercial_settings(
 id boolean primary key default true check(id), quotas_enabled boolean not null default true,
 checkout_enabled boolean not null default false, trial_enabled boolean not null default false,
 trial_days integer not null default 14 check(trial_days between 1 and 90),
 trial_plan_id uuid references public.plans(id), check(not trial_enabled or trial_plan_id is not null), updated_at timestamptz not null default now()
);
insert into public.commercial_settings(id) values(true);
create table public.account_trials(
 owner_id uuid primary key references public.users(id), plan_id uuid not null references public.plans(id),
 started_at timestamptz not null default now(), ends_at timestamptz not null,
 check(ends_at>started_at)
);
create table public.admin_audit(
 id uuid primary key default gen_random_uuid(), actor_id uuid not null references public.users(id),
 action text not null, target_id text, details jsonb not null default '{}', created_at timestamptz not null default now()
);
create table public.checkout_sessions(
 order_id uuid primary key references public.billing_orders(id), redirect_url text not null,
 created_at timestamptz not null default now()
);
do $$ declare t text; begin
 foreach t in array array['commercial_settings','account_trials','admin_audit','checkout_sessions'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 execute format('create policy %I on public.%I for all to service_role using(true) with check(true)',t||'_server',t);
 end loop;
end $$;
create function public.commercial_audit_immutable() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Audit and trial records are immutable' using errcode='23514'; end $$;
create trigger admin_audit_immutable before update or delete on public.admin_audit for each row execute function public.commercial_audit_immutable();
create trigger account_trials_immutable before update or delete on public.account_trials for each row execute function public.commercial_audit_immutable();

create function public.effective_plan(account_id uuid) returns public.plans language plpgsql stable security invoker set search_path='' as $$
declare result public.plans;
begin
 select p.* into result from public.subscriptions s join public.plans p on p.id=s.plan_id
 where s.owner_id=account_id and s.status='active' and s.current_period_end>now();
 if found then return result; end if;
 select p.* into result from public.account_trials t join public.plans p on p.id=t.plan_id where t.owner_id=account_id and t.ends_at>now();
 if found then return result; end if;
 select * into result from public.plans where code='free' and enabled;
 if not found then raise exception 'Free plan unavailable'; end if;
 return result;
end $$;
create function public.start_account_trial(account_id uuid) returns public.account_trials language plpgsql security invoker set search_path='' as $$
declare cfg public.commercial_settings; result public.account_trials;
begin
 perform 1 from public.users where id=account_id and status='active' and not clerk_disabled for update;
 if not found then raise exception 'Account unavailable' using errcode='42501'; end if;
 select * into result from public.account_trials where owner_id=account_id;
 if found then return result; end if;
 select * into cfg from public.commercial_settings where id;
 if not cfg.trial_enabled or cfg.trial_plan_id is null then raise exception 'Trials are not available' using errcode='P0001'; end if;
 if exists(select 1 from public.subscriptions where owner_id=account_id and status='active' and current_period_end>now()) then raise exception 'A paid plan is already active' using errcode='P0001'; end if;
 insert into public.account_trials(owner_id,plan_id,ends_at) values(account_id,cfg.trial_plan_id,now()+make_interval(days=>cfg.trial_days)) returning * into result;
 return result;
end $$;

-- Reconcile existing resources once. Unknown legacy image sizes use a conservative
-- upper bound until measured; new media must always supply its actual size.
insert into public.usage_counters(owner_id,metric,period_key,value)
select owner_id,'active_cards','current',count(*) from public.cards where owner_id is not null and deleted_at is null and archived_at is null group by owner_id
union all select owner_id,'active_groups','current',count(*) from public.groups where owner_id is not null and deleted_at is null and archived_at is null group by owner_id
union all select owner_id,'active_qr_codes','current',count(*) from public.qr_codes where deleted_at is null and archived_at is null group by owner_id
union all select owner_id,'storage_bytes','current',sum(coalesce(size_bytes,420000)) from public.card_studio_media group by owner_id
union all select owner_id,'monthly_cards',to_char(now() at time zone 'UTC','YYYY-MM'),count(*) from public.cards where owner_id is not null and created_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC' group by owner_id
union all select owner_id,'monthly_qr_codes',to_char(now() at time zone 'UTC','YYYY-MM'),count(*) from public.qr_codes where created_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC' group by owner_id
on conflict(owner_id,metric,period_key) do update set value=excluded.value;

create function public.quota_delta(account_id uuid,metric_name text,period text,change bigint,resource text,resource_id uuid,operation uuid)
returns void language plpgsql security invoker set search_path='' as $$
declare cap bigint; current_value bigint; plan public.plans; enforce boolean; account public.users;
begin
 if change=0 then return; end if;
 select * into account from public.users where id=account_id for update;
 if not found then raise exception 'Account missing' using errcode='42501'; end if;
 if change>0 and (account.status<>'active' or account.clerk_disabled) then raise exception 'Account disabled' using errcode='42501'; end if;
 plan:=public.effective_plan(account_id);
 cap:=(to_jsonb(plan)->>metric_name)::bigint;
 if cap is null then raise exception 'Invalid quota metric'; end if;
 select quotas_enabled and account.app_role<>'superadmin' into enforce from public.commercial_settings where id;
 insert into public.usage_counters(owner_id,metric,period_key,value) values(account_id,metric_name,period,0) on conflict do nothing;
 select value into current_value from public.usage_counters where owner_id=account_id and metric=metric_name and period_key=period for update;
 if change>0 and enforce and current_value+change>cap then raise exception 'Plan limit reached: %. Review Billing to change your plan or free up capacity.',metric_name using errcode='P0001'; end if;
 update public.usage_counters set value=greatest(0,value+change),updated_at=now() where owner_id=account_id and metric=metric_name and period_key=period;
 insert into public.usage_events(owner_id,operation_id,metric,period_key,delta,resource_type,resource_id) values(account_id,operation,metric_name,period,change,resource,resource_id);
end $$;
create function public.enforce_resource_quota() returns trigger language plpgsql security invoker set search_path='' as $$
declare owner uuid; rid uuid; old_amount bigint:=0; new_amount bigint:=0; metric text; resource text; operation uuid:=gen_random_uuid();
begin
 owner:=case when tg_op='DELETE' then old.owner_id else new.owner_id end;
 rid:=case when tg_op='DELETE' then old.id else new.id end;
 if tg_op='UPDATE' and old.owner_id is distinct from new.owner_id then raise exception 'Resource owner is immutable' using errcode='23514'; end if;
 if owner is null then return coalesce(new,old); end if;
 -- Serialize every resource operation for this owner, including restores and
 -- deletes. Counters, ledger and the resource commit or roll back together.
 perform 1 from public.users where id=owner for update;
 if tg_table_name='card_studio_media' then
  metric:='storage_bytes';resource:='media';
  if tg_op<>'INSERT' then old_amount:=coalesce(old.size_bytes,420000); end if;
  if tg_op<>'DELETE' then
   if new.size_bytes is null then raise exception 'Media size is required' using errcode='23514'; end if;
   new_amount:=new.size_bytes;
  end if;
 else
  metric:=case tg_table_name when 'cards' then 'active_cards' when 'groups' then 'active_groups' else 'active_qr_codes' end;
  resource:=case tg_table_name when 'cards' then 'card' when 'groups' then 'group' else 'qr_code' end;
  if tg_op<>'INSERT' and old.deleted_at is null and old.archived_at is null then old_amount:=1; end if;
  if tg_op<>'DELETE' and new.deleted_at is null and new.archived_at is null then new_amount:=1; end if;
 end if;
 perform public.quota_delta(owner,metric,'current',new_amount-old_amount,resource,rid,operation);
 if tg_op='INSERT' and tg_table_name in ('cards','qr_codes') then
  perform public.quota_delta(owner,case tg_table_name when 'cards' then 'monthly_cards' else 'monthly_qr_codes' end,to_char(now() at time zone 'UTC','YYYY-MM'),1,resource,rid,operation);
 end if;
 return coalesce(new,old);
end $$;
do $$ declare t text; begin foreach t in array array['cards','groups','qr_codes','card_studio_media'] loop
 execute format('create trigger resource_quota before insert or update of %s or delete on public.%I for each row execute function public.enforce_resource_quota()',case when t='card_studio_media' then 'owner_id,size_bytes' else 'owner_id,deleted_at,archived_at' end,t);
end loop; end $$;

create function public.admin_commercial_update(actor uuid,action text,target uuid,body jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare next_plan uuid; next_version integer;
begin
 -- Global admin lock also prevents two admins disabling the last superadmin.
 perform pg_advisory_xact_lock(70060201);
 if not exists(select 1 from public.users where id=actor and app_role='superadmin' and status='active' and not clerk_disabled) then raise exception 'Superadmin required' using errcode='42501'; end if;
 if action='settings' then
  update public.commercial_settings set quotas_enabled=(body->>'quotas_enabled')::boolean,checkout_enabled=(body->>'checkout_enabled')::boolean,
   trial_enabled=(body->>'trial_enabled')::boolean,trial_days=(body->>'trial_days')::integer,trial_plan_id=nullif(body->>'trial_plan_id','')::uuid,updated_at=now() where id;
 elsif action='account' then
  if target=actor then raise exception 'You cannot change your own access here' using errcode='23514'; end if;
  if not exists(select 1 from public.users where id=target and status<>'deleted') then raise exception 'Account unavailable'; end if;
  update public.users set app_role=body->>'app_role',status=body->>'status' where id=target;
  if not exists(select 1 from public.users where app_role='superadmin' and status='active' and not clerk_disabled) then raise exception 'Keep an active superadmin' using errcode='23514'; end if;
 elsif action='plan' then
  select coalesce(max(version),0)+1 into next_version from public.plans where code=body->>'code';
  if (body->>'enabled')::boolean then update public.plans set enabled=false where code=body->>'code' and enabled; end if;
  insert into public.plans(code,version,name,enabled,active_cards,active_groups,active_qr_codes,monthly_cards,monthly_qr_codes,storage_bytes,features)
   values(body->>'code',next_version,body->>'name',(body->>'enabled')::boolean,(body->>'active_cards')::integer,(body->>'active_groups')::integer,(body->>'active_qr_codes')::integer,(body->>'monthly_cards')::integer,(body->>'monthly_qr_codes')::integer,(body->>'storage_bytes')::bigint,'{}') returning id into next_plan;
  if body->>'code'<>'free' then
   insert into public.plan_prices(plan_id,currency,currency_exponent,interval,amount_minor,enabled) values(next_plan,body->>'currency',(body->>'currency_exponent')::smallint,body->>'interval',(body->>'amount_minor')::bigint,(body->>'enabled')::boolean);
  end if;
 else raise exception 'Unknown administrative action'; end if;
 if not exists(select 1 from public.plans where code='free' and enabled) then raise exception 'An enabled Free plan is required'; end if;
 insert into public.admin_audit(actor_id,action,target_id,details) values(actor,action,coalesce(next_plan,target)::text,body);
end $$;

create function public.create_checkout(account_id uuid,selected_price uuid,request_key uuid) returns public.billing_orders language plpgsql security invoker set search_path='' as $$
declare s public.subscriptions;p public.plan_prices; result public.billing_orders;
begin
 perform 1 from public.users where id=account_id and status='active' and not clerk_disabled for update;
 if not found then raise exception 'Account unavailable' using errcode='42501'; end if;
 select * into result from public.billing_orders where owner_id=account_id and idempotency_key=request_key;
 if found then return result; end if;
 if not (select checkout_enabled from public.commercial_settings where id) then raise exception 'Checkout is not enabled'; end if;
 select pp.* into p from public.plan_prices pp join public.plans pl on pl.id=pp.plan_id where pp.id=selected_price and pp.enabled and pl.enabled;
 if not found then raise exception 'Price unavailable'; end if;
 select * into s from public.subscriptions where owner_id=account_id for update;
 if not found then raise exception 'Subscription unavailable'; end if;
 if exists(select 1 from public.billing_orders where owner_id=account_id and status='pending' and expires_at>now()) then raise exception 'A checkout is already pending. Open it from your billing history.'; end if;
 insert into public.billing_orders(owner_id,subscription_id,price_id,purpose,amount_minor,currency,currency_exponent,price_snapshot,idempotency_key,subscription_revision,expires_at)
 values(account_id,s.id,p.id,case when s.status='free' then 'initial' when s.plan_id=p.plan_id then 'renewal' else 'upgrade' end,p.amount_minor,p.currency,p.currency_exponent,to_jsonb(p),request_key,s.revision,now()+interval '30 minutes') returning * into result;
 insert into public.payments(owner_id,order_id,provider,merchant_reference,amount_minor,currency,currency_exponent) values(account_id,result.id,'pesapal',result.id::text,p.amount_minor,p.currency,p.currency_exponent);
 return result;
end $$;

-- Only server code that has independently fetched Pesapal transaction status
-- may call this RPC. IPN/body amounts are never passed through without validation.
create function public.fulfill_pesapal(tracking text,reference uuid,paid_minor bigint,paid_currency text,provider_status integer)
returns text language plpgsql security invoker set search_path='' as $$
declare o public.billing_orders; p public.payments; s public.subscriptions; price public.plan_prices; finish timestamptz;
begin
 select * into o from public.billing_orders where id=reference;
 if not found then raise exception 'Unknown order'; end if;
 perform 1 from public.users where id=o.owner_id for update;
 select * into o from public.billing_orders where id=reference for update;
 select * into p from public.payments where order_id=o.id and provider='pesapal' for update;
 if p.id is null or (p.provider_tracking_id is not null and p.provider_tracking_id<>tracking) or p.amount_minor<>paid_minor or p.currency<>paid_currency then raise exception 'Payment verification mismatch' using errcode='23514'; end if;
 if provider_status not in (0,1,2,3) then raise exception 'Unknown payment status'; end if;
 update public.payments set provider_tracking_id=tracking,verified_at=now(),status=case when provider_status=3 then 'reversed' when status in ('completed','reversed','refunded') then status when provider_status=1 then 'completed' when provider_status=2 then 'failed' else 'invalid' end where id=p.id;
 if provider_status=3 then
  if o.status='paid' then
   update public.billing_orders set status='refunded' where id=o.id;
   -- Freeze paid entitlement only when this order still backs the current period.
   update public.subscriptions set status='past_due',current_period_end=greatest(current_period_start+interval '1 second',now()),revision=revision+1 where id=o.subscription_id and revision=o.subscription_revision+1;
  end if;
  return 'reversed';
 end if;
 if provider_status<>1 then return 'not_paid'; end if;
 if o.status='paid' then return 'already_paid'; end if;
 if o.status='refunded' then return 'review_required'; end if;
 select * into s from public.subscriptions where id=o.subscription_id for update;
 if s.revision<>o.subscription_revision then return 'review_required'; end if;
 select * into price from public.plan_prices where id=o.price_id;
 finish:=case when s.status='active' and s.plan_id=price.plan_id then greatest(now(),s.current_period_end) else now() end + case price.interval when 'year' then interval '1 year' else interval '1 month' end;
 update public.subscriptions set plan_id=price.plan_id,price_id=price.id,status='active',current_period_start=now(),current_period_end=finish,provider='pesapal',renewal_mode='manual',cancel_at_period_end=false,revision=revision+1 where id=s.id;
 update public.billing_orders set status='paid',fulfilled_at=now() where id=o.id;
 insert into public.subscription_events(owner_id,subscription_id,order_id,event_key,event_type,details) values(o.owner_id,s.id,o.id,'pesapal:'||o.id::text,'payment_verified',jsonb_build_object('period_end',finish)) on conflict(event_key) do nothing;
 return 'paid';
end $$;

do $$ declare f record; begin
 for f in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace and proname in ('commercial_audit_immutable','effective_plan','start_account_trial','quota_delta','enforce_resource_quota','admin_commercial_update','create_checkout','fulfill_pesapal') loop
 execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $$;
-- A durable dispatch claim prevents a repeated checkout request from submitting
-- the same purchase twice if the provider response is delayed or lost.
create table public.checkout_dispatch(order_id uuid primary key references public.billing_orders(id),created_at timestamptz not null default now());
alter table public.checkout_dispatch enable row level security;
revoke all on public.checkout_dispatch from public,anon,authenticated;
grant all on public.checkout_dispatch to service_role;
create policy checkout_dispatch_server on public.checkout_dispatch for all to service_role using(true) with check(true);
create function public.commercial_maintenance() returns jsonb language plpgsql security invoker set search_path='' as $$
declare expired_subscriptions integer; expired_orders integer;
begin
 update public.subscriptions set status='expired' where status in ('active','past_due') and current_period_end<=now();
 get diagnostics expired_subscriptions=row_count;
 update public.billing_orders set status='expired' where status='pending' and expires_at<=now();
 get diagnostics expired_orders=row_count;
 return jsonb_build_object('subscriptions_expired',expired_subscriptions,'orders_expired',expired_orders);
end $$;
revoke all on function public.commercial_maintenance() from public,anon,authenticated;
grant execute on function public.commercial_maintenance() to service_role;
create function public.admin_resource_update(actor uuid,kind text,resource_id uuid,operation text,reason text)
returns void language plpgsql security invoker set search_path='' as $$
declare affected integer;
begin
 if not exists(select 1 from public.users where id=actor and app_role='superadmin' and status='active' and not clerk_disabled) then raise exception 'Superadmin required' using errcode='42501'; end if;
 if kind not in ('cards','groups') or operation not in ('unpublish','trash','restore') or length(reason) not between 5 and 300 then raise exception 'Invalid moderation action'; end if;
 execute format('update public.%I set published=false,deleted_at=case when $1=''trash'' then now() when $1=''restore'' then null else deleted_at end,revision=revision+1 where id=$2',kind) using operation,resource_id;
 get diagnostics affected=row_count;
 if affected<>1 then raise exception 'Resource not found'; end if;
 insert into public.admin_audit(actor_id,action,target_id,details) values(actor,'resource_'||operation,resource_id::text,jsonb_build_object('kind',kind,'reason',reason));
end $$;
revoke all on function public.admin_resource_update(uuid,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.admin_resource_update(uuid,text,uuid,text,text) to service_role;
