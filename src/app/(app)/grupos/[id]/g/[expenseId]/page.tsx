import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Avatar, CategoryTile, TopBar } from '@/components/ui';
import { expenseEffectFor } from '@/lib/balances';
import { actorName, getExpenseRevisions, getGroup, who } from '@/lib/data';
import { diffRevisions, SECOND_PERSON } from '@/lib/history';
import { CATEGORIES, formatDateTime, formatDay, type CategoryCode } from '@/lib/labels';
import { formatMoney, formatPercent } from '@/lib/money';
import { VoidExpenseButton } from './void-button';

export const metadata: Metadata = { title: 'Gasto' };

export default async function ExpenseDetail(props: PageProps<'/grupos/[id]/g/[expenseId]'>) {
  const { id, expenseId } = await props.params;
  const b = await getGroup(id);
  const e = b.expenses.find((x) => x.id === expenseId);
  if (!e) notFound();
  const revisions = await getExpenseRevisions(expenseId);
  const c = b.group.currency;
  const effect = expenseEffectFor(b.me.id, e);
  const involved = e.payerId === b.me.id || e.shares.some((s) => s.memberId === b.me.id);
  const payerText = e.payerId === b.me.id ? 'pagaste vos' : `pagó ${who(b, e.payerId)}`;
  const splitTitle =
    e.method === 'equal' ? `Iguales entre ${e.shares.length}` : e.method === 'exact' ? 'Montos exactos' : 'Porcentajes';

  // Timeline, newest first: void, edits, creation.
  type Entry = { key: string; text: React.ReactNode; at: string; kind: 'void' | 'edit' | 'create' };
  const entries: Entry[] = [];
  revisions.forEach((r, i) => {
    const actor = actorName(b, r.createdBy);
    if (i === 0) {
      entries.push({ key: `r${r.revision}`, at: r.createdAt, kind: 'create', text: actor.isMe ? 'Creaste el gasto' : `${actor.name} creó el gasto` });
      return;
    }
    const changes = diffRevisions(revisions[i - 1], r, c, (mid) => who(b, mid));
    entries.push({
      key: `r${r.revision}`,
      at: r.createdAt,
      kind: 'edit',
      text: changes.length ? (
        changes.map((ch, j) => {
          // "Cami cambió el total…" / "Cambiaste el total…"; later lines start with "También".
          const verb = actor.isMe ? SECOND_PERSON[ch.verb] : ch.verb;
          const lead = j === 0 ? (actor.isMe ? verb[0].toUpperCase() + verb.slice(1) : `${actor.name} ${verb}`) : `También ${verb}`;
          return (
            <span key={j} style={{ display: 'block' }}>
              {lead} {ch.what}
              {ch.from !== undefined && (
                <>
                  {' '}
                  de <s>{ch.from}</s> a <b>{ch.to}</b>
                </>
              )}
            </span>
          );
        })
      ) : (
        `${actor.isMe ? 'Editaste' : `${actor.name} editó`} el gasto`
      ),
    });
  });
  entries.reverse();
  const voider = e.voided ? actorName(b, e.voidedBy) : null;

  return (
    <main className="screen">
      <TopBar back={`/grupos/${id}`}>
        {!e.voided && (
          <Link href={`/grupos/${id}/g/${expenseId}/editar`} className="btn btn-text">
            Editar
          </Link>
        )}
      </TopBar>
      <div className="content stack gap-14" style={{ paddingBottom: 40 }}>
        <div className="hstack gap-14" style={{ alignItems: 'flex-start' }}>
          <CategoryTile code={e.category ?? 'OTR'} size={52} kind={e.voided ? 'void' : 'expense'} />
          <span className="stack gap-6">
            <h1 style={{ font: '500 24px/1.15 var(--font-display)', textWrap: 'balance', textDecoration: e.voided ? 'line-through' : undefined }}>
              {e.description}
            </h1>
            <span className="t-caption" style={{ fontSize: 14 }}>
              {e.category ? `${CATEGORIES[e.category as CategoryCode]} · ` : ''}
              {formatDay(e.date, { year: 'always' })}
            </span>
          </span>
        </div>

        {e.voided && (
          <div className="alert" role="status">
            <span className="bang" aria-hidden="true">
              !
            </span>
            <span>
              Anulado el {formatDateTime(e.voidedAt!)}
              {e.voidReason ? ` · “${e.voidReason}”` : ''}. No cuenta para los saldos; queda acá como registro.
            </span>
          </div>
        )}

        <div className="hstack between" style={{ alignItems: 'flex-end', padding: '14px 0', borderTop: '1.5px solid var(--ink)', borderBottom: '1px solid var(--line)' }}>
          <span className="stack gap-6">
            <span style={{ font: '500 13px/1 var(--font-ui)', color: 'var(--ink-2)' }}>Total · {payerText}</span>
            <span className="amount" style={{ fontSize: 40, letterSpacing: '-0.02em', textDecoration: e.voided ? 'line-through' : undefined }}>
              {formatMoney(e.amountMinor, c)}
            </span>
          </span>
          {!e.voided && involved && effect !== 0 && (
            <span className="stack gap-6" style={{ alignItems: 'flex-end' }}>
              <span className={`row-end-label ${effect > 0 ? 'is-owed' : 'is-owe'}`}>{effect > 0 ? 'te deben' : 'tu parte'}</span>
              <span className={`amount ${effect > 0 ? 'is-owed' : 'is-owe'}`} style={{ fontSize: 20 }}>
                {formatMoney(Math.abs(effect), c)}
              </span>
            </span>
          )}
        </div>

        <div>
          <h2 className="overline" style={{ marginBottom: 2 }}>
            {splitTitle}
          </h2>
          <ul className="list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {e.shares.map((s) => {
              const m = b.byId.get(s.memberId)!;
              return (
                <li key={s.memberId} className="balance-row" style={{ minHeight: 44 }}>
                  <Avatar name={m.name} color={m.color} size={26} inactive={m.status !== 'active'} />
                  <span style={{ font: '500 15px/1 var(--font-ui)' }}>
                    {who(b, s.memberId)}
                    {e.method === 'percent' && <span className="muted"> · {formatPercent(s.input ?? 0)} %</span>}
                  </span>
                  <span className="leader" aria-hidden="true" />
                  <span className="amount" style={{ fontSize: 16 }}>
                    {formatMoney(s.shareMinor, c)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        {e.note && (
          <div className="note" style={{ fontSize: 15, color: 'var(--ink)' }}>
            <span style={{ font: '600 12px/1 var(--font-ui)', color: 'var(--ink-2)', display: 'block', marginBottom: 6 }}>Nota</span>
            {e.note}
          </div>
        )}

        <section aria-labelledby="hist">
          <h2 id="hist" className="overline" style={{ marginBottom: 10 }}>
            Historial de cambios
          </h2>
          <ol className="timeline" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {e.voided && (
              <li className="tl-item">
                <span className="tl-rail">
                  <span className="tl-dot is-void" />
                  <span className="tl-line" />
                </span>
                <span className="tl-body">
                  <span className="tl-text">
                    {voider?.isMe ? 'Anulaste el gasto' : `${voider?.name ?? 'Alguien'} anuló el gasto`}
                    {e.voidReason ? `: “${e.voidReason}”` : ''}
                  </span>
                  <span className="tl-meta">{formatDateTime(e.voidedAt!)}</span>
                </span>
              </li>
            )}
            {entries.map((en, i) => (
              <li key={en.key} className="tl-item">
                <span className="tl-rail">
                  <span className={`tl-dot${en.kind === 'create' ? ' is-hollow' : ''}`} />
                  {i < entries.length - 1 && <span className="tl-line" />}
                </span>
                <span className="tl-body">
                  <span className="tl-text">{en.text}</span>
                  <span className="tl-meta">{formatDateTime(en.at)}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>

        {!e.voided && <VoidExpenseButton groupId={id} expenseId={expenseId} description={e.description} />}
      </div>
    </main>
  );
}
