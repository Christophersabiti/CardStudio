-- Read-only evidence for the hosted Phase 1 migration gate. No contact contents,
-- email addresses, credentials, or storage URLs are returned. Run before and
-- after migration and retain the output with the deployment record.
select jsonb_build_object(
  'migration_history', (select jsonb_agg(version order by version) from supabase_migrations.schema_migrations),
  'resource_counts', jsonb_build_object(
    'cards', (select count(*) from public.cards),
    'unowned_cards', (select count(*) from public.cards where owner_id is null),
    'groups', (select count(*) from public.groups),
    'unowned_groups', (select count(*) from public.groups where owner_id is null),
    'media', (select count(*) from public.card_studio_media)
  ),
  'cards_fingerprint', (select md5(coalesce(string_agg(
    jsonb_build_array(id,slug,owner_id,data,published,published_data,revision,deleted_at)::text,
    '' order by id),'')) from public.cards),
  'groups_fingerprint', (select md5(coalesce(string_agg(
    jsonb_build_array(id,slug,owner_id,data,published,published_data,revision,deleted_at)::text,
    '' order by id),'')) from public.groups),
  'legacy_foreign_keys', (select jsonb_agg(jsonb_build_object('table',conrelid::regclass::text,'definition',pg_get_constraintdef(oid)))
    from pg_constraint where contype='f' and confrelid='auth.users'::regclass
    and conrelid in ('public.cards'::regclass,'public.groups'::regclass,'public.card_studio_media'::regclass)),
  'resource_rls', (select jsonb_agg(jsonb_build_object('table',relname,'enabled',relrowsecurity)) from pg_class
    where oid in ('public.cards'::regclass,'public.groups'::regclass,'public.card_studio_media'::regclass,'public.card_studio_limits'::regclass)),
  'resource_policies', (select jsonb_agg(jsonb_build_object('table',tablename,'name',policyname,'roles',roles,'command',cmd,'using',qual))
    from pg_policies where schemaname='public' and tablename in ('cards','groups','card_studio_media','card_studio_limits')),
  -- information_schema grant views can omit grants not visible to the connected
  -- management role. Check effective privileges directly instead.
  'client_grants', (select jsonb_agg(jsonb_build_object('role',r.name,'table',t.name,'privilege',p.name,
      'allowed',has_table_privilege(r.name,'public.' || t.name,p.name)))
    from (values ('anon'),('authenticated')) r(name)
    cross join (values ('cards'),('groups'),('card_studio_media'),('card_studio_limits')) t(name)
    cross join (values ('SELECT'),('INSERT'),('UPDATE'),('DELETE')) p(name)),
  'private_storage', (select jsonb_build_object('public',public,'max_bytes',file_size_limit,'mime_types',allowed_mime_types)
    from storage.buckets where id='card-studio-private'),
  'baseline_objects', jsonb_build_object(
    'cards_updated_at',exists(select 1 from pg_trigger where tgrelid='public.cards'::regclass and tgname='cards_set_updated_at'),
    'groups_updated_at',exists(select 1 from pg_trigger where tgrelid='public.groups'::regclass and tgname='groups_set_updated_at'),
    'card_counter',to_regprocedure('public.increment_card_views(text)') is not null,
    'group_counter',to_regprocedure('public.increment_group_views(text)') is not null
  )
) as preflight;
