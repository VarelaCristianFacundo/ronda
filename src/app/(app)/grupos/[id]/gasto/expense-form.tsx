'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState, useTransition } from 'react';
import { CheckIcon, CloseIcon } from '@/components/icons';
import { useToast } from '@/components/toast';
import { Avatar, FieldError } from '@/components/ui';
import { CATEGORIES, CATEGORY_CODES, formatDay, todayIso, type CategoryCode } from '@/lib/labels';
import { CURRENCIES, formatMoney, formatPercent, parseAmount, parsePercent, toInputValue, type CurrencyCode } from '@/lib/money';
import { computeSplit, type SplitMethod } from '@/lib/split';
import { saveExpense, voidExpense } from './actions';

export type FormMember = { id: string; label: string; name: string; color: number; active: boolean };

export type ExpenseInitial = {
  description: string;
  amountMinor: number;
  payerId: string;
  date: string;
  category: string | null;
  note: string | null;
  method: SplitMethod;
  shares: { memberId: string; shareMinor: number; input: number | null }[];
};

type Props = {
  groupId: string;
  groupName: string;
  currency: CurrencyCode;
  members: FormMember[]; // in group order; inactive ones only when already part of the expense
  meId: string;
  initial?: ExpenseInitial;
  edit?: { expenseId: string; revision: number };
};

export function ExpenseForm({ groupId, groupName, currency, members, meId, initial, edit }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const selectable = members.filter((m) => m.active || initial?.shares.some((s) => s.memberId === m.id) || initial?.payerId === m.id);
  const byId = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  const [amountText, setAmountText] = useState(initial ? toInputValue(initial.amountMinor) : '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [payerId, setPayerId] = useState(initial?.payerId ?? meId);
  const [date, setDate] = useState(initial?.date ?? todayIso());
  const [category, setCategory] = useState<string | null>(initial?.category ?? null);
  const [note, setNote] = useState(initial?.note ?? '');
  const [showNote, setShowNote] = useState(Boolean(initial?.note));
  const [method, setMethod] = useState<SplitMethod>(initial?.method ?? 'equal');
  const [participants, setParticipants] = useState<Set<string>>(
    () => new Set(initial?.method === 'equal' ? initial.shares.map((s) => s.memberId) : selectable.filter((m) => m.active).map((m) => m.id)),
  );
  const [exact, setExact] = useState<Record<string, string>>(() =>
    initial?.method === 'exact' ? Object.fromEntries(initial.shares.map((s) => [s.memberId, toInputValue(s.shareMinor)])) : {},
  );
  const [percent, setPercent] = useState<Record<string, string>>(() =>
    initial?.method === 'percent' ? Object.fromEntries(initial.shares.map((s) => [s.memberId, formatPercent(s.input ?? 0)])) : {},
  );
  const [lastEdited, setLastEdited] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  const amount = parseAmount(amountText);
  const c = currency;
  const label = (id: string) => byId.get(id)?.label ?? '—';

  // Live split preview with the same function the server uses.
  const preview = useMemo(() => {
    if (!amount) return null;
    if (method === 'equal') {
      return computeSplit({ method, total: amount, payerId, participants: selectable.filter((m) => participants.has(m.id)).map((m) => m.id) });
    }
    if (method === 'exact') {
      return computeSplit({
        method,
        total: amount,
        payerId,
        entries: selectable.map((m) => ({ memberId: m.id, minor: exact[m.id] ? (parseAmount(exact[m.id]) ?? -1) : 0 })),
      });
    }
    return computeSplit({
      method,
      total: amount,
      payerId,
      entries: selectable.map((m) => ({ memberId: m.id, bp: percent[m.id] ? (parsePercent(percent[m.id]) ?? -1) : 0 })),
    });
  }, [amount, method, payerId, participants, exact, percent, selectable]);

  const shareOf = (id: string) => (preview?.ok ? (preview.shares.find((s) => s.memberId === id)?.shareMinor ?? 0) : null);

  // Remainder for exact / percent.
  const assignedMinor = selectable.reduce((a, m) => a + (parseAmount(exact[m.id] ?? '') ?? 0), 0);
  const assignedBp = selectable.reduce((a, m) => a + (parsePercent(percent[m.id] ?? '') ?? 0), 0);
  const badInput =
    method === 'exact'
      ? selectable.find((m) => exact[m.id] && parseAmount(exact[m.id]) === null)
      : method === 'percent'
        ? selectable.find((m) => percent[m.id] && parsePercent(percent[m.id]) === null)
        : undefined;

  const reason: string | null = !amountText.trim()
    ? 'Escribí el monto.'
    : amount === null
      ? 'El monto no es válido.'
      : !description.trim()
        ? 'Poné una descripción.'
        : badInput
          ? `Revisá el valor de ${badInput.label}.`
          : preview && !preview.ok
            ? preview.error.code === 'no_participants'
              ? 'Elegí al menos una persona.'
              : preview.error.code === 'exact_mismatch'
                ? preview.error.diff > 0
                  ? `Faltan asignar ${formatMoney(preview.error.diff, c)}`
                  : `Sobran ${formatMoney(-preview.error.diff, c)}`
                : preview.error.code === 'percent_mismatch'
                  ? preview.error.diffBp > 0
                    ? `Falta un ${formatPercent(preview.error.diffBp)} %: la suma da ${formatPercent(preview.error.assignedBp)} %`
                    : `Sobra un ${formatPercent(-preview.error.diffBp)} %: la suma da ${formatPercent(preview.error.assignedBp)} %`
                  : 'Revisá el reparto.'
            : null;

  function fixRemainder() {
    if (!amount) return;
    if (method === 'exact') {
      const target = selectable.find((m) => m.id === payerId) ?? selectable[0];
      const current = parseAmount(exact[target.id] ?? '') ?? 0;
      const next = current + (amount - assignedMinor);
      if (next < 0) return;
      setExact({ ...exact, [target.id]: toInputValue(next) });
    } else if (method === 'percent') {
      const target = selectable.find((m) => m.id === lastEdited) ?? selectable.find((m) => percent[m.id]) ?? selectable[0];
      const current = parsePercent(percent[target.id] ?? '') ?? 0;
      const next = current + (10000 - assignedBp);
      if (next < 0 || next > 10000) return;
      setPercent({ ...percent, [target.id]: formatPercent(next) });
    }
  }

  function fixLabel(): string | null {
    if (!amount || badInput) return null;
    if (method === 'exact' && assignedMinor !== amount) {
      const target = selectable.find((m) => m.id === payerId) ?? selectable[0];
      const next = (parseAmount(exact[target.id] ?? '') ?? 0) + (amount - assignedMinor);
      if (next < 0) return null;
      const add = amount > assignedMinor;
      if (target.id === meId) return `${add ? 'Sumártelos' : 'Restártelos'} a vos${target.id === payerId ? ' (pagaste)' : ''}`;
      return `${add ? 'Sumárselos' : 'Restárselos'} a ${target.label}${target.id === payerId ? ' (pagó)' : ''}`;
    }
    if (method === 'percent' && assignedBp !== 10000) {
      const target = selectable.find((m) => m.id === lastEdited) ?? selectable.find((m) => percent[m.id]) ?? selectable[0];
      const next = (parsePercent(percent[target.id] ?? '') ?? 0) + (10000 - assignedBp);
      if (next < 0 || next > 10000) return null;
      return `Ajustar ${target.id === meId ? 'el tuyo' : `a ${target.label}`} (${formatPercent(next)} %)`;
    }
    return null;
  }

  function switchMethod(next: SplitMethod) {
    setMethod(next);
    setExpanded(next === 'equal');
    // Seed the new mode from the current equal split so people start from something that adds up.
    if (amount && preview?.ok && method === 'equal') {
      if (next === 'exact' && Object.keys(exact).length === 0) {
        setExact(Object.fromEntries(preview.shares.map((s) => [s.memberId, toInputValue(s.shareMinor)])));
      }
      if (next === 'percent' && Object.keys(percent).length === 0) {
        const n = preview.shares.length;
        const base = Math.floor(10000 / n);
        setPercent(Object.fromEntries(preview.shares.map((s, i) => [s.memberId, formatPercent(base + (i === 0 ? 10000 - base * n : 0))])));
      }
    }
  }

  function submit() {
    setTouched(true);
    if (reason || !amount || !preview?.ok) return;
    setError(null);
    const split =
      method === 'equal'
        ? { method, participants: preview.shares.map((s) => s.memberId) }
        : { method, entries: preview.shares.map((s) => ({ memberId: s.memberId, value: s.input ?? 0 })) };
    start(async () => {
      const res = await saveExpense(
        groupId,
        {
          description: description.trim(),
          amountMinor: amount,
          payerId,
          date,
          category,
          note: note.trim() || null,
          split: split as never,
        },
        edit ? { expenseId: edit.expenseId, expectedRevision: edit.revision } : undefined,
      );
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const expenseId = res.data.expenseId;
      if (edit) {
        router.push(`/grupos/${groupId}/g/${expenseId}`);
        toast({ message: res.data.message });
      } else {
        router.push(`/grupos/${groupId}?nuevo=${expenseId}`);
        toast({
          message: res.data.message,
          action: {
            label: 'Deshacer',
            onClick: async () => {
              const r = await voidExpense(groupId, expenseId, 'Deshecho al cargarlo');
              toast(r.ok ? { message: 'Listo, lo anulamos. Queda en el historial como anulado.' } : { tone: 'error', message: r.error });
              router.refresh();
            },
          },
        });
      }
    });
  }

  const fix = fixLabel();
  const payer = byId.get(payerId);
  const equalCount = participants.size;
  const perHead = preview?.ok && method === 'equal' && equalCount > 0 ? Math.floor((amount ?? 0) / equalCount) : null;
  const absorbs = preview?.ok && method === 'equal' ? preview.payerAbsorbs : 0;
  const notIncluded = selectable.filter((m) => m.active && !participants.has(m.id)).map((m) => m.label);
  const closeHref = edit ? `/grupos/${groupId}/g/${edit.expenseId}` : `/grupos/${groupId}`;
  const title = edit ? 'Editar gasto' : 'Nuevo gasto';

  return (
    <div className="expense-sheet">
      <Link href={closeHref} className="sheet-backdrop" aria-label="Cerrar" tabIndex={-1} />
      <form
        className="sheet-panel"
        role="dialog"
        aria-label={title}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        noValidate
      >
        <div className="topbar sheet-top">
          <Link href={closeHref} className="icon-btn" aria-label="Cerrar">
            <CloseIcon />
          </Link>
          <span className="topbar-title">
            <strong className="sheet-title">{title}</strong>
            <span>
              {groupName} · {c}
            </span>
          </span>
        </div>

        <div className="sheet-body stack gap-14">
          {expanded || method === 'equal' ? (
            <>
              <div className="sheet-hero">
                <label className="amount-field" htmlFor="amount">
                  <span className="currency">{CURRENCIES[c].symbol}</span>
                  <input
                    ref={amountRef}
                    id="amount"
                    inputMode="decimal"
                    autoComplete="off"
                    autoFocus={!edit}
                    placeholder="0"
                    value={amountText}
                    onChange={(e) => setAmountText(e.target.value)}
                    onBlur={() => amount !== null && setAmountText(toInputValue(amount))}
                    aria-label={`Monto en ${CURRENCIES[c].name}`}
                    aria-invalid={touched && (amount === null) ? true : undefined}
                  />
                </label>
                <input
                  className="input"
                  aria-label="Descripción"
                  placeholder="Ej: Súper del jueves"
                  maxLength={80}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  aria-invalid={touched && !description.trim() ? true : undefined}
                />
              </div>
              <div className="sheet-tiles">
                <label className="tile">
                  {payer && <Avatar name={payer.name} color={payer.color} size={28} />}
                  <span className="tile-text">
                    <span className="tile-label">Pagó</span>
                    <span className="tile-value">{label(payerId)}</span>
                  </span>
                  <select aria-label="Quién pagó" value={payerId} onChange={(e) => setPayerId(e.target.value)}>
                    {selectable
                      .filter((m) => m.active || m.id === initial?.payerId)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="tile">
                  <span className="tile-text">
                    <span className="tile-label">Fecha</span>
                    <span className="tile-value">{date === todayIso() ? `Hoy, ${formatDay(date)}` : formatDay(date, { year: 'always' })}</span>
                  </span>
                  <input type="date" aria-label="Fecha" value={date} max="2100-12-31" onChange={(e) => e.target.value && setDate(e.target.value)} />
                </label>
                <label className="tile sheet-desktop-only">
                  <span className="tile-text">
                    <span className="tile-label">Categoría</span>
                    <span className="tile-value">
                      {category ? (
                        <>
                          <span className="cat-inline">{category}</span>
                          {CATEGORIES[category as CategoryCode]}
                        </>
                      ) : (
                        'Sin categoría'
                      )}
                    </span>
                  </span>
                  <select aria-label="Categoría" value={category ?? ''} onChange={(e) => setCategory(e.target.value || null)}>
                    <option value="">Sin categoría</option>
                    {CATEGORY_CODES.map((code) => (
                      <option key={code} value={code}>
                        {CATEGORIES[code]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="chips sheet-mobile-only" role="radiogroup" aria-label="Categoría (opcional)">
                {CATEGORY_CODES.map((code) => (
                  <button
                    key={code}
                    type="button"
                    role="radio"
                    aria-checked={category === code}
                    className={`chip${category === code ? ' is-selected' : ''}`}
                    onClick={() => setCategory(category === code ? null : code)}
                  >
                    <span className="code">{code}</span>
                    {CATEGORIES[code]}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <button type="button" className="note hstack between" style={{ border: 0, textAlign: 'left', padding: '12px 14px' }} onClick={() => setExpanded(true)}>
              <span className="stack gap-4">
                <span style={{ font: '600 15px/1.2 var(--font-ui)', color: 'var(--ink)' }}>{description || 'Sin descripción'}</span>
                <span className="t-caption">
                  {payerId === meId ? 'Pagaste vos' : `Pagó ${label(payerId)}`} · {date === todayIso() ? 'hoy' : formatDay(date)} · <u>editar</u>
                </span>
              </span>
              <span className="amount" style={{ fontSize: 22, color: 'var(--ink)' }}>
                {amount ? formatMoney(amount, c) : '—'}
              </span>
            </button>
          )}

          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="sr-only">Cómo se divide</legend>
            <div className="segmented">
              {(
                [
                  ['equal', 'Iguales'],
                  ['exact', 'Montos'],
                  ['percent', '%'],
                ] as const
              ).map(([value, text]) => (
                <label key={value}>
                  <input type="radio" name="method" value={value} checked={method === value} onChange={() => switchMethod(value)} />
                  <span className="sheet-mobile-only">{text}</span>
                  <span className="sheet-desktop-only">{value === 'equal' ? 'Iguales' : value === 'exact' ? 'Montos exactos' : 'Porcentajes'}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {method === 'equal' ? (
            <div>
              <div className="hstack between" style={{ font: '600 13px/1 var(--font-ui)', color: 'var(--ink-2)', marginBottom: 2 }}>
                <span>Entre {equalCount === 1 ? '1 persona' : `${equalCount} personas`}</span>
                {perHead !== null && <span>{formatMoney(perHead, c)} c/u</span>}
              </div>
              <div className="list">
                {selectable.map((m) => {
                  const on = participants.has(m.id);
                  const share = on ? shareOf(m.id) : null;
                  return (
                    <label key={m.id} className="hstack gap-12" style={{ minHeight: 50, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={on}
                        disabled={!m.active && !on}
                        onChange={() => {
                          const next = new Set(participants);
                          if (on) next.delete(m.id);
                          else next.add(m.id);
                          setParticipants(next);
                        }}
                      />
                      <span className={`check${on ? ' is-on' : ''}`} aria-hidden="true">
                        {on && <CheckIcon />}
                      </span>
                      <span style={{ flex: 1, font: '500 16px/1.2 var(--font-ui)', color: on ? 'var(--ink)' : 'var(--ink-2)' }}>
                        {m.label}
                        {!m.active && <span className="t-caption"> · ex miembro</span>}
                      </span>
                      {on ? (
                        <span className="amount" style={{ fontSize: 16 }}>
                          {share !== null ? formatMoney(share, c) : '—'}
                        </span>
                      ) : (
                        <span style={{ font: '500 14px/1 var(--font-ui)', color: 'var(--ink-2)' }}>No participa</span>
                      )}
                    </label>
                  );
                })}
              </div>
              {absorbs > 0 && (
                <p className="t-caption" style={{ marginTop: 8 }}>
                  No se divide justo: {payerId === meId ? 'vos absorbés' : `${label(payerId)} absorbe`} {formatMoney(absorbs, c)} por el redondeo.
                </p>
              )}
            </div>
          ) : (
            <div>
              <div className="split-head">
                <span>Participa</span>
                <span style={{ textAlign: 'right' }}>{method === 'exact' ? 'Monto' : '%'}</span>
              </div>
              <div className="list">
                {selectable.map((m) => {
                  const text = method === 'exact' ? (exact[m.id] ?? '') : (percent[m.id] ?? '');
                  const invalidRow = text !== '' && (method === 'exact' ? parseAmount(text) === null : parsePercent(text) === null);
                  const bp = method === 'percent' ? parsePercent(text) : null;
                  // Exact share once everything adds up; a floor estimate while still typing.
                  const share =
                    method === 'percent' && amount && text && bp !== null
                      ? (shareOf(m.id) ?? Number((BigInt(amount) * BigInt(bp)) / 10000n))
                      : null;
                  return (
                    <div key={m.id} className="hstack gap-12" style={{ minHeight: 62 }}>
                      <Avatar name={m.name} color={m.color} inactive={!m.active} />
                      <span className="stack gap-4" style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ font: '500 16px/1.2 var(--font-ui)' }}>{m.label}</span>
                        {method === 'percent' && (
                          <span style={{ font: '600 13px/1 var(--font-ui)', color: 'var(--ink-2)', fontVariantNumeric: 'tabular-nums' }}>
                            {share !== null ? formatMoney(share, c) : ' '}
                          </span>
                        )}
                      </span>
                      <label className={`num-input${invalidRow ? ' is-invalid' : ''}`} style={{ width: method === 'exact' ? 132 : 96 }}>
                        {method === 'exact' && <span className="affix">{CURRENCIES[c].symbol}</span>}
                        <input
                          inputMode="decimal"
                          autoComplete="off"
                          placeholder="0"
                          aria-label={`${method === 'exact' ? 'Monto' : 'Porcentaje'} de ${m.label}`}
                          aria-invalid={invalidRow ? true : undefined}
                          value={text}
                          onChange={(e) => {
                            setLastEdited(m.id);
                            if (method === 'exact') setExact({ ...exact, [m.id]: e.target.value });
                            else setPercent({ ...percent, [m.id]: e.target.value });
                          }}
                          onBlur={() => {
                            if (method === 'exact') {
                              const v = parseAmount(text);
                              if (v !== null) setExact((x) => ({ ...x, [m.id]: v ? toInputValue(v) : '' }));
                            }
                          }}
                        />
                        {method === 'percent' && <span className="affix">%</span>}
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {showNote ? (
            <div className="field">
              <label className="field-label" htmlFor="note">
                Nota
              </label>
              <textarea id="note" className="textarea" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej: seña + saldo, incluye limpieza" />
            </div>
          ) : null}
        </div>

        <div className="sheet-foot stack gap-10">
          {method !== 'equal' && amount ? (
            reason && preview && !preview.ok ? (
              <div key="mismatch" className="alert stack gap-8" role="alert" style={{ alignItems: 'stretch' }}>
                <div className="hstack between gap-8">
                  <span className="hstack gap-8" style={{ font: '700 15px/1.2 var(--font-ui)' }}>
                    <span className="bang" aria-hidden="true">
                      !
                    </span>
                    {reason}
                  </span>
                  <span style={{ font: '500 13px/1 var(--font-ui)', color: 'var(--ink-body)', fontVariantNumeric: 'tabular-nums' }}>
                    {method === 'exact'
                      ? `${formatMoney(assignedMinor, c, { symbol: false })} / ${formatMoney(amount, c, { symbol: false })}`
                      : `${formatPercent(assignedBp)} / 100 %`}
                  </span>
                </div>
                <span className="progress" aria-hidden="true">
                  <span
                    style={{
                      width: `${Math.min(100, method === 'exact' ? (assignedMinor / amount) * 100 : assignedBp / 100)}%`,
                    }}
                  />
                </span>
                {fix && (
                  <button type="button" onClick={fixRemainder} className="fix-link">
                    {fix}
                  </button>
                )}
              </div>
            ) : !reason ? (
              <div key="ok" className="alert alert-ok stack gap-8" style={{ alignItems: 'stretch' }}>
                <div className="hstack between">
                  <span className="hstack gap-8" style={{ font: '700 15px/1.2 var(--font-ui)' }}>
                    <CheckIcon size={16} color="var(--owed)" />
                    {method === 'exact' ? 'Todo asignado' : '100 % asignado'}
                  </span>
                  <span style={{ font: '500 13px/1 var(--font-ui)', color: 'var(--ink-body)' }}>{formatMoney(amount, c)}</span>
                </div>
                <span className="progress" aria-hidden="true" />
              </div>
            ) : null
          ) : null}
          {error && (
            <div className="alert" role="alert">
              <span className="bang" aria-hidden="true">
                !
              </span>
              {error}
            </div>
          )}
          {method === 'equal' && (
            <p className="t-caption" style={{ textAlign: 'center' }}>
              {!showNote && (
                <button type="button" className="link-button" onClick={() => setShowNote(true)}>
                  + Agregar nota
                </button>
              )}
              {notIncluded.length > 0 && ` · ${notIncluded.join(', ')} no participa${notIncluded.length > 1 ? 'n' : ''}`}
            </p>
          )}
          {method !== 'equal' && !showNote && (
            <button type="button" className="link-button t-caption" onClick={() => setShowNote(true)}>
              + Agregar nota
            </button>
          )}
          <div className="sheet-actions">
            <Link href={closeHref} className="btn sheet-desktop-only">
              Cancelar
            </Link>
            <button type="submit" className="btn btn-primary" aria-disabled={Boolean(reason) || pending} disabled={pending} aria-describedby={reason ? 'save-reason' : undefined}>
              {pending && <span className="spinner" aria-hidden="true" />}
              {pending ? 'Guardando…' : edit ? 'Guardar cambios' : 'Guardar gasto'}
            </button>
          </div>
          {/* Save stays tappable but explains why it can't save yet (never just grey). */}
          {reason &&
            (method !== 'equal' && amount ? (
              <span id="save-reason" className="sr-only">
                {reason}
              </span>
            ) : touched ? (
              <span id="save-reason">
                <FieldError>{reason}</FieldError>
              </span>
            ) : (
              <span id="save-reason" className="t-caption" style={{ textAlign: 'center' }}>
                {reason}
              </span>
            ))}
        </div>
      </form>
    </div>
  );
}
