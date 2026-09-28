-- Ronda schema v1: tables, integrity constraints and immutability guarantees.
-- Money is stored as bigint minor units (cents). Financial records are append-only:
-- edits create revisions, removals are voids, nothing is deleted.

create extension if not exists pgcrypto with schema extensions;

create type public.member_role as enum ('owner', 'member');
create type public.member_status as enum ('active', 'left', 'removed');
create type public.split_method as enum ('equal', 'exact', 'percent');

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 60),
  payment_alias text check (payment_alias is null or char_length(payment_alias) between 1 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Groups and membership
-- ---------------------------------------------------------------------------
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  currency text not null check (currency in ('ARS', 'USD', 'EUR')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- A membership "slot". user_id is null for people added without an account; they claim the
-- slot later (invite link or matching email) and inherit its history.
create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete restrict,
  user_id uuid references auth.users (id) on delete set null,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 60),
  invited_email text check (invited_email is null or (invited_email = lower(invited_email) and invited_email like '%_@_%.__%')),
  role public.member_role not null default 'member',
  status public.member_status not null default 'active',
  color_index smallint not null default 0 check (color_index between 0 and 5),
  seq bigint generated always as identity,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  unique (id, group_id),
  check (role = 'member' or user_id is not null),
  check ((status = 'active') = (left_at is null))
);
create unique index group_members_user_once on public.group_members (group_id, user_id) where user_id is not null;
create unique index group_members_email_once on public.group_members (group_id, invited_email)
  where invited_email is not null and user_id is null and status = 'active';
create index group_members_user_idx on public.group_members (user_id) where user_id is not null;

create table public.group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete restrict,
  token text not null unique check (char_length(token) >= 16),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);
create index group_invites_group_idx on public.group_invites (group_id);

-- ---------------------------------------------------------------------------
-- Expenses: identity + immutable revisions + immutable shares
-- ---------------------------------------------------------------------------
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete restrict,
  current_revision integer not null default 1 check (current_revision >= 1),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references auth.users (id) on delete set null,
  void_reason text check (void_reason is null or char_length(void_reason) <= 200),
  unique (id, group_id)
);
create index expenses_group_idx on public.expenses (group_id, created_at desc);

create table public.expense_revisions (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null,
  group_id uuid not null,
  revision integer not null check (revision >= 1),
  description text not null check (char_length(btrim(description)) between 1 and 80),
  amount_minor bigint not null check (amount_minor > 0 and amount_minor <= 1000000000000),
  currency text not null check (currency in ('ARS', 'USD', 'EUR')),
  payer_member_id uuid not null,
  expense_date date not null check (expense_date >= date '2000-01-01'),
  split_method public.split_method not null,
  category text check (category in ('ALO', 'COM', 'SUP', 'TRA', 'SAL', 'SER', 'OTR')),
  note text check (note is null or char_length(note) <= 500),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (expense_id, revision),
  unique (id, group_id),
  foreign key (expense_id, group_id) references public.expenses (id, group_id) on delete restrict,
  foreign key (payer_member_id, group_id) references public.group_members (id, group_id) on delete restrict
);
create index expense_revisions_group_idx on public.expense_revisions (group_id);

create table public.expense_shares (
  revision_id uuid not null,
  group_id uuid not null,
  member_id uuid not null,
  share_minor bigint not null check (share_minor >= 0),
  -- Raw input: exact amount in minor units, or basis points for percentages; null for equal.
  input_value bigint check (input_value is null or input_value >= 0),
  primary key (revision_id, member_id),
  foreign key (revision_id, group_id) references public.expense_revisions (id, group_id) on delete restrict,
  foreign key (member_id, group_id) references public.group_members (id, group_id) on delete restrict
);
create index expense_shares_group_idx on public.expense_shares (group_id);

-- ---------------------------------------------------------------------------
-- Repayments
-- ---------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete restrict,
  receipt_number bigint generated always as identity unique,
  from_member_id uuid not null,
  to_member_id uuid not null,
  amount_minor bigint not null check (amount_minor > 0 and amount_minor <= 1000000000000),
  currency text not null check (currency in ('ARS', 'USD', 'EUR')),
  paid_on date not null check (paid_on >= date '2000-01-01'),
  method text check (method in ('transferencia', 'efectivo', 'otro')),
  note text check (note is null or char_length(note) <= 500),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references auth.users (id) on delete set null,
  void_reason text check (void_reason is null or char_length(void_reason) <= 200),
  check (from_member_id <> to_member_id),
  foreign key (from_member_id, group_id) references public.group_members (id, group_id) on delete restrict,
  foreign key (to_member_id, group_id) references public.group_members (id, group_id) on delete restrict
);
create index payments_group_idx on public.payments (group_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------------
create table public.group_events (
  id bigint generated always as identity primary key,
  group_id uuid not null references public.groups (id) on delete restrict,
  actor_user_id uuid references auth.users (id) on delete set null,
  actor_member_id uuid references public.group_members (id) on delete restrict,
  kind text not null check (kind in (
    'group_created', 'group_renamed', 'group_currency_changed',
    'member_added', 'member_joined', 'member_claimed', 'member_rejoined',
    'member_left', 'member_removed', 'member_role_changed',
    'invite_created', 'invite_revoked',
    'expense_created', 'expense_edited', 'expense_voided',
    'payment_recorded', 'payment_voided'
  )),
  expense_id uuid references public.expenses (id) on delete restrict,
  payment_id uuid references public.payments (id) on delete restrict,
  member_id uuid references public.group_members (id) on delete restrict,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index group_events_group_idx on public.group_events (group_id, id desc);

-- ---------------------------------------------------------------------------
-- Immutability: these guarantees hold for every role, including service_role.
-- ---------------------------------------------------------------------------
create function public.forbid_mutation() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'ronda:immutable_record' using detail = tg_table_name || ' rows cannot be ' || lower(tg_op) || 'd';
end;
$$;

create trigger expense_revisions_immutable before update or delete on public.expense_revisions
  for each row execute function public.forbid_mutation();
create trigger expense_shares_immutable before update or delete on public.expense_shares
  for each row execute function public.forbid_mutation();
create trigger group_events_immutable before update or delete on public.group_events
  for each row execute function public.forbid_mutation();
create trigger expenses_no_delete before delete on public.expenses
  for each row execute function public.forbid_mutation();
create trigger payments_no_delete before delete on public.payments
  for each row execute function public.forbid_mutation();
create trigger groups_no_delete before delete on public.groups
  for each row execute function public.forbid_mutation();
create trigger group_members_no_delete before delete on public.group_members
  for each row execute function public.forbid_mutation();

-- Expenses: only the revision pointer may advance (while not voided) and the void fields may be
-- set once. Everything else is fixed at creation.
create function public.guard_expense_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.id <> old.id or new.group_id <> old.group_id or new.created_by is distinct from old.created_by
     or new.created_at <> old.created_at then
    raise exception 'ronda:immutable_record';
  end if;
  if old.voided_at is not null then
    raise exception 'ronda:already_voided';
  end if;
  if new.current_revision <> old.current_revision and new.current_revision <> old.current_revision + 1 then
    raise exception 'ronda:invalid_revision';
  end if;
  if new.voided_at is not null and new.current_revision <> old.current_revision then
    raise exception 'ronda:invalid_revision';
  end if;
  return new;
end;
$$;
create trigger expenses_guard before update on public.expenses
  for each row execute function public.guard_expense_update();

create function public.guard_payment_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.voided_at is not null then
    raise exception 'ronda:already_voided';
  end if;
  if new.voided_at is null
     or (to_jsonb(new) - array['voided_at', 'voided_by', 'void_reason'])
        <> (to_jsonb(old) - array['voided_at', 'voided_by', 'void_reason']) then
    raise exception 'ronda:immutable_record';
  end if;
  return new;
end;
$$;
create trigger payments_guard before update on public.payments
  for each row execute function public.guard_payment_update();

-- Currency is fixed once the group has any expense or payment.
create function public.guard_group_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.id <> old.id or new.created_at <> old.created_at or new.created_by is distinct from old.created_by then
    raise exception 'ronda:immutable_record';
  end if;
  if new.currency <> old.currency and (
       exists (select 1 from public.expenses e where e.group_id = old.id)
       or exists (select 1 from public.payments p where p.group_id = old.id)) then
    raise exception 'ronda:currency_locked';
  end if;
  return new;
end;
$$;
create trigger groups_guard before update on public.groups
  for each row execute function public.guard_group_update();

-- Revisions and payments must use the group's currency (v1: one currency per group).
create function public.check_group_currency() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.currency <> (select g.currency from public.groups g where g.id = new.group_id) then
    raise exception 'ronda:currency_mismatch';
  end if;
  return new;
end;
$$;
create trigger expense_revisions_currency before insert on public.expense_revisions
  for each row execute function public.check_group_currency();
create trigger payments_currency before insert on public.payments
  for each row execute function public.check_group_currency();

-- Shares must sum exactly to the revision amount. Checked at commit so that the revision and
-- its shares can be inserted in the same transaction.
create function public.check_revision_shares() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_sum bigint;
  v_count integer;
begin
  select coalesce(sum(s.share_minor), 0), count(*) into v_sum, v_count
  from public.expense_shares s where s.revision_id = new.id;
  if v_count = 0 or v_sum <> new.amount_minor then
    raise exception 'ronda:shares_mismatch'
      using detail = format('revision %s: shares sum %s, amount %s', new.id, v_sum, new.amount_minor);
  end if;
  return null;
end;
$$;
create constraint trigger expense_revisions_shares_sum after insert on public.expense_revisions
  deferrable initially deferred for each row execute function public.check_revision_shares();

-- ---------------------------------------------------------------------------
-- Profile bootstrap and name propagation
-- ---------------------------------------------------------------------------
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_name text;
begin
  v_name := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Sin nombre'
  );
  insert into public.profiles (id, display_name) values (new.id, left(v_name, 60))
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.propagate_profile_name() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();
  if new.display_name is distinct from old.display_name then
    update public.group_members set display_name = new.display_name where user_id = new.id;
  end if;
  return new;
end;
$$;
create trigger profiles_propagate_name before update on public.profiles
  for each row execute function public.propagate_profile_name();
