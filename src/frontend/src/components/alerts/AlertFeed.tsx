/**
 * AlertFeed — operator-grade alert feed (TASK-043 §5.2).
 *
 * Each row carries:
 *   - severity chip
 *   - sentence-form headline (NarrativeTemplate)
 *   - AOI tag and timestamp (relative + absolute on hover)
 *   - sensor icon for the contributing sensor
 *   - actions: Acknowledge, Escalate, Mark False, Open on map
 *
 * Controls bar: severity filter + sort toggle (newest / highest severity).
 * Sensor-type and AOI filters are deferred until the backend exposes them
 * end-to-end; the UI hooks are present.
 */
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useAoiStore } from '@/store/aoiStore';
import {
  acknowledgeAlert,
  escalateAlert,
  listAlerts,
  markAlertFalse,
} from '@/api/alerts';
import type { AlertPublic, AlertSeverity } from '@/api/alerts';
import { alertToThreat } from '@/api/threats';
import { narrativeFromAlert } from '@/components/alerts/NarrativeTemplate';
import { AlertDetailModal } from '@/components/alerts/AlertDetailModal';
import { SensorTypeIcon } from '@/components/threats/IllustrativeIcon';

// ── Severity helpers ──────────────────────────────────────────────────────────

const SEVERITY_BADGE: Record<AlertSeverity, string> = {
  CRITICAL: 'bg-red-600 text-white',
  HIGH:     'bg-orange-500 text-white',
  MEDIUM:   'bg-yellow-400 text-gray-900',
  LOW:      'bg-blue-500 text-white',
};

const SEVERITY_ROW: Record<AlertSeverity, string> = {
  CRITICAL: 'border-l-4 border-red-600',
  HIGH:     'border-l-4 border-orange-500',
  MEDIUM:   'border-l-4 border-yellow-400',
  LOW:      'border-l-4 border-blue-500',
};

const SEVERITY_RANK: Record<AlertSeverity, number> = {
  CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3,
};

// ── Time helpers ──────────────────────────────────────────────────────────────

const timeAgo = (iso: string): string => {
  const diffMs = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60)   return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60)   return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24)     return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const timeAbs = (iso: string): string => {
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
};

// ── Single alert row ──────────────────────────────────────────────────────────

interface AlertRowProps {
  alert: AlertPublic;
  aoiLabel: string;
  canAct: boolean;
  ackingId: string | null;
  escalatingId: string | null;
  markingId: string | null;
  onAcknowledge: (id: string) => void;
  onEscalate: (id: string) => void;
  onMarkFalse: (id: string) => void;
  onOpen: (alert: AlertPublic) => void;
}

const AlertRow = ({
  alert,
  aoiLabel,
  canAct,
  ackingId,
  escalatingId,
  markingId,
  onAcknowledge,
  onEscalate,
  onMarkFalse,
  onOpen,
}: AlertRowProps) => {
  const sensorType = alertToThreat(alert).contributions[0]?.sensor_type;

  return (
    <div
      className={`flex items-start gap-3 rounded-md bg-gray-800 px-4 py-3 ${SEVERITY_ROW[alert.severity]}`}
    >
      {/* Severity chip */}
      <span
        className={`mt-0.5 shrink-0 rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${SEVERITY_BADGE[alert.severity]}`}
      >
        {alert.severity}
      </span>

      {/* Sensor icon */}
      {sensorType !== undefined && (
        <span className="mt-0.5 shrink-0 text-gray-400" aria-hidden="true">
          <SensorTypeIcon sensorType={sensorType} size={18} />
        </span>
      )}

      {/* Content */}
      <button
        type="button"
        className="min-w-0 flex-1 text-left focus:outline-none focus:ring-2 focus:ring-gray-500 rounded"
        onClick={() => onOpen(alert)}
        aria-label={`Open alert: ${alert.severity} ${alert.type}`}
      >
        <p className="text-sm text-white break-words">{narrativeFromAlert(alert)}</p>
        <div className="mt-1 flex items-center gap-2 text-xs">
          <span
            className="rounded bg-gray-700 px-1.5 py-0.5 text-gray-300 truncate max-w-[12rem]"
            title={aoiLabel}
          >
            {aoiLabel}
          </span>
          <span
            className="text-gray-500"
            title={timeAbs(alert.createdAt)}
          >
            {timeAgo(alert.createdAt)}
          </span>
        </div>
      </button>

      {/* Actions */}
      {canAct && (
        <div className="shrink-0 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            disabled={markingId === alert.id}
            onClick={() => onMarkFalse(alert.id)}
            className="rounded bg-gray-700 px-2 py-1 text-xs text-gray-300 hover:bg-gray-600 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
            title="Mark as false positive"
          >
            {markingId === alert.id ? 'Marking…' : 'False'}
          </button>
          <button
            type="button"
            disabled={escalatingId === alert.id}
            onClick={() => onEscalate(alert.id)}
            className="rounded bg-red-700 px-2 py-1 text-xs text-white hover:bg-red-600 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-red-400"
            title="Escalate to supervisor"
          >
            {escalatingId === alert.id ? 'Escalating…' : 'Escalate'}
          </button>
          {!alert.acknowledged ? (
            <button
              type="button"
              disabled={ackingId === alert.id}
              onClick={() => onAcknowledge(alert.id)}
              className="rounded bg-yellow-600 px-2 py-1 text-xs font-medium text-white hover:bg-yellow-700 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-300"
            >
              {ackingId === alert.id ? 'Ack…' : 'Acknowledge'}
            </button>
          ) : (
            <span className="rounded bg-gray-700 px-2 py-1 text-xs text-gray-400">
              Acked
            </span>
          )}
        </div>
      )}
    </div>
  );
};

// ── Controls bar ──────────────────────────────────────────────────────────────

type SortMode = 'newest' | 'severity';

interface ControlsProps {
  severity: AlertSeverity | 'ALL';
  setSeverity: (s: AlertSeverity | 'ALL') => void;
  sort: SortMode;
  setSort: (s: SortMode) => void;
}

const SEVERITIES: ReadonlyArray<AlertSeverity | 'ALL'> = [
  'ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW',
];

const Controls = ({ severity, setSeverity, sort, setSort }: ControlsProps) => (
  <div className="flex items-center gap-3 flex-wrap">
    <div className="flex items-center gap-1.5" role="group" aria-label="Severity filter">
      <span className="text-xs text-gray-500 mr-1">Severity:</span>
      {SEVERITIES.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => setSeverity(s)}
          aria-pressed={severity === s}
          className={`text-[11px] px-2 py-0.5 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 ${
            severity === s
              ? 'bg-gray-200 text-gray-900 font-medium'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          {s}
        </button>
      ))}
    </div>

    <div className="flex items-center gap-1.5 ml-auto" role="group" aria-label="Sort order">
      <span className="text-xs text-gray-500 mr-1">Sort:</span>
      <button
        type="button"
        onClick={() => setSort('newest')}
        aria-pressed={sort === 'newest'}
        className={`text-[11px] px-2 py-0.5 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 ${
          sort === 'newest'
            ? 'bg-gray-200 text-gray-900 font-medium'
            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
        }`}
      >
        Newest
      </button>
      <button
        type="button"
        onClick={() => setSort('severity')}
        aria-pressed={sort === 'severity'}
        className={`text-[11px] px-2 py-0.5 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 ${
          sort === 'severity'
            ? 'bg-gray-200 text-gray-900 font-medium'
            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
        }`}
      >
        Highest severity
      </button>
    </div>
  </div>
);

// ── AlertFeed ─────────────────────────────────────────────────────────────────

export const AlertFeed = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const aois = useAoiStore((s) => s.aois);

  const [severity, setSeverity] = useState<AlertSeverity | 'ALL'>('ALL');
  const [sort, setSort] = useState<SortMode>('newest');
  const [selectedAlert, setSelectedAlert] = useState<AlertPublic | null>(null);

  const canAct = user !== null && (user.role === 'ADMIN' || user.role === 'OPERATOR');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['alerts', 'unacknowledged', severity],
    queryFn:  () => listAlerts({
      acknowledged: false,
      limit: 20,
      severity: severity === 'ALL' ? undefined : severity,
    }),
    staleTime: 10_000,
    refetchInterval: 10_000,
  });

  const ack = useMutation({
    mutationFn: (id: string) => acknowledgeAlert(id),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['alerts'] }); },
  });
  const escalate = useMutation({
    mutationFn: (id: string) => escalateAlert(id),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['alerts'] }); },
  });
  const markFalse = useMutation({
    mutationFn: (id: string) => markAlertFalse(id),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['alerts'] }); },
  });

  const aoiLabelOf = (id: string | null): string => {
    if (id === null) return 'Unknown AOI';
    return aois.find((a) => a.id === id)?.name ?? id;
  };

  const sorted = useMemo(() => {
    const list = [...(data?.alerts ?? [])];
    if (sort === 'severity') {
      list.sort((a, b) => {
        const r = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
        if (r !== 0) return r;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    } else {
      list.sort((a, b) => {
        // Critical pin still applies under Newest, per existing behaviour.
        if (a.severity === 'CRITICAL' && b.severity !== 'CRITICAL') return -1;
        if (b.severity === 'CRITICAL' && a.severity !== 'CRITICAL') return  1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    }
    return list;
  }, [data, sort]);

  return (
    <>
      <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-white">Active Alerts</h2>
          {data !== undefined && (
            <span className="rounded-full bg-gray-700 px-2.5 py-0.5 text-xs text-gray-300">
              {data.total} total
            </span>
          )}
        </div>

        <div className="mb-4">
          <Controls
            severity={severity}
            setSeverity={setSeverity}
            sort={sort}
            setSort={setSort}
          />
        </div>

        {isLoading && (
          <p className="text-sm text-gray-400">Loading alerts…</p>
        )}

        {isError && (
          <p className="text-sm text-red-400">Failed to load alerts. Retrying…</p>
        )}

        {!isLoading && !isError && sorted.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="mb-2 text-3xl text-gray-600">&#10003;</div>
            <p className="text-sm text-gray-400">No active alerts</p>
          </div>
        )}

        {!isLoading && !isError && sorted.length > 0 && (
          <div className="flex flex-col gap-2">
            {sorted.map((alert) => (
              <AlertRow
                key={alert.id}
                alert={alert}
                aoiLabel={aoiLabelOf(alert.aoiId)}
                canAct={canAct}
                ackingId={ack.isPending ? ack.variables ?? null : null}
                escalatingId={escalate.isPending ? escalate.variables ?? null : null}
                markingId={markFalse.isPending ? markFalse.variables ?? null : null}
                onAcknowledge={(id) => ack.mutate(id)}
                onEscalate={(id) => escalate.mutate(id)}
                onMarkFalse={(id) => markFalse.mutate(id)}
                onOpen={setSelectedAlert}
              />
            ))}
          </div>
        )}
      </div>

      {selectedAlert !== null && (
        <AlertDetailModal
          alert={selectedAlert}
          context={{ aoiLabel: aoiLabelOf(selectedAlert.aoiId) }}
          onClose={() => setSelectedAlert(null)}
        />
      )}
    </>
  );
};
