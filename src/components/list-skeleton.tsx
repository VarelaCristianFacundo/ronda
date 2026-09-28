import { SlowNotice } from './slow-notice';

/** Generic skeleton: structure first, data later; no shimmer (reduced-motion friendly). */
export function ListSkeleton({ label, hero = true }: { label: string; hero?: boolean }) {
  return (
    <main className="screen" aria-busy="true" aria-label={label}>
      <div className="topbar">
        <span className="sk" style={{ width: 32, height: 32, borderRadius: 8, margin: 8 }} />
      </div>
      <div className="content">
        <div className="hstack gap-12">
          <span className="sk-ring" />
          <span className="stack gap-8">
            <span className="sk" style={{ width: 160, height: 22 }} />
            <span className="sk" style={{ width: 120, height: 12 }} />
          </span>
        </div>
        {hero && (
          <div className="rule stack gap-12" style={{ marginTop: 20, paddingBottom: 18 }}>
            <span className="sk" style={{ width: 90, height: 12 }} />
            <span className="sk" style={{ width: 200, height: 48, borderRadius: 8 }} />
            <span className="sk" style={{ width: '70%', height: 14 }} />
          </div>
        )}
        <div className="list" style={{ marginTop: 12 }}>
          {[1, 0.8, 0.6, 0.4].map((o) => (
            <div key={o} className="row" style={{ opacity: o, minHeight: 60 }}>
              <span className="sk" style={{ width: 40, height: 40, borderRadius: 6 }} />
              <span className="stack gap-8" style={{ flex: 1 }}>
                <span className="sk" style={{ width: '55%', height: 14 }} />
                <span className="sk" style={{ width: '35%', height: 10 }} />
              </span>
              <span className="sk" style={{ width: 64, height: 16 }} />
            </div>
          ))}
        </div>
        <SlowNotice />
      </div>
    </main>
  );
}
