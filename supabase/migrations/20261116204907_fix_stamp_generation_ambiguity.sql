-- The `design` parameter collided with stamp_designs.design, so every call
-- failed with 42702 (ambiguous column). Same signature and body; parameters
-- and variables now win any name clash. Existing grants are retained.
create or replace function public.record_stamp_generation(account_id uuid,operation uuid,design uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
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
