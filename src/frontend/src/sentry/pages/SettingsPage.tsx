import { useState } from 'react';
import { Icon } from '../components/Icon';

type SettingsTab = 'General' | 'Detection' | 'Alerts & routing' | 'Integrations' | 'Retention' | 'Security';

const TABS: SettingsTab[] = ['General', 'Detection', 'Alerts & routing', 'Integrations', 'Retention', 'Security'];

const DETECTION_SLIDERS: { n: string; v: number; d?: string }[] = [
  { n: 'Person detection',         v: 78, d: 'Higher = more alerts, more false positives' },
  { n: 'Vehicle detection',        v: 62 },
  { n: 'Group threshold',          v: 45, d: 'Triggers when ≥ N persons grouped' },
  { n: 'Loitering window (sec)',   v: 90 },
  { n: 'Drone RF threshold',       v: 55 },
];

const ROUTING_RULES = [
  { when: 'Severity ≥ 4',                   then: 'Sector Lead + Patrol on duty' },
  { when: 'Drone RF detected',              then: 'Air Unit + Region North' },
  { when: 'Tunnel acoustic',                then: 'Engineering Crew + escalate' },
  { when: 'False positive ≥ 3 in 10m',      then: 'Notify Manager' },
];

const INTEGRATIONS: { n: string; s: string; c: 'ok' | 'warn' | 'danger' }[] = [
  { n: 'Radio dispatch',     s: 'Connected',       c: 'ok' },
  { n: 'Region North HQ',    s: 'Connected',       c: 'ok' },
  { n: 'Customs database',   s: 'Connected',       c: 'ok' },
  { n: 'Weather service',    s: 'Connected',       c: 'ok' },
  { n: 'Drone fleet API',    s: 'Reauthenticate',  c: 'warn' },
  { n: 'SMS gateway',        s: 'Disconnected',    c: 'danger' },
];

const RETENTION_ROWS = [
  { n: 'Live footage',  v: '30 days' },
  { n: 'Incidents',     v: '7 years' },
  { n: 'Audit logs',    v: '10 years' },
  { n: 'Search cache',  v: '14 days' },
];

const SECURITY_TOGGLES = [
  { n: 'Require hardware key',              on: true },
  { n: 'Auto-lock after 5 min idle',        on: true },
  { n: 'IP allow-list (HQ only)',           on: false },
  { n: 'Photographic operator check-in',    on: true },
  { n: 'Encrypt local storage',             on: true },
];

export const SettingsPage = () => {
  const [tab, setTab] = useState<SettingsTab>('General');

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <div className="sub">
            System-wide configuration · changes require Sector Lead approval
          </div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '220px 1fr', gap: 24 }}>
        <aside>
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`navitem ${tab === t ? 'active' : ''}`}
              style={{ borderRadius: 8 }}
            >
              {t}
            </button>
          ))}
        </aside>

        <div className="col gap-12">
          {tab === 'General' && (
            <>
              <div className="card">
                <div className="card-head"><h3>Organization</h3></div>
                <div className="card-body grid g-2" style={{ gap: 14 }}>
                  <div className="field">
                    <label>Organization name</label>
                    <input className="input" defaultValue="Region North · Border Control" />
                  </div>
                  <div className="field">
                    <label>Time zone</label>
                    <select className="select"><option>UTC</option><option>Local · MST</option></select>
                  </div>
                  <div className="field">
                    <label>Default language</label>
                    <select className="select">
                      <option>English</option>
                      <option>Español</option>
                      <option>Français</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Units</label>
                    <select className="select"><option>Metric</option><option>Imperial</option></select>
                  </div>
                </div>
              </div>
              <div className="card">
                <div className="card-head"><h3>Operating hours & shifts</h3></div>
                <div className="card-body">
                  {[
                    { n: 'Day shift',    h: '06:00 – 14:00 · 8 operators' },
                    { n: 'Swing shift',  h: '14:00 – 22:00 · 8 operators' },
                    { n: 'Night shift',  h: '22:00 – 06:00 · 6 operators' },
                  ].map((s, i, arr) => (
                    <div
                      key={s.n}
                      className="row gap-12 small"
                      style={{ marginBottom: i < arr.length - 1 ? 10 : 0 }}
                    >
                      <span className="bold" style={{ width: 120 }}>{s.n}</span>
                      <span className="muted">{s.h}</span>
                      <div className="grow" />
                      <button className="btn ghost sm">Edit</button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {tab === 'Detection' && (
            <div className="card">
              <div className="card-head"><h3>Detection sensitivity</h3></div>
              <div className="card-body col gap-16">
                {DETECTION_SLIDERS.map((s) => (
                  <div key={s.n} className="field">
                    <div className="row gap-8" style={{ justifyContent: 'space-between' }}>
                      <label>{s.n}</label>
                      <span className="mono small tnum">{s.v}</span>
                    </div>
                    <input type="range" defaultValue={s.v} />
                    {s.d && <span className="hint">{s.d}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'Alerts & routing' && (
            <div className="card">
              <div className="card-head">
                <h3>Alert routing rules</h3>
                <div className="grow" />
                <button className="btn sm"><Icon name="plus" /> New rule</button>
              </div>
              <div className="card-body flush">
                {ROUTING_RULES.map((r, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid var(--line)',
                      display: 'flex',
                      gap: 12,
                      alignItems: 'center',
                    }}
                  >
                    <span className="pill">If</span>
                    <span className="mono small bold">{r.when}</span>
                    <span className="muted">→</span>
                    <span className="pill accent">Then</span>
                    <span className="small">{r.then}</span>
                    <div className="grow" />
                    <button className="btn ghost sm">Edit</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'Integrations' && (
            <div className="grid g-2">
              {INTEGRATIONS.map((i) => (
                <div key={i.n} className="card" style={{ padding: 16 }}>
                  <div className="row gap-12">
                    <div className="placeholder" style={{ width: 40, height: 40 }} />
                    <div style={{ flex: 1 }}>
                      <div className="bold">{i.n}</div>
                      <span className={`pill ${i.c}`}><span className="ldot" />{i.s}</span>
                    </div>
                    <button className="btn ghost sm"><Icon name="set" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'Retention' && (
            <div className="card">
              <div className="card-head"><h3>Data retention</h3></div>
              <div className="card-body col gap-12">
                {RETENTION_ROWS.map((r) => (
                  <div
                    key={r.n}
                    className="row gap-12"
                    style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}
                  >
                    <span className="bold" style={{ flex: 1 }}>{r.n}</span>
                    <select className="select sm" style={{ width: 140 }} defaultValue={r.v}>
                      <option>{r.v}</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'Security' && (
            <div className="card">
              <div className="card-head"><h3>Security policies</h3></div>
              <div className="card-body col gap-12">
                {SECURITY_TOGGLES.map((s) => (
                  <div
                    key={s.n}
                    className="row gap-12"
                    style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}
                  >
                    <span className="bold" style={{ flex: 1 }}>{s.n}</span>
                    <div
                      style={{
                        width: 36,
                        height: 20,
                        borderRadius: 10,
                        background: s.on ? 'var(--accent)' : 'var(--bg-sunk)',
                        position: 'relative',
                        cursor: 'pointer',
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          top: 2,
                          left: s.on ? 18 : 2,
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          background: '#fff',
                          transition: 'left .15s',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
