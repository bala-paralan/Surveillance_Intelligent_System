// Horizontal time strip — one tick per contributing detection.
// Each tick is colored by sensor type. Hover surface shows the absolute time.

import type { Threat } from '@shared/types';
import type { SensorType } from '@shared/types';
import { sensorTypeLabel } from '@/components/threats/IllustrativeIcon';

interface Props {
  threat: Threat;
}

const SENSOR_COLOR: Record<SensorType, string> = {
  seismic:  '#a78bfa', // violet
  acoustic: '#60a5fa', // blue
  thermal:  '#fb923c', // orange
  lidar:    '#34d399', // green
  camera:   '#f472b6', // pink
};

const formatAbs = (iso: string): string => {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
};

export const DetectionTimeline = ({ threat }: Props) => {
  const start = new Date(threat.observed_at).getTime();
  const end = new Date(threat.last_seen_at).getTime();
  const span = Math.max(end - start, 1);

  const ticks = threat.contributions
    .map((c) => ({
      ...c,
      offsetMs: new Date(c.observed_at).getTime() - start,
    }))
    .filter((c) => Number.isFinite(c.offsetMs));

  return (
    <div aria-label="Detection timeline">
      <div className="relative h-10 rounded bg-gray-900/60 border border-gray-700 overflow-hidden">
        {/* Baseline */}
        <div className="absolute inset-x-2 top-1/2 h-px bg-gray-700" />

        {ticks.map((t, i) => {
          const left = `${Math.min(98, Math.max(2, (t.offsetMs / span) * 96 + 2))}%`;
          return (
            <div
              key={`${t.detection_id}-${i}`}
              className="absolute top-1/2 -translate-y-1/2"
              style={{ left }}
              title={`${sensorTypeLabel(t.sensor_type)} · ${formatAbs(t.observed_at)}`}
            >
              <span
                className="block w-2.5 h-2.5 rounded-full ring-2 ring-gray-800"
                style={{ background: SENSOR_COLOR[t.sensor_type] }}
              />
            </div>
          );
        })}

        {/* Endpoint labels */}
        <span className="absolute left-1.5 bottom-0 text-[9px] text-gray-500">
          {formatAbs(threat.observed_at)}
        </span>
        <span className="absolute right-1.5 bottom-0 text-[9px] text-gray-500">
          {formatAbs(threat.last_seen_at)}
        </span>
      </div>
    </div>
  );
};
