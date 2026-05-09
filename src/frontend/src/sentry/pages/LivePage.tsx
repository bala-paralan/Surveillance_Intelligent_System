import { useState } from 'react';
import { Icon } from '../components/Icon';
import { CameraTile } from '../components/CameraTile';
import { CAMERAS, SECTORS } from '../data';

type Layout = '2x2' | '3x3' | '4x4';

const LAYOUTS: Layout[] = ['2x2', '3x3', '4x4'];

export const LivePage = () => {
  const [layout, setLayout] = useState<Layout>('3x3');
  const [sector, setSector] = useState<string>('All');

  const cams = sector === 'All' ? CAMERAS : CAMERAS.filter((c) => c.sector === sector);
  const cols = layout === '2x2' ? 2 : layout === '3x3' ? 3 : 4;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Live feed wall</h1>
          <div className="sub">
            {cams.length} of {CAMERAS.length} cameras streaming
          </div>
        </div>
        <div className="actions">
          <select
            className="select"
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            style={{ width: 'auto' }}
          >
            <option>All</option>
            {SECTORS.map((s) => (
              <option key={s.id}>{s.id}</option>
            ))}
          </select>
          <div
            className="row gap-8"
            style={{
              background: 'var(--bg-elev)',
              border: '1px solid var(--line)',
              borderRadius: 8,
              padding: 2,
            }}
          >
            {LAYOUTS.map((l) => (
              <button
                key={l}
                className="btn ghost sm"
                onClick={() => setLayout(l)}
                style={l === layout ? { background: 'var(--bg-hover)', color: 'var(--ink)' } : undefined}
              >
                {l}
              </button>
            ))}
          </div>
          <button className="btn">
            <Icon name="grid" /> Save layout
          </button>
        </div>
      </div>

      <div
        className="grid"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 10 }}
      >
        {cams.map((c) => (
          <div key={c.id} className="col gap-4">
            <CameraTile
              id={c.id}
              location={c.name}
              mode={c.mode}
              status={c.status}
              alert={c.alert}
              warn={c.warn}
              label={c.label}
            />
            <div className="row gap-8 small">
              <span
                className="bold"
                style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {c.name}
              </span>
              <span className="muted mono tiny">{c.id}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
