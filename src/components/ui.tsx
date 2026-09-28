import Link from 'next/link';
import { formatMoney, spokenMoney, type CurrencyCode } from '@/lib/money';
import { initial } from '@/lib/labels';
import { BackIcon, CloseIcon } from './icons';

export const AVATAR_COLORS = ['#E8B04A', '#9FBFDA', '#CBA6C1', '#D5B28F', '#A9B4C4', '#B9C79E'];

export function avatarColor(index: number) {
  return AVATAR_COLORS[((index % 6) + 6) % 6];
}

export function Avatar({
  name,
  color,
  size = 32,
  inactive = false,
  placeholder = false,
}: {
  name: string;
  color: number;
  size?: number;
  inactive?: boolean;
  placeholder?: boolean;
}) {
  return (
    <span
      className={`avatar${inactive ? ' is-inactive' : ''}${placeholder ? ' avatar-placeholder' : ''}`}
      style={{ ['--size' as string]: `${size}px`, background: placeholder ? undefined : avatarColor(color) }}
      aria-hidden="true"
    >
      {placeholder ? '' : initial(name)}
    </span>
  );
}

/** "La ronda": ring with one segment per active member, in their colors, 2° gaps. */
export function RondaAvatar({
  colors,
  letter,
  size = 44,
  gapColor = 'var(--paper)',
}: {
  colors: number[];
  letter?: string;
  size?: number;
  gapColor?: string;
}) {
  const n = Math.max(colors.length, 1);
  const seg = 360 / n;
  const stops =
    n === 1
      ? `${avatarColor(colors[0] ?? 0)} 0 360deg`
      : colors
          .map((c, i) => {
            const a = i * seg;
            const b = a + seg - 2;
            return `${avatarColor(c)} ${a}deg ${b}deg, ${gapColor} ${b}deg ${a + seg}deg`;
          })
          .join(', ');
  return (
    <span
      className="ronda"
      style={{ ['--size' as string]: `${size}px`, background: `conic-gradient(${stops})` }}
      aria-hidden="true"
    >
      <span className="ronda-inner">{letter}</span>
    </span>
  );
}

export function CategoryTile({ code, size = 40, kind = 'expense' }: { code: string; size?: number; kind?: 'expense' | 'payment' | 'void' }) {
  return (
    <span
      className={`cat${kind === 'payment' ? ' is-payment' : ''}${kind === 'void' ? ' is-void' : ''}`}
      style={{ ['--size' as string]: `${size}px` }}
      aria-hidden="true"
    >
      {code}
    </span>
  );
}

export function Money({
  minor,
  currency,
  className = '',
  sign,
  label,
}: {
  minor: number;
  currency: CurrencyCode;
  className?: string;
  sign?: '+' | '−';
  label?: string;
}) {
  return (
    <span className={`amount ${className}`} aria-label={label ?? spokenMoney(minor, currency)}>
      {sign ? `${sign} ` : ''}
      {formatMoney(minor, currency)}
    </span>
  );
}

export function TopBar({
  back,
  close,
  title,
  subtitle,
  children,
}: {
  back?: string;
  close?: string;
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="topbar">
      {back && (
        <Link href={back} className="icon-btn" aria-label="Volver">
          <BackIcon />
        </Link>
      )}
      {close && (
        <Link href={close} className="icon-btn" aria-label="Cerrar">
          <CloseIcon />
        </Link>
      )}
      {(title || subtitle) && (
        <span className="topbar-title">
          {title && <strong>{title}</strong>}
          {subtitle && <span>{subtitle}</span>}
        </span>
      )}
      {!title && !subtitle && <span className="spacer" />}
      {children}
    </div>
  );
}

export function FieldError({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <span className="field-error" id={id}>
      <span className="bang" aria-hidden="true">
        !
      </span>
      <span>{children}</span>
    </span>
  );
}

export function Alert({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <div className="alert" role="alert" id={id}>
      <span className="bang" aria-hidden="true">
        !
      </span>
      <span>{children}</span>
    </div>
  );
}

export function BrandMark({ size = 18 }: { size?: number }) {
  return <span className="brand-mark" style={{ width: size, height: size, borderWidth: Math.round(size * 0.22) }} />;
}
