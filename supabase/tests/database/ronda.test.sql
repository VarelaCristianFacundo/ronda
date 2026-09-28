-- Authorization, integrity and audit tests. Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(74);

-- ---------------------------------------------------------------------------
-- Fixtures: three users. Alice owns the group, Bob joins by link, Carol by email.
-- Mallory never joins.
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, aud, role) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@example.com', now(), '{"full_name":"Alice"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@example.com',   now(), '{"full_name":"Bob"}',   'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000c', 'carol@example.com', now(), '{}',                    'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000d', 'mallory@example.com', now(), '{}',                  'authenticated', 'authenticated');

create temp table ids (k text primary key, v text);
grant all on ids to authenticated, anon;

create function pg_temp.login(p uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.id(p text) returns uuid language sql as $$ select v::uuid from ids where k = p $$;
-- Test-only window into the internal balance helper, callable while impersonating a user.
create function pg_temp.net(g uuid, m uuid) returns bigint language sql security definer as $$
  select public._member_net(g, m) $$;

select is((select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000a'), 'Alice',
  'profile is created from auth metadata');
select is((select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000c'), 'carol',
  'profile falls back to the email local part');

-- ---------------------------------------------------------------------------
-- Groups are visible only to members
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into ids values ('g', public.create_group('Bariloche ’26', 'ARS'));
insert into ids select 'alice_m', id from public.group_members where user_id = auth.uid();
select is((select count(*)::int from public.groups), 1, 'owner sees their group');
select is((select role::text from public.group_members where user_id = auth.uid()), 'owner', 'creator is owner');
insert into ids values ('juli_m', public.add_member(pg_temp.id('g'), 'Juli', null));
insert into ids values ('carol_m', public.add_member(pg_temp.id('g'), 'Caro', 'CAROL@example.com'));
select throws_ok($$ select public.add_member(pg_temp.id('g'), 'Otra', 'carol@example.com') $$,
  'P0001', 'ronda:already_invited', 'the same email cannot be invited twice');
insert into ids values ('token', public.create_invite(pg_temp.id('g')));

select pg_temp.login('00000000-0000-0000-0000-00000000000d');
select is((select count(*)::int from public.groups), 0, 'non-member sees no groups');
select is((select count(*)::int from public.group_members), 0, 'non-member sees no members');
select is((select count(*)::int from public.group_invites), 0, 'non-member sees no invite tokens');
select is((select count(*)::int from public.group_events), 0, 'non-member sees no history');
select throws_ok($$ select public.create_expense(pg_temp.id('g'), 'x', 100, 'ARS', pg_temp.id('alice_m'), current_date, 'equal', null, null,
    jsonb_build_array(jsonb_build_object('member_id', pg_temp.id('alice_m'), 'share_minor', 100))) $$,
  'P0001', 'ronda:not_member', 'non-member cannot add expenses through the RPC');
select throws_ok($$ insert into public.groups (name, currency) values ('x', 'ARS') $$,
  '42501', null, 'direct inserts into groups are denied');
select throws_ok($$ insert into public.expenses (group_id) values (pg_temp.id('g')) $$,
  '42501', null, 'direct inserts into expenses are denied');
select throws_ok($$ update public.group_members set role = 'owner' $$,
  '42501', null, 'direct membership updates are denied');
select throws_ok($$ select public.create_invite(pg_temp.id('g')) $$,
  'P0001', 'ronda:not_member', 'non-member cannot create invites');

select set_config('role', 'anon', true);
select throws_ok($$ select count(*) from public.groups $$, '42501', null, 'anon cannot read tables');
select throws_ok($$ select public.create_group('x', 'ARS') $$, '42501', null, 'anon cannot call RPCs');

-- ---------------------------------------------------------------------------
-- Joining: invite link, and automatic claim by verified email
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select is((public.get_invite((select v from ids where k = 'token')) ->> 'status'), 'valid', 'invite preview is available');
select is(jsonb_array_length(public.get_invite((select v from ids where k = 'token')) -> 'claimable'), 1,
  'only the placeholder without email (or with my email) is claimable');
select throws_ok($$ select public.accept_invite((select v from ids where k = 'token'), pg_temp.id('carol_m')) $$,
  'P0001', 'ronda:cannot_claim', 'cannot claim a slot reserved for another email');
select is(public.accept_invite((select v from ids where k = 'token')), pg_temp.id('g'), 'bob joins by link');
insert into ids select 'bob_m', id from public.group_members where user_id = auth.uid();
select is((select count(*)::int from public.groups), 1, 'new member sees the group');
select throws_ok($$ select public.accept_invite('not-a-real-token-123') $$, 'P0001', 'ronda:invite_invalid', 'bad token rejected');
select throws_ok($$ select public.add_member(pg_temp.id('g'), 'X', null) $$, 'P0001', 'ronda:not_owner',
  'members cannot add people');

select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select is(public.claim_email_memberships(), 1, 'carol claims the slot reserved for her email');
select is((select user_id from public.group_members where id = pg_temp.id('carol_m')),
  '00000000-0000-0000-0000-00000000000c'::uuid, 'slot is linked to carol');

-- ---------------------------------------------------------------------------
-- Expenses: validation of splits, currency and rounding rules
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
-- 1000 cents equally among alice, bob, juli, paid by alice: alice absorbs the extra cent.
insert into ids values ('e1', public.create_expense(pg_temp.id('g'), 'Cena', 1000, 'ARS', pg_temp.id('alice_m'), current_date,
  'equal', 'COM', null, jsonb_build_array(
    jsonb_build_object('member_id', pg_temp.id('alice_m'), 'share_minor', 334),
    jsonb_build_object('member_id', pg_temp.id('bob_m'), 'share_minor', 333),
    jsonb_build_object('member_id', pg_temp.id('juli_m'), 'share_minor', 333))));
select is((select sum(share_minor)::bigint from public.expense_shares), 1000::bigint, 'shares stored and sum to amount');

select throws_ok($$ select public.create_expense(pg_temp.id('g'), 'Cena', 1000, 'ARS', pg_temp.id('alice_m'), current_date, 'equal', null, null,
    jsonb_build_array(
      jsonb_build_object('member_id', pg_temp.id('alice_m'), 'share_minor', 333),
      jsonb_build_object('member_id', pg_temp.id('bob_m'), 'share_minor', 334),
      jsonb_build_object('member_id', pg_temp.id('juli_m'), 'share_minor', 333))) $$,
  'P0001', 'ronda:split_rule_mismatch', 'equal split must follow the deterministic rounding rule');
select throws_ok($$ select public.create_expense(pg_temp.id('g'), 'Cena', 1000, 'ARS', pg_temp.id('alice_m'), current_date, 'exact', null, null,
    jsonb_build_array(
      jsonb_build_object('member_id', pg_temp.id('alice_m'), 'share_minor', 500, 'input_value', 500),
      jsonb_build_object('member_id', pg_temp.id('bob_m'), 'share_minor', 400, 'input_value', 400))) $$,
  'P0001', 'ronda:shares_mismatch', 'exact shares must sum to the amount');
select throws_ok($$ select public.create_expense(pg_temp.id('g'), 'Cena', 1000, 'USD', pg_temp.id('alice_m'), current_date, 'exact', null, null,
    jsonb_build_array(jsonb_build_object('member_id', pg_temp.id('alice_m'), 'share_minor', 1000, 'input_value', 1000))) $$,
  'P0001', 'ronda:currency_mismatch', 'mixed currency is rejected');
select throws_ok($$ select public.create_expense(pg_temp.id('g'), 'Cena', 1000, 'ARS', pg_temp.id('alice_m'), current_date, 'exact', null, null,
    jsonb_build_array(
      jsonb_build_object('member_id', pg_temp.id('alice_m'), 'share_minor', 500, 'input_value', 500),
      jsonb_build_object('member_id', pg_temp.id('alice_m'), 'share_minor', 500, 'input_value', 500))) $$,
  'P0001', 'ronda:duplicate_participant', 'duplicate participants are rejected');
select throws_ok($$ select public.create_expense(pg_temp.id('g'), 'Cena', 1000, 'ARS', pg_temp.id('alice_m'), current_date, 'exact', null, null,
    jsonb_build_array(jsonb_build_object('member_id', '00000000-0000-0000-0000-0000000000ff', 'share_minor', 1000, 'input_value', 1000))) $$,
  'P0001', 'ronda:invalid_member', 'participants must belong to the group');
-- Percentages 33.33 / 33.33 / 33.34 of 100 cents → 33 / 33 / 34.
select lives_ok($$ select public.create_expense(pg_temp.id('g'), 'Taxi', 100, 'ARS', pg_temp.id('bob_m'), current_date, 'percent', 'TRA', null,
    jsonb_build_array(
      jsonb_build_object('member_id', pg_temp.id('alice_m'), 'share_minor', 33, 'input_value', 3333),
      jsonb_build_object('member_id', pg_temp.id('bob_m'), 'share_minor', 33, 'input_value', 3333),
      jsonb_build_object('member_id', pg_temp.id('juli_m'), 'share_minor', 34, 'input_value', 3334))) $$,
  'percent split following the largest-remainder rule is accepted');
select throws_ok($$ select public.create_expense(pg_temp.id('g'), 'Taxi', 100, 'ARS', pg_temp.id('bob_m'), current_date, 'percent', null, null,
    jsonb_build_array(
      jsonb_build_object('member_id', pg_temp.id('alice_m'), 'share_minor', 50, 'input_value', 5000),
      jsonb_build_object('member_id', pg_temp.id('bob_m'), 'share_minor', 50, 'input_value', 4000))) $$,
  'P0001', 'ronda:percent_mismatch', 'percentages must sum to 100 %');
select throws_ok($$ select public.update_group(pg_temp.id('g'), 'Bariloche ’26', 'USD') $$,
  'P0001', 'ronda:currency_locked', 'currency is locked once there are expenses');

-- ---------------------------------------------------------------------------
-- Edits create revisions; history is immutable
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select is(public.edit_expense(pg_temp.id('e1'), 1, 'Cena en El Boliche', 1200, 'ARS', pg_temp.id('alice_m'), current_date,
  'equal', 'COM', 'con postre', jsonb_build_array(
    jsonb_build_object('member_id', pg_temp.id('alice_m'), 'share_minor', 600),
    jsonb_build_object('member_id', pg_temp.id('bob_m'), 'share_minor', 600))), 2, 'another member can edit: revision 2');
select is((select count(*)::int from public.expense_revisions where expense_id = pg_temp.id('e1')), 2,
  'the original revision is kept');
select is((select amount_minor from public.expense_revisions where expense_id = pg_temp.id('e1') and revision = 1), 1000::bigint,
  'the original amount is unchanged');
select throws_ok($$ select public.edit_expense(pg_temp.id('e1'), 1, 'x', 1200, 'ARS', pg_temp.id('alice_m'), current_date, 'equal', null, null,
    jsonb_build_array(jsonb_build_object('member_id', pg_temp.id('alice_m'), 'share_minor', 1200))) $$,
  'P0001', 'ronda:stale_revision', 'concurrent edits based on an old revision are rejected');
select throws_ok($$ select public.edit_expense(pg_temp.id('e1'), 2, 'Cena en El Boliche', 1200, 'ARS', pg_temp.id('alice_m'), current_date,
    'equal', 'COM', 'con postre', jsonb_build_array(
      jsonb_build_object('member_id', pg_temp.id('alice_m'), 'share_minor', 600),
      jsonb_build_object('member_id', pg_temp.id('bob_m'), 'share_minor', 600))) $$,
  'P0001', 'ronda:no_changes', 'an edit without changes is rejected');

reset role;
select throws_ok($$ update public.expense_revisions set amount_minor = 1 $$, 'P0001', 'ronda:immutable_record',
  'revisions cannot be updated, even bypassing RLS');
select throws_ok($$ delete from public.expense_shares $$, 'P0001', 'ronda:immutable_record', 'shares cannot be deleted');
select throws_ok($$ delete from public.expenses $$, 'P0001', 'ronda:immutable_record', 'expenses cannot be deleted');
select throws_ok($$ delete from public.group_events $$, 'P0001', 'ronda:immutable_record', 'history cannot be deleted');

-- ---------------------------------------------------------------------------
-- Balances, payments and voids
-- ---------------------------------------------------------------------------
-- _member_net is internal (not executable by API roles), so balance checks run as postgres.
select is(public._member_net(pg_temp.id('g'), pg_temp.id('alice_m')), 567::bigint, 'alice: +600 cena, −33 taxi');
select is(public._member_net(pg_temp.id('g'), pg_temp.id('bob_m')), -533::bigint, 'bob: −600 cena, +67 taxi');

select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select throws_ok($$ select public._member_net(pg_temp.id('g'), pg_temp.id('bob_m')) $$, '42501', null,
  'internal helpers are not callable by users');
insert into ids select 'p1', (public.record_payment(pg_temp.id('g'), pg_temp.id('bob_m'), pg_temp.id('alice_m'), 200, 'ARS', current_date, 'transferencia', null)) ->> 'id';
reset role;
select is(public._member_net(pg_temp.id('g'), pg_temp.id('bob_m')), -333::bigint, 'partial repayment reduces the debt');
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select throws_ok($$ select public.record_payment(pg_temp.id('g'), pg_temp.id('bob_m'), pg_temp.id('alice_m'), 200, 'EUR', current_date, null, null) $$,
  'P0001', 'ronda:currency_mismatch', 'payment currency must match the group');
select throws_ok($$ select public.record_payment(pg_temp.id('g'), pg_temp.id('bob_m'), pg_temp.id('bob_m'), 200, 'ARS', current_date, null, null) $$,
  'P0001', 'ronda:invalid_member', 'cannot pay yourself');
select lives_ok($$ select public.void_payment(pg_temp.id('p1'), 'lo cargué dos veces') $$, 'payment can be voided');
select is(pg_temp.net(pg_temp.id('g'), pg_temp.id('bob_m')), -533::bigint, 'voided payment no longer counts');
select throws_ok($$ select public.void_payment(pg_temp.id('p1'), null) $$, 'P0001', 'ronda:already_voided', 'void is one-way');

reset role;
select throws_ok($$ update public.payments set amount_minor = 1 where id = pg_temp.id('p1') $$, 'P0001', 'ronda:already_voided',
  'voided payments are frozen');

select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select lives_ok($$ select public.void_expense(pg_temp.id('e1'), 'era de otro grupo') $$, 'expense can be voided');
select is(pg_temp.net(pg_temp.id('g'), pg_temp.id('bob_m')), 67::bigint, 'voided expense no longer counts');
select throws_ok($$ select public.edit_expense(pg_temp.id('e1'), 2, 'x', 100, 'ARS', pg_temp.id('alice_m'), current_date, 'equal', null, null,
    jsonb_build_array(jsonb_build_object('member_id', pg_temp.id('alice_m'), 'share_minor', 100))) $$,
  'P0001', 'ronda:already_voided', 'voided expenses cannot be edited');
select is((select count(*)::int from public.expense_revisions where expense_id = pg_temp.id('e1')), 2,
  'voided expense keeps its revisions');

-- ---------------------------------------------------------------------------
-- Membership management
-- ---------------------------------------------------------------------------
select throws_ok($$ select public.leave_group(pg_temp.id('g')) $$, 'P0001', 'ronda:balance_not_zero',
  'cannot leave with a non-zero balance');
select throws_ok($$ select public.remove_member(pg_temp.id('g'), pg_temp.id('juli_m'), true) $$, 'P0001', 'ronda:not_owner',
  'only owners remove members');

select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select throws_ok($$ select public.leave_group(pg_temp.id('g')) $$, 'P0001', 'ronda:balance_not_zero',
  'owner with balance cannot leave either');
select throws_ok($$ select public.remove_member(pg_temp.id('g'), pg_temp.id('bob_m')) $$, 'P0001', 'ronda:balance_not_zero',
  'removing someone with a balance needs confirmation');
select lives_ok($$ select public.remove_member(pg_temp.id('g'), pg_temp.id('bob_m'), true) $$, 'confirmed removal works');
select is(pg_temp.net(pg_temp.id('g'), pg_temp.id('bob_m')), 67::bigint, 'removed member keeps their balance');
select throws_ok($$ select public.create_expense(pg_temp.id('g'), 'x', 100, 'ARS', pg_temp.id('bob_m'), current_date, 'equal', null, null,
    jsonb_build_array(jsonb_build_object('member_id', pg_temp.id('bob_m'), 'share_minor', 100))) $$,
  'P0001', 'ronda:inactive_member', 'removed members cannot be used in new expenses');
select lives_ok($$ select public.record_payment(pg_temp.id('g'), pg_temp.id('alice_m'), pg_temp.id('bob_m'), 67, 'ARS', current_date, 'efectivo', null) $$,
  'debts with a removed member can still be settled');

select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from public.groups), 0, 'removed member loses access');
select throws_ok($$ select public.void_expense(pg_temp.id('e1'), null) $$, 'P0001', 'ronda:not_member',
  'removed member cannot write');

select is((select count(*)::int from public.expense_current), 0, 'views respect RLS for removed members');
select is((select count(*)::int from public.my_group_summaries()), 0, 'summaries only cover active memberships');

select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select is((select count(*)::int from public.expense_revisions), 3, 'history is intact after removal');
select is((select count(*)::int from public.expense_current), 2, 'current view shows one row per expense');
select is((select net_minor from public.my_group_summaries()), pg_temp.net(pg_temp.id('g'), pg_temp.id('alice_m')),
  'summary net matches the balance helper');
select ok((select array_agg(kind order by id) from public.group_events) @> array[
    'group_created', 'member_added', 'invite_created', 'member_joined', 'member_claimed',
    'expense_created', 'expense_edited', 'payment_recorded', 'payment_voided', 'expense_voided', 'member_removed'],
  'every action left an audit event');
select ok(not exists (select 1 from public.group_events where actor_user_id is null), 'events record the actor');

select * from finish();
rollback;
