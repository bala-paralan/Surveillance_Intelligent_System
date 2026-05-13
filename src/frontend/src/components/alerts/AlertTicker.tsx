import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listAlerts, acknowledgeAlert } from '@/api/alerts';
import type { AlertPublic, AlertSeverity } from '@/api/alerts';
import { useAuth } from '@/hooks/useAuth';
import { useAoiStore } from '@/store/aoiStore';
import { narrativeFromAlert } from '@/components/alerts/NarrativeTemplate';
import { AlertDetailModal } from '@/components/alerts/AlertDetailModal';
import { alertToThreat } from '@/api/threats';
import { SensorTypeIcon } from '@/components/threats/IllustrativeIcon';

// ── Props ─────────────────────────────────────────────────────────────────────

interface AlertTickerProps {
  aoiId: string;
}

// ── Severity helpers ──────────────────────────────────────────────────────────

const SEVERITY_BORDER: Record<AlertSeverity, string> = {
  CRITICAL: 'border-red-600',
  HIGH:     'border-orange-500',
  MEDIUM:   'border-yellow-400',
  LOW:      'border-blue-500',
};

const SEVERITY_BADGE: Record<AlertSeverity, string> = {
  CRITICAL: 'bg-red-600 text-white',
  HIGH:     'bg-orange-500 text-white',
  MEDIUM:   'bg-yellow-400 text-gray-900',
  LOW:      'bg-blue-500 text-white',
};

// ── Time helpers ──────────────────────────────────────────────────────────────

const timeAgo = (iso: string): string => {
  const diffMs = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60)  return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60)  return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24)    return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const timeAbs = (iso: string): string => {
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
};

// ── AlertTickerCard ───────────────────────────────────────────────────────────

interface CardProps {
  alert: AlertPublic;
  aoiLabel: string;
  canAct: boolean;
  onAck: (id: string) => void;
  acking: boolean;
  onClick: (alert: AlertPublic) => void;
}

const AlertTickerCard = ({ alert, aoiLabel, canAct, onAck, acking, onClick }: CardProps) => {
  const isCritical = alert.severity === 'CRITICAL';
  const sensorType = alertToThreat(alert).contributions[0]?.sensor_type;

  return (
    <div
      className={`
        flex flex-col gap-1 rounded-lg bg-gray-900/90 border
        ${SEVERITY_BORDER[alert.severity]}
        px-3 py-2 cursor-pointer select-none
        ${isCritical ? 'alert-critical-pulse' : ''}
        hover:bg-gray-800/90 transition-colors
        focus:outline-none focus:ring-2 focus:ring-gray-400
      `}
      role="button"
      tabIndex={0}
      aria-label={`Alert: ${alert.severity} ${alert.type} in ${aoiLabel}`}
      onClick={() => onClick(alert)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(alert); }}
    >
      <div className="flex items-center gap-2">
        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${SEVERITY_BADGE[alert.severity]}`}>
          {alert.severity}
        </span>
        {sensorType !== undefined && (
          <span className="text-gray-300" aria-hidden="true">
            <SensorTypeIcon sensorType={sensorType} size={14} />
          </span>
        )}
        {isCritical && (
          <span className="text-red-400 text-sm" aria-hidden="true">&#128276;</span>
        )}
        <span
          className="text-gray-400 text-xs ml-auto"
          title={timeAbs(alert.createdAt)}
        >
          {timeAgo(alert.createdAt)}
        </span>
      </div>

      <p className="text-xs text-gray-200 leading-snug line-clamp-2">
        {narrativeFromAlert(alert)}
      </p>

      <div className="flex items-center gap-2 mt-0.5">
        <span
          className="text-[9px] text-gray-400 bg-gray-800 px-1.5 py-0.5 rounded truncate max-w-[10rem]"
          title={aoiLabel}
        >
          {aoiLabel}
        </span>

        {canAct && !alert.acknowledged && (
          <button
            type="button"
            disabled={acking}
            onClick={(e) => { e.stopPropagation(); onAck(alert.id); }}
            className="ml-auto text-[10px] px-2 py-0.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
          >
            {acking ? 'Ack…' : 'Ack'}
          </button>
        )}
      </div>
    </div>
  );
};

// ── AlertTicker ───────────────────────────────────────────────────────────────

export const AlertTicker = ({ aoiId }: AlertTickerProps) => {
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();
  const aois = useAoiStore((s) => s.aois);
  const canAct = hasRole('OPERATOR') || hasRole('ADMIN');
  const [selectedAlert, setSelectedAlert] = useState<AlertPublic | null>(null);

  const { data } = useQuery({
    queryKey: ['alerts', 'ticker', aoiId],
    queryFn: () => listAlerts({ aoiId, acknowledged: false, limit: 5 }),
    refetchInterval: 10_000,
    staleTime: 9_000,
  });

  const { mutate: doAck, isPending: acking } = useMutation({
    mutationFn: (id: string) => acknowledgeAlert(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });

  const aoiLabelOf = (id: string | null): string => {
    if (id === null) return 'Unknown AOI';
    return aois.find((a) => a.id === id)?.name ?? id;
  };

  const alerts = data?.alerts ?? [];

  if (alerts.length === 0) return null;

  return (
    <>
      <div
        className="absolute top-3 right-3 z-20 flex flex-col gap-2 w-64 max-h-[calc(100%-2rem)] overflow-y-auto"
        aria-label="Alert ticker"
        role="region"
      >
        {alerts.map((alert) => (
          <AlertTickerCard
            key={alert.id}
            alert={alert}
            aoiLabel={aoiLabelOf(alert.aoiId)}
            canAct={canAct}
            onAck={(id) => doAck(id)}
            acking={acking}
            onClick={setSelectedAlert}
          />
        ))}
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
