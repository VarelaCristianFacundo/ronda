import { SlowNotice } from '@/components/slow-notice';
import { TabBar } from '@/components/tabbar';

export default function Loading() {
  const rows = [
    [130, 90, 76, 1],
    [110, 80, 70, 1],
    [150, 70, 64, 0.7],
    [120, 90, 72, 0.45],
  ];
  return (
    <main className="screen has-tabbar" aria-busy="true" aria-label="Cargando tus grupos">
      <div className="content hstack between" style={{ paddingTop: 14, height: 62 }}>
        <span className="sk" style={{ width: 80, height: 14 }} />
        <span className="sk" style={{ width: 36, height: 36, borderRadius: '50%', marginRight: 6 }} />
      </div>
      <div className="content">
        <div className="rule stack gap-12" style={{ padding: '6px 0 22px' }}>
          <span className="sk" style={{ width: 140, height: 12 }} />
          <span className="sk" style={{ width: 220, height: 52, borderRadius: 8 }} />
          <span className="sk" style={{ width: 170, height: 22, borderRadius: 6 }} />
        </div>
        <div style={{ padding: '18px 0 6px' }}>
          <h2 className="t-section">Tus grupos</h2>
        </div>
        <div className="list">
          {rows.map(([a, b, c, o], i) => (
            <div key={i} className="row" style={{ height: 72, gap: 14, opacity: o }}>
              <span className="sk-ring" />
              <span className="stack gap-8" style={{ flex: 1 }}>
                <span className="sk" style={{ width: a, height: 14 }} />
                <span className="sk" style={{ width: b, height: 10 }} />
              </span>
              <span className="sk" style={{ width: c, height: 18 }} />
            </div>
          ))}
        </div>
        <SlowNotice />
      </div>
      <TabBar current="grupos" />
    </main>
  );
}
