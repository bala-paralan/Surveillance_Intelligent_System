// Global critical-alert banner — TASK-043 §10.
//
// Watches all panes (no aoiId filter) and surfaces a sticky banner across
// the whole console when an unacknowledged CRITICAL alert is present. A
// configurable audio cue is on by default per §9; the operator can mute
// per-session and the choice persists in localStorage.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listAlerts } from '@/api/alerts';
import type { AlertPublic } from '@/api/alerts';
import { useAoiStore } from '@/store/aoiStore';
import { AlertDetailModal } from '@/components/alerts/AlertDetailModal';
import { narrativeFromAlert } from '@/components/alerts/NarrativeTemplate';

const MUTE_KEY = 'sis-critical-banner-mute';

// Tiny synthesised beep so we don't ship a binary asset; the operator can
// mute it. Audio is best-effort — autoplay rules in some browsers gate
// the first ping until user interaction.
const playPing = (): void => {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AC === undefined) return;
    const ctx = new AC();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.value = 0.0001;
    gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
    osc.onended = () => { void ctx.close(); };
  } catch {
    // Audio is optional; surfacing a console error is engineering noise.
  }
};

export const GlobalCriticalBanner = () => {
  const aois = useAoiStore((s) => s.aois);
  const [muted, setMuted] = useState<boolean>(() => {
    try { return window.localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; }
  });
  const [selectedAlert, setSelectedAlert] = useState<AlertPublic | null>(null);
  const lastPingedIdRef = useRef<string | null>(null);

  const { data } = useQuery({
    queryKey: ['alerts', 'critical-banner'],
    queryFn: () => listAlerts({ severity: 'CRITICAL', acknowledged: false, limit: 5 }),
    refetchInterval: 10_000,
    staleTime: 9_000,
  });

  const critical = useMemo(() => data?.alerts ?? [], [data]);
  const top = critical[0];

  useEffect(() => {
    if (top === undefined) return;
    if (muted) return;
    if (lastPingedIdRef.current === top.id) return;
    lastPingedIdRef.current = top.id;
    playPing();
  }, [top, muted]);

  const setMutedPersistent = (next: boolean): void => {
    setMuted(next);
    try { window.localStorage.setItem(MUTE_KEY, next ? '1' : '0'); } catch { /* ignore */ }
  };

  if (top === undefined) return null;

  const aoiLabel = aois.find((a) => a.id === top.aoiId)?.name ?? top.aoiId ?? 'Unknown AOI';

  return (
    <>
      <div
        className="sticky top-0 z-30 w-full bg-red-700 text-white shadow-lg alert-critical-pulse"
        role="alert"
        aria-live="assertive"
      >
        <div className="flex items-center gap-3 px-4 py-2">
          <span className="text-base" aria-hidden="true">&#9888;</span>
          <span className="text-xs uppercase font-bold tracking-wide bg-white/20 rounded px-1.5 py-0.5">
            Critical
          </span>
          <button
            type="button"
            onClick={() => setSelectedAlert(top)}
            className="text-sm font-medium truncate flex-1 text-left hover:underline focus:outline-none focus:ring-2 focus:ring-white rounded"
            title={narrativeFromAlert(top)}
          >
            {narrativeFromAlert(top)}
          </button>
          <span className="text-xs opacity-90 shrink-0">{aoiLabel}</span>
          {critical.length > 1 && (
            <span className="text-xs bg-white/20 rounded px-1.5 py-0.5 shrink-0">
              +{critical.length - 1}
            </span>
          )}
          <button
            type="button"
            onClick={() => setMutedPersistent(!muted)}
            className="text-xs px-2 py-1 rounded bg-white/15 hover:bg-white/25 transition-colors focus:outline-none focus:ring-2 focus:ring-white"
            aria-pressed={muted}
            title={muted ? 'Unmute alert sound' : 'Mute alert sound'}
          >
            {muted ? '🔇 Muted' : '🔊 Sound'}
          </button>
        </div>
      </div>

      {selectedAlert !== null && (
        <AlertDetailModal
          alert={selectedAlert}
          context={{ aoiLabel }}
          onClose={() => setSelectedAlert(null)}
        />
      )}
    </>
  );
};
