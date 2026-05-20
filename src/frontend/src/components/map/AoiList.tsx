import { useAoiStore } from '@/store/aoiStore';
import { deleteAoi } from '@/api/aoi';
import { useAuthStore } from '@/store/authStore';

const formatDate = (iso: string): string => {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
};

const vertexCount = (coordinates: number[][][]): number => {
  // Subtract 1 because GeoJSON polygons close the ring (first === last point)
  const ring = coordinates[0];
  if (ring === undefined) return 0;
  return Math.max(0, ring.length - 1);
};

export const AoiList = () => {
  const { aois, activeAoiId, setActiveAoi, removeAoi } = useAoiStore();
  const hasRole = useAuthStore((s) => s.hasRole);

  const canDelete = hasRole('ADMIN') || hasRole('OPERATOR');

  const handleDelete = (id: string, name: string): void => {
    if (!window.confirm(`Delete AOI "${name}"?`)) return;
    deleteAoi(id)
      .then(() => removeAoi(id))
      .catch(() => window.alert('Failed to delete AOI.'));
  };

  if (aois.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-center px-4">
        <p className="text-gray-400 text-sm">No AOIs yet.</p>
        <p className="text-gray-500 text-xs mt-1">
          Use the "Draw AOI" button on the map to create one.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-gray-700">
      {aois.map((aoi) => {
        const isActive = aoi.id === activeAoiId;
        return (
          <li
            key={aoi.id}
            className={`p-3 cursor-pointer transition-colors ${
              isActive ? 'bg-blue-900/40' : 'hover:bg-gray-700/50'
            }`}
            onClick={() => setActiveAoi(isActive ? null : aoi.id)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm font-medium truncate ${
                    isActive ? 'text-blue-300' : 'text-white'
                  }`}
                >
                  {aoi.name}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {vertexCount(aoi.geometry.coordinates)} vertices &middot; {formatDate(aoi.updatedAt)}
                </p>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveAoi(aoi.id);
                  }}
                  title="Zoom to AOI"
                  className="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-600 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
                    />
                  </svg>
                </button>

                {canDelete && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(aoi.id, aoi.name);
                    }}
                    title="Delete AOI"
                    className="p-1 rounded text-gray-500 hover:text-red-400 hover:bg-gray-600 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m-7 0V5a1 1 0 011-1h4a1 1 0 011 1v2H5z"
                      />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
};
