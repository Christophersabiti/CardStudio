-- Unified "My designs" library.
--
-- Product tables (cards, groups, qr_codes, stamp_designs and the two new tables
-- below) remain the source of truth for content, publication, revision and Trash.
-- design_assets only stores per-design library metadata (a private name, favourite
-- flag, last opened time), keyed to the product row. A missing metadata row is
-- valid: the library falls back to a name derived from the product row, so the
-- index can never hide or resurrect a design.

create table public.signature_designs(
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.users(id) on delete cascade,
 name text not null check(length(name) between 1 and 120),
 design jsonb not null check(jsonb_typeof(design)='object'),
 revision integer not null default 1 check(revision>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create index signature_designs_owner_idx on public.signature_designs(owner_id,updated_at desc) where deleted_at is null;

create table public.print_packages(
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.users(id) on delete cascade,
 name text not null check(length(name) between 1 and 120),
 config jsonb not null check(jsonb_typeof(config)='object'),
 revision integer not null default 1 check(revision>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create index print_packages_owner_idx on public.print_packages(owner_id,updated_at desc) where deleted_at is null;

create table public.design_assets(
 owner_id uuid not null references public.users(id) on delete cascade,
 kind text not null check(kind in ('card','group','qr','stamp','signature','print')),
 source_id uuid not null,
 name text check(name is null or length(name) between 1 and 120),
 favorite boolean not null default false,
 last_opened_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 primary key(owner_id,kind,source_id)
);
create index design_assets_favorite_idx on public.design_assets(owner_id) where favorite;
comment on table public.design_assets is 'Private library metadata. Never public; product tables own content, publication and deletion.';
comment on column public.design_assets.name is 'Private label for finding a design. Never printed or published.';

do $$ declare t text; begin
 foreach t in array array['signature_designs','print_packages','design_assets'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant all on public.%I to service_role',t);
  execute format('create policy %I on public.%I for all to service_role using(true) with check(true)',t||'_server',t);
  execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()',t||'_updated',t);
 end loop;
end $$;
create trigger signature_designs_revision before update on public.signature_designs for each row execute function public.bump_stamp_design_revision();
create trigger print_packages_revision before update on public.print_packages for each row execute function public.bump_stamp_design_revision();

-- Owner-scoped library listing. Filters by owner before searching or paging.
create function public.list_design_assets(account_id uuid, kind_filter text default '', query text default '', section text default 'all', sort text default 'updated', page_number integer default 1)
returns jsonb language sql stable security invoker set search_path=public as $$
 with terms as (
  select coalesce(array(select '%'||t||'%' from unnest(regexp_split_to_array(public.normalize_card_search(left(coalesce(query,''),120)),'\s+')) t where t<>''),'{}') pats
 ), src as (
  select 'card'::text kind,c.id source_id,c.slug,coalesce(nullif(trim(concat_ws(' ',c.data->>'firstName',c.data->>'lastName')),''),'Untitled business card') derived,
   c.data,c.published,(c.published and (c.data-'qrMode')=(c.published_data-'qrMode')) up_to_date,null::timestamptz archived_at,c.revision,c.created_at,c.updated_at,c.deleted_at,c.search_text extra
   from public.cards c where c.owner_id=account_id
  union all
  select 'group',g.id,g.slug,coalesce(nullif(trim(g.data->>'name'),''),'Untitled team'),g.data,g.published,(g.published and g.data=g.published_data),null,g.revision,g.created_at,g.updated_at,g.deleted_at,g.search_text
   from public.groups g where g.owner_id=account_id
  union all
  select 'qr',q.id,q.slug,q.title,q.data,q.published,(q.published and q.data=q.published_data),q.archived_at,q.revision,q.created_at,q.updated_at,q.deleted_at,concat_ws(' ',q.type,q.caption,q.description)
   from public.qr_codes q where q.owner_id=account_id and q.data->>'version'='1' and q.type in ('event','location','links','image','video','url')
  union all
  select 'stamp',s.id,null,s.name,s.design,false,false,null,s.revision,s.created_at,s.updated_at,s.deleted_at,
   concat_ws(' ',s.design->>'shape',(select string_agg(i->>'text',' ') from jsonb_array_elements(case when jsonb_typeof(s.design->'items')='array' then s.design->'items' else '[]' end) i))
   from public.stamp_designs s where s.owner_id=account_id
  union all
  select 'signature',e.id,null,e.name,e.design,false,false,null,e.revision,e.created_at,e.updated_at,e.deleted_at,concat_ws(' ',e.design->>'name',e.design->>'title',e.design->>'company',e.design->>'email')
   from public.signature_designs e where e.owner_id=account_id
  union all
  select 'print',p.id,null,p.name,p.config,false,false,null,p.revision,p.created_at,p.updated_at,p.deleted_at,''
   from public.print_packages p where p.owner_id=account_id
 ), joined as (
  select s.*,coalesce(d.name,s.derived) display_name,coalesce(d.favorite,false) favorite,d.last_opened_at
   from src s left join public.design_assets d on d.owner_id=account_id and d.kind=s.kind and d.source_id=s.source_id
 ), scoped as (
  select j.* from joined j,terms t
   where case coalesce(section,'all') when 'trash' then j.deleted_at is not null else j.deleted_at is null end
   and (coalesce(section,'all')<>'favorites' or j.favorite)
   and (coalesce(section,'all')<>'recent' or greatest(j.last_opened_at,j.updated_at)>now()-interval '14 days')
   and public.normalize_card_search(j.display_name||' '||j.derived||' '||coalesce(j.extra,'')||' '||j.kind) like all(t.pats)
 ), filtered as (
  select * from scoped where coalesce(kind_filter,'')='' or kind=kind_filter
 ), ordered as (
  select f.*,row_number() over(order by
   case when sort='name' then lower(display_name) end asc,
   case when sort='created' then created_at end desc,
   case when coalesce(section,'all')='recent' then greatest(last_opened_at,updated_at) end desc,
   updated_at desc, source_id) rn
  from filtered f
 ), paged as (
  select * from ordered order by rn limit 48 offset (greatest(1,least(coalesce(page_number,1),10000))-1)*48
 )
 select jsonb_build_object(
  'total',(select count(*) from filtered),
  'counts',(select coalesce(jsonb_object_agg(kind,n),'{}'::jsonb) from (select kind,count(*) n from scoped group by kind) k),
  'items',coalesce((select jsonb_agg(jsonb_build_object('kind',kind,'id',source_id,'slug',slug,'name',display_name,'derivedName',derived,
   'data',data,'published',published,'upToDate',up_to_date,'archived',archived_at is not null,'revision',revision,'createdAt',created_at,'updatedAt',updated_at,
   'deletedAt',deleted_at,'favorite',favorite,'openedAt',last_opened_at) order by rn) from paged),'[]'::jsonb))
$$;
revoke all on function public.list_design_assets(uuid,text,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.list_design_assets(uuid,text,text,text,text,integer) to service_role;
