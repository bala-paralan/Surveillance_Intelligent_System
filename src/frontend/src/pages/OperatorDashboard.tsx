import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAoiStore } from '@/store/aoiStore';
import { useAuth } from '@/hooks/useAuth';
import { AlertFeed } from '@/components/alerts/AlertFeed';

export const OperatorDashboard = () => {
  const { user } = useAuth();
  const { aois, fetchAois } = useAoiStore();

  useEffect(() => {
    void fetchAois();
  }, [fetchAois]);

  return (
    <div className="min-h-[calc(100vh-56px)] bg-gray-900 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Operator Dashboard</h1>
          {user !== null && (
            <p className="text-gray-400 mt-1 text-sm">
              Welcome back, {user.email}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
            <p className="text-gray-400 text-xs uppercase tracking-wide font-semibold mb-1">
              Active AOIs
            </p>
            <p className="text-3xl font-bold text-white">{aois.length}</p>
            <Link
              to="/aoi"
              className="mt-3 inline-block text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              Manage AOIs &rarr;
            </Link>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
            <p className="text-gray-400 text-xs uppercase tracking-wide font-semibold mb-1">
              Cameras
            </p>
            <p className="text-3xl font-bold text-white">—</p>
            <Link
              to="/cameras"
              className="mt-3 inline-block text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              Manage cameras &rarr;
            </Link>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
            <p className="text-gray-400 text-xs uppercase tracking-wide font-semibold mb-1">
              Active Alerts
            </p>
            <p className="text-3xl font-bold text-white">—</p>
            <span className="mt-3 inline-block text-sm text-gray-400">
              See alert feed below
            </span>
          </div>
        </div>

        <div className="mb-8">
          <AlertFeed />
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
          <h2 className="text-white font-semibold mb-3">Quick Access</h2>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/aoi"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-md transition-colors"
            >
              AOI Manager
            </Link>
            <Link
              to="/cameras"
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm font-medium rounded-md transition-colors"
            >
              Camera Grid
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
