import type { Threat } from '@shared/types';
import { SensorTypeIcon, sensorTypeLabel } from '@/components/threats/IllustrativeIcon';

interface Props {
  threat: Threat;
}

const formatPercent = (v: number): string => `${Math.round(v * 100)}%`;

export const ContributingSensorsList = ({ threat }: Props) => {
  if (threat.contributions.length === 0) {
    return (
      <p className="text-xs text-gray-500">
        No per-sensor contributions reported.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-1.5" aria-label="Contributing sensors">
      {threat.contributions.map((c) => (
        <li
          key={c.detection_id}
          className="flex items-center gap-2 rounded bg-gray-900/60 px-2 py-1.5"
        >
          <span className="text-gray-300 shrink-0">
            <SensorTypeIcon sensorType={c.sensor_type} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-gray-200 truncate">
              <span className="font-medium">{sensorTypeLabel(c.sensor_type)}</span>
              <span className="text-gray-500"> · {c.sensor_id}</span>
            </p>
            <p className="text-[10px] text-gray-400 truncate">
              {c.use_case_match}
            </p>
          </div>
          <span
            className="shrink-0 text-xs font-mono text-gray-300 bg-gray-800 px-1.5 py-0.5 rounded"
            aria-label={`Confidence ${formatPercent(c.confidence)}`}
          >
            {formatPercent(c.confidence)}
          </span>
        </li>
      ))}
    </ul>
  );
};
