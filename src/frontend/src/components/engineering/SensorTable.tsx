import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { patchSensorHealth } from '@/api/engineering';
import { useAuth } from '@/hooks/useAuth';
import type { SensorPublic } from '@/api/catalogue';

// ── Helpers ───────────────────────────────────────────────────────────────────

const HEALTH_DOT: Record<string, string> = {
  HEALTHY:  'bg-green-500',
  DEGRADED: 'bg-yellow-400',
  OFFLINE:  'bg-red-500',
  UNKNOWN:  'bg-gray-400',
};

const timeAgo = (iso: string): string => {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60)   return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface SensorTableProps {
  sensors: SensorPublic[];
}

// ── Component ─────────────────────────────────────────────────────────────────

export const SensorTable = ({ sensors }: SensorTableProps) => {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('ADMIN');
  const queryClient = useQueryClient();
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const { mutate: setMaintenance } = useMutation({
    mutationFn: ({ id }: { id: string }) => patchSensorHealth(id, 'OFFLINE'),
    onMutate: ({ id }) => setTogglingId(id),
    onSettled: () => {
      setTogglingId(null);
      void queryClient.invalidateQueries({ queryKey: ['sensors'] });
    },
  });

  if (sensors.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-500 text-sm">
        No sensors found
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase tracking-wide">
            <th className="px-3 py-2">Health</th>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2">ID</th>
            <th className="px-3 py-2">BOP Zone</th>
            <th className="px-3 py-2">Last Heartbeat</th>
            {isAdmin && <th className="px-3 py-2">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {sensors.map((sensor) => (
            <tr
              key={sensor.id}
              className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors"
            >
              <td className="px-3 py-2">
                <span
                  className={`inline-block w-2.5 h-2.5 rounded-full ${HEALTH_DOT[sensor.health] ?? 'bg-gray-400'}`}
                  title={sensor.health}
                  aria-label={sensor.health}
                />
              </td>
              <td className="px-3 py-2 text-gray-200 font-mono text-xs">{sensor.type}</td>
              <td className="px-3 py-2 text-gray-400 font-mono text-xs">{sensor.id.slice(-10)}</td>
              <td className="px-3 py-2 text-gray-400 font-mono text-xs">
                {sensor.bopZoneId ?? '—'}
              </td>
              <td className="px-3 py-2 text-gray-400 text-xs">
                {sensor.lastHeartbeat !== null ? timeAgo(sensor.lastHeartbeat) : '—'}
              </td>
              {isAdmin && (
                <td className="px-3 py-2">
                  {sensor.health !== 'OFFLINE' && (
                    <button
                      type="button"
                      disabled={togglingId === sensor.id}
                      onClick={() => setMaintenance({ id: sensor.id })}
                      className="text-xs px-2 py-1 rounded bg-yellow-700 hover:bg-yellow-600 text-yellow-100 disabled:opacity-50 transition-colors"
                    >
                      {togglingId === sensor.id ? 'Setting…' : 'Maintenance'}
                    </button>
                  )}
                  {sensor.health === 'OFFLINE' && (
                    <span className="text-xs text-gray-500 italic">Offline</span>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
