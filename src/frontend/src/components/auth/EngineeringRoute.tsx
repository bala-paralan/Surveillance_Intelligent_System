import { type ReactNode } from 'react';
import { useAuthStore } from '@/store/authStore';

interface EngineeringRouteProps {
  children: ReactNode;
}

export const EngineeringRoute = ({ children }: EngineeringRouteProps) => {
  const hasRole = useAuthStore((s) => s.hasRole);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!hasRole('ENGINEER') && !hasRole('ADMIN')) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-6xl font-bold text-gray-700 mb-4">403</p>
          <h1 className="text-2xl font-semibold text-white mb-2">Access Denied</h1>
          <p className="text-gray-400">
            You do not have permission to view this page. Engineering or Admin role required.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
