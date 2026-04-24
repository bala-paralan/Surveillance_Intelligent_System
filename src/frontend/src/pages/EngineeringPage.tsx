import { RequireAuth } from '@/components/auth/RequireAuth';
import { EngineeringRoute } from '@/components/auth/EngineeringRoute';

const EngineeringContent = () => (
  <div className="min-h-[calc(100vh-56px)] bg-gray-900 p-8">
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Engineering Mode — System Health &amp; Diagnostics</h1>
        <p className="text-gray-400 mt-1 text-sm">
          Full diagnostic and configuration capabilities. Content coming in TASK-042.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {['Stream Health', 'Analytics Pipeline', 'Storage Metrics'].map((panel) => (
          <div key={panel} className="bg-gray-800 border border-gray-700 rounded-lg p-5">
            <h2 className="text-white font-semibold mb-2">{panel}</h2>
            <p className="text-gray-500 text-sm">Data available in TASK-042.</p>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export const EngineeringPage = () => (
  <RequireAuth>
    <EngineeringRoute>
      <EngineeringContent />
    </EngineeringRoute>
  </RequireAuth>
);
