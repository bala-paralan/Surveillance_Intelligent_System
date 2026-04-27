import { useEffect } from 'react';
import { useAoiStore } from '@/store/aoiStore';
import { LayoutSwitcher } from '@/components/layout/LayoutSwitcher';
import { QuadviewLayout } from '@/components/layout/QuadviewLayout';
import { AoiLibraryDrawer } from '@/components/layout/AoiLibraryDrawer';
import { GlobalCriticalBanner } from '@/components/alerts/GlobalCriticalBanner';

export const OperatorDashboard = () => {
  const { fetchAois } = useAoiStore();

  useEffect(() => {
    void fetchAois();
  }, [fetchAois]);

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] bg-gray-900">
      <GlobalCriticalBanner />

      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700 shrink-0">
        <h1 className="text-white font-semibold text-base">Operator Dashboard</h1>
        <div className="flex items-center gap-3">
          <AoiLibraryDrawer />
          <LayoutSwitcher />
        </div>
      </div>

      {/* Main content — quadview */}
      <div className="flex-1 overflow-hidden p-1">
        <QuadviewLayout />
      </div>
    </div>
  );
};
