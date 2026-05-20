import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { EngineeringRoute } from '@/components/auth/EngineeringRoute';
import { SensorTable } from '@/components/engineering/SensorTable';
import { WaveformPlaceholder } from '@/components/engineering/WaveformPlaceholder';
import { ThresholdsEditor } from '@/components/engineering/ThresholdsEditor';
import { SyncLogTable } from '@/components/engineering/SyncLogTable';
import { listSensors } from '@/api/catalogue';
import { listSyncLogs } from '@/api/engineering';

// ── Tab definition ────────────────────────────────────────────────────────────

type TabId = 'sensors' | 'waveforms' | 'thresholds' | 'sync-logs';

interface Tab {
  id: TabId;
  label: string;
}

const TABS: Tab[] = [
  { id: 'sensors',    label: 'Sensors' },
  { id: 'waveforms',  label: 'Waveforms' },
  { id: 'thresholds', label: 'Thresholds' },
  { id: 'sync-logs',  label: 'Sync Logs' },
];

// ── Tab content ───────────────────────────────────────────────────────────────

const SensorsTab = () => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['sensors'],
    queryFn: () => listSensors(),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return <p className="text-sm text-gray-400">Loading sensors…</p>;
  }

  if (isError) {
    return <p className="text-sm text-red-400">Failed to load sensors.</p>;
  }

  return <SensorTable sensors={data?.sensors ?? []} />;
};

const SyncLogsTab = () => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['sync-logs'],
    queryFn: listSyncLogs,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return <p className="text-sm text-gray-400">Loading sync logs…</p>;
  }

  if (isError) {
    return <p className="text-sm text-red-400">Failed to load sync logs.</p>;
  }

  return <SyncLogTable logs={data?.logs ?? []} />;
};

// ── Engineering content ───────────────────────────────────────────────────────

const EngineeringContent = () => {
  const [activeTab, setActiveTab] = useState<TabId>('sensors');

  return (
    <div className="min-h-[calc(100vh-56px)] bg-gray-900">
      {/* Page header */}
      <div className="px-6 py-4 bg-gray-800 border-b border-gray-700">
        <h1 className="text-xl font-bold text-white">Engineering — System Health &amp; Diagnostics</h1>
        <p className="text-gray-400 text-sm mt-0.5">
          Sensor management, waveform inspection, fusion tuning, and GIS sync logs
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-gray-700 bg-gray-800/50 px-6">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`
              px-4 py-3 text-sm font-medium border-b-2 transition-colors focus:outline-none
              ${activeTab === tab.id
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'}
            `}
            aria-selected={activeTab === tab.id}
            role="tab"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      <div className="px-6 py-6" role="tabpanel">
        {activeTab === 'sensors'    && <SensorsTab />}
        {activeTab === 'waveforms'  && <WaveformPlaceholder />}
        {activeTab === 'thresholds' && <ThresholdsEditor />}
        {activeTab === 'sync-logs'  && <SyncLogsTab />}
      </div>
    </div>
  );
};

// ── EngineeringPage ───────────────────────────────────────────────────────────

export const EngineeringPage = () => (
  <RequireAuth>
    <EngineeringRoute>
      <EngineeringContent />
    </EngineeringRoute>
  </RequireAuth>
);
