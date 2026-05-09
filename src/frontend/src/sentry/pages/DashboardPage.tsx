import { Icon } from '../components/Icon';
import { Sparkline } from '../components/Sparkline';
import { CameraTile } from '../components/CameraTile';
import { Severity } from '../components/Severity';
import { ALERTS, INCIDENTS, CAMERAS, SECTORS, SPARK_HOUR, SPARK_DAY } from '../data';
import type { DashboardVariant, PageKey } from '../types';

interface DashboardPageProps {
  variant: DashboardVariant;
  onNav: (page: PageKey) => void;
}

const HEALTH_BARS = Array.from({ length: 24 }).map((_, i) => ({
  height: 85 + Math.sin(i) * 10 + ((i * 13) % 8),
  isWarn: i === 17,
}));

const INCIDENT_SPARK = [2, 2, 3, 3, 2, 1, 1, 2, 2, 3, 3, 3];

const ExecDashboard = () => {
  const detectionsBySector = [412, 188, 96, 588];
  const widthBySector = [60, 28, 15, 90];

  return (
    <div className="page" style={{ maxWidth: 1200 }}>
      <div className="page-head">
        <div>
          <h1 style={{ fontSize: 32 }}>Today at the border</h1>
          <div className="sub">Region North · Week of April 20–26, 2026</div>
        </div>
        <div className="actions">
          <button className="btn">
            <Icon name="dl" /> Brief PDF
          </button>
        </div>
      </div>

      <div
        className="card"
        style={{
          padding: 32,
          marginBottom: 16,
          background: 'linear-gradient(135deg, var(--bg-elev), var(--bg-sunk))',
        }}
      >
        <div className="row gap-12" style={{ marginBottom: 12 }}>
          <span className="pill ok"><span className="ldot" />OPERATIONAL</span>
          <span className="muted small">Updated 14:42 local · auto-refresh 60s</span>
        </div>
        <div
          style={{
            fontSize: 28,
            fontWeight: 500,
            lineHeight: 1.3,
            letterSpacing: '-0.015em',
            maxWidth: 760,
            textWrap: 'pretty',
          }}
        >
          Three open incidents across four sectors.{' '}
          <span className="muted">
            Most activity is concentrated at Cedar Crossing, where a group crossing is being handled by Patrol Bravo-2.
          </span>
        </div>
      </div>

      <div className="grid g-3" style={{ marginBottom: 16 }}>
        {[
          { k: 'Crossings prevented', v: '47',     d: 'this week',     up: true },
          { k: 'Avg response time',   v: '4m 12s', d: 'down 38s',      up: true },
          { k: 'False positive rate', v: '3.1%',   d: 'within target', up: true },
        ].map((s) => (
          <div key={s.k} className="card kpi">
            <div className="label">{s.k}</div>
            <div className="val">{s.v}</div>
            <div className={`delta ${s.up ? 'up' : 'down'}`}>{s.d}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-head"><h3>Detections by sector — last 7 days</h3></div>
        <div className="card-body">
          {SECTORS.map((s, i) => (
            <div
              key={s.id}
              style={{ padding: '10px 0', borderBottom: i < SECTORS.length - 1 ? '1px solid var(--line)' : 'none' }}
            >
              <div className="row gap-8" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                <span className="bold">
                  {s.name} <span className="muted mono small">· {s.id}</span>
                </span>
                <span className="tnum">{detectionsBySector[i]}</span>
              </div>
              <div style={{ height: 6, background: 'var(--bg-sunk)', borderRadius: 3, overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${widthBySector[i]}%`,
                    background:
                      i === 3 ? 'var(--danger)' : i === 0 ? 'var(--warn)' : 'var(--accent)',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const DashboardPage = ({ variant, onNav }: DashboardPageProps) => {
  if (variant === 'exec') return <ExecDashboard />;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Operations dashboard</h1>
          <div className="sub">
            Sector NW-04 · Pinegate Pass — Live as of {new Date().toLocaleTimeString('en-GB')}
          </div>
        </div>
        <div className="actions">
          <div
            className="row gap-8"
            style={{
              background: 'var(--bg-elev)',
              border: '1px solid var(--line)',
              borderRadius: 8,
              padding: 2,
            }}
          >
            {['Today', '7d', '30d'].map((p, i) => (
              <button
                key={p}
                className="btn ghost sm"
                style={i === 0 ? { background: 'var(--bg-hover)', color: 'var(--ink)' } : undefined}
              >
                {p}
              </button>
            ))}
          </div>
          <button className="btn"><Icon name="dl" /> Export</button>
          <button className="btn accent"><Icon name="plus" /> New incident</button>
        </div>
      </div>

      <div className="grid g-4" style={{ marginBottom: 16 }}>
        <div className="card kpi">
          <div className="label">Active alerts</div>
          <div className="row gap-8" style={{ alignItems: 'baseline' }}>
            <div className="val">12</div>
            <span className="pill danger"><span className="ldot" />3 critical</span>
          </div>
          <Sparkline data={SPARK_HOUR} color="var(--danger)" />
          <div className="delta up"><Icon name="arrU" size={12} /> +4 vs last hour</div>
        </div>
        <div className="card kpi">
          <div className="label">Open incidents</div>
          <div className="row gap-8" style={{ alignItems: 'baseline' }}>
            <div className="val">3</div>
            <span className="pill warn"><span className="ldot" />1 escalated</span>
          </div>
          <Sparkline data={INCIDENT_SPARK} color="var(--warn)" />
          <div className="delta">Avg response 4m 12s</div>
        </div>
        <div className="card kpi">
          <div className="label">Detections (24h)</div>
          <div className="val tnum">1,284</div>
          <Sparkline data={SPARK_DAY} color="var(--accent)" />
          <div className="delta up"><Icon name="arrU" size={12} /> 18% above baseline</div>
        </div>
        <div className="card kpi">
          <div className="label">System health</div>
          <div className="row gap-8" style={{ alignItems: 'baseline' }}>
            <div className="val">98.4%</div>
            <span className="pill ok"><span className="ldot" />Healthy</span>
          </div>
          <div style={{ display: 'flex', gap: 2, height: 36, alignItems: 'flex-end' }}>
            {HEALTH_BARS.map((b, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: `${b.height}%`,
                  background: b.isWarn ? 'var(--warn)' : 'var(--ok)',
                  borderRadius: 1,
                  opacity: 0.7,
                }}
              />
            ))}
          </div>
          <div className="delta">2 cameras offline · NE-07</div>
        </div>
      </div>

      <div
        className="grid"
        style={{ gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}
      >
        <div className="card">
          <div className="card-head">
            <h3>Live priority feeds</h3>
            <span className="pill danger"><span className="ldot" />2 active</span>
            <div className="grow" />
            <button className="btn ghost sm" onClick={() => onNav('live')}>
              Open feed wall <Icon name="chevr" size={12} />
            </button>
          </div>
          <div className="card-body">
            <div className="grid g-2" style={{ gap: 10 }}>
              {CAMERAS.slice(0, 4).map((c) => (
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
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h3>Incoming alerts</h3>
            <div className="grow" />
            <button className="btn ghost sm" onClick={() => onNav('alerts')}>
              All <Icon name="chevr" size={12} />
            </button>
          </div>
          <div className="card-body flush" style={{ maxHeight: 420, overflow: 'auto' }}>
            {ALERTS.slice(0, 7).map((a) => (
              <div
                key={a.id}
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--line)',
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-start',
                }}
              >
                <Severity level={a.sev} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row gap-8">
                    <span className="bold">{a.type}</span>
                    {a.sev >= 4 && (
                      <span className="pill danger">{a.sev === 5 ? 'CRITICAL' : 'HIGH'}</span>
                    )}
                  </div>
                  <div className="tiny muted mono" style={{ marginTop: 2 }}>
                    {a.id} · {a.cam} · {a.sector}
                  </div>
                </div>
                <div className="tiny muted" style={{ whiteSpace: 'nowrap' }}>
                  {a.when}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card">
          <div className="card-head">
            <h3>Open incidents</h3>
            <div className="grow" />
            <button className="btn ghost sm" onClick={() => onNav('incidents')}>
              All <Icon name="chevr" size={12} />
            </button>
          </div>
          <div className="card-body flush">
            {INCIDENTS.map((i) => (
              <button
                key={i.id}
                onClick={() => onNav('incident')}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '14px 16px',
                  borderBottom: '1px solid var(--line)',
                  display: 'flex',
                  gap: 12,
                  alignItems: 'center',
                }}
              >
                <div className="placeholder" style={{ width: 64, height: 48, flexShrink: 0 }}>
                  EVID
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row gap-8">
                    <Severity level={i.sev} />
                    <span className="bold">{i.title}</span>
                  </div>
                  <div className="tiny muted mono" style={{ marginTop: 4 }}>
                    {i.id} · Opened {i.opened} · {i.responder}
                  </div>
                </div>
                <span className="pill warn">{i.status}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h3>Sector status</h3>
            <div className="grow" />
            <button className="btn ghost sm" onClick={() => onNav('map')}>
              Map view <Icon name="chevr" size={12} />
            </button>
          </div>
          <div className="card-body flush">
            {SECTORS.map((s) => {
              const pillCls =
                s.status === 'Active Incident' ? 'danger' : s.status === 'Heightened' ? 'warn' : 'ok';
              return (
                <div
                  key={s.id}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--line)',
                    display: 'flex',
                    gap: 12,
                    alignItems: 'center',
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: 'var(--bg-sunk)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon name="pin" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="bold">{s.name}</div>
                    <div className="tiny muted mono">
                      {s.id} · {s.kind} · {s.km} km perimeter
                    </div>
                  </div>
                  <span className={`pill ${pillCls}`}>
                    <span className="ldot" />
                    {s.status}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
