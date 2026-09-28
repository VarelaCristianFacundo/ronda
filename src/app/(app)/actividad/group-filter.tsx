'use client';

import { useRouter } from 'next/navigation';

/** "Todos los grupos ▾" chip backed by a native select. */
export function GroupFilter({ groups, value, kind }: { groups: { id: string; name: string }[]; value: string | null; kind: string }) {
  const router = useRouter();
  const current = groups.find((g) => g.id === value)?.name ?? 'Todos los grupos';
  return (
    <label className={`chip${value ? ' is-selected' : ''}`}>
      {current} ▾
      <select
        aria-label="Filtrar por grupo"
        value={value ?? ''}
        onChange={(e) => {
          const q = new URLSearchParams();
          if (kind !== 'todo') q.set('tipo', kind);
          if (e.target.value) q.set('grupo', e.target.value);
          router.push(`/actividad${q.size ? `?${q}` : ''}`);
        }}
        style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', fontSize: 16 }}
      >
        <option value="">Todos los grupos</option>
        {groups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </select>
    </label>
  );
}
