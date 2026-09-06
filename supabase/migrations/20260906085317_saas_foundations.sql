-- Commercialization Phase 1. Additive only: existing auth, resource ownership
-- FKs, SELECT policies, public snapshots and slugs remain unchanged.
-- Apply through the migration runner in one transaction after backup/preflight.
-- Clerk linking and the existing owner FK/policy cutover belong to Phase 2.

create table public.users (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text unique check (clerk_user_id is null or clerk_user_id ~ '^user_[A-Za-z0-9]+$'),
  legacy_supabase_user_id uuid unique references auth.users(id) on delete set null,
  status text not null default 'active' check (status in ('active','disabled','deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.users is 'Internal account ID. Only trusted server code may link identities; never link by an unverified email.';

create table public.profiles (
  user_id uuid primary key references public.users(id) on delete restrict,
  display_name text not null default '' check (length(display_name) <= 200),
  business_name text not null default '' check (length(business_name) <= 200),
  timezone text not null default 'Africa/Kampala',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Explicit columns keep quotas typed and enforce nonnegative values in Postgres.
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null check (code in ('free','basic','premium')),
  version integer not null default 1 check (version > 0),
  name text not null,
  enabled boolean not null default false,
  active_cards integer not null check (active_cards >= 0),
  active_qr_codes integer not null check (active_qr_codes >= 0),
  active_groups integer not null check (active_groups >= 0),
  monthly_cards integer not null check (monthly_cards >= 0),
  monthly_qr_codes integer not null check (monthly_qr_codes >= 0),
  storage_bytes bigint not null check (storage_bytes >= 0),
  features jsonb not null default '{}' check (jsonb_typeof(features) = 'object'),
  created_at timestamptz not null default now(),
  unique(code,version)
);
create unique index plans_one_enabled_version on public.plans(code) where enabled;

create table public.plan_prices (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete restrict,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  currency_exponent smallint not null check (currency_exponent between 0 and 3),
  interval text not null check (interval in ('month','year')),
  amount_minor bigint not null check (amount_minor > 0),
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  unique(plan_id,currency,interval),
  unique(id,plan_id)
);
comment on column public.plan_prices.amount_minor is 'Integer minor units; UGX exponent 0. Prices are proposals until enabled during billing launch.';

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.users(id) on delete restrict,
  plan_id uuid not null references public.plans(id) on delete restrict,
  price_id uuid,
  status text not null default 'free' check (status in ('free','active','past_due','expired','canceled')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  renewal_mode text not null default 'manual' check (renewal_mode in ('manual','provider')),
  cancel_at_period_end boolean not null default false,
  provider text check (provider in ('pesapal','paypal')),
  provider_subscription_id text,
  revision integer not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,owner_id),
  unique(provider,provider_subscription_id),
  foreign key(price_id,plan_id) references public.plan_prices(id,plan_id) on delete restrict,
  check ((status = 'free' and price_id is null and current_period_start is null and current_period_end is null)
    or (status <> 'free' and price_id is not null and current_period_start is not null
      and current_period_end is not null and current_period_end > current_period_start)),
  check (renewal_mode <> 'provider' or (provider is not null and provider_subscription_id is not null))
);
create index subscriptions_due_idx on public.subscriptions(current_period_end) where status in ('active','past_due');
create index subscriptions_plan_idx on public.subscriptions(plan_id);
create index subscriptions_price_plan_idx on public.subscriptions(price_id,plan_id);

-- Existing tables keep their legacy owner_id FKs until the Clerk cutover.
alter table public.cards add constraint cards_id_owner_unique unique(id,owner_id);
alter table public.groups add constraint groups_id_owner_unique unique(id,owner_id);
alter table public.groups add column kind text not null default 'contact_bundle'
  check (kind in ('contact_bundle','collection'));
-- Archive UI will arrive with resource management; current Trash stays unchanged.
alter table public.cards add column archived_at timestamptz;
alter table public.groups add column archived_at timestamptz;
alter table public.cards add constraint cards_archive_private check (archived_at is null or not published);
alter table public.groups add constraint groups_archive_private check (archived_at is null or not published);

create table public.group_cards (
  owner_id uuid not null references public.users(id) on delete restrict,
  group_id uuid not null,
  card_id uuid not null,
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  primary key(group_id,card_id),
  foreign key(group_id,owner_id) references public.groups(id,owner_id) on delete restrict,
  foreign key(card_id,owner_id) references public.cards(id,owner_id) on delete restrict
);
create index group_cards_owner_idx on public.group_cards(owner_id);
create index group_cards_group_owner_idx on public.group_cards(group_id,owner_id);
create index group_cards_card_owner_idx on public.group_cards(card_id,owner_id);

create table public.qr_codes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete restrict,
  slug text not null unique check (slug ~ '^[A-Za-z0-9_-]{8,64}$'),
  type text not null check (type in ('url','contact','wifi','email','phone','whatsapp','location','document','text')),
  mode text not null check (mode in ('static','dynamic')),
  title text not null check (length(title) between 1 and 200),
  caption text not null default '' check (length(caption) <= 300),
  description text not null default '' check (length(description) <= 2000),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  published boolean not null default false,
  published_data jsonb check (published_data is null or jsonb_typeof(published_data) = 'object'),
  revision integer not null default 0 check (revision >= 0),
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,owner_id),
  check (not published or (mode = 'dynamic' and published_data is not null and archived_at is null and deleted_at is null))
);
comment on column public.qr_codes.data is 'Private content/style draft. Public routes must read only published_data. Payload validation arrives in Phase 4.';
create index qr_codes_owner_idx on public.qr_codes(owner_id,created_at desc);

alter table public.card_studio_media
  add column size_bytes bigint check (size_bytes >= 0),
  add column mime_type text,
  add column asset_kind text not null default 'image' check (asset_kind in ('image','document'));
comment on column public.card_studio_media.size_bytes is 'NULL means unmeasured, never zero. Backfill from verified storage metadata before storage quota enforcement.';

create table public.billing_orders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete restrict,
  subscription_id uuid not null,
  price_id uuid not null references public.plan_prices(id) on delete restrict,
  purpose text not null check (purpose in ('initial','renewal','upgrade')),
  status text not null default 'pending' check (status in ('pending','paid','canceled','expired','refunded')),
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  currency_exponent smallint not null check (currency_exponent between 0 and 3),
  price_snapshot jsonb not null check (jsonb_typeof(price_snapshot) = 'object'),
  idempotency_key uuid not null,
  subscription_revision integer not null check (subscription_revision >= 0),
  expires_at timestamptz not null,
  fulfilled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,owner_id),
  unique(owner_id,idempotency_key),
  foreign key(subscription_id,owner_id) references public.subscriptions(id,owner_id) on delete restrict,
  check (expires_at > created_at),
  check (status <> 'paid' or fulfilled_at is not null)
);
create index billing_orders_subscription_owner_idx on public.billing_orders(subscription_id,owner_id);
create index billing_orders_price_idx on public.billing_orders(price_id);
create index billing_orders_pending_idx on public.billing_orders(expires_at) where status = 'pending';

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete restrict,
  order_id uuid not null,
  provider text not null check (provider in ('pesapal','paypal')),
  provider_tracking_id text,
  merchant_reference text not null,
  status text not null default 'pending' check (status in ('pending','completed','failed','invalid','reversed','refunded')),
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  currency_exponent smallint not null check (currency_exponent between 0 and 3),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,owner_id),
  unique(provider,provider_tracking_id),
  unique(provider,merchant_reference),
  foreign key(order_id,owner_id) references public.billing_orders(id,owner_id) on delete restrict,
  check (status not in ('completed','reversed','refunded') or (verified_at is not null and provider_tracking_id is not null))
);
create index payments_owner_created_idx on public.payments(owner_id,created_at desc);
create index payments_order_owner_idx on public.payments(order_id,owner_id);
create index payments_pending_idx on public.payments(updated_at) where status = 'pending';

create table public.subscription_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete restrict,
  subscription_id uuid not null,
  order_id uuid,
  event_key text not null unique,
  event_type text not null,
  details jsonb not null default '{}' check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now(),
  foreign key(subscription_id,owner_id) references public.subscriptions(id,owner_id) on delete restrict,
  foreign key(order_id,owner_id) references public.billing_orders(id,owner_id) on delete restrict
);
create index subscription_events_owner_idx on public.subscription_events(owner_id,created_at desc);
create index subscription_events_subscription_idx on public.subscription_events(subscription_id,owner_id);
create index subscription_events_order_idx on public.subscription_events(order_id,owner_id);

create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('pesapal','paypal')),
  deduplication_key text not null,
  provider_tracking_id text not null,
  -- Unknown incoming IDs can be durably recorded without assigning an owner.
  -- Only the verified server reconciliation service links a known payment.
  payment_id uuid references public.payments(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending','processing','processed','failed','ignored')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  locked_until timestamptz,
  payload jsonb not null default '{}' check (jsonb_typeof(payload) = 'object'),
  last_error_code text,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  unique(provider,deduplication_key)
);
create index payment_events_payment_idx on public.payment_events(payment_id);
create index payment_events_pending_idx on public.payment_events(next_attempt_at) where status in ('pending','failed','processing');
comment on table public.payment_events is 'Server-only inbox. No raw provider payload is exposed in customer payment history. Deduplication must not suppress later status changes.';

create table public.usage_counters (
  owner_id uuid not null references public.users(id) on delete restrict,
  metric text not null check (metric in ('active_cards','active_qr_codes','active_groups','storage_bytes','monthly_cards','monthly_qr_codes')),
  period_key text not null,
  value bigint not null default 0 check (value >= 0),
  updated_at timestamptz not null default now(),
  primary key(owner_id,metric,period_key),
  check ((metric like 'monthly_%' and period_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
    or (metric not like 'monthly_%' and period_key = 'current'))
);
create table public.usage_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete restrict,
  operation_id uuid not null,
  metric text not null check (metric in ('active_cards','active_qr_codes','active_groups','storage_bytes','monthly_cards','monthly_qr_codes')),
  period_key text not null,
  delta bigint not null check (delta <> 0),
  resource_type text not null check (resource_type in ('card','qr_code','group','media')),
  resource_id uuid not null,
  created_at timestamptz not null default now(),
  unique(owner_id,operation_id,metric),
  check ((metric like 'monthly_%' and period_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$' and delta > 0)
    or (metric not like 'monthly_%' and period_key = 'current'))
);
comment on table public.usage_counters is 'Foundation only. Phase 5 must atomically reconcile/count/write resources and counters; no quota enforcement is enabled in Phase 1.';

-- Billing snapshots and history cannot be silently rewritten, even by an
-- accidental server update. Administrative correction is a new event/price.
create function public.protect_saas_billing_snapshot()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_table_name in ('subscription_events','usage_events') then
    raise exception 'Ledger events are append-only' using errcode = '23514';
  elsif tg_op = 'DELETE' then
    raise exception 'Billing records cannot be deleted' using errcode = '23514';
  elsif tg_table_name in ('plans','plan_prices') then
    if (to_jsonb(new) - 'enabled') is distinct from (to_jsonb(old) - 'enabled') then
      raise exception 'Create a new plan version instead of changing commercial terms' using errcode = '23514';
    end if;
  elsif tg_table_name = 'billing_orders' then
    if (to_jsonb(new) - array['status','fulfilled_at','updated_at']) is distinct from
       (to_jsonb(old) - array['status','fulfilled_at','updated_at']) then
      raise exception 'Order purchase terms are immutable' using errcode = '23514';
    end if;
  elsif tg_table_name = 'payments' then
    if (to_jsonb(new) - array['status','verified_at','provider_tracking_id','updated_at']) is distinct from
       (to_jsonb(old) - array['status','verified_at','provider_tracking_id','updated_at'])
       or (old.provider_tracking_id is not null and new.provider_tracking_id is distinct from old.provider_tracking_id) then
      raise exception 'Payment identity and amounts are immutable' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.protect_saas_billing_snapshot() from public,anon,authenticated;
grant execute on function public.protect_saas_billing_snapshot() to service_role;
create trigger plan_prices_immutable before update or delete on public.plan_prices
  for each row execute function public.protect_saas_billing_snapshot();
create trigger plans_immutable before update or delete on public.plans
  for each row execute function public.protect_saas_billing_snapshot();
create trigger billing_orders_immutable before update or delete on public.billing_orders
  for each row execute function public.protect_saas_billing_snapshot();
create trigger payments_immutable before update or delete on public.payments
  for each row execute function public.protect_saas_billing_snapshot();
create trigger subscription_events_append_only before update or delete on public.subscription_events
  for each row execute function public.protect_saas_billing_snapshot();
create trigger usage_events_append_only before update or delete on public.usage_events
  for each row execute function public.protect_saas_billing_snapshot();

-- Fail closed on every newly exposed table, including installations that have
-- permissive default grants. No new browser mutation paths are introduced.
do $$
declare table_name text;
begin
  foreach table_name in array array['users','profiles','plans','plan_prices','subscriptions',
    'group_cards','qr_codes','billing_orders','payments','subscription_events','payment_events',
    'usage_counters','usage_events'] loop
    execute format('alter table public.%I enable row level security',table_name);
    execute format('revoke all on public.%I from public,anon,authenticated',table_name);
    execute format('grant all on public.%I to service_role',table_name);
    execute format('create policy %I on public.%I for all to service_role using (true) with check (true)',table_name || '_server',table_name);
  end loop;
  foreach table_name in array array['users','profiles','subscriptions','qr_codes','billing_orders','payments'] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()',table_name || '_set_updated_at',table_name);
  end loop;
end $$;
-- New SaaS tables intentionally remain server-only during the auth transition.
-- Owner reads using the verified Clerk subject are added in Phase 2 alongside
-- identity provisioning. Existing card/group/media policies are untouched.

insert into public.plans(code,name,enabled,active_cards,active_qr_codes,active_groups,
  monthly_cards,monthly_qr_codes,storage_bytes,features) values
  ('free','Free',true,1,3,1,5,10,5000000,'{"custom_colors":false,"qr_logo":false,"remove_branding":false,"qr_svg":false,"analytics":"none"}'),
  ('basic','Basic',false,5,20,5,25,100,50000000,'{"custom_colors":true,"qr_logo":true,"remove_branding":true,"qr_svg":true,"analytics":"totals"}'),
  ('premium','Premium',false,25,100,20,100,500,250000000,'{"custom_colors":true,"qr_logo":true,"remove_branding":true,"qr_svg":true,"analytics":"totals"}');
insert into public.plan_prices(plan_id,currency,currency_exponent,interval,amount_minor)
select p.id,'UGX',0,v.interval,v.amount from public.plans p
join (values ('basic','month',20000::bigint),('basic','year',200000::bigint),
  ('premium','month',60000::bigint),('premium','year',600000::bigint)) v(code,interval,amount)
  on v.code=p.code where p.version=1;

-- Preserve the existing UUID for each real legacy account. No contact data or
-- user-controlled roles are copied, and no anonymous public card is claimed.
insert into public.users(id,legacy_supabase_user_id,created_at)
select id,id,created_at from auth.users where not coalesce(is_anonymous,false);
insert into public.profiles(user_id) select id from public.users;
insert into public.subscriptions(owner_id,plan_id)
select u.id,p.id from public.users u cross join public.plans p where p.code='free' and p.version=1;
-- Do not seed counters with misleading zeroes. Phase 5 initializes them from
-- current resources after all write paths use the atomic quota service.
