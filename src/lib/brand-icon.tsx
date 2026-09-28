import { ImageResponse } from 'next/og';

const SEGMENTS = ['#E8B04A', '#9FBFDA', '#CBA6C1', '#D5B28F', '#A9B4C4'];

function arc(cx: number, cy: number, r: number, fromDeg: number, toDeg: number) {
  const rad = (d: number) => ((d - 90) * Math.PI) / 180;
  const [x1, y1] = [cx + r * Math.cos(rad(fromDeg)), cy + r * Math.sin(rad(fromDeg))];
  const [x2, y2] = [cx + r * Math.cos(rad(toDeg)), cy + r * Math.sin(rad(toDeg))];
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${toDeg - fromDeg > 180 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

/**
 * The Ronda mark as a PNG: the five-member "ronda" ring (one segment per member, 2° gaps)
 * around the ink brand ring, on paper. `safe` shrinks the artwork for maskable icons, whose
 * outer 20 % may be cropped. Drawn with SVG because the OG renderer has no conic gradients.
 */
export function brandIcon(size: number, { safe = false } = {}) {
  const view = 100;
  const art = safe ? 62 : 84; // diameter in viewBox units
  const band = art * 0.1; // thickness of the colored ring
  const r = art / 2 - band / 2;
  const small = size < 64;
  const inkR = small ? art * 0.3 : art * 0.24;
  const inkW = small ? art * 0.12 : art * 0.075;

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', background: '#F7F2E8', display: 'flex' }}>
        <svg width={size} height={size} viewBox={`0 0 ${view} ${view}`}>
          {!small &&
            SEGMENTS.map((color, i) => (
              <path key={color} d={arc(50, 50, r, i * 72, i * 72 + 70)} stroke={color} strokeWidth={band} fill="none" />
            ))}
          <circle cx="50" cy="50" r={inkR} stroke="#231C16" strokeWidth={inkW} fill="none" />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
