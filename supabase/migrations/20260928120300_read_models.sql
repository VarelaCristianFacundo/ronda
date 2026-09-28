-- Read models for the app. Views are security_invoker, so the caller's RLS applies.

create view public.expense_current with (security_invoker = true) as
select
  e.id as expense_id,
  e.group_id,
  e.created_by,
  e.created_at,
  e.voided_at,
  e.voided_by,
  e.void_reason,
  e.current_revision,
  r.id as revision_id,
  r.description,
  r.amount_minor,
  r.currency,
  r.payer_member_id,
  r.expense_date,
  r.split_method,
  r.category,
  r.note,
  r.created_by as revised_by,
  r.created_at as revised_at
from public.expenses e
join public.expense_revisions r on r.expense_id = e.id and r.revision = e.current_revision;

create view public.expense_current_shares with (security_invoker = true) as
select s.revision_id, e.id as expense_id, s.group_id, s.member_id, s.share_minor, s.input_value
from public.expenses e
join public.expense_revisions r on r.expense_id = e.id and r.revision = e.current_revision
join public.expense_shares s on s.revision_id = r.id;

grant select on public.expense_current, public.expense_current_shares to authenticated;

-- One row per group the caller is an active member of: their net balance and some context
-- for the groups list. Scoped to auth.uid(), so security definer does not widen access.
create function public.my_group_summaries()
returns table (
  group_id uuid,
  name text,
  currency text,
  member_id uuid,
  role public.member_role,
  net_minor bigint,
  active_members integer,
  member_colors smallint[],
  last_activity_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select
    g.id, g.name, g.currency, m.id, m.role,
    public._member_net(g.id, m.id),
    (select count(*)::int from public.group_members x where x.group_id = g.id and x.status = 'active'),
    (select array_agg(x.color_index order by x.seq) from public.group_members x
      where x.group_id = g.id and x.status = 'active'),
    (select max(ev.created_at) from public.group_events ev where ev.group_id = g.id)
  from public.group_members m
  join public.groups g on g.id = m.group_id
  where m.user_id = auth.uid() and m.status = 'active'
  order by 9 desc nulls last;
$$;

revoke execute on function public.my_group_summaries() from public, anon;
grant execute on function public.my_group_summaries() to authenticated;
