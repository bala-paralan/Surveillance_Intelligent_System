/**
 * AlertFeed — real-time alert feed widget.
 *
 * - Fetches unacknowledged alerts via GET /alerts?acknowledged=false&limit=20
 * - Auto-refreshes every 10 seconds (react-query staleTime: 10 000 ms)
 * - Severity badges: CRITICAL=red, HIGH=orange, MEDIUM=yellow, LOW=blue
 * - CRITICAL alerts are pinned at the top and never auto-dismissed
 * - Shows "No active alerts" empty state
 * - Acknowledge button visible for OPERATOR and ADMIN roles
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { listAlerts, acknowledgeAlert } from '@/api/alerts';
import type { AlertPublic, AlertSeverity } from '@/api/alerts';

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

// ── Time-ago helper ───────────────────────────────────────────────────────────

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

// ── Single alert row ──────────────────────────────────────────────────────────

interface AlertRowProps {
  alert:        AlertPublic;
  canAcknowledge: boolean;
  onAcknowledge:  (id: string) => void;
  acknowledging:  boolean;
}

const AlertRow = ({
  alert,
  canAcknowledge,
  onAcknowledge,
  acknowledging,
}: AlertRowProps) => (
  <div
    className={`flex items-start gap-3 rounded-md bg-gray-800 px-4 py-3 ${SEVERITY_ROW[alert.severity]}`}
  >
    {/* Severity badge */}
    <span
      className={`mt-0.5 shrink-0 rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${SEVERITY_BADGE[alert.severity]}`}
    >
      {alert.severity}
    </span>

    {/* Content */}
    <div className="min-w-0 flex-1">
      <p className="text-sm font-medium text-white">{alert.type}</p>
      <p className="mt-0.5 text-sm text-gray-300 break-words">{alert.message}</p>
      <p className="mt-1 text-xs text-gray-500">{timeAgo(alert.createdAt)}</p>
    </div>

    {/* Acknowledge */}
    {canAcknowledge && !alert.acknowledged && (
      <button
        type="button"
        disabled={acknowledging}
        onClick={() => onAcknowledge(alert.id)}
        className="shrink-0 rounded bg-gray-700 px-2.5 py-1 text-xs font-medium text-gray-200 hover:bg-gray-600 disabled:opacity-50 transition-colors"
      >
        {acknowledging ? 'Ack…' : 'Acknowledge'}
      </button>
    )}

    {alert.acknowledged && (
      <span className="shrink-0 rounded bg-gray-700 px-2.5 py-1 text-xs text-gray-400">
        Acknowledged
      </span>
    )}
  </div>
);

// ── AlertFeed ─────────────────────────────────────────────────────────────────

export const AlertFeed = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const canAcknowledge =
    user !== null && (user.role === 'ADMIN' || user.role === 'OPERATOR');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['alerts', 'unacknowledged'],
    queryFn:  () => listAlerts({ acknowledged: false, limit: 20 }),
    staleTime: 10_000,
    refetchInterval: 10_000,
  });

  const { mutate: doAcknowledge, isPending: acknowledging } = useMutation({
    mutationFn: (id: string) => acknowledgeAlert(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });

  // Sort: CRITICAL first, then by createdAt descending
  const sorted = [...(data?.alerts ?? [])].sort((a, b) => {
    if (a.severity === 'CRITICAL' && b.severity !== 'CRITICAL') return -1;
    if (b.severity === 'CRITICAL' && a.severity !== 'CRITICAL') return  1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold text-white">Active Alerts</h2>
        {data !== undefined && (
          <span className="rounded-full bg-gray-700 px-2.5 py-0.5 text-xs text-gray-300">
            {data.total} total
          </span>
        )}
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
          {sorted.map(alert => (
            <AlertRow
              key={alert.id}
              alert={alert}
              canAcknowledge={canAcknowledge}
              onAcknowledge={id => doAcknowledge(id)}
              acknowledging={acknowledging}
            />
          ))}
        </div>
      )}
    </div>
  );
};
