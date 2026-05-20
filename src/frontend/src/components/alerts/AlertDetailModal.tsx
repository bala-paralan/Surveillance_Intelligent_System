import { useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { acknowledgeAlert, resolveAlert } from '@/api/alerts';
import type { AlertPublic, AlertSeverity } from '@/api/alerts';
import { useAuth } from '@/hooks/useAuth';
import { narrativeFromAlert } from '@/components/alerts/NarrativeTemplate';

// ── Helpers ───────────────────────────────────────────────────────────────────

const SEVERITY_BORDER: Record<AlertSeverity, string> = {
  CRITICAL: 'border-red-600',
  HIGH:     'border-orange-500',
  MEDIUM:   'border-yellow-400',
  LOW:      'border-blue-500',
};

const SEVERITY_TEXT: Record<AlertSeverity, string> = {
  CRITICAL: 'text-red-400',
  HIGH:     'text-orange-400',
  MEDIUM:   'text-yellow-400',
  LOW:      'text-blue-400',
};

const formatDate = (iso: string): string => {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface AlertDetailModalProps {
  alert: AlertPublic;
  onClose: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const AlertDetailModal = ({ alert, onClose }: AlertDetailModalProps) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();
  const canAct = hasRole('OPERATOR') || hasRole('ADMIN');

  useEffect(() => {
    const el = dialogRef.current;
    if (el === null) return;
    el.showModal();
    const handleClose = () => onClose();
    el.addEventListener('close', handleClose);
    return () => el.removeEventListener('close', handleClose);
  }, [onClose]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) onClose();
  };

  const { mutate: doAck, isPending: acking } = useMutation({
    mutationFn: () => acknowledgeAlert(alert.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['alerts'] });
      onClose();
    },
  });

  const { mutate: doResolve, isPending: resolving } = useMutation({
    mutationFn: () => resolveAlert(alert.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['alerts'] });
      onClose();
    },
  });

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      className={`bg-gray-800 text-white rounded-xl shadow-2xl border-2 ${SEVERITY_BORDER[alert.severity]} max-w-lg w-full p-0 backdrop:bg-black/60`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <span className={`text-xs font-bold uppercase tracking-wide ${SEVERITY_TEXT[alert.severity]}`}>
            {alert.severity}
          </span>
          <span className="text-white font-semibold">{alert.type}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors text-xl leading-none"
          aria-label="Close"
        >
          &times;
        </button>
      </div>

      {/* Body */}
      <div className="px-5 py-4 space-y-4">
        <div>
          <p className="text-sm text-gray-400 mb-1">Narrative</p>
          <p className="text-sm text-white">{narrativeFromAlert(alert)}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-gray-400 text-xs mb-0.5">Created</p>
            <p className="text-gray-200">{formatDate(alert.createdAt)}</p>
          </div>
          {alert.acknowledgedAt !== null && (
            <div>
              <p className="text-gray-400 text-xs mb-0.5">Acknowledged</p>
              <p className="text-gray-200">{formatDate(alert.acknowledgedAt)}</p>
            </div>
          )}
          {alert.resolvedAt !== null && (
            <div>
              <p className="text-gray-400 text-xs mb-0.5">Resolved</p>
              <p className="text-gray-200">{formatDate(alert.resolvedAt)}</p>
            </div>
          )}
          {alert.acknowledgedBy !== null && (
            <div>
              <p className="text-gray-400 text-xs mb-0.5">Acknowledged by</p>
              <p className="text-gray-200 font-mono text-xs">{alert.acknowledgedBy}</p>
            </div>
          )}
        </div>

        {(alert.bopZoneId !== null || alert.aoiId !== null) && (
          <div className="grid grid-cols-2 gap-3 text-sm">
            {alert.bopZoneId !== null && (
              <div>
                <p className="text-gray-400 text-xs mb-0.5">BOP Zone</p>
                <p className="text-gray-200 font-mono text-xs">{alert.bopZoneId}</p>
              </div>
            )}
            {alert.aoiId !== null && (
              <div>
                <p className="text-gray-400 text-xs mb-0.5">AOI</p>
                <p className="text-gray-200 font-mono text-xs">{alert.aoiId}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      {canAct && (
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-700">
          {!alert.acknowledged && (
            <button
              type="button"
              disabled={acking}
              onClick={() => doAck()}
              className="px-4 py-2 text-sm font-medium rounded-md bg-yellow-600 hover:bg-yellow-700 text-white disabled:opacity-50 transition-colors"
            >
              {acking ? 'Acknowledging…' : 'Acknowledge'}
            </button>
          )}
          {alert.resolvedAt === null && (
            <button
              type="button"
              disabled={resolving}
              onClick={() => doResolve()}
              className="px-4 py-2 text-sm font-medium rounded-md bg-green-700 hover:bg-green-600 text-white disabled:opacity-50 transition-colors"
            >
              {resolving ? 'Resolving…' : 'Resolve'}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-md bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors"
          >
            Close
          </button>
        </div>
      )}
    </dialog>
  );
};
