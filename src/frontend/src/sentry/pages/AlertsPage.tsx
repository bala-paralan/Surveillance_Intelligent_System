import { useState } from 'react';
import { Icon } from '../components/Icon';
import { Severity } from '../components/Severity';
import { ALERTS, type AlertStatus } from '../data';
import type { PageKey } from '../types';

type FilterValue = 'All' | AlertStatus;

const FILTERS: FilterValue[] = [
  'All',
  'Open',
  'Acknowledged',
  'Investigating',
  'Escalated',
  'Resolved',
  'Dismissed',
];

interface AlertsPageProps {
  onNav: (page: PageKey) => void;
}

const statusPillClass = (status: AlertStatus) => {
  if (status === 'Open') return 'danger';
  if (status === 'Resolved') return 'ok';
  if (status === 'Dismissed') return '';
  return 'warn';
};

export const AlertsPage = ({ onNav }: AlertsPageProps) => {
  const [filter, setFilter] = useState<FilterValue>('All');
  const [selected] = useState<Set<string>>(new Set());

  const filtered = filter === 'All' ? ALERTS : ALERTS.filter((a) => a.status === filter);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Alerts</h1>
          <div className="sub">{filtered.length} alerts · auto-refresh 5s</div>
        </div>
        <div className="actions">
          <button className="btn"><Icon name="filter" /> Filters</button>
          <button className="btn"><Icon name="dl" /> Export CSV</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="row gap-8" style={{ padding: 12, flexWrap: 'wrap' }}>
          {FILTERS.map((s) => {
            const count =
              s === 'All' ? ALERTS.length : ALERTS.filter((a) => a.status === s).length;
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
          <div className="grow" />
          {selected.size > 0 && (
            <div className="row gap-8">
              <span className="small muted">{selected.size} selected</span>
              <button className="btn sm">Acknowledge</button>
              <button className="btn sm danger">Escalate</button>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 32 }}>
                <input type="checkbox" />
              </th>
              <th>Alert</th>
              <th>Severity</th>
              <th>Sector</th>
              <th>Source</th>
              <th>Confidence</th>
              <th>When</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => {
              const cls = a.sev >= 5 ? 'urgent' : a.sev >= 4 ? 'warn' : '';
              return (
                <tr key={a.id} className={cls}>
                  <td><input type="checkbox" /></td>
                  <td>
                    <div className="bold">{a.type}</div>
                    <div className="tiny muted mono">{a.id}</div>
                  </td>
                  <td><Severity level={a.sev} /></td>
                  <td className="mono">{a.sector}</td>
                  <td className="mono small">{a.cam}</td>
                  <td>
                    <div className="row gap-8">
                      <div
                        style={{
                          width: 50,
                          height: 5,
                          background: 'var(--bg-sunk)',
                          borderRadius: 3,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${a.conf * 100}%`,
                            background:
                              a.conf >= 0.9
                                ? 'var(--ok)'
                                : a.conf >= 0.8
                                ? 'var(--warn)'
                                : 'var(--ink-3)',
                          }}
                        />
                      </div>
                      <span className="tnum tiny">{(a.conf * 100).toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="mono small">
                    {a.whenISO}
                    <div className="tiny muted">{a.when}</div>
                  </td>
                  <td>
                    <span className={`pill ${statusPillClass(a.status)}`}>{a.status}</span>
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
