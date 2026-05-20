import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { Severity } from '../components/Severity';
import { type AlertStatus, type AlertRow } from '../data';
import type { PageKey } from '../types';
import { listAlerts, acknowledgeAlert, escalateAlert, type AlertPublic } from '@/api/alerts';
import { alertPublicToRow } from '../utils/adapters';

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

interface LoadState {
  state:  'idle' | 'loading' | 'success' | 'error';
  rows:   AlertRow[];
  raw:    AlertPublic[];
  error:  string | null;
}

const INITIAL: LoadState = { state: 'idle', rows: [], raw: [], error: null };

export const AlertsPage = ({ onNav }: AlertsPageProps) => {
  const [filter, setFilter] = useState<FilterValue>('All');
  const [load, setLoad] = useState<LoadState>(INITIAL);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = async (): Promise<void> => {
    setLoad((prev) => ({ ...prev, state: 'loading', error: null }));
    try {
      const { alerts } = await listAlerts({ limit: 200 });
      setLoad({ state: 'success', raw: alerts, rows: alerts.map(alertPublicToRow), error: null });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load alerts';
      setLoad({ state: 'error', raw: [], rows: [], error: msg });
    }
  };

  useEffect(() => {
    void reload();
    // No auto-refresh interval here; live updates land via Redis pub/sub in a
    // future task — adding setInterval now would just hammer the API for a
    // mostly-static demo dataset.
  }, []);

  const filtered = filter === 'All' ? load.rows : load.rows.filter((a) => a.status === filter);

  const onAcknowledge = async (id: string): Promise<void> => {
    setBusyId(id);
    try {
      await acknowledgeAlert(id);
      await reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Acknowledge failed';
      setLoad((prev) => ({ ...prev, error: msg }));
    } finally {
      setBusyId(null);
    }
  };

  const onEscalate = async (id: string): Promise<void> => {
    setBusyId(id);
    try {
      await escalateAlert(id);
      await reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Escalate failed';
      setLoad((prev) => ({ ...prev, error: msg }));
    } finally {
      setBusyId(null);
    }
  };

  const subline = (() => {
    if (load.state === 'loading') return 'Loading…';
    if (load.state === 'error')   return 'Couldn’t reach backend';
    return `${filtered.length} alert${filtered.length === 1 ? '' : 's'} · backend live`;
  })();

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Alerts</h1>
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
              s === 'All' ? load.rows.length : load.rows.filter((a) => a.status === s).length;
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
          <div style={{ padding: 24, textAlign: 'center' }} className="muted">Loading alerts…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center' }} className="muted">
            {load.state === 'error' ? 'No data — backend unreachable.' : 'No alerts match this filter.'}
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Alert</th>
                <th>Severity</th>
                <th>Sector</th>
                <th>Source</th>
                <th>When</th>
                <th>Status</th>
                <th style={{ width: 220 }} />
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => {
                const cls = a.sev >= 5 ? 'urgent' : a.sev >= 4 ? 'warn' : '';
                const isBusy = busyId === a.id;
                const canAck = a.status === 'Open';
                const canEsc = a.status === 'Open' || a.status === 'Acknowledged';
                return (
                  <tr key={a.id} className={cls}>
                    <td>
                      <div className="bold">{a.type}</div>
                      <div className="tiny muted mono">{a.id}</div>
                    </td>
                    <td><Severity level={a.sev} /></td>
                    <td className="mono">{a.sector}</td>
                    <td className="mono small">{a.cam}</td>
                    <td className="mono small">
                      {a.whenISO}
                      <div className="tiny muted">{a.when}</div>
                    </td>
                    <td>
                      <span className={`pill ${statusPillClass(a.status)}`}>{a.status}</span>
                    </td>
                    <td>
                      <div className="row gap-8" style={{ justifyContent: 'flex-end' }}>
                        {canAck && (
                          <button
                            className="btn ghost sm"
                            disabled={isBusy}
                            onClick={() => void onAcknowledge(a.id)}
                          >
                            {isBusy ? '…' : 'Ack'}
                          </button>
                        )}
                        {canEsc && (
                          <button
                            className="btn ghost sm"
                            disabled={isBusy}
                            onClick={() => void onEscalate(a.id)}
                          >
                            {isBusy ? '…' : 'Escalate'}
                          </button>
                        )}
                        <button className="btn ghost sm" onClick={() => onNav('incident')}>
                          Open <Icon name="chevr" size={12} />
                        </button>
                      </div>
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
