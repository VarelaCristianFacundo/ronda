// Stroke icons drawn exactly as in the design files (22×22 / 14×14 viewBoxes).

type P = { size?: number; color?: string };

export function BackIcon({ size = 22, color = 'var(--ink)' }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" aria-hidden="true">
      <path d="M14 4l-7 7 7 7" stroke={color} strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CloseIcon({ size = 20, color = 'var(--ink)' }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" aria-hidden="true">
      <path d="M5 5l12 12M17 5L5 17" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function PlusIcon({ size = 18, color = 'var(--ink)' }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" aria-hidden="true">
      <path d="M11 4v14M4 11h14" stroke={color} strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

export function CheckIcon({ size = 14, color = 'var(--paper)' }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden="true">
      <path d="M2.5 7.5l3 3 6-7" stroke={color} strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Arrow between two avatars in "who pays whom" rows. */
export function PayArrow({ length = 16, head = 6, color = 'var(--ink)' }: { length?: number; head?: number; color?: string }) {
  return (
    <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center' }}>
      <span style={{ width: length, height: 2, background: color }} />
      <span
        style={{
          width: 0,
          height: 0,
          borderLeft: `${head}px solid ${color}`,
          borderTop: `${head - 1}px solid transparent`,
          borderBottom: `${head - 1}px solid transparent`,
        }}
      />
    </span>
  );
}
