// AlertDetailModal — adapter that turns an AlertPublic into the canonical
// Threat shape and renders ThreatDetailDrawer. Kept as a thin wrapper for
// callers (AlertTicker) that still emit AlertPublic.

import type { AlertPublic } from '@/api/alerts';
import { alertToThreat } from '@/api/threats';
import {
  ThreatDetailDrawer,
  type ThreatDetailContext,
} from '@/components/threats/ThreatDetailDrawer';

interface AlertDetailModalProps {
  alert: AlertPublic;
  context?: ThreatDetailContext;
  onClose: () => void;
}

export const AlertDetailModal = ({
  alert,
  context,
  onClose,
}: AlertDetailModalProps) => {
  const threat = alertToThreat(alert);
  const ctx: ThreatDetailContext = {
    aoiLabel: context?.aoiLabel ?? alert.bopZoneId ?? alert.aoiId ?? 'zone',
    anchorLabel: context?.anchorLabel ?? alert.cameraId ?? undefined,
    anchorDistanceM: context?.anchorDistanceM,
  };
  return <ThreatDetailDrawer threat={threat} context={ctx} onClose={onClose} />;
};
