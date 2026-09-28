-- Row Level Security and privileges.
-- Reads: a user can read a group's rows only while they hold an ACTIVE membership in it.
-- Writes: no direct table writes for financial/membership data. All writes go through the
-- security-definer RPCs in the next migration, which check auth.uid() themselves.

-- Membership helpers. security definer so policies on group_members don't recurse.
create function public.is_group_member(p_group uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.group_members m
    where m.group_id = p_group and m.user_id = auth.uid() and m.status = 'active'
  );
$$;

create function public.is_group_owner(p_group uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.group_members m
    where m.group_id = p_group and m.user_id = auth.uid() and m.status = 'active' and m.role = 'owner'
  );
$$;

create function public.shares_group_with(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_user = auth.uid() or exists (
    select 1
    from public.group_members me
    join public.group_members them on them.group_id = me.group_id
    where me.user_id = auth.uid() and me.status = 'active' and them.user_id = p_user
  );
$$;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_invites enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_revisions enable row level security;
alter table public.expense_shares enable row level security;
alter table public.payments enable row level security;
alter table public.group_events enable row level security;

-- ---------------------------------------------------------------------------
-- Privileges (defense in depth on top of RLS)
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select on public.groups, public.group_members, public.group_invites, public.expenses,
  public.expense_revisions, public.expense_shares, public.payments, public.group_events
  to authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, payment_alias) on public.profiles to authenticated;

-- Future tables must opt in explicitly.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated, public;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------
create policy profiles_select on public.profiles for select to authenticated
  using (public.shares_group_with(id));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy groups_select on public.groups for select to authenticated
  using (public.is_group_member(id));

create policy group_members_select on public.group_members for select to authenticated
  using (public.is_group_member(group_id));

create policy group_invites_select on public.group_invites for select to authenticated
  using (public.is_group_member(group_id));

create policy expenses_select on public.expenses for select to authenticated
  using (public.is_group_member(group_id));

create policy expense_revisions_select on public.expense_revisions for select to authenticated
  using (public.is_group_member(group_id));

create policy expense_shares_select on public.expense_shares for select to authenticated
  using (public.is_group_member(group_id));

create policy payments_select on public.payments for select to authenticated
  using (public.is_group_member(group_id));

create policy group_events_select on public.group_events for select to authenticated
  using (public.is_group_member(group_id));

-- Helper functions are only for policies/RPCs.
revoke execute on function public.is_group_member(uuid) from public, anon;
revoke execute on function public.is_group_owner(uuid) from public, anon;
revoke execute on function public.shares_group_with(uuid) from public, anon;
grant execute on function public.is_group_member(uuid) to authenticated;
grant execute on function public.is_group_owner(uuid) to authenticated;
grant execute on function public.shares_group_with(uuid) to authenticated;

revoke execute on function public.forbid_mutation() from public, anon, authenticated;
revoke execute on function public.guard_expense_update() from public, anon, authenticated;
revoke execute on function public.guard_payment_update() from public, anon, authenticated;
revoke execute on function public.guard_group_update() from public, anon, authenticated;
revoke execute on function public.check_group_currency() from public, anon, authenticated;
revoke execute on function public.check_revision_shares() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.propagate_profile_name() from public, anon, authenticated;
