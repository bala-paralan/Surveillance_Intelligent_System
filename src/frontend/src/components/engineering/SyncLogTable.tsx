import type { SyncLog } from '@/api/engineering';

// ── Helpers ───────────────────────────────────────────────────────────────────

type SyncStatus = SyncLog['status'];

const STATUS_BADGE: Record<SyncStatus, string> = {
  PENDING: 'bg-gray-700 text-gray-300',
  RUNNING: 'bg-blue-800 text-blue-200',
  SUCCESS: 'bg-green-800 text-green-200',
  FAILED:  'bg-red-800 text-red-300',
};

const formatDate = (iso: string | null): string => {
  if (iso === null) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface SyncLogTableProps {
  logs: SyncLog[];
}

// ── Component ─────────────────────────────────────────────────────────────────

export const SyncLogTable = ({ logs }: SyncLogTableProps) => {
  if (logs.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-500 text-sm">
        No sync logs found
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase tracking-wide">
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Started</th>
            <th className="px-3 py-2">Completed</th>
            <th className="px-3 py-2 text-right">Added</th>
            <th className="px-3 py-2 text-right">Updated</th>
            <th className="px-3 py-2 text-right">Removed</th>
            <th className="px-3 py-2">Error</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr
              key={log.id}
              className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors"
            >
              <td className="px-3 py-2">
                <span
                  className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${STATUS_BADGE[log.status]}`}
                >
                  {log.status}
                </span>
              </td>
              <td className="px-3 py-2 text-gray-300 text-xs">{formatDate(log.startedAt)}</td>
              <td className="px-3 py-2 text-gray-300 text-xs">{formatDate(log.completedAt)}</td>
              <td className="px-3 py-2 text-green-400 text-xs text-right">+{log.added}</td>
              <td className="px-3 py-2 text-yellow-400 text-xs text-right">{log.updated}</td>
              <td className="px-3 py-2 text-red-400 text-xs text-right">-{log.removed}</td>
              <td className="px-3 py-2 text-red-300 text-xs max-w-xs truncate" title={log.errorMessage ?? ''}>
                {log.errorMessage ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
