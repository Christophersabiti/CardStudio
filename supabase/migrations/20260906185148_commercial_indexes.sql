create index account_trials_plan_idx on public.account_trials(plan_id);
create index admin_audit_actor_idx on public.admin_audit(actor_id);
create index commercial_settings_trial_plan_idx on public.commercial_settings(trial_plan_id);
alter policy users_clerk_read on public.users using (clerk_user_id=(select auth.jwt()->>'sub') and status='active' and not clerk_disabled);
