import { Fragment, useMemo } from 'react';
import { Icon } from '../components/Icon';
import { Sparkline } from '../components/Sparkline';
import { CameraTile } from '../components/CameraTile';
import { Severity } from '../components/Severity';
import { ALERTS, INCIDENTS, CAMERAS, SECTORS, SPARK_HOUR, SPARK_DAY, type Incident } from '../data';
import type { PageKey, Role } from '../types';

interface DashboardPageProps {
  role: Role;
  onNav: (page: PageKey) => void;
}

export const DashboardPage = ({ role, onNav }: DashboardPageProps) => {
  switch (role) {
    case 'manager':      return <ManagerDashboard onNav={onNav} />;
    case 'sector_lead':  return <SectorLeadDashboard onNav={onNav} />;
    case 'operator':     return <OperatorDashboard onNav={onNav} />;
    case 'investigator': return <InvestigatorDashboard onNav={onNav} />;
    case 'field':        return <FieldDashboard onNav={onNav} />;
    case 'analyst':      return <AnalystDashboard onNav={onNav} />;
  }
};

/* ──────────────────────────────────────────────────────────────────
   MANAGER — calm, layman-friendly. Big numbers, no jargon.
   ────────────────────────────────────────────────────────────────── */

interface NavProps {
  onNav: (page: PageKey) => void;
}

const ManagerDashboard = ({ onNav }: NavProps) => {
  const teamStats = [
    { n: 'On duty',          v: '18', d: '8 in field' },
    { n: 'Open situations',  v: '1',  d: 'being handled' },
    { n: 'Resolved today',   v: '7',  d: 'avg 4m 12s' },
    { n: 'Reports due',      v: '2',  d: 'this week' },
  ];

  const friendlyStatus = (status: string): { txt: string; cls: string } => {
    if (status === 'Active Incident') return { txt: 'Needs attention', cls: 'danger' };
    if (status === 'Heightened')      return { txt: 'Watching closely', cls: 'warn' };
    return { txt: 'All quiet', cls: 'ok' };
  };

  return (
    <div className="page" style={{ maxWidth: 1180 }}>
      <div className="page-head">
        <div>
          <h1 style={{ fontSize: 30 }}>Good afternoon, Lena.</h1>
          <div className="sub">Region North · Friday, May 9, 2026 · Updated 14:42</div>
        </div>
        <div className="actions">
          <button className="btn"><Icon name="dl" /> Weekly brief (PDF)</button>
        </div>
      </div>

      <div
        className="card"
        style={{
          padding: 28,
          marginBottom: 16,
          background: 'linear-gradient(135deg, var(--bg-elev), var(--bg-sunk))',
        }}
      >
        <div className="row gap-12" style={{ marginBottom: 10 }}>
          <span className="pill warn"><span className="ldot" />1 situation needs attention</span>
          <span className="muted small">Auto-refresh every minute</span>
        </div>
        <div
          style={{
            fontSize: 24,
            fontWeight: 500,
            lineHeight: 1.4,
            letterSpacing: '-0.01em',
            maxWidth: 760,
            textWrap: 'pretty',
          }}
        >
          Things are mostly calm across the region.{' '}
          <span className="muted">
            A group crossing at Cedar Crossing is being handled by a patrol unit — expected to be resolved within the hour. No action required from you.
          </span>
        </div>
        <div className="row gap-8" style={{ marginTop: 14 }}>
          <button className="btn" onClick={() => onNav('incident')}>
            See the situation <Icon name="chevr" size={12} />
          </button>
          <button className="btn ghost" onClick={() => onNav('reports')}>
            Open weekly report
          </button>
        </div>
      </div>

      <div className="grid g-3" style={{ marginBottom: 16 }}>
        <div className="card" style={{ padding: 20 }}>
          <div className="muted small" style={{ marginBottom: 6 }}>This week</div>
          <div style={{ fontSize: 34, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1 }}>
            47 crossings prevented
          </div>
          <div className="delta up small" style={{ marginTop: 10 }}>
            <Icon name="arrU" size={12} /> 12 more than last week
          </div>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div className="muted small" style={{ marginBottom: 6 }}>Average response time</div>
          <div style={{ fontSize: 34, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1 }}>
            4 min 12 sec
          </div>
          <div className="delta up small" style={{ marginTop: 10 }}>
            <Icon name="arrD" size={12} /> 38 seconds faster
          </div>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div className="muted small" style={{ marginBottom: 6 }}>System health</div>
          <div
            style={{
              fontSize: 34,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              lineHeight: 1,
              color: 'var(--ok)',
            }}
          >
            All good
          </div>
          <div className="delta small" style={{ marginTop: 10, color: 'var(--ink-3)' }}>
            2 of 142 cameras offline
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <h3>How each sector is doing</h3>
          <div className="grow" />
          <button className="btn ghost sm" onClick={() => onNav('map')}>
            Open map <Icon name="chevr" size={12} />
          </button>
        </div>
        <div className="card-body flush">
          {SECTORS.map((s) => {
            const f = friendlyStatus(s.status);
            return (
              <div
                key={s.id}
                style={{
                  padding: '14px 18px',
                  borderBottom: '1px solid var(--line)',
                  display: 'flex',
                  gap: 14,
                  alignItems: 'center',
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
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
                  <div className="tiny muted">
                    {s.kind} terrain · {s.km} km perimeter
                  </div>
                </div>
                <span className={`pill ${f.cls}`}>
                  <span className="ldot" />
                  {f.txt}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Your team right now</h3>
          <div className="grow" />
          <button className="btn ghost sm" onClick={() => onNav('users')}>
            Manage team
          </button>
        </div>
        <div className="card-body grid g-4" style={{ gap: 10 }}>
          {teamStats.map((s) => (
            <div key={s.n} style={{ padding: '8px 4px' }}>
              <div className="muted tiny">{s.n}</div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 600,
                  letterSpacing: '-0.01em',
                  marginTop: 2,
                }}
              >
                {s.v}
              </div>
              <div className="tiny muted">{s.d}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ──────────────────────────────────────────────────────────────────
   SECTOR LEAD — operations-focused for one sector.
   ────────────────────────────────────────────────────────────────── */

const SectorLeadDashboard = ({ onNav }: NavProps) => {
  const sectorAlerts = ALERTS.filter((a) => a.sector === 'NW-04');
  const sectorCams = CAMERAS.filter((c) => c.sector === 'NW-04');

  const team: { n: string; s: string; loc: string; tone: string }[] = [
    { n: 'Patrol Alpha-1',  s: 'On patrol · ridge',      loc: 'CAM-04-12',     tone: 'ok' },
    { n: 'Patrol Alpha-2',  s: 'On break',                loc: 'Watchtower 4B', tone: '' },
    { n: 'Operator D. Cho', s: 'Monitoring',              loc: 'Control Room',  tone: 'ok' },
    { n: 'Eng. Crew-3',     s: 'Tunnel acoustic check',   loc: 'CAM-04-15',     tone: 'warn' },
  ];

  const initialsOf = (name: string) =>
    name.split(' ').map((w) => w[0]).slice(0, 2).join('');

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Sector NW-04 · Pinegate Pass</h1>
          <div className="sub">
            Sector Lead view — Maria Rivera · 28 km perimeter · 12 cameras · 8 sensors
          </div>
        </div>
        <div className="actions">
          <span className="pill warn"><span className="ldot" />Heightened</span>
          <button className="btn"><Icon name="dl" /> Shift report</button>
          <button className="btn accent"><Icon name="plus" /> New incident</button>
        </div>
      </div>

      <div className="grid g-4" style={{ marginBottom: 16 }}>
        <div className="card kpi">
          <div className="label">Sector alerts</div>
          <div className="val">{sectorAlerts.length}</div>
          <Sparkline data={SPARK_HOUR} color="var(--warn)" />
        </div>
        <div className="card kpi">
          <div className="label">Patrols on duty</div>
          <div className="val">3</div>
          <div className="delta">All checked in</div>
        </div>
        <div className="card kpi">
          <div className="label">Open incidents</div>
          <div className="val">1</div>
          <div className="delta down">Tunnel acoustic</div>
        </div>
        <div className="card kpi">
          <div className="label">Cameras up</div>
          <div className="val">11/12</div>
          <div className="delta">CAM-04-22 offline</div>
        </div>
      </div>

      <div
        className="grid"
        style={{ gridTemplateColumns: '1.4fr 1fr', gap: 16, marginBottom: 16 }}
      >
        <div className="card">
          <div className="card-head">
            <h3>My priority feeds</h3>
            <div className="grow" />
            <button className="btn ghost sm" onClick={() => onNav('live')}>
              Open wall
            </button>
          </div>
          <div className="card-body grid g-2" style={{ gap: 10 }}>
            {sectorCams.slice(0, 4).map((c) => (
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

        <div className="card">
          <div className="card-head"><h3>Active alerts in my sector</h3></div>
          <div className="card-body flush">
            {sectorAlerts.map((a) => (
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
                  <div className="bold small">{a.type}</div>
                  <div className="tiny muted mono">{a.id} · {a.cam}</div>
                </div>
                <button className="btn sm">Take</button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h3>My team on duty</h3></div>
        <div className="card-body flush">
          {team.map((t) => (
            <div
              key={t.n}
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--line)',
                display: 'flex',
                gap: 12,
                alignItems: 'center',
              }}
            >
              <div className="avatar">{initialsOf(t.n)}</div>
              <div style={{ flex: 1 }}>
                <div className="bold small">{t.n}</div>
                <div className="tiny muted">{t.s} · {t.loc}</div>
              </div>
              <span className={`pill ${t.tone}`}>
                <span className="ldot" />
                {t.s.split(' ')[0]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ──────────────────────────────────────────────────────────────────
   OPERATOR — control-room view, dense camera wall + live alert queue.
   ────────────────────────────────────────────────────────────────── */

const OperatorDashboard = ({ onNav }: NavProps) => {
  const openCount = ALERTS.filter((a) => a.status === 'Open').length;

  return (
    <div className="page" style={{ maxWidth: 'none', padding: '16px 20px' }}>
      <div className="row gap-12" style={{ marginBottom: 14 }}>
        <h1 style={{ margin: 0, fontSize: 18 }}>Control room</h1>
        <span className="pill danger"><span className="ldot" />2 critical · LIVE</span>
        <span className="muted small mono">
          {new Date().toLocaleTimeString('en-GB')} · Shift 14:00–22:00
        </span>
        <div className="grow" />
        <div className="row gap-8">
          <span className="pill ok"><span className="ldot" />140/142 cameras</span>
          <span className="pill ok"><span className="ldot" />Network 12ms</span>
          <button className="btn sm">PTT radio</button>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr 360px', gap: 12 }}>
        <div className="grid g-3" style={{ gap: 8 }}>
          {CAMERAS.slice(0, 9).map((c) => (
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

        <div
          className="card"
          style={{
            position: 'sticky',
            top: 0,
            alignSelf: 'start',
            maxHeight: 'calc(100vh - 100px)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div className="card-head">
            <h3>Live alert queue</h3>
            <div className="grow" />
            <span className="pill danger">{openCount} open</span>
          </div>
          <div style={{ overflow: 'auto', flex: 1 }}>
            {ALERTS.map((a) => (
              <div
                key={a.id}
                style={{ padding: '12px 14px', borderBottom: '1px solid var(--line)' }}
              >
                <div className="row gap-8" style={{ marginBottom: 6 }}>
                  <Severity level={a.sev} />
                  <span
                    className="bold small"
                    style={{
                      flex: 1,
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {a.type}
                  </span>
                  <span className="tiny muted mono">{a.whenISO}</span>
                </div>
                <div className="tiny muted mono" style={{ marginBottom: 8 }}>
                  {a.id} · {a.cam} · {a.sector} · {(a.conf * 100).toFixed(0)}%
                </div>
                <div className="row gap-4">
                  <button className="btn sm" style={{ flex: 1, justifyContent: 'center' }}>
                    Ack
                  </button>
                  <button
                    className="btn sm danger"
                    style={{ flex: 1, justifyContent: 'center' }}
                    onClick={() => onNav('incident')}
                  >
                    Escalate
                  </button>
                  <button className="btn ghost sm">Dismiss</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ──────────────────────────────────────────────────────────────────
   INVESTIGATOR — search & timeline first.
   ────────────────────────────────────────────────────────────────── */

const InvestigatorDashboard = ({ onNav }: NavProps) => {
  const extraCase: Incident = {
    id: 'INC-2026-0410',
    title: 'Vehicle re-identification — Riverbend',
    sev: 3,
    sector: 'N-12',
    opened: 'Apr 28',
    status: 'Pending evidence',
    responder: 'A. Patel',
    alerts: 0,
  };
  const cases: Incident[] = [...INCIDENTS, extraCase];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Investigations</h1>
          <div className="sub">Aisha Patel · HQ — 4 active cases assigned to you</div>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => onNav('search')}>
            <Icon name="srch" /> New search
          </button>
          <button className="btn accent"><Icon name="plus" /> Open case</button>
        </div>
      </div>

      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div className="bold" style={{ marginBottom: 10 }}>Quick lookup</div>
        <div className="grid g-3" style={{ gap: 10 }}>
          <button
            className="card"
            style={{ padding: 14, textAlign: 'left', cursor: 'pointer' }}
            onClick={() => onNav('search')}
          >
            <Icon name="user" />
            <div className="bold small" style={{ marginTop: 6 }}>Find a person</div>
            <div className="tiny muted">Upload a face or describe</div>
          </button>
          <button
            className="card"
            style={{ padding: 14, textAlign: 'left', cursor: 'pointer' }}
            onClick={() => onNav('search')}
          >
            <Icon name="cam" />
            <div className="bold small" style={{ marginTop: 6 }}>Find a vehicle / plate</div>
            <div className="tiny muted">Search across all sectors</div>
          </button>
          <button
            className="card"
            style={{ padding: 14, textAlign: 'left', cursor: 'pointer' }}
            onClick={() => onNav('timeline')}
          >
            <Icon name="tl" />
            <div className="bold small" style={{ marginTop: 6 }}>Replay a timeline</div>
            <div className="tiny muted">Multi-camera scrubbing</div>
          </button>
        </div>
      </div>

      <div className="grid g-4" style={{ marginBottom: 16 }}>
        <div className="card kpi"><div className="label">My cases</div><div className="val">4</div></div>
        <div className="card kpi"><div className="label">Awaiting evidence</div><div className="val">2</div></div>
        <div className="card kpi"><div className="label">Searches saved</div><div className="val">17</div></div>
        <div className="card kpi"><div className="label">Avg case time</div><div className="val">3.2d</div></div>
      </div>

      <div className="card">
        <div className="card-head"><h3>My active cases</h3></div>
        <div className="card-body flush">
          {cases.map((c) => (
            <button
              key={c.id}
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
                <div className="bold">{c.title}</div>
                <div className="tiny muted mono" style={{ marginTop: 4 }}>
                  {c.id} · Opened {c.opened} · {c.sector}
                </div>
              </div>
              <Severity level={c.sev} />
              <span className="pill warn">{c.status}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ──────────────────────────────────────────────────────────────────
   FIELD OFFICER — mobile-first; assignment + quick actions.
   ────────────────────────────────────────────────────────────────── */

const FieldDashboard = ({ onNav }: NavProps) => {
  const todays: { t: string; s: string; tone: 'danger' | 'ok'; time: string }[] = [
    { t: 'Group crossing — Cedar Crossing', s: 'In progress', tone: 'danger', time: '14:38' },
    { t: 'Fence vibration — sensor 14',     s: 'Resolved',    tone: 'ok',     time: '14:06' },
    { t: 'Routine perimeter walk',          s: 'Done',        tone: 'ok',     time: '12:00' },
  ];

  return (
    <div className="page" style={{ maxWidth: 560 }}>
      <div className="page-head" style={{ marginBottom: 14 }}>
        <div>
          <h1 style={{ fontSize: 22 }}>On patrol</h1>
          <div className="sub">Tomás Vega · Sector E-22 · 14:42 local</div>
        </div>
        <span className="pill ok"><span className="ldot" />Checked in</span>
      </div>

      <div
        className="card"
        style={{
          padding: 0,
          marginBottom: 14,
          borderColor: 'var(--danger)',
          borderWidth: 1,
          boxShadow: '0 0 0 3px color-mix(in oklab, var(--danger) 12%, transparent)',
        }}
      >
        <div
          style={{
            padding: '10px 16px',
            background: 'var(--danger-soft)',
            color: 'var(--danger)',
            display: 'flex',
            gap: 8,
            alignItems: 'center',
          }}
        >
          <Icon name="flag" />
          <span className="bold small">CURRENT ASSIGNMENT · CRITICAL</span>
        </div>
        <div style={{ padding: 18 }}>
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>
            Group crossing — Cedar Crossing
          </div>
          <div className="muted small" style={{ marginBottom: 14 }}>
            6 persons detected · 0.6 km from your position · ETA 2 min
          </div>

          <div className="grid g-2" style={{ gap: 8, marginBottom: 14 }}>
            <button className="btn primary" style={{ justifyContent: 'center', padding: 12 }}>
              Navigate <Icon name="chevr" />
            </button>
            <button className="btn" style={{ justifyContent: 'center', padding: 12 }}>
              <Icon name="cam" /> View camera
            </button>
          </div>

          <div className="row gap-8 small muted">
            <Icon name="user" size={14} /> Backup: Patrol Bravo-3 (8 min away)
          </div>
        </div>
      </div>

      <div className="grid g-2" style={{ gap: 10, marginBottom: 14 }}>
        <button className="card" style={{ padding: 18, textAlign: 'left', cursor: 'pointer' }}>
          <div className="bold" style={{ marginTop: 6 }}>Request backup</div>
          <div className="tiny muted">Alerts dispatch + sector lead</div>
        </button>
        <button className="card" style={{ padding: 18, textAlign: 'left', cursor: 'pointer' }}>
          <div className="bold" style={{ marginTop: 6 }}>Submit report</div>
          <div className="tiny muted">Photo, voice note, or form</div>
        </button>
        <button
          className="card"
          style={{ padding: 18, textAlign: 'left', cursor: 'pointer' }}
          onClick={() => onNav('map')}
        >
          <Icon name="map" />
          <div className="bold" style={{ marginTop: 6 }}>Sector map</div>
          <div className="tiny muted">See nearby cameras & units</div>
        </button>
        <button className="card" style={{ padding: 18, textAlign: 'left', cursor: 'pointer' }}>
          <Icon name="check" />
          <div className="bold" style={{ marginTop: 6 }}>End shift</div>
          <div className="tiny muted">Check out & sign report</div>
        </button>
      </div>

      <div className="card">
        <div className="card-head"><h3>Today's assignments</h3></div>
        <div className="card-body flush">
          {todays.map((x, i) => (
            <div
              key={i}
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--line)',
                display: 'flex',
                gap: 10,
                alignItems: 'center',
              }}
            >
              <span className={`pill ${x.tone}`}>
                <span className="ldot" />
                {x.s}
              </span>
              <div style={{ flex: 1 }}>
                <div className="bold small">{x.t}</div>
                <div className="tiny muted mono">{x.time}</div>
              </div>
              <Icon name="chevr" size={12} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ──────────────────────────────────────────────────────────────────
   ANALYST — data-first. Trends, anomalies, heatmap.
   ────────────────────────────────────────────────────────────────── */

const ANALYST_KPIS: { k: string; v: string; d: string; up: boolean }[] = [
  { k: 'Detections',       v: '8,412',  d: '+12%',       up: true },
  { k: 'True positives',   v: '1,284',  d: '+9%',        up: true },
  { k: 'False positives',  v: '3.1%',   d: '−1.2pp',     up: true },
  { k: 'Mean response',    v: '4m 12s', d: '−38s',       up: true },
  { k: 'Model precision',  v: '0.94',   d: '+0.02',      up: true },
  { k: 'Anomalies',        v: '7',      d: 'investigate', up: false },
];

const ANOMALIES: { t: string; s: string; tone: string }[] = [
  { t: 'Spike in night detections — NW-04',   s: '+3.2σ vs baseline',       tone: 'warn' },
  { t: 'Plate cluster — Cedar Crossing',      s: '5 repeats in 48h',        tone: 'warn' },
  { t: 'Low confidence batch — RF-07-A',      s: 'Possible sensor drift',   tone: 'info' },
  { t: 'Drone signature pattern',             s: 'Matches prior incident',  tone: 'danger' },
];

const ANALYST_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const buildAnalystHeat = () =>
  Array.from({ length: 7 }).map((_, d) =>
    Array.from({ length: 24 }).map((__, h) => {
      const seed = (d * 41 + h * 11 + 17) % 89;
      return seed / 89;
    })
  );

const AnalystDashboard = ({ onNav }: NavProps) => {
  const heat = useMemo(buildAnalystHeat, []);
  const linePath = useMemo(
    () =>
      SPARK_DAY
        .map((v, i) => {
          const x = (i / (SPARK_DAY.length - 1)) * 580 + 10;
          const y = 190 - (v / 55) * 170;
          return `${i === 0 ? 'M' : 'L'}${x},${y}`;
        })
        .join(' '),
    []
  );

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Analytics workbench</h1>
          <div className="sub">
            Jordan Reyes · HQ — Region North · 7-day window ending May 9, 14:42
          </div>
        </div>
        <div className="actions">
          <select className="select sm" style={{ width: 'auto' }}>
            <option>Last 7 days</option>
            <option>Last 30 days</option>
            <option>Custom…</option>
          </select>
          <button className="btn"><Icon name="dl" /> Export CSV</button>
          <button className="btn accent" onClick={() => onNav('reports')}>
            <Icon name="rep" /> Build report
          </button>
        </div>
      </div>

      <div className="grid g-6" style={{ marginBottom: 16 }}>
        {ANALYST_KPIS.map((s) => (
          <div key={s.k} className="card" style={{ padding: 14 }}>
            <div className="muted tiny">{s.k}</div>
            <div
              className="tnum"
              style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.01em' }}
            >
              {s.v}
            </div>
            <div className={`tiny ${s.up ? 'delta up' : 'delta down'}`}>{s.d}</div>
          </div>
        ))}
      </div>

      <div
        className="grid"
        style={{ gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}
      >
        <div className="card">
          <div className="card-head"><h3>Detections — 7 days</h3></div>
          <div className="card-body">
            <svg viewBox="0 0 600 200" style={{ width: '100%', height: 200 }}>
              {[0, 1, 2, 3, 4].map((i) => (
                <line
                  key={i}
                  x1="0"
                  x2="600"
                  y1={i * 45 + 10}
                  y2={i * 45 + 10}
                  stroke="var(--line)"
                  strokeWidth="1"
                />
              ))}
              <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth="2" />
              <path
                d={`${linePath} L590,190 L10,190 Z`}
                fill="var(--accent)"
                opacity="0.08"
              />
            </svg>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h3>Anomalies flagged</h3></div>
          <div className="card-body flush">
            {ANOMALIES.map((a, i) => (
              <div
                key={i}
                style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)' }}
              >
                <div className="bold small">{a.t}</div>
                <div className="row gap-8" style={{ marginTop: 4 }}>
                  <span className={`pill ${a.tone}`}>
                    <span className="ldot" />
                    {a.s}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Activity heatmap — day × hour</h3>
          <div className="grow" />
          <span className="muted tiny">UTC</span>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: '40px repeat(24, 1fr)', gap: 2 }}>
            <div />
            {Array.from({ length: 24 }).map((_, h) => (
              <div
                key={h}
                className="tiny muted mono"
                style={{ textAlign: 'center', fontSize: 9 }}
              >
                {h % 4 === 0 ? h : ''}
              </div>
            ))}
            {heat.map((row, d) => (
              <Fragment key={d}>
                <div className="tiny muted" style={{ display: 'flex', alignItems: 'center' }}>
                  {ANALYST_DAYS[d]}
                </div>
                {row.map((v, h) => (
                  <div
                    key={h}
                    title={`${ANALYST_DAYS[d]} ${h}:00 — ${(v * 100).toFixed(0)}`}
                    style={{
                      aspectRatio: '1',
                      background: `color-mix(in oklab, var(--accent) ${v * 100}%, var(--bg-sunk))`,
                      borderRadius: 2,
                    }}
                  />
                ))}
              </Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
