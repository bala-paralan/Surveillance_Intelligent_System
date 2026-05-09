import { useState } from 'react';
import { Icon } from '../components/Icon';

type Tab = 'Faces' | 'Plates' | 'Events';

interface Result {
  id: string;
  sector: string;
  time: string;
  conf: number;
  type?: string;
}

const buildResults = (): Record<Tab, Result[]> => ({
  Faces: Array.from({ length: 8 }).map((_, i) => ({
    id: `PER-${1000 + i}`,
    sector: ['NW-04', 'E-22', 'N-12'][i % 3],
    time: `14:${30 + i}`,
    conf: 0.74 + i * 0.03,
  })),
  Plates: ['7HFK·293', 'BRD·1042', 'ZW2·8841', 'LFG·552', 'MQ9·101', 'POP·773'].map((id, i) => ({
    id,
    sector: ['NW-04', 'E-22'][i % 2],
    time: `14:${20 + i * 3}`,
    conf: 0.81 + i * 0.02,
  })),
  Events: ['Crossing', 'Loitering', 'Fence touch', 'Drone', 'Vehicle', 'Tunnel ping', 'Boat'].map(
    (type, i) => ({
      id: `EVT-${i}`,
      type,
      sector: ['NW-04', 'E-22', 'N-12'][i % 3],
      time: `14:${10 + i * 4}`,
      conf: 0.7 + i * 0.04,
    })
  ),
});

export const SearchPage = () => {
  const [tab, setTab] = useState<Tab>('Faces');
  const results = buildResults();

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Search</h1>
          <div className="sub">Find people, vehicles, and events across all cameras and sectors</div>
        </div>
      </div>

      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div className="row gap-8" style={{ marginBottom: 14 }}>
          {(['Faces', 'Plates', 'Events'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`btn ${tab === t ? 'primary' : ''}`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'Faces' && (
          <div className="grid" style={{ gridTemplateColumns: '200px 1fr', gap: 16, alignItems: 'start' }}>
            <div className="placeholder" style={{ aspectRatio: '1', flexDirection: 'column', gap: 8 }}>
              <Icon name="user" size={28} />
              <span>DROP IMAGE</span>
              <button className="btn sm">Upload</button>
            </div>
            <div className="grid g-3" style={{ gap: 12 }}>
              <div className="field">
                <label>Sector</label>
                <select className="select">
                  <option>All</option>
                  <option>NW-04</option>
                  <option>E-22</option>
                </select>
              </div>
              <div className="field">
                <label>Time range</label>
                <select className="select">
                  <option>Last 24 hours</option>
                  <option>Last 7 days</option>
                  <option>Custom…</option>
                </select>
              </div>
              <div className="field">
                <label>Min confidence</label>
                <input className="input" type="range" defaultValue="70" />
              </div>
              <div className="field">
                <label>Min age</label>
                <input className="input" placeholder="Any" />
              </div>
              <div className="field">
                <label>Apparel</label>
                <input className="input" placeholder="dark jacket, backpack…" />
              </div>
              <div className="field" style={{ justifyContent: 'flex-end' }}>
                <button className="btn accent" style={{ justifyContent: 'center' }}>
                  <Icon name="srch" /> Search 142 cameras
                </button>
              </div>
            </div>
          </div>
        )}
        {tab === 'Plates' && (
          <div className="row gap-12">
            <input
              className="input"
              placeholder="License plate (e.g. 7HFK 293)"
              style={{ flex: 1, fontSize: 18, padding: '12px 16px', fontFamily: 'var(--font-mono)' }}
            />
            <button className="btn accent"><Icon name="srch" /> Search</button>
          </div>
        )}
        {tab === 'Events' && (
          <div className="grid g-4" style={{ gap: 12 }}>
            <div className="field">
              <label>Event type</label>
              <select className="select">
                <option>Any</option>
                <option>Crossing</option>
                <option>Loitering</option>
              </select>
            </div>
            <div className="field">
              <label>Sector</label>
              <select className="select"><option>All</option></select>
            </div>
            <div className="field">
              <label>From</label>
              <input className="input" defaultValue="2026-04-25 00:00" />
            </div>
            <div className="field">
              <label>To</label>
              <input className="input" defaultValue="2026-04-25 14:42" />
            </div>
          </div>
        )}
      </div>

      <div className="row gap-8" style={{ marginBottom: 12 }}>
        <span className="muted small">{results[tab].length} matches</span>
        <div className="grow" />
        <button className="btn ghost sm"><Icon name="grid" /></button>
        <button className="btn ghost sm"><Icon name="list" /></button>
      </div>

      <div className="grid g-4">
        {results[tab].map((r) => (
          <div key={r.id} className="card">
            <div className="cam" style={{ borderRadius: 0, aspectRatio: '4/3' }}>
              <div className="feed" />
              <div className="ovl">
                <div className="ovl-top">
                  <span className="tag">
                    {tab === 'Plates' ? 'PLATE' : tab === 'Faces' ? 'PERSON' : 'EVENT'}
                  </span>
                  <span
                    className="tag"
                    style={{
                      background: r.conf >= 0.9 ? 'rgba(5,150,105,0.85)' : 'rgba(217,119,6,0.85)',
                      color: '#fff',
                    }}
                  >
                    {(r.conf * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="ovl-bot">
                  <span className="tag">{r.sector}</span>
                  <span className="tag">{r.time}</span>
                </div>
              </div>
            </div>
            <div style={{ padding: 12 }}>
              <div className="bold mono small">
                {r.id}
                {r.type ? ` · ${r.type}` : ''}
              </div>
              <div className="tiny muted">CAM-{r.sector}-0{(r.id.length % 9) + 1}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
