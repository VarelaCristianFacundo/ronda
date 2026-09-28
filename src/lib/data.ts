import 'server-only';
import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { computeBalances, memberTotals, type BalanceExpense } from '@/lib/balances';
import { suggestTransfers, type Transfer } from '@/lib/settle';
import { isCurrencyCode, type CurrencyCode } from '@/lib/money';
import type { SplitMethod } from '@/lib/split';
import type { Database } from '@/lib/database.types';

type Tables = Database['public']['Tables'];
type Client = Awaited<ReturnType<typeof createClient>>;

export type Member = {
  id: string;
  userId: string | null;
  name: string;
  role: 'owner' | 'member';
  status: 'active' | 'left' | 'removed';
  color: number;
  seq: number;
  invitedEmail: string | null;
  isMe: boolean;
};

export type Expense = {
  id: string;
  revision: number;
  revisionId: string;
  description: string;
  amountMinor: number;
  currency: CurrencyCode;
  payerId: string;
  date: string;
  method: SplitMethod;
  category: string | null;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
  revisedBy: string | null;
  revisedAt: string;
  voided: boolean;
  voidedAt: string | null;
  voidedBy: string | null;
  voidReason: string | null;
  shares: { memberId: string; shareMinor: number; input: number | null }[];
};

export type Payment = {
  id: string;
  receiptNumber: number;
  fromId: string;
  toId: string;
  amountMinor: number;
  currency: CurrencyCode;
  date: string;
  method: string | null;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
  voided: boolean;
  voidedAt: string | null;
  voidedBy: string | null;
  voidReason: string | null;
};

export type GroupSummary = {
  id: string;
  name: string;
  currency: CurrencyCode;
  memberId: string;
  role: 'owner' | 'member';
  netMinor: number;
  activeMembers: number;
  colors: number[];
  lastActivityAt: string | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(v: string): boolean {
  return UUID_RE.test(v);
}

function toNumber(v: number | string | null): number {
  const n = typeof v === 'string' ? Number(v) : (v ?? 0);
  if (!Number.isSafeInteger(n)) throw new Error('Unsafe integer from database');
  return n;
}

/** Reads every row of a query in pages, so the API row cap never truncates financial data. */
async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const size = 1000;
  const rows: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < size) return rows;
  }
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

export const getSession = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user };
});

export async function requireUser() {
  const { supabase, user } = await getSession();
  if (!user) redirect('/entrar');
  return { supabase, user };
}

export const getProfile = cache(async () => {
  const { supabase, user } = await requireUser();
  const { data } = await supabase.from('profiles').select('display_name, payment_alias').eq('id', user.id).maybeSingle();
  return {
    id: user.id,
    email: user.email ?? '',
    name: data?.display_name ?? user.email?.split('@')[0] ?? 'Vos',
    alias: data?.payment_alias ?? null,
  };
});

export const getGroupSummaries = cache(async (): Promise<GroupSummary[]> => {
  const { supabase } = await requireUser();
  // Link any group slots reserved for this user's email since the last visit. Cheap no-op
  // otherwise; running it here keeps the list and sidebar consistent within a request.
  await supabase.rpc('claim_email_memberships');
  const { data, error } = await supabase.rpc('my_group_summaries');
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.group_id,
    name: r.name,
    currency: isCurrencyCode(r.currency) ? r.currency : 'ARS',
    memberId: r.member_id,
    role: r.role,
    netMinor: toNumber(r.net_minor),
    activeMembers: r.active_members,
    colors: (r.member_colors ?? []).map(Number),
    lastActivityAt: r.last_activity_at,
  }));
});

// ---------------------------------------------------------------------------
// Group bundle
// ---------------------------------------------------------------------------

function mapMember(m: Tables['group_members']['Row'], myId: string): Member {
  return {
    id: m.id,
    userId: m.user_id,
    name: m.display_name,
    role: m.role,
    status: m.status,
    color: m.color_index,
    seq: toNumber(m.seq),
    invitedEmail: m.invited_email,
    isMe: m.user_id === myId,
  };
}

function mapPayment(p: Tables['payments']['Row']): Payment {
  return {
    id: p.id,
    receiptNumber: toNumber(p.receipt_number),
    fromId: p.from_member_id,
    toId: p.to_member_id,
    amountMinor: toNumber(p.amount_minor),
    currency: p.currency as CurrencyCode,
    date: p.paid_on,
    method: p.method,
    note: p.note,
    createdBy: p.created_by,
    createdAt: p.created_at,
    voided: p.voided_at !== null,
    voidedAt: p.voided_at,
    voidedBy: p.voided_by,
    voidReason: p.void_reason,
  };
}

async function loadGroup(supabase: Client, groupId: string, userId: string) {
  const [groupRes, membersRes, expenseRows, shareRows, paymentRows] = await Promise.all([
    supabase.from('groups').select('id, name, currency, created_at').eq('id', groupId).maybeSingle(),
    supabase.from('group_members').select('*').eq('group_id', groupId).order('seq'),
    fetchAll((a, b) =>
      supabase.from('expense_current').select('*').eq('group_id', groupId).order('created_at', { ascending: false }).order('expense_id').range(a, b),
    ),
    fetchAll((a, b) =>
      supabase
        .from('expense_current_shares')
        .select('expense_id, member_id, share_minor, input_value')
        .eq('group_id', groupId)
        .order('expense_id')
        .order('member_id')
        .range(a, b),
    ),
    fetchAll((a, b) =>
      supabase.from('payments').select('*').eq('group_id', groupId).order('created_at', { ascending: false }).order('id').range(a, b),
    ),
  ]);
  if (groupRes.error) throw groupRes.error;
  if (!groupRes.data) return null;
  if (membersRes.error) throw membersRes.error;

  const members = (membersRes.data ?? []).map((m) => mapMember(m, userId));
  const me = members.find((m) => m.isMe && m.status === 'active');
  if (!me) return null;

  const sharesByExpense = new Map<string, Expense['shares']>();
  for (const s of shareRows) {
    if (!s.expense_id || !s.member_id) continue;
    const list = sharesByExpense.get(s.expense_id) ?? [];
    list.push({ memberId: s.member_id, shareMinor: toNumber(s.share_minor), input: s.input_value === null ? null : toNumber(s.input_value) });
    sharesByExpense.set(s.expense_id, list);
  }
  const order = new Map(members.map((m) => [m.id, m.seq]));
  const expenses: Expense[] = expenseRows.map((e) => ({
    id: e.expense_id!,
    revision: e.current_revision!,
    revisionId: e.revision_id!,
    description: e.description!,
    amountMinor: toNumber(e.amount_minor),
    currency: e.currency as CurrencyCode,
    payerId: e.payer_member_id!,
    date: e.expense_date!,
    method: e.split_method as SplitMethod,
    category: e.category,
    note: e.note,
    createdBy: e.created_by,
    createdAt: e.created_at!,
    revisedBy: e.revised_by,
    revisedAt: e.revised_at!,
    voided: e.voided_at !== null,
    voidedAt: e.voided_at,
    voidedBy: e.voided_by,
    voidReason: e.void_reason,
    shares: (sharesByExpense.get(e.expense_id!) ?? []).sort((x, y) => (order.get(x.memberId) ?? 0) - (order.get(y.memberId) ?? 0)),
  }));
  const payments = paymentRows.map(mapPayment);

  const group = {
    id: groupRes.data.id,
    name: groupRes.data.name,
    currency: groupRes.data.currency as CurrencyCode,
    createdAt: groupRes.data.created_at,
  };
  return { group, members, me, expenses, payments };
}

export type GroupBundle = NonNullable<Awaited<ReturnType<typeof loadGroup>>> & {
  byId: Map<string, Member>;
  balances: Map<string, number>;
  transfers: Transfer[];
  myTotals: { paid: number; share: number };
  totalSpent: number;
  hasMovements: boolean;
};

export const getGroup = cache(async (groupId: string): Promise<GroupBundle> => {
  if (!isUuid(groupId)) notFound();
  const { supabase, user } = await requireUser();
  const loaded = await loadGroup(supabase, groupId, user.id);
  if (!loaded) notFound();

  const balanceExpenses: BalanceExpense[] = loaded.expenses.map((e) => ({
    payerId: e.payerId,
    amountMinor: e.amountMinor,
    shares: e.shares,
    voided: e.voided,
  }));
  const balances = computeBalances(
    loaded.members.map((m) => m.id),
    balanceExpenses,
    loaded.payments,
  );
  const order = loaded.members.map((m) => m.id);
  return {
    ...loaded,
    byId: new Map(loaded.members.map((m) => [m.id, m])),
    balances,
    transfers: suggestTransfers(balances, order),
    myTotals: memberTotals(loaded.me.id, balanceExpenses),
    totalSpent: loaded.expenses.filter((e) => !e.voided).reduce((a, e) => a + e.amountMinor, 0),
    hasMovements: loaded.expenses.length > 0 || loaded.payments.length > 0,
  };
});

/** Every revision of one expense, oldest first, with its shares (for the change history). */
export async function getExpenseRevisions(expenseId: string) {
  const { supabase } = await requireUser();
  const { data: revs, error } = await supabase
    .from('expense_revisions')
    .select('id, revision, description, amount_minor, payer_member_id, expense_date, split_method, category, note, created_by, created_at')
    .eq('expense_id', expenseId)
    .order('revision');
  if (error) throw error;
  const ids = (revs ?? []).map((r) => r.id);
  const { data: shares, error: e2 } = ids.length
    ? await supabase.from('expense_shares').select('revision_id, member_id, share_minor, input_value').in('revision_id', ids)
    : { data: [], error: null };
  if (e2) throw e2;
  return (revs ?? []).map((r) => ({
    revision: r.revision,
    description: r.description,
    amountMinor: toNumber(r.amount_minor),
    payerId: r.payer_member_id,
    date: r.expense_date,
    method: r.split_method as SplitMethod,
    category: r.category,
    note: r.note,
    createdBy: r.created_by,
    createdAt: r.created_at,
    shares: (shares ?? [])
      .filter((s) => s.revision_id === r.id)
      .map((s) => ({ memberId: s.member_id, shareMinor: toNumber(s.share_minor), input: s.input_value === null ? null : toNumber(s.input_value) })),
  }));
}

/** Complete audit data for a group: every revision with shares, and the event log. */
export async function getGroupAudit(groupId: string) {
  const { supabase } = await requireUser();
  const [revs, shares, events] = await Promise.all([
    fetchAll((a, b) =>
      supabase
        .from('expense_revisions')
        .select('id, expense_id, revision, description, amount_minor, currency, payer_member_id, expense_date, split_method, category, note, created_by, created_at')
        .eq('group_id', groupId)
        .order('created_at')
        .order('id')
        .range(a, b),
    ),
    fetchAll((a, b) =>
      supabase.from('expense_shares').select('revision_id, member_id, share_minor, input_value').eq('group_id', groupId).order('revision_id').order('member_id').range(a, b),
    ),
    fetchAll((a, b) =>
      supabase.from('group_events').select('id, kind, actor_user_id, actor_member_id, expense_id, payment_id, member_id, data, created_at').eq('group_id', groupId).order('id', { ascending: false }).range(a, b),
    ),
  ]);
  const sharesByRev = new Map<string, { memberId: string; shareMinor: number; input: number | null }[]>();
  for (const s of shares) {
    const list = sharesByRev.get(s.revision_id) ?? [];
    list.push({ memberId: s.member_id, shareMinor: toNumber(s.share_minor), input: s.input_value === null ? null : toNumber(s.input_value) });
    sharesByRev.set(s.revision_id, list);
  }
  return {
    revisions: revs.map((r) => ({
      id: r.id,
      expenseId: r.expense_id,
      revision: r.revision,
      description: r.description,
      amountMinor: toNumber(r.amount_minor),
      currency: r.currency,
      payerId: r.payer_member_id,
      date: r.expense_date,
      method: r.split_method as SplitMethod,
      category: r.category,
      note: r.note,
      createdBy: r.created_by,
      createdAt: r.created_at,
      shares: sharesByRev.get(r.id) ?? [],
    })),
    events: events.map((e) => ({
      id: toNumber(e.id),
      kind: e.kind,
      actorUserId: e.actor_user_id,
      expenseId: e.expense_id,
      paymentId: e.payment_id,
      memberId: e.member_id,
      data: (e.data ?? {}) as Record<string, unknown>,
      createdAt: e.created_at,
    })),
  };
}

/** Name for a user id within a group ("Vos" for the viewer); for audit lines. */
export function actorName(bundle: Pick<GroupBundle, 'byId' | 'members'>, userId: string | null): { name: string; isMe: boolean } {
  const m = bundle.members.find((x) => x.userId === userId);
  if (!m) return { name: 'Alguien', isMe: false };
  return { name: m.isMe ? 'Vos' : who(bundle, m.id), isMe: m.isMe };
}

/** Payment aliases of co-members (profiles are readable only for people you share a group with). */
export async function getAliases(userIds: string[]): Promise<Map<string, string>> {
  const ids = userIds.filter(Boolean);
  if (!ids.length) return new Map();
  const { supabase } = await requireUser();
  const { data } = await supabase.from('profiles').select('id, payment_alias').in('id', ids);
  return new Map((data ?? []).filter((p) => p.payment_alias).map((p) => [p.id, p.payment_alias as string]));
}

export async function getActiveInvite(groupId: string) {
  const { supabase } = await requireUser();
  const { data } = await supabase
    .from('group_invites')
    .select('token, expires_at')
    .eq('group_id', groupId)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? { token: data.token, expiresAt: data.expires_at } : null;
}

/** Display name relative to the viewer: "Vos" for yourself. */
export function who(bundle: Pick<GroupBundle, 'byId'>, memberId: string): string {
  const m = bundle.byId.get(memberId);
  if (!m) return 'Alguien';
  if (m.isMe) return 'Vos';
  const first = m.name.split(' ')[0];
  const clash = [...bundle.byId.values()].some(
    (o) => o.id !== m.id && o.name.split(' ')[0].toLocaleLowerCase('es') === first.toLocaleLowerCase('es'),
  );
  return clash ? m.name : first;
}

export function fullName(bundle: Pick<GroupBundle, 'byId'>, memberId: string): string {
  const m = bundle.byId.get(memberId);
  if (!m) return 'Alguien';
  return m.isMe ? 'Vos' : m.name;
}
