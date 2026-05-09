import { Icon, type IconName } from '../components/Icon';
import { CameraTile } from '../components/CameraTile';
import { Severity } from '../components/Severity';
import { CAMERAS } from '../data';

interface ActivityEvent {
  t: string;
  text: string;
  tag: string;
  icon: IconName;
}

const EVENTS: ActivityEvent[] = [
  { t: '14:38:12', text: 'AI flagged group of 6 persons crossing fence line', tag: 'detection', icon: 'eye' },
  { t: '14:38:28', text: 'Operator D. Cho acknowledged alert',                tag: 'ack',       icon: 'check' },
  { t: '14:39:05', text: 'Patrol Bravo-2 dispatched (ETA 6m)',                 tag: 'dispatch',  icon: 'flag' },
  { t: '14:39:42', text: 'Drone CAM-AERIAL-3 launched for overhead view',      tag: 'asset',     icon: 'cam' },
  { t: '14:41:18', text: 'Sector lead M. Rivera escalated to Region North',    tag: 'escalate',  icon: 'arrU' },
  { t: '14:42:04', text: 'Note added by M. Rivera',                            tag: 'note',      icon: 'note' },
];

const RESPONDERS: { n: string; s: string; cls: string; i: string }[] = [
  { n: 'Patrol Bravo-2',       s: 'En route · ETA 2m', cls: 'warn', i: 'BR' },
  { n: 'Drone Aerial-3',       s: 'On scene · live',   cls: 'ok',   i: 'DR' },
  { n: 'Sector Lead Rivera',   s: 'Coordinating',      cls: 'info', i: 'MR' },
];

const TIMELINE_BARS = Array.from({ length: 60 }).map((_, i) => ({
  height: 30 + Math.abs(Math.sin(i / 3)) * 70,
  isAlert: i >= 22 && i <= 28,
  alpha: i >= 22 ? 0.85 : 0.35,
}));

export const IncidentPage = () => {
  const e22Cams = CAMERAS.filter((c) => c.sector === 'E-22').slice(0, 2);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="row gap-8 small muted" style={{ marginBottom: 6 }}>
            <a href="#">Incidents</a>
            <Icon name="chevr" size={12} />
            <span>INC-2026-0418</span>
          </div>
          <div className="row gap-12" style={{ alignItems: 'center' }}>
            <Severity level={5} />
            <h1>Group crossing — Cedar Crossing</h1>
            <span className="pill warn"><span className="ldot" />In Progress</span>
          </div>
          <div className="sub">Opened 14:38 · Sector E-22 · Patrol Bravo-2 responding</div>
        </div>
        <div className="actions">
          <button className="btn"><Icon name="note" /> Note</button>
          <button className="btn"><Icon name="flag" /> Reassign</button>
          <button className="btn danger"><Icon name="arrU" /> Escalate</button>
          <button className="btn accent"><Icon name="check" /> Resolve</button>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr 360px', gap: 16 }}>
        <div className="col gap-12">
          <div className="card">
            <div className="card-head">
              <h3>Linked footage</h3>
              <div className="grow" />
              <span className="pill">3 cameras · 14:36 → now</span>
            </div>
            <div className="card-body">
              <div className="grid g-2" style={{ gap: 10 }}>
                {e22Cams.map((c) => (
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

              <div style={{ marginTop: 14 }}>
                <div
                  className="row gap-8 small muted"
                  style={{ justifyContent: 'space-between', marginBottom: 6 }}
                >
                  <span>14:36</span>
                  <span>14:38 · trigger</span>
                  <span>14:42</span>
                </div>
                <div
                  style={{
                    height: 36,
                    background: 'var(--bg-sunk)',
                    borderRadius: 6,
                    position: 'relative',
                    overflow: 'hidden',
                    display: 'flex',
                  }}
                >
                  {TIMELINE_BARS.map((b, i) => (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        height: `${b.height}%`,
                        alignSelf: 'flex-end',
                        background: b.isAlert ? 'var(--danger)' : 'var(--ink-4)',
                        opacity: b.alpha,
                        marginRight: 1,
                        borderRadius: 1,
                      }}
                    />
                  ))}
                  <div
                    style={{
                      position: 'absolute',
                      left: '40%',
                      top: 0,
                      bottom: 0,
                      width: 2,
                      background: 'var(--accent)',
                    }}
                  />
                </div>
                <div className="row gap-8" style={{ marginTop: 10 }}>
                  <button className="btn sm"><Icon name="play" /> Play</button>
                  <button className="btn sm">−5s</button>
                  <button className="btn sm">+5s</button>
                  <div className="grow" />
                  <button className="btn sm">0.5×</button>
                  <button className="btn sm" style={{ background: 'var(--bg-hover)' }}>1×</button>
                  <button className="btn sm">2×</button>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h3>Activity timeline</h3></div>
            <div className="card-body">
              {EVENTS.map((e, i) => (
                <div
                  key={i}
                  style={{ display: 'flex', gap: 12, paddingBottom: 14, position: 'relative' }}
                >
                  <div style={{ position: 'relative' }}>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        background: 'var(--accent-soft)',
                        color: 'var(--accent-ink)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon name={e.icon} size={14} />
                    </div>
                    {i < EVENTS.length - 1 && (
                      <div
                        style={{
                          position: 'absolute',
                          left: 13,
                          top: 30,
                          bottom: -14,
                          width: 2,
                          background: 'var(--line)',
                        }}
                      />
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="bold small">{e.text}</div>
                    <div className="tiny muted mono">{e.t}</div>
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <input className="input" placeholder="Add a note…" />
                <button className="btn accent">Send</button>
              </div>
            </div>
          </div>
        </div>

        <div className="col gap-12">
          <div className="card">
            <div className="card-head"><h3>Details</h3></div>
            <div className="card-body">
              <div className="grid g-2 small" style={{ gap: 12 }}>
                <div><div className="muted tiny">Severity</div><Severity level={5} /></div>
                <div><div className="muted tiny">Confidence</div><div className="bold">94%</div></div>
                <div><div className="muted tiny">Persons</div><div className="bold">6 detected</div></div>
                <div><div className="muted tiny">Vehicles</div><div className="bold">0</div></div>
                <div><div className="muted tiny">Sector</div><div className="mono">E-22</div></div>
                <div><div className="muted tiny">Cameras</div><div className="mono">CAM-22-09 +2</div></div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h3>Responders</h3></div>
            <div className="card-body flush">
              {RESPONDERS.map((r) => (
                <div
                  key={r.n}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--line)',
                    display: 'flex',
                    gap: 10,
                    alignItems: 'center',
                  }}
                >
                  <div className="avatar">{r.i}</div>
                  <div style={{ flex: 1 }}>
                    <div className="bold small">{r.n}</div>
                    <div className="tiny muted">{r.s}</div>
                  </div>
                  <span className={`pill ${r.cls}`}><span className="ldot" />Active</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h3>Linked alerts</h3></div>
            <div className="card-body flush">
              {['ALT-21408', 'ALT-21407', 'ALT-21403'].map((id) => (
                <div
                  key={id}
                  style={{
                    padding: '10px 16px',
                    borderBottom: '1px solid var(--line)',
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                  }}
                >
                  <Icon name="bell" size={14} />
                  <span className="mono small">{id}</span>
                  <div className="grow" />
                  <Icon name="chevr" size={12} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
