'use client';

import { useEffect, useState } from 'react';

/** Shown only if loading takes longer than 8 s (design M05). */
export function SlowNotice({ afterMs = 8000 }: { afterMs?: number }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), afterMs);
    return () => clearTimeout(t);
  }, [afterMs]);
  if (!slow) return null;
  return (
    <p role="status" className="t-caption" style={{ margin: '20px 0' }}>
      Seguimos cargando. Revisá tu conexión.
    </p>
  );
}
