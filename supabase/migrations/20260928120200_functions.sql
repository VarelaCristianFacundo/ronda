-- Write API. Every function:
--   * runs as security definer with an empty search_path (fully-qualified names only),
--   * resolves the caller with auth.uid() and checks membership/ownership itself,
--   * validates inputs (the app validates too, but this is the authority),
--   * writes the audit event in the same transaction.
-- Errors are raised as 'ronda:<code>' so the app can map them to Spanish messages.

-- ---------------------------------------------------------------------------
-- Internal helpers (not executable by API roles)
-- ---------------------------------------------------------------------------
create function public._uid() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare v uuid := auth.uid();
begin
  if v is null then raise exception 'ronda:not_authenticated'; end if;
  return v;
end;
$$;

-- The caller's active membership row in a group, with an optional owner requirement.
create function public._my_member(p_group uuid, p_require_owner boolean default false)
returns public.group_members
language plpgsql stable security definer set search_path = '' as $$
declare m public.group_members;
begin
  select * into m from public.group_members
  where group_id = p_group and user_id = public._uid() and status = 'active';
  if not found then raise exception 'ronda:not_member'; end if;
  if p_require_owner and m.role <> 'owner' then raise exception 'ronda:not_owner'; end if;
  return m;
end;
$$;

create function public._log(
  p_group uuid, p_actor_member uuid, p_kind text,
  p_expense uuid default null, p_payment uuid default null, p_member uuid default null,
  p_data jsonb default '{}'::jsonb
) returns void
language sql security definer set search_path = '' as $$
  insert into public.group_events (group_id, actor_user_id, actor_member_id, kind, expense_id, payment_id, member_id, data)
  values (p_group, auth.uid(), p_actor_member, p_kind, p_expense, p_payment, p_member, p_data);
$$;

create function public._clean_text(p text, p_max integer) returns text
language plpgsql immutable set search_path = '' as $$
declare v text := nullif(btrim(p), '');
begin
  if v is not null and char_length(v) > p_max then raise exception 'ronda:text_too_long'; end if;
  return v;
end;
$$;

-- Net balance of one member (positive: is owed; negative: owes). Current revisions of
-- non-voided expenses plus non-voided payments.
create function public._member_net(p_group uuid, p_member uuid) returns bigint
language sql stable security definer set search_path = '' as $$
  with cur as (
    select r.id, r.amount_minor, r.payer_member_id
    from public.expenses e
    join public.expense_revisions r on r.expense_id = e.id and r.revision = e.current_revision
    where e.group_id = p_group and e.voided_at is null
  )
  select
      coalesce((select sum(amount_minor) from cur where payer_member_id = p_member), 0)
    - coalesce((select sum(s.share_minor) from public.expense_shares s join cur on cur.id = s.revision_id
                where s.member_id = p_member), 0)
    + coalesce((select sum(amount_minor) from public.payments
                where group_id = p_group and voided_at is null and from_member_id = p_member), 0)
    - coalesce((select sum(amount_minor) from public.payments
                where group_id = p_group and voided_at is null and to_member_id = p_member), 0);
$$;

-- Verifies that p_shares ([{member_id, share_minor, input_value}]) is exactly what the
-- deterministic rounding rules produce for this amount/method/payer. Mirrors src/lib/split.ts;
-- "order" is group_members.seq.
create function public._validate_shares(
  p_group uuid, p_amount bigint, p_method public.split_method, p_payer uuid, p_shares jsonb
) returns void
language plpgsql stable security definer set search_path = '' as $$
declare
  v_n integer;
  v_distinct integer;
  v_known integer;
  v_sum bigint;
  v_bad integer;
  v_bp bigint;
begin
  if p_shares is null or jsonb_typeof(p_shares) <> 'array' or jsonb_array_length(p_shares) = 0 then
    raise exception 'ronda:no_participants';
  end if;

  select count(*), count(distinct x.member_id), coalesce(sum(x.share_minor), 0), count(m.id)
  into v_n, v_distinct, v_sum, v_known
  from jsonb_to_recordset(p_shares) as x(member_id uuid, share_minor bigint, input_value bigint)
  left join public.group_members m on m.id = x.member_id and m.group_id = p_group;

  if v_n <> v_distinct then raise exception 'ronda:duplicate_participant'; end if;
  if v_known <> v_n then raise exception 'ronda:invalid_member'; end if;
  if exists (select 1 from jsonb_to_recordset(p_shares) as x(member_id uuid, share_minor bigint)
             where x.share_minor is null or x.share_minor < 0) then
    raise exception 'ronda:invalid_share';
  end if;
  if v_sum <> p_amount then raise exception 'ronda:shares_mismatch'; end if;

  if p_method = 'equal' then
    with s as (
      select x.member_id, x.share_minor, x.input_value, m.seq
      from jsonb_to_recordset(p_shares) as x(member_id uuid, share_minor bigint, input_value bigint)
      join public.group_members m on m.id = x.member_id
    ), k as (
      select s.*,
        p_amount / v_n as base,
        p_amount % v_n as rest,
        exists (select 1 from s s2 where s2.member_id = p_payer) as payer_in,
        row_number() over (order by s.seq) as rn
      from s
    )
    select count(*) into v_bad from k
    where k.input_value is not null
       or k.share_minor <> k.base + case
            when k.payer_in then case when k.member_id = p_payer then k.rest else 0 end
            else case when k.rn <= k.rest then 1 else 0 end
          end;

  elsif p_method = 'exact' then
    select count(*) into v_bad
    from jsonb_to_recordset(p_shares) as x(member_id uuid, share_minor bigint, input_value bigint)
    where x.input_value is distinct from x.share_minor or x.share_minor = 0;

  else -- percent, basis points
    select coalesce(sum(x.input_value), 0) into v_bp
    from jsonb_to_recordset(p_shares) as x(member_id uuid, input_value bigint);
    if v_bp <> 10000 or exists (
         select 1 from jsonb_to_recordset(p_shares) as x(member_id uuid, input_value bigint)
         where x.input_value is null or x.input_value <= 0 or x.input_value > 10000) then
      raise exception 'ronda:percent_mismatch';
    end if;
    with s as (
      select x.member_id, x.share_minor, m.seq,
        (p_amount * x.input_value) / 10000 as fl,
        (p_amount * x.input_value) % 10000 as rem
      from jsonb_to_recordset(p_shares) as x(member_id uuid, share_minor bigint, input_value bigint)
      join public.group_members m on m.id = x.member_id
    ), k as (
      select s.*,
        p_amount - sum(s.fl) over () as leftover,
        row_number() over (order by s.rem desc, s.seq) as rn
      from s
    )
    select count(*) into v_bad from k
    where k.share_minor <> k.fl + case when k.rn <= k.leftover then 1 else 0 end;
  end if;

  if v_bad > 0 then raise exception 'ronda:split_rule_mismatch'; end if;
end;
$$;

-- Payer and participants must be members of the group; new ones must be active. Members that
-- already appeared in the previous revision may stay even if they left since.
create function public._check_expense_members(
  p_group uuid, p_payer uuid, p_shares jsonb, p_prev_revision uuid default null
) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if exists (
    select 1
    from (
      select p_payer as member_id
      union
      select x.member_id from jsonb_to_recordset(p_shares) as x(member_id uuid)
    ) ids
    left join public.group_members m on m.id = ids.member_id and m.group_id = p_group
    where m.id is null
  ) then
    raise exception 'ronda:invalid_member';
  end if;
  if exists (
    select 1
    from (
      select p_payer as member_id
      union
      select x.member_id from jsonb_to_recordset(p_shares) as x(member_id uuid)
    ) ids
    join public.group_members m on m.id = ids.member_id and m.group_id = p_group
    where (m.status <> 'active' and (
             p_prev_revision is null
             or not exists (
               select 1 from public.expense_revisions r
               where r.id = p_prev_revision and r.payer_member_id = ids.member_id
               union all
               select 1 from public.expense_shares s
               where s.revision_id = p_prev_revision and s.member_id = ids.member_id)))
  ) then
    raise exception 'ronda:inactive_member';
  end if;
end;
$$;

create function public._check_expense_fields(
  p_group uuid, p_description text, p_amount bigint, p_currency text, p_date date, p_category text
) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_description is null or char_length(btrim(p_description)) not between 1 and 80 then
    raise exception 'ronda:invalid_description';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount > 1000000000000 then raise exception 'ronda:invalid_amount'; end if;
  if p_currency is distinct from (select currency from public.groups where id = p_group) then
    raise exception 'ronda:currency_mismatch';
  end if;
  if p_date is null or p_date < date '2000-01-01' or p_date > current_date + 366 then
    raise exception 'ronda:invalid_date';
  end if;
  if p_category is not null and p_category not in ('ALO', 'COM', 'SUP', 'TRA', 'SAL', 'SER', 'OTR') then
    raise exception 'ronda:invalid_category';
  end if;
end;
$$;

create function public._insert_revision(
  p_expense uuid, p_group uuid, p_revision integer, p_description text, p_amount bigint, p_currency text,
  p_payer uuid, p_date date, p_method public.split_method, p_category text, p_note text, p_shares jsonb
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_rev uuid;
begin
  insert into public.expense_revisions (expense_id, group_id, revision, description, amount_minor, currency,
    payer_member_id, expense_date, split_method, category, note, created_by)
  values (p_expense, p_group, p_revision, btrim(p_description), p_amount, p_currency,
    p_payer, p_date, p_method, p_category, public._clean_text(p_note, 500), auth.uid())
  returning id into v_rev;

  insert into public.expense_shares (revision_id, group_id, member_id, share_minor, input_value)
  select v_rev, p_group, x.member_id, x.share_minor, x.input_value
  from jsonb_to_recordset(p_shares) as x(member_id uuid, share_minor bigint, input_value bigint);
  return v_rev;
end;
$$;

-- ---------------------------------------------------------------------------
-- Groups
-- ---------------------------------------------------------------------------
create function public.create_group(p_name text, p_currency text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public._uid();
  v_group uuid;
  v_member uuid;
  v_name text;
begin
  if p_name is null or char_length(btrim(p_name)) not between 1 and 60 then raise exception 'ronda:invalid_name'; end if;
  if p_currency is null or p_currency not in ('ARS', 'USD', 'EUR') then raise exception 'ronda:invalid_currency'; end if;
  if (select count(*) from public.group_members where user_id = v_uid and status = 'active') >= 200 then
    raise exception 'ronda:too_many_groups';
  end if;

  select display_name into v_name from public.profiles where id = v_uid;
  insert into public.groups (name, currency, created_by) values (btrim(p_name), p_currency, v_uid)
  returning id into v_group;
  insert into public.group_members (group_id, user_id, display_name, role, color_index, created_by)
  values (v_group, v_uid, coalesce(v_name, 'Sin nombre'), 'owner', 0, v_uid)
  returning id into v_member;
  perform public._log(v_group, v_member, 'group_created', p_data => jsonb_build_object('name', btrim(p_name), 'currency', p_currency));
  return v_group;
end;
$$;

create function public.update_group(p_group uuid, p_name text, p_currency text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me public.group_members := public._my_member(p_group, true);
  g public.groups;
begin
  select * into g from public.groups where id = p_group for update;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 60 then raise exception 'ronda:invalid_name'; end if;
  if p_currency is null or p_currency not in ('ARS', 'USD', 'EUR') then raise exception 'ronda:invalid_currency'; end if;
  if btrim(p_name) <> g.name then
    update public.groups set name = btrim(p_name) where id = p_group;
    perform public._log(p_group, me.id, 'group_renamed', p_data => jsonb_build_object('from', g.name, 'to', btrim(p_name)));
  end if;
  if p_currency <> g.currency then
    update public.groups set currency = p_currency where id = p_group; -- trigger rejects if locked
    perform public._log(p_group, me.id, 'group_currency_changed', p_data => jsonb_build_object('from', g.currency, 'to', p_currency));
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Membership
-- ---------------------------------------------------------------------------
create function public._next_color(p_group uuid) returns smallint
language sql stable security definer set search_path = '' as $$
  select (count(*) % 6)::smallint from public.group_members where group_id = p_group;
$$;

-- Owner adds someone who has no account yet (optionally with their email, so they are
-- linked automatically when they sign in with it).
create function public.add_member(p_group uuid, p_name text, p_email text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me public.group_members := public._my_member(p_group, true);
  v_email text := lower(nullif(btrim(p_email), ''));
  v_id uuid;
begin
  if p_name is null or char_length(btrim(p_name)) not between 1 and 60 then raise exception 'ronda:invalid_name'; end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$' then raise exception 'ronda:invalid_email'; end if;
  if (select count(*) from public.group_members where group_id = p_group and status = 'active') >= 50 then
    raise exception 'ronda:too_many_members';
  end if;
  if v_email is not null and exists (
    select 1 from public.group_members m join auth.users u on u.id = m.user_id
    where m.group_id = p_group and m.status = 'active' and lower(u.email) = v_email) then
    raise exception 'ronda:already_member';
  end if;
  if v_email is not null and exists (
    select 1 from public.group_members
    where group_id = p_group and invited_email = v_email and user_id is null and status = 'active') then
    raise exception 'ronda:already_invited';
  end if;

  insert into public.group_members (group_id, display_name, invited_email, color_index, created_by)
  values (p_group, btrim(p_name), v_email, public._next_color(p_group), auth.uid())
  returning id into v_id;
  perform public._log(p_group, me.id, 'member_added', p_member => v_id,
    p_data => jsonb_build_object('name', btrim(p_name), 'with_email', v_email is not null));
  return v_id;
end;
$$;

-- Links placeholder slots whose invited email matches the caller's verified email.
create function public.claim_email_memberships() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public._uid();
  v_email text;
  r record;
  v_count integer := 0;
begin
  select lower(email) into v_email from auth.users where id = v_uid and email_confirmed_at is not null;
  if v_email is null then return 0; end if;

  for r in
    select m.id, m.group_id from public.group_members m
    where m.invited_email = v_email and m.user_id is null and m.status = 'active'
      and not exists (select 1 from public.group_members o where o.group_id = m.group_id and o.user_id = v_uid)
    for update
  loop
    update public.group_members set user_id = v_uid where id = r.id;
    perform public._log(r.group_id, r.id, 'member_claimed', p_member => r.id, p_data => jsonb_build_object('via', 'email'));
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create function public.create_invite(p_group uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  me public.group_members := public._my_member(p_group, true);
  v_token text := translate(encode(extensions.gen_random_bytes(12), 'base64'), '+/=', '-_');
begin
  update public.group_invites set revoked_at = now()
  where group_id = p_group and revoked_at is null and expires_at > now();
  insert into public.group_invites (group_id, token, created_by, expires_at)
  values (p_group, v_token, auth.uid(), now() + interval '7 days');
  perform public._log(p_group, me.id, 'invite_created');
  return v_token;
end;
$$;

create function public.revoke_invites(p_group uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare me public.group_members := public._my_member(p_group, true);
begin
  update public.group_invites set revoked_at = now()
  where group_id = p_group and revoked_at is null and expires_at > now();
  if found then perform public._log(p_group, me.id, 'invite_revoked'); end if;
end;
$$;

-- What a person opening an invite link may see before joining.
create function public.get_invite(p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := public._uid();
  i public.group_invites;
  g public.groups;
  v_email text;
  v_status text;
begin
  select * into i from public.group_invites where token = p_token;
  if not found then return jsonb_build_object('status', 'invalid'); end if;
  select * into g from public.groups where id = i.group_id;
  v_status := case when i.revoked_at is not null then 'revoked' when i.expires_at <= now() then 'expired' else 'valid' end;
  if v_status <> 'valid' then
    return jsonb_build_object('status', v_status, 'group_name', g.name);
  end if;
  select lower(email) into v_email from auth.users where id = v_uid;

  return jsonb_build_object(
    'status', 'valid',
    'group_id', g.id,
    'group_name', g.name,
    'currency', g.currency,
    'expires_at', i.expires_at,
    'member_count', (select count(*) from public.group_members where group_id = g.id and status = 'active'),
    'inviter_name', (select display_name from public.group_members where group_id = g.id and user_id = i.created_by),
    'already_member', exists (select 1 from public.group_members where group_id = g.id and user_id = v_uid and status = 'active'),
    'claimable', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'display_name', m.display_name) order by m.seq)
      from public.group_members m
      where m.group_id = g.id and m.user_id is null and m.status = 'active'
        and (m.invited_email is null or m.invited_email = v_email)
    ), '[]'::jsonb)
  );
end;
$$;

create function public.accept_invite(p_token text, p_claim_member uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public._uid();
  i public.group_invites;
  existing public.group_members;
  target public.group_members;
  v_name text;
  v_email text;
  v_id uuid;
begin
  select * into i from public.group_invites where token = p_token for share;
  if not found then raise exception 'ronda:invite_invalid'; end if;
  if i.revoked_at is not null or i.expires_at <= now() then raise exception 'ronda:invite_expired'; end if;

  select * into existing from public.group_members where group_id = i.group_id and user_id = v_uid for update;
  if found then
    if existing.status = 'active' then return i.group_id; end if;
    update public.group_members set status = 'active', left_at = null, role = 'member' where id = existing.id;
    perform public._log(i.group_id, existing.id, 'member_rejoined', p_member => existing.id);
    return i.group_id;
  end if;

  if (select count(*) from public.group_members where group_id = i.group_id and status = 'active') >= 50 then
    raise exception 'ronda:too_many_members';
  end if;

  if p_claim_member is not null then
    select lower(email) into v_email from auth.users where id = v_uid;
    select * into target from public.group_members where id = p_claim_member and group_id = i.group_id for update;
    if not found or target.user_id is not null or target.status <> 'active'
       or (target.invited_email is not null and target.invited_email is distinct from v_email) then
      raise exception 'ronda:cannot_claim';
    end if;
    update public.group_members set user_id = v_uid where id = target.id;
    perform public._log(i.group_id, target.id, 'member_claimed', p_member => target.id, p_data => jsonb_build_object('via', 'link'));
    return i.group_id;
  end if;

  select display_name into v_name from public.profiles where id = v_uid;
  insert into public.group_members (group_id, user_id, display_name, color_index, created_by)
  values (i.group_id, v_uid, coalesce(v_name, 'Sin nombre'), public._next_color(i.group_id), v_uid)
  returning id into v_id;
  perform public._log(i.group_id, v_id, 'member_joined', p_member => v_id);
  return i.group_id;
end;
$$;

-- Leaving: allowed only with a zero balance, and never leaving a group without an owner while
-- other people with accounts remain. History is untouched.
create function public.leave_group(p_group uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me public.group_members := public._my_member(p_group);
  v_net bigint;
begin
  perform 1 from public.group_members where group_id = p_group for update;
  v_net := public._member_net(p_group, me.id);
  if v_net <> 0 then raise exception 'ronda:balance_not_zero'; end if;
  if me.role = 'owner'
     and not exists (select 1 from public.group_members where group_id = p_group and status = 'active'
                     and role = 'owner' and id <> me.id)
     and exists (select 1 from public.group_members where group_id = p_group and status = 'active'
                 and user_id is not null and id <> me.id) then
    raise exception 'ronda:last_owner';
  end if;
  update public.group_members set status = 'left', left_at = now(), role = 'member' where id = me.id;
  perform public._log(p_group, me.id, 'member_left', p_member => me.id);
end;
$$;

-- Owner removes someone. A non-zero balance requires explicit confirmation (p_force); the
-- balance stays in the group so the debt is not erased.
create function public.remove_member(p_group uuid, p_member uuid, p_force boolean default false) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me public.group_members := public._my_member(p_group, true);
  target public.group_members;
  v_net bigint;
begin
  select * into target from public.group_members where id = p_member and group_id = p_group for update;
  if not found or target.status <> 'active' then raise exception 'ronda:invalid_member'; end if;
  if target.id = me.id then raise exception 'ronda:cannot_remove_self'; end if;
  v_net := public._member_net(p_group, target.id);
  if v_net <> 0 and not coalesce(p_force, false) then raise exception 'ronda:balance_not_zero'; end if;
  update public.group_members set status = 'removed', left_at = now(), role = 'member' where id = target.id;
  perform public._log(p_group, me.id, 'member_removed', p_member => target.id,
    p_data => jsonb_build_object('net_minor', v_net));
end;
$$;

create function public.set_member_role(p_group uuid, p_member uuid, p_role public.member_role) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me public.group_members := public._my_member(p_group, true);
  target public.group_members;
begin
  select * into target from public.group_members where id = p_member and group_id = p_group for update;
  if not found or target.status <> 'active' or target.user_id is null then raise exception 'ronda:invalid_member'; end if;
  if target.role = p_role then return; end if;
  if p_role = 'member' and not exists (
    select 1 from public.group_members where group_id = p_group and status = 'active' and role = 'owner' and id <> target.id) then
    raise exception 'ronda:last_owner';
  end if;
  update public.group_members set role = p_role where id = target.id;
  perform public._log(p_group, me.id, 'member_role_changed', p_member => target.id,
    p_data => jsonb_build_object('from', target.role, 'to', p_role));
end;
$$;

-- ---------------------------------------------------------------------------
-- Expenses
-- ---------------------------------------------------------------------------
create function public.create_expense(
  p_group uuid, p_description text, p_amount bigint, p_currency text, p_payer uuid, p_date date,
  p_method public.split_method, p_category text, p_note text, p_shares jsonb
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me public.group_members := public._my_member(p_group);
  v_expense uuid;
begin
  perform public._check_expense_fields(p_group, p_description, p_amount, p_currency, p_date, p_category);
  perform public._check_expense_members(p_group, p_payer, p_shares);
  perform public._validate_shares(p_group, p_amount, p_method, p_payer, p_shares);

  insert into public.expenses (group_id, created_by) values (p_group, auth.uid()) returning id into v_expense;
  perform public._insert_revision(v_expense, p_group, 1, p_description, p_amount, p_currency, p_payer, p_date,
    p_method, p_category, p_note, p_shares);
  perform public._log(p_group, me.id, 'expense_created', p_expense => v_expense,
    p_data => jsonb_build_object('description', btrim(p_description), 'amount_minor', p_amount));
  return v_expense;
end;
$$;

create function public.edit_expense(
  p_expense uuid, p_expected_revision integer, p_description text, p_amount bigint, p_currency text,
  p_payer uuid, p_date date, p_method public.split_method, p_category text, p_note text, p_shares jsonb
) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  e public.expenses;
  me public.group_members;
  prev public.expense_revisions;
  v_prev_shares jsonb;
  v_new_shares jsonb;
begin
  select * into e from public.expenses where id = p_expense for update;
  if not found then raise exception 'ronda:not_found'; end if;
  me := public._my_member(e.group_id);
  if e.voided_at is not null then raise exception 'ronda:already_voided'; end if;
  if e.current_revision <> p_expected_revision then raise exception 'ronda:stale_revision'; end if;

  select * into prev from public.expense_revisions where expense_id = e.id and revision = e.current_revision;
  perform public._check_expense_fields(e.group_id, p_description, p_amount, p_currency, p_date, p_category);
  perform public._check_expense_members(e.group_id, p_payer, p_shares, prev.id);
  perform public._validate_shares(e.group_id, p_amount, p_method, p_payer, p_shares);

  select coalesce(jsonb_agg(jsonb_build_array(member_id, share_minor, input_value) order by member_id), '[]'::jsonb)
  into v_prev_shares from public.expense_shares where revision_id = prev.id;
  select coalesce(jsonb_agg(jsonb_build_array(x.member_id, x.share_minor, x.input_value) order by x.member_id), '[]'::jsonb)
  into v_new_shares from jsonb_to_recordset(p_shares) as x(member_id uuid, share_minor bigint, input_value bigint);

  if prev.description = btrim(p_description) and prev.amount_minor = p_amount and prev.payer_member_id = p_payer
     and prev.expense_date = p_date and prev.split_method = p_method
     and prev.category is not distinct from p_category
     and prev.note is not distinct from public._clean_text(p_note, 500)
     and v_prev_shares = v_new_shares then
    raise exception 'ronda:no_changes';
  end if;

  perform public._insert_revision(e.id, e.group_id, e.current_revision + 1, p_description, p_amount, p_currency,
    p_payer, p_date, p_method, p_category, p_note, p_shares);
  update public.expenses set current_revision = e.current_revision + 1 where id = e.id;
  perform public._log(e.group_id, me.id, 'expense_edited', p_expense => e.id,
    p_data => jsonb_build_object('from_revision', e.current_revision, 'to_revision', e.current_revision + 1));
  return e.current_revision + 1;
end;
$$;

create function public.void_expense(p_expense uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  e public.expenses;
  me public.group_members;
begin
  select * into e from public.expenses where id = p_expense for update;
  if not found then raise exception 'ronda:not_found'; end if;
  me := public._my_member(e.group_id);
  if e.voided_at is not null then raise exception 'ronda:already_voided'; end if;
  update public.expenses set voided_at = now(), voided_by = auth.uid(), void_reason = public._clean_text(p_reason, 200)
  where id = e.id;
  perform public._log(e.group_id, me.id, 'expense_voided', p_expense => e.id,
    p_data => jsonb_build_object('reason', public._clean_text(p_reason, 200)));
end;
$$;

-- ---------------------------------------------------------------------------
-- Payments
-- ---------------------------------------------------------------------------
create function public.record_payment(
  p_group uuid, p_from uuid, p_to uuid, p_amount bigint, p_currency text, p_date date,
  p_method text default null, p_note text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me public.group_members := public._my_member(p_group);
  v_id uuid;
  v_receipt bigint;
begin
  if p_amount is null or p_amount <= 0 or p_amount > 1000000000000 then raise exception 'ronda:invalid_amount'; end if;
  if p_currency is distinct from (select currency from public.groups where id = p_group) then
    raise exception 'ronda:currency_mismatch';
  end if;
  if p_from is null or p_to is null or p_from = p_to then raise exception 'ronda:invalid_member'; end if;
  -- Departed members may still settle historical debts, so any membership status is accepted.
  if (select count(*) from public.group_members where group_id = p_group and id in (p_from, p_to)) <> 2 then
    raise exception 'ronda:invalid_member';
  end if;
  if p_date is null or p_date < date '2000-01-01' or p_date > current_date + 1 then raise exception 'ronda:invalid_date'; end if;
  if p_method is not null and p_method not in ('transferencia', 'efectivo', 'otro') then raise exception 'ronda:invalid_method'; end if;

  insert into public.payments (group_id, from_member_id, to_member_id, amount_minor, currency, paid_on, method, note, created_by)
  values (p_group, p_from, p_to, p_amount, p_currency, p_date, p_method, public._clean_text(p_note, 500), auth.uid())
  returning id, receipt_number into v_id, v_receipt;
  perform public._log(p_group, me.id, 'payment_recorded', p_payment => v_id,
    p_data => jsonb_build_object('amount_minor', p_amount));
  return jsonb_build_object('id', v_id, 'receipt_number', v_receipt);
end;
$$;

create function public.void_payment(p_payment uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  p public.payments;
  me public.group_members;
begin
  select * into p from public.payments where id = p_payment for update;
  if not found then raise exception 'ronda:not_found'; end if;
  me := public._my_member(p.group_id);
  if p.voided_at is not null then raise exception 'ronda:already_voided'; end if;
  update public.payments set voided_at = now(), voided_by = auth.uid(), void_reason = public._clean_text(p_reason, 200)
  where id = p.id;
  perform public._log(p.group_id, me.id, 'payment_voided', p_payment => p.id,
    p_data => jsonb_build_object('reason', public._clean_text(p_reason, 200)));
end;
$$;

-- ---------------------------------------------------------------------------
-- Execute privileges: only the public RPCs, only for signed-in users.
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.is_group_member(uuid) to authenticated;
grant execute on function public.is_group_owner(uuid) to authenticated;
grant execute on function public.shares_group_with(uuid) to authenticated;

grant execute on function public.create_group(text, text) to authenticated;
grant execute on function public.update_group(uuid, text, text) to authenticated;
grant execute on function public.add_member(uuid, text, text) to authenticated;
grant execute on function public.claim_email_memberships() to authenticated;
grant execute on function public.create_invite(uuid) to authenticated;
grant execute on function public.revoke_invites(uuid) to authenticated;
grant execute on function public.get_invite(text) to authenticated;
grant execute on function public.accept_invite(text, uuid) to authenticated;
grant execute on function public.leave_group(uuid) to authenticated;
grant execute on function public.remove_member(uuid, uuid, boolean) to authenticated;
grant execute on function public.set_member_role(uuid, uuid, public.member_role) to authenticated;
grant execute on function public.create_expense(uuid, text, bigint, text, uuid, date, public.split_method, text, text, jsonb) to authenticated;
grant execute on function public.edit_expense(uuid, integer, text, bigint, text, uuid, date, public.split_method, text, text, jsonb) to authenticated;
grant execute on function public.void_expense(uuid, text) to authenticated;
grant execute on function public.record_payment(uuid, uuid, uuid, bigint, text, date, text, text) to authenticated;
grant execute on function public.void_payment(uuid, text) to authenticated;
