import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { Severity } from '../components/Severity';
import { type Incident } from '../data';
import type { PageKey } from '../types';
import { listIncidents, type IncidentPublic } from '@/api/incidents';
import { incidentPublicToRow } from '../utils/adapters';

type FilterValue = 'All' | 'In Progress' | 'Investigating' | 'Escalated' | 'Resolved' | 'Closed';

const FILTERS: FilterValue[] = ['All', 'In Progress', 'Investigating', 'Escalated', 'Resolved', 'Closed'];

interface IncidentsPageProps {
  onNav: (page: PageKey) => void;
}

const statusPillClass = (status: string): string => {
  if (status === 'Resolved' || status === 'Closed') return 'ok';
  if (status === 'Escalated') return 'danger';
  return 'warn';
};

interface LoadState {
  state: 'idle' | 'loading' | 'success' | 'error';
  rows:  Incident[];
  raw:   IncidentPublic[];
  error: string | null;
}

const INITIAL: LoadState = { state: 'idle', rows: [], raw: [], error: null };

export const IncidentsPage = ({ onNav }: IncidentsPageProps) => {
  const [filter, setFilter] = useState<FilterValue>('All');
  const [load, setLoad] = useState<LoadState>(INITIAL);

  const reload = async (): Promise<void> => {
    setLoad((prev) => ({ ...prev, state: 'loading', error: null }));
    try {
      const { incidents } = await listIncidents({ limit: 200 });
      setLoad({ state: 'success', raw: incidents, rows: incidents.map(incidentPublicToRow), error: null });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load incidents';
      setLoad({ state: 'error', raw: [], rows: [], error: msg });
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const filtered = filter === 'All' ? load.rows : load.rows.filter((i) => i.status === filter);

  const subline = (() => {
    if (load.state === 'loading') return 'Loading…';
    if (load.state === 'error')   return 'Couldn’t reach backend';
    return `${filtered.length} incident${filtered.length === 1 ? '' : 's'} · backend live`;
  })();

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Incidents</h1>
          <div className="sub">{subline}</div>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => void reload()} disabled={load.state === 'loading'}>
            <Icon name="filter" /> Refresh
          </button>
        </div>
      </div>

      {load.error && (
        <div
          className="card"
          role="alert"
          style={{
            marginBottom: 12,
            padding: '10px 14px',
            background: 'rgba(220,38,38,0.08)',
            border: '1px solid rgba(220,38,38,0.3)',
            color: 'var(--danger, #dc2626)',
          }}
        >
          <strong>API error:</strong> {load.error}
        </div>
      )}

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="row gap-8" style={{ padding: 12, flexWrap: 'wrap' }}>
          {FILTERS.map((s) => {
            const count =
              s === 'All' ? load.rows.length : load.rows.filter((i) => i.status === s).length;
            const isActive = filter === s;
            return (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className="pill"
                style={
                  isActive
                    ? { background: 'var(--ink)', color: 'var(--bg-elev)', borderColor: 'var(--ink)' }
                    : undefined
                }
              >
                {s} <span style={{ opacity: 0.6 }}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="card">
        {load.state === 'loading' && load.rows.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center' }} className="muted">Loading incidents…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center' }} className="muted">
            {load.state === 'error' ? 'No data — backend unreachable.' : 'No incidents match this filter.'}
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Incident</th>
                <th>Severity</th>
                <th>Sector</th>
                <th>Opened</th>
                <th>Responder</th>
                <th>Alerts</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => {
                const cls = i.sev >= 5 ? 'urgent' : i.sev >= 4 ? 'warn' : '';
                return (
                  <tr key={i.id} className={cls}>
                    <td>
                      <div className="bold">{i.title}</div>
                      <div className="tiny muted mono">{i.id}</div>
                    </td>
                    <td><Severity level={i.sev} /></td>
                    <td className="mono">{i.sector}</td>
                    <td className="mono small">{i.opened}</td>
                    <td className="small">{i.responder}</td>
                    <td className="tnum">{i.alerts}</td>
                    <td>
                      <span className={`pill ${statusPillClass(i.status)}`}>{i.status}</span>
                    </td>
                    <td>
                      <button className="btn ghost sm" onClick={() => onNav('incident')}>
                        Open <Icon name="chevr" size={12} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
