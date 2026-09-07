-- QR Studio extends the existing owner-scoped resource and quota ledger.
alter table public.qr_codes drop constraint qr_codes_type_check;
alter table public.qr_codes add constraint qr_codes_type_check check(type in ('url','contact','wifi','email','phone','whatsapp','location','document','text','event','links','image','video'));
create table public.qr_assets(
 id uuid primary key, owner_id uuid not null references public.users(id),
 kind text not null check(kind in ('image','video')),
 state text not null default 'pending' check(state in ('pending','processing','ready','cancelled')),
 upload_path text not null unique, upload_bucket text not null default 'qr-upload-1', path text unique, mime_type text,
 expected_bytes bigint, reserved_bytes bigint not null default 0, stored_bytes bigint not null default 0,
 size_bytes bigint not null check(size_bytes between 1 and 100000000),
 width integer, height integer, duration double precision,
 created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '3 hours',
 check(kind<>'image' or stored_bytes<=10000000),
 check(reserved_bytes>=0 and stored_bytes>=0),
 check(upload_bucket in ('qr-upload-1','qr-upload-5','qr-upload-10','qr-upload-50')),
 check(state<>'ready' or (path is not null and mime_type is not null)),
 check(duration is null or (duration>0 and duration<=300))
);
create index qr_assets_owner_idx on public.qr_assets(owner_id);
create index qr_assets_expiry_idx on public.qr_assets(expires_at);
alter table public.qr_assets enable row level security;
revoke all on public.qr_assets from public,anon,authenticated;
grant all on public.qr_assets to service_role;
create policy qr_assets_server on public.qr_assets for all to service_role using(true) with check(true);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('qr-studio-private','qr-studio-private',false,50000000,array['image/png','image/jpeg','image/webp','video/mp4','application/octet-stream']);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) select 'qr-upload-'||n,'qr-upload-'||n,false,n*1000000,array['image/png','image/jpeg','image/webp','video/mp4','application/octet-stream'] from unnest(array[1,5,10,50]) n;

create function public.qr_asset_quota() returns trigger language plpgsql security invoker set search_path='' as $$
declare owner uuid; rid uuid; old_size bigint:=0; new_size bigint:=0;
begin
 owner:=case when tg_op='DELETE' then old.owner_id else new.owner_id end;
 rid:=case when tg_op='DELETE' then old.id else new.id end;
 if tg_op='UPDATE' and (new.owner_id<>old.owner_id or new.upload_path<>old.upload_path or new.kind<>old.kind or new.upload_bucket<>old.upload_bucket) then raise exception 'Asset identity is immutable' using errcode='23514';end if;
 perform 1 from public.users where id=owner for update;
 if tg_op<>'INSERT' then old_size:=old.size_bytes;end if;
 if tg_op<>'DELETE' then new_size:=new.size_bytes;end if;
 perform public.quota_delta(owner,'storage_bytes','current',new_size-old_size,'media',rid,gen_random_uuid());
 return coalesce(new,old);
end $$;
create trigger qr_asset_quota before insert or update or delete on public.qr_assets for each row execute function public.qr_asset_quota();

create function public.qr_data_asset_refs(payload jsonb) returns table(ref text,kind text) language sql immutable security invoker set search_path='' as $$
 select payload->>'logo','image' union all select payload->>'cover','image'
 union all select payload->>'source',payload->>'type' where payload->>'type' in ('image','video')
 union all select value->>'source',value->>'kind' from jsonb_array_elements(case when jsonb_typeof(payload->'media')='array' then payload->'media' else '[]'::jsonb end)
$$;
create function public.qr_asset_is_public(asset_id uuid) returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.qr_assets a join public.qr_codes q on q.owner_id=a.owner_id join public.users u on u.id=q.owner_id
 where a.id=asset_id and a.state='ready' and u.status='active' and not u.clerk_disabled and q.published and q.deleted_at is null and q.archived_at is null
 and exists(select 1 from public.qr_data_asset_refs(q.published_data) r where r.ref='/api/qr-assets/'||a.id::text and r.kind=a.kind))
$$;
-- Serialize reference updates with cleanup, and independently enforce ready/owned assets.
create function public.validate_qr_assets() returns trigger language plpgsql security invoker set search_path='' as $$
declare r record;
begin
 perform 1 from public.users where id=new.owner_id for update;
 for r in select * from public.qr_data_asset_refs(new.data) union all select * from public.qr_data_asset_refs(new.published_data) loop
 if r.ref like '/api/qr-assets/%' and not exists(select 1 from public.qr_assets a where '/api/qr-assets/'||a.id::text=r.ref and a.owner_id=new.owner_id and a.kind=r.kind and a.state='ready') then raise exception 'Asset is not ready or owned' using errcode='23514';end if;
 end loop;
 return new;
end $$;
create trigger validate_qr_assets before insert or update on public.qr_codes for each row execute function public.validate_qr_assets();

-- Claim only expired uploads or unreferenced ready assets older than one day.
-- Keeping reservations until upload tokens expire prevents cancelled-token quota bypass.
create function public.claim_qr_asset_cleanup(account_id uuid) returns setof public.qr_assets language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.users where id=account_id for update;
 return query update public.qr_assets a set state='cancelled'
 where a.owner_id=account_id and a.expires_at<now() and (a.state<>'ready' or a.created_at<now()-interval '1 day')
 and not exists(select 1 from public.qr_codes q where q.owner_id=account_id and exists(select 1 from (select * from public.qr_data_asset_refs(q.data) union all select * from public.qr_data_asset_refs(q.published_data)) r where r.ref='/api/qr-assets/'||a.id::text)) returning a.*;
end $$;
create table public.qr_metrics(qr_id uuid not null references public.qr_codes(id),day date not null default current_date,opens bigint not null default 0,clicks bigint not null default 0,primary key(qr_id,day));
alter table public.qr_metrics enable row level security;
revoke all on public.qr_metrics from public,anon,authenticated;
grant all on public.qr_metrics to service_role;
create policy qr_metrics_server on public.qr_metrics for all to service_role using(true) with check(true);
create function public.record_qr_metric(qr_id uuid,metric text) returns void language plpgsql security invoker set search_path='' as $$
begin
 if metric not in ('opens','clicks') then return;end if;
 insert into public.qr_metrics(qr_id,day,opens,clicks) select qr_id,(now() at time zone 'UTC')::date,(metric='opens')::int,(metric='clicks')::int from public.qr_codes q where q.id=qr_id and q.published and q.deleted_at is null and q.archived_at is null
 on conflict on constraint qr_metrics_pkey do update set opens=public.qr_metrics.opens+excluded.opens,clicks=public.qr_metrics.clicks+excluded.clicks;
end $$;
do $$ declare f record;begin
 for f in select oid::regprocedure signature from pg_proc where pronamespace='public'::regnamespace and proname in ('qr_asset_quota','qr_data_asset_refs','qr_asset_is_public','validate_qr_assets','claim_qr_asset_cleanup','record_qr_metric') loop
 execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $$;
