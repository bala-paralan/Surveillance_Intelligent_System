import { useState } from 'react';
import { Icon } from '../components/Icon';
import { SECTORS, type Sector } from '../data';

const PINS: { id: string; x: number; y: number; status: Sector['status'] }[] = [
  { id: 'NW-04', x: 22, y: 34, status: 'Heightened' },
  { id: 'N-12',  x: 48, y: 22, status: 'Normal' },
  { id: 'NE-07', x: 74, y: 30, status: 'Normal' },
  { id: 'E-22',  x: 78, y: 62, status: 'Active Incident' },
];

const ALERT_PINS = [
  { x: 24, y: 38, sev: 4 },
  { x: 79, y: 60, sev: 5 },
  { x: 74, y: 32, sev: 4 },
  { x: 21, y: 40, sev: 3 },
  { x: 48, y: 24, sev: 2 },
];

const pinColor = (status: Sector['status']) =>
  status === 'Active Incident' ? '#dc2626' : status === 'Heightened' ? '#d97706' : '#10b981';

export const MapPage = () => {
  const [selected, setSelected] = useState<Sector>(SECTORS[0]);

  return (
    <div className="page" style={{ padding: 0, height: 'calc(100vh - 56px)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', height: '100%' }}>
        <aside
          style={{
            borderRight: '1px solid var(--line)',
            background: 'var(--bg-elev)',
            overflow: 'auto',
          }}
        >
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
            <h2 style={{ margin: '0 0 4px', fontSize: 18 }}>Sector map</h2>
            <div className="muted small">Region North · 4 sectors</div>
          </div>
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--line)',
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            <span className="pill"><span className="ldot" style={{ color: 'var(--ok)' }} />Normal</span>
            <span className="pill warn"><span className="ldot" />Heightened</span>
            <span className="pill danger"><span className="ldot" />Incident</span>
          </div>
          <div>
            {SECTORS.map((s) => {
              const cls =
                s.status === 'Active Incident' ? 'danger' : s.status === 'Heightened' ? 'warn' : 'ok';
              const isSel = selected.id === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setSelected(s)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '14px 18px',
                    borderBottom: '1px solid var(--line)',
                    background: isSel ? 'var(--accent-soft)' : 'transparent',
                    display: 'flex',
                    gap: 12,
                    alignItems: 'center',
                  }}
                >
                  <Icon name="pin" />
                  <div style={{ flex: 1 }}>
                    <div className="bold" style={{ color: isSel ? 'var(--accent-ink)' : 'var(--ink)' }}>
                      {s.name}
                    </div>
                    <div className="tiny muted mono">
                      {s.id} · {s.km} km
                    </div>
                  </div>
                  <span className={`pill ${cls}`}>
                    <span className="ldot" />
                    {s.status === 'Active Incident' ? 'Incident' : s.status}
                  </span>
                </button>
              );
            })}
          </div>
          <div style={{ padding: 16 }}>
            <div className="card" style={{ padding: 14 }}>
              <div className="bold" style={{ marginBottom: 8 }}>{selected.name}</div>
              <div className="grid g-2 small" style={{ gap: 8 }}>
                <div><div className="muted tiny">Code</div><div className="mono">{selected.id}</div></div>
                <div><div className="muted tiny">Terrain</div><div>{selected.kind}</div></div>
                <div><div className="muted tiny">Perimeter</div><div>{selected.km} km</div></div>
                <div><div className="muted tiny">Cameras</div><div>{Math.floor(selected.km / 2)} active</div></div>
              </div>
              <div className="divider" />
              <button className="btn accent sm" style={{ width: '100%', justifyContent: 'center' }}>
                Open sector dashboard
              </button>
            </div>
          </div>
        </aside>

        <div style={{ position: 'relative', overflow: 'hidden', background: '#0a0c10' }}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `
                radial-gradient(ellipse at 30% 40%, rgba(34,94,180,0.18), transparent 60%),
                radial-gradient(ellipse at 75% 65%, rgba(140,90,40,0.12), transparent 60%),
                linear-gradient(180deg, #0d1014 0%, #0a0c10 100%)
              `,
            }}
          />
          <svg
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.18 }}
            preserveAspectRatio="none"
            viewBox="0 0 100 60"
          >
            {Array.from({ length: 14 }).map((_, i) => (
              <path
                key={i}
                d={`M0 ${10 + i * 3.5} Q ${20 + i * 3} ${5 + i * 4}, 50 ${10 + i * 3.5} T 100 ${10 + i * 3.5}`}
                fill="none"
                stroke="#94a3b8"
                strokeWidth="0.15"
              />
            ))}
          </svg>
          <svg
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
            preserveAspectRatio="none"
            viewBox="0 0 100 60"
          >
            <path
              d="M5 30 Q 20 38, 35 28 T 60 26 Q 75 30, 90 36"
              fill="none"
              stroke="rgba(129,140,248,0.6)"
              strokeWidth="0.4"
              strokeDasharray="1 1"
            />
          </svg>

          {ALERT_PINS.map((p, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: `${p.x}%`,
                top: `${p.y}%`,
                transform: 'translate(-50%,-50%)',
              }}
            >
              <div
                style={{
                  width: p.sev * 4 + 8,
                  height: p.sev * 4 + 8,
                  borderRadius: '50%',
                  background:
                    p.sev >= 4 ? 'rgba(239,68,68,0.25)' : 'rgba(217,119,6,0.25)',
                  animation: 'sentry-pulse 2s infinite',
                }}
              />
            </div>
          ))}

          {PINS.map((p) => {
            const sector = SECTORS.find((x) => x.id === p.id);
            if (!sector) return null;
            const isSel = selected.id === p.id;
            const color = pinColor(p.status);
            return (
              <button
                key={p.id}
                onClick={() => setSelected(sector)}
                style={{
                  position: 'absolute',
                  left: `${p.x}%`,
                  top: `${p.y}%`,
                  transform: 'translate(-50%,-100%)',
                  background: 'transparent',
                }}
              >
                <div
                  style={{
                    padding: '6px 10px',
                    background: 'rgba(20,23,29,0.95)',
                    border: `1px solid ${color}`,
                    borderRadius: 8,
                    color: '#e5e7eb',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    whiteSpace: 'nowrap',
                    boxShadow: isSel ? `0 0 0 3px ${color}33` : 'none',
                  }}
                >
                  <span style={{ color }}>● </span>
                  {sector.name} · {p.id}
                </div>
                <div style={{ width: 2, height: 14, background: color, margin: '0 auto' }} />
              </button>
            );
          })}

          <div
            style={{
              position: 'absolute',
              right: 16,
              top: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              background: 'rgba(20,23,29,0.9)',
              border: '1px solid #2e3440',
              borderRadius: 8,
              overflow: 'hidden',
            }}
          >
            {['+', '−'].map((s) => (
              <button
                key={s}
                style={{
                  width: 32,
                  height: 32,
                  color: '#e5e7eb',
                  fontSize: 16,
                  background: 'transparent',
                }}
              >
                {s}
              </button>
            ))}
          </div>

          <div
            style={{
              position: 'absolute',
              left: 16,
              bottom: 16,
              color: '#94a3b8',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
            }}
          >
            <div style={{ width: 80, height: 1, background: '#94a3b8', marginBottom: 4 }} />
            10 km
          </div>
        </div>
      </div>
    </div>
  );
};
