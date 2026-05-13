import { Icon } from '../components/Icon';
import { CameraTile } from '../components/CameraTile';
import { CAMERAS } from '../data';

const HOURS = ['12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];

interface LaneEvent {
  s: number;
  e: number;
  sev: 1 | 2 | 3 | 4 | 5;
}

const LANES: LaneEvent[][] = [
  [{ s: 6,  e: 10, sev: 2 }, { s: 24, e: 28, sev: 4 }, { s: 55, e: 60, sev: 1 }],
  [{ s: 14, e: 18, sev: 3 }, { s: 62, e: 64, sev: 2 }],
  [{ s: 30, e: 34, sev: 5 }, { s: 48, e: 52, sev: 3 }, { s: 88, e: 92, sev: 2 }],
  [{ s: 8,  e: 12, sev: 1 }, { s: 40, e: 44, sev: 2 }],
  [{ s: 20, e: 25, sev: 3 }, { s: 70, e: 78, sev: 4 }],
];

const LANE_COLORS: Record<LaneEvent['sev'], string> = {
  1: 'var(--ink-4)',
  2: 'var(--info)',
  3: 'var(--warn)',
  4: 'var(--danger)',
  5: 'var(--danger)',
};

export const TimelinePage = () => {
  const cams = CAMERAS.slice(0, 5);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Timeline & playback</h1>
          <div className="sub">Multi-camera scrubbing across 7 hours</div>
        </div>
        <div className="actions">
          <button className="btn"><Icon name="dl" /> Export clip</button>
          <button className="btn"><Icon name="flag" /> Bookmark</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-body">
          <div className="grid g-2" style={{ gap: 10 }}>
            {cams.slice(0, 2).map((c) => (
              <CameraTile
                key={c.id}
                id={c.id}
                location={c.name}
                mode={c.mode}
                status={c.status}
                alert={c.alert}
                warn={c.warn}
                label={c.label}
              />
            ))}
          </div>

          <div className="row gap-12" style={{ marginTop: 14, justifyContent: 'center' }}>
            <button className="btn sm">−10s</button>
            <button className="btn sm">−5s</button>
            <button
              className="btn accent"
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                justifyContent: 'center',
                padding: 0,
              }}
            >
              <Icon name="play" />
            </button>
            <button className="btn sm">+5s</button>
            <button className="btn sm">+10s</button>
            <div style={{ width: 1, height: 24, background: 'var(--line)' }} />
            <span className="mono small tnum">14:38:12</span>
            <span className="muted small">/ Apr 25, 2026</span>
            <div className="grow" />
            <select className="select sm" style={{ width: 'auto' }}>
              <option>0.5×</option>
              <option>1×</option>
              <option>2×</option>
              <option>4×</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Camera lanes</h3>
          <div className="grow" />
          <span className="muted tiny">12:00 → 18:00 · {cams.length} cameras</span>
        </div>
        <div style={{ padding: '8px 0' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '180px 1fr',
              alignItems: 'center',
              borderBottom: '1px solid var(--line)',
              padding: '6px 0',
            }}
          >
            <div />
            <div style={{ display: 'flex', position: 'relative', height: 20 }}>
              {HOURS.map((h) => (
                <div
                  key={h}
                  style={{
                    flex: 1,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    color: 'var(--ink-3)',
                    borderLeft: '1px solid var(--line)',
                    paddingLeft: 6,
                  }}
                >
                  {h}
                </div>
              ))}
            </div>
          </div>

          {cams.map((c, i) => (
            <div
              key={c.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '180px 1fr',
                alignItems: 'center',
                borderBottom: '1px solid var(--line)',
                padding: '10px 0',
              }}
            >
              <div style={{ padding: '0 16px' }}>
                <div className="bold small">{c.name}</div>
                <div className="tiny muted mono">{c.id}</div>
              </div>
              <div
                style={{
                  position: 'relative',
                  height: 30,
                  background: 'var(--bg-sunk)',
                  borderRadius: 4,
                  marginRight: 16,
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background:
                      'repeating-linear-gradient(90deg, var(--bg-sunk) 0 1px, transparent 1px 8px)',
                  }}
                />
                {LANES[i].map((ev, j) => (
                  <div
                    key={j}
                    title={`Sev ${ev.sev}`}
                    style={{
                      position: 'absolute',
                      left: `${ev.s}%`,
                      width: `${ev.e - ev.s}%`,
                      top: 6,
                      bottom: 6,
                      background: LANE_COLORS[ev.sev],
                      borderRadius: 3,
                      opacity: 0.85,
                    }}
                  />
                ))}
                <div
                  style={{
                    position: 'absolute',
                    left: '40%',
                    top: -4,
                    bottom: -4,
                    width: 2,
                    background: 'var(--accent)',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      left: -4,
                      top: -4,
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: 'var(--accent)',
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
