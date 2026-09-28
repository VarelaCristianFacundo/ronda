import Link from 'next/link';
import { fullName, who, type GroupBundle } from '@/lib/data';
import { formatMoney, spokenMoney } from '@/lib/money';
import { Avatar } from './ui';

type B = Pick<GroupBundle, 'members' | 'balances' | 'byId' | 'group' | 'me' | 'transfers'>;

/** Members to show in balance lists: active ones, plus former members still carrying a balance. */
export function balanceMembers(b: B) {
  return b.members.filter((m) => m.status === 'active' || (b.balances.get(m.id) ?? 0) !== 0);
}

export function BalanceList({ b, rowHeight = 50 }: { b: B; rowHeight?: number }) {
  const c = b.group.currency;
  return (
    <ul className="list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {balanceMembers(b).map((m) => {
        const net = b.balances.get(m.id) ?? 0;
        const verb = net > 0 ? (m.isMe ? 'recibís' : 'recibe') : net < 0 ? (m.isMe ? 'debés' : 'debe') : 'al día';
        const name = m.isMe ? 'Vos' : who(b, m.id);
        return (
          <li key={m.id} className="balance-row" style={{ minHeight: rowHeight }}>
            <Avatar name={m.name} color={m.color} size={30} inactive={m.status !== 'active'} />
            <span className="balance-name">{name}</span>
            <span className="balance-verb">
              {verb}
              {m.status !== 'active' && ' · ex miembro'}
            </span>
            <span className="leader" aria-hidden="true" />
            {net === 0 ? (
              <span className="amount muted" style={{ fontSize: 17 }}>
                {formatMoney(0, c)}
              </span>
            ) : (
              <span
                className={`amount ${net > 0 ? 'is-owed' : 'is-owe'}`}
                style={{ fontSize: 17 }}
                aria-label={`${fullName(b, m.id)} ${verb} ${spokenMoney(Math.abs(net), c)}`}
              >
                {net > 0 ? '+' : '−'} {formatMoney(Math.abs(net), c)}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Hero sentence under the big number, e.g. "Nico y Juli te tienen que pagar." */
export function heroSentence(b: B): string {
  const net = b.balances.get(b.me.id) ?? 0;
  const payers = b.transfers.filter((t) => t.toId === b.me.id).map((t) => who(b, t.fromId));
  const payees = b.transfers.filter((t) => t.fromId === b.me.id).map((t) => who(b, t.toId));
  const join = (xs: string[]) => (xs.length <= 1 ? xs[0] : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`);
  if (net > 0 && payers.length) return `${join(payers)} ${payers.length === 1 ? 'te tiene' : 'te tienen'} que pagar.`;
  if (net < 0 && payees.length) return `Le tenés que pagar a ${join(payees)}.`;
  return 'No le debés nada a nadie y nadie te debe.';
}

export function SettleLink({ groupId }: { groupId: string }) {
  return (
    <Link href={`/grupos/${groupId}/saldar`} className="text-link">
      Ver cómo saldar
    </Link>
  );
}
