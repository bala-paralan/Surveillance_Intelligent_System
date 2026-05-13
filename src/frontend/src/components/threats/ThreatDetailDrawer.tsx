// Threat Detail Drawer — TASK-043 §5.3.
//
// Headline → mini-map → timeline → contributing sensors → fused score
// (with explanation) → recommended action → footer (Ack / Escalate /
// Mark False / engineering link).

import { useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  acknowledgeAlert,
  escalateAlert,
  markAlertFalse,
  resolveAlert,
} from '@/api/alerts';
import type { Severity, Threat } from '@shared/types';
import { useAuth } from '@/hooks/useAuth';
import { buildHeadline, fusedScoreExplanation } from '@/lib/headline';
import { recommendedActionFor } from '@/lib/recommendedAction';
import { ContributingSensorsList } from '@/components/threats/ContributingSensorsList';
import { DetectionTimeline } from '@/components/threats/DetectionTimeline';
import { ThreatMiniMap } from '@/components/threats/ThreatMiniMap';

// ── Severity styling ─────────────────────────────────────────────────────────

const SEVERITY_BORDER: Record<Severity, string> = {
  CRITICAL: 'border-red-600',
  HIGH:     'border-orange-500',
  MEDIUM:   'border-yellow-400',
  LOW:      'border-blue-500',
};

const SEVERITY_TEXT: Record<Severity, string> = {
  CRITICAL: 'text-red-400',
  HIGH:     'text-orange-400',
  MEDIUM:   'text-yellow-400',
  LOW:      'text-blue-400',
};

const SEVERITY_BADGE: Record<Severity, string> = {
  CRITICAL: 'bg-red-600 text-white',
  HIGH:     'bg-orange-500 text-white',
  MEDIUM:   'bg-yellow-400 text-gray-900',
  LOW:      'bg-blue-500 text-white',
};

// ── Props ───────────────────────────────────────────────────────────────────

export interface ThreatDetailContext {
  aoiLabel?: string;
  anchorLabel?: string;
  anchorDistanceM?: number;
}

interface ThreatDetailDrawerProps {
  threat: Threat;
  context?: ThreatDetailContext;
  // The drawer mutates against the alerts API by default (matches the
  // current backend surface). When the threat is sourced from a fusion
  // outcome with no alert id, callers can pass a no-op handler set instead.
  onClose: () => void;
  onOpenOnMap?: (threat: Threat) => void;
}

// ── Component ───────────────────────────────────────────────────────────────

export const ThreatDetailDrawer = ({
  threat,
  context,
  onClose,
  onOpenOnMap,
}: ThreatDetailDrawerProps) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const canAct = hasRole('OPERATOR') || hasRole('ADMIN');
  const canSeeEngineering = hasRole('ENGINEER') || hasRole('ADMIN');

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

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['alerts'] });
    void queryClient.invalidateQueries({ queryKey: ['fusion-outcomes'] });
  };

  const ack = useMutation({
    mutationFn: () => acknowledgeAlert(threat.threat_id),
    onSuccess: () => { refresh(); onClose(); },
  });
  const escalate = useMutation({
    mutationFn: () => escalateAlert(threat.threat_id),
    onSuccess: () => { refresh(); onClose(); },
  });
  const markFalse = useMutation({
    mutationFn: () => markAlertFalse(threat.threat_id),
    onSuccess: () => { refresh(); onClose(); },
  });
  const resolve = useMutation({
    mutationFn: () => resolveAlert(threat.threat_id),
    onSuccess: () => { refresh(); onClose(); },
  });

  const aoiLabel = context?.aoiLabel ?? threat.aoi_id;
  const anchorLabel = context?.anchorLabel ?? threat.contributions[0]?.sensor_id;
  const headline = buildHeadline(threat, {
    aoiLabel,
    anchorLabel,
    anchorDistanceM: context?.anchorDistanceM,
    anchorBearingDeg: threat.geo.direction_deg,
  });
  const explanation = fusedScoreExplanation(threat);
  const recommended = recommendedActionFor(threat);

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      className={`bg-gray-800 text-white rounded-xl shadow-2xl border-2 ${SEVERITY_BORDER[threat.severity]} max-w-2xl w-full p-0 backdrop:bg-black/60`}
      aria-label="Threat detail"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <span
            className={`text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded ${SEVERITY_BADGE[threat.severity]}`}
          >
            {threat.severity}
          </span>
          <span className={`font-semibold ${SEVERITY_TEXT[threat.severity]}`}>
            {aoiLabel}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors text-xl leading-none focus:outline-none focus:ring-2 focus:ring-gray-400 rounded"
          aria-label="Close"
        >
          &times;
        </button>
      </div>

      {/* Body */}
      <div className="px-5 py-4 grid grid-cols-1 md:grid-cols-[220px,1fr] gap-5">
        {/* Left: mini-map */}
        <div className="flex flex-col gap-3 items-start">
          <ThreatMiniMap threat={threat} />
          <div className="text-xs text-gray-400">
            <p>
              <span className="text-gray-500">First seen:</span>{' '}
              {new Date(threat.observed_at).toLocaleString()}
            </p>
            <p>
              <span className="text-gray-500">Last seen:</span>{' '}
              {new Date(threat.last_seen_at).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Right: headline, score, timeline, sensors, action */}
        <div className="flex flex-col gap-4 min-w-0">
          {/* Headline */}
          <p className="text-base text-white leading-snug">{headline}</p>

          {/* Fused score block */}
          <div className="rounded-lg bg-gray-900/60 border border-gray-700 p-3 flex items-center gap-4">
            <div className="text-center">
              <p className={`text-3xl font-bold leading-none ${SEVERITY_TEXT[threat.severity]}`}>
                {threat.fused_score.toFixed(2)}
              </p>
              <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-wide">
                Fused score
              </p>
            </div>
            <p className="text-sm text-gray-200 flex-1">{explanation}</p>
          </div>

          {/* Timeline */}
          <div>
            <p className="text-xs text-gray-400 mb-1.5 uppercase tracking-wide">Timeline</p>
            <DetectionTimeline threat={threat} />
          </div>

          {/* Contributing sensors */}
          <div>
            <p className="text-xs text-gray-400 mb-1.5 uppercase tracking-wide">
              Contributing sensors
            </p>
            <ContributingSensorsList threat={threat} />
          </div>

          {/* Recommended action */}
          <div>
            <p className="text-xs text-gray-400 mb-1 uppercase tracking-wide">
              Recommended action
            </p>
            <p className="text-sm text-gray-200 bg-gray-900/60 border border-gray-700 rounded p-2.5">
              {recommended}
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-gray-700 flex-wrap">
        <div className="flex items-center gap-2">
          {/* Engineering view link — RBAC-gated per §11 */}
          {canSeeEngineering && threat.evidence_refs !== undefined && threat.evidence_refs.length > 0 ? (
            <a
              href={`/engineering/signals?ref=${encodeURIComponent(threat.evidence_refs[0] ?? '')}`}
              className="text-xs text-blue-400 hover:text-blue-300 underline focus:outline-none focus:ring-2 focus:ring-blue-400 rounded"
            >
              Open evidence in engineering view
            </a>
          ) : (
            !canSeeEngineering && (
              <span
                className="text-xs text-gray-600"
                title="Engineering view is for maintenance — your role does not include it."
              >
                Evidence (maintenance only)
              </span>
            )
          )}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {onOpenOnMap !== undefined && (
            <button
              type="button"
              onClick={() => onOpenOnMap(threat)}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
            >
              Open on map
            </button>
          )}

          {canAct && (
            <>
              <button
                type="button"
                disabled={markFalse.isPending}
                onClick={() => markFalse.mutate()}
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-gray-700 hover:bg-gray-600 text-gray-200 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
              >
                {markFalse.isPending ? 'Marking…' : 'Mark false'}
              </button>

              <button
                type="button"
                disabled={escalate.isPending}
                onClick={() => escalate.mutate()}
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-red-700 hover:bg-red-600 text-white disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-red-400"
              >
                {escalate.isPending ? 'Escalating…' : 'Escalate'}
              </button>

              {!threat.acknowledged && (
                <button
                  type="button"
                  disabled={ack.isPending}
                  onClick={() => ack.mutate()}
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-yellow-600 hover:bg-yellow-700 text-white disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-300"
                >
                  {ack.isPending ? 'Acknowledging…' : 'Acknowledge'}
                </button>
              )}

              {threat.resolved_at === undefined && (
                <button
                  type="button"
                  disabled={resolve.isPending}
                  onClick={() => resolve.mutate()}
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-green-700 hover:bg-green-600 text-white disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-green-300"
                >
                  {resolve.isPending ? 'Resolving…' : 'Resolve'}
                </button>
              )}
            </>
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
          >
            Close
          </button>
        </div>
      </div>
    </dialog>
  );
};
