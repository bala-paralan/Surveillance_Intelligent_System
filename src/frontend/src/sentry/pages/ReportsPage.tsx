import { Fragment, useMemo } from 'react';
import { Icon } from '../components/Icon';
import { SECTORS, SPARK_DAY } from '../data';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const KPIS: { k: string; v: string; d: string; up: boolean }[] = [
  { k: 'Detections',          v: '8,412',  d: '+12%',   up: true },
  { k: 'Confirmed crossings', v: '47',     d: '−8%',    up: false },
  { k: 'False positives',     v: '3.1%',   d: '−1.2pp', up: true },
  { k: 'Mean response',       v: '4m 12s', d: '−38s',   up: true },
];

const SECTOR_COUNTS = [412, 188, 96, 588];
const SECTOR_WIDTHS = [60, 28, 15, 90];

const buildHeat = () =>
  Array.from({ length: 7 }).map((_, d) =>
    Array.from({ length: 24 }).map((__, h) => {
      const seed = (d * 31 + h * 7 + 13) % 97;
      return seed / 97;
    })
  );

const linePath = (data: number[]) =>
  data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * 580 + 10;
      const y = 210 - (v / 55) * 180;
      return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    })
    .join(' ');

export const ReportsPage = () => {
  const heat = useMemo(buildHeat, []);
  const path = useMemo(() => linePath(SPARK_DAY), []);
  const filledPath = useMemo(() => `${path} L590,210 L10,210 Z`, [path]);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Reports & analytics</h1>
          <div className="sub">Region North · Apr 18 – Apr 25, 2026</div>
        </div>
        <div className="actions">
          <button className="btn"><Icon name="dl" /> Download PDF</button>
          <button className="btn accent"><Icon name="plus" /> New report</button>
        </div>
      </div>

      <div className="grid g-4" style={{ marginBottom: 16 }}>
        {KPIS.map((s) => (
          <div key={s.k} className="card kpi">
            <div className="label">{s.k}</div>
            <div className="val">{s.v}</div>
            <div className={`delta ${s.up ? 'up' : 'down'}`}>
              <Icon name={s.up ? 'arrU' : 'arrD'} size={12} /> {s.d} vs prior week
            </div>
          </div>
        ))}
      </div>

      <div className="grid" style={{ gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="card">
          <div className="card-head">
            <h3>Detections — last 7 days</h3>
            <div className="grow" />
            <select className="select sm" style={{ width: 'auto' }}>
              <option>Daily</option>
              <option>Hourly</option>
            </select>
          </div>
          <div className="card-body">
            <svg viewBox="0 0 600 220" style={{ width: '100%', height: 240 }}>
              {[0, 1, 2, 3, 4].map((i) => (
                <line
                  key={i}
                  x1="0"
                  x2="600"
                  y1={i * 50 + 10}
                  y2={i * 50 + 10}
                  stroke="var(--line)"
                  strokeWidth="1"
                />
              ))}
              {SPARK_DAY.map((v, i) => {
                const x = (i / (SPARK_DAY.length - 1)) * 580 + 10;
                const y = 210 - (v / 55) * 180;
                return <circle key={i} cx={x} cy={y} r="3" fill="var(--accent)" />;
              })}
              <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2" />
              <path d={filledPath} fill="var(--accent)" opacity="0.08" />
            </svg>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h3>By sector</h3></div>
          <div className="card-body">
            {SECTORS.map((s, i) => (
              <div
                key={s.id}
                style={{
                  padding: '10px 0',
                  borderBottom: i < SECTORS.length - 1 ? '1px solid var(--line)' : 'none',
                }}
              >
                <div className="row gap-8" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
                  <span className="bold small">{s.name}</span>
                  <span className="tnum small">{SECTOR_COUNTS[i]}</span>
                </div>
                <div style={{ height: 6, background: 'var(--bg-sunk)', borderRadius: 3, overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${SECTOR_WIDTHS[i]}%`,
                      background: i === 3 ? 'var(--danger)' : 'var(--accent)',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Activity heatmap — by day & hour</h3>
          <div className="grow" />
          <span className="muted tiny">UTC</span>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: '40px repeat(24, 1fr)', gap: 2 }}>
            <div />
            {Array.from({ length: 24 }).map((_, h) => (
              <div key={h} className="tiny muted mono" style={{ textAlign: 'center', fontSize: 9 }}>
                {h % 4 === 0 ? h : ''}
              </div>
            ))}
            {heat.map((row, d) => (
              <Fragment key={d}>
                <div className="tiny muted" style={{ display: 'flex', alignItems: 'center' }}>
                  {DAYS[d]}
                </div>
                {row.map((v, h) => (
                  <div
                    key={h}
                    title={`${DAYS[d]} ${h}:00 — ${(v * 100).toFixed(0)}`}
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
          <div className="row gap-8 small muted" style={{ marginTop: 12, justifyContent: 'flex-end' }}>
            <span>Less</span>
            {[0.1, 0.3, 0.5, 0.7, 0.9].map((v) => (
              <div
                key={v}
                style={{
                  width: 12,
                  height: 12,
                  background: `color-mix(in oklab, var(--accent) ${v * 100}%, var(--bg-sunk))`,
                  borderRadius: 2,
                }}
              />
            ))}
            <span>More</span>
          </div>
        </div>
      </div>
    </div>
  );
};
