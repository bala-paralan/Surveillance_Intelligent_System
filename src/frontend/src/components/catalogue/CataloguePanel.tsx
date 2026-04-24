import { useQuery } from '@tanstack/react-query';
import { listCatalogue, type CatalogueItem } from '@/api/catalogue';

// ── Types ────────────────────────────────────────────────────────────────────

interface CataloguePanelProps {
  aoiId: string;
}

// ── Health dot ───────────────────────────────────────────────────────────────

const HEALTH_DOT: Record<string, string> = {
  HEALTHY:  'bg-green-500',
  DEGRADED: 'bg-yellow-400',
  OFFLINE:  'bg-red-500',
  UNKNOWN:  'bg-gray-400',
};

const healthDotClass = (health: string): string =>
  HEALTH_DOT[health] ?? 'bg-gray-400';

// ── Time-ago helper ───────────────────────────────────────────────────────────

const timeAgo = (iso: string): string => {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60)  return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
};

// ── Kind badge colours ────────────────────────────────────────────────────────

const KIND_BADGE: Record<string, string> = {
  sensor: 'bg-blue-800 text-blue-200',
  camera: 'bg-purple-800 text-purple-200',
  asset:  'bg-teal-800 text-teal-200',
};

// ── Item row ──────────────────────────────────────────────────────────────────

const ItemRow = ({ item }: { item: CatalogueItem }): React.ReactElement => (
  <div className="flex items-center gap-2 px-3 py-2 hover:bg-gray-700 rounded-md transition-colors">
    {/* Health dot */}
    <span
      className={`w-2 h-2 rounded-full shrink-0 ${healthDotClass(item.health)}`}
      title={item.health}
    />

    {/* Type badge */}
    <span
      className={`text-xs px-1.5 py-0.5 rounded font-mono shrink-0 ${KIND_BADGE[item.kind] ?? 'bg-gray-700 text-gray-300'}`}
    >
      {item.type}
    </span>

    {/* ID (truncated) */}
    <span className="text-gray-300 text-xs font-mono truncate flex-1" title={item.id}>
      {item.id.slice(-8)}
    </span>

    {/* Last heartbeat */}
    <span className="text-gray-500 text-xs shrink-0">
      {item.lastHeartbeat !== null ? timeAgo(item.lastHeartbeat) : '—'}
    </span>
  </div>
);

// ── Group ─────────────────────────────────────────────────────────────────────

const GroupSection = ({
  groupKey,
  items,
}: {
  groupKey: string;
  items: CatalogueItem[];
}): React.ReactElement => (
  <div className="mb-3">
    <div className="px-3 py-1 flex items-center gap-2">
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
        {groupKey}
      </span>
      <span className="text-xs text-gray-600">{items.length}</span>
    </div>
    <div className="space-y-0.5">
      {items.map((item) => (
        <ItemRow key={item.id} item={item} />
      ))}
    </div>
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────

export const CataloguePanel = ({ aoiId }: CataloguePanelProps): React.ReactElement => {
  const { data, isLoading, isError, error } = useQuery({
    queryKey:  ['catalogue', aoiId],
    queryFn:   () => listCatalogue(aoiId),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full py-8">
        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <span className="ml-2 text-gray-400 text-sm">Loading catalogue…</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="px-4 py-6 text-red-400 text-sm">
        Failed to load catalogue:{' '}
        {error instanceof Error ? error.message : 'Unknown error'}
      </div>
    );
  }

  const items = data?.items ?? [];

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-gray-500">
        <svg
          className="w-8 h-8 mb-2 opacity-40"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <p className="text-sm">No sensors found in this AOI</p>
      </div>
    );
  }

  // Group items by type
  const groups = new Map<string, CatalogueItem[]>();
  for (const item of items) {
    const key = item.type;
    const existing = groups.get(key);
    if (existing !== undefined) {
      existing.push(item);
    } else {
      groups.set(key, [item]);
    }
  }

  return (
    <div className="overflow-y-auto h-full py-2">
      {/* Summary bar */}
      <div className="flex items-center gap-3 px-3 pb-2 mb-1 border-b border-gray-700">
        <span className="text-xs text-gray-400">
          {items.length} item{items.length !== 1 ? 's' : ''} in AOI
        </span>
        {data?.aoiId !== undefined && (
          <span className="text-xs font-mono text-gray-600 truncate">{data.aoiId.slice(-8)}</span>
        )}
      </div>

      {/* Groups */}
      {[...groups.entries()].map(([key, groupItems]) => (
        <GroupSection key={key} groupKey={key} items={groupItems} />
      ))}
    </div>
  );
};
