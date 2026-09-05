-- This event trigger is infrastructure-only; revoke incidental API grants.
do $$ begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;
create policy limits_server_only on public.card_studio_limits for all to service_role using (true) with check (true);
create or replace function public.increment_card_views(card_slug text)
returns void language sql security invoker set search_path = '' as $$
  update public.cards set view_count = view_count + 1 where slug = card_slug and published and deleted_at is null;
$$;
create or replace function public.increment_group_views(group_slug text)
returns void language sql security invoker set search_path = '' as $$
  update public.groups set view_count = view_count + 1 where slug = group_slug and published and deleted_at is null;
$$;
