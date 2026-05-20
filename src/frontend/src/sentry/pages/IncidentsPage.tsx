import { useState } from 'react';
import { Icon } from '../components/Icon';
import { Severity } from '../components/Severity';
import { INCIDENTS } from '../data';
import type { PageKey } from '../types';

type FilterValue = 'All' | 'In Progress' | 'Investigating' | 'Escalated' | 'Resolved' | 'Closed';

const FILTERS: FilterValue[] = ['All', 'In Progress', 'Investigating', 'Escalated', 'Resolved', 'Closed'];

interface IncidentsPageProps {
  onNav: (page: PageKey) => void;
}

const statusPillClass = (status: string): string => {
  if (status === 'Escalated') return 'danger';
  if (status === 'Resolved' || status === 'Closed') return 'ok';
  return 'warn';
};

export const IncidentsPage = ({ onNav }: IncidentsPageProps) => {
  const [filter, setFilter] = useState<FilterValue>('All');

  const filtered = filter === 'All' ? INCIDENTS : INCIDENTS.filter((i) => i.status === filter);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Incidents</h1>
          <div className="sub">{filtered.length} incidents · auto-refresh 5s</div>
        </div>
        <div className="actions">
          <button className="btn"><Icon name="filter" /> Filters</button>
          <button className="btn"><Icon name="dl" /> Export CSV</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="row gap-8" style={{ padding: 12, flexWrap: 'wrap' }}>
          {FILTERS.map((s) => {
            const count = s === 'All' ? INCIDENTS.length : INCIDENTS.filter((i) => i.status === s).length;
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
      </div>
    </div>
  );
};
